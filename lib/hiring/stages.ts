export const INTERNAL_PIPELINE = [
  "applied",
  "application_review",
  "recruiter_screen",
  "hiring_manager_review",
  "interview",
  "assessment",
  "pre_employment",
  "offer",
  "offer_accepted",
  "pre_hire",
  "onboarding",
  "hired",
] as const;

export const CLIENT_PIPELINE = [
  "applied",
  "recruiter_review",
  "recruiter_screen",
  "qualified",
  "client_submission",
  "client_review",
  "client_interview",
  "final_interview",
  "offer",
  "placement",
  "started",
] as const;

export const SKILLBRIDGE_PIPELINE = [
  "applied",
  "military_profile_review",
  "transition_profile_complete",
  "recruiter_screen",
  "opportunity_matching",
  "candidate_interested",
  "employer_submitted",
  "hiring_manager_review",
  "interview",
  "skillbridge_approval",
  "skillbridge_placement",
  "skillbridge_active",
  "conversion_review",
  "hired",
] as const;

export const TERMINAL_STAGES = [
  "rejected",
  "withdrawn",
  "position_closed",
  "nurture",
  "client_declined",
  "candidate_withdrew",
  "no_match_yet",
  "employer_declined",
  "skillbridge_not_approved",
] as const;

export const ALLOWED_DISPOSITION_REASONS = [
  "minimum_qualifications",
  "experience_mismatch",
  "location",
  "schedule",
  "compensation",
  "work_authorization",
  "position_cancelled",
  "candidate_withdrew",
  "client_declined",
  "better_aligned_candidate",
  "unable_to_contact",
  "other",
] as const;

const DISALLOWED_REASON_PATTERN =
  /\b(race|color|religion|sex|gender|national origin|age|disability|pregnancy|genetic|veteran status except as job related)\b/i;

export type JobContextType = "internal" | "client" | "skillbridge";

export function pipelineFor(context: JobContextType) {
  if (context === "internal") return INTERNAL_PIPELINE;
  if (context === "skillbridge") return SKILLBRIDGE_PIPELINE;
  return CLIENT_PIPELINE;
}

export function defaultPipelineName(context: JobContextType) {
  return context;
}

export function isTerminalStage(stage: string) {
  return (TERMINAL_STAGES as readonly string[]).includes(stage);
}

export function assertDispositionReason(reason: string) {
  if (DISALLOWED_REASON_PATTERN.test(reason)) {
    throw new Error("Disposition reason is not allowed.");
  }
  if (!(ALLOWED_DISPOSITION_REASONS as readonly string[]).includes(reason) && reason !== "other") {
    throw new Error("Disposition reason is not on the approved list.");
  }
}
