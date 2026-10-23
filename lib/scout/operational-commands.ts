import { z } from "zod";

import type { ScoutCommandFamily } from "./commands";
import { publicOpportunityLabel } from "../recruiting/engagement-policy";
import type { Permission } from "../rbac/permissions";

export const SCOUT_RESULT_LIMIT = 25;

export const operationalCommandIds = [
  "talent.by_capability",
  "talent.without_workflow",
  "talent.waiting_over_days",
  "match.explain",
  "match.candidate_opportunities",
  "match.job_candidates",
  "demand.recent_public",
  "demand.strong_without_engagement",
  "demand.requirement_review",
  "demand.crm_pursuits",
  "ops.overdue_follow_ups",
  "ops.waiting_on_employer",
  "ops.waiting_on_candidate",
  "ops.referrals_need_routing",
  "ops.no_fit_needs_path",
  "ops.interviews_need_next",
  "ops.set_follow_up",
  "ops.m6_handoff",
  "workforce.largest_gaps",
  "workforce.critical_roles",
  "workforce.scarce_capabilities",
  "workforce.military_supply",
  "workforce.occupation_channels",
] as const;

export type OperationalCommandId = (typeof operationalCommandIds)[number];

export type OperationalCommandDefinition = {
  id: OperationalCommandId;
  intent: string;
  family: ScoutCommandFamily;
  entity: string;
  permissions: Permission[];
  risk: "read" | "internal_write";
  confirm: boolean;
  audit: boolean;
  limit: number;
  canonicalService: string;
  input: string;
  output: string;
};

const read = (
  id: OperationalCommandId,
  intent: string,
  family: ScoutCommandFamily,
  entity: string,
  permissions: Permission[],
  canonicalService: string,
  input: string,
  output: string,
): OperationalCommandDefinition => ({
  id,
  intent,
  family,
  entity,
  permissions,
  risk: "read",
  confirm: false,
  audit: false,
  limit: SCOUT_RESULT_LIMIT,
  canonicalService,
  input,
  output,
});

