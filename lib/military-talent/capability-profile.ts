import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateClearances,
  candidateCredentials,
  candidateMilitaryDuties,
  candidateMilitaryEquipment,
  candidateMilitaryExperiences,
  candidateMilitaryTraining,
  candidateSkillEvidence,
  candidateSkills,
  candidates,
  civilianOccupationJobFamilies,
  civilianOccupations,
  competencyClusters,
  jobFamilies,
  militaryOccupationSkills,
  militaryOccupations,
  occupationSkills,
  skills,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { completePrompt } from "../ai/provider";
import {
  CAPABILITY_TRANSLATION_SOURCE,
  assertCapabilityReview,
  draftCapabilitySuggestions,
  employerFacingCapabilities,
  explainOccupationFit,
  rankOccupationsByCapabilities,
  type CapabilityBasis,
  type CapabilityEvidenceCitation,
  type CapabilityProposal,
  type EvidenceType,
  type ReviewStatus,
  type StoredCapability,
  type TranslationEvidence,
} from "../military/capability-translation";

export class CapabilityProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityProfileError";
  }
}

type EvidenceColumn = {
  dutyId?: string | null;
  equipmentId?: string | null;
  trainingId?: string | null;
  credentialId?: string | null;
  clearanceId?: string | null;
  experienceId?: string | null;
  militaryOccupationSkillId?: string | null;
};

function pointersFor(item: CapabilityEvidenceCitation): EvidenceColumn {
  switch (item.evidenceType) {
    case "military_duty":
      return { dutyId: item.evidenceId };
    case "military_equipment":
      return { equipmentId: item.evidenceId };
    case "military_training":
      return { trainingId: item.evidenceId };
    case "credential":
      return { credentialId: item.evidenceId };
    case "clearance":
      return { clearanceId: item.evidenceId };
    case "leadership":
      return { experienceId: item.evidenceId };
    case "occupation_mapping":
      return { militaryOccupationSkillId: item.occupationSkillId ?? item.evidenceId };
    default:
      return {};
  }
}

function evidenceSource(type: EvidenceType): "resume" | "recruiter" | "ai_extraction" | "military_occupation_mapping" {
  if (type === "resume_skill") return "resume";
  if (type === "occupation_mapping") return "military_occupation_mapping";
  return "recruiter";
}

export function evidenceFromTransitionRows(input: {
  duties: Array<{ id: string; title: string; description?: string | null }>;
  equipment: Array<{ id: string; name: string; description?: string | null }>;
  training: Array<{ id: string; schoolName: string; description?: string | null }>;
  credentials: Array<{ id: string; name: string; issuer?: string | null }>;
  leadership: Array<{
    id: string;
    leadershipLevel?: string | null;
    directReportsCount?: number | null;
    programResponsibility?: string | null;
    resourceScope?: string | null;
  }>;
}): TranslationEvidence[] {
  const rows: TranslationEvidence[] = [];
  for (const duty of input.duties) {
    rows.push({
      id: duty.id,
      type: "military_duty",
      text: [duty.title, duty.description].filter(Boolean).join(". "),
    });
  }
  for (const item of input.equipment) {
    rows.push({
      id: item.id,
      type: "military_equipment",
      text: [item.name, item.description].filter(Boolean).join(". "),
    });
  }
  for (const item of input.training) {
    rows.push({
      id: item.id,
      type: "military_training",
      text: [item.schoolName, item.description].filter(Boolean).join(". "),
    });
  }
  for (const item of input.credentials) {
    rows.push({
      id: item.id,
      type: "credential",
      text: [item.name, item.issuer].filter(Boolean).join(" · "),
    });
  }
  for (const item of input.leadership) {
    const text = [
      item.leadershipLevel,
      item.directReportsCount ? `${item.directReportsCount} direct reports` : null,
      item.programResponsibility,
      item.resourceScope,
    ]
      .filter(Boolean)
      .join(". ");
    if (text.trim()) rows.push({ id: item.id, type: "leadership", text });
  }
  return rows;
}

