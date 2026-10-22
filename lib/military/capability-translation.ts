import { assertHumanMappingReview, type MappingReviewStatus } from "./review";

/** Rows written by M3. Pre-M3 candidate skills keep their source and still count toward matching. */
export const CAPABILITY_TRANSLATION_SOURCE = "capability_translation";

export type ReviewStatus = MappingReviewStatus;
export type CapabilityBasis = "explicit" | "reference_supported" | "inferred";
export type EvidenceType =
  | "resume_skill"
  | "military_duty"
  | "military_equipment"
  | "military_training"
  | "credential"
  | "occupation_mapping"
  | "recruiter_entered"
  | "clearance"
  | "leadership";

export type TranslationEvidence = {
  id: string;
  type: EvidenceType;
  text: string;
};

export type CatalogSkill = {
  id: string;
  slug: string;
  name: string;
  competencyCluster?: string | null;
};

export type OccupationCapabilityLink = {
  id: string;
  militaryOccupationId: string;
  skillId: string;
  reviewStatus: ReviewStatus;
  evidenceReference?: string | null;
  mappingQuality?: string | null;
  confidence?: number | null;
};

export type CapabilityEvidenceCitation = {
  evidenceId: string;
  evidenceType: EvidenceType;
  citation: string;
  occupationSkillId?: string | null;
};

export type CapabilityProposal = {
  skillId: string;
  skillSlug: string;
  skillName: string;
  competencyCluster: string | null;
  basis: CapabilityBasis;
  reviewStatus: "pending";
  confidence: number;
  employerFacing: false;
  evidence: CapabilityEvidenceCitation[];
};

export type StoredCapability = {
  skillId: string;
  skillSlug: string;
  skillName: string;
  competencyCluster?: string | null;
  basis: CapabilityBasis;
  reviewStatus: ReviewStatus;
  confidence?: number | null;
  evidence: CapabilityEvidenceCitation[];
};

export type OccupationSkillNeed = {
  skillId: string;
  name: string;
};

export type OccupationFit = {
  occupationId: string;
  title: string;
  jobFamilies: string[];
  supporting: Array<{ skillId: string; skillName: string; citations: string[] }>;
  gaps: string[];
  why: string;
  employerFacing: boolean;
};

/**
 * Development-fixture paraphrases. Not an authoritative military crosswalk.
 * A rule does nothing unless the slug exists in the skill catalog passed in.
 */
export const DEVELOPMENT_CAPABILITY_RULES: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "inventory-control", patterns: [/inventory/i, /material accountability/i, /material control/i, /stock control/i] },
  { slug: "procurement-support", patterns: [/procurement/i, /purchasing/i, /vendor coordination/i] },
  { slug: "warehouse-operations", patterns: [/warehouse/i, /storeroom/i, /supply room/i] },
  { slug: "hazardous-material-controls", patterns: [/hazardous material/i, /hazmat/i] },
  { slug: "logistics-systems", patterns: [/\berp\b/i, /logistics system/i] },
  { slug: "demand-supply-planning", patterns: [/demand planning/i, /supply planning/i] },
  { slug: "team-leadership", patterns: [/supervis/i, /team leadership/i, /direct reports/i, /led (a|the) team/i] },
  { slug: "electronic-troubleshooting", patterns: [/troubleshoot/i, /diagnos/i, /fault isolation/i, /electronic fault/i] },
  { slug: "radar-systems", patterns: [/radar/i] },
  { slug: "instrumentation", patterns: [/instrumentation/i, /calibrat/i] },
  { slug: "cyber-defense", patterns: [/cyber/i, /network defense/i, /information system security/i] },
  { slug: "it-operations", patterns: [/\bit support\b/i, /help desk/i, /server administration/i] },
  { slug: "supply-operations", patterns: [/unit supply/i, /supply accountability/i] },
];

const PERSON_EVIDENCE = new Set<EvidenceType>([
  "resume_skill",
  "military_duty",
  "military_equipment",
  "military_training",
  "credential",
  "recruiter_entered",
  "leadership",
]);

