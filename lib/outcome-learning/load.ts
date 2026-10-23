import { sql } from "drizzle-orm";

import { getDb } from "../../db";
import { analyzeOutcomes, type FactorCountRow, type OutcomeAnalysis, type WorkforceRoleSnapshot } from "./analyze";
import { SELECTION_BIAS_CAVEAT } from "./thresholds";
import {
  CONTEXT_BUCKETS,
  NORMALIZED_OUTCOMES,
  PROGRAM_BUCKETS,
  type ContextBucket,
  type NormalizedOutcome,
  type ProgramBucket,
} from "./vocabulary";
import { parseOutcomeWindow, windowBounds, type OutcomeWindow } from "./windows";

const OUTCOME_SQL = sql.raw(`case
  when e.status = 'placed' or e.placement_id is not null then 'placement'
  when e.status = 'interview' or e.interview_id is not null or e.interview_status in ('requested', 'scheduled', 'completed') then 'interview'
  when e.employer_response = 'interested' or e.status = 'interested' then 'employer_interested'
  when e.employer_response = 'refer_to_another_manager' or e.status = 'referred' then 'referred'
  when e.employer_response = 'not_a_fit' or e.status = 'no_fit' then 'employer_not_a_fit'
  when e.candidate_response = 'declined' then 'candidate_declined'
  when m.recruiter_disposition = 'not_viable' and e.id is null then 'recruiter_not_viable'
  when e.status = 'withdrawn' then 'candidate_withdrew'
  when e.employer_response = 'no_response' then 'no_response'
  when e.employer_response = 'possible_future_fit' then 'possible_future_fit'
  when e.employer_response = 'needs_more_information' or e.candidate_response = 'needs_information' or e.status = 'needs_information' then 'needs_information'
  when e.status = 'closed' then 'workflow_closed'
  when e.id is not null then 'in_progress'
  else 'no_engagement'
end`);

const CONTEXT_SQL = sql.raw(`case
  when e.mode = 'public_outreach' or (e.mode is null and j.job_context_type in ('monitored_public', 'exploratory')) then 'public_outreach'
  when e.mode = 'authorized_routing' or (e.mode is null and j.job_context_type in ('client', 'internal', 'skillbridge')) then 'client_routing'
  else 'unspecified'
end`);

const PROGRAM_SQL = sql.raw(`case
  when c.military_status in ('veteran', 'active_duty', 'reserve', 'national_guard') then 'military'
  when c.military_status = 'none' then 'other'
  else 'not_recorded'
end`);

const FAMILY_SQL = sql.raw(`coalesce(
  (
    select jf.name
    from job_requirements jr
    inner join job_families jf on lower(jf.name) = lower(jr.label)
    where jr.job_id = j.id
      and jr.organization_id = m.organization_id
      and jr.kind = 'job_family'
      and jr.review_status = 'approved'
      and jr.archived_at is null
    order by jr.updated_at desc
    limit 1
  ),
  (
    select jr.label
    from job_requirements jr
    where jr.job_id = j.id
      and jr.organization_id = m.organization_id
      and jr.kind = 'job_family'
      and jr.review_status = 'approved'
      and jr.archived_at is null
    order by jr.updated_at desc
    limit 1
  ),
  'No reviewed job family'
)`);

const ACTIVITY_SQL = sql.raw(`coalesce(e.last_activity_at, e.opened_at, m.last_calculated_at, m.updated_at)`);

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isOutcome(value: string): value is NormalizedOutcome {
  return (NORMALIZED_OUTCOMES as readonly string[]).includes(value);
}

function isContext(value: string): value is ContextBucket {
  return (CONTEXT_BUCKETS as readonly string[]).includes(value);
}

function isProgram(value: string): value is ProgramBucket {
  return (PROGRAM_BUCKETS as readonly string[]).includes(value);
}

function windowClause(start: Date | null, end: Date) {
  if (!start) return sql`and ${ACTIVITY_SQL} <= ${end}`;
  return sql`and ${ACTIVITY_SQL} >= ${start} and ${ACTIVITY_SQL} <= ${end}`;
}

