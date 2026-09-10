import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { skillbridgeAlertRules } from "../../db/schema";

export const DEFAULT_SKILLBRIDGE_ALERT_RULES = [
  { code: "candidate_no_contact" as const, thresholdDays: 14 },
  { code: "employer_feedback_overdue" as const, thresholdDays: 7 },
  { code: "window_approaching" as const, thresholdDays: 90 },
  { code: "no_opportunity" as const, thresholdDays: 90 },
  { code: "resume_missing" as const, thresholdDays: 0 },
  { code: "conversion_approaching" as const, thresholdDays: 30 },
  { code: "window_starting_soon" as const, thresholdDays: 14 },
  { code: "window_ending_soon" as const, thresholdDays: 14 },
];

export async function ensureSkillBridgeAlertRules(organizationId: string) {
  const db = getDb();
  for (const rule of DEFAULT_SKILLBRIDGE_ALERT_RULES) {
    try {
      await db
        .insert(skillbridgeAlertRules)
        .values({
          organizationId,
          code: rule.code,
          enabled: true,
          thresholdDays: rule.thresholdDays,
        })
        .onConflictDoNothing();
    } catch {
      // Missing enum values (migration not applied) must not abort the request.
      continue;
    }
  }
}

export async function getSkillBridgeAlertRules(organizationId: string) {
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
    windowStartingSoonDays: byCode.window_starting_soon?.enabled ? byCode.window_starting_soon.thresholdDays : 14,
    windowEndingSoonDays: byCode.window_ending_soon?.enabled ? byCode.window_ending_soon.thresholdDays : 14,
    rows,
  };
}

export async function updateSkillBridgeAlertRule(input: {
  organizationId: string;
  actorUserId: string;
  code: (typeof DEFAULT_SKILLBRIDGE_ALERT_RULES)[number]["code"];
  enabled: boolean;
  thresholdDays: number;
}) {
  await ensureSkillBridgeAlertRules(input.organizationId);
  const db = getDb();
  const [row] = await db
    .update(skillbridgeAlertRules)
    .set({
      enabled: input.enabled,
      thresholdDays: input.thresholdDays,
      updatedAt: new Date(),
    })
    .where(
      and(eq(skillbridgeAlertRules.organizationId, input.organizationId), eq(skillbridgeAlertRules.code, input.code)),
    )
    .returning();
  return row;
}

export function daysFromNow(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysBetween(from: Date | null | undefined, to = new Date()) {
  if (!from) return null;
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function daysUntil(target: Date | null | undefined, from = new Date()) {
  if (!target) return null;
  return Math.round((target.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

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