async function requireCandidate(organizationId: string, candidateId: string) {
  const db = getDb();
  const [candidate] = await db
    .select({ id: candidates.id, organizationId: candidates.organizationId })
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), eq(candidates.organizationId, organizationId), isNull(candidates.archivedAt)))
    .limit(1);
  if (!candidate) throw new CapabilityProfileError("Candidate not found in this organization.");
  return candidate;
}

export async function loadTranslationInputs(organizationId: string, candidateId: string) {
  await requireCandidate(organizationId, candidateId);
  const db = getDb();
  const experiences = await db
    .select({ experience: candidateMilitaryExperiences, occupation: militaryOccupations })
    .from(candidateMilitaryExperiences)
    .innerJoin(militaryOccupations, eq(militaryOccupations.id, candidateMilitaryExperiences.militaryOccupationId))
    .where(
      and(
        eq(candidateMilitaryExperiences.organizationId, organizationId),
        eq(candidateMilitaryExperiences.candidateId, candidateId),
      ),
    );
  const experienceIds = experiences.map((row) => row.experience.id);
  const [duties, equipment, training, credentials, catalog, links] = await Promise.all([
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
      .from(candidateCredentials)
      .where(and(eq(candidateCredentials.organizationId, organizationId), eq(candidateCredentials.candidateId, candidateId))),
    db
      .select({
        id: skills.id,
        slug: skills.slug,
        name: skills.name,
        cluster: competencyClusters.name,
      })
      .from(skills)
      .leftJoin(competencyClusters, eq(competencyClusters.id, skills.competencyClusterId))
      .where(isNull(skills.archivedAt)),
    experiences.length
      ? db
          .select()
          .from(militaryOccupationSkills)
          .where(
            inArray(
              militaryOccupationSkills.militaryOccupationId,
              experiences.map((row) => row.occupation.id),
            ),
          )
      : Promise.resolve([]),
  ]);
  const evidence = evidenceFromTransitionRows({
    duties,
    equipment,
    training,
    credentials,
    leadership: experiences.map((row) => row.experience),
  });
  return {
    experiences,
    evidence,
    skills: catalog.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      competencyCluster: row.cluster,
    })),
    occupationLinks: links.map((row) => ({
      id: row.id,
      militaryOccupationId: row.militaryOccupationId,
      skillId: row.skillId,
      reviewStatus: row.reviewStatus,
      evidenceReference: row.evidenceReference,
      mappingQuality: row.mappingQuality,
      confidence: row.confidence,
    })),
    tourOccupationIds: experiences.map((row) => row.occupation.id),
    occupationLabel: experiences
      .map((row) => `${row.occupation.branch} ${row.occupation.code} ${row.occupation.title}`)
      .join("; "),
  };
}

