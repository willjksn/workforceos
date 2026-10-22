"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  addCandidateCredential,
  addCandidateEducation,
  addMilitaryDuty,
  addMilitaryEquipment,
  addMilitaryExperience,
  addMilitaryTraining,
  addPreferredLocation,
  addTargetRole,
  completeTransitionProfileReview,
  setCurrentClearance,
  TransitionEvidenceError,
  updateMilitaryExperience,
  updateTransitionProfile,
} from "@/lib/military-talent/transition-evidence";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string; message?: string };

const branchSchema = z.enum(["army", "navy", "air_force", "marine_corps", "coast_guard", "space_force"]);
const clearanceLevelSchema = z.enum(["unknown", "none", "confidential", "secret", "top_secret", "ts_sci"]);
const clearanceStatusSchema = z.enum(["unknown", "reported_active", "reported_inactive", "expired"]);
const equipmentKindSchema = z.enum(["platform", "system", "equipment", "tool"]);
const trainingCategorySchema = z.enum([
  "technical",
  "nuclear",
  "leadership",
  "cyber",
  "maintenance",
  "logistics",
  "aviation",
  "instructor",
  "other",
]);

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof TransitionEvidenceError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save the Transition Talent Profile" };
}

function textOrUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function dateOrUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function intOrUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  return parsed;
}

function refresh(candidateId: string, profileId: string) {
  revalidatePath(`/app/military/skillbridge/${profileId}`);
  revalidatePath(`/app/talent/${candidateId}`);
}

export async function addMilitaryExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        branch: branchSchema,
        code: z.string().trim().min(1).max(40),
        rank: z.string().trim().max(80).optional(),
        payGrade: z.string().trim().max(20).optional(),
        unit: z.string().trim().max(160).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        branch: formData.get("branch"),
        code: formData.get("code"),
        rank: textOrUndefined(formData.get("rank")),
        payGrade: textOrUndefined(formData.get("payGrade")),
        unit: textOrUndefined(formData.get("unit")),
      });
    await addMilitaryExperience({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      branch: parsed.branch,
      code: parsed.code,
      rank: parsed.rank,
      payGrade: parsed.payGrade,
      unit: parsed.unit,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Military experience added." };
  } catch (error) {
    return fail(error);
  }
}

export async function addMilitaryDutyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        experienceId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(4000).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        experienceId: formData.get("experienceId"),
        title: formData.get("title"),
        description: textOrUndefined(formData.get("description")),
      });
    await addMilitaryDuty({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      experienceId: parsed.experienceId,
      title: parsed.title,
      description: parsed.description,
      source: "recruiter",
      humanVerified: true,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Duty saved as human reviewed." };
  } catch (error) {
    return fail(error);
  }
}

export async function addMilitaryEquipmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        experienceId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        kind: equipmentKindSchema,
        description: z.string().trim().max(2000).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        experienceId: formData.get("experienceId"),
        name: formData.get("name"),
        kind: formData.get("kind") || "equipment",
        description: textOrUndefined(formData.get("description")),
      });
    await addMilitaryEquipment({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      experienceId: parsed.experienceId,
      name: parsed.name,
      kind: parsed.kind,
      description: parsed.description,
      source: "recruiter",
      humanVerified: true,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Equipment saved as human reviewed." };
  } catch (error) {
    return fail(error);
  }
}