export const OPERATIONAL_COMMANDS: Record<OperationalCommandId, OperationalCommandDefinition> = {
  "talent.by_capability": read(
    "talent.by_capability",
    "Show candidates with a capability",
    "SEARCH",
    "candidates",
    ["scout.use", "scout.search", "candidates.read"],
    "candidate_skills joined to skills",
    "{ skill: string }",
    "Up to 25 candidate ids and names. No email or phone.",
  ),
  "talent.without_workflow": read(
    "talent.without_workflow",
    "Transitioning candidates with no open engagement",
    "SEARCH",
    "candidates",
    ["scout.use", "scout.search", "candidates.read"],
    "skillbridge_profiles and opportunity_engagements",
    "{}",
    "Up to 25 people whose Transition Talent Profile has no open M6 engagement.",
  ),
  "talent.waiting_over_days": read(
    "talent.waiting_over_days",
    "Candidates waiting longer than a day threshold",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue agingDays from lastActivityAt",
    "{ waitingDays: number }",
    "Up to 25 engagements whose M6 aging exceeds the threshold.",
  ),
  "match.explain": read(
    "match.explain",
    "Why a stored match has its category",
    "SHOW_RECORD",
    "match",
    ["scout.use", "candidates.read", "jobs.read"],
    "listCandidateOpportunityMatches",
    "{ subjectName: string, objectName: string }",
    "Stored M5 category, aligned capabilities, gaps, evidence, freshness, and timing.",
  ),
  "match.candidate_opportunities": read(
    "match.candidate_opportunities",
    "Stored opportunities for one candidate",
    "FIND_MATCHES",
    "jobs",
    ["scout.use", "scout.search", "candidates.read", "jobs.read"],
    "listCandidateOpportunityMatches",
    "{ subjectName: string }",
    "Current M5 matches. Public jobs stay labeled Public opportunity.",
  ),
  "match.job_candidates": read(
    "match.job_candidates",
    "Stored candidates for one job",
    "FIND_MATCHES",
    "candidates",
    ["scout.use", "scout.search", "candidates.read", "jobs.read"],
    "listJobTalentMatches",
    "{ objectName: string }",
    "Current M5 matches. No submission and no rejection.",
  ),
  "demand.recent_public": read(
    "demand.recent_public",
    "Public jobs discovered recently",
    "SEARCH",
    "jobs",
    ["scout.use", "scout.search", "jobs.read"],
    "jobs where job_context_type is monitored_public",
    "{}",
    "Up to 25 public opportunities with discovery time. Not CRM pursuits.",
  ),
  "demand.strong_without_engagement": read(
    "demand.strong_without_engagement",
    "Strong matches with no engagement",
    "SEARCH",
    "matches",
    ["scout.use", "scout.search", "jobs.read", "candidates.read"],
    "candidate_job_matches strong_match without an open engagement",
    "{}",
    "Up to 25 stored strong matches that have not been started.",
  ),
  "demand.requirement_review": read(
    "demand.requirement_review",
    "Jobs with requirements still pending review",
    "SEARCH",
    "jobs",
    ["scout.use", "scout.search", "jobs.read"],
    "job_requirements and job_skills review status",
    "{}",
    "Up to 25 jobs with pending requirement review.",
  ),
  "demand.crm_pursuits": read(
    "demand.crm_pursuits",
    "CRM commercial pursuits",
    "SEARCH",
    "opportunities",
    ["scout.use", "scout.search", "opportunities.read"],
    "opportunities",
    "{}",
    "Up to 25 CRM pursuits. These are not jobs.",
  ),
  "ops.overdue_follow_ups": read(
    "ops.overdue_follow_ups",
    "Overdue employer follow-ups",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue bucket overdue",
    "{}",
    "Engagements whose next follow-up is before today.",
  ),
  "ops.waiting_on_employer": read(
    "ops.waiting_on_employer",
    "Engagements waiting on an employer",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue waitingOn",
    "{}",
    "Open engagements waiting on the employer.",
  ),
  "ops.waiting_on_candidate": read(
    "ops.waiting_on_candidate",
    "Engagements waiting on a candidate",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue waitingOn",
    "{}",
    "Open engagements waiting on the candidate.",
  ),
  "ops.referrals_need_routing": read(
    "ops.referrals_need_routing",
    "Referrals that still need routing",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue bucket referral_needs_routing",
    "{}",
    "Referred engagements.",
  ),
  "ops.no_fit_needs_path": read(
    "ops.no_fit_needs_path",
    "No Fit candidates that need another opportunity",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue bucket no_fit_needs_decision",
    "{}",
    "No Fit engagements that are not closed.",
  ),
  "ops.interviews_need_next": read(
    "ops.interviews_need_next",
    "Interviews that need a next step",
    "SEARCH",
    "engagements",
    ["scout.use", "scout.search", "jobs.read"],
    "listEngagementQueue bucket interview_next",
    "{}",
    "Interviews requested and not scheduled.",
  ),
  "ops.set_follow_up": {
    id: "ops.set_follow_up",
    intent: "Set an internal follow-up date on an engagement",
    family: "CREATE_FOLLOW_UP",
    entity: "engagement",
    permissions: ["scout.use", "scout.internal_actions", "jobs.write"],
    risk: "internal_write",
    confirm: true,
    audit: true,
    limit: 1,
    canonicalService: "setEngagementFollowUp",
    input: "{ engagementId: uuid, followUpAt?: datetime }",
    output: "Updated engagement follow-up, after confirmation.",
  },
  "ops.m6_handoff": read(
    "ops.m6_handoff",
    "Hand external communication back to the engagement workflow",
    "SHOW_RECORD",
    "engagement",
    ["scout.use"],
    "M6 engagement confirmation path",
    "{}",
    "A link to Follow-ups. Scout does not send, route, or submit.",
  ),
  "workforce.largest_gaps": read(
    "workforce.largest_gaps",
    "Largest workforce quantity gaps",
    "SHOW_DASHBOARD",
    "workforce",
    ["scout.use", "workforce.read"],
    "loadWorkforcePortfolio",
    "{}",
    "M7 quantity gaps. Known supply is people.",
  ),
  "workforce.critical_roles": read(
    "workforce.critical_roles",
    "Critical workforce roles",
    "SHOW_DASHBOARD",
    "workforce",
    ["scout.use", "workforce.read"],
    "loadWorkforcePortfolio",
    "{}",
    "Roles whose M7 health is critical.",
  ),
  "workforce.scarce_capabilities": read(
    "workforce.scarce_capabilities",
    "Scarce capabilities on workforce roles",
    "SHOW_DASHBOARD",
    "workforce",
    ["scout.use", "workforce.read"],
    "loadWorkforcePortfolio",
    "{}",
    "Roles in gap or critical health. Capability detail stays on the role.",
  ),
  "workforce.military_supply": read(
    "workforce.military_supply",
    "Known military supply for a workforce role",
    "SHOW_DASHBOARD",
    "workforce_role",
    ["scout.use", "workforce.read"],
    "loadWorkforceRolePipeline",
    "{ subjectName?: string, workforceRoleId?: uuid }",
    "Known military supply counts people. Occupation channels are listed separately.",
  ),
  "workforce.occupation_channels": read(
    "workforce.occupation_channels",
    "Military occupation channels for a workforce role",
    "SHOW_DASHBOARD",
    "workforce_role",
    ["scout.use", "workforce.read"],
    "loadWorkforceRolePipeline",
    "{ subjectName?: string, workforceRoleId?: uuid }",
    "Reference occupations. They are not counted as candidates.",
  ),
};

