import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  opportunities,
  projectPhases,
  projects,
  projectTasks,
  serviceVersions,
  serviceWorkflows,
  services,
  solutionPlans,
} from "../../db/schema";

const MTOA_PHASES = [
  "Data Collection",
  "Analysis",
  "Recommendations",
  "Client Presentation",
] as const;

export async function getServiceBundle(serviceCode: string) {
  const db = getDb();
  const [service] = await db.select().from(services).where(eq(services.code, serviceCode)).limit(1);
  if (!service) return null;
  const versions = await db
    .select()
    .from(serviceVersions)
    .where(eq(serviceVersions.serviceId, service.id));
  const workflows = versions.length
    ? await db
        .select()
        .from(serviceWorkflows)
        .where(eq(serviceWorkflows.serviceVersionId, versions[0].id))
    : [];
  return { service, versions, workflows };
}

export async function createProjectFromSolutionPlan(solutionPlanId: string) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(solutionPlans)
    .where(eq(solutionPlans.id, solutionPlanId))
    .limit(1);
  if (!plan) throw new Error("Solution plan not found");
  if (plan.status !== "approved") {
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

  return { project, opportunity, plan, phases };
}