export async function addMilitaryTrainingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        experienceId: z.string().uuid(),
        schoolName: z.string().trim().min(1).max(200),
        category: trainingCategorySchema,
        description: z.string().trim().max(2000).optional(),
        completionYear: z.number().int().min(1940).max(2100).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        experienceId: formData.get("experienceId"),
        schoolName: formData.get("schoolName"),
        category: formData.get("category") || "other",
        description: textOrUndefined(formData.get("description")),
        completionYear: intOrUndefined(formData.get("completionYear")),
      });
    await addMilitaryTraining({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      experienceId: parsed.experienceId,
      schoolName: parsed.schoolName,
      category: parsed.category,
      description: parsed.description,
      completionYear: parsed.completionYear,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Training saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function updateLeadershipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        experienceId: z.string().uuid(),
        leadershipLevel: z.string().trim().max(120).optional(),
        directReportsCount: z.number().int().min(0).max(100000).optional(),
        indirectReportsCount: z.number().int().min(0).max(100000).optional(),
        teamSize: z.number().int().min(0).max(100000).optional(),
        resourceScope: z.string().trim().max(300).optional(),
        shiftWatchLeadership: z.string().trim().max(300).optional(),
        programResponsibility: z.string().trim().max(300).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        experienceId: formData.get("experienceId"),
        leadershipLevel: textOrUndefined(formData.get("leadershipLevel")),
        directReportsCount: intOrUndefined(formData.get("directReportsCount")),
        indirectReportsCount: intOrUndefined(formData.get("indirectReportsCount")),
        teamSize: intOrUndefined(formData.get("teamSize")),
        resourceScope: textOrUndefined(formData.get("resourceScope")),
        shiftWatchLeadership: textOrUndefined(formData.get("shiftWatchLeadership")),
        programResponsibility: textOrUndefined(formData.get("programResponsibility")),
      });
    await updateMilitaryExperience({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      experienceId: parsed.experienceId,
      leadershipLevel: parsed.leadershipLevel,
      directReportsCount: parsed.directReportsCount,
      indirectReportsCount: parsed.indirectReportsCount,
      teamSize: parsed.teamSize,
      resourceScope: parsed.resourceScope,
      shiftWatchLeadership: parsed.shiftWatchLeadership,
      programResponsibility: parsed.programResponsibility,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Leadership scope saved as human reviewed." };
  } catch (error) {
    return fail(error);
  }
}