async function query(statement: ReturnType<typeof sql>) {
  const db = getDb();
  return rowsOf(await db.execute(statement));
}

export async function loadMatchCounts(organizationId: string, start: Date | null, end: Date, now: Date) {
  const rows = await query(sql`
    select
      m.match_category as match_category,
      ${CONTEXT_SQL} as context,
      ${PROGRAM_SQL} as program,
      ${FAMILY_SQL} as job_family,
      co.id as company_id,
      co.name as company_name,
      ${OUTCOME_SQL} as outcome,
      count(*)::int as matches,
      coalesce(sum(case when e.id is not null then 1 else 0 end), 0)::int as engagements,
      coalesce(sum(case when e.status = 'interview' or e.interview_id is not null or e.interview_status in ('requested', 'scheduled', 'completed') then 1 else 0 end), 0)::int as interviews,
      coalesce(sum(case when e.status = 'placed' or e.placement_id is not null then 1 else 0 end), 0)::int as placements,
      coalesce(sum(case when m.recruiter_disposition is distinct from 'not_viable' then 1 else 0 end), 0)::int as viable,
      coalesce(sum(case when e.employer_response = 'interested' or e.status = 'interested' then 1 else 0 end), 0)::int as interested,
      coalesce(sum(case when e.employer_response is not null then 1 else 0 end), 0)::int as responded,
      coalesce(sum(case when e.next_follow_up_at is not null then 1 else 0 end), 0)::int as follow_up_tracked,
      coalesce(sum(case
        when e.id is not null
          and e.next_follow_up_at is not null
          and e.status not in ('withdrawn', 'placed', 'closed')
          and e.next_follow_up_at < ${now}
          and e.last_activity_at < e.next_follow_up_at
        then 1 else 0 end), 0)::int as follow_up_overdue
    from candidate_job_matches m
    inner join jobs j on j.id = m.job_id and j.organization_id = m.organization_id
    inner join candidates c on c.id = m.candidate_id and c.organization_id = m.organization_id
    left join opportunity_engagements e
      on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
    left join companies co
      on co.id = coalesce(e.company_id, j.company_id) and co.organization_id = m.organization_id
    where m.organization_id = ${organizationId}
      and m.archived_at is null
      and c.privacy_deleted_at is null
      and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
      and (m.freshness = 'current' or e.id is not null)
      ${windowClause(start, end)}
    group by 1, 2, 3, 4, 5, 6, 7
  `);
  return rows.flatMap((row) => {
    const outcome = text(row.outcome);
    const context = text(row.context);
    const program = text(row.program);
    if (!isOutcome(outcome) || !isContext(context) || !isProgram(program)) return [];
    return [{
      matchCategory: text(row.match_category),
      context,
      program,
      jobFamily: text(row.job_family) || "No reviewed job family",
      companyId: text(row.company_id) || null,
      companyName: text(row.company_name) || null,
      outcome,
      matches: num(row.matches),
      engagements: num(row.engagements),
      interviews: num(row.interviews),
      placements: num(row.placements),
      viable: num(row.viable),
      interested: num(row.interested),
      responded: num(row.responded),
      followUpTracked: num(row.follow_up_tracked),
      followUpOverdue: num(row.follow_up_overdue),
    }];
  });
}