export function countsTowardMatching(source: string | null | undefined) {
  return source !== CAPABILITY_TRANSLATION_SOURCE;
}

export function isEmployerFacingStatus(status: ReviewStatus) {
  return status === "approved";
}

export function reviewStateLabel(status: ReviewStatus) {
  switch (status) {
    case "approved":
      return "Human reviewed";
    case "rejected":
      return "Rejected";
    case "needs_review":
      return "Needs evidence";
    default:
      return "Pending review";
  }
}

export function basisLabel(basis: CapabilityBasis) {
  switch (basis) {
    case "explicit":
      return "Explicit";
    case "reference_supported":
      return "Reference-supported";
    default:
      return "Inferred";
  }
}

export function redactRestrictedPii(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, "[redacted-phone]")
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "[redacted-compensation]");
}

export function assertNoRestrictedPii(value: string) {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    throw new Error("Capability translation context included an email address.");
  }
  if (/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(value)) {
    throw new Error("Capability translation context included a phone number.");
  }
}

export function assertCapabilityReview(input: {
  actorType: "human" | "agent" | "system";
  originatingAgentId?: string | null;
  reviewerUserId?: string | null;
  nextStatus: ReviewStatus;
}) {
  assertHumanMappingReview(input);
}

function personEvidence(evidence: TranslationEvidence[]) {
  return evidence.filter((item) => PERSON_EVIDENCE.has(item.type) && item.text.trim().length > 0);
}

function mentionsSkill(skill: CatalogSkill, text: string) {
  const haystack = text.toLowerCase();
  if (skill.name.trim().length >= 4 && haystack.includes(skill.name.trim().toLowerCase())) return true;
  const rule = DEVELOPMENT_CAPABILITY_RULES.find((item) => item.slug === skill.slug);
  return Boolean(rule?.patterns.some((pattern) => pattern.test(text)));
}

function citationFor(item: TranslationEvidence) {
  const label = item.type.replaceAll("_", " ");
  return `Documented ${label}: ${item.text.trim()}`;
}

function fixtureNote(quality?: string | null) {
  if (quality === "development_fixture") {
    return " Development fixture reference, not an authoritative production mapping.";
  }
  return "";
}

export function proposeCapabilitiesFromEvidence(input: {
  evidence: TranslationEvidence[];
  skills: CatalogSkill[];
  occupationLinks?: OccupationCapabilityLink[];
  tourOccupationIds?: string[];
}): CapabilityProposal[] {
  const evidence = personEvidence(input.evidence);
  if (evidence.length === 0) return [];

  const tours = new Set(input.tourOccupationIds ?? []);
  const proposals = new Map<string, CapabilityProposal>();

  for (const skill of input.skills) {
    const hits = evidence.filter((item) => mentionsSkill(skill, item.text));
    if (hits.length === 0) continue;
    proposals.set(skill.id, {
      skillId: skill.id,
      skillSlug: skill.slug,
      skillName: skill.name,
      competencyCluster: skill.competencyCluster ?? null,
      basis: "explicit",
      reviewStatus: "pending",
      confidence: 70,
      employerFacing: false,
      evidence: hits.map((item) => ({
        evidenceId: item.id,
        evidenceType: item.type,
        citation: citationFor(item),
        occupationSkillId: null,
      })),
    });
  }

  for (const link of input.occupationLinks ?? []) {
    if (link.reviewStatus !== "approved") continue;
    if (!tours.has(link.militaryOccupationId)) continue;
    const skill = input.skills.find((item) => item.id === link.skillId);
    if (!skill) continue;
    const reference = link.evidenceReference?.trim() ?? "";
    const hits = evidence.filter((item) => {
      if (mentionsSkill(skill, item.text)) return true;
      return reference.length >= 4 && item.text.toLowerCase().includes(reference.toLowerCase());
    });
    if (hits.length === 0) continue;
    const existing = proposals.get(skill.id);
    const mappingCitation = `Approved occupation mapping supports ${skill.name}.${reference ? ` Reference: ${reference}.` : ""}${fixtureNote(link.mappingQuality)}`;
    const mappingEvidence: CapabilityEvidenceCitation = {
      evidenceId: link.id,
      evidenceType: "occupation_mapping",
      citation: mappingCitation,
      occupationSkillId: link.id,
    };
    if (existing) {
      existing.evidence.push(mappingEvidence);
      continue;
    }
    proposals.set(skill.id, {
      skillId: skill.id,
      skillSlug: skill.slug,
      skillName: skill.name,
      competencyCluster: skill.competencyCluster ?? null,
      basis: "reference_supported",
      reviewStatus: "pending",
      confidence: link.confidence ?? 60,
      employerFacing: false,
      evidence: [
        ...hits.map((item) => ({
          evidenceId: item.id,
          evidenceType: item.type,
          citation: citationFor(item),
          occupationSkillId: null,
        })),
        mappingEvidence,
      ],
    });
  }

  return [...proposals.values()];
}

