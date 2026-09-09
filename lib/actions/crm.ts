"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { SCORE_WEIGHTS } from "@/lib/crm/scoring";
import { LAUNCH_SERVICE_CODES, OPPORTUNITY_STAGES } from "@/lib/crm/stages";
import { AuthorizationError } from "@/lib/rbac/permissions";
import {
  addCompanyLocation,
  addOpportunitySignal,
  convertSignalToOpportunity,
  createActivity,
  createCompany,
  createContact,
  createContactForCompany,
  createOpportunity,
  getCompanyInOrganization,
  reviewSignal,
  updateCompanyGtmClassification,
  updateOpportunityStage,
  upsertOpportunityScore,
} from "@/lib/repositories/crm";
import { GTM_REGIONS, GTM_TIERS } from "@/lib/gtm/focus";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string };

const companyTypeSchema = z.enum(["prospect", "client", "partner", "other"]);
const clientStatusSchema = z.enum(["prospect", "active", "inactive", "former"]);
const relationshipSchema = z.enum(["unknown", "weak", "moderate", "strong", "strategic"]);
const opportunityStageSchema = z.enum(OPPORTUNITY_STAGES);
const signalTypeSchema = z.enum([
  "hiring",
  "expansion",
  "layoff",
  "funding",
  "leadership_change",
  "workforce_need",
  "other",
]);
const activityTypeSchema = z.enum([
  "note",
  "email",
  "phone",
  "meeting",
  "task",
  "research",
  "outreach",
  "status_change",
  "system",
  "other",
]);
const serviceCodeSchema = z.enum(LAUNCH_SERVICE_CODES);
const gtmTierSchema = z.enum(GTM_TIERS);
const gtmRegionSchema = z.enum(GTM_REGIONS);

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function isNextControlFlow(error: unknown) {
  return typeof error === "object" && error && "digest" in error;
}

