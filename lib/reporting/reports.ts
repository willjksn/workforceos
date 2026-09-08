import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";

import { getDb } from "../../db";
import {
  agentRuns,
  candidateDesignations,
  candidateJobMatches,
  candidates,
  careerPaths,
  companies,
  invoices,
  jobs,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupations,
  occupationDataImports,
  opportunities,
  placements,
  projectCloseouts,
  projectIssues,
  projectRisks,
  projects,
  services,
  skillbridgeOpportunities,
  skillbridgeProfiles,
  talentPipelines,
  trainingPrograms,
  workforceAssessments,
  workforceForecasts,
  workforceGaps,
  workforceRecommendations,
  workforceRisks,
  workforceScenarios,
  workforceSupplyEntries,
} from "../../db/schema";
import { usageSummary } from "../ai/cost";
import { CLOSED_OPPORTUNITY_STAGES } from "../crm/stages";
import { financeOverview } from "../finance/engine";
import { parseMoney } from "../finance/money";
import { recruitingAnalytics } from "../repositories/recruiting-delivery";
import { getWorkforceCommandSnapshot } from "../repositories/workforce";
import { recruitingCycleTimes } from "./cycle-time";
import { inDateRange, type ReportCategory, type ReportFilters } from "./filters";

export type ReportMetric = { label: string; value: string | number; hint?: string };
export type ReportRow = { id: string; cells: string[]; href?: string };
export type ReportResult = {
  category: ReportCategory;
  title: string;
  description: string;
  metrics: ReportMetric[];
  columns: string[];
  rows: ReportRow[];
};

