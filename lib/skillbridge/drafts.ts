import { presentCandidate } from "../privacy/present-candidate";

export const SKILLBRIDGE_CANDIDATE_DRAFTS = [
  "initial_introduction",
  "welcome_check_in",
  "resume_request",
  "skillbridge_timeline_check",
  "opportunity_introduction",
  "employer_feedback_update",
  "interview_prep",
  "no_opportunity_yet",
  "approval_check",
  "skillbridge_start",
  "conversion_check_in",
  "congratulations",
  "custom",
] as const;

export const SKILLBRIDGE_EMPLOYER_DRAFTS = [
  "candidate_introduction",
  "candidate_follow_up",
  "resume_submission_summary",
  "interview_follow_up",
  "timeline_update",
  "skillbridge_availability_summary",
  "conversion_discussion",
  "custom",
] as const;

export function draftSkillBridgeMessage(input: {
  kind: string;
  audience: "candidate" | "employer";
  candidateName: string;
  occupationTitle?: string | null;
  civilianTranslation?: string | null;
  locationPreference?: string | null;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  companyName?: string | null;
  jobTitle?: string | null;
  skills?: string[];
  canReadPii: boolean;
}) {
  const candidate = presentCandidate(
    { email: null, phone: null, compensationExpectations: null },
    input.canReadPii,
  );
  void candidate;
  const windowLabel =
    input.windowStart && input.windowEnd
      ? `${input.windowStart.toLocaleDateString()}–${input.windowEnd.toLocaleDateString()}`
      : input.windowStart
        ? `starting ${input.windowStart.toLocaleDateString()}`
        : "dates on file";
  const occupation = input.occupationTitle ?? "the military occupation recorded on this profile";
  const translation = input.civilianTranslation ?? "approved civilian translation on file when available";
  const location = input.locationPreference ?? "location preference on file";
  const skills = input.skills?.length ? input.skills.join(", ") : "skills recorded on the Talent Network profile";
  const company = input.companyName ?? "the employer";
  const role = input.jobTitle ?? "the role";

  const facts = [
    `Candidate: ${input.candidateName}`,
    `Military occupation: ${occupation}`,
    `Civilian translation: ${translation}`,
    `Location preference: ${location}`,
    `SkillBridge window: ${windowLabel}`,
    input.companyName ? `Employer: ${input.companyName}` : null,
    input.jobTitle ? `Role: ${input.jobTitle}` : null,
  ].filter(Boolean) as string[];

  const body =
    input.audience === "employer"
      ? `I am sharing a transitioning service member brief for ${input.candidateName}. Military background: ${occupation}. Civilian translation (approved/on file): ${translation}. Relevant recorded skills: ${skills}. Transition / SkillBridge window: ${windowLabel}. Preferred location: ${location}. Target role: ${role}. PierOne is the intermediary; the employer/host company owns any SkillBridge opportunity. This draft uses stored WorkforceOS records only and is not an employment guarantee.`
      : `Hi ${input.candidateName.split(" ")[0]}, checking in on your military transition timeline (${windowLabel}). ${input.occupationTitle ? `We have ${occupation} on file` : "We have the military occupation recorded on this profile"}${input.companyName ? ` and ${company} / ${role}` : ""}. This is a draft for human review and will not send until you confirm.`;

  return {
    kind: input.kind,
    audience: input.audience,
    subject:
      input.audience === "employer"
        ? `Transitioning talent overview — ${input.candidateName}`
        : `Military transition check-in — ${input.candidateName}`,
    body,
    facts,
    invented: false,
    sendAllowed: false,
  };
}

/** Operator-facing employer brief is `body` (reviewable prose). Structured fields are for tests and stored-record reuse, not raw JSON display. */
export function draftEmployerBrief(input: {
  candidateName: string;
  occupationTitle?: string | null;
  civilianTranslation?: string | null;
  skills: string[];
  windowStart?: Date | null;
  windowEnd?: Date | null;
  locationPreference?: string | null;
  targetRole?: string | null;
  strengths?: string[];
  gaps?: string[];
  recruiterNotes?: string | null;
}) {
  const windowLabel =
    input.windowStart && input.windowEnd
      ? `${input.windowStart.toLocaleDateString()}–${input.windowEnd.toLocaleDateString()}`
      : input.windowStart
        ? `starting ${input.windowStart.toLocaleDateString()}`
        : "dates on file";
  const occupation = input.occupationTitle ?? "military occupation recorded on the profile";
  const translation = input.civilianTranslation ?? "pending approved civilian mapping";
  const location = input.locationPreference ?? "location preference on file";
  const role = input.targetRole ?? "target role on file";
  const skillList = input.skills.length ? input.skills.join(", ") : "skills recorded on the Talent Network profile";
  const strengths = input.strengths?.length ? input.strengths.join("; ") : null;
  const gaps = input.gaps?.length ? input.gaps.join("; ") : null;
  const facts = [
    `Candidate: ${input.candidateName}`,
    `Military occupation: ${occupation}`,
    `Civilian translation: ${translation}`,
    `Location preference: ${location}`,
    `SkillBridge-eligible window: ${windowLabel}`,
    `Target role: ${role}`,
    input.skills.length ? `Recorded skills: ${skillList}` : null,
    strengths ? `Recorded strengths: ${strengths}` : null,
    gaps ? `Potential gaps on file: ${gaps}` : null,
    input.recruiterNotes ? `Recruiter notes: ${input.recruiterNotes}` : null,
  ].filter(Boolean) as string[];
  const body = [
    `I am sharing a transitioning service member brief for ${input.candidateName}.`,
    `Military background: ${occupation}. Civilian translation: ${translation}. Relevant recorded skills: ${skillList}.`,
    `Transition / SkillBridge-eligible window: ${windowLabel}. Preferred location: ${location}. Target role: ${role}.`,
    strengths ? `Recorded strengths: ${strengths}.` : null,
    gaps ? `Potential gaps on file: ${gaps}.` : null,
    input.recruiterNotes ? `Recruiter notes: ${input.recruiterNotes}.` : null,
    "PierOne is the intermediary; the employer/host company owns any SkillBridge-eligible opportunity.",
    "This draft uses stored WorkforceOS records only, requires human review, and is not an employment guarantee.",
    "Use the stored resume file when present. Do not invent a quality score.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    candidate: input.candidateName,
    militaryBackground: occupation,
    civilianTranslation: translation,
    relevantSkills: input.skills,
    skillbridgeAvailability: windowLabel,
    preferredLocation: location,
    targetRole: role,
    strengths: input.strengths ?? [],
    potentialGaps: input.gaps ?? [],
    resume: "Use the stored resume file when present. No quality score.",
    recruiterNotes: input.recruiterNotes ?? null,
    humanReviewRequired: true,
    invented: false,
    sendAllowed: false,
    facts,
    body,
  };
}
