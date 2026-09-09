"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  approveDeliverable,
  approveDiscovery,
  approveProposal,
  approveSolutionPlanRecord,
  closeProject,
  createContractPackage,
  createDeliveryProject,
  createDiscovery,
  createProposalFromPlan,
  createSolutionPlanFromDiscovery,
  executeContractManual,
  markDeliverableDelivered,
  sendProposal,
  submitProposalForReview,
} from "@/lib/delivery/engine";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function isNextControlFlow(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error;
}

function actorFrom(principal: { id: string; organizationId: string; roleSlugs: string[] }) {
  return { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs };
}

export async function createDiscoveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("discovery.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        opportunityId: z.string().uuid(),
        serviceCode: z.string().min(1),
        title: z.string().trim().min(1).max(200),
      })
      .parse({
        companyId: formData.get("companyId"),
        opportunityId: formData.get("opportunityId"),
        serviceCode: formData.get("serviceCode"),
        title: formData.get("title"),
      });
    const answers: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("answer.") && typeof value === "string" && value.trim()) {
        answers[key.slice(7)] = value.trim();
      }
    }
    const created = await createDiscovery({ actor: actorFrom(principal), ...parsed, answers });
    redirect(`/app/discovery/${created.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveDiscoveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("discovery.write");
    const parsed = z.object({ discoveryId: z.string().uuid() }).parse({
      discoveryId: formData.get("discoveryId"),
    });
    await approveDiscovery({ actor: actorFrom(principal), discoveryId: parsed.discoveryId });
    redirect(`/app/discovery/${parsed.discoveryId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createSolutionPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("solutions.write");
    const parsed = z
      .object({
        discoveryId: z.string().uuid(),
        title: z.string().trim().max(200).optional(),
        recommendedPrice: z.string().trim().optional(),
        overrideReason: z.string().trim().optional(),
      })
      .parse({
        discoveryId: formData.get("discoveryId"),
        title: emptyToNull(formData.get("title")) ?? undefined,
        recommendedPrice: emptyToNull(formData.get("recommendedPrice")) ?? undefined,
        overrideReason: emptyToNull(formData.get("overrideReason")) ?? undefined,
      });
    if (parsed.overrideReason) {
      await requireAppPermission("pricing.approve");
    }
    const plan = await createSolutionPlanFromDiscovery({
      actor: actorFrom(principal),
      discoveryId: parsed.discoveryId,
      title: parsed.title,
      recommendedPrice: parsed.recommendedPrice,
      overrideReason: parsed.overrideReason,
    });
    redirect(`/app/solutions/${plan.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveSolutionPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("solutions.approve");
    const parsed = z.object({ solutionPlanId: z.string().uuid() }).parse({
      solutionPlanId: formData.get("solutionPlanId"),
    });
    await approveSolutionPlanRecord({ actor: actorFrom(principal), solutionPlanId: parsed.solutionPlanId });
    redirect(`/app/solutions/${parsed.solutionPlanId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("proposals.write");
    const parsed = z.object({ solutionPlanId: z.string().uuid() }).parse({
      solutionPlanId: formData.get("solutionPlanId"),
    });
    const created = await createProposalFromPlan({
      actor: actorFrom(principal),
      solutionPlanId: parsed.solutionPlanId,
    });
    redirect(`/app/proposals/${created.proposal.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function submitProposalForReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("proposals.write");
    const parsed = z.object({ proposalId: z.string().uuid() }).parse({
      proposalId: formData.get("proposalId"),
    });
    await submitProposalForReview({ actor: actorFrom(principal), proposalId: parsed.proposalId });
    redirect(`/app/proposals/${parsed.proposalId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("proposals.approve");
    const parsed = z.object({ proposalId: z.string().uuid() }).parse({
      proposalId: formData.get("proposalId"),
    });
    await approveProposal({ actor: actorFrom(principal), proposalId: parsed.proposalId });
    redirect(`/app/proposals/${parsed.proposalId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function sendProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("proposals.write");
    const parsed = z.object({ proposalId: z.string().uuid() }).parse({
      proposalId: formData.get("proposalId"),
    });
    await sendProposal({ actor: actorFrom(principal), proposalId: parsed.proposalId });
    redirect(`/app/proposals/${parsed.proposalId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createContractPackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("contracts.write");
    const parsed = z
      .object({
        serviceCode: z.string().min(1),
        companyId: z.string().uuid(),
        opportunityId: z.string().uuid().optional(),
        proposalId: z.string().uuid().optional(),
        solutionPlanId: z.string().uuid().optional(),
        retained: z.string().optional(),
      })
      .parse({
        serviceCode: formData.get("serviceCode"),
        companyId: formData.get("companyId"),
        opportunityId: emptyToNull(formData.get("opportunityId")) ?? undefined,
        proposalId: emptyToNull(formData.get("proposalId")) ?? undefined,
        solutionPlanId: emptyToNull(formData.get("solutionPlanId")) ?? undefined,
        retained: emptyToNull(formData.get("retained")) ?? undefined,
      });
    const created = await createContractPackage({
      actor: actorFrom(principal),
      ...parsed,
      retained: parsed.retained === "true",
    });
    redirect(`/app/contracts/${created.contracts[0]?.id ?? ""}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function executeContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("contracts.approve");
    const parsed = z
      .object({
        contractId: z.string().uuid(),
        signerName: z.string().trim().min(1),
      })
      .parse({
        contractId: formData.get("contractId"),
        signerName: formData.get("signerName"),
      });
    await executeContractManual({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/contracts/${parsed.contractId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createDeliveryProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("projects.write");
    const parsed = z
      .object({
        solutionPlanId: z.string().uuid(),
        contractId: z.string().uuid().optional(),
        overrideReason: z.string().trim().optional(),
      })
      .parse({
        solutionPlanId: formData.get("solutionPlanId"),
        contractId: emptyToNull(formData.get("contractId")) ?? undefined,
        overrideReason: emptyToNull(formData.get("overrideReason")) ?? undefined,
      });
    const created = await createDeliveryProject({
      actor: actorFrom(principal),
      solutionPlanId: parsed.solutionPlanId,
      contractId: parsed.contractId,
      overrideReason: parsed.overrideReason,
    });
    redirect(`/app/projects/${created.project.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveDeliverableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("deliverables.approve");
    const parsed = z.object({ deliverableId: z.string().uuid(), projectId: z.string().uuid() }).parse({
      deliverableId: formData.get("deliverableId"),
      projectId: formData.get("projectId"),
    });
    await approveDeliverable({ actor: actorFrom(principal), deliverableId: parsed.deliverableId });
    redirect(`/app/projects/${parsed.projectId}?tab=deliverables`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function deliverDeliverableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("deliverables.write");
    const parsed = z.object({ deliverableId: z.string().uuid(), projectId: z.string().uuid() }).parse({
      deliverableId: formData.get("deliverableId"),
      projectId: formData.get("projectId"),
    });
    await markDeliverableDelivered({ actor: actorFrom(principal), deliverableId: parsed.deliverableId });
    redirect(`/app/projects/${parsed.projectId}?tab=deliverables`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function closeProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("projects.write");
    const parsed = z
      .object({
        projectId: z.string().uuid(),
        lessonsLearned: z.string().optional(),
        overrideReason: z.string().optional(),
      })
      .parse({
        projectId: formData.get("projectId"),
        lessonsLearned: emptyToNull(formData.get("lessonsLearned")) ?? undefined,
        overrideReason: emptyToNull(formData.get("overrideReason")) ?? undefined,
      });
    await closeProject({
      actor: actorFrom(principal),
      projectId: parsed.projectId,
      lessonsLearned: parsed.lessonsLearned,
      overrideReason: parsed.overrideReason,
    });
    redirect(`/app/projects/${parsed.projectId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
