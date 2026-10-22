import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateClearances,
  candidateCredentials,
  candidateEducation,
  candidateMilitaryDuties,
  candidateMilitaryEquipment,
  candidateMilitaryExperiences,
  candidateMilitaryTraining,
  candidateSkills,
  candidates,
  militaryOccupations,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skillbridgeTargetRoles,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { CAPABILITY_TRANSLATION_SOURCE } from "../military/capability-translation";
import { assessTransitionProfile, type CompletenessInput } from "./profile-completeness";

export class TransitionEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionEvidenceError";
  }
}

export type TransitionActor = {
  organizationId: string;
  userId: string | null;
};

type ClearanceLevel = "unknown" | "none" | "confidential" | "secret" | "top_secret" | "ts_sci";
type ClearanceStatus = "unknown" | "reported_active" | "reported_inactive" | "expired";
type EquipmentKind = "platform" | "system" | "equipment" | "tool";
type TrainingCategory =
  | "technical"
  | "nuclear"
  | "leadership"
  | "cyber"
  | "maintenance"
  | "logistics"
  | "aviation"
  | "instructor"
  | "other";
type Branch = "army" | "navy" | "air_force" | "marine_corps" | "coast_guard" | "space_force";

function auditActor(actor: TransitionActor) {
  return { type: "human" as const, userId: actor.userId };
}

async function requireCandidate(organizationId: string, candidateId: string) {
  const db = getDb();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        isNull(candidates.privacyDeletedAt),
      ),
    )
    .limit(1);
  if (!candidate) throw new TransitionEvidenceError("Candidate is not in this organization.");
  return candidate;
}

async function requireExperience(organizationId: string, candidateId: string, experienceId: string) {
  const db = getDb();
  const [experience] = await db
    .select()
    .from(candidateMilitaryExperiences)
    .where(
      and(
        eq(candidateMilitaryExperiences.id, experienceId),
        eq(candidateMilitaryExperiences.organizationId, organizationId),
        eq(candidateMilitaryExperiences.candidateId, candidateId),
      ),
    )
    .limit(1);
  if (!experience) throw new TransitionEvidenceError("Military experience is not in this organization.");
  return experience;
}

async function requireProfile(organizationId: string, candidateId: string) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(skillbridgeProfiles)
    .where(
      and(
        eq(skillbridgeProfiles.candidateId, candidateId),
        eq(skillbridgeProfiles.organizationId, organizationId),
        isNull(skillbridgeProfiles.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) throw new TransitionEvidenceError("Transition Talent Profile is not in this organization.");
  return profile;
}

function countOrNull(value: number | null | undefined, label: string) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new TransitionEvidenceError(`${label} must be a whole number when it is known.`);
  }
  return value;
}