function optionalNumber(value: FormDataEntryValue | null, max: number) {
  const raw = emptyToNull(value);
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error("Score values must be numbers");
  return Math.max(0, Math.min(max, Math.round(parsed)));
}

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("companies.write");
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(200),
        companyType: companyTypeSchema,
        clientStatus: clientStatusSchema,
        relationshipStrength: relationshipSchema,
        website: z.string().trim().max(500).optional(),
        industry: z.string().trim().max(200).optional(),
        gtmTier: gtmTierSchema.optional(),
        gtmRegion: gtmRegionSchema.optional(),
        notes: z.string().trim().max(4000).optional(),
      })
      .parse({
        name: formData.get("name"),
        companyType: formData.get("companyType") || "prospect",
        clientStatus: formData.get("clientStatus") || "prospect",
        relationshipStrength: formData.get("relationshipStrength") || "unknown",
        website: emptyToNull(formData.get("website")) ?? undefined,
        industry: emptyToNull(formData.get("industry")) ?? undefined,
        gtmTier: emptyToNull(formData.get("gtmTier")) ?? undefined,
        gtmRegion: emptyToNull(formData.get("gtmRegion")) ?? undefined,
        notes: emptyToNull(formData.get("notes")) ?? undefined,
      });
    const company = await createCompany({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      website: parsed.website ?? null,
      gtmTier: parsed.gtmTier ?? null,
      gtmRegion: parsed.gtmRegion ?? null,
      notes: parsed.notes ?? null,
    });
    redirect(`/app/companies/${company.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updateCompanyGtmAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("companies.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        industry: z.string().trim().max(200).optional(),
        gtmTier: gtmTierSchema.optional(),
        gtmRegion: gtmRegionSchema.optional(),
      })
      .parse({
        companyId: formData.get("companyId"),
        industry: emptyToNull(formData.get("industry")) ?? undefined,
        gtmTier: emptyToNull(formData.get("gtmTier")) ?? undefined,
        gtmRegion: emptyToNull(formData.get("gtmRegion")) ?? undefined,
      });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company not found" };
    await updateCompanyGtmClassification({
      organizationId: principal.organizationId,
      companyId: parsed.companyId,
      actorUserId: principal.id,
      industry: parsed.industry ?? null,
      gtmTier: parsed.gtmTier ?? null,
      gtmRegion: parsed.gtmRegion ?? null,
    });
    redirect(`/app/companies/${parsed.companyId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("contacts.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        fullName: z.string().trim().min(1).max(200),
        email: z.string().trim().email().optional(),
        title: z.string().trim().max(200).optional(),
      })
      .parse({
        companyId: formData.get("companyId"),
        fullName: formData.get("fullName"),
        email: emptyToNull(formData.get("email")) ?? undefined,
        title: emptyToNull(formData.get("title")) ?? undefined,
      });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company not found" };
    const contact = await createContactForCompany({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.companyId,
      fullName: parsed.fullName,
      email: parsed.email ?? null,
      title: parsed.title ?? null,
    });
    const returnTo = emptyToNull(formData.get("returnTo"));
    redirect(returnTo ?? `/app/contacts/${contact.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("contacts.write");
    const parsed = z
      .object({
        fullName: z.string().trim().min(1).max(200),
        email: z.string().trim().email().optional(),
        phone: z.string().trim().max(40).optional(),
        title: z.string().trim().max(200).optional(),
        companyId: z.string().uuid().optional(),
        department: z.string().trim().max(120).optional(),
        buyerPersona: z.string().trim().max(120).optional(),
      })
      .parse({
        fullName: formData.get("fullName"),
        email: emptyToNull(formData.get("email")) ?? undefined,
        phone: emptyToNull(formData.get("phone")) ?? undefined,
        title: emptyToNull(formData.get("title")) ?? undefined,
        companyId: emptyToNull(formData.get("companyId")) ?? undefined,
        department: emptyToNull(formData.get("department")) ?? undefined,
        buyerPersona: emptyToNull(formData.get("buyerPersona")) ?? undefined,
      });
    if (parsed.companyId) {
      const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
      if (!company) return { error: "Company not found" };
    }
    const contact = await createContact({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      title: parsed.title ?? null,
      companyId: parsed.companyId ?? null,
      department: parsed.department ?? null,
      buyerPersona: parsed.buyerPersona ?? null,
    });
    redirect(`/app/contacts/${contact.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addLocationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("companies.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        city: z.string().trim().max(120).optional(),
        region: z.string().trim().max(120).optional(),
        country: z.string().trim().max(120).optional(),
      })
      .parse({
        companyId: formData.get("companyId"),
        name: formData.get("name"),
        city: emptyToNull(formData.get("city")) ?? undefined,
        region: emptyToNull(formData.get("region")) ?? undefined,
        country: emptyToNull(formData.get("country")) ?? undefined,
      });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company not found" };
    await addCompanyLocation({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.companyId,
      name: parsed.name,
      city: parsed.city ?? null,
      region: parsed.region ?? null,
      country: parsed.country ?? null,
    });
    redirect(`/app/companies/${parsed.companyId}?tab=locations`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addOpportunityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        stage: opportunityStageSchema,
        notes: z.string().trim().max(4000).optional(),
        serviceCode: serviceCodeSchema.optional(),
      })
      .parse({
        companyId: formData.get("companyId"),
        name: formData.get("name"),
        stage: formData.get("stage") || "identified",
        notes: emptyToNull(formData.get("notes")) ?? undefined,
        serviceCode: emptyToNull(formData.get("serviceCode")) ?? undefined,
      });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company not found" };
    const opportunity = await createOpportunity({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.companyId,
      name: parsed.name,
      stage: parsed.stage,
      notes: parsed.notes ?? null,
      serviceCode: parsed.serviceCode ?? null,
    });
    redirect(`/app/opportunities/${opportunity.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addSignalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        signalType: signalTypeSchema,
        details: z.string().trim().max(4000).optional(),
        evidence: z.string().trim().max(4000).optional(),
        source: z.string().trim().max(200).optional(),
      })
      .parse({
        companyId: formData.get("companyId"),
        title: formData.get("title"),
        signalType: formData.get("signalType") || "other",
        details: emptyToNull(formData.get("details")) ?? undefined,
        evidence: emptyToNull(formData.get("evidence")) ?? undefined,
        source: emptyToNull(formData.get("source")) ?? undefined,
      });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company not found" };
    await addOpportunitySignal({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.companyId,
      title: parsed.title,
      signalType: parsed.signalType,
      details: parsed.details ?? null,
      evidence: parsed.evidence ?? null,
      source: parsed.source ?? null,
    });
    const returnTo = emptyToNull(formData.get("returnTo"));
    redirect(returnTo ?? "/app/signals");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updateOpportunityStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const parsed = z
      .object({
        opportunityId: z.string().uuid(),
        stage: opportunityStageSchema,
        lostReason: z.string().trim().max(1000).optional(),
      })
      .parse({
        opportunityId: formData.get("opportunityId"),
        stage: formData.get("stage"),
        lostReason: emptyToNull(formData.get("lostReason")) ?? undefined,
      });
    if (parsed.stage === "lost" && !parsed.lostReason) {
      return { error: "Lost reason is required when marking an opportunity lost." };
    }
    const updated = await updateOpportunityStage({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      opportunityId: parsed.opportunityId,
      stage: parsed.stage,
      lostReason: parsed.lostReason ?? null,
    });
    if (!updated) return { error: "Opportunity not found" };
    redirect(`/app/opportunities/${parsed.opportunityId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function scoreOpportunityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const opportunityId = z.string().uuid().parse(formData.get("opportunityId"));
    const overrideRaw = emptyToNull(formData.get("overrideScore"));
    const overrideScore = overrideRaw ? Number(overrideRaw) : null;
    if (overrideRaw && (!Number.isFinite(overrideScore) || (overrideScore ?? 0) < 0 || (overrideScore ?? 0) > 100)) {
      return { error: "Override score must be between 0 and 100." };
    }
    const overrideReason = emptyToNull(formData.get("overrideReason"));
    if (overrideScore != null && !overrideReason) {
      return { error: "Override reason is required when overriding the calculated score." };
    }
    const components = {
      icpFit: optionalNumber(formData.get("icpFit"), SCORE_WEIGHTS.icpFit),
      triggerScore: optionalNumber(formData.get("triggerScore"), SCORE_WEIGHTS.triggerScore),
      demonstratedPain: optionalNumber(formData.get("demonstratedPain"), SCORE_WEIGHTS.demonstratedPain),
      serviceFit: optionalNumber(formData.get("serviceFit"), SCORE_WEIGHTS.serviceFit),
      buyerAccess: optionalNumber(formData.get("buyerAccess"), SCORE_WEIGHTS.buyerAccess),
      timingBudget: optionalNumber(formData.get("timingBudget"), SCORE_WEIGHTS.timingBudget),
    };
    const result = await upsertOpportunityScore({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      opportunityId,
      components,
      overrideScore,
      overrideReason,
    });
    if (!result) return { error: "Opportunity not found" };
    redirect(`/app/opportunities/${opportunityId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function reviewSignalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const parsed = z
      .object({
        signalId: z.string().uuid(),
        reviewStatus: z.enum(["approved", "dismissed"]),
      })
      .parse({
        signalId: formData.get("signalId"),
        reviewStatus: formData.get("reviewStatus"),
      });
    const updated = await reviewSignal({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      signalId: parsed.signalId,
      reviewStatus: parsed.reviewStatus,
    });
    if (!updated) return { error: "Signal not found" };
    redirect("/app/signals");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function convertSignalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const parsed = z
      .object({
        signalId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        stage: opportunityStageSchema,
        serviceCode: serviceCodeSchema.optional(),
      })
      .parse({
        signalId: formData.get("signalId"),
        name: formData.get("name"),
        stage: formData.get("stage") || "identified",
        serviceCode: emptyToNull(formData.get("serviceCode")) ?? undefined,
      });
    const result = await convertSignalToOpportunity({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      signalId: parsed.signalId,
      name: parsed.name,
      stage: parsed.stage,
      serviceCode: parsed.serviceCode ?? null,
    });
    if (!result) return { error: "Signal not found" };
    redirect(`/app/opportunities/${result.opportunity.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("companies.write");
    const parsed = z
      .object({
        activityType: activityTypeSchema,
        subject: z.string().trim().min(1).max(200),
        details: z.string().trim().max(4000).optional(),
        companyId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        opportunityId: z.string().uuid().optional(),
        nextAction: z.string().trim().max(400).optional(),
        followUpAt: z.string().optional(),
        returnTo: z.string().trim().min(1),
      })
      .parse({
        activityType: formData.get("activityType") || "note",
        subject: formData.get("subject"),
        details: emptyToNull(formData.get("details")) ?? undefined,
        companyId: emptyToNull(formData.get("companyId")) ?? undefined,
        contactId: emptyToNull(formData.get("contactId")) ?? undefined,
        opportunityId: emptyToNull(formData.get("opportunityId")) ?? undefined,
        nextAction: emptyToNull(formData.get("nextAction")) ?? undefined,
        followUpAt: emptyToNull(formData.get("followUpAt")) ?? undefined,
        returnTo: formData.get("returnTo") || "/app",
      });
    if (!parsed.returnTo.startsWith("/app")) {
      return { error: "Invalid return path" };
    }
    await createActivity({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      activityType: parsed.activityType,
      subject: parsed.subject,
      details: parsed.details ?? null,
      companyId: parsed.companyId ?? null,
      contactId: parsed.contactId ?? null,
      opportunityId: parsed.opportunityId ?? null,
      nextAction: parsed.nextAction ?? null,
      followUpAt: parsed.followUpAt ? new Date(parsed.followUpAt) : null,
    });
    redirect(parsed.returnTo);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
