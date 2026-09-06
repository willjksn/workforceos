import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  activities,
  candidates,
  companies,
  files,
  jobs,
  militaryInstallations,
  militaryOccupations,
  skillbridgeDocuments,
  skillbridgeNotes,
  skillbridgeOpportunities,
  skillbridgeOpportunityStageHistory,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skillbridgeTargetRoles,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { getStorageProvider } from "../storage";
import { assertUploadAllowed } from "../storage/limits";
import {
  ACTIVE_OPPORTUNITY_STAGES,
  ACTIVE_SKILLBRIDGE_STATUSES,
  STARTING_ENDING_SOON_DAYS,
  daysUntil,
  getSkillBridgeAlertRules,
} from "./rules";

export type SkillBridgeActor = {
  organizationId: string;
  userId: string;
};

const ACTIVE_STAGE_LIST = [...ACTIVE_OPPORTUNITY_STAGES];
const ACTIVE_STATUS_LIST = [...ACTIVE_SKILLBRIDGE_STATUSES];

function notArchivedCandidate() {
  return and(isNull(candidates.archivedAt), isNull(candidates.privacyDeletedAt));
}

export async function createSkillBridgeProfile(input: {
  actor: SkillBridgeActor;
  candidateId: string;
  branch?: "army" | "navy" | "air_force" | "marine_corps" | "coast_guard" | "space_force" | null;
  militaryOccupationId?: string | null;
  mosRateAfscDisplay?: string | null;
  rankCode?: string | null;
  rankTitle?: string | null;
  payGrade?: string | null;
  currentInstallationId?: string | null;
  currentDutyLocation?: string | null;
  yearsOfService?: number | null;
  endOfServiceDate?: Date | null;
  separationDate?: Date | null;
  skillbridgeWindowStart?: Date | null;
  skillbridgeWindowEnd?: Date | null;
  preferredLocationPrimary?: string | null;
  preferredLocations?: Array<{ locationLabel: string; city?: string | null; region?: string | null; isPrimary?: boolean }>;
  targetRoles?: Array<{ roleTitle: string; civilianOccupationId?: string | null; isPrimary?: boolean }>;
  idealEmployer?: string | null;
  idealEmployerKind?: "named_company" | "employer_category" | "industry" | "no_preference";
  idealIndustry?: string | null;
  candidateStatus?: (typeof ACTIVE_SKILLBRIDGE_STATUSES)[number] | "hired" | "nurture" | "closed";
  ownerUserId?: string | null;
  lastContactedAt?: Date | null;
  nextFollowUpAt?: Date | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | null;
  resumeStatus?: "missing" | "outdated" | "current" | "needs_review";
  developmentFixture?: boolean;
}) {
  const db = getDb();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, input.candidateId),
        eq(candidates.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!candidate) throw new Error("Candidate not found");

  const [existing] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(eq(skillbridgeProfiles.candidateId, input.candidateId))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [profile] = await db
    .insert(skillbridgeProfiles)
    .values({
      organizationId: input.actor.organizationId,
      candidateId: input.candidateId,
      branch: input.branch ?? null,
      militaryOccupationId: input.militaryOccupationId ?? null,
      mosRateAfscDisplay: input.mosRateAfscDisplay ?? null,
      rankCode: input.rankCode ?? null,
      rankTitle: input.rankTitle ?? null,
      payGrade: input.payGrade ?? null,
      currentInstallationId: input.currentInstallationId ?? null,
      currentDutyLocation: input.currentDutyLocation ?? null,
      yearsOfService: input.yearsOfService ?? null,
      endOfServiceDate: input.endOfServiceDate ?? null,
      separationDate: input.separationDate ?? input.endOfServiceDate ?? null,
      skillbridgeWindowStart: input.skillbridgeWindowStart ?? null,
      skillbridgeWindowEnd: input.skillbridgeWindowEnd ?? null,
      preferredLocationPrimary: input.preferredLocationPrimary ?? null,
      idealEmployer: input.idealEmployer ?? null,
      idealEmployerKind: input.idealEmployerKind ?? (input.idealEmployer ? "named_company" : "no_preference"),
      idealIndustry: input.idealIndustry ?? null,
      candidateStatus: input.candidateStatus ?? "new",
      ownerUserId: input.ownerUserId ?? input.actor.userId,
      lastContactedAt: input.lastContactedAt ?? null,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      nextAction: input.nextAction ?? null,
      nextActionDueAt: input.nextActionDueAt ?? null,
      resumeStatus: input.resumeStatus ?? "missing",
      developmentFixture: input.developmentFixture ?? false,
    })
    .returning();

  for (const location of input.preferredLocations ?? []) {
    await db.insert(skillbridgePreferredLocations).values({
      skillbridgeProfileId: profile.id,
      locationLabel: location.locationLabel,
      city: location.city ?? null,
      region: location.region ?? null,
      isPrimary: location.isPrimary ?? false,
    });
  }
  if (input.preferredLocationPrimary && !(input.preferredLocations ?? []).some((row) => row.isPrimary)) {
    const [city, region] = input.preferredLocationPrimary.split(",").map((part) => part.trim());
    await db.insert(skillbridgePreferredLocations).values({
      skillbridgeProfileId: profile.id,
      locationLabel: input.preferredLocationPrimary,
      city: city || null,
      region: region || null,
      isPrimary: true,
    });
  }
  for (const role of input.targetRoles ?? []) {
    await db.insert(skillbridgeTargetRoles).values({
      skillbridgeProfileId: profile.id,
      roleTitle: role.roleTitle,
      civilianOccupationId: role.civilianOccupationId ?? null,
      isPrimary: role.isPrimary ?? false,
    });
  }

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "skillbridge_profile.created",
    recordType: "skillbridge_profile",
    recordId: profile.id,
    after: { candidateId: profile.candidateId, status: profile.candidateStatus },
  });
  return profile;
}