export async function loadTransitionEvidence(organizationId: string, candidateId: string) {
  const db = getDb();
  const candidate = await requireCandidate(organizationId, candidateId);
  const experiences = await db
    .select({ experience: candidateMilitaryExperiences, occupation: militaryOccupations })
    .from(candidateMilitaryExperiences)
    .innerJoin(
      militaryOccupations,
      eq(militaryOccupations.id, candidateMilitaryExperiences.militaryOccupationId),
    )
    .where(
      and(
        eq(candidateMilitaryExperiences.candidateId, candidateId),
        eq(candidateMilitaryExperiences.organizationId, organizationId),
      ),
    );
  const experienceIds = experiences.map((row) => row.experience.id);
  const [duties, equipment, training, education, credentials, clearanceRows, skillRows, profile] = await Promise.all([
    experienceIds.length
      ? db
          .select()
          .from(candidateMilitaryDuties)
          .where(
            and(
              eq(candidateMilitaryDuties.organizationId, organizationId),
              inArray(candidateMilitaryDuties.candidateMilitaryExperienceId, experienceIds),
            ),
          )
      : Promise.resolve([]),
    experienceIds.length
      ? db
          .select()
          .from(candidateMilitaryEquipment)
          .where(
            and(
              eq(candidateMilitaryEquipment.organizationId, organizationId),
              inArray(candidateMilitaryEquipment.candidateMilitaryExperienceId, experienceIds),
            ),
          )
      : Promise.resolve([]),
    experienceIds.length
      ? db
          .select()
          .from(candidateMilitaryTraining)
          .where(
            and(
              eq(candidateMilitaryTraining.organizationId, organizationId),
              inArray(candidateMilitaryTraining.candidateMilitaryExperienceId, experienceIds),
            ),
          )
      : Promise.resolve([]),
    db
      .select()
      .from(candidateEducation)
      .where(and(eq(candidateEducation.candidateId, candidateId), eq(candidateEducation.organizationId, organizationId))),
    db
      .select()
      .from(candidateCredentials)
      .where(
        and(eq(candidateCredentials.candidateId, candidateId), eq(candidateCredentials.organizationId, organizationId)),
      ),
    db
      .select()
      .from(candidateClearances)
      .where(and(eq(candidateClearances.candidateId, candidateId), eq(candidateClearances.organizationId, organizationId)))
      .limit(1),
    db
      .select({ id: candidateSkills.id })
      .from(candidateSkills)
      .where(
        and(
          eq(candidateSkills.candidateId, candidateId),
          or(isNull(candidateSkills.source), ne(candidateSkills.source, CAPABILITY_TRANSLATION_SOURCE)),
        ),
      ),
    db
      .select()
      .from(skillbridgeProfiles)
      .where(
        and(
          eq(skillbridgeProfiles.candidateId, candidateId),
          eq(skillbridgeProfiles.organizationId, organizationId),
          isNull(skillbridgeProfiles.archivedAt),
        ),
      )
      .limit(1),
  ]);
  return {
    candidate,
    experiences,
    duties,
    equipment,
    training,
    education,
    credentials,
    clearance: clearanceRows[0] ?? null,
    skillsCount: skillRows.length,
    profile: profile[0] ?? null,
  };
}

export function completenessFromEvidence(
  evidence: Awaited<ReturnType<typeof loadTransitionEvidence>>,
  profile: {
    separationDate: Date | null;
    etsDate: Date | null;
    eaosDate: Date | null;
    endOfServiceDate: Date | null;
    retirementDate: Date | null;
    candidateAvailableDate: Date | null;
    preferredLocationPrimary: string | null;
    resumeStatus: CompletenessInput["resumeStatus"];
  } | null,
  extras: { preferredLocationCount: number; targetRoleCount: number; hasResumeFile: boolean },
) {
  return assessTransitionProfile({
    militaryExperiences: evidence.experiences.map((row) => ({
      certifications: row.experience.certifications,
      training: row.experience.training,
    })),
    duties: evidence.duties.map((row) => ({ humanVerified: row.humanVerified })),
    equipment: evidence.equipment.map((row) => ({ humanVerified: row.humanVerified })),
    trainingRecords: evidence.training.map((row) => ({ humanVerified: row.humanVerified })),
    education: evidence.education.map((row) => ({ humanVerified: row.humanVerified })),
    credentials: evidence.credentials.map((row) => ({ humanVerified: row.humanVerified })),
    skillsCount: evidence.skillsCount,
    separationDate: profile?.separationDate ?? null,
    etsDate: profile?.etsDate ?? null,
    eaosDate: profile?.eaosDate ?? null,
    endOfServiceDate: profile?.endOfServiceDate ?? null,
    retirementDate: profile?.retirementDate ?? null,
    availableDate: profile?.candidateAvailableDate ?? null,
    preferredLocationPrimary: profile?.preferredLocationPrimary ?? null,
    preferredLocationCount: extras.preferredLocationCount,
    candidateCity: evidence.candidate.city,
    targetRoleCount: extras.targetRoleCount,
    resumeStatus: profile?.resumeStatus ?? "missing",
    hasResumeFile: extras.hasResumeFile,
  });
}

