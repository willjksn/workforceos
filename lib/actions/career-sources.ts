"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { createCareerSource, EmployerDemandError } from "@/lib/recruiting/employer-demand";
import {
  importCsvJobs,
  importManualJob,
  OpportunityDiscoveryError,
  previewPublicJob,
  syncCareerSource,
  testCareerSource,
} from "@/lib/recruiting/opportunity-discovery";
import { GREENHOUSE_ADAPTER_KEY } from "@/lib/integrations/career-sources/types";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { getCompanyInOrganization } from "@/lib/repositories/crm";

export type CareerActionState = {
  error?: string;
  message?: string;
  preview?: {
    sourceId: string;
    fetched: boolean;
    title: string;
    externalKey: string;
    sourceUrl: string;
    location: string;
    description: string;
    department: string;
    employmentType: string;
    workplaceType: string;
    publicSalaryText: string;
  };
  csvPreview?: {
    sourceId: string;
    csvText: string;
    validCount: number;
    errors: { row: number; message: string }[];
    sample: { externalKey: string; title: string; closed: boolean }[];
  };
};

const sourceTypeSchema = z.enum(["public_careers_page", "feed", "employer_api", "manual_url", "csv"]);

function fail(error: unknown): CareerActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof EmployerDemandError || error instanceof OpportunityDiscoveryError || error instanceof Error) {
    return { error: error.message };
  }
  return { error: "Unable to save the career source." };
}

export async function createCareerSourceAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      name: z.string().trim().min(1).max(200),
      sourceType: sourceTypeSchema,
      careersUrl: z.string().trim().max(2000).optional(),
    }).parse({
      companyId: formData.get("companyId"),
      name: formData.get("name"),
      sourceType: formData.get("sourceType"),
      careersUrl: empty(formData.get("careersUrl")),
    });
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company is not in this organization." };
    const adapterKey = parsed.sourceType === "employer_api" ? GREENHOUSE_ADAPTER_KEY : null;
    await createCareerSource({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: company.id,
      sourceType: parsed.sourceType,
      name: parsed.name,
      careersUrl: parsed.careersUrl,
      adapterKey,
    });
    revalidatePath(`/app/companies/${company.id}`);
    return { message: "Career source saved. It is not live until a sync or import succeeds." };
  } catch (error) {
    return fail(error);
  }
}

export async function testCareerSourceAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      careerSourceId: z.string().uuid(),
    }).parse({ companyId: formData.get("companyId"), careerSourceId: formData.get("careerSourceId") });
    await assertCompany(parsed.companyId, principal.organizationId);
    const tested = await testCareerSource({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      careerSourceId: parsed.careerSourceId,
    });
    revalidatePath(`/app/companies/${parsed.companyId}`);
    return { message: tested.message };
  } catch (error) {
    return fail(error);
  }
}

export async function syncCareerSourceAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      careerSourceId: z.string().uuid(),
    }).parse({ companyId: formData.get("companyId"), careerSourceId: formData.get("careerSourceId") });
    await assertCompany(parsed.companyId, principal.organizationId);
    const synced = await syncCareerSource({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      careerSourceId: parsed.careerSourceId,
      trigger: "manual",
    });
    revalidatePath(`/app/companies/${parsed.companyId}`);
    return synced.outcome === "succeeded" ? { message: synced.message } : { error: synced.message };
  } catch (error) {
    return fail(error);
  }
}