export async function updateSkillBridgeProfile(input: {
  actor: SkillBridgeActor;
  profileId: string;
  patch: Partial<{
    preferredLocationPrimary: string | null;
    skillbridgeWindowStart: Date | null;
    skillbridgeWindowEnd: Date | null;
    endOfServiceDate: Date | null;
    candidateStatus: (typeof skillbridgeProfiles.$inferSelect)["candidateStatus"];
    resumeStatus: "missing" | "outdated" | "current" | "needs_review";
    lastContactedAt: Date | null;
    nextFollowUpAt: Date | null;
    nextAction: string | null;
    nextActionDueAt: Date | null;
    ownerUserId: string | null;
  }>;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(
      and(
        eq(skillbridgeProfiles.id, input.profileId),
        eq(skillbridgeProfiles.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!before) throw new Error("SkillBridge profile not found");
  const [after] = await db
    .update(skillbridgeProfiles)
    .set({ ...input.patch, updatedAt: new Date() })
    .where(eq(skillbridgeProfiles.id, input.profileId))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "skillbridge_profile.updated",
    recordType: "skillbridge_profile",
    recordId: after.id,
    before: {
      status: before.candidateStatus,
      windowStart: before.skillbridgeWindowStart,
      preferredLocationPrimary: before.preferredLocationPrimary,
    },
    after: {
      status: after.candidateStatus,
      windowStart: after.skillbridgeWindowStart,
      preferredLocationPrimary: after.preferredLocationPrimary,
    },
  });
  return after;
}

export async function createSkillBridgeOpportunity(input: {
  actor: SkillBridgeActor;
  profileId: string;
  companyId: string;
  jobId?: string | null;
  opportunityId?: string | null;
  searchProjectId?: string | null;
  stage?: (typeof ACTIVE_OPPORTUNITY_STAGES)[number] | "hired" | "nurture" | "closed" | "no_match_yet";
  source?: string | null;
  matchScore?: number | null;
  matchExplanation?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | null;
  lastEmployerContactAt?: Date | null;
  submittedAt?: Date | null;
}) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(
      and(
        eq(skillbridgeProfiles.id, input.profileId),
        eq(skillbridgeProfiles.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!profile) throw new Error("SkillBridge profile not found");
  const stage = input.stage ?? "candidate_identified";
  const [row] = await db
    .insert(skillbridgeOpportunities)
    .values({
      organizationId: input.actor.organizationId,
      skillbridgeProfileId: profile.id,
      candidateId: profile.candidateId,
      companyId: input.companyId,
      jobId: input.jobId ?? null,
      opportunityId: input.opportunityId ?? null,
      searchProjectId: input.searchProjectId ?? null,
      stage,
      source: input.source ?? "human",
      matchScore: input.matchScore != null ? String(input.matchScore) : null,
      matchExplanation: input.matchExplanation ?? null,
      nextAction: input.nextAction ?? null,
      nextActionDueAt: input.nextActionDueAt ?? null,
      lastEmployerContactAt: input.lastEmployerContactAt ?? null,
      submittedAt: input.submittedAt ?? null,
      ownerUserId: input.actor.userId,
    })
    .returning();
  await db.insert(skillbridgeOpportunityStageHistory).values({
    skillbridgeOpportunityId: row.id,
    fromStage: null,
    toStage: stage,
    changedByUserId: input.actor.userId,
    note: "Opportunity created",
  });
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "skillbridge_opportunity.created",
    recordType: "skillbridge_opportunity",
    recordId: row.id,
    after: { profileId: profile.id, companyId: input.companyId, stage },
  });
  return row;
}

