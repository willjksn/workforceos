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
  const occupation = input.occupationTitle ?? "military occupation on file";
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
      : `Hi ${input.candidateName.split(" ")[0]}, checking in on your military transition timeline (${windowLabel}). We have ${occupation} on file${input.companyName ? ` and ${company} / ${role}` : ""}. This is a draft for human review and will not send until you confirm.`;

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
  return {
    candidate: input.candidateName,
    militaryBackground: input.occupationTitle ?? "On file",
    civilianTranslation: input.civilianTranslation ?? "Pending approved mapping",
    relevantSkills: input.skills,
    skillbridgeAvailability:
      input.windowStart && input.windowEnd
        ? `${input.windowStart.toLocaleDateString()}–${input.windowEnd.toLocaleDateString()}`
        : "Dates on file",
    preferredLocation: input.locationPreference ?? "On file",
    targetRole: input.targetRole ?? "On file",
    strengths: input.strengths ?? [],
    potentialGaps: input.gaps ?? [],
    resume: "Use the stored resume file when present. No quality score.",
    recruiterNotes: input.recruiterNotes ?? null,
    humanReviewRequired: true,
  };
}