function moneyLabel(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function ratioLabel(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function matchCompany(companyId: string | null | undefined, filters: ReportFilters) {
  return !filters.companyId || companyId === filters.companyId;
}

function matchOwner(ownerId: string | null | undefined, filters: ReportFilters) {
  return !filters.ownerUserId || ownerId === filters.ownerUserId;
}

function matchService(code: string | null | undefined, filters: ReportFilters) {
  return !filters.serviceCode || code === filters.serviceCode;
}

export async function runReport(
  organizationId: string,
  category: ReportCategory,
  filters: ReportFilters,
  options: { includePii?: boolean } = {},
): Promise<ReportResult> {
  switch (category) {
    case "business":
    case "finance":
      return businessReport(organizationId, category, filters);
    case "sales":
      return salesReport(organizationId, filters);
    case "recruiting":
      return recruitingReport(organizationId, filters);
    case "talent":
      return talentReport(organizationId, filters, options.includePii === true);
    case "military":
      return militaryReport(organizationId, filters);
    case "workforce":
      return workforceReport(organizationId, filters);
    case "projects":
      return projectsReport(organizationId, filters);
    case "ai":
      return aiReport(organizationId, filters);
    default:
      return businessReport(organizationId, "business", filters);
  }
}

async function businessReport(organizationId: string, category: ReportCategory, filters: ReportFilters) {
  const overview = await financeOverview(organizationId);
  const db = getDb();
  const invoiceRows = await db
    .select({
      invoice: invoices,
      companyName: companies.name,
      serviceName: services.name,
    })
    .from(invoices)
    .innerJoin(companies, eq(invoices.companyId, companies.id))
    .leftJoin(services, eq(invoices.serviceId, services.id))
    .where(eq(invoices.organizationId, organizationId))
    .orderBy(desc(invoices.issuedDate));

  const filtered = invoiceRows.filter(
    (row) =>
      matchCompany(row.invoice.companyId, filters) &&
      matchOwner(row.invoice.ownerUserId, filters) &&
      inDateRange(row.invoice.issuedDate ? new Date(row.invoice.issuedDate) : row.invoice.createdAt, filters),
  );

  const consulting = overview.revenueByService
    .filter((row) => !/search|placement/i.test(row.service))
    .reduce((sum, row) => sum + row.amount, 0);
  const marginEstimate = overview.projectEconomics.reduce((sum, row) => sum + row.grossMarginEstimate, 0);

  return {
    category,
    title: category === "finance" ? "Finance" : "Business",
    description: "Stored invoice, contract, and revenue amounts only. QuickBooks remains the accounting ledger. Margin is collected minus recorded delivery costs, not a general-ledger profit figure.",
    metrics: [
      { label: "Contracted", value: moneyLabel(overview.contractedRevenue) },
      { label: "Invoiced", value: moneyLabel(overview.invoicedRevenue) },
      { label: "Collected", value: moneyLabel(overview.collectedRevenue) },
      { label: "AR outstanding", value: moneyLabel(overview.outstandingAr) },
      { label: "MRR", value: moneyLabel(overview.recurringMonthlyRevenue) },
      { label: "Placement fees expected", value: moneyLabel(overview.placementFeesExpected) },
      { label: "Consulting revenue", value: moneyLabel(consulting) },
      { label: "Margin estimate", value: moneyLabel(marginEstimate), hint: "Collected minus recorded delivery costs" },
      { label: "Clients with invoices", value: overview.revenueByClient.length },
      { label: "Services with revenue", value: overview.revenueByService.length },
    ],
    columns: ["Client", "Invoice", "Amount", "Balance", "Status"],
    rows: filtered.slice(0, 100).map((row) => ({
      id: row.invoice.id,
      href: "/app/finance/invoices",
      cells: [
        row.companyName,
        row.invoice.invoiceNumber,
        moneyLabel(parseMoney(row.invoice.amount) ?? 0),
        moneyLabel(parseMoney(row.invoice.balanceDue) ?? 0),
        row.invoice.status,
      ],
    })),
  };
}

async function salesReport(organizationId: string, filters: ReportFilters) {
  const db = getDb();
  const rows = await db
    .select({ opportunity: opportunities, companyName: companies.name })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .where(and(eq(opportunities.organizationId, organizationId), isNull(opportunities.archivedAt)))
    .orderBy(desc(opportunities.updatedAt));
  const filtered = rows.filter(
    (row) =>
      matchCompany(row.opportunity.companyId, filters) &&
      matchOwner(row.opportunity.ownerUserId, filters) &&
      matchService(row.opportunity.serviceCode, filters) &&
      inDateRange(row.opportunity.createdAt, filters),
  );
  const open = filtered.filter((row) => !(CLOSED_OPPORTUNITY_STAGES as readonly string[]).includes(row.opportunity.stage));
  const won = filtered.filter((row) => row.opportunity.stage === "won").length;
  const lost = filtered.filter((row) => row.opportunity.stage === "lost").length;
  return {
    category: "sales" as const,
    title: "Sales",
    description: "Opportunity pipeline from stored stages and scores.",
    metrics: [
      { label: "Open opportunities", value: open.length },
      { label: "Won", value: won },
      { label: "Lost", value: lost },
      { label: "Win rate", value: ratioLabel(won + lost ? won / (won + lost) : null) },
    ],
    columns: ["Opportunity", "Client", "Stage", "Score", "Value"],
    rows: filtered.slice(0, 100).map((row) => ({
      id: row.opportunity.id,
      href: `/app/opportunities/${row.opportunity.id}`,
      cells: [
        row.opportunity.name,
        row.companyName,
        row.opportunity.stage,
        row.opportunity.opportunityScore == null ? "—" : String(row.opportunity.opportunityScore),
        row.opportunity.valueAmount ? moneyLabel(parseMoney(row.opportunity.valueAmount) ?? 0) : "—",
      ],
    })),
  };
}

async function recruitingReport(organizationId: string, filters: ReportFilters) {
  const db = getDb();
  const analytics = await recruitingAnalytics(organizationId);
  const cycleTimes = await recruitingCycleTimes(organizationId);
  const jobRows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt)));
  const filteredJobs = jobRows.filter(
    (job) =>
      matchCompany(job.companyId, filters) &&
      matchOwner(job.searchOwnerUserId, filters) &&
      inDateRange(job.createdAt, filters),
  );
  const silverReuse = await db
    .select({ value: count() })
    .from(candidateJobMatches)
    .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
    .innerJoin(candidateDesignations, eq(candidateDesignations.candidateId, candidateJobMatches.candidateId))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        eq(candidateDesignations.designationType, "silver_medalist"),
        eq(candidateDesignations.active, true),
        ne(candidateJobMatches.pipelineStatus, "identified"),
      ),
    );
  const sourceRows = await db
    .select({ source: candidateJobMatches.source })
    .from(candidateJobMatches)
    .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
    .where(eq(jobs.organizationId, organizationId));
  const sourceCounts = sourceRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.source || "unspecified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
  const maxWorkload = Math.max(0, ...Object.values(analytics.recruiterWorkload));
  return {
    category: "recruiting" as const,
    title: "Recruiting",
    description: "Funnel, cycle time, and Talent Network usage from stored recruiting records. Averages omit jobs without both dates.",
    metrics: [
      { label: "Active searches", value: analytics.activeSearches },
      { label: "Time to shortlist (days)", value: cycleTimes.timeToShortlistDays ?? "—" },
      { label: "Time to interview (days)", value: cycleTimes.timeToInterviewDays ?? "—" },
      { label: "Time to fill (days)", value: cycleTimes.timeToFillDays ?? "—" },
      { label: "Submission to interview", value: ratioLabel(analytics.submissionToInterview) },
      { label: "Interview to offer", value: ratioLabel(analytics.interviewToOffer) },
      { label: "Offer acceptance", value: ratioLabel(analytics.offerAcceptance) },
      { label: "Internal Talent Network usage", value: ratioLabel(analytics.internalTalentUtilization) },
      { label: "Silver-medalist reuse", value: Number(silverReuse[0]?.value ?? 0) },
      { label: "Top source", value: topSource ? `${topSource[0]} (${topSource[1]})` : "—" },
      { label: "Placements", value: analytics.placements },
      { label: "Recruiter workload (max jobs)", value: maxWorkload },
    ],
    columns: ["Job", "Status", "Owner", "Created"],
    rows: filteredJobs.slice(0, 100).map((job) => ({
      id: job.id,
      href: `/app/jobs/${job.id}`,
      cells: [job.title, job.status, job.searchOwnerUserId ?? "unassigned", job.createdAt.toISOString().slice(0, 10)],
    })),
  };
}