export async function previewManualJobAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      careerSourceId: z.string().uuid(),
      sourceUrl: z.string().trim().url().max(2000),
    }).parse({
      companyId: formData.get("companyId"),
      careerSourceId: formData.get("careerSourceId"),
      sourceUrl: formData.get("sourceUrl"),
    });
    await assertCompany(parsed.companyId, principal.organizationId);
    const preview = await previewPublicJob({
      organizationId: principal.organizationId,
      careerSourceId: parsed.careerSourceId,
      url: parsed.sourceUrl,
    });
    return {
      message: preview.fetched ? "Review the extracted fields, then confirm. Nothing is saved yet." : preview.reason ?? "Enter the fields manually.",
      preview: {
        sourceId: parsed.careerSourceId,
        fetched: preview.fetched,
        title: preview.job?.title ?? "",
        externalKey: preview.job?.externalKey ?? "",
        sourceUrl: preview.job?.sourceUrl || parsed.sourceUrl,
        location: preview.job?.location ?? "",
        description: preview.job?.description ?? "",
        department: preview.job?.department ?? "",
        employmentType: preview.job?.employmentType ?? "",
        workplaceType: preview.job?.workplaceType ?? "",
        publicSalaryText: preview.job?.publicSalaryText ?? "",
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function confirmManualJobAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      careerSourceId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      externalKey: z.string().trim().min(1).max(200),
      sourceUrl: z.string().trim().url().max(2000),
      location: z.string().trim().max(300).optional(),
      description: z.string().trim().max(20_000).optional(),
      department: z.string().trim().max(200).optional(),
      employmentType: z.string().trim().max(100).optional(),
      workplaceType: z.string().trim().max(100).optional(),
      publicSalaryText: z.string().trim().max(300).optional(),
    }).parse({
      companyId: formData.get("companyId"),
      careerSourceId: formData.get("careerSourceId"),
      title: formData.get("title"),
      externalKey: formData.get("externalKey"),
      sourceUrl: formData.get("sourceUrl"),
      location: empty(formData.get("location")),
      description: empty(formData.get("description")),
      department: empty(formData.get("department")),
      employmentType: empty(formData.get("employmentType")),
      workplaceType: empty(formData.get("workplaceType")),
      publicSalaryText: empty(formData.get("publicSalaryText")),
    });
    await assertCompany(parsed.companyId, principal.organizationId);
    const saved = await importManualJob({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      careerSourceId: parsed.careerSourceId,
      job: {
        externalKey: parsed.externalKey,
        title: parsed.title,
        location: parsed.location ?? null,
        description: parsed.description ?? null,
        sourceUrl: parsed.sourceUrl,
        department: parsed.department ?? null,
        employmentType: parsed.employmentType ?? null,
        workplaceType: parsed.workplaceType ?? null,
        publicSalaryText: parsed.publicSalaryText ?? null,
        compensationMin: null,
        compensationMax: null,
        qualifications: null,
        certifications: null,
        education: null,
        experience: null,
      },
    });
    revalidatePath(`/app/companies/${parsed.companyId}`);
    return saved.outcome === "succeeded" ? { message: saved.message } : { error: saved.message };
  } catch (error) {
    return fail(error);
  }
}

export async function previewCsvAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      careerSourceId: z.string().uuid(),
      csvText: z.string().trim().min(1).max(350_000),
    }).parse({
      companyId: formData.get("companyId"),
      careerSourceId: formData.get("careerSourceId"),
      csvText: formData.get("csvText"),
    });
    await assertCompany(parsed.companyId, principal.organizationId);
    const { parseJobCsv } = await import("@/lib/integrations/career-sources/csv");
    const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
    if (!company) return { error: "Company is not in this organization." };
    const preview = parseJobCsv(parsed.csvText, company.name);
    return {
      message: "Review the CSV, then confirm. Nothing is saved yet.",
      csvPreview: {
        sourceId: parsed.careerSourceId,
        csvText: parsed.csvText,
        validCount: preview.jobs.length,
        errors: preview.errors.slice(0, 20),
        sample: preview.jobs.slice(0, 8).map((job) => ({
          externalKey: job.externalKey,
          title: job.title,
          closed: Boolean(job.explicitlyClosed),
        })),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function confirmCsvAction(_prev: CareerActionState, formData: FormData): Promise<CareerActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      companyId: z.string().uuid(),
      careerSourceId: z.string().uuid(),
      csvText: z.string().trim().min(1).max(350_000),
      confirm: z.literal("yes"),
    }).parse({
      companyId: formData.get("companyId"),
      careerSourceId: formData.get("careerSourceId"),
      csvText: formData.get("csvText"),
      confirm: formData.get("confirm"),
    });
    await assertCompany(parsed.companyId, principal.organizationId);
    const saved = await importCsvJobs({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      careerSourceId: parsed.careerSourceId,
      csvText: parsed.csvText,
    });
    revalidatePath(`/app/companies/${parsed.companyId}`);
    return saved.outcome === "succeeded" ? { message: saved.message } : { error: saved.message };
  } catch (error) {
    return fail(error);
  }
}

async function assertCompany(companyId: string, organizationId: string) {
  const company = await getCompanyInOrganization(companyId, organizationId);
  if (!company) throw new OpportunityDiscoveryError("Company is not in this organization.");
  return company;
}

function empty(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
