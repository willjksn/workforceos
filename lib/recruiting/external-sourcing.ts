export type ExternalSourcingProvider = "linkedin-recruiter" | "seekout" | "hireez" | "apollo";

export function canOpenExternalSourcing(internalSearchCompletedAt: Date | null | undefined) {
  return Boolean(internalSearchCompletedAt);
}

export function externalSourcingHook(input: {
  provider: ExternalSourcingProvider;
  jobId: string;
  internalSearchCompletedAt: Date | null | undefined;
}) {
  if (!canOpenExternalSourcing(input.internalSearchCompletedAt)) {
    return {
      allowed: false as const,
      provider: input.provider,
      jobId: input.jobId,
      reason: "Internal Talent Network search must be completed before external sourcing.",
    };
  }
  return {
    allowed: true as const,
    provider: input.provider,
    jobId: input.jobId,
    reason: "Internal search is complete. Provider adapters remain behind the Integration Hub. SeekOut is the preferred sourcing adapter; LinkedIn is not scraped.",
  };
}
