/**
 * M9 outcome vocabulary.
 *
 * One current match has one canonical outcome. Supporting signals explain it.
 * Candidate decline is not evidence the match was poor.
 * No response is not an employer rejection.
 * The calculated M5 category is never an input to this classification and is never rewritten here.
 */

export const NORMALIZED_OUTCOMES = [
  "placement",
  "interview",
  "employer_interested",
  "referred",
  "employer_not_a_fit",
  "candidate_declined",
  "recruiter_not_viable",
  "candidate_withdrew",
  "no_response",
  "possible_future_fit",
  "needs_information",
  "workflow_closed",
  "in_progress",
  "no_engagement",
] as const;

export type NormalizedOutcome = (typeof NORMALIZED_OUTCOMES)[number];

export const OUTCOME_GROUPS = {
  positive: ["employer_interested", "interview", "referred", "placement"],
  neutral: ["possible_future_fit", "needs_information", "no_response", "candidate_withdrew", "workflow_closed"],
  incomplete: ["in_progress", "no_engagement"],
  employer_negative: ["employer_not_a_fit"],
  recruiter_negative: ["recruiter_not_viable"],
  candidate_choice: ["candidate_declined"],
} as const;

export const MATCH_CATEGORIES = ["strong_match", "possible_match", "developmental_match"] as const;
export type LearningMatchCategory = (typeof MATCH_CATEGORIES)[number];

export const CONTEXT_BUCKETS = ["client_routing", "public_outreach", "unspecified"] as const;
export type ContextBucket = (typeof CONTEXT_BUCKETS)[number];

export const PROGRAM_BUCKETS = ["military", "other", "not_recorded"] as const;
export type ProgramBucket = (typeof PROGRAM_BUCKETS)[number];

const MILITARY_STATUSES = new Set(["veteran", "active_duty", "reserve", "national_guard"]);
const CLIENT_CONTEXTS = new Set(["client", "internal", "skillbridge"]);
const PUBLIC_CONTEXTS = new Set(["monitored_public", "exploratory"]);
const INTERVIEW_STATUSES = new Set(["requested", "scheduled", "completed"]);

export type OutcomeInput = {
  engagementStatus: string | null;
  employerResponse: string | null;
  candidateResponse: string | null;
  recruiterDisposition: string | null;
  hasEngagement: boolean;
  interviewId: string | null;
  interviewStatus: string | null;
  placementId: string | null;
};

export function isLearningCategory(value: string | null | undefined): value is LearningMatchCategory {
  return (MATCH_CATEGORIES as readonly string[]).includes(value ?? "");
}

export function programBucket(militaryStatus: string | null | undefined): ProgramBucket {
  if (militaryStatus && MILITARY_STATUSES.has(militaryStatus)) return "military";
  if (militaryStatus === "none") return "other";
  return "not_recorded";
}

export function contextBucket(input: { mode: string | null; jobContextType: string | null }): ContextBucket {
  if (input.mode === "public_outreach" || (!input.mode && input.jobContextType && PUBLIC_CONTEXTS.has(input.jobContextType))) {
    return "public_outreach";
  }
  if (input.mode === "authorized_routing" || (!input.mode && input.jobContextType && CLIENT_CONTEXTS.has(input.jobContextType))) {
    return "client_routing";
  }
  return "unspecified";
}

export function classifyOutcome(input: OutcomeInput): NormalizedOutcome {
  const placed = input.engagementStatus === "placed" || Boolean(input.placementId);
  if (placed) return "placement";
  const interview = input.engagementStatus === "interview"
    || Boolean(input.interviewId)
    || (input.interviewStatus ? INTERVIEW_STATUSES.has(input.interviewStatus) : false);
  if (interview) return "interview";
  if (input.employerResponse === "interested" || input.engagementStatus === "interested") return "employer_interested";
  if (input.employerResponse === "refer_to_another_manager" || input.engagementStatus === "referred") return "referred";
  if (input.employerResponse === "not_a_fit" || input.engagementStatus === "no_fit") return "employer_not_a_fit";
  if (input.candidateResponse === "declined") return "candidate_declined";
  if (input.recruiterDisposition === "not_viable" && !input.hasEngagement) return "recruiter_not_viable";
  if (input.engagementStatus === "withdrawn") return "candidate_withdrew";
  if (input.employerResponse === "no_response") return "no_response";
  if (input.employerResponse === "possible_future_fit") return "possible_future_fit";
  if (
    input.employerResponse === "needs_more_information"
    || input.candidateResponse === "needs_information"
    || input.engagementStatus === "needs_information"
  ) {
    return "needs_information";
  }
  if (input.engagementStatus === "closed") return "workflow_closed";
  if (input.hasEngagement) return "in_progress";
  return "no_engagement";
}

export function reachedPlacement(input: OutcomeInput) {
  return input.engagementStatus === "placed" || Boolean(input.placementId);
}

export function reachedInterview(input: OutcomeInput) {
  return input.engagementStatus === "interview"
    || Boolean(input.interviewId)
    || (input.interviewStatus ? INTERVIEW_STATUSES.has(input.interviewStatus) : false);
}

export function reachedInterest(input: OutcomeInput) {
  return input.employerResponse === "interested" || input.engagementStatus === "interested";
}

/** Only an employer Not a Fit or a recruiter not-viable disposition is poor-match evidence. */
export function countsAsPoorMatch(outcome: NormalizedOutcome) {
  return outcome === "employer_not_a_fit" || outcome === "recruiter_not_viable";
}

export function countsAsEmployerRejection(outcome: NormalizedOutcome) {
  return outcome === "employer_not_a_fit";
}

/** Learning never rewrites the calculated category. */
export function categoryAfterLearning<T extends string>(category: T) {
  return category;
}

export function outcomeLabel(outcome: NormalizedOutcome) {
  switch (outcome) {
    case "placement": return "Placement";
    case "interview": return "Interview";
    case "employer_interested": return "Employer interested";
    case "referred": return "Referred";
    case "employer_not_a_fit": return "Employer Not a Fit";
    case "candidate_declined": return "Candidate declined";
    case "recruiter_not_viable": return "Recruiter not viable";
    case "candidate_withdrew": return "Candidate withdrew";
    case "no_response": return "No response";
    case "possible_future_fit": return "Possible future fit";
    case "needs_information": return "Needs information";
    case "workflow_closed": return "Closed without a decision";
    case "in_progress": return "Engagement in progress";
    case "no_engagement": return "No engagement";
    default: return outcome;
  }
}

export function categoryLabel(category: string) {
  switch (category) {
    case "strong_match": return "Strong Match";
    case "possible_match": return "Possible Match";
    case "developmental_match": return "Developmental Match";
    default: return category;
  }
}

export function contextLabel(context: ContextBucket) {
  switch (context) {
    case "client_routing": return "Client routing";
    case "public_outreach": return "Public outreach";
    case "unspecified": return "Unspecified context";
    default: return context;
  }
}

export function programLabel(program: ProgramBucket) {
  switch (program) {
    case "military": return "Military Talent";
    case "other": return "Other Talent Network";
    case "not_recorded": return "Military status not recorded";
    default: return program;
  }
}
