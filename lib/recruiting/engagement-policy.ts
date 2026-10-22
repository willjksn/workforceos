/**
 * M6 routing and outreach rules.
 * Match category is analytical. These states are operational and never rewrite it.
 * Public opportunity outreach is not an authorized client route.
 */

export const ENGAGEMENT_STATUSES = [
  "ready_for_review",
  "ready_for_outreach",
  "routed",
  "contacted",
  "acknowledged",
  "reviewing",
  "interested",
  "referred",
  "interview",
  "needs_follow_up",
  "needs_information",
  "no_fit",
  "withdrawn",
  "placed",
  "closed",
] as const;

export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export const EMPLOYER_RESPONSES = [
  "interested",
  "possible_future_fit",
  "not_a_fit",
  "refer_to_another_manager",
  "needs_more_information",
  "no_response",
] as const;

export type EmployerResponse = (typeof EMPLOYER_RESPONSES)[number];

export const CANDIDATE_RESPONSES = ["informed", "interested", "declined", "needs_information"] as const;

export type CandidateResponse = (typeof CANDIDATE_RESPONSES)[number];

export const TERMINAL_ENGAGEMENT_STATUSES = ["withdrawn", "placed", "closed"] as const;

/** Example defaults. They are not an employer promise and can be replaced per follow-up. */
export const ENGAGEMENT_FOLLOW_UP_BUSINESS_DAYS: Partial<Record<EngagementStatus, number>> = {
  routed: 3,
  contacted: 3,
  acknowledged: 3,
  reviewing: 5,
};

export const NO_FIT_NEXT_ACTIONS = [
  "refer_to_another_contact",
  "return_to_matching",
  "search_other_jobs",
  "no_current_action",
  "nurture",
] as const;

const RECOMMENDATION_CATEGORIES = new Set(["strong_match", "possible_match", "developmental_match"]);
const OPEN_JOB_STATUSES = new Set(["open", "search_active"]);
const CLIENT_CONTEXTS = new Set(["client", "internal", "skillbridge"]);
const PUBLIC_CONTEXTS = new Set(["monitored_public", "exploratory"]);

export function isTerminalEngagement(status: string) {
  return (TERMINAL_ENGAGEMENT_STATUSES as readonly string[]).includes(status);
}

export function addBusinessDays(start: Date, days: number) {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return cursor;
}

export function defaultFollowUpAt(status: string, from: Date) {
  const days = ENGAGEMENT_FOLLOW_UP_BUSINESS_DAYS[status as EngagementStatus];
  if (!days) return null;
  return addBusinessDays(from, days);
}