const UNSUPPORTED_CLAIM = /clearance (is |was )?verified|independently verified|holds a clearance|certified in (?!the evidence)/i;

export function proposalsFromModelText(input: {
  text: string;
  skills: CatalogSkill[];
  evidence: TranslationEvidence[];
}): CapabilityProposal[] {
  const start = input.text.indexOf("{");
  const end = input.text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: { capabilities?: unknown };
  try {
    parsed = JSON.parse(input.text.slice(start, end + 1)) as { capabilities?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.capabilities)) return [];
  const knownEvidence = new Map(personEvidence(input.evidence).map((item) => [item.id, item]));
  const proposals: CapabilityProposal[] = [];
  for (const row of parsed.capabilities) {
    if (!row || typeof row !== "object") continue;
    const record = row as { skillSlug?: unknown; evidenceIds?: unknown; citation?: unknown; confidence?: unknown };
    if (typeof record.skillSlug !== "string" || typeof record.citation !== "string") continue;
    if (!Array.isArray(record.evidenceIds) || record.evidenceIds.length === 0) continue;
    const skill = input.skills.find((item) => item.slug === record.skillSlug);
    if (!skill) continue;
    const cited = record.evidenceIds.filter((id): id is string => typeof id === "string");
    if (cited.length === 0 || cited.some((id) => !knownEvidence.has(id))) continue;
    if (UNSUPPORTED_CLAIM.test(record.citation)) continue;
    const evidence = cited.map((id) => {
      const item = knownEvidence.get(id)!;
      return {
        evidenceId: item.id,
        evidenceType: item.type,
        citation: record.citation as string,
        occupationSkillId: null,
      };
    });
    proposals.push({
      skillId: skill.id,
      skillSlug: skill.slug,
      skillName: skill.name,
      competencyCluster: skill.competencyCluster ?? null,
      basis: "inferred",
      reviewStatus: "pending",
      confidence: typeof record.confidence === "number" ? Math.max(0, Math.min(100, Math.round(record.confidence))) : 40,
      employerFacing: false,
      evidence,
    });
  }
  return proposals;
}

export function buildTranslationPrompt(input: {
  occupationLabel?: string | null;
  evidence: TranslationEvidence[];
  skills: CatalogSkill[];
}) {
  const evidence = personEvidence(input.evidence).map((item) => ({
    id: item.id,
    type: item.type,
    text: redactRestrictedPii(item.text),
  }));
  const prompt = [
    "Task: military capability translation",
    "Return JSON only: {\"capabilities\":[{\"skillSlug\":\"\",\"evidenceIds\":[\"\"],\"citation\":\"\",\"confidence\":40}]}",
    "Use only skill slugs from the catalog. Cite only evidence ids provided.",
    "Do not invent qualifications, certifications, or clearance verification. Do not approve.",
    `Occupation label: ${input.occupationLabel ?? "unspecified"}`,
    `Catalog: ${input.skills.map((skill) => skill.slug).join(", ")}`,
    `Evidence: ${JSON.stringify(evidence)}`,
  ].join("\n");
  assertNoRestrictedPii(prompt);
  return prompt;
}

