import { addBusinessDays } from "../recruiting/engagement-policy";
import { listCandidateOpportunityMatches, listJobTalentMatches } from "../recruiting/opportunity-matching";
import { listEngagementQueue, setEngagementFollowUp } from "../recruiting/opportunity-engagement";
import { opportunityContextLabel } from "../recruiting/opportunity-match";
import { can, type Principal } from "../rbac/permissions";
import { loadWorkforcePortfolio, loadWorkforceRolePipeline } from "../workforce/pipeline-supply";
import type { ScoutCommandDto } from "./parse-intent";
import { stripScoutPii } from "./pii";
import {
  formatMilitarySupply,
  formatWhyMatch,
  labelPublicOpportunity,
  operationalCommand,
  SCOUT_RESULT_LIMIT,
  type OperationalCommandId,
} from "./operational-commands";
import {
  jobsNeedingRequirementReview,
  listCrmPursuits,
  recentPublicJobs,
  resolveByName,
  searchCandidatesByCapability,
  strongMatchesWithoutEngagement,
  transitioningWithoutWorkflow,
} from "./operational-queries";
import type { ScoutResultCard } from "./search";

export type OperationalTurn = {
  message: string;
  cards: ScoutResultCard[];
  confirmation: null;
  draft: null;
  links: Array<{ href: string; label: string }>;
};

type Named = { id: string; label: string; href: string; contextType?: string };

export type OperationalPorts = {
  searchBySkill: typeof searchCandidatesByCapability;
  withoutWorkflow: typeof transitioningWithoutWorkflow;
  resolve: typeof resolveByName;
  recentPublic: typeof recentPublicJobs;
  strongWithoutEngagement: typeof strongMatchesWithoutEngagement;
  requirementReview: typeof jobsNeedingRequirementReview;
  crm: typeof listCrmPursuits;
  candidateMatches: typeof listCandidateOpportunityMatches;
  jobMatches: typeof listJobTalentMatches;
  queue: typeof listEngagementQueue;
  portfolio: typeof loadWorkforcePortfolio;
  rolePipeline: typeof loadWorkforceRolePipeline;
  setFollowUp: typeof setEngagementFollowUp;
};

const defaultPorts: OperationalPorts = {
  searchBySkill: searchCandidatesByCapability,
  withoutWorkflow: transitioningWithoutWorkflow,
  resolve: resolveByName,
  recentPublic: recentPublicJobs,
  strongWithoutEngagement: strongMatchesWithoutEngagement,
  requirementReview: jobsNeedingRequirementReview,
  crm: listCrmPursuits,
  candidateMatches: listCandidateOpportunityMatches,
  jobMatches: listJobTalentMatches,
  queue: listEngagementQueue,
  portfolio: loadWorkforcePortfolio,
  rolePipeline: loadWorkforceRolePipeline,
  setFollowUp: setEngagementFollowUp,
};

function empty(message: string, links: OperationalTurn["links"] = []): OperationalTurn {
  return { message, cards: [], confirmation: null, draft: null, links };
}

function card(input: ScoutResultCard): ScoutResultCard {
  return input;
}

function designation(contextType: string) {
  return labelPublicOpportunity(contextType) ?? opportunityContextLabel(contextType);
}

function choose(rows: Named[], noun: string): { one: Named } | { message: string; links: OperationalTurn["links"] } {
  if (rows.length === 0) return { message: `No ${noun} matched that name in this organization.`, links: [] };
  if (rows.length > 1) {
    return {
      message: `Several ${noun} records match. Scout will not guess. Pick one.`,
      links: rows.map((row) => ({ href: row.href, label: row.label })),
    };
  }
  return { one: rows[0]! };
}

export async function executeOperationalScoutCommand(input: {
  principal: Principal;
  dto: ScoutCommandDto;
  confirmed?: boolean;
  now?: Date;
  ports?: Partial<OperationalPorts>;
}): Promise<OperationalTurn> {
  const commandId = input.dto.commandId;
  if (!commandId || !operationalCommand(commandId)) {
    return empty(`Command ${commandId ?? "(missing)"} is not in the Scout registry.`);
  }
  const definition = operationalCommand(commandId)!;
  for (const permission of definition.permissions) {
    if (!can(input.principal, permission)) {
      return empty(`Command rejected. Missing permission: ${permission}`);
    }
  }
  if (definition.confirm && input.confirmed !== true) {
    return empty("Command rejected. This internal change needs explicit confirmation before Scout calls the canonical service.");
  }

  const ports = { ...defaultPorts, ...input.ports };
  const now = input.now ?? new Date();
  const asOf = now.toISOString();
  const org = input.principal.organizationId;
  const canPii = can(input.principal, "candidate_pii.read");
  const canNames = can(input.principal, "candidates.read");
  const result = await dispatch({ commandId: definition.id, principal: input.principal, dto: input.dto, ports, now, asOf, org, canNames });
  return stripScoutPii(result, canPii);
}

