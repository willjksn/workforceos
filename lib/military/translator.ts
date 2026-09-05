export type MilitaryToCivilianInput = {
  branch: string;
  occupationCode: string;
  occupationTitle: string;
  rank?: string | null;
  yearsInOccupation?: number | null;
  leadershipLevel?: string | null;
  transferableSkillNames: string[];
  civilianRoles: Array<{
    title: string;
    explanation?: string | null;
    gaps?: string | null;
    bridgeTraining?: string | null;
    compatibilityScore?: number | null;
    reviewStatus: string;
    source?: string | null;
    confidence?: number | null;
  }>;
};

export type HiringManagerTranslation = {
  militaryExperience: string;
  civilianTranslation: {
    strongAlignment: string[];
    potentialGaps: string[];
    overallAlignment: string;
    why: string;
  };
  roles: MilitaryToCivilianInput["civilianRoles"];
};

export function hiringManagerTranslation(input: MilitaryToCivilianInput): HiringManagerTranslation {
  const years = input.yearsInOccupation ? `${input.yearsInOccupation} Years` : "Years not recorded";
  const strongAlignment = input.transferableSkillNames.slice(0, 8);
  const approved = input.civilianRoles.filter((role) => role.reviewStatus === "approved");
  const gaps = approved
    .flatMap((role) => (role.gaps ? role.gaps.split(/[;.]/).map((part) => part.trim()).filter(Boolean) : []))
    .slice(0, 6);
  const overall =
    approved.some((role) => (role.compatibilityScore ?? 0) >= 80) || strongAlignment.length >= 6
      ? "High"
      : approved.length
        ? "Moderate"
        : "Insufficient approved mapping";
  const why = approved[0]?.explanation
    ?? "Only stored, reviewed mappings are shown. Unreviewed AI drafts are excluded from hiring-manager copy.";

  return {
    militaryExperience: `${formatBranch(input.branch)} ${input.occupationTitle} (${input.occupationCode})\n${years}${input.rank ? `\n${input.rank}` : ""}`,
    civilianTranslation: {
      strongAlignment,
      potentialGaps: gaps,
      overallAlignment: overall,
      why,
    },
    roles: approved,
  };
}

export function formatBranch(branch: string) {
  return branch.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function rankClientNeedTargets(rows: Array<{
  occupationCompatibility: number;
  installationRelevance: number;
  transitionOpportunity: number;
  candidateSupply: number;
}>) {
  return rows
    .map((row) => ({
      ...row,
      rankScore:
        row.occupationCompatibility * 0.4 +
        row.installationRelevance * 0.3 +
        row.transitionOpportunity * 0.2 +
        row.candidateSupply * 0.1,
    }))
    .sort((left, right) => right.rankScore - left.rankScore);
}