export function operationalCommand(id: string): OperationalCommandDefinition | null {
  if (!(id in OPERATIONAL_COMMANDS)) return null;
  return OPERATIONAL_COMMANDS[id as OperationalCommandId];
}

export const operationalPromptSchema = z.object({
  commandId: z.enum(operationalCommandIds),
  subjectName: z.string().trim().max(200).optional(),
  objectName: z.string().trim().max(200).optional(),
  skill: z.string().trim().max(120).optional(),
  waitingDays: z.number().int().positive().max(365).optional(),
});

export type OperationalMatch = {
  id: OperationalCommandId;
  subjectName?: string;
  objectName?: string;
  skill?: string;
  waitingDays?: number;
};

function cleanName(value: string) {
  return value.replace(/[?.!]+$/g, "").replace(/^(the|a|an)\s+/i, "").trim();
}

function namedRole(raw: string): Omit<OperationalMatch, "id"> {
  const role = raw.match(/for (.+?)\??$/i);
  const name = role?.[1] ? cleanName(role[1]) : "";
  if (!name || /^(this|the) workforce role$/i.test(name)) return {};
  return { subjectName: name };
}

function from(id: OperationalCommandId, extra: Omit<OperationalMatch, "id"> = {}): OperationalMatch {
  return { id, ...extra };
}