async function talentReport(organizationId: string, filters: ReportFilters, includePii: boolean) {
  const db = getDb();
  const rows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.organizationId, organizationId), isNull(candidates.archivedAt)))
    .orderBy(candidates.fullName);
  const filtered = rows.filter(
    (row) => matchOwner(row.ownerUserId, filters) && inDateRange(row.createdAt, filters) && !row.privacyDeletedAt,
  );
  const silver = await db
    .select({ candidateId: candidateDesignations.candidateId })
    .from(candidateDesignations)
    .where(and(eq(candidateDesignations.designationType, "silver_medalist"), eq(candidateDesignations.active, true)));
  const silverIds = new Set(silver.map((row) => row.candidateId));
  return {
    category: "talent" as const,
    title: "Talent Network",
    description: includePii
      ? "Restricted PII columns are included because this export was authorized and audited."
      : "Candidate operating counts. Email and phone are omitted unless a PII export is authorized.",
    metrics: [
      { label: "Total candidates", value: filtered.length },
      { label: "Available now", value: filtered.filter((row) => row.availability === "available_now").length },
      { label: "Silver medalists", value: filtered.filter((row) => silverIds.has(row.id)).length },
      { label: "Military candidates", value: filtered.filter((row) => ["veteran", "active_duty", "reserve", "national_guard"].includes(row.militaryStatus)).length },
    ],
    columns: includePii
      ? ["Name", "Title", "Availability", "Military", "Email", "Phone"]
      : ["Name", "Title", "Availability", "Military"],
    rows: filtered.slice(0, 100).map((row) => ({
      id: row.id,
      href: `/app/talent/${row.id}`,
      cells: includePii
        ? [row.fullName, row.currentTitle ?? "—", row.availability, row.militaryStatus, row.email ?? "—", row.phone ?? "—"]
        : [row.fullName, row.currentTitle ?? "—", row.availability, row.militaryStatus],
    })),
  };
}