async function dispatch(input: {
  commandId: OperationalCommandId;
  principal: Principal;
  dto: ScoutCommandDto;
  ports: OperationalPorts;
  now: Date;
  asOf: string;
  org: string;
  canNames: boolean;
}): Promise<OperationalTurn> {
  const { commandId, dto, ports, org, asOf, now } = input;
  if (commandId === "ops.m6_handoff") {
    return empty(
      "Scout cannot email an employer, email a candidate, route a candidate, mark a message sent, submit a candidate, or send an interview invitation. Open the engagement and use the existing confirmation.",
      [{ href: "/app/jobs/engagements", label: "Open follow-ups" }],
    );
  }
  if (commandId === "ops.set_follow_up") {
    if (!dto.engagementId) {
      return empty("Choose one engagement before setting a follow-up. Scout will not guess.", [
        { href: "/app/jobs/engagements", label: "Open follow-ups" },
      ]);
    }
    const when = dto.followUpAt ? new Date(dto.followUpAt) : addBusinessDays(now, 3);
    await ports.setFollowUp({
      organizationId: org,
      actorUserId: input.principal.id,
      engagementId: dto.engagementId,
      nextFollowUpAt: when,
      nextAction: "Scout follow-up",
    });
    return empty(`Stored fact: follow-up set through setEngagementFollowUp for ${when.toISOString()}. The engagement audit records the change.`, [
      { href: `/app/jobs/engagements/${dto.engagementId}`, label: "Open engagement" },
    ]);
  }
  if (commandId === "talent.by_capability") {
    const rows = await ports.searchBySkill(org, dto.skill ?? dto.filters?.skill ?? "");
    return listTurn(
      `Stored fact as of ${asOf}. Eligible capabilities only. Showing ${Math.min(rows.length, SCOUT_RESULT_LIMIT)}.`,
      rows.map((row) => card({
        type: "candidate",
        id: row.id,
        title: row.name,
        href: `/app/talent/${row.id}`,
        meta: row.skill,
        fields: { email: (row as { email?: string | null }).email ?? null, phone: (row as { phone?: string | null }).phone ?? null },
      })),
    );
  }
  if (commandId === "talent.without_workflow") {
    const rows = await ports.withoutWorkflow(org);
    return listTurn(
      `Stored fact as of ${asOf}. Transition Talent Profiles with no open engagement. These are Talent Network candidates, not a second identity.`,
      rows.map((row) => card({
        type: "candidate",
        id: row.id,
        title: row.name,
        href: `/app/talent/${row.id}`,
        meta: "No active opportunity workflow",
        fields: {},
      })),
    );
  }
  if (commandId === "talent.waiting_over_days" || commandId.startsWith("ops.")) {
    const queue = await ports.queue(org, null, now);
    const days = dto.waitingDays ?? 5;
    const rows = queue.filter((row) => {
      if (commandId === "talent.waiting_over_days") return row.agingDays > days;
      if (commandId === "ops.overdue_follow_ups") return row.buckets.includes("overdue");
      if (commandId === "ops.waiting_on_employer") return row.waitingOn === "employer";
      if (commandId === "ops.waiting_on_candidate") return row.waitingOn === "candidate";
      if (commandId === "ops.referrals_need_routing") return row.buckets.includes("referral_needs_routing");
      if (commandId === "ops.no_fit_needs_path") return row.buckets.includes("no_fit_needs_decision");
      if (commandId === "ops.interviews_need_next") return row.buckets.includes("interview_next");
      return false;
    }).slice(0, SCOUT_RESULT_LIMIT);
    const label = commandId === "talent.waiting_over_days"
      ? `Stored M6 timestamps as of ${asOf}. Aging is last activity, and the threshold is more than ${days} days.`
      : `Stored M6 engagement state as of ${asOf}.`;
    return listTurn(rows.length ? label : `${label} No rows matched.`, rows.map((row) => card({
      type: "record",
      id: row.id,
      title: input.canNames ? `${row.candidateName} · ${row.jobTitle}` : row.jobTitle,
      href: `/app/jobs/engagements/${row.id}`,
      meta: `${row.publicLabel ?? row.contextLabel} · aging ${row.agingDays} days`,
      fields: {},
    })));
  }
  if (commandId === "match.explain" || commandId === "match.candidate_opportunities") {
    const found = choose(await ports.resolve(org, "candidate", dto.subjectName ?? dto.candidateId ?? ""), "candidate");
    if (!("one" in found)) return empty(found.message, found.links);
    if (!dto.subjectName && dto.candidateId) {
      found.one = { id: dto.candidateId, label: found.one.label, href: `/app/talent/${dto.candidateId}` };
    }
    const matches = await ports.candidateMatches(org, dto.candidateId && !dto.subjectName ? dto.candidateId : found.one.id);
    if (commandId === "match.explain") {
      const jobName = (dto.objectName ?? "").toLowerCase();
      const cardMatch = matches.find((row) => row.jobTitle.toLowerCase() === jobName)
        ?? matches.find((row) => row.jobTitle.toLowerCase().includes(jobName));
      const ambiguous = matches.filter((row) => row.jobTitle.toLowerCase().includes(jobName));
      if (!cardMatch || (ambiguous.length > 1 && !ambiguous.some((row) => row.jobTitle.toLowerCase() === jobName))) {
        if (ambiguous.length > 1) {
          return empty("Several jobs match that title. Scout will not guess.", ambiguous.slice(0, 5).map((row) => ({
            href: `/app/jobs/${row.jobId}`,
            label: `${row.jobTitle} · ${row.contextLabel}`,
          })));
        }
      }
      return empty(formatWhyMatch(cardMatch ? {
        categoryLabel: cardMatch.categoryLabel,
        aligned: cardMatch.aligned,
        gaps: cardMatch.gaps,
        evidence: cardMatch.evidence,
        freshness: cardMatch.freshness,
        explanation: cardMatch.explanation,
        contextLabel: cardMatch.contextLabel,
        lastEvaluatedAt: cardMatch.lastEvaluatedAt,
        timing: cardMatch.military?.timing ?? null,
        href: `/app/jobs/${cardMatch.jobId}`,
      } : null, asOf), cardMatch ? [{ href: `/app/talent/${cardMatch.candidateId}`, label: "Open candidate" }, { href: `/app/jobs/${cardMatch.jobId}`, label: "Open job" }] : []);
    }
    return listTurn(
      `Stored M5 matches as of ${asOf}. Current jobs only. No new Scout score.`,
      matches.slice(0, SCOUT_RESULT_LIMIT).map((row) => card({
        type: "job",
        id: row.jobId,
        title: row.jobTitle,
        href: `/app/jobs/${row.jobId}`,
        meta: `${row.categoryLabel} · ${row.contextLabel}`,
        fields: {},
      })),
    );
  }
  if (commandId === "match.job_candidates") {
    const found = dto.jobId
      ? { one: { id: dto.jobId, label: dto.objectName ?? "Job", href: `/app/jobs/${dto.jobId}` } }
      : choose(await ports.resolve(org, "job", dto.objectName ?? ""), "job");
    if (!("one" in found)) return empty(found.message, found.links);
    const matches = await ports.jobMatches(org, found.one.id);
    return listTurn(
      `Stored M5 talent as of ${asOf}. Recommendations only. Scout does not submit or reject.`,
      matches.slice(0, SCOUT_RESULT_LIMIT).map((row) => card({
        type: "candidate",
        id: row.candidateId,
        title: input.canNames ? row.candidateName : "Candidate",
        href: `/app/talent/${row.candidateId}`,
        meta: `${row.categoryLabel} · ${row.contextLabel}`,
        fields: {},
      })),
    );
  }
  if (commandId === "demand.recent_public") {
    const rows = await ports.recentPublic(org, now);
    return listTurn(
      `Stored fact as of ${asOf}. These are public opportunities discovered onto jobs. They are not CRM pursuits and not an employer relationship.`,
      rows.map((row) => card({
        type: "job",
        id: row.id,
        title: row.title,
        href: `/app/jobs/${row.id}`,
        meta: `${designation(row.contextType)} · discovered ${row.createdAt.toISOString()}`,
        fields: {},
      })),
    );
  }
  if (commandId === "demand.strong_without_engagement") {
    const rows = await ports.strongWithoutEngagement(org);
    return listTurn(
      `Stored M5 strong matches as of ${asOf} with no open engagement.`,
      rows.map((row) => card({
        type: "record",
        id: row.matchId,
        title: input.canNames ? `${row.candidateName} · ${row.jobTitle}` : row.jobTitle,
        href: `/app/jobs/${row.jobId}`,
        meta: designation(row.contextType),
        fields: {},
      })),
    );
  }
  if (commandId === "demand.requirement_review") {
    const rows = await ports.requirementReview(org);
    return listTurn(
      `Stored fact as of ${asOf}. Jobs with pending requirement review.`,
      rows.map((row) => card({
        type: "job",
        id: row.id,
        title: row.title,
        href: `/app/jobs/${row.id}`,
        meta: designation(row.contextType),
        fields: {},
      })),
      [{ href: "/app/jobs?requirements=review", label: "Open jobs needing review" }],
    );
  }
  if (commandId === "demand.crm_pursuits") {
    const rows = await ports.crm(org);
    return listTurn(
      `Stored fact as of ${asOf}. CRM opportunities are Pier24 commercial pursuits. Jobs are employer demand. These records are not jobs.`,
      rows.map((row) => card({
        type: "opportunity",
        id: row.id,
        title: row.name,
        href: `/app/opportunities/${row.id}`,
        meta: "CRM pursuit",
        fields: {},
      })),
    );
  }
  if (commandId === "workforce.largest_gaps" || commandId === "workforce.critical_roles" || commandId === "workforce.scarce_capabilities") {
    const portfolio = await ports.portfolio(org, now);
    const roles = [...portfolio.roles].sort((left, right) => right.quantityGap - left.quantityGap);
    const selected = commandId === "workforce.critical_roles"
      ? roles.filter((role) => role.health === "critical")
      : commandId === "workforce.scarce_capabilities"
        ? roles.filter((role) => role.health === "gap" || role.health === "critical")
        : roles.filter((role) => role.quantityGap > 0);
    return listTurn(
      `Derived WorkforceOS calculation as of ${portfolio.calculatedAt}. Known supply counts stored people. Occupation channels are not included.`,
      selected.slice(0, SCOUT_RESULT_LIMIT).map((role) => card({
        type: "record",
        id: role.id,
        title: role.title,
        href: `/app/workforce/roles/${role.id}`,
        meta: `${role.health} · gap ${role.quantityGap} · known supply ${role.knownSupply}`,
        fields: {},
      })),
    );
  }
  const roleId = dto.workforceRoleId;
  const named = roleId
    ? { one: { id: roleId, label: dto.subjectName ?? "Workforce role", href: `/app/workforce/roles/${roleId}` } }
    : choose(await ports.resolve(org, "workforce_role", dto.subjectName ?? ""), "workforce role");
  if (!("one" in named)) return empty(named.message || "Name the workforce role. Scout will not guess.", named.links);
  const pipeline = await ports.rolePipeline({
    organizationId: org,
    roleId: named.one.id,
    calculatedAt: now,
    includeCandidateDetail: input.canNames,
    includePii: false,
  });
  const analysis = pipeline.analysis;
  return empty(formatMilitarySupply({
    knownSupply: analysis.knownSupply,
    militarySupply: analysis.militarySupply,
    nonMilitarySupply: analysis.nonMilitarySupply,
    channels: analysis.militaryChannels.map((row) => ({ code: row.code, title: row.title })),
    asOf: analysis.calculatedAt,
    roleTitle: pipeline.role.title,
  }), [{ href: `/app/workforce/roles/${named.one.id}`, label: "Open workforce role" }]);
}

function listTurn(message: string, cards: ScoutResultCard[], links: OperationalTurn["links"] = []): OperationalTurn {
  const bounded = cards.slice(0, SCOUT_RESULT_LIMIT);
  const suffix = cards.length > SCOUT_RESULT_LIMIT ? ` Showing ${SCOUT_RESULT_LIMIT}. Narrow the question for more.` : "";
  return { message: `${message}${suffix}`, cards: bounded, confirmation: null, draft: null, links };
}