export function agingDays(lastActivityAt: Date, now: Date) {
  const elapsed = now.getTime() - lastActivityAt.getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

/**
 * A company record, a client-status flag, or a hiring-manager contact is not authorization.
 * Public and exploratory jobs route only when a person has set authorizedEmployerRoute.
 */
export function canAuthorizeEmployerRoute(input: {
  jobContextType: string;
  authorizedEmployerRoute: boolean;
  companyId?: string | null;
  hiringManagerContactId?: string | null;
  companyClientStatus?: string | null;
}) {
  void input.companyId;
  void input.hiringManagerContactId;
  void input.companyClientStatus;
  if (PUBLIC_CONTEXTS.has(input.jobContextType)) return input.authorizedEmployerRoute === true;
  return CLIENT_CONTEXTS.has(input.jobContextType);
}

export function engagementStartBlock(input: {
  explicitStart: boolean;
  freshness: string;
  matchCategory: string | null;
  disposition: string | null;
  jobStatus: string;
  candidatePrivacyDeleted: boolean;
  candidateArchived: boolean;
  candidateDoNotContact: boolean;
  candidateAvailability: string;
}) {
  if (!input.explicitStart) return "A match does not start an engagement by itself.";
  if (input.freshness !== "current") return "Only a current match can start an engagement.";
  if (!input.matchCategory || !RECOMMENDATION_CATEGORIES.has(input.matchCategory)) {
    return "No Current Match is not an engagement.";
  }
  if (input.disposition === "not_viable") {
    return "A not-viable disposition stays out of engagement until a recruiter changes it.";
  }
  if (!OPEN_JOB_STATUSES.has(input.jobStatus)) {
    return "A closed job cannot start an engagement until it is reopened.";
  }
  if (
    input.candidatePrivacyDeleted
    || input.candidateArchived
    || input.candidateDoNotContact
    || input.candidateAvailability === "do_not_contact"
  ) {
    return "This candidate is not eligible for an engagement.";
  }
  return null;
}

export function sharingBlock(consentStatus: string) {
  if (consentStatus !== "granted") {
    return "Candidate sharing consent is not granted. External sharing stays blocked.";
  }
  return null;
}

export function externalDeliveryPlan(input: {
  confirmed: boolean;
  providerConfigured: boolean;
  consentGranted: boolean;
}) {
  if (!input.confirmed) {
    return { action: "refuse" as const, reason: "External delivery requires explicit confirmation." };
  }
  if (!input.consentGranted) {
    return { action: "refuse" as const, reason: "Candidate sharing consent is not granted. External sharing stays blocked." };
  }
  if (!input.providerConfigured) return { action: "manual_only" as const };
  return { action: "send" as const };
}

export function nextStateForEmployerResponse(response: EmployerResponse, currentStatus: string) {
  switch (response) {
    case "interested":
      return { status: "interested" as const, waitingOn: "recruiter" as const };
    case "possible_future_fit":
      return { status: "needs_follow_up" as const, waitingOn: "recruiter" as const };
    case "not_a_fit":
      return { status: "no_fit" as const, waitingOn: "recruiter" as const };
    case "refer_to_another_manager":
      return { status: "referred" as const, waitingOn: "recruiter" as const };
    case "needs_more_information":
      return { status: "needs_information" as const, waitingOn: "recruiter" as const };
    case "no_response":
      return { status: currentStatus, waitingOn: "employer" as const };
    default:
      return { status: currentStatus, waitingOn: "recruiter" as const };
  }
}

export function matchCategoryAfterOutcome(matchCategory: string) {
  return matchCategory;
}

export type QueueBucket =
  | "needs_outreach"
  | "follow_up_due"
  | "overdue"
  | "employer_responded"
  | "candidate_response_needed"
  | "interview_next"
  | "referral_needs_routing"
  | "no_response"
  | "no_fit_needs_decision";

export function queueBuckets(
  row: {
    status: string;
    waitingOn: string;
    interviewStatus: string | null;
    employerResponse: string | null;
    nextFollowUpAt: Date | null;
  },
  now: Date,
): QueueBucket[] {
  if (isTerminalEngagement(row.status)) return [];
  const buckets: QueueBucket[] = [];
  if (row.status === "ready_for_review" || row.status === "ready_for_outreach") buckets.push("needs_outreach");
  if (row.status === "referred") buckets.push("referral_needs_routing");
  if (row.status === "no_fit") buckets.push("no_fit_needs_decision");
  if (row.waitingOn === "candidate") buckets.push("candidate_response_needed");
  if (row.status === "interview" && row.interviewStatus === "requested") buckets.push("interview_next");
  if (
    row.employerResponse
    && ["interested", "possible_future_fit", "needs_more_information", "refer_to_another_manager"].includes(row.employerResponse)
  ) {
    buckets.push("employer_responded");
  }
  if (row.nextFollowUpAt) {
    const due = row.nextFollowUpAt.getTime();
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (due < start) buckets.push("overdue");
    else if (due < start + 86_400_000) buckets.push("follow_up_due");
    if ((row.status === "routed" || row.status === "contacted") && !row.employerResponse && due <= now.getTime()) {
      buckets.push("no_response");
    }
  }
  return buckets;
}

export type FollowUpAlertIntent = {
  engagementId: string;
  userId: string;
  kind: "follow_up_overdue" | "employer_response_overdue";
  title: string;
  emailsSent: 0;
};

export function followUpAlertIntents(
  rows: Array<{
    id: string;
    ownerUserId: string;
    status: string;
    candidateName: string;
    nextFollowUpAt: Date | null;
    employerResponse: string | null;
  }>,
  now: Date,
): FollowUpAlertIntent[] {
  return rows.flatMap((row) => {
    if (isTerminalEngagement(row.status) || !row.nextFollowUpAt || row.nextFollowUpAt.getTime() > now.getTime()) return [];
    const overdue = row.nextFollowUpAt.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const kind = !row.employerResponse ? "employer_response_overdue" : "follow_up_overdue";
    return [{
      engagementId: row.id,
      userId: row.ownerUserId,
      kind,
      title: overdue ? `Follow-up overdue: ${row.candidateName}` : `Follow-up due: ${row.candidateName}`,
      emailsSent: 0 as const,
    }];
  });
}

export type ReviewFacts = {
  candidateName: string;
  location: string | null;
  availability: string | null;
  transitionTiming: string | null;
  capabilities: string[];
  credentials: string[];
  clearanceWording: string | null;
  aligned: string[];
  gaps: string[];
  jobTitle: string;
  companyName: string | null;
  recruiterNote: string | null;
  militaryContext: string | null;
  resumeOnFile: boolean;
};

function clean(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export function clearanceSharingWording(input: {
  level: string | null;
  status: string | null;
  humanVerified: boolean;
} | null) {
  if (!input?.level || input.level === "unknown" || !input.status || input.status === "unknown") return null;
  const review = input.humanVerified
    ? "A person reviewed this candidate-reported clearance. It is not an independently verified clearance."
    : "This is candidate-reported and is not a verified clearance.";
  return `${input.level.replaceAll("_", " ")} (${input.status.replaceAll("_", " ")}). ${review}`;
}

export function employerFacingCapability(row: {
  name: string;
  basis: string;
  reviewStatus: string;
  source: string | null;
}) {
  const translation = row.basis !== "explicit" || row.source === "capability_translation";
  if (translation) return row.reviewStatus === "approved" ? row.name : null;
  if (row.reviewStatus === "rejected") return null;
  return row.name;
}

export function draftTalentReview(facts: ReviewFacts) {
  const lines = [
    facts.candidateName,
    facts.location ? `Location: ${facts.location}` : null,
    facts.availability ? `Availability: ${facts.availability.replaceAll("_", " ")}` : "Availability is not recorded.",
    facts.transitionTiming ? `Transition timing: ${facts.transitionTiming}` : null,
    facts.militaryContext ? `Military context: ${facts.militaryContext}` : null,
    facts.capabilities.length ? `Approved capabilities: ${facts.capabilities.join(", ")}` : "No approved capabilities are recorded for this review.",
    facts.credentials.length ? `Credentials: ${facts.credentials.join(", ")}` : null,
    facts.clearanceWording,
    facts.aligned.length ? `Why this matches: ${facts.aligned.join("; ")}` : null,
    facts.gaps.length ? `Documented gaps: ${facts.gaps.join("; ")}` : null,
    facts.resumeOnFile ? "A resume is on file. It is not attached to this draft." : null,
    facts.recruiterNote,
  ].filter((line): line is string => Boolean(line));
  const company = facts.companyName ?? "the employer";
  return {
    subject: `Talent review: ${facts.candidateName} for ${facts.jobTitle}`,
    body: [`Talent review for ${company} — ${facts.jobTitle}.`, ...lines].join("\n"),
  };
}

export function draftPublicOutreach(facts: {
  jobTitle: string;
  companyName: string | null;
  relevantExperience: string | null;
  militaryContext: string | null;
  recruiterNote: string | null;
}) {
  const intro = facts.militaryContext
    ? "We work with transitioning military and technical talent."
    : "We work with technical talent.";
  const lines = [
    `${intro} We identified a candidate whose experience appears relevant to your publicly posted ${facts.jobTitle} role.`,
    facts.relevantExperience ? `Relevant recorded experience: ${facts.relevantExperience}` : null,
    "This note is not an existing partnership, a client relationship, or an authorized submission, and it does not mean the employer has expressed interest.",
    clean(facts.recruiterNote),
  ].filter((line): line is string => Boolean(line));
  return {
    subject: `Public opportunity: ${facts.jobTitle}`,
    body: lines.join("\n\n"),
  };
}

export function publicOpportunityLabel(jobContextType: string) {
  if (jobContextType === "monitored_public") return "Public opportunity";
  if (jobContextType === "exploratory") return "Exploratory demand";
  return null;
}