export async function advanceSkillBridgeOpportunityStage(input: {
  actor: SkillBridgeActor;
  opportunityId: string;
  toStage: (typeof skillbridgeOpportunities.$inferSelect)["stage"];
  note?: string | null;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(skillbridgeOpportunities)
    .where(
      and(
        eq(skillbridgeOpportunities.id, input.opportunityId),
        eq(skillbridgeOpportunities.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!before) throw new Error("SkillBridge opportunity not found");
  const [after] = await db
    .update(skillbridgeOpportunities)
    .set({ stage: input.toStage, updatedAt: new Date() })
    .where(eq(skillbridgeOpportunities.id, input.opportunityId))
    .returning();
  await db.insert(skillbridgeOpportunityStageHistory).values({
    skillbridgeOpportunityId: before.id,
    fromStage: before.stage,
    toStage: input.toStage,
    changedByUserId: input.actor.userId,
    note: input.note ?? null,
  });
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "skillbridge_opportunity.stage_changed",
    recordType: "skillbridge_opportunity",
    recordId: after.id,
    before: { stage: before.stage },
    after: { stage: after.stage },
  });
  return after;
}

export async function addSkillBridgeFollowUp(input: {
  actor: SkillBridgeActor;
  profileId: string;
  subject: string;
  details?: string | null;
  followUpAt: Date;
}) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(
      and(
        eq(skillbridgeProfiles.id, input.profileId),
        eq(skillbridgeProfiles.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!profile) throw new Error("SkillBridge profile not found");
  await db.insert(activities).values({
    organizationId: input.actor.organizationId,
    activityType: "task",
    subject: input.subject,
    details: input.details ?? null,
    candidateId: profile.candidateId,
    createdByUserId: input.actor.userId,
    nextAction: input.subject,
    followUpAt: input.followUpAt,
  });
  const [updated] = await db
    .update(skillbridgeProfiles)
    .set({
      nextFollowUpAt: input.followUpAt,
      nextAction: input.subject,
      nextActionDueAt: input.followUpAt,
      updatedAt: new Date(),
    })
    .where(eq(skillbridgeProfiles.id, profile.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "skillbridge_profile.follow_up_set",
    recordType: "skillbridge_profile",
    recordId: profile.id,
    after: { followUpAt: input.followUpAt.toISOString() },
  });
  return updated;
}

export async function addSkillBridgeNote(input: {
  actor: SkillBridgeActor;
  profileId: string;
  body: string;
  kind?: (typeof skillbridgeNotes.$inferInsert)["kind"];
  visibility?: "internal" | "client_visible";
  opportunityId?: string | null;
}) {
  const db = getDb();
  const [note] = await db
    .insert(skillbridgeNotes)
    .values({
      organizationId: input.actor.organizationId,
      skillbridgeProfileId: input.profileId,
      skillbridgeOpportunityId: input.opportunityId ?? null,
      kind: input.kind ?? "other",
      visibility: input.visibility ?? "internal",
      body: input.body,
      createdByUserId: input.actor.userId,
    })
    .returning();
  return note;
}

export async function uploadSkillBridgeResume(input: {
  actor: SkillBridgeActor;
  profileId: string;
  filename: string;
  mimeType: string;
  body: Uint8Array;
}) {
  assertUploadAllowed({
    sizeBytes: input.body.byteLength,
    mimeType: input.mimeType,
    filename: input.filename,
  });
  const db = getDb();
  const [profile] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(
      and(
        eq(skillbridgeProfiles.id, input.profileId),
        eq(skillbridgeProfiles.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!profile) throw new Error("SkillBridge profile not found");
  const storage = getStorageProvider();
  const key = `skillbridge/${profile.id}/${Date.now()}-${input.filename}`;
  const stored = await storage.upload({
    key,
    body: input.body,
    mimeType: input.mimeType,
    filename: input.filename,
  });
  const [file] = await db
    .insert(files)
    .values({
      organizationId: input.actor.organizationId,
      storageProvider: storage.name,
      storageKey: stored.key,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum ?? null,
      privacyClass: "restricted_pii",
      uploadedByUserId: input.actor.userId,
    })
    .returning();
  await db.insert(skillbridgeDocuments).values({
    organizationId: input.actor.organizationId,
    skillbridgeProfileId: profile.id,
    candidateId: profile.candidateId,
    fileId: file.id,
    documentType: "resume",
    isCurrent: true,
  });
  await db
    .update(candidates)
    .set({ currentResumeFileId: file.id, updatedAt: new Date() })
    .where(eq(candidates.id, profile.candidateId));
  const [updated] = await db
    .update(skillbridgeProfiles)
    .set({ resumeStatus: "current", updatedAt: new Date() })
    .where(eq(skillbridgeProfiles.id, profile.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "skillbridge_profile.resume_uploaded",
    recordType: "skillbridge_profile",
    recordId: profile.id,
    after: { fileId: file.id, filename: file.filename, resumeStatus: "current" },
  });
  return { file, profile: updated };
}

export async function listSkillBridgeCards(input: {
  organizationId: string;
  ownerUserId?: string | null;
  profileId?: string | null;
  view?: string | null;
  canReadPii: boolean;
}) {
  const db = getDb();
  const rules = await getSkillBridgeAlertRules(input.organizationId);
  const now = new Date();
  const windowLimit = rules.windowApproachingDays ?? 90;
  const rows = await db
    .select({
      profile: skillbridgeProfiles,
      candidate: candidates,
      occupation: militaryOccupations,
      installation: militaryInstallations,
    })
    .from(skillbridgeProfiles)
    .innerJoin(candidates, eq(candidates.id, skillbridgeProfiles.candidateId))
    .leftJoin(militaryOccupations, eq(militaryOccupations.id, skillbridgeProfiles.militaryOccupationId))
    .leftJoin(militaryInstallations, eq(militaryInstallations.id, skillbridgeProfiles.currentInstallationId))
    .where(
      and(
        eq(skillbridgeProfiles.organizationId, input.organizationId),
        isNull(skillbridgeProfiles.archivedAt),
        notArchivedCandidate(),
        input.ownerUserId ? eq(skillbridgeProfiles.ownerUserId, input.ownerUserId) : undefined,
        input.profileId ? eq(skillbridgeProfiles.id, input.profileId) : undefined,
      ),
    )
    .orderBy(desc(skillbridgeProfiles.updatedAt));

  const profileIds = rows.map((row) => row.profile.id);
  const opportunities = profileIds.length
    ? await db
        .select({
          opportunity: skillbridgeOpportunities,
          company: companies,
          job: jobs,
        })
        .from(skillbridgeOpportunities)
        .innerJoin(companies, eq(companies.id, skillbridgeOpportunities.companyId))
        .leftJoin(jobs, eq(jobs.id, skillbridgeOpportunities.jobId))
        .where(
          and(
            inArray(skillbridgeOpportunities.skillbridgeProfileId, profileIds),
            isNull(skillbridgeOpportunities.archivedAt),
          ),
        )
    : [];
  const locations = profileIds.length
    ? await db
        .select()
        .from(skillbridgePreferredLocations)
        .where(inArray(skillbridgePreferredLocations.skillbridgeProfileId, profileIds))
    : [];
  const roles = profileIds.length
    ? await db
        .select()
        .from(skillbridgeTargetRoles)
        .where(inArray(skillbridgeTargetRoles.skillbridgeProfileId, profileIds))
    : [];

  const cards = rows.map((row) => {
    const linked = opportunities.filter((item) => item.opportunity.skillbridgeProfileId === row.profile.id);
    const active = linked.filter((item) => ACTIVE_STAGE_LIST.includes(item.opportunity.stage as (typeof ACTIVE_STAGE_LIST)[number]));
    const current = active[0] ?? linked[0];
    const preferred = locations.filter((item) => item.skillbridgeProfileId === row.profile.id);
    const targetRoles = roles.filter((item) => item.skillbridgeProfileId === row.profile.id);
    const windowDays = daysUntil(row.profile.skillbridgeWindowStart, now);
    const overdueFollowUp =
      Boolean(row.profile.nextActionDueAt && row.profile.nextActionDueAt < now) ||
      (rules.candidateNoContactDays != null &&
        (!row.profile.lastContactedAt ||
          now.getTime() - row.profile.lastContactedAt.getTime() > rules.candidateNoContactDays * 86400000));
    const employerOverdue = linked.some((item) => {
      if (!["employer_submitted", "interview", "hiring_manager_review"].includes(item.opportunity.stage)) return false;
      if (rules.employerFeedbackOverdueDays == null) return false;
      const last = item.opportunity.lastEmployerContactAt ?? item.opportunity.submittedAt;
      return !last || now.getTime() - last.getTime() > rules.employerFeedbackOverdueDays * 86400000;
    });
    return {
      profile: row.profile,
      candidate: {
        id: row.candidate.id,
        fullName: row.candidate.fullName,
        currentTitle: row.candidate.currentTitle,
        city: row.candidate.city,
        region: row.candidate.region,
        availability: row.candidate.availability,
        email: input.canReadPii ? row.candidate.email : null,
        phone: input.canReadPii ? row.candidate.phone : null,
      },
      occupation: row.occupation,
      installation: row.installation,
      preferredLocations: preferred,
      targetRoles,
      currentOpportunity: current
        ? {
            id: current.opportunity.id,
            stage: current.opportunity.stage,
            companyName: current.company.name,
            jobTitle: current.job?.title ?? null,
          }
        : null,
      hasActiveOpportunity: active.length > 0,
      windowDays,
      overdueFollowUp,
      employerOverdue,
      risks: [
        active.length === 0 ? "No opportunity" : null,
        windowDays != null && windowDays >= 0 && windowDays <= windowLimit ? "Window approaching" : null,
        overdueFollowUp ? "No recent contact" : null,
        rules.resumeMissingEnabled && row.profile.resumeStatus === "missing" ? "Resume missing" : null,
        employerOverdue ? "Employer response overdue" : null,
        row.profile.skillbridgeApprovalStatus === "pending" ? "Approval pending" : null,
      ].filter(Boolean) as string[],
    };
  });

  const view = input.view ?? "all";
  return cards.filter((card) => {
    if (view === "needs-action") return card.overdueFollowUp || card.risks.length > 0;
    if (view === "windows") return card.windowDays != null && card.windowDays >= 0 && card.windowDays <= windowLimit;
    if (view === "without-opportunities") return !card.hasActiveOpportunity;
    if (view === "employer-feedback") return card.employerOverdue;
    if (view === "interviews") return card.currentOpportunity?.stage === "interview";
    if (view === "pending") return card.profile.candidateStatus === "skillbridge_pending";
    if (view === "active") return card.profile.candidateStatus === "skillbridge_active";
    if (view === "conversion") return card.profile.candidateStatus === "conversion_pending";
    if (view === "hired") return card.profile.candidateStatus === "hired";
    return true;
  });
}

export async function getSkillBridgeDetail(profileId: string, organizationId: string, canReadPii: boolean) {
  const db = getDb();
  const cards = await listSkillBridgeCards({ organizationId, profileId, canReadPii });
  const card = cards.find((item) => item.profile.id === profileId);
  if (!card) return null;
  const timeline = await db
    .select()
    .from(activities)
    .where(
      and(eq(activities.organizationId, organizationId), eq(activities.candidateId, card.candidate.id)),
    )
    .orderBy(desc(activities.occurredAt));
  const notes = await db
    .select()
    .from(skillbridgeNotes)
    .where(eq(skillbridgeNotes.skillbridgeProfileId, profileId))
    .orderBy(desc(skillbridgeNotes.createdAt));
  const documents = await db
    .select({ document: skillbridgeDocuments, file: files })
    .from(skillbridgeDocuments)
    .innerJoin(files, eq(files.id, skillbridgeDocuments.fileId))
    .where(eq(skillbridgeDocuments.skillbridgeProfileId, profileId));
  const opportunities = await db
    .select({
      opportunity: skillbridgeOpportunities,
      company: companies,
      job: jobs,
    })
    .from(skillbridgeOpportunities)
    .innerJoin(companies, eq(companies.id, skillbridgeOpportunities.companyId))
    .leftJoin(jobs, eq(jobs.id, skillbridgeOpportunities.jobId))
    .where(eq(skillbridgeOpportunities.skillbridgeProfileId, profileId));
  const history = opportunities.length
    ? await db
        .select()
        .from(skillbridgeOpportunityStageHistory)
        .where(
          inArray(
            skillbridgeOpportunityStageHistory.skillbridgeOpportunityId,
            opportunities.map((row) => row.opportunity.id),
          ),
        )
        .orderBy(desc(skillbridgeOpportunityStageHistory.changedAt))
    : [];
  return { card, timeline, notes, documents, opportunities, history };
}

export async function getSkillBridgeMetrics(organizationId: string) {
  const rules = await getSkillBridgeAlertRules(organizationId);
  const now = new Date();
  const cards = await listSkillBridgeCards({ organizationId, canReadPii: false });
  const active = cards.filter((card) =>
    ACTIVE_STATUS_LIST.includes(card.profile.candidateStatus as (typeof ACTIVE_STATUS_LIST)[number]),
  );
  const windows = (days: number) =>
    active.filter((card) => card.windowDays != null && card.windowDays >= 0 && card.windowDays <= days).length;
  return {
    activeCandidates: active.length,
    windows30: windows(30),
    windows60: windows(60),
    windows90: windows(90),
    windows180: windows(180),
    withoutOpportunity: active.filter((card) => !card.hasActiveOpportunity).length,
    needsCandidateFollowUp: active.filter((card) => card.overdueFollowUp).length,
    needsEmployerFollowUp: active.filter((card) => card.employerOverdue).length,
    interviewsUpcoming: active.filter((card) => card.currentOpportunity?.stage === "interview").length,
    pendingApproval: active.filter((card) => card.profile.candidateStatus === "skillbridge_pending").length,
    skillbridgeActive: active.filter((card) => card.profile.candidateStatus === "skillbridge_active").length,
    conversionPending: active.filter((card) => card.profile.candidateStatus === "conversion_pending").length,
    hired: cards.filter((card) => card.profile.candidateStatus === "hired").length,
    generatedAt: now,
    rules,
  };
}

export async function getMySkillBridgeQueue(input: {
  organizationId: string;
  ownerUserId: string;
  global?: boolean;
  canReadPii: boolean;
}) {
  const cards = await listSkillBridgeCards({
    organizationId: input.organizationId,
    ownerUserId: input.global ? null : input.ownerUserId,
    canReadPii: input.canReadPii,
  });
  const now = new Date();
  const rules = await getSkillBridgeAlertRules(input.organizationId);
  const windowLimit = rules.windowApproachingDays ?? 90;
  const startSoon = cards.filter((card) => card.windowDays != null && card.windowDays >= 0 && card.windowDays <= STARTING_ENDING_SOON_DAYS);
  const endSoon = cards.filter((card) => {
    const remaining = daysUntil(card.profile.skillbridgeWindowEnd, now);
    return remaining != null && remaining >= 0 && remaining <= STARTING_ENDING_SOON_DAYS;
  });
  return {
    needsActionToday: cards.filter((card) => card.overdueFollowUp || (card.profile.nextActionDueAt && card.profile.nextActionDueAt <= now)),
    candidateFollowUps: cards.filter((card) => card.overdueFollowUp),
    employerFollowUps: cards.filter((card) => card.employerOverdue),
    documentsNeeded: cards.filter((card) => card.profile.resumeStatus === "missing" || card.profile.resumeStatus === "outdated"),
    windowsApproaching: cards.filter((card) => card.windowDays != null && card.windowDays >= 0 && card.windowDays <= windowLimit),
    withoutOpportunities: cards.filter((card) => !card.hasActiveOpportunity),
    upcomingInterviews: cards.filter((card) => card.currentOpportunity?.stage === "interview"),
    startingSoon: startSoon,
    endingSoon: endSoon,
    conversionDecisions: cards.filter((card) => card.profile.candidateStatus === "conversion_pending"),
    overdueFollowUps: cards.filter((card) => card.overdueFollowUp),
  };
}

export { ACTIVE_SKILLBRIDGE_STATUSES };