function mergeProposals(primary: CapabilityProposal[], extra: CapabilityProposal[]) {
  const merged = new Map(primary.map((row) => [row.skillId, row]));
  for (const row of extra) {
    const existing = merged.get(row.skillId);
    if (!existing) {
      merged.set(row.skillId, row);
      continue;
    }
    for (const item of row.evidence) {
      if (!existing.evidence.some((current) => current.evidenceId === item.evidenceId && current.evidenceType === item.evidenceType)) {
        existing.evidence.push(item);
      }
    }
  }
  return [...merged.values()];
}

export async function draftCapabilitySuggestions(input: {
  evidence: TranslationEvidence[];
  skills: CatalogSkill[];
  occupationLinks?: OccupationCapabilityLink[];
  tourOccupationIds?: string[];
  occupationLabel?: string | null;
  complete?: (prompt: string) => Promise<{ text: string; provider: string; model: string }>;
}) {
  const deterministic = proposeCapabilitiesFromEvidence(input);
  if (personEvidence(input.evidence).length === 0) {
    return {
      proposals: [] as CapabilityProposal[],
      provider: "none",
      model: "none",
      usedDeterministicFallback: true,
    };
  }
  if (!input.complete) {
    return {
      proposals: deterministic,
      provider: "deterministic_rules",
      model: "m3-development-fixture-rules",
      usedDeterministicFallback: true,
    };
  }
  try {
    const prompt = buildTranslationPrompt(input);
    const result = await input.complete(prompt);
    const inferred = proposalsFromModelText({
      text: result.text,
      skills: input.skills,
      evidence: input.evidence,
    });
    if (inferred.length === 0) {
      return {
        proposals: deterministic,
        provider: result.provider,
        model: result.model,
        usedDeterministicFallback: true,
      };
    }
    return {
      proposals: mergeProposals(deterministic, inferred),
      provider: result.provider,
      model: result.model,
      usedDeterministicFallback: false,
    };
  } catch {
    return {
      proposals: deterministic,
      provider: "deterministic_rules",
      model: "m3-development-fixture-rules",
      usedDeterministicFallback: true,
    };
  }
}

export function employerFacingCapabilities<T extends { reviewStatus: ReviewStatus }>(rows: T[]) {
  return rows.filter((row) => row.reviewStatus === "approved");
}

export function explainOccupationFit(input: {
  occupationId: string;
  title: string;
  jobFamilies?: string[];
  occupationSkills: OccupationSkillNeed[];
  capabilities: StoredCapability[];
}): OccupationFit {
  const approved = new Map(
    input.capabilities.filter((row) => row.reviewStatus === "approved").map((row) => [row.skillId, row]),
  );
  const supporting = input.occupationSkills
    .filter((skill) => approved.has(skill.skillId))
    .map((skill) => {
      const capability = approved.get(skill.skillId)!;
      return {
        skillId: skill.skillId,
        skillName: capability.skillName || skill.name,
        citations: capability.evidence.map((item) => item.citation),
      };
    });
  const gaps = input.occupationSkills
    .filter((skill) => !approved.has(skill.skillId))
    .map((skill) => `No direct ${skill.name.toLowerCase()} experience documented.`);
  const employerFacing = supporting.length > 0;
  const why = employerFacing
    ? `${input.title} overlaps reviewed capabilities: ${supporting.map((item) => item.skillName).join(", ")}.`
    : `${input.title} is not an employer-facing translation until reviewed capabilities overlap its skills.`;
  return {
    occupationId: input.occupationId,
    title: input.title,
    jobFamilies: input.jobFamilies ?? [],
    supporting,
    gaps,
    why,
    employerFacing,
  };
}

export function rankOccupationsByCapabilities(input: {
  occupations: Array<{
    occupationId: string;
    title: string;
    jobFamilies?: string[];
    occupationSkills: OccupationSkillNeed[];
  }>;
  capabilities: StoredCapability[];
}) {
  return input.occupations
    .map((occupation) => explainOccupationFit({ ...occupation, capabilities: input.capabilities }))
    .filter((fit) => fit.employerFacing)
    .sort((left, right) => right.supporting.length - left.supporting.length || left.title.localeCompare(right.title));
}