export async function loadFactorCounts(organizationId: string, start: Date | null, end: Date): Promise<FactorCountRow[]> {
  const rows = await query(sql`
    select
      f.label as label,
      f.dimension as dimension,
      f.factor_group as factor_group,
      ${OUTCOME_SQL} as outcome,
      ${FAMILY_SQL} as job_family,
      count(distinct m.id)::int as matches
    from candidate_job_match_factors f
    inner join candidate_job_matches m on m.id = f.match_id and m.organization_id = f.organization_id
    inner join jobs j on j.id = m.job_id and j.organization_id = m.organization_id
    inner join candidates c on c.id = m.candidate_id and c.organization_id = m.organization_id
    left join opportunity_engagements e
      on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
    where f.organization_id = ${organizationId}
      and f.archived_at is null
      and f.dimension <> 'compensation'
      and f.factor_group in ('aligned', 'documented_gap')
      and m.archived_at is null
      and c.privacy_deleted_at is null
      and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
      and (m.freshness = 'current' or e.id is not null)
      ${windowClause(start, end)}
    group by 1, 2, 3, 4, 5
  `);
  return rows.flatMap((row) => {
    const outcome = text(row.outcome);
    const group = text(row.factor_group);
    if (!isOutcome(outcome) || (group !== "aligned" && group !== "documented_gap")) return [];
    const narrowed: FactorCountRow["group"] = group;
    return [{
      label: text(row.label),
      dimension: text(row.dimension),
      group: narrowed,
      outcome,
      jobFamily: text(row.job_family) || "No reviewed job family",
      matches: num(row.matches),
    }];
  });
}

export async function loadCapabilityCounts(organizationId: string, start: Date | null, end: Date) {
  const rows = await query(sql`
    select
      s.name as skill_name,
      count(distinct m.id)::int as matches,
      count(distinct e.id)::int as engagements,
      count(distinct m.id) filter (
        where e.status = 'interview' or e.interview_id is not null or e.interview_status in ('requested', 'scheduled', 'completed')
      )::int as interviews,
      count(distinct m.id) filter (where e.status = 'placed' or e.placement_id is not null)::int as placements,
      count(distinct m.id) filter (where e.employer_response = 'not_a_fit' or e.status = 'no_fit')::int as no_fit
    from candidate_skills cs
    inner join skills s on s.id = cs.skill_id
    inner join candidate_job_matches m
      on m.candidate_id = cs.candidate_id and m.organization_id = cs.organization_id
    inner join jobs j on j.id = m.job_id and j.organization_id = m.organization_id
    inner join candidates c on c.id = m.candidate_id and c.organization_id = m.organization_id
    left join opportunity_engagements e
      on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
    where cs.organization_id = ${organizationId}
      and cs.review_status = 'approved'
      and cs.archived_at is null
      and m.archived_at is null
      and c.privacy_deleted_at is null
      and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
      and (m.freshness = 'current' or e.id is not null)
      ${windowClause(start, end)}
    group by s.name
  `);
  return rows.map((row) => ({
    skillName: text(row.skill_name),
    matches: num(row.matches),
    engagements: num(row.engagements),
    interviews: num(row.interviews),
    placements: num(row.placements),
    noFit: num(row.no_fit),
  }));
}

function mappingInWindow(start: Date | null, end: Date) {
  if (!start) {
    return sql`m.id is not null and (m.freshness = 'current' or e.id is not null) and ${ACTIVITY_SQL} <= ${end}`;
  }
  return sql`m.id is not null and (m.freshness = 'current' or e.id is not null) and ${ACTIVITY_SQL} >= ${start} and ${ACTIVITY_SQL} <= ${end}`;
}

