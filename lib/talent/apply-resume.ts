import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { candidateExperiences, candidateSkills, candidates, skillbridgeProfiles, skills } from "../../db/schema";
import { recordAuditEvent, type AuditActor } from "../audit/record-audit-event";
import { parseResumeText } from "../hiring/resume-parse";
import { extractResumeText } from "../hiring/resume-text";
import { captureException } from "../observability/monitor";

function blank(value: string | null | undefined) {
  return value == null || value.trim() === "";
}

function skillMatches(skillName: string, tokens: Set<string>, fullText: string) {
  const lower = skillName.toLowerCase().trim();
  if (!lower) return false;
  if (tokens.has(lower)) return true;
  if (lower.length < 4) return false;
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(fullText);
}

export async function applyResumeToCandidate(input: {
  organizationId: string;
  candidateId: string;
  fileId: string;
  filename: string;
  mimeType: string;
  body: Uint8Array;
  actor: AuditActor;
}) {
  const text = await extractResumeText({
    filename: input.filename,
    mimeType: input.mimeType,
    body: input.body,
  });
  const parsed = parseResumeText(text);
  const db = getDb();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, input.candidateId), eq(candidates.organizationId, input.organizationId)))
    .limit(1);
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.archivedAt || candidate.privacyDeletedAt) {
    throw new Error("Candidate is not active");
  }

  const filled: string[] = [];
  const patch: Partial<typeof candidates.$inferInsert> = { updatedAt: new Date() };
  if (blank(candidate.phone) && parsed.phone) {
    patch.phone = parsed.phone;
    filled.push("phone");
  }
  if (blank(candidate.linkedinUrl) && parsed.linkedinUrl) {
    patch.linkedinUrl = parsed.linkedinUrl;
    filled.push("linkedinUrl");
  }
  if (blank(candidate.city) && parsed.city) {
    patch.city = parsed.city;
    filled.push("city");
  }
  if (blank(candidate.region) && parsed.region) {
    patch.region = parsed.region;
    filled.push("region");
  }
  if (blank(candidate.currentTitle) && parsed.currentTitle) {
    patch.currentTitle = parsed.currentTitle;
    filled.push("currentTitle");
  }
  if (blank(candidate.currentCompany) && parsed.currentCompany) {
    patch.currentCompany = parsed.currentCompany;
    filled.push("currentCompany");
  }
  if (candidate.yearsExperience == null && parsed.yearsExperience != null) {
    patch.yearsExperience = parsed.yearsExperience;
    filled.push("yearsExperience");
  }
  if (blank(candidate.careerInterests) && parsed.careerInterests) {
    patch.careerInterests = parsed.careerInterests;
    filled.push("careerInterests");
  }
  if (blank(candidate.email) && parsed.email) {
    patch.email = parsed.email;
    filled.push("email");
  }

  if (filled.length) {
    await db.update(candidates).set(patch).where(eq(candidates.id, candidate.id));
  }

  const existingExperiences = await db
    .select({ id: candidateExperiences.id })
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateId, candidate.id));
  if (existingExperiences.length === 0 && parsed.experiences.length) {
    await db.insert(candidateExperiences).values(
      parsed.experiences.map((item) => ({
        candidateId: candidate.id,
        employer: item.employer,
        title: item.title,
        summary: item.summary,
      })),
    );
    filled.push("experiences");
  }

  const catalog = await db.select({ id: skills.id, name: skills.name }).from(skills);
  const existingSkillRows = await db
    .select({ skillId: candidateSkills.skillId })
    .from(candidateSkills)
    .where(eq(candidateSkills.candidateId, candidate.id));
  const existingSkillIds = new Set(existingSkillRows.map((row) => row.skillId));
  const tokens = new Set(parsed.skillNames.map((name) => name.toLowerCase()));
  const toAdd = catalog.filter((skill) => !existingSkillIds.has(skill.id) && skillMatches(skill.name, tokens, text)).slice(0, 20);
  if (toAdd.length) {
    await db.insert(candidateSkills).values(
      toAdd.map((skill) => ({
        candidateId: candidate.id,
        skillId: skill.id,
        source: "resume",
        confidence: 50,
        humanVerified: false,
      })),
    );
    filled.push("skills");
  }

  const [profile] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(
      and(
        eq(skillbridgeProfiles.candidateId, candidate.id),
        eq(skillbridgeProfiles.organizationId, input.organizationId),
        isNull(skillbridgeProfiles.archivedAt),
      ),
    )
    .limit(1);
  if (profile) {
    const location = [parsed.city, parsed.region].filter(Boolean).join(", ");
    const profilePatch: Partial<typeof skillbridgeProfiles.$inferInsert> = { updatedAt: new Date() };
    if (blank(profile.currentDutyLocation) && location) {
      profilePatch.currentDutyLocation = location;
      filled.push("skillbridge.currentDutyLocation");
    }
    if (blank(profile.preferredLocationPrimary) && location) {
      profilePatch.preferredLocationPrimary = location;
      filled.push("skillbridge.preferredLocationPrimary");
    }
    if (Object.keys(profilePatch).length > 1) {
      await db.update(skillbridgeProfiles).set(profilePatch).where(eq(skillbridgeProfiles.id, profile.id));
    }
  }

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: input.actor,
    action: "candidate.resume_applied",
    recordType: "candidate",
    recordId: candidate.id,
    after: { fileId: input.fileId, filename: input.filename, filled },
    reason: "Filled empty Talent Network fields from uploaded resume. Existing values were not overwritten.",
  });

  return { filled, skippedExisting: true };
}

export async function tryApplyResumeToCandidate(
  input: Parameters<typeof applyResumeToCandidate>[0],
) {
  try {
    return await applyResumeToCandidate(input);
  } catch (error) {
    await captureException(error, { route: "apply-resume", candidateId: input.candidateId, fileId: input.fileId });
    return { filled: [] as string[], skippedExisting: true, error: error instanceof Error ? error.message : "Resume parse failed" };
  }
}