export async function addMilitaryExperience(input: {
  actor: TransitionActor;
  candidateId: string;
  branch: Branch;
  code: string;
  rank?: string | null;
  payGrade?: string | null;
  unit?: string | null;
  yearsInOccupation?: number | null;
}) {
  await requireCandidate(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [occupation] = await db
    .select()
    .from(militaryOccupations)
    .where(and(eq(militaryOccupations.branch, input.branch), eq(militaryOccupations.code, input.code.trim())))
    .limit(1);
  if (!occupation) throw new TransitionEvidenceError("Occupation code was not found in the library.");
  const [created] = await db
    .insert(candidateMilitaryExperiences)
    .values({
      organizationId: input.actor.organizationId,
      candidateId: input.candidateId,
      militaryOccupationId: occupation.id,
      rank: input.rank ?? null,
      payGrade: input.payGrade ?? null,
      unit: input.unit ?? null,
      yearsInOccupation: countOrNull(input.yearsInOccupation, "Years in occupation"),
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "military_experience.added",
    recordType: "candidate_military_experience",
    recordId: created.id,
    after: { candidateId: input.candidateId, occupationId: occupation.id, rank: created.rank },
  });
  return created;
}

export async function updateMilitaryExperience(input: {
  actor: TransitionActor;
  candidateId: string;
  experienceId: string;
  rank?: string | null;
  payGrade?: string | null;
  unit?: string | null;
  leadershipLevel?: string | null;
  directReportsCount?: number | null;
  indirectReportsCount?: number | null;
  teamSize?: number | null;
  resourceScope?: string | null;
  shiftWatchLeadership?: string | null;
  programResponsibility?: string | null;
}) {
  const before = await requireExperience(input.actor.organizationId, input.candidateId, input.experienceId);
  const db = getDb();
  const [after] = await db
    .update(candidateMilitaryExperiences)
    .set({
      rank: input.rank === undefined ? before.rank : input.rank,
      payGrade: input.payGrade === undefined ? before.payGrade : input.payGrade,
      unit: input.unit === undefined ? before.unit : input.unit,
      leadershipLevel: input.leadershipLevel === undefined ? before.leadershipLevel : input.leadershipLevel,
      directReportsCount:
        input.directReportsCount === undefined
          ? before.directReportsCount
          : countOrNull(input.directReportsCount, "Direct reports"),
      indirectReportsCount:
        input.indirectReportsCount === undefined
          ? before.indirectReportsCount
          : countOrNull(input.indirectReportsCount, "Indirect reports"),
      teamSize: input.teamSize === undefined ? before.teamSize : countOrNull(input.teamSize, "Team size"),
      resourceScope: input.resourceScope === undefined ? before.resourceScope : input.resourceScope,
      shiftWatchLeadership:
        input.shiftWatchLeadership === undefined ? before.shiftWatchLeadership : input.shiftWatchLeadership,
      programResponsibility:
        input.programResponsibility === undefined ? before.programResponsibility : input.programResponsibility,
      leadershipSource: "recruiter",
      leadershipHumanVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(candidateMilitaryExperiences.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "military_experience.updated",
    recordType: "candidate_military_experience",
    recordId: after.id,
    before: {
      rank: before.rank,
      directReportsCount: before.directReportsCount,
      teamSize: before.teamSize,
    },
    after: {
      rank: after.rank,
      directReportsCount: after.directReportsCount,
      teamSize: after.teamSize,
      leadershipHumanVerified: after.leadershipHumanVerified,
    },
  });
  return after;
}

async function auditExperienceChild(actor: TransitionActor, experienceId: string, after: Record<string, unknown>) {
  await recordAuditEvent({
    organizationId: actor.organizationId,
    actor: auditActor(actor),
    action: "military_experience.updated",
    recordType: "candidate_military_experience",
    recordId: experienceId,
    after,
  });
}

export async function addMilitaryDuty(input: {
  actor: TransitionActor;
  candidateId: string;
  experienceId: string;
  title: string;
  description?: string | null;
  source?: "recruiter" | "candidate" | "resume" | "ai_extraction" | "military_occupation_mapping";
  humanVerified?: boolean;
  confidence?: number | null;
  sourceReference?: string | null;
}) {
  const experience = await requireExperience(input.actor.organizationId, input.candidateId, input.experienceId);
  const db = getDb();
  const source = input.source ?? "recruiter";
  const humanVerified = input.humanVerified ?? (source === "recruiter" || source === "candidate");
  const [created] = await db
    .insert(candidateMilitaryDuties)
    .values({
      organizationId: input.actor.organizationId,
      candidateMilitaryExperienceId: experience.id,
      title: input.title.trim(),
      description: input.description ?? null,
      source,
      sourceReference: input.sourceReference ?? null,
      humanVerified,
      confidence: input.confidence ?? null,
    })
    .returning();
  await auditExperienceChild(input.actor, experience.id, {
    dutyId: created.id,
    title: created.title,
    source: created.source,
    humanVerified: created.humanVerified,
  });
  return created;
}

export async function addMilitaryEquipment(input: {
  actor: TransitionActor;
  candidateId: string;
  experienceId: string;
  name: string;
  kind?: EquipmentKind;
  description?: string | null;
  source?: "recruiter" | "candidate" | "resume" | "ai_extraction" | "military_occupation_mapping";
  humanVerified?: boolean;
  confidence?: number | null;
}) {
  const experience = await requireExperience(input.actor.organizationId, input.candidateId, input.experienceId);
  const db = getDb();
  const [created] = await db
    .insert(candidateMilitaryEquipment)
    .values({
      organizationId: input.actor.organizationId,
      candidateMilitaryExperienceId: experience.id,
      name: input.name.trim(),
      kind: input.kind ?? "equipment",
      description: input.description ?? null,
      source: input.source ?? "recruiter",
      humanVerified: input.humanVerified ?? true,
      confidence: input.confidence ?? null,
    })
    .returning();
  await auditExperienceChild(input.actor, experience.id, {
    equipmentId: created.id,
    name: created.name,
    kind: created.kind,
    source: created.source,
    humanVerified: created.humanVerified,
  });
  return created;
}

export async function addMilitaryTraining(input: {
  actor: TransitionActor;
  candidateId: string;
  experienceId: string;
  schoolName: string;
  category?: TrainingCategory;
  description?: string | null;
  completionYear?: number | null;
}) {
  const experience = await requireExperience(input.actor.organizationId, input.candidateId, input.experienceId);
  const db = getDb();
  const [created] = await db
    .insert(candidateMilitaryTraining)
    .values({
      organizationId: input.actor.organizationId,
      candidateMilitaryExperienceId: experience.id,
      schoolName: input.schoolName.trim(),
      category: input.category ?? "other",
      description: input.description ?? null,
      completionYear: input.completionYear ?? null,
      source: "recruiter",
      humanVerified: true,
    })
    .returning();
  await auditExperienceChild(input.actor, experience.id, {
    trainingId: created.id,
    schoolName: created.schoolName,
    category: created.category,
    humanVerified: created.humanVerified,
  });
  return created;
}

export async function addCandidateEducation(input: {
  actor: TransitionActor;
  candidateId: string;
  institution: string;
  degreeOrCredential: string;
  fieldOfStudy?: string | null;
  completionStatus?: "unknown" | "in_progress" | "completed" | "incomplete";
  completionYear?: number | null;
}) {
  await requireCandidate(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [created] = await db
    .insert(candidateEducation)
    .values({
      organizationId: input.actor.organizationId,
      candidateId: input.candidateId,
      institution: input.institution.trim(),
      degreeOrCredential: input.degreeOrCredential.trim(),
      fieldOfStudy: input.fieldOfStudy ?? null,
      completionStatus: input.completionStatus ?? "unknown",
      completionYear: input.completionYear ?? null,
      source: "recruiter",
      humanVerified: true,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "education.added",
    recordType: "candidate_education",
    recordId: created.id,
    after: { candidateId: input.candidateId, institution: created.institution, humanVerified: true },
  });
  return created;
}

export async function updateCandidateEducation(input: {
  actor: TransitionActor;
  candidateId: string;
  educationId: string;
  fieldOfStudy?: string | null;
  completionStatus?: "unknown" | "in_progress" | "completed" | "incomplete";
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateEducation)
    .where(
      and(
        eq(candidateEducation.id, input.educationId),
        eq(candidateEducation.candidateId, input.candidateId),
        eq(candidateEducation.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!before) throw new TransitionEvidenceError("Education record is not in this organization.");
  const [after] = await db
    .update(candidateEducation)
    .set({
      fieldOfStudy: input.fieldOfStudy === undefined ? before.fieldOfStudy : input.fieldOfStudy,
      completionStatus: input.completionStatus ?? before.completionStatus,
      source: "recruiter",
      humanVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(candidateEducation.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "education.updated",
    recordType: "candidate_education",
    recordId: after.id,
    before: { fieldOfStudy: before.fieldOfStudy, humanVerified: before.humanVerified },
    after: { fieldOfStudy: after.fieldOfStudy, humanVerified: after.humanVerified },
  });
  return after;
}

export async function addCandidateCredential(input: {
  actor: TransitionActor;
  candidateId: string;
  name: string;
  issuer?: string | null;
  credentialId?: string | null;
  status?: "unknown" | "active" | "expired" | "revoked";
  issuedAt?: Date | null;
  expiresAt?: Date | null;
}) {
  await requireCandidate(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [created] = await db
    .insert(candidateCredentials)
    .values({
      organizationId: input.actor.organizationId,
      candidateId: input.candidateId,
      name: input.name.trim(),
      issuer: input.issuer ?? null,
      credentialId: input.credentialId ?? null,
      status: input.status ?? "unknown",
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      source: "recruiter",
      humanVerified: true,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "credential.added",
    recordType: "candidate_credential",
    recordId: created.id,
    after: { candidateId: input.candidateId, name: created.name, humanVerified: true },
  });
  return created;
}

export async function updateCandidateCredential(input: {
  actor: TransitionActor;
  candidateId: string;
  credentialId: string;
  issuer?: string | null;
  status?: "unknown" | "active" | "expired" | "revoked";
  expiresAt?: Date | null;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateCredentials)
    .where(
      and(
        eq(candidateCredentials.id, input.credentialId),
        eq(candidateCredentials.candidateId, input.candidateId),
        eq(candidateCredentials.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!before) throw new TransitionEvidenceError("Credential is not in this organization.");
  const [after] = await db
    .update(candidateCredentials)
    .set({
      issuer: input.issuer === undefined ? before.issuer : input.issuer,
      status: input.status ?? before.status,
      expiresAt: input.expiresAt === undefined ? before.expiresAt : input.expiresAt,
      source: "recruiter",
      humanVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(candidateCredentials.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "credential.updated",
    recordType: "candidate_credential",
    recordId: after.id,
    before: { issuer: before.issuer, status: before.status, humanVerified: before.humanVerified },
    after: { issuer: after.issuer, status: after.status, humanVerified: after.humanVerified },
  });
  return after;
}

export async function setCurrentClearance(input: {
  actor: TransitionActor;
  candidateId: string;
  clearanceLevel: ClearanceLevel;
  clearanceStatus?: ClearanceStatus;
  lastKnownActiveDate?: Date | null;
  source?: "candidate" | "recruiter" | "resume" | "ai_extraction";
  humanVerified?: boolean;
}) {
  await requireCandidate(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateClearances)
    .where(
      and(
        eq(candidateClearances.candidateId, input.candidateId),
        eq(candidateClearances.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  const values = {
    clearanceLevel: input.clearanceLevel,
    clearanceStatus: input.clearanceStatus ?? before?.clearanceStatus ?? "unknown",
    lastKnownActiveDate:
      input.lastKnownActiveDate === undefined ? before?.lastKnownActiveDate ?? null : input.lastKnownActiveDate,
    source: input.source ?? "recruiter",
    humanVerified: input.humanVerified ?? true,
    updatedAt: new Date(),
  };
  const [saved] = before
    ? await db.update(candidateClearances).set(values).where(eq(candidateClearances.id, before.id)).returning()
    : await db
        .insert(candidateClearances)
        .values({
          organizationId: input.actor.organizationId,
          candidateId: input.candidateId,
          ...values,
        })
        .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "clearance.changed",
    recordType: "candidate_clearance",
    recordId: saved.id,
    before: before
      ? { clearanceLevel: before.clearanceLevel, humanVerified: before.humanVerified, source: before.source }
      : null,
    after: { clearanceLevel: saved.clearanceLevel, humanVerified: saved.humanVerified, source: saved.source },
  });
  return saved;
}

export async function updateTransitionProfile(input: {
  actor: TransitionActor;
  candidateId: string;
  patch: Partial<{
    separationDate: Date | null;
    etsDate: Date | null;
    eaosDate: Date | null;
    endOfServiceDate: Date | null;
    retirementDate: Date | null;
    candidateAvailableDate: Date | null;
    skillbridgeEligibilityDate: Date | null;
    skillbridgeWindowStart: Date | null;
    skillbridgeWindowEnd: Date | null;
    terminalLeaveStart: Date | null;
    skillbridgeApprovalStatus: (typeof skillbridgeProfiles.$inferSelect)["skillbridgeApprovalStatus"];
    relocationWillingness: string | null;
    remotePreference: string | null;
    preferredLocationPrimary: string | null;
    idealIndustry: string | null;
    idealEmployer: string | null;
    careerPriorities: string | null;
    candidateStatus: (typeof skillbridgeProfiles.$inferSelect)["candidateStatus"];
    nextAction: string | null;
    nextFollowUpAt: Date | null;
  }>;
}) {
  const before = await requireProfile(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [after] = await db
    .update(skillbridgeProfiles)
    .set({ ...input.patch, updatedAt: new Date() })
    .where(eq(skillbridgeProfiles.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "transition_profile.updated",
    recordType: "skillbridge_profile",
    recordId: after.id,
    before: {
      separationDate: before.separationDate,
      careerPriorities: before.careerPriorities,
      candidateStatus: before.candidateStatus,
    },
    after: {
      separationDate: after.separationDate,
      careerPriorities: after.careerPriorities,
      candidateStatus: after.candidateStatus,
      skillbridgeWindowStart: after.skillbridgeWindowStart,
      skillbridgeWindowEnd: after.skillbridgeWindowEnd,
    },
  });
  return after;
}

export async function addPreferredLocation(input: {
  actor: TransitionActor;
  candidateId: string;
  locationLabel: string;
  city?: string | null;
  region?: string | null;
  isPrimary?: boolean;
}) {
  const profile = await requireProfile(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [created] = await db
    .insert(skillbridgePreferredLocations)
    .values({
      skillbridgeProfileId: profile.id,
      locationLabel: input.locationLabel.trim(),
      city: input.city ?? null,
      region: input.region ?? null,
      isPrimary: input.isPrimary ?? false,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "transition_profile.updated",
    recordType: "skillbridge_profile",
    recordId: profile.id,
    after: { preferredLocationId: created.id, locationLabel: created.locationLabel },
  });
  return created;
}

export async function addTargetRole(input: {
  actor: TransitionActor;
  candidateId: string;
  roleTitle: string;
  jobFamily?: string | null;
  civilianOccupationId?: string | null;
  isPrimary?: boolean;
}) {
  const profile = await requireProfile(input.actor.organizationId, input.candidateId);
  const db = getDb();
  const [created] = await db
    .insert(skillbridgeTargetRoles)
    .values({
      skillbridgeProfileId: profile.id,
      roleTitle: input.roleTitle.trim(),
      jobFamily: input.jobFamily ?? null,
      civilianOccupationId: input.civilianOccupationId ?? null,
      isPrimary: input.isPrimary ?? false,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "transition_profile.updated",
    recordType: "skillbridge_profile",
    recordId: profile.id,
    after: { targetRoleId: created.id, roleTitle: created.roleTitle, jobFamily: created.jobFamily },
  });
  return created;
}

export async function completeTransitionProfileReview(input: { actor: TransitionActor; candidateId: string }) {
  const candidate = await requireCandidate(input.actor.organizationId, input.candidateId);
  const profile = await requireProfile(input.actor.organizationId, input.candidateId);
  const reviewedAt = new Date();
  const db = getDb();
  await db
    .update(candidates)
    .set({ lastProfileReviewAt: reviewedAt, updatedAt: reviewedAt })
    .where(eq(candidates.id, candidate.id));
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: auditActor(input.actor),
    action: "transition_profile.review_completed",
    recordType: "skillbridge_profile",
    recordId: profile.id,
    after: { candidateId: candidate.id, lastProfileReviewAt: reviewedAt.toISOString() },
    reason: "Human review recorded. Matching, ranking, and rejection were not changed.",
  });
  return { profileId: profile.id, lastProfileReviewAt: reviewedAt };
}
