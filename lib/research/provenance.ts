export const SOURCE_TYPES = [
  "INTERNAL_WORKFORCEOS",
  "WORKFORCEOS_KNOWLEDGE",
  "OPENAI_WEB",
  "TAVILY_WEB",
  "APOLLO",
  "ONET",
  "BLS",
  "CENSUS",
  "LEHD_LODES",
  "MILITARY_OFFICIAL",
  "SEEKOUT",
  "HIRE_EZ",
  "LINKEDIN_REFERENCE",
  "OTHER_APPROVED",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABELS: Record<SourceType, string> = {
  INTERNAL_WORKFORCEOS: "WorkforceOS",
  WORKFORCEOS_KNOWLEDGE: "WorkforceOS Knowledge",
  OPENAI_WEB: "External Web",
  TAVILY_WEB: "External Web",
  APOLLO: "Apollo",
  ONET: "O*NET",
  BLS: "BLS",
  CENSUS: "Census",
  LEHD_LODES: "LEHD/LODES",
  MILITARY_OFFICIAL: "Military Reference",
  SEEKOUT: "SeekOut",
  HIRE_EZ: "hireEZ",
  LINKEDIN_REFERENCE: "LinkedIn Reference",
  OTHER_APPROVED: "Approved Source",
};

export type SourceProvenance = {
  provider: string;
  sourceType: SourceType;
  url?: string | null;
  publisher?: string | null;
  publishedAt?: Date | string | null;
  retrievedAt: Date | string;
  sourceVersion?: string | null;
  confidence?: number | null;
  structuredProviderId?: string | null;
  scoutRunId?: string | null;
  humanReviewStatus: "unreviewed" | "accepted" | "rejected" | "dismissed";
};

export function provenanceRecord(input: Omit<SourceProvenance, "humanReviewStatus"> & { humanReviewStatus?: SourceProvenance["humanReviewStatus"] }): SourceProvenance {
  return {
    ...input,
    humanReviewStatus: input.humanReviewStatus ?? "unreviewed",
  };
}

export function sourceLabel(sourceType: SourceType) {
  return SOURCE_LABELS[sourceType];
}
