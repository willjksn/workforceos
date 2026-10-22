export type CompletenessState = "complete" | "needs_review" | "missing_information";

export const COMPLETENESS_LABELS: Record<CompletenessState, string> = {
  complete: "Complete",
  needs_review: "Needs Review",
  missing_information: "Missing Information",
};

export type CompletenessInput = {
  militaryExperiences: Array<{ certifications: string | null; training: string | null }>;
  duties: Array<{ humanVerified: boolean }>;
  equipment: Array<{ humanVerified: boolean }>;
  trainingRecords: Array<{ humanVerified: boolean }>;
  education: Array<{ humanVerified: boolean }>;
  credentials: Array<{ humanVerified: boolean }>;
  skillsCount: number;
  separationDate: Date | string | null;
  etsDate: Date | string | null;
  eaosDate: Date | string | null;
  endOfServiceDate: Date | string | null;
  retirementDate: Date | string | null;
  availableDate: Date | string | null;
  preferredLocationPrimary: string | null;
  preferredLocationCount: number;
  candidateCity: string | null;
  targetRoleCount: number;
  resumeStatus: "missing" | "outdated" | "current" | "needs_review" | null;
  hasResumeFile: boolean;
};

export type ProfileCompleteness = {
  informational: true;
  affectsMatch: false;
  affectsRank: false;
  affectsReject: false;
  sections: Array<{ key: string; label: string; state: CompletenessState }>;
};

function presentText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function section(present: boolean, pendingReview: boolean): CompletenessState {
  if (!present) return "missing_information";
  if (pendingReview) return "needs_review";
  return "complete";
}

function anyUnverified(rows: Array<{ humanVerified: boolean }>) {
  return rows.some((row) => !row.humanVerified);
}

function resumeState(input: CompletenessInput): CompletenessState {
  if (input.resumeStatus === "current" && input.hasResumeFile) return "complete";
  if (input.resumeStatus === "needs_review" || input.resumeStatus === "outdated" || input.hasResumeFile) {
    return "needs_review";
  }
  return "missing_information";
}

/**
 * Informational section states only. This does not score, rank, match, or reject anyone.
 */
export function assessTransitionProfile(input: CompletenessInput): ProfileCompleteness {
  const evidenceRows = [...input.duties, ...input.equipment, ...input.trainingRecords];
  const legacyEvidence = input.militaryExperiences.some(
    (row) => presentText(row.certifications) || presentText(row.training),
  );
  const skillsPresent = evidenceRows.length > 0 || legacyEvidence || input.skillsCount > 0;
  const timingPresent = [
    input.separationDate,
    input.etsDate,
    input.eaosDate,
    input.endOfServiceDate,
    input.retirementDate,
    input.availableDate,
  ].some(Boolean);
  const locationPresent =
    presentText(input.preferredLocationPrimary) || input.preferredLocationCount > 0 || presentText(input.candidateCity);
  const credentialsPresent = input.credentials.length > 0 || input.militaryExperiences.some((row) => presentText(row.certifications));

  return {
    informational: true,
    affectsMatch: false,
    affectsRank: false,
    affectsReject: false,
    sections: [
      {
        key: "military_history",
        label: "Military history",
        state: section(input.militaryExperiences.length > 0, anyUnverified(evidenceRows)),
      },
      {
        key: "transition_timing",
        label: "Transition timing",
        state: section(timingPresent, false),
      },
      {
        key: "skills_evidence",
        label: "Skills and evidence",
        state: section(skillsPresent, anyUnverified(evidenceRows)),
      },
      {
        key: "education",
        label: "Education",
        state: section(input.education.length > 0, anyUnverified(input.education)),
      },
      {
        key: "credentials",
        label: "Credentials",
        state: section(credentialsPresent, anyUnverified(input.credentials)),
      },
      {
        key: "location_preferences",
        label: "Location preferences",
        state: section(locationPresent, false),
      },
      {
        key: "target_roles",
        label: "Target roles",
        state: section(input.targetRoleCount > 0, false),
      },
      {
        key: "resume",
        label: "Resume",
        state: resumeState(input),
      },
    ],
  };
}
