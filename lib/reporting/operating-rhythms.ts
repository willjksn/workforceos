import { and, count, desc, eq, gte, inArray, isNull, lt, lte, not, notExists, notInArray, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidates,
  companies,
  contracts,
  integrationConnections,
  interviews,
  invoices,
  jobs,
  opportunities,
  payments,
  placements,
  projectDeliverables,
  projectPhases,
  projectTasks,
  projects,
  proposals,
  revenueEvents,
  skillbridgeOpportunities,
  skillbridgeProfiles,
  staffOnboarding,
  submissions,
  users,
} from "../../db/schema";
import { CLOSED_OPPORTUNITY_STAGES } from "../crm/stages";
import { moneyString } from "../finance/money";
import { countFailedIntegrationEvents } from "../integrations/retry";
import { can, type Permission, type Principal } from "../rbac/permissions";
import {
  ACTIVE_OPPORTUNITY_STAGES,
  ACTIVE_SKILLBRIDGE_STATUSES,
  DEFAULT_SKILLBRIDGE_ALERT_RULES,
  TERMINAL_OPPORTUNITY_STAGES,
} from "../skillbridge/rules";

/** 14-day stale window already used by Command Center CRM cards. */
export const STALE_RECORD_DAYS = 14;
/** Same 90-day rediscovery window as Talent Network Command Center cards. */
export const CANDIDATE_AGING_DAYS = 90;
/** Phase H elapsed Week 4 suggestion (`suggestedCadenceFromElapsed` ≥ 22 days). */
export const STAFF_WEEK4_ELAPSED_DAYS = 22;
/** Intake lookback for new Transition Talent Profiles. Not a military-mapping rule. */
export const NEW_PROFILE_DAYS = 7;
export const RHYTHM_EXCEPTION_LIMIT = 8;

export const SKILLBRIDGE_WINDOW_DAYS =
  DEFAULT_SKILLBRIDGE_ALERT_RULES.find((rule) => rule.code === "window_approaching")?.thresholdDays ?? 90;
export const SKILLBRIDGE_NO_CONTACT_DAYS =
  DEFAULT_SKILLBRIDGE_ALERT_RULES.find((rule) => rule.code === "candidate_no_contact")?.thresholdDays ?? 14;
export const SKILLBRIDGE_EMPLOYER_FEEDBACK_DAYS =
  DEFAULT_SKILLBRIDGE_ALERT_RULES.find((rule) => rule.code === "employer_feedback_overdue")?.thresholdDays ?? 7;

export const CADENCE_IDS = ["leadership", "operations", "talent", "military", "finance"] as const;
export type CadenceId = (typeof CADENCE_IDS)[number];

export const CADENCE_LABELS: Record<CadenceId, string> = {
  leadership: "Leadership",
  operations: "Operations",
  talent: "Talent",
  military: "Military Talent",
  finance: "Finance",
};

export const CADENCE_SUMMARIES: Record<CadenceId, string> = {
  leadership: "Weekly pipeline review from stored opportunities, delivery, Military Talent, cash, and derived risks.",
  operations: "Delivery, overdue work, PierOne staff onboarding, contracts, and open commitments.",
  talent: "Jobs, Talent Network, submissions, interviews, aging, and placements.",
  military: "Transition Talent Profiles, SkillBridge pathway windows, unmatched talent, and employer/host matches.",
  finance: "Operating invoices, AR aging, cash received, and expected revenue. Not a general ledger.",
};

export type RhythmException = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

export type RhythmWidget = {
  id: string;
  cadence: CadenceId;
  question: string;
  value: string | number;
  href: string;
  windowHint?: string;
  exceptions: RhythmException[];
  provenance: "live_aggregate";
};

export type RhythmBoard = {
  id: CadenceId;
  title: string;
  summary: string;
  widgets: RhythmWidget[];
};

export type RhythmWidgetDef = {
  id: string;
  cadence: CadenceId;
  question: string;
  href: string;
  windowHint?: string;
  /** Any of these permissions unlocks the widget. */
  anyPermission: Permission[];
  /** Commercial opportunity spine — Recruiter must not see (DEC-RBAC-001). */
  commercial?: boolean;
};

