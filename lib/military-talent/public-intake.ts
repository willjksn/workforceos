import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateDedupeFlags,
  candidateEngagements,
  candidates,
  files,
  skillbridgeProfiles,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { getEmailProvider } from "../email";
import { matchExistingCandidate, normalizeEmail } from "../hiring/dedupe";
import { sanitizeResumeFilename, validateResumeUpload } from "../hiring/files";
import { militaryTalentAcknowledgementEmail } from "../hiring/templates";
import { resolveMilitaryTalentOwner } from "../inquiries/service";
import { resolvePublicOrganizationId } from "../public-api/organization";
import { createInAppNotification } from "../notifications/service";
import { stripHtml } from "../public-api/normalize";
import { getStorageProvider } from "../storage";
import { safeErrorMessage } from "../storage/diagnostics";
import type { MilitaryTalentPayload } from "@pierone/public-api-contracts";

export class MilitaryTalentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "MilitaryTalentError";
  }
}

function parseDate(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const APPROVAL_STATUS = new Set([
  "unknown",
  "not_started",
  "candidate_interested",
  "command_discussion",
  "pending",
  "approved",
  "denied",
  "not_required",
  "completed",
]);

function approvalStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized && APPROVAL_STATUS.has(normalized)) {
    return normalized as (typeof skillbridgeProfiles.$inferInsert)["skillbridgeApprovalStatus"];
  }
  return "unknown" as const;
}