export async function loadMappingCounts(organizationId: string, start: Date | null, end: Date) {
  const rows = await query(sql`
    select
      mos.id as mapping_id,
      mo.code as occupation_code,
      mo.title as occupation_title,
      s.name as skill_name,
      mos.review_status as review_status,
      count(distinct person.id)::int as candidates,
      count(distinct m.id) filter (where ${mappingInWindow(start, end)})::int as matches,
      count(distinct m.id) filter (
        where ${mappingInWindow(start, end)}
          and (e.status = 'interview' or e.interview_id is not null or e.interview_status in ('requested', 'scheduled', 'completed'))
      )::int as interviews,
      count(distinct m.id) filter (
        where ${mappingInWindow(start, end)} and (e.status = 'placed' or e.placement_id is not null)
      )::int as placements,
      count(distinct m.id) filter (
        where ${mappingInWindow(start, end)} and (e.employer_response = 'not_a_fit' or e.status = 'no_fit')
      )::int as no_fit
    from military_occupation_skills mos
    inner join military_occupations mo on mo.id = mos.military_occupation_id
    inner join skills s on s.id = mos.skill_id
    inner join candidate_skill_evidence ev
      on ev.military_occupation_skill_id = mos.id and ev.organization_id = ${organizationId}
    inner join candidate_skills cs
      on cs.id = ev.candidate_skill_id
      and cs.organization_id = ev.organization_id
      and cs.review_status = 'approved'
      and cs.archived_at is null
    inner join candidates person
      on person.id = cs.candidate_id
      and person.organization_id = cs.organization_id
      and person.privacy_deleted_at is null
    left join candidate_job_matches m
      on m.candidate_id = cs.candidate_id
      and m.organization_id = cs.organization_id
      and m.archived_at is null
      and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
    left join opportunity_engagements e
      on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
    group by mos.id, mo.code, mo.title, s.name, mos.review_status
  `);
  return rows.map((row) => ({
    mappingId: text(row.mapping_id),
    occupationCode: text(row.occupation_code),
    occupationTitle: text(row.occupation_title),
    skillName: text(row.skill_name),
    reviewStatus: text(row.review_status),
    candidates: num(row.candidates),
    matches: num(row.matches),
    interviews: num(row.interviews),
    placements: num(row.placements),
    noFit: num(row.no_fit),
  })).filter((row) => row.candidates > 0 || row.matches > 0);
}

export async function loadRequirementCounts(organizationId: string, start: Date | null, end: Date, jobId?: string) {
  const jobFilter = jobId ? sql`and jr.job_id = ${jobId}` : sql``;
  const skillJobFilter = jobId ? sql`and js.job_id = ${jobId}` : sql``;
  const rows = await query(sql`
    select * from (
      select
        jr.id as requirement_id,
        jr.job_id as job_id,
        jr.kind as kind,
        jr.label as label,
        jr.review_status as review_status,
        count(distinct m.id) filter (
          where f.factor_group = 'documented_gap' and lower(f.label) = lower(jr.label) and ${OUTCOME_SQL} = 'employer_not_a_fit'
        )::int as gap_no_fit,
        count(distinct m.id) filter (
          where f.factor_group = 'aligned' and lower(f.label) = lower(jr.label) and (e.status = 'placed' or e.placement_id is not null)
        )::int as aligned_placements,
        count(distinct m.id) filter (where ${OUTCOME_SQL} = 'employer_not_a_fit')::int as no_fit_on_job
      from job_requirements jr
      inner join candidate_job_matches m on m.job_id = jr.job_id and m.organization_id = jr.organization_id
      inner join jobs j on j.id = m.job_id and j.organization_id = m.organization_id
      inner join candidates c on c.id = m.candidate_id and c.organization_id = m.organization_id
      left join opportunity_engagements e
        on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
      left join candidate_job_match_factors f
        on f.match_id = m.id and f.organization_id = m.organization_id and f.archived_at is null and f.dimension <> 'compensation'
      where jr.organization_id = ${organizationId}
        and jr.review_status = 'approved'
        and jr.archived_at is null
        and jr.requirement_type = 'required'
        and m.archived_at is null
        and c.privacy_deleted_at is null
        and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
        and (m.freshness = 'current' or e.id is not null)
        ${jobFilter}
        ${windowClause(start, end)}
      group by jr.id, jr.job_id, jr.kind, jr.label, jr.review_status
      union all
      select
        js.id as requirement_id,
        js.job_id as job_id,
        'capability' as kind,
        s.name as label,
        js.review_status as review_status,
        count(distinct m.id) filter (
          where f.factor_group = 'documented_gap' and lower(f.label) = lower(s.name) and ${OUTCOME_SQL} = 'employer_not_a_fit'
        )::int as gap_no_fit,
        count(distinct m.id) filter (
          where f.factor_group = 'aligned' and lower(f.label) = lower(s.name) and (e.status = 'placed' or e.placement_id is not null)
        )::int as aligned_placements,
        count(distinct m.id) filter (where ${OUTCOME_SQL} = 'employer_not_a_fit')::int as no_fit_on_job
      from job_skills js
      inner join skills s on s.id = js.skill_id
      inner join jobs j on j.id = js.job_id and j.organization_id = ${organizationId}
      inner join candidate_job_matches m on m.job_id = js.job_id and m.organization_id = j.organization_id
      inner join candidates c on c.id = m.candidate_id and c.organization_id = m.organization_id
      left join opportunity_engagements e
        on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
      left join candidate_job_match_factors f
        on f.match_id = m.id and f.organization_id = m.organization_id and f.archived_at is null and f.dimension <> 'compensation'
      where js.review_status = 'approved'
        and js.archived_at is null
        and js.requirement_type = 'required'
        and m.archived_at is null
        and c.privacy_deleted_at is null
        and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
        and (m.freshness = 'current' or e.id is not null)
        ${skillJobFilter}
        ${windowClause(start, end)}
      group by js.id, js.job_id, s.name, js.review_status
    ) requirements
  `);
  return rows.map((row) => ({
    requirementId: text(row.requirement_id),
    jobId: text(row.job_id),
    kind: text(row.kind),
    label: text(row.label),
    reviewStatus: text(row.review_status),
    gapNoFit: num(row.gap_no_fit),
    alignedPlacements: num(row.aligned_placements),
    noFitOnJob: num(row.no_fit_on_job),
  }));
}