async function militaryReport(organizationId: string, filters: ReportFilters) {
  const db = getDb();
  const [occupations, mappings, installations, targeting, skillbridge, imports, militaryCandidates, skillbridgeProfilesCount, skillbridgeOppCount] = await Promise.all([
    db.select({ value: count() }).from(militaryOccupations),
    db.select({ value: count() }).from(militaryCivilianMappings),
    db.select({ value: count() }).from(militaryInstallations),
    db.select({ value: count() }).from(militaryOccupationInstallations),
    db
      .select({ value: count() })
      .from(militaryOccupationInstallations)
      .where(and(isNotNull(militaryOccupationInstallations.skillbridgeOpportunity), ne(militaryOccupationInstallations.skillbridgeOpportunity, ""))),
    db.select().from(occupationDataImports).orderBy(desc(occupationDataImports.createdAt)).limit(8),
    db
      .select({ value: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.organizationId, organizationId),
          isNull(candidates.archivedAt),
          inArray(candidates.militaryStatus, ["veteran", "active_duty", "reserve", "national_guard"]),
        ),
      ),
    db
      .select({ value: count() })
      .from(skillbridgeProfiles)
      .where(and(eq(skillbridgeProfiles.organizationId, organizationId), isNull(skillbridgeProfiles.archivedAt))),
    db
      .select({ value: count() })
      .from(skillbridgeOpportunities)
      .where(and(eq(skillbridgeOpportunities.organizationId, organizationId), isNull(skillbridgeOpportunities.archivedAt))),
  ]);
  void filters;
  const hireRows = await db
    .select({ value: count() })
    .from(placements)
    .innerJoin(jobs, eq(placements.jobId, jobs.id))
    .innerJoin(candidates, eq(placements.candidateId, candidates.id))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        inArray(candidates.militaryStatus, ["veteran", "active_duty", "reserve", "national_guard"]),
      ),
    );
  return {
    category: "military" as const,
    title: "Military Talent",
    description: "Occupation coverage and military candidate counts from stored translator records. Transition Talent Profile and employer opportunity metrics appear when those records exist.",
    metrics: [
      { label: "Occupations mapped", value: Number(occupations[0]?.value ?? 0) },
      { label: "Civilian role coverage", value: Number(mappings[0]?.value ?? 0) },
      { label: "Installations", value: Number(installations[0]?.value ?? 0) },
      { label: "Installation targeting links", value: Number(targeting[0]?.value ?? 0) },
      { label: "Military candidates", value: Number(militaryCandidates[0]?.value ?? 0) },
      { label: "Military hires", value: Number(hireRows[0]?.value ?? 0) },
      { label: "SkillBridge-eligible notes", value: Number(skillbridge[0]?.value ?? 0), hint: "Occupation-installation rows with a SkillBridge-eligible note" },
      { label: "Transition Talent Profiles", value: Number(skillbridgeProfilesCount[0]?.value ?? 0) },
      { label: "Employer / host-company opportunities", value: Number(skillbridgeOppCount[0]?.value ?? 0) },
    ],
    columns: ["Import", "Source", "Created"],
    rows: imports.map((row) => ({
      id: row.id,
      href: "/app/military/occupations",
      cells: [row.source, row.sourceVersion ?? "—", row.createdAt.toISOString().slice(0, 10)],
    })),
  };
}