export async function submitMilitaryTalentProfile(input: MilitaryTalentPayload & {
  resume?: { filename: string; mimeType: string; body: Uint8Array } | null;
}) {
  if (input.honeypot) throw new MilitaryTalentError("Submission rejected.");
  const organizationId = await resolvePublicOrganizationId();
  const ownerUserId = await resolveMilitaryTalentOwner(organizationId);
  const email = normalizeEmail(input.email);
  if (!email) throw new MilitaryTalentError("A valid email is required.");
  const firstName = stripHtml(input.firstName);
  const lastName = stripHtml(input.lastName);
  const fullName = `${firstName} ${lastName}`.trim();
  const db = getDb();

  const match = await matchExistingCandidate({
    organizationId,
    email,
    phone: input.phone,
  });
  let candidateId: string;
  if (match.kind === "matched") {
    candidateId = match.candidateId;
    await db
      .update(candidates)
      .set({
        fullName,
        phone: input.phone ?? undefined,
        city: input.currentLocation ? stripHtml(input.currentLocation) : undefined,
        linkedinUrl: input.linkedinUrl || undefined,
        militaryStatus: "active_duty",
        source: "pierone_public_website",
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));
  } else {
    const [created] = await db
      .insert(candidates)
      .values({
        organizationId,
        fullName,
        email,
        phone: input.phone ?? null,
        city: input.currentLocation ? stripHtml(input.currentLocation) : null,
        linkedinUrl: input.linkedinUrl || null,
        militaryStatus: "active_duty",
        source: "pierone_public_website",
      })
      .returning();
    candidateId = created.id;
    if (match.kind === "ambiguous") {
      await db.insert(candidateDedupeFlags).values({
        organizationId,
        candidateIds: match.candidateIds,
        reason: match.reason,
        status: "pending_review",
      });
    }
  }

  if (input.resume) {
    const checked = validateResumeUpload({
      filename: input.resume.filename,
      mimeType: input.resume.mimeType,
      sizeBytes: input.resume.body.byteLength,
      body: input.resume.body,
    });
    const storage = getStorageProvider();
    const safeName = sanitizeResumeFilename(input.resume.filename);
    const key = `military-talent/${organizationId}/${candidateId}/${Date.now()}-${safeName}`;
    let stored;
    try {
      stored = await storage.upload({
        key,
        body: input.resume.body,
        mimeType: checked.mimeType,
        filename: safeName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/storage is not configured/i.test(message)) {
        throw new MilitaryTalentError(message, 503);
      }
      const detail = safeErrorMessage(error);
      throw new MilitaryTalentError(detail ? `Resume storage failed. ${detail}` : "Resume storage failed.", 503);
    }
    const [file] = await db
      .insert(files)
      .values({
        organizationId,
        storageProvider: storage.name,
        storageKey: stored.key,
        filename: input.resume.filename,
        mimeType: checked.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum ?? null,
        privacyClass: "restricted_pii",
      })
      .returning();
    await db.update(candidates).set({ currentResumeFileId: file.id, updatedAt: new Date() }).where(eq(candidates.id, candidateId));
  }

  const [existing] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(and(eq(skillbridgeProfiles.candidateId, candidateId), isNull(skillbridgeProfiles.archivedAt)))
    .limit(1);

  const profileValues = {
    branch: input.branch ?? null,
    mosRateAfscDisplay: input.mos ? stripHtml(input.mos) : null,
    rankTitle: input.rank ? stripHtml(input.rank) : null,
    currentDutyLocation: input.currentInstallation
      ? stripHtml(input.currentInstallation)
      : input.currentLocation
        ? stripHtml(input.currentLocation)
        : null,
    separationDate: parseDate(input.separationDate),
    skillbridgeWindowStart: parseDate(input.skillbridgeWindowStart),
    skillbridgeWindowEnd: parseDate(input.skillbridgeWindowEnd),
    skillbridgeApprovalStatus: approvalStatus(input.skillbridgeApprovalStatus),
    preferredLocationPrimary: input.preferredLocation ? stripHtml(input.preferredLocation) : null,
    relocationWillingness: input.relocationWillingness ? stripHtml(input.relocationWillingness) : null,
    remotePreference: input.remotePreference ? stripHtml(input.remotePreference) : null,
    idealIndustry: input.idealIndustry ? stripHtml(input.idealIndustry) : null,
    idealEmployer: input.idealEmployer ? stripHtml(input.idealEmployer) : null,
    candidateStatus: existing?.candidateStatus === "new" || !existing ? ("new" as const) : existing.candidateStatus,
    resumeStatus: input.resume ? ("needs_review" as const) : existing?.resumeStatus ?? ("missing" as const),
    ownerUserId: existing?.ownerUserId ?? ownerUserId,
    nextAction: "Review website Military Talent Network submission",
    nextActionDueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  };

  let profileId: string;
  if (existing) {
    await db.update(skillbridgeProfiles).set(profileValues).where(eq(skillbridgeProfiles.id, existing.id));
    profileId = existing.id;
  } else {
    const [created] = await db
      .insert(skillbridgeProfiles)
      .values({
        organizationId,
        candidateId,
        ...profileValues,
      })
      .returning();
    profileId = created.id;
  }

  if (input.targetCivilianRoles) {
    // Stored on the candidate career interests; target-role rows are recruiter-maintained.
    await db
      .update(candidates)
      .set({ careerInterests: stripHtml(input.targetCivilianRoles), updatedAt: new Date() })
      .where(eq(candidates.id, candidateId));
  }

  await db.insert(candidateEngagements).values({
    candidateId,
    engagementType: "other",
    channel: "website",
    subject: "Military Talent Network submission",
    summary: "Submitted from the PierOne public website without a specific job application.",
    direction: "inbound",
    userId: ownerUserId,
  });

  await recordAuditEvent({
    organizationId,
    actor: { type: "system" },
    action: "military_talent.submitted",
    recordType: "skillbridge_profile",
    recordId: profileId,
    after: { source: "pierone_public_website", candidateId },
  });

  if (ownerUserId) {
    await createInAppNotification({
      organizationId,
      userId: ownerUserId,
      kind: "military_talent_received",
      title: "Military Talent Network submission",
      body: fullName,
      href: `/app/military/skillbridge/${profileId}`,
      recordType: "skillbridge_profile",
      recordId: profileId,
    });
  }

  const mail = militaryTalentAcknowledgementEmail({ firstName });
  await getEmailProvider().sendTransactional({
    organizationId,
    to: email,
    template: "military_talent_acknowledgement",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    entityType: "skillbridge_profile",
    entityId: profileId,
  });

  return { candidateId, profileId, reusedCandidate: match.kind === "matched" };
}

