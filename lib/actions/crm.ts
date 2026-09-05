"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError } from "@/lib/rbac/permissions";
import {
  addCompanyLocation,
  addOpportunitySignal,
  createCompany,
  createContactForCompany,
  createOpportunity,
  getCompanyInOrganization,
} from "@/lib/repositories/crm";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string };

const companyTypeSchema = z.enum(["prospect", "client", "partner", "other"]);
const clientStatusSchema = z.enum(["prospect", "active", "inactive", "former"]);
const relationshipSchema = z.enum(["unknown", "weak", "moderate", "strong", "strategic"]);
const opportunityStageSchema = z.enum([
  "identified",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "abandoned",
]);
const signalTypeSchema = z.enum([
  "hiring",
  "expansion",
  "layoff",
  "funding",
  "leadership_change",
  "workforce_need",
  "other",
]);

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
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
        notes: z.string().trim().max(4000).optional(),
      })
      .parse({
        name: formData.get("name"),
        companyType: formData.get("companyType") || "prospect",
        clientStatus: formData.get("clientStatus") || "prospect",
        relationshipStrength: formData.get("relationshipStrength") || "unknown",
        website: emptyToNull(formData.get("website")) ?? undefined,
        notes: emptyToNull(formData.get("notes")) ?? undefined,
      });
    const company = await createCompany({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      website: parsed.website ?? null,
      notes: parsed.notes ?? null,
    });
    redirect(`/app/companies/${company.id}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
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
    await createContactForCompany({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.companyId,
      fullName: parsed.fullName,
      email: parsed.email ?? null,
      title: parsed.title ?? null,
    });
    redirect(`/app/companies/${parsed.companyId}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
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
    redirect(`/app/companies/${parsed.companyId}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
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
      })
      .parse({
        companyId: formData.get("companyId"),
        name: formData.get("name"),
        stage: formData.get("stage") || "identified",
        notes: emptyToNull(formData.get("notes")) ?? undefined,
      });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company not found" };
    await createOpportunity({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.companyId,
      name: parsed.name,
      stage: parsed.stage,
      notes: parsed.notes ?? null,
    });
    redirect(`/app/companies/${parsed.companyId}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
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
      })
      .parse({
        companyId: formData.get("companyId"),
        title: formData.get("title"),
        signalType: formData.get("signalType") || "other",
        details: emptyToNull(formData.get("details")) ?? undefined,
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
    });
    redirect(`/app/companies/${parsed.companyId}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    return fail(error);
  }
}