async function workforceReport(organizationId: string, filters: ReportFilters) {
  const snapshot = await getWorkforceCommandSnapshot(organizationId);
  const db = getDb();
  const assessments = await db
    .select()
    .from(workforceAssessments)
    .where(and(eq(workforceAssessments.organizationId, organizationId), isNull(workforceAssessments.archivedAt)));
  const filtered = assessments.filter(
    (row) => matchCompany(row.companyId, filters) && inDateRange(row.createdAt, filters),
  );
  const [gaps, scenarios, pipelines, risks, pending, forecasts, supply, paths, programs, militaryContribution] = await Promise.all([
    db.select({ value: count() }).from(workforceGaps).innerJoin(workforceAssessments, eq(workforceGaps.assessmentId, workforceAssessments.id)).where(eq(workforceAssessments.organizationId, organizationId)),
    db.select({ value: count() }).from(workforceScenarios).innerJoin(workforceAssessments, eq(workforceScenarios.assessmentId, workforceAssessments.id)).where(eq(workforceAssessments.organizationId, organizationId)),
    db.select({ value: count() }).from(talentPipelines).where(eq(talentPipelines.organizationId, organizationId)),
    db.select({ value: count() }).from(workforceRisks).innerJoin(workforceAssessments, eq(workforceRisks.assessmentId, workforceAssessments.id)).where(eq(workforceAssessments.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(workforceRecommendations)
      .innerJoin(workforceAssessments, eq(workforceRecommendations.assessmentId, workforceAssessments.id))
      .where(
        and(eq(workforceAssessments.organizationId, organizationId), eq(workforceRecommendations.status, "pending_approval")),
      ),
    db.select({ value: count() }).from(workforceForecasts).innerJoin(workforceAssessments, eq(workforceForecasts.assessmentId, workforceAssessments.id)).where(eq(workforceAssessments.organizationId, organizationId)),
    db.select({ value: count() }).from(workforceSupplyEntries).innerJoin(workforceAssessments, eq(workforceSupplyEntries.assessmentId, workforceAssessments.id)).where(eq(workforceAssessments.organizationId, organizationId)),
    db.select({ value: count() }).from(careerPaths).where(eq(careerPaths.organizationId, organizationId)),
    db.select({ value: count() }).from(trainingPrograms).where(eq(trainingPrograms.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.organizationId, organizationId),
          isNull(candidates.archivedAt),
          inArray(candidates.militaryStatus, ["veteran", "active_duty", "reserve", "national_guard"]),
        ),
      ),
  ]);
  return {
    category: "workforce" as const,
    title: "Workforce",
    description: "Planning estimates from stored assessments. Figures are never presented as certain.",
    metrics: [
      { label: "Assessments", value: filtered.length },
      { label: "Critical gaps", value: snapshot.criticalGaps.length },
      { label: "Forecast versions", value: Number(forecasts[0]?.value ?? 0) },
      { label: "Supply entries", value: Number(supply[0]?.value ?? 0) },
      { label: "Gaps (all)", value: Number(gaps[0]?.value ?? 0) },
      { label: "Scenarios", value: Number(scenarios[0]?.value ?? 0) },
      { label: "Pipelines", value: Number(pipelines[0]?.value ?? 0) },
      { label: "Career paths (mobility)", value: Number(paths[0]?.value ?? 0) },
      { label: "Training programs", value: Number(programs[0]?.value ?? 0) },
      { label: "Risks", value: Number(risks[0]?.value ?? 0) },
      { label: "Recommendations awaiting approval", value: Number(pending[0]?.value ?? 0) },
      { label: "Military contribution (candidates)", value: Number(militaryContribution[0]?.value ?? 0), hint: "Stored military-status candidates, not a modeled contribution" },
    ],
    columns: ["Assessment", "Status", "Version"],
    rows: filtered.slice(0, 100).map((row) => ({
      id: row.id,
      href: `/app/workforce/assessments/${row.id}`,
      cells: [row.title, row.status, String(row.versionNumber)],
    })),
  };
}

async function projectsReport(organizationId: string, filters: ReportFilters) {
  const db = getDb();
  const rows = await db
    .select({ project: projects, companyName: companies.name, serviceCode: services.code, serviceName: services.name })
    .from(projects)
    .leftJoin(companies, eq(projects.companyId, companies.id))
    .leftJoin(services, eq(projects.serviceId, services.id))
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.updatedAt));
  const filtered = rows.filter(
    (row) =>
      matchCompany(row.project.companyId, filters) &&
      matchOwner(row.project.ownerUserId, filters) &&
      matchService(row.serviceCode, filters) &&
      inDateRange(row.project.createdAt, filters),
  );
  const [risks, issues, closeouts] = await Promise.all([
    db.select({ value: count() }).from(projectRisks).innerJoin(projects, eq(projectRisks.projectId, projects.id)).where(and(eq(projects.organizationId, organizationId), eq(projectRisks.status, "open"))),
    db.select({ value: count() }).from(projectIssues).innerJoin(projects, eq(projectIssues.projectId, projects.id)).where(eq(projects.organizationId, organizationId)),
    db.select({ value: count() }).from(projectCloseouts).innerJoin(projects, eq(projectCloseouts.projectId, projects.id)).where(eq(projects.organizationId, organizationId)),
  ]);
  return {
    category: "projects" as const,
    title: "Projects",
    description: "Delivery health from stored project, risk, and closeout records.",
    metrics: [
      { label: "Projects", value: filtered.length },
      { label: "At risk", value: filtered.filter((row) => row.project.status === "at_risk" || row.project.health === "at_risk").length },
      { label: "Open risks", value: Number(risks[0]?.value ?? 0) },
      { label: "Issues", value: Number(issues[0]?.value ?? 0) },
      { label: "Closeouts", value: Number(closeouts[0]?.value ?? 0) },
    ],
    columns: ["Project", "Client", "Status", "Health"],
    rows: filtered.slice(0, 100).map((row) => ({
      id: row.project.id,
      href: `/app/projects/${row.project.id}`,
      cells: [row.project.name, row.companyName ?? "—", row.project.status, row.project.health],
    })),
  };
}

async function aiReport(organizationId: string, filters: ReportFilters) {
  const db = getDb();
  const usage = await usageSummary(organizationId);
  const runs = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, organizationId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(200);
  const filtered = runs.filter((run) => inDateRange(run.createdAt, filters));
  return {
    category: "ai" as const,
    title: "AI Operations",
    description: "Run volume and estimated cost from the usage ledger. Heuristic provider cost is recorded when available.",
    metrics: [
      { label: "Runs this month", value: usage.monthRuns },
      { label: "Estimated month cost", value: moneyLabel(usage.monthCostUsd) },
      { label: "Failed runs", value: filtered.filter((run) => run.status === "failed").length },
      { label: "Pending review", value: filtered.filter((run) => run.approvalState === "pending").length },
    ],
    columns: ["Task", "Status", "Provider", "Created"],
    rows: filtered.slice(0, 100).map((run) => ({
      id: run.id,
      href: "/app/ai-operations/runs",
      cells: [run.taskKey, run.status, run.provider ?? "—", run.createdAt.toISOString().slice(0, 10)],
    })),
  };
}
