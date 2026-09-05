import { and, asc, eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  companies,
  opportunities,
  projectPhases,
  projects,
  projectTasks,
  serviceVersions,
  serviceWorkflows,
  services,
  solutionPlans,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { canCreateDeliveryProject } from "../military/mtoa";

const MTOA_PHASES = [
  "Data Collection",
  "Analysis",
  "Recommendations",
  "Client Presentation",
] as const;

export async function listLaunchServices() {
  const db = getDb();
  const rows = await db.select().from(services).orderBy(services.name);
  const result = [];
  for (const service of rows) {
    const versions = await db
      .select()
      .from(serviceVersions)
      .where(eq(serviceVersions.serviceId, service.id));
    const approved = versions.find((version) => version.reviewStatus === "approved") ?? versions[0];
    const workflows = approved
      ? await db
          .select()
          .from(serviceWorkflows)
          .where(eq(serviceWorkflows.serviceVersionId, approved.id))
          .orderBy(asc(serviceWorkflows.stepNumber))
      : [];
    result.push({ service, versions, approvedVersion: approved ?? null, workflows });
  }
  return result;
}

export async function getServiceBundle(serviceCode: string) {
  const db = getDb();
  const [service] = await db.select().from(services).where(eq(services.code, serviceCode)).limit(1);
  if (!service) return null;
  const versions = await db
    .select()
    .from(serviceVersions)
    .where(eq(serviceVersions.serviceId, service.id));
  const approved = versions.find((version) => version.reviewStatus === "approved") ?? versions[0];
  const workflows = approved
    ? await db
        .select()
        .from(serviceWorkflows)
        .where(eq(serviceWorkflows.serviceVersionId, approved.id))
        .orderBy(asc(serviceWorkflows.stepNumber))
    : [];
  const plans = approved
    ? await db
        .select({
          plan: solutionPlans,
          opportunity: opportunities,
          companyName: companies.name,
        })
        .from(solutionPlans)
        .innerJoin(opportunities, eq(solutionPlans.opportunityId, opportunities.id))
        .innerJoin(companies, eq(opportunities.companyId, companies.id))
        .where(eq(solutionPlans.serviceVersionId, approved.id))
    : [];
  return { service, versions, approvedVersion: approved ?? null, workflows, plans };
}

export async function createDraftSolutionPlan(input: {
  organizationId: string;
  actorUserId: string;
  serviceCode: string;
  opportunityId: string;
  title: string;
  summary?: string | null;
}) {
  const db = getDb();
  const bundle = await getServiceBundle(input.serviceCode);
  if (!bundle?.approvedVersion) {
    throw new Error("Approved service version not found");
  }
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.id, input.opportunityId),
        eq(opportunities.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (!opportunity) throw new Error("Opportunity not found");

  const [plan] = await db
    .insert(solutionPlans)
    .values({
      organizationId: input.organizationId,
      opportunityId: opportunity.id,
      serviceVersionId: bundle.approvedVersion.id,
      title: input.title,
      summary: input.summary,
      status: "draft",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "solution_plan.created",
    recordType: "solution_plan",
    recordId: plan.id,
    after: plan,
  });
  return plan;
}

export async function approveSolutionPlan(input: {
  organizationId: string;
  actorUserId: string;
  solutionPlanId: string;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(solutionPlans)
    .where(
      and(
        eq(solutionPlans.id, input.solutionPlanId),
        eq(solutionPlans.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (!before) throw new Error("Solution plan not found");
  const [after] = await db
    .update(solutionPlans)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(solutionPlans.id, input.solutionPlanId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "solution_plan.approved",
    recordType: "solution_plan",
    recordId: after.id,
    before,
    after,
  });
  return after;
}

export async function listProjectsForPlan(solutionPlanId: string) {
  const db = getDb();
  return db
    .select()
    .from(projects)
    .where(eq(projects.solutionPlanId, solutionPlanId))
    .orderBy(asc(projects.createdAt));
}

export async function createProjectFromSolutionPlan(
  solutionPlanId: string,
  actor?: { organizationId: string; userId: string },
) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(solutionPlans)
    .where(eq(solutionPlans.id, solutionPlanId))
    .limit(1);
  if (!plan) throw new Error("Solution plan not found");
  if (actor && plan.organizationId !== actor.organizationId) {
    throw new Error("Solution plan not found");
  }
  if (!canCreateDeliveryProject(plan.status)) {
    throw new Error("Project creation requires an approved solution plan");
  }

  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, plan.opportunityId))
    .limit(1);

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: plan.organizationId,
      solutionPlanId: plan.id,
      name: `${plan.title} delivery`,
      status: "planned",
    })
    .returning();

  const phases = [];
  for (const [index, name] of MTOA_PHASES.entries()) {
    const [phase] = await db
      .insert(projectPhases)
      .values({
        projectId: project.id,
        name,
        sequence: index + 1,
      })
      .returning();
    const [task] = await db
      .insert(projectTasks)
      .values({
        phaseId: phase.id,
        name: `${name} work`,
        status: "pending",
      })
      .returning();
    phases.push({ phase, task });
  }

  if (actor) {
    await recordAuditEvent({
      organizationId: actor.organizationId,
      actor: { type: "human", userId: actor.userId },
      action: "project.created",
      recordType: "project",
      recordId: project.id,
      after: project,
    });
  }

  return { project, opportunity, plan, phases };
}