export async function saveCapabilityDrafts(input: {
  organizationId: string;
  candidateId: string;
  actorUserId?: string | null;
  originatingAgentId?: string | null;
  proposals: CapabilityProposal[];
}) {
  await requireCandidate(input.organizationId, input.candidateId);
  const db = getDb();
  const saved: string[] = [];
  for (const proposal of input.proposals) {
    if (proposal.reviewStatus !== "pending" || proposal.employerFacing) {
      throw new CapabilityProfileError("Draft capabilities must stay pending.");
    }
    const [existing] = await db
      .select()
      .from(candidateSkills)
      .where(and(eq(candidateSkills.candidateId, input.candidateId), eq(candidateSkills.skillId, proposal.skillId)))
      .limit(1);
    if (existing && existing.organizationId !== input.organizationId) {
      throw new CapabilityProfileError("Candidate skill belongs to another organization.");
    }
    if (existing?.reviewStatus === "rejected") continue;

    let skillRow = existing;
    if (!skillRow) {
      const [created] = await db
        .insert(candidateSkills)
        .values({
          organizationId: input.organizationId,
          candidateId: input.candidateId,
          skillId: proposal.skillId,
          source: CAPABILITY_TRANSLATION_SOURCE,
          confidence: proposal.confidence,
          humanVerified: false,
          capabilityBasis: proposal.basis,
          reviewStatus: "pending",
          originatingAgentId: input.originatingAgentId ?? null,
          evidenceSummary: proposal.evidence.map((item) => item.citation).join(" "),
        })
        .returning();
      skillRow = created;
      await recordAuditEvent({
        organizationId: input.organizationId,
        actor: input.originatingAgentId
          ? { type: "agent", agentId: input.originatingAgentId }
          : { type: "human", userId: input.actorUserId ?? null },
        action: "candidate_capability.drafted",
        recordType: "candidate_skill",
        recordId: created.id,
        after: {
          skillId: proposal.skillId,
          basis: proposal.basis,
          reviewStatus: "pending",
          evidenceCount: proposal.evidence.length,
        },
      });
    } else if (skillRow.source === CAPABILITY_TRANSLATION_SOURCE && skillRow.reviewStatus === "pending") {
      await db
        .update(candidateSkills)
        .set({
          capabilityBasis: proposal.basis,
          confidence: proposal.confidence,
          evidenceSummary: proposal.evidence.map((item) => item.citation).join(" "),
          updatedAt: new Date(),
        })
        .where(eq(candidateSkills.id, skillRow.id));
    }

    const currentEvidence = await db
      .select()
      .from(candidateSkillEvidence)
      .where(eq(candidateSkillEvidence.candidateSkillId, skillRow.id));
    for (const item of proposal.evidence) {
      const pointer = pointersFor(item);
      const duplicate = currentEvidence.some((row) => {
        if (item.evidenceType === "military_duty") return row.dutyId === item.evidenceId;
        if (item.evidenceType === "military_equipment") return row.equipmentId === item.evidenceId;
        if (item.evidenceType === "military_training") return row.trainingId === item.evidenceId;
        if (item.evidenceType === "credential") return row.credentialId === item.evidenceId;
        if (item.evidenceType === "leadership") return row.experienceId === item.evidenceId;
        if (item.evidenceType === "occupation_mapping") {
          return row.militaryOccupationSkillId === (item.occupationSkillId ?? item.evidenceId);
        }
        return row.citation === item.citation && row.evidenceType === item.evidenceType;
      });
      if (duplicate) continue;
      await db.insert(candidateSkillEvidence).values({
        organizationId: input.organizationId,
        candidateSkillId: skillRow.id,
        evidenceType: item.evidenceType,
        citation: item.citation,
        source:
          proposal.basis === "inferred" && item.evidenceType !== "occupation_mapping"
            ? "ai_extraction"
            : evidenceSource(item.evidenceType),
        confidence: proposal.confidence,
        ...pointer,
      });
    }
    saved.push(skillRow.id);
  }
  return saved;
}