export async function loadTiming(organizationId: string, start: Date | null, end: Date) {
  const rows = await query(sql`
    select
      ${CONTEXT_SQL} as context,
      co.id as company_id,
      coalesce(sum(extract(epoch from (resp.responded_at - resp.sent_at)) / 3600) filter (where resp.responded_at is not null and resp.sent_at is not null), 0) as response_hours_sum,
      count(*) filter (where resp.responded_at is not null and resp.sent_at is not null)::int as response_samples,
      coalesce(sum(extract(epoch from (e.opened_at - m.last_calculated_at)) / 3600) filter (
        where e.opened_at is not null and m.last_calculated_at is not null and e.opened_at >= m.last_calculated_at
      ), 0) as match_to_engagement_hours_sum,
      count(*) filter (
        where e.opened_at is not null and m.last_calculated_at is not null and e.opened_at >= m.last_calculated_at
      )::int as match_to_engagement_samples,
      coalesce(sum(extract(epoch from (coalesce(i.scheduled_for, i.created_at) - e.opened_at)) / 3600) filter (
        where e.opened_at is not null and coalesce(i.scheduled_for, i.created_at) >= e.opened_at
      ), 0) as engagement_to_interview_hours_sum,
      count(*) filter (
        where e.opened_at is not null and coalesce(i.scheduled_for, i.created_at) >= e.opened_at
      )::int as engagement_to_interview_samples,
      coalesce(sum(extract(epoch from (coalesce(nofit.occurred_at, case when e.status = 'no_fit' then e.updated_at end) - e.opened_at)) / 3600) filter (
        where e.opened_at is not null and coalesce(nofit.occurred_at, case when e.status = 'no_fit' then e.updated_at end) is not null
      ), 0) as no_fit_hours_sum,
      count(*) filter (
        where e.opened_at is not null and coalesce(nofit.occurred_at, case when e.status = 'no_fit' then e.updated_at end) is not null
      )::int as no_fit_samples,
      coalesce(sum(extract(epoch from (coalesce(placed.occurred_at, case when e.status = 'placed' then e.updated_at end) - e.opened_at)) / 3600) filter (
        where e.opened_at is not null and coalesce(placed.occurred_at, case when e.status = 'placed' then e.updated_at end) is not null
      ), 0) as placement_hours_sum,
      count(*) filter (
        where e.opened_at is not null and coalesce(placed.occurred_at, case when e.status = 'placed' then e.updated_at end) is not null
      )::int as placement_samples
    from candidate_job_matches m
    inner join jobs j on j.id = m.job_id and j.organization_id = m.organization_id
    inner join candidates c on c.id = m.candidate_id and c.organization_id = m.organization_id
    inner join opportunity_engagements e
      on e.match_id = m.id and e.organization_id = m.organization_id and e.archived_at is null
    left join companies co on co.id = coalesce(e.company_id, j.company_id) and co.organization_id = m.organization_id
    left join interviews i on i.id = e.interview_id
    left join lateral (
      select r.sent_at, r.responded_at
      from opportunity_engagement_routes r
      where r.engagement_id = e.id and r.organization_id = e.organization_id
        and r.sent_at is not null and r.responded_at is not null
      order by r.responded_at asc
      limit 1
    ) resp on true
    left join lateral (
      select ev.occurred_at
      from opportunity_engagement_events ev
      where ev.engagement_id = e.id and ev.organization_id = e.organization_id and ev.to_status = 'no_fit'
      order by ev.occurred_at asc
      limit 1
    ) nofit on true
    left join lateral (
      select ev.occurred_at
      from opportunity_engagement_events ev
      where ev.engagement_id = e.id and ev.organization_id = e.organization_id and ev.to_status = 'placed'
      order by ev.occurred_at asc
      limit 1
    ) placed on true
    where m.organization_id = ${organizationId}
      and m.archived_at is null
      and c.privacy_deleted_at is null
      and m.match_category in ('strong_match', 'possible_match', 'developmental_match')
      ${windowClause(start, end)}
    group by 1, 2
  `);
  return rows.flatMap((row) => {
    const context = text(row.context);
    if (!isContext(context)) return [];
    return [{
      context,
      companyId: text(row.company_id) || null,
      responseHoursSum: num(row.response_hours_sum),
      responseSamples: num(row.response_samples),
      matchToEngagementHoursSum: num(row.match_to_engagement_hours_sum),
      matchToEngagementSamples: num(row.match_to_engagement_samples),
      engagementToInterviewHoursSum: num(row.engagement_to_interview_hours_sum),
      engagementToInterviewSamples: num(row.engagement_to_interview_samples),
      noFitHoursSum: num(row.no_fit_hours_sum),
      noFitSamples: num(row.no_fit_samples),
      placementHoursSum: num(row.placement_hours_sum),
      placementSamples: num(row.placement_samples),
    }];
  });
}

