import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { skillbridgeAlertRules } from "../../db/schema";

export const DEFAULT_SKILLBRIDGE_ALERT_RULES = [
  { code: "candidate_no_contact" as const, thresholdDays: 14 },
  { code: "employer_feedback_overdue" as const, thresholdDays: 7 },
  { code: "window_approaching" as const, thresholdDays: 90 },
  { code: "no_opportunity" as const, thresholdDays: 90 },
  { code: "resume_missing" as const, thresholdDays: 0 },
  { code: "conversion_approaching" as const, thresholdDays: 30 },
];

export async function ensureSkillBridgeAlertRules(organizationId: string) {
  const db = getDb();
  await db
    .insert(skillbridgeAlertRules)
    .values(
      DEFAULT_SKILLBRIDGE_ALERT_RULES.map((rule) => ({
        organizationId,
        code: rule.code,
        enabled: true,
        thresholdDays: rule.thresholdDays,
      })),
    )
    .onConflictDoNothing();
}

export async function getSkillBridgeAlertRules(organizationId: string) {
  await ensureSkillBridgeAlertRules(organizationId);
  const db = getDb();
  const rows = await db
    .select()
    .from(skillbridgeAlertRules)
    .where(eq(skillbridgeAlertRules.organizationId, organizationId));
  const byCode = Object.fromEntries(rows.map((row) => [row.code, row]));
  return {
    candidateNoContactDays: byCode.candidate_no_contact?.enabled ? byCode.candidate_no_contact.thresholdDays : null,
    employerFeedbackOverdueDays: byCode.employer_feedback_overdue?.enabled
      ? byCode.employer_feedback_overdue.thresholdDays
      : null,
    windowApproachingDays: byCode.window_approaching?.enabled ? byCode.window_approaching.thresholdDays : 90,
    noOpportunityDays: byCode.no_opportunity?.enabled ? byCode.no_opportunity.thresholdDays : 90,
    resumeMissingEnabled: Boolean(byCode.resume_missing?.enabled),
    conversionApproachingDays: byCode.conversion_approaching?.enabled
      ? byCode.conversion_approaching.thresholdDays
      : 30,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDayNumber(value: Date) {
  return Math.floor(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / MS_PER_DAY);
}

export function daysFromNow(days: number, from = new Date()) {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

export function daysBetween(from: Date | null | undefined, to = new Date()) {
  if (!from) return null;
  return utcDayNumber(to) - utcDayNumber(from);
}

export function daysUntil(target: Date | null | undefined, from = new Date()) {
  if (!target) return null;
  return utcDayNumber(target) - utcDayNumber(from);
}

export const STARTING_ENDING_SOON_DAYS = 14;

export const ACTIVE_SKILLBRIDGE_STATUSES = [
  "new",
  "initial_contact",
  "profile_incomplete",
  "ready_for_matching",
  "matching",
  "opportunity_identified",
  "submitted",
  "interviewing",
  "skillbridge_pending",
  "skillbridge_approved",
  "skillbridge_active",
  "conversion_pending",
] as const;

export const ACTIVE_OPPORTUNITY_STAGES = [
  "candidate_identified",
  "initial_contact",
  "profile_complete",
  "opportunity_matching",
  "candidate_interested",
  "employer_submitted",
  "hiring_manager_review",
  "interview",
  "skillbridge_approval",
  "skillbridge_placement",
  "skillbridge_active",
  "conversion_review",
] as const;

export const TERMINAL_OPPORTUNITY_STAGES = [
  "hired",
  "no_match_yet",
  "candidate_withdrew",
  "employer_declined",
  "skillbridge_denied",
  "position_closed",
  "nurture",
  "closed",
] as const;