export async function draftCandidateCapabilities(input: {
  organizationId: string;
  candidateId: string;
  actorUserId: string;
  originatingAgentId?: string | null;
}) {
  const loaded = await loadTranslationInputs(input.organizationId, input.candidateId);
  const drafted = await draftCapabilitySuggestions({
    ...loaded,
    complete: async (prompt) => {
      const result = await completePrompt({
        taskType: "military_capability_translation",
        messages: [
          {
            role: "system",
            content:
              "You draft pending military-to-civilian capability suggestions. Cite only supplied evidence ids. Do not invent certifications or claim clearance verification. Do not approve.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
      });
      return { text: result.text, provider: result.provider, model: result.model };
    },
  });
  const ids = await saveCapabilityDrafts({
    organizationId: input.organizationId,
    candidateId: input.candidateId,
    actorUserId: input.actorUserId,
    originatingAgentId: input.originatingAgentId ?? null,
    proposals: drafted.proposals,
  });
  return { ...drafted, savedIds: ids };
}

function citationFromRow(row: typeof candidateSkillEvidence.$inferSelect): CapabilityEvidenceCitation {
  return {
    evidenceId: row.dutyId ?? row.equipmentId ?? row.trainingId ?? row.credentialId ?? row.clearanceId ?? row.experienceId ?? row.militaryOccupationSkillId ?? row.id,
    evidenceType: row.evidenceType,
    citation: row.citation,
    occupationSkillId: row.militaryOccupationSkillId,
  };
}

export async function loadCapabilityProfile(organizationId: string, candidateId: string) {
  await requireCandidate(organizationId, candidateId);
  const db = getDb();
  const rows = await db
    .select({
      link: candidateSkills,
      skill: skills,
      cluster: competencyClusters.name,
    })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .leftJoin(competencyClusters, eq(competencyClusters.id, skills.competencyClusterId))
    .where(and(eq(candidateSkills.candidateId, candidateId), eq(candidateSkills.organizationId, organizationId)));
  const evidenceRows = rows.length
    ? await db
        .select()
        .from(candidateSkillEvidence)
        .where(
          and(
            eq(candidateSkillEvidence.organizationId, organizationId),
            inArray(
              candidateSkillEvidence.candidateSkillId,
              rows.map((row) => row.link.id),
            ),
          ),
        )
    : [];
  const evidencedSkillIds = new Set(evidenceRows.map((row) => row.candidateSkillId));
  const capabilities: Array<StoredCapability & { id: string; evidenceSummary: string | null }> = rows
    .filter((row) => row.link.source === CAPABILITY_TRANSLATION_SOURCE || evidencedSkillIds.has(row.link.id))
    .map((row) => ({
      id: row.link.id,
      skillId: row.skill.id,
      skillSlug: row.skill.slug,
      skillName: row.skill.name,
      competencyCluster: row.cluster,
      basis: row.link.capabilityBasis as CapabilityBasis,
      reviewStatus: row.link.reviewStatus as ReviewStatus,
      confidence: row.link.confidence,
      evidenceSummary: row.link.evidenceSummary,
      evidence: evidenceRows.filter((item) => item.candidateSkillId === row.link.id).map(citationFromRow),
    }));
  const approved = employerFacingCapabilities(capabilities);
  const capabilitySkillIds = [...new Set(capabilities.map((row) => row.skillId))];
  const overlaps = capabilitySkillIds.length
    ? await db
        .select({ occupationId: occupationSkills.occupationId })
        .from(occupationSkills)
        .where(inArray(occupationSkills.skillId, capabilitySkillIds))
    : [];
  const occupationIds = [...new Set(overlaps.map((row) => row.occupationId))];
  const occupationRows = occupationIds.length
    ? await db
        .select({
          occupation: civilianOccupations,
          skillId: occupationSkills.skillId,
          skillName: skills.name,
          family: jobFamilies.name,
        })
        .from(civilianOccupations)
        .innerJoin(occupationSkills, eq(occupationSkills.occupationId, civilianOccupations.id))
        .innerJoin(skills, eq(skills.id, occupationSkills.skillId))
        .leftJoin(civilianOccupationJobFamilies, eq(civilianOccupationJobFamilies.occupationId, civilianOccupations.id))
        .leftJoin(jobFamilies, eq(jobFamilies.id, civilianOccupationJobFamilies.jobFamilyId))
        .where(inArray(civilianOccupations.id, occupationIds))
    : [];
  const grouped = new Map<string, { occupationId: string; title: string; jobFamilies: string[]; occupationSkills: Array<{ skillId: string; name: string }> }>();
  for (const row of occupationRows) {
    const current = grouped.get(row.occupation.id) ?? {
      occupationId: row.occupation.id,
      title: row.occupation.title,
      jobFamilies: [],
      occupationSkills: [],
    };
    if (!current.occupationSkills.some((skill) => skill.skillId === row.skillId)) {
      current.occupationSkills.push({ skillId: row.skillId, name: row.skillName });
    }
    if (row.family && !current.jobFamilies.includes(row.family)) current.jobFamilies.push(row.family);
    grouped.set(row.occupation.id, current);
  }
  const occupations = rankOccupationsByCapabilities({
    occupations: [...grouped.values()],
    capabilities,
  });
  const explained = [...grouped.values()].map((occupation) => explainOccupationFit({ ...occupation, capabilities }));
  return {
    proposed: capabilities.filter((row) => row.reviewStatus === "pending" || row.reviewStatus === "needs_review"),
    reviewed: approved,
    excluded: capabilities.filter((row) => row.reviewStatus === "rejected"),
    occupations,
    explanations: explained.filter((row) => row.employerFacing),
  };
}

export async function reviewCandidateCapability(input: {
  organizationId: string;
  actorUserId: string;
  candidateSkillId: string;
  status: "approved" | "rejected" | "needs_review";
  actorType?: "human" | "agent" | "system";
  citation?: string | null;
  confidence?: number | null;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateSkills)
    .where(and(eq(candidateSkills.id, input.candidateSkillId), eq(candidateSkills.organizationId, input.organizationId)))
    .limit(1);
  if (!before) throw new CapabilityProfileError("Capability not found in this organization.");
  assertCapabilityReview({
    actorType: input.actorType ?? "human",
    originatingAgentId: before.originatingAgentId,
    reviewerUserId: input.actorUserId,
    nextStatus: input.status,
  });
  const [after] = await db
    .update(candidateSkills)
    .set({
      reviewStatus: input.status,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      humanVerified: input.status === "approved",
      evidenceSummary: input.citation?.trim() ? input.citation.trim() : before.evidenceSummary,
      confidence: input.confidence ?? before.confidence,
      updatedAt: new Date(),
    })
    .where(eq(candidateSkills.id, before.id))
    .returning();
  if (input.citation?.trim()) {
    const [evidence] = await db
      .select()
      .from(candidateSkillEvidence)
      .where(
        and(
          eq(candidateSkillEvidence.candidateSkillId, before.id),
          eq(candidateSkillEvidence.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (evidence) {
      await db
        .update(candidateSkillEvidence)
        .set({ citation: input.citation.trim(), updatedAt: new Date() })
        .where(eq(candidateSkillEvidence.id, evidence.id));
    }
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate_capability.reviewed",
    recordType: "candidate_skill",
    recordId: after.id,
    before: { reviewStatus: before.reviewStatus, capabilityBasis: before.capabilityBasis },
    after: { reviewStatus: after.reviewStatus, humanVerified: after.humanVerified },
  });
  return after;
}

export async function reviewOccupationCapability(input: {
  organizationId: string;
  actorUserId: string;
  occupationSkillId: string;
  status: "approved" | "rejected" | "needs_review";
  actorType?: "human" | "agent" | "system";
  evidenceReference?: string | null;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(militaryOccupationSkills)
    .where(eq(militaryOccupationSkills.id, input.occupationSkillId))
    .limit(1);
  if (!before) throw new CapabilityProfileError("Occupation capability not found.");
  assertCapabilityReview({
    actorType: input.actorType ?? "human",
    originatingAgentId: before.originatingAgentId,
    reviewerUserId: input.actorUserId,
    nextStatus: input.status,
  });
  const [after] = await db
    .update(militaryOccupationSkills)
    .set({
      reviewStatus: input.status,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      evidenceReference: input.evidenceReference?.trim() ? input.evidenceReference.trim() : before.evidenceReference,
      updatedAt: new Date(),
    })
    .where(eq(militaryOccupationSkills.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "military_occupation_skill.reviewed",
    recordType: "military_occupation_skill",
    recordId: after.id,
    before: { reviewStatus: before.reviewStatus },
    after: { reviewStatus: after.reviewStatus },
  });
  return after;
}

export async function listPendingCapabilityReviews(organizationId: string) {
  const db = getDb();
  const occupationSkills = await db
    .select({
      link: militaryOccupationSkills,
      occupation: militaryOccupations,
      skill: skills,
    })
    .from(militaryOccupationSkills)
    .innerJoin(militaryOccupations, eq(militaryOccupations.id, militaryOccupationSkills.militaryOccupationId))
    .innerJoin(skills, eq(skills.id, militaryOccupationSkills.skillId))
    .where(
      and(
        inArray(militaryOccupationSkills.reviewStatus, ["pending", "needs_review"]),
        isNull(militaryOccupationSkills.archivedAt),
      ),
    );
  const candidateRows = await db
    .select({
      link: candidateSkills,
      skill: skills,
      candidate: candidates,
    })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .innerJoin(candidates, eq(candidates.id, candidateSkills.candidateId))
    .where(
      and(
        eq(candidateSkills.organizationId, organizationId),
        eq(candidateSkills.source, CAPABILITY_TRANSLATION_SOURCE),
        inArray(candidateSkills.reviewStatus, ["pending", "needs_review"]),
      ),
    );
  return { occupationSkills, candidateRows };
}
