const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "with",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export type InternalSearchInput = {
  jobTitle: string;
  jobDescription?: string | null;
  jobSkillNames: string[];
  candidateName: string;
  candidateTitle?: string | null;
  experienceTitles: string[];
  candidateSkillNames: string[];
};

export type InternalSearchScore = {
  score: number;
  explanation: string;
};

export function buildInternalSearchProjectName(jobTitle: string) {
  return `Internal Talent Network: ${jobTitle}`;
}

export function externalSourcingBlocked(internalSearchCompletedAt: Date | null) {
  return internalSearchCompletedAt == null;
}

export function scoreInternalCandidate(input: InternalSearchInput): InternalSearchScore {
  const jobTokens = new Set(tokenize(`${input.jobTitle} ${input.jobDescription ?? ""}`));
  const candidateTokens = new Set(
    tokenize(
      [
        input.candidateName,
        input.candidateTitle ?? "",
        ...input.experienceTitles,
        ...input.candidateSkillNames,
      ].join(" "),
    ),
  );
  const sharedTokens = [...jobTokens].filter((token) => candidateTokens.has(token));
  const requiredSkills = input.jobSkillNames.map((name) => name.toLowerCase());
  const candidateSkills = new Set(input.candidateSkillNames.map((name) => name.toLowerCase()));
  const sharedSkills = requiredSkills.filter((name) => candidateSkills.has(name));
  const relatedSkills = input.candidateSkillNames.filter((name) =>
    tokenize(name).some((token) => jobTokens.has(token)),
  );

  let score = 0;
  if (sharedTokens.length && jobTokens.size) {
    score += Math.min(50, Math.round((sharedTokens.length / jobTokens.size) * 50));
  }
  if (requiredSkills.length) {
    score += Math.round((sharedSkills.length / requiredSkills.length) * 50);
  } else if (relatedSkills.length) {
    score += Math.min(40, relatedSkills.length * 8);
  }
  score = Math.min(99, score);

  const parts: string[] = [];
  if (sharedTokens.length) {
    parts.push(`Title/keyword overlap: ${sharedTokens.slice(0, 6).join(", ")}`);
  }
  if (sharedSkills.length) {
    parts.push(`Shared required skills: ${sharedSkills.join(", ")}`);
  } else if (relatedSkills.length) {
    parts.push(`Skills related to the job: ${relatedSkills.slice(0, 6).join(", ")}`);
  }
  if (!parts.length) {
    parts.push("No overlapping title or skill terms");
  }

  return { score, explanation: `${parts.join(". ")}.` };
}