export type OutcomeReport = OutcomeAnalysis & {
  asOf: string;
  window: OutcomeWindow;
  windowLabel: string;
  windowStart: string | null;
  windowEnd: string;
  caveat: string;
  directQuery: true;
};

export async function loadOutcomeReport(input: {
  organizationId: string;
  window?: OutcomeWindow | string | null;
  now?: Date;
  roles?: WorkforceRoleSnapshot[];
  jobId?: string;
}): Promise<OutcomeReport> {
  const now = input.now ?? new Date();
  const window = parseOutcomeWindow(input.window);
  const bounds = windowBounds(window, now);
  const [matches, factors, capabilities, mappings, requirements, timing] = await Promise.all([
    loadMatchCounts(input.organizationId, bounds.start, bounds.end, now),
    loadFactorCounts(input.organizationId, bounds.start, bounds.end),
    loadCapabilityCounts(input.organizationId, bounds.start, bounds.end),
    loadMappingCounts(input.organizationId, bounds.start, bounds.end),
    loadRequirementCounts(input.organizationId, bounds.start, bounds.end, input.jobId),
    loadTiming(input.organizationId, bounds.start, bounds.end),
  ]);
  const analysis = analyzeOutcomes({
    matches,
    factors,
    capabilities,
    mappings,
    requirements,
    timing,
    roles: input.roles,
    windowLabel: bounds.label,
  });
  return {
    ...analysis,
    asOf: now.toISOString(),
    window,
    windowLabel: bounds.label,
    windowStart: bounds.start?.toISOString() ?? null,
    windowEnd: bounds.end.toISOString(),
    caveat: SELECTION_BIAS_CAVEAT,
    directQuery: true,
  };
}