export function matchOperationalPrompt(prompt: string): OperationalMatch | null {
  const raw = prompt.trim();
  const text = raw.toLowerCase();
  if (!text) return null;

  if (
    /\b(email|e-mail)\b/.test(text)
    || /\bsend (an |the )?(email|message|interview invitation)\b/.test(text)
    || /\broute (this |the )?candidate\b/.test(text)
    || /\bmark (the )?message sent\b/.test(text)
    || /\bsubmit (this |the )?candidate\b/.test(text)
  ) {
    if (!/\bdraft\b/.test(text)) return from("ops.m6_handoff");
  }
  if (/\bset (an? |the )?(internal )?follow-?up\b/.test(text)) return from("ops.set_follow_up");

  const why = raw.match(/why does (.+?) match (.+?)\??$/i);
  if (why?.[1] && why[2]) return from("match.explain", { subjectName: cleanName(why[1]), objectName: cleanName(why[2]) });

  const strongest = raw.match(/(?:strongest|best) opportunities for (.+?)\??$/i);
  if (strongest?.[1]) return from("match.candidate_opportunities", { subjectName: cleanName(strongest[1]) });

  const who = raw.match(/who matches (.+?)\??$/i);
  if (who?.[1]) return from("match.job_candidates", { objectName: cleanName(who[1]) });

  if (/\bpublic opportunit/.test(text) && /\b(discover\w*|recent\w*|this week|new)\b/.test(text)) return from("demand.recent_public");
  if (/\bstrong matches?\b/.test(text) && /\bno engagement\b/.test(text)) return from("demand.strong_without_engagement");
  if (/\brequirement review\b/.test(text)) return from("demand.requirement_review");
  if (/\bcrm opportunit|\bcommercial pursuits?\b|\bsales opportunit/.test(text)) return from("demand.crm_pursuits");

  if (/\boverdue employer follow-?ups?\b/.test(text)) return from("ops.overdue_follow_ups");
  if (/\bwaiting on (the )?employer\b/.test(text)) return from("ops.waiting_on_employer");
  if (/\bwaiting on (the )?candidate\b/.test(text)) return from("ops.waiting_on_candidate");
  if (/\breferrals?\b/.test(text) && /\brouting\b/.test(text)) return from("ops.referrals_need_routing");
  if (/\bno fit\b/.test(text)) return from("ops.no_fit_needs_path");
  if (/\binterviews?\b/.test(text) && /\bnext step\b/.test(text)) return from("ops.interviews_need_next");

  const waiting = text.match(/waiting more than (\d+)\s*days/);
  if (waiting?.[1] || /\bcandidates are waiting\b/.test(text)) {
    return from("talent.waiting_over_days", { waitingDays: waiting?.[1] ? Number(waiting[1]) : 5 });
  }
  if (/\btransitioning\b/.test(text) && /\bno active opportunity workflow\b/.test(text)) return from("talent.without_workflow");

  const skill = raw.match(/candidates with ([^.?]+)/i);
  if (skill?.[1]) return from("talent.by_capability", { skill: cleanName(skill[1]) });

  if (/\blargest workforce gaps?\b/.test(text)) return from("workforce.largest_gaps");
  if (/\bworkforce roles? are critical\b|\bcritical workforce roles?\b/.test(text)) return from("workforce.critical_roles");
  if (/\bcapabilities are scarce\b|\bscarce capabilities\b/.test(text)) return from("workforce.scarce_capabilities");
  if (/\bknown military supply\b/.test(text)) {
    return from("workforce.military_supply", namedRole(raw));
  }
  if (/\bmilitary occupation channels?\b/.test(text)) {
    return from("workforce.occupation_channels", namedRole(raw));
  }
  return null;
}

export type StoredMatchExplanation = {
  categoryLabel: string;
  aligned: string[];
  gaps: string[];
  evidence: string[];
  freshness: string;
  explanation: string;
  contextLabel: string;
  lastEvaluatedAt: string | null;
  timing: string | null;
  href: string;
};

export function formatWhyMatch(card: StoredMatchExplanation | null, asOf: string) {
  if (!card) {
    return `Stored fact as of ${asOf}: there is no current M5 match row for that pair. Scout will not invent a second explanation.`;
  }
  const lines = [
    `Stored M5 explanation as of ${asOf}. Source: candidate_job_matches. This wording is the stored calculation, not a new model score.`,
    `Category: ${card.categoryLabel}.`,
    `Designation: ${card.contextLabel}.`,
    `Aligned capabilities: ${card.aligned.length ? card.aligned.join("; ") : "none stored"}.`,
    `Documented gaps and unknowns: ${card.gaps.length ? card.gaps.join("; ") : "none stored"}.`,
    `Evidence: ${card.evidence.length ? card.evidence.join("; ") : "none stored"}.`,
    `Freshness: ${card.freshness}. Evaluated: ${card.lastEvaluatedAt ?? "not recorded"}.`,
    card.timing ? `Timing: ${card.timing}.` : "Timing: not stored on this match.",
    card.explanation,
  ];
  return lines.join(" ");
}

export function formatMilitarySupply(input: {
  knownSupply: number;
  militarySupply: number;
  nonMilitarySupply: number;
  channels: Array<{ code: string; title: string }>;
  asOf: string;
  roleTitle: string;
}) {
  const channelText = input.channels.length
    ? input.channels.slice(0, SCOUT_RESULT_LIMIT).map((row) => `${row.code} ${row.title}`).join("; ")
    : "none stored";
  return [
    `Derived WorkforceOS calculation as of ${input.asOf}. Source: M7 workforce role ${input.roleTitle}.`,
    `Known supply is ${input.knownSupply} stored people (${input.militarySupply} military talent, ${input.nonMilitarySupply} other Talent Network).`,
    `Reference military channels: ${channelText}.`,
    "Occupation channels are sourcing references. They are not people and they are not included in known supply.",
  ].join(" ");
}

export function labelPublicOpportunity(contextType: string) {
  return publicOpportunityLabel(contextType);
}