/** Closed catalog of weekly-review widgets. Not 40 nav items. */
export const RHYTHM_WIDGET_DEFS: RhythmWidgetDef[] = [
  {
    id: "weekly-pipeline",
    cadence: "leadership",
    question: "Which commercial opportunities are still open this week?",
    href: "/app/opportunities",
    anyPermission: ["opportunities.read"],
    commercial: true,
  },
  {
    id: "open-proposals",
    cadence: "leadership",
    question: "Which proposals are still in draft, internal review, or sent?",
    href: "/app/proposals",
    anyPermission: ["opportunities.read"],
    commercial: true,
  },
  {
    id: "recruiting-delivery",
    cadence: "leadership",
    question: "How many searches are in active delivery?",
    href: "/app/jobs",
    anyPermission: ["jobs.read"],
  },
  {
    id: "military-pipeline",
    cadence: "leadership",
    question: "How many Transition Talent Profiles are in active Military Talent operations?",
    href: "/app/military/skillbridge",
    windowHint: `SkillBridge pathway window uses the stored ${SKILLBRIDGE_WINDOW_DAYS}-day approaching rule.`,
    anyPermission: ["military.read", "skillbridge.read"],
  },
  {
    id: "project-health",
    cadence: "leadership",
    question: "Which delivery projects are at risk?",
    href: "/app/projects?filter=at_risk",
    anyPermission: ["projects.read"],
  },
  {
    id: "cash-ar",
    cadence: "leadership",
    question: "What cash has been received and what AR is still open?",
    href: "/app/finance/ar",
    anyPermission: ["finance.read"],
  },
  {
    id: "derived-risks",
    cadence: "leadership",
    question: "Which stored records are stale, overdue, past due, or failing?",
    href: "/app/alerts",
    windowHint: `Stale opportunities and aging jobs use a ${STALE_RECORD_DAYS}-day stored-date window. Alerts stay on /app/alerts (DEC-OPS-002).`,
    anyPermission: ["opportunities.read", "projects.read", "finance.read", "integrations.read", "alerts.read", "reports.read"],
  },
  {
    id: "delivery-review",
    cadence: "operations",
    question: "Which consulting delivery projects are active?",
    href: "/app/projects?filter=active",
    anyPermission: ["projects.read"],
  },
  {
    id: "overdue-actions",
    cadence: "operations",
    question: "Which deliverables or tasks are past their stored due date?",
    href: "/app/projects/deliverables",
    anyPermission: ["projects.read", "deliverables.read"],
  },
  {
    id: "staffing",
    cadence: "operations",
    question: "Which PierOne staff onboarding records are still open or past the Week 4 elapsed window?",
    href: "/app/admin/users",
    windowHint: `Overdue uses Phase H elapsed Week 4 (≥ ${STAFF_WEEK4_ELAPSED_DAYS} days from started_at) when cadence is not complete. Not a temp-staffing product.`,
    anyPermission: ["admin.users"],
  },
  {
    id: "contracts",
    cadence: "operations",
    question: "Which contracts are still awaiting execution?",
    href: "/app/contracts",
    anyPermission: ["contracts.read"],
  },
  {
    id: "commitments",
    cadence: "operations",
    question: "Which undelivered deliverables still have a stored due date?",
    href: "/app/projects/deliverables",
    anyPermission: ["projects.read", "deliverables.read"],
  },
  {
    id: "jobs",
    cadence: "talent",
    question: "How many jobs are open or in active search?",
    href: "/app/jobs",
    anyPermission: ["jobs.read"],
  },
  {
    id: "candidates",
    cadence: "talent",
    question: "How many Talent Network candidates are active?",
    href: "/app/talent",
    anyPermission: ["candidates.read"],
  },
  {
    id: "submissions",
    cadence: "talent",
    question: "How many client submissions are on file?",
    href: "/app/submissions",
    anyPermission: ["submissions.read"],
  },
  {
    id: "interviews",
    cadence: "talent",
    question: "How many interviews are scheduled?",
    href: "/app/interviews",
    anyPermission: ["interviews.read"],
  },
  {
    id: "aging",
    cadence: "talent",
    question: "Which open jobs or candidates have gone quiet on stored dates?",
    href: "/app/talent/rediscovery",
    windowHint: `Jobs: ${STALE_RECORD_DAYS} days since last_activity_at or updated_at. Candidates: ${CANDIDATE_AGING_DAYS}-day rediscovery window on last_contacted_at.`,
    anyPermission: ["jobs.read", "candidates.read"],
  },
  {
    id: "placements",
    cadence: "talent",
    question: "How many placements are recorded?",
    href: "/app/placements",
    anyPermission: ["placements.read"],
  },
  {
    id: "new-profiles",
    cadence: "military",
    question: "How many Transition Talent Profiles were added in the intake window?",
    href: "/app/military/skillbridge",
    windowHint: `${NEW_PROFILE_DAYS}-day created_at lookback. Not a mapping metric.`,
    anyPermission: ["military.read", "skillbridge.read"],
  },
  {
    id: "transition-windows",
    cadence: "military",
    question: "Whose stored SkillBridge pathway window opens inside the approaching rule?",
    href: "/app/military/skillbridge?view=windows",
    windowHint: `${SKILLBRIDGE_WINDOW_DAYS}-day SkillBridge alert constant (window_approaching).`,
    anyPermission: ["military.read", "skillbridge.read"],
  },
  {
    id: "unmatched-talent",
    cadence: "military",
    question: "Which active profiles have no active employer/host opportunity?",
    href: "/app/military/skillbridge?view=without-opportunities",
    anyPermission: ["military.read", "skillbridge.read"],
  },
  {
    id: "employer-opportunities",
    cadence: "military",
    question: "How many employer/host opportunities are open?",
    href: "/app/military/opportunities",
    anyPermission: ["military.read", "skillbridge.read"],
  },
  {
    id: "military-interviews",
    cadence: "military",
    question: "How many scheduled interviews sit on a Transition Talent Profile?",
    href: "/app/interviews",
    anyPermission: ["military.read", "skillbridge.read", "interviews.read"],
  },
  {
    id: "military-placements",
    cadence: "military",
    question: "How many placements are linked to a Transition Talent Profile?",
    href: "/app/placements",
    anyPermission: ["military.read", "skillbridge.read", "placements.read"],
  },
  {
    id: "conversions",
    cadence: "military",
    question: "How many profiles are in conversion_pending?",
    href: "/app/military/skillbridge?view=conversion",
    anyPermission: ["military.read", "skillbridge.read"],
  },
  {
    id: "invoices",
    cadence: "finance",
    question: "How many invoices are on file?",
    href: "/app/finance/invoices",
    anyPermission: ["finance.read", "invoices.read"],
  },
  {
    id: "ar-aging",
    cadence: "finance",
    question: "What open AR sits in each stored aging bucket?",
    href: "/app/finance/ar",
    anyPermission: ["finance.read"],
  },
  {
    id: "cash-received",
    cadence: "finance",
    question: "How much cash has been recorded on payments?",
    href: "/app/finance/payments",
    anyPermission: ["finance.read", "payments.read"],
  },
  {
    id: "expected-revenue",
    cadence: "finance",
    question: "What expected revenue is stored and not cancelled?",
    href: "/app/finance",
    anyPermission: ["finance.read"],
  },
];