export async function addEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid().optional(),
        institution: z.string().trim().min(1).max(200),
        degreeOrCredential: z.string().trim().min(1).max(200),
        fieldOfStudy: z.string().trim().max(200).optional(),
        completionYear: z.number().int().min(1940).max(2100).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: textOrUndefined(formData.get("profileId")),
        institution: formData.get("institution"),
        degreeOrCredential: formData.get("degreeOrCredential"),
        fieldOfStudy: textOrUndefined(formData.get("fieldOfStudy")),
        completionYear: intOrUndefined(formData.get("completionYear")),
      });
    await addCandidateEducation({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      institution: parsed.institution,
      degreeOrCredential: parsed.degreeOrCredential,
      fieldOfStudy: parsed.fieldOfStudy,
      completionYear: parsed.completionYear,
      completionStatus: parsed.completionYear ? "completed" : "unknown",
    });
    if (parsed.profileId) refresh(parsed.candidateId, parsed.profileId);
    else revalidatePath(`/app/talent/${parsed.candidateId}`);
    return { message: "Education saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function addCredentialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(200),
        issuer: z.string().trim().max(200).optional(),
        status: z.enum(["unknown", "active", "expired", "revoked"]).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: textOrUndefined(formData.get("profileId")),
        name: formData.get("name"),
        issuer: textOrUndefined(formData.get("issuer")),
        status: textOrUndefined(formData.get("status")),
      });
    await addCandidateCredential({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      name: parsed.name,
      issuer: parsed.issuer,
      status: parsed.status,
    });
    if (parsed.profileId) refresh(parsed.candidateId, parsed.profileId);
    else revalidatePath(`/app/talent/${parsed.candidateId}`);
    return { message: "Credential saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function setClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        clearanceLevel: clearanceLevelSchema,
        clearanceStatus: clearanceStatusSchema,
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        clearanceLevel: formData.get("clearanceLevel"),
        clearanceStatus: formData.get("clearanceStatus") || "unknown",
      });
    await setCurrentClearance({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      clearanceLevel: parsed.clearanceLevel,
      clearanceStatus: parsed.clearanceStatus,
      source: "recruiter",
      humanVerified: true,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Current clearance saved as human reviewed. This is not an independent verification." };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTransitionProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        separationDate: z.date().optional(),
        etsDate: z.date().optional(),
        eaosDate: z.date().optional(),
        endOfServiceDate: z.date().optional(),
        retirementDate: z.date().optional(),
        candidateAvailableDate: z.date().optional(),
        skillbridgeWindowStart: z.date().optional(),
        skillbridgeWindowEnd: z.date().optional(),
        terminalLeaveStart: z.date().optional(),
        relocationWillingness: z.string().max(200).optional(),
        remotePreference: z.string().max(200).optional(),
        preferredLocationPrimary: z.string().max(200).optional(),
        idealIndustry: z.string().max(200).optional(),
        idealEmployer: z.string().max(200).optional(),
        careerPriorities: z.string().max(2000).optional(),
        nextAction: z.string().max(300).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        separationDate: dateOrUndefined(formData.get("separationDate")),
        etsDate: dateOrUndefined(formData.get("etsDate")),
        eaosDate: dateOrUndefined(formData.get("eaosDate")),
        endOfServiceDate: dateOrUndefined(formData.get("endOfServiceDate")),
        retirementDate: dateOrUndefined(formData.get("retirementDate")),
        candidateAvailableDate: dateOrUndefined(formData.get("candidateAvailableDate")),
        skillbridgeWindowStart: dateOrUndefined(formData.get("skillbridgeWindowStart")),
        skillbridgeWindowEnd: dateOrUndefined(formData.get("skillbridgeWindowEnd")),
        terminalLeaveStart: dateOrUndefined(formData.get("terminalLeaveStart")),
        relocationWillingness: textOrUndefined(formData.get("relocationWillingness")),
        remotePreference: textOrUndefined(formData.get("remotePreference")),
        preferredLocationPrimary: textOrUndefined(formData.get("preferredLocationPrimary")),
        idealIndustry: textOrUndefined(formData.get("idealIndustry")),
        idealEmployer: textOrUndefined(formData.get("idealEmployer")),
        careerPriorities: textOrUndefined(formData.get("careerPriorities")),
        nextAction: textOrUndefined(formData.get("nextAction")),
      });
    const { candidateId, profileId, ...patch } = parsed;
    await updateTransitionProfile({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId,
      patch,
    });
    refresh(candidateId, profileId);
    return { message: "Transition Talent Profile updated." };
  } catch (error) {
    return fail(error);
  }
}

export async function addPreferredLocationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        locationLabel: z.string().trim().min(1).max(200),
        city: z.string().trim().max(120).optional(),
        region: z.string().trim().max(80).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        locationLabel: formData.get("locationLabel"),
        city: textOrUndefined(formData.get("city")),
        region: textOrUndefined(formData.get("region")),
      });
    await addPreferredLocation({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      locationLabel: parsed.locationLabel,
      city: parsed.city,
      region: parsed.region,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Preferred location added." };
  } catch (error) {
    return fail(error);
  }
}

export async function addTargetRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
        roleTitle: z.string().trim().min(1).max(200),
        jobFamily: z.string().trim().max(120).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
        roleTitle: formData.get("roleTitle"),
        jobFamily: textOrUndefined(formData.get("jobFamily")),
      });
    await addTargetRole({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
      roleTitle: parsed.roleTitle,
      jobFamily: parsed.jobFamily,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Target role added." };
  } catch (error) {
    return fail(error);
  }
}

export async function completeProfileReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
      });
    await completeTransitionProfileReview({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      candidateId: parsed.candidateId,
    });
    refresh(parsed.candidateId, parsed.profileId);
    return { message: "Profile review recorded. Matches were not changed." };
  } catch (error) {
    return fail(error);
  }
}