export const COMMERCIAL_RHYTHM_WIDGET_IDS = RHYTHM_WIDGET_DEFS.filter((def) => def.commercial).map((def) => def.id);

const PII_FIELD_PATTERN = /\b(email|phone|compensation|resume|baseSalary|currentResume)\b/i;

function daysAgo(days: number, from = new Date()) {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

async function counted(query: Promise<Array<{ value: number }>>) {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

function money(rows: Array<{ value: string | number | null }>) {
  return rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
}

function moneyLabel(value: number) {
  return `$${moneyString(value)}`;
}

export function isCadenceId(value: string | undefined): value is CadenceId {
  return Boolean(value && (CADENCE_IDS as readonly string[]).includes(value));
}

export function canSeeRhythmWidget(principal: Principal, def: RhythmWidgetDef) {
  if (def.commercial && !can(principal, "opportunities.read")) return false;
  return def.anyPermission.some((permission) => can(principal, permission));
}

export function visibleRhythmWidgetDefs(principal: Principal, cadence?: CadenceId) {
  return RHYTHM_WIDGET_DEFS.filter((def) => (!cadence || def.cadence === cadence) && canSeeRhythmWidget(principal, def));
}

export function visibleCadenceIds(principal: Principal): CadenceId[] {
  return CADENCE_IDS.filter((cadence) => visibleRhythmWidgetDefs(principal, cadence).length > 0);
}

export function rhythmPayloadLooksLikePii(value: unknown): boolean {
  return JSON.stringify(value).match(PII_FIELD_PATTERN) != null;
}

function emptyWidget(def: RhythmWidgetDef, value: string | number = 0, exceptions: RhythmException[] = []): RhythmWidget {
  return {
    id: def.id,
    cadence: def.cadence,
    question: def.question,
    value,
    href: def.href,
    windowHint: def.windowHint,
    exceptions,
    provenance: "live_aggregate",
  };
}

function defById(id: string) {
  const def = RHYTHM_WIDGET_DEFS.find((item) => item.id === id);
  if (!def) throw new Error(`Unknown rhythm widget: ${id}`);
  return def;
}

export async function getOperatingRhythmBoards(
  principal: Principal,
  options: { cadence?: CadenceId } = {},
): Promise<{ generatedAt: Date; boards: RhythmBoard[] }> {
  const generatedAt = new Date();
  const cadences = options.cadence ? [options.cadence] : visibleCadenceIds(principal);
  const boards = await Promise.all(
    cadences
      .filter((cadence) => visibleRhythmWidgetDefs(principal, cadence).length > 0)
      .map(async (cadence) => ({
        id: cadence,
        title: CADENCE_LABELS[cadence],
        summary: CADENCE_SUMMARIES[cadence],
        widgets: await loadCadenceWidgets(principal, cadence, generatedAt),
      })),
  );
  return { generatedAt, boards };
}

async function loadCadenceWidgets(principal: Principal, cadence: CadenceId, now: Date): Promise<RhythmWidget[]> {
  switch (cadence) {
    case "leadership":
      return loadLeadershipWidgets(principal, now);
    case "operations":
      return loadOperationsWidgets(principal, now);
    case "talent":
      return loadTalentWidgets(principal, now);
    case "military":
      return loadMilitaryWidgets(principal, now);
    case "finance":
      return loadFinanceWidgets(principal, now);
    default:
      return [];
  }
}

async function loadLeadershipWidgets(principal: Principal, now: Date): Promise<RhythmWidget[]> {
  const org = principal.organizationId;
  const db = getDb();
  const staleBefore = daysAgo(STALE_RECORD_DAYS, now);
  const widgets: RhythmWidget[] = [];

  if (canSeeRhythmWidget(principal, defById("weekly-pipeline"))) {
    const [openCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(opportunities)
          .where(
            and(
              eq(opportunities.organizationId, org),
              isNull(opportunities.archivedAt),
              notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
            ),
          ),
      ),
      db
        .select({
          id: opportunities.id,
          title: opportunities.name,
          stage: opportunities.stage,
          companyName: companies.name,
        })
        .from(opportunities)
        .innerJoin(companies, eq(opportunities.companyId, companies.id))
        .where(
          and(
            eq(opportunities.organizationId, org),
            isNull(opportunities.archivedAt),
            notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
          ),
        )
        .orderBy(desc(opportunities.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("weekly-pipeline"),
        openCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: `${row.companyName} · ${row.stage.replaceAll("_", " ")}`,
          href: `/app/opportunities/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("open-proposals"))) {
    const statuses = ["draft", "internal_review", "sent"] as const;
    const [openCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(proposals)
          .where(and(eq(proposals.organizationId, org), inArray(proposals.status, [...statuses]))),
      ),
      db
        .select({ id: proposals.id, title: proposals.title, status: proposals.status })
        .from(proposals)
        .where(and(eq(proposals.organizationId, org), inArray(proposals.status, [...statuses])))
        .orderBy(desc(proposals.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("open-proposals"),
        openCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.status.replaceAll("_", " "),
          href: `/app/proposals/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("recruiting-delivery"))) {
    const [activeCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(jobs)
          .where(
            and(eq(jobs.organizationId, org), isNull(jobs.archivedAt), inArray(jobs.status, ["open", "search_active"])),
          ),
      ),
      db
        .select({ id: jobs.id, title: jobs.title, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.organizationId, org), isNull(jobs.archivedAt), inArray(jobs.status, ["open", "search_active"])))
        .orderBy(desc(jobs.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("recruiting-delivery"),
        activeCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.status.replaceAll("_", " "),
          href: `/app/jobs/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("military-pipeline"))) {
    const activeCount = await counted(
      db
        .select({ value: count() })
        .from(skillbridgeProfiles)
        .where(
          and(
            eq(skillbridgeProfiles.organizationId, org),
            isNull(skillbridgeProfiles.archivedAt),
            inArray(skillbridgeProfiles.candidateStatus, [...ACTIVE_SKILLBRIDGE_STATUSES]),
          ),
        ),
    );
    widgets.push(emptyWidget(defById("military-pipeline"), activeCount));
  }

  if (canSeeRhythmWidget(principal, defById("project-health"))) {
    const [atRiskCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, org),
              isNull(projects.archivedAt),
              or(eq(projects.status, "at_risk"), eq(projects.health, "at_risk")),
            ),
          ),
      ),
      db
        .select({ id: projects.id, title: projects.name, status: projects.status, health: projects.health })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, org),
            isNull(projects.archivedAt),
            or(eq(projects.status, "at_risk"), eq(projects.health, "at_risk")),
          ),
        )
        .orderBy(desc(projects.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("project-health"),
        atRiskCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: `${row.status.replaceAll("_", " ")} · ${row.health.replaceAll("_", " ")}`,
          href: `/app/projects/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("cash-ar"))) {
    const [collectedRows, arRows] = await Promise.all([
      db
        .select({ value: sql<string>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(eq(payments.organizationId, org)),
      db
        .select({ value: sql<string>`coalesce(sum(${invoices.balanceDue}), 0)` })
        .from(invoices)
        .where(and(eq(invoices.organizationId, org), notInArray(invoices.status, ["paid", "void"]))),
    ]);
    widgets.push(
      emptyWidget(defById("cash-ar"), `${moneyLabel(money(collectedRows))} collected · ${moneyLabel(money(arRows))} AR`),
    );
  }

  if (canSeeRhythmWidget(principal, defById("derived-risks"))) {
    const riskQueries: Array<Promise<number>> = [];
    const exceptions: RhythmException[] = [];

    if (can(principal, "opportunities.read")) {
      riskQueries.push(
        counted(
          db
            .select({ value: count() })
            .from(opportunities)
            .where(
              and(
                eq(opportunities.organizationId, org),
                isNull(opportunities.archivedAt),
                notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
                lt(opportunities.updatedAt, staleBefore),
              ),
            ),
        ),
      );
      const stale = await db
        .select({
          id: opportunities.id,
          title: opportunities.name,
          companyName: companies.name,
        })
        .from(opportunities)
        .innerJoin(companies, eq(opportunities.companyId, companies.id))
        .where(
          and(
            eq(opportunities.organizationId, org),
            isNull(opportunities.archivedAt),
            notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
            lt(opportunities.updatedAt, staleBefore),
          ),
        )
        .orderBy(opportunities.updatedAt)
        .limit(3);
      for (const row of stale) {
        exceptions.push({
          id: row.id,
          title: row.title,
          meta: `Stale opportunity · ${row.companyName}`,
          href: `/app/opportunities/${row.id}`,
        });
      }
    }

    if (can(principal, "projects.read") || can(principal, "deliverables.read")) {
      riskQueries.push(
        counted(
          db
            .select({ value: count() })
            .from(projectDeliverables)
            .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
            .where(
              and(
                eq(projects.organizationId, org),
                lte(projectDeliverables.dueDate, now),
                notInArray(projectDeliverables.status, ["delivered"]),
              ),
            ),
        ),
      );
    }

    if (can(principal, "finance.read")) {
      riskQueries.push(
        counted(
          db
            .select({ value: count() })
            .from(invoices)
            .where(
              and(
                eq(invoices.organizationId, org),
                notInArray(invoices.status, ["paid", "void"]),
                lt(invoices.dueDate, now),
                sql`${invoices.balanceDue}::numeric > 0`,
              ),
            ),
        ),
      );
    }

    if (can(principal, "integrations.read")) {
      riskQueries.push(countFailedIntegrationEvents(org));
      const unhealthy = await counted(
        db
          .select({ value: count() })
          .from(integrationConnections)
          .where(
            and(
              eq(integrationConnections.organizationId, org),
              inArray(integrationConnections.status, ["error", "unhealthy"]),
            ),
          ),
      );
      riskQueries.push(Promise.resolve(unhealthy));
    }

    const parts = await Promise.all(riskQueries);
    const total = parts.reduce((sum, value) => sum + value, 0);
    widgets.push(emptyWidget(defById("derived-risks"), total, exceptions.slice(0, RHYTHM_EXCEPTION_LIMIT)));
  }

  return widgets;
}

async function loadOperationsWidgets(principal: Principal, now: Date): Promise<RhythmWidget[]> {
  const org = principal.organizationId;
  const db = getDb();
  const week4Before = daysAgo(STAFF_WEEK4_ELAPSED_DAYS, now);
  const widgets: RhythmWidget[] = [];

  if (canSeeRhythmWidget(principal, defById("delivery-review"))) {
    const [activeCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(projects)
          .where(and(eq(projects.organizationId, org), isNull(projects.archivedAt), eq(projects.status, "active"))),
      ),
      db
        .select({ id: projects.id, title: projects.name, health: projects.health })
        .from(projects)
        .where(and(eq(projects.organizationId, org), isNull(projects.archivedAt), eq(projects.status, "active")))
        .orderBy(desc(projects.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("delivery-review"),
        activeCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.health.replaceAll("_", " "),
          href: `/app/projects/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("overdue-actions"))) {
    const [overdueDeliverables, overdueTasks, deliverableExceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(projectDeliverables)
          .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
          .where(
            and(
              eq(projects.organizationId, org),
              lte(projectDeliverables.dueDate, now),
              notInArray(projectDeliverables.status, ["delivered"]),
            ),
          ),
      ),
      counted(
        db
          .select({ value: count() })
          .from(projectTasks)
          .innerJoin(projectPhases, eq(projectTasks.phaseId, projectPhases.id))
          .innerJoin(projects, eq(projectPhases.projectId, projects.id))
          .where(
            and(
              eq(projects.organizationId, org),
              lte(projectTasks.dueDate, now),
              notInArray(projectTasks.status, ["completed", "cancelled"]),
            ),
          ),
      ),
      db
        .select({
          id: projectDeliverables.id,
          title: projectDeliverables.name,
          projectId: projects.id,
          dueDate: projectDeliverables.dueDate,
        })
        .from(projectDeliverables)
        .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
        .where(
          and(
            eq(projects.organizationId, org),
            lte(projectDeliverables.dueDate, now),
            notInArray(projectDeliverables.status, ["delivered"]),
          ),
        )
        .orderBy(projectDeliverables.dueDate)
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("overdue-actions"),
        overdueDeliverables + overdueTasks,
        deliverableExceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.dueDate ? `Due ${row.dueDate.toISOString().slice(0, 10)}` : "Due date on file",
          href: `/app/projects/${row.projectId}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("staffing"))) {
    const [openCount, overdueCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(staffOnboarding)
          .where(and(eq(staffOnboarding.organizationId, org), not(eq(staffOnboarding.cadence, "complete")))),
      ),
      counted(
        db
          .select({ value: count() })
          .from(staffOnboarding)
          .where(
            and(
              eq(staffOnboarding.organizationId, org),
              not(eq(staffOnboarding.cadence, "complete")),
              lt(staffOnboarding.startedAt, week4Before),
            ),
          ),
      ),
      db
        .select({
          id: staffOnboarding.id,
          userId: users.id,
          title: users.fullName,
          cadence: staffOnboarding.cadence,
        })
        .from(staffOnboarding)
        .innerJoin(users, eq(staffOnboarding.userId, users.id))
        .where(
          and(
            eq(staffOnboarding.organizationId, org),
            not(eq(staffOnboarding.cadence, "complete")),
            lt(staffOnboarding.startedAt, week4Before),
          ),
        )
        .orderBy(staffOnboarding.startedAt)
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("staffing"),
        `${openCount} open · ${overdueCount} past Week 4 window`,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.cadence.replaceAll("_", " "),
          href: `/app/admin/users/${row.userId}/onboarding`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("contracts"))) {
    const pendingStatuses = ["draft", "internal_review", "client_review", "sent_for_signature"] as const;
    const [pendingCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(contracts)
          .where(and(eq(contracts.organizationId, org), inArray(contracts.status, [...pendingStatuses]))),
      ),
      db
        .select({ id: contracts.id, title: contracts.title, status: contracts.status })
        .from(contracts)
        .where(and(eq(contracts.organizationId, org), inArray(contracts.status, [...pendingStatuses])))
        .orderBy(desc(contracts.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("contracts"),
        pendingCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.status.replaceAll("_", " "),
          href: `/app/contracts/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("commitments"))) {
    const [openCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(projectDeliverables)
          .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
          .where(
            and(
              eq(projects.organizationId, org),
              notInArray(projectDeliverables.status, ["delivered"]),
              sql`${projectDeliverables.dueDate} is not null`,
            ),
          ),
      ),
      db
        .select({
          id: projectDeliverables.id,
          title: projectDeliverables.name,
          projectId: projects.id,
          dueDate: projectDeliverables.dueDate,
        })
        .from(projectDeliverables)
        .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
        .where(
          and(
            eq(projects.organizationId, org),
            notInArray(projectDeliverables.status, ["delivered"]),
            sql`${projectDeliverables.dueDate} is not null`,
          ),
        )
        .orderBy(projectDeliverables.dueDate)
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("commitments"),
        openCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.dueDate ? `Due ${row.dueDate.toISOString().slice(0, 10)}` : "Due date on file",
          href: `/app/projects/${row.projectId}`,
        })),
      ),
    );
  }

  return widgets;
}

async function loadTalentWidgets(principal: Principal, now: Date): Promise<RhythmWidget[]> {
  const org = principal.organizationId;
  const db = getDb();
  const jobStaleBefore = daysAgo(STALE_RECORD_DAYS, now);
  const candidateAgingBefore = daysAgo(CANDIDATE_AGING_DAYS, now);
  const widgets: RhythmWidget[] = [];

  if (canSeeRhythmWidget(principal, defById("jobs"))) {
    widgets.push(
      emptyWidget(
        defById("jobs"),
        await counted(
          db
            .select({ value: count() })
            .from(jobs)
            .where(
              and(eq(jobs.organizationId, org), isNull(jobs.archivedAt), inArray(jobs.status, ["open", "search_active"])),
            ),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("candidates"))) {
    widgets.push(
      emptyWidget(
        defById("candidates"),
        await counted(
          db
            .select({ value: count() })
            .from(candidates)
            .where(and(eq(candidates.organizationId, org), isNull(candidates.archivedAt), isNull(candidates.privacyDeletedAt))),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("submissions"))) {
    widgets.push(
      emptyWidget(
        defById("submissions"),
        await counted(
          db
            .select({ value: count() })
            .from(submissions)
            .innerJoin(jobs, eq(submissions.jobId, jobs.id))
            .where(eq(jobs.organizationId, org)),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("interviews"))) {
    widgets.push(
      emptyWidget(
        defById("interviews"),
        await counted(
          db
            .select({ value: count() })
            .from(interviews)
            .innerJoin(jobs, eq(interviews.jobId, jobs.id))
            .where(and(eq(jobs.organizationId, org), eq(interviews.status, "scheduled"))),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("aging"))) {
    const agingParts: number[] = [];
    const exceptions: RhythmException[] = [];
    if (can(principal, "jobs.read")) {
      agingParts.push(
        await counted(
          db
            .select({ value: count() })
            .from(jobs)
            .where(
              and(
                eq(jobs.organizationId, org),
                isNull(jobs.archivedAt),
                inArray(jobs.status, ["open", "search_active"]),
                sql`coalesce(${jobs.lastActivityAt}, ${jobs.updatedAt}) < ${jobStaleBefore}`,
              ),
            ),
        ),
      );
      const agingJobs = await db
        .select({ id: jobs.id, title: jobs.title })
        .from(jobs)
        .where(
          and(
            eq(jobs.organizationId, org),
            isNull(jobs.archivedAt),
            inArray(jobs.status, ["open", "search_active"]),
            sql`coalesce(${jobs.lastActivityAt}, ${jobs.updatedAt}) < ${jobStaleBefore}`,
          ),
        )
        .orderBy(jobs.updatedAt)
        .limit(4);
      for (const row of agingJobs) {
        exceptions.push({
          id: row.id,
          title: row.title,
          meta: `${STALE_RECORD_DAYS}-day job aging`,
          href: `/app/jobs/${row.id}`,
        });
      }
    }
    if (can(principal, "candidates.read")) {
      agingParts.push(
        await counted(
          db
            .select({ value: count() })
            .from(candidates)
            .where(
              and(
                eq(candidates.organizationId, org),
                isNull(candidates.archivedAt),
                isNull(candidates.privacyDeletedAt),
                eq(candidates.doNotContact, false),
                or(isNull(candidates.lastContactedAt), lt(candidates.lastContactedAt, candidateAgingBefore)),
              ),
            ),
        ),
      );
    }
    widgets.push(
      emptyWidget(
        defById("aging"),
        agingParts.reduce((sum, value) => sum + value, 0),
        exceptions,
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("placements"))) {
    widgets.push(
      emptyWidget(
        defById("placements"),
        await counted(
          db
            .select({ value: count() })
            .from(placements)
            .innerJoin(jobs, eq(placements.jobId, jobs.id))
            .where(eq(jobs.organizationId, org)),
        ),
      ),
    );
  }

  return widgets;
}

async function loadMilitaryWidgets(principal: Principal, now: Date): Promise<RhythmWidget[]> {
  const org = principal.organizationId;
  const db = getDb();
  const widgets: RhythmWidget[] = [];
  const newSince = daysAgo(NEW_PROFILE_DAYS, now);
  const windowUntil = daysFromNow(SKILLBRIDGE_WINDOW_DAYS, now);
  const activeProfile = and(
    eq(skillbridgeProfiles.organizationId, org),
    isNull(skillbridgeProfiles.archivedAt),
    inArray(skillbridgeProfiles.candidateStatus, [...ACTIVE_SKILLBRIDGE_STATUSES]),
  );
  const unmatchedClause = notExists(
    db
      .select({ id: skillbridgeOpportunities.id })
      .from(skillbridgeOpportunities)
      .where(
        and(
          eq(skillbridgeOpportunities.skillbridgeProfileId, skillbridgeProfiles.id),
          isNull(skillbridgeOpportunities.archivedAt),
          inArray(skillbridgeOpportunities.stage, [...ACTIVE_OPPORTUNITY_STAGES]),
        ),
      ),
  );

  if (canSeeRhythmWidget(principal, defById("new-profiles"))) {
    widgets.push(
      emptyWidget(
        defById("new-profiles"),
        await counted(
          db
            .select({ value: count() })
            .from(skillbridgeProfiles)
            .where(and(eq(skillbridgeProfiles.organizationId, org), isNull(skillbridgeProfiles.archivedAt), gte(skillbridgeProfiles.createdAt, newSince))),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("transition-windows"))) {
    const [windowCount, exceptions] = await Promise.all([
      counted(
        db
          .select({ value: count() })
          .from(skillbridgeProfiles)
          .where(
            and(
              activeProfile,
              gte(skillbridgeProfiles.skillbridgeWindowStart, now),
              lte(skillbridgeProfiles.skillbridgeWindowStart, windowUntil),
            ),
          ),
      ),
      db
        .select({
          id: skillbridgeProfiles.id,
          title: candidates.fullName,
          windowStart: skillbridgeProfiles.skillbridgeWindowStart,
        })
        .from(skillbridgeProfiles)
        .innerJoin(candidates, eq(skillbridgeProfiles.candidateId, candidates.id))
        .where(
          and(
            activeProfile,
            gte(skillbridgeProfiles.skillbridgeWindowStart, now),
            lte(skillbridgeProfiles.skillbridgeWindowStart, windowUntil),
          ),
        )
        .orderBy(skillbridgeProfiles.skillbridgeWindowStart)
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("transition-windows"),
        windowCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.windowStart
            ? `Window ${row.windowStart.toISOString().slice(0, 10)}`
            : "SkillBridge pathway window on file",
          href: `/app/military/skillbridge/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("unmatched-talent"))) {
    const [unmatchedCount, exceptions] = await Promise.all([
      counted(db.select({ value: count() }).from(skillbridgeProfiles).where(and(activeProfile, unmatchedClause))),
      db
        .select({
          id: skillbridgeProfiles.id,
          title: candidates.fullName,
          status: skillbridgeProfiles.candidateStatus,
        })
        .from(skillbridgeProfiles)
        .innerJoin(candidates, eq(skillbridgeProfiles.candidateId, candidates.id))
        .where(and(activeProfile, unmatchedClause))
        .orderBy(desc(skillbridgeProfiles.updatedAt))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("unmatched-talent"),
        unmatchedCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.status.replaceAll("_", " "),
          href: `/app/military/skillbridge/${row.id}`,
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("employer-opportunities"))) {
    widgets.push(
      emptyWidget(
        defById("employer-opportunities"),
        await counted(
          db
            .select({ value: count() })
            .from(skillbridgeOpportunities)
            .where(
              and(
                eq(skillbridgeOpportunities.organizationId, org),
                isNull(skillbridgeOpportunities.archivedAt),
                notInArray(skillbridgeOpportunities.stage, [...TERMINAL_OPPORTUNITY_STAGES]),
              ),
            ),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("military-interviews"))) {
    widgets.push(
      emptyWidget(
        defById("military-interviews"),
        await counted(
          db
            .select({ value: count() })
            .from(interviews)
            .innerJoin(skillbridgeProfiles, eq(skillbridgeProfiles.candidateId, interviews.candidateId))
            .where(
              and(
                eq(skillbridgeProfiles.organizationId, org),
                isNull(skillbridgeProfiles.archivedAt),
                eq(interviews.status, "scheduled"),
              ),
            ),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("military-placements"))) {
    widgets.push(
      emptyWidget(
        defById("military-placements"),
        await counted(
          db
            .select({ value: count() })
            .from(placements)
            .innerJoin(skillbridgeProfiles, eq(skillbridgeProfiles.candidateId, placements.candidateId))
            .where(and(eq(skillbridgeProfiles.organizationId, org), isNull(skillbridgeProfiles.archivedAt))),
        ),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("conversions"))) {
    widgets.push(
      emptyWidget(
        defById("conversions"),
        await counted(
          db
            .select({ value: count() })
            .from(skillbridgeProfiles)
            .where(
              and(
                eq(skillbridgeProfiles.organizationId, org),
                isNull(skillbridgeProfiles.archivedAt),
                eq(skillbridgeProfiles.candidateStatus, "conversion_pending"),
              ),
            ),
        ),
      ),
    );
  }

  return widgets;
}

async function loadFinanceWidgets(principal: Principal, now: Date): Promise<RhythmWidget[]> {
  const org = principal.organizationId;
  const db = getDb();
  const widgets: RhythmWidget[] = [];

  if (canSeeRhythmWidget(principal, defById("invoices"))) {
    const [invoiceCount, exceptions] = await Promise.all([
      counted(db.select({ value: count() }).from(invoices).where(eq(invoices.organizationId, org))),
      db
        .select({
          id: invoices.id,
          title: invoices.invoiceNumber,
          companyName: companies.name,
          status: invoices.status,
        })
        .from(invoices)
        .innerJoin(companies, eq(invoices.companyId, companies.id))
        .where(eq(invoices.organizationId, org))
        .orderBy(desc(invoices.issuedDate))
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("invoices"),
        invoiceCount,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: `${row.companyName} · ${row.status.replaceAll("_", " ")}`,
          href: "/app/finance/invoices",
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("ar-aging"))) {
    const [openAr, pastDueCount, exceptions] = await Promise.all([
      db
        .select({ value: sql<string>`coalesce(sum(${invoices.balanceDue}), 0)` })
        .from(invoices)
        .where(and(eq(invoices.organizationId, org), notInArray(invoices.status, ["paid", "void"]))),
      counted(
        db
          .select({ value: count() })
          .from(invoices)
          .where(
            and(
              eq(invoices.organizationId, org),
              notInArray(invoices.status, ["paid", "void"]),
              lt(invoices.dueDate, now),
              sql`${invoices.balanceDue}::numeric > 0`,
            ),
          ),
      ),
      db
        .select({
          id: invoices.id,
          title: invoices.invoiceNumber,
          companyName: companies.name,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .innerJoin(companies, eq(invoices.companyId, companies.id))
        .where(
          and(
            eq(invoices.organizationId, org),
            notInArray(invoices.status, ["paid", "void"]),
            lt(invoices.dueDate, now),
            sql`${invoices.balanceDue}::numeric > 0`,
          ),
        )
        .orderBy(invoices.dueDate)
        .limit(RHYTHM_EXCEPTION_LIMIT),
    ]);
    widgets.push(
      emptyWidget(
        defById("ar-aging"),
        `${moneyLabel(money(openAr))} open · ${pastDueCount} past due`,
        exceptions.map((row) => ({
          id: row.id,
          title: row.title,
          meta: `${row.companyName}${row.dueDate ? ` · due ${row.dueDate.toISOString().slice(0, 10)}` : ""}`,
          href: "/app/finance/ar",
        })),
      ),
    );
  }

  if (canSeeRhythmWidget(principal, defById("cash-received"))) {
    const collected = await db
      .select({ value: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(eq(payments.organizationId, org));
    widgets.push(emptyWidget(defById("cash-received"), moneyLabel(money(collected))));
  }

  if (canSeeRhythmWidget(principal, defById("expected-revenue"))) {
    const expected = await db
      .select({ value: sql<string>`coalesce(sum(${revenueEvents.amount}), 0)` })
      .from(revenueEvents)
      .where(and(eq(revenueEvents.organizationId, org), eq(revenueEvents.status, "expected")));
    widgets.push(emptyWidget(defById("expected-revenue"), moneyLabel(money(expected))));
  }

  return widgets;
}

export function formatScoutExecutiveSummary(boards: RhythmBoard[]) {
  if (boards.length === 0) {
    return {
      message:
        "No Command Center cadence counts are visible with your access. Title is not access. Ask an administrator to assign a bundle.",
      links: [{ href: "/app", label: "Command Center" }],
    };
  }

  const lines = boards.map((board) => {
    const parts = board.widgets.map((widget) => `${widget.question.replace(/\?$/, "")}: ${widget.value}`).join("; ");
    return `${board.title}: ${parts || "no authorized widgets"}.`;
  });

  return {
    message: `${lines.join(" ")} These are live PostgreSQL aggregates the operator can already read. Scout did not invent metrics or approve decisions.`,
    links: [
      { href: "/app", label: "Command Center" },
      ...boards.map((board) => ({ href: `/app?cadence=${board.id}`, label: `${board.title} review` })),
    ],
  };
}

export async function scoutOperatingRhythmSummary(principal: Principal) {
  if (!can(principal, "scout.use")) {
    throw new Error("Missing permission: scout.use");
  }
  const { boards } = await getOperatingRhythmBoards(principal);
  const summary = formatScoutExecutiveSummary(boards);
  return {
    message: summary.message,
    cards: boards.flatMap((board) =>
      board.widgets.map((widget) => ({
        type: "record" as const,
        id: widget.id,
        title: widget.question,
        href: widget.href,
        meta: String(widget.value),
        fields: { cadence: board.id, provenance: widget.provenance },
      })),
    ),
    confirmation: null,
    draft: null,
    links: summary.links,
  };
}
