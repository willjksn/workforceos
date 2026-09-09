import { requiredTrainingSlugs } from "@/lib/academy/training";
import type { Principal } from "@/lib/rbac/permissions";

export const STAFF_ONBOARDING_CADENCES = [
  "day_1",
  "week_1",
  "week_2",
  "week_3",
  "week_4",
  "complete",
] as const;

export type StaffOnboardingCadence = (typeof STAFF_ONBOARDING_CADENCES)[number];

export const STAFF_ONBOARDING_CADENCE_LABELS: Record<StaffOnboardingCadence, string> = {
  day_1: "Day 1",
  week_1: "Week 1",
  week_2: "Week 2",
  week_3: "Week 3",
  week_4: "Week 4",
  complete: "Complete",
};

/** Day 1 Academy: company + security + WorkforceOS basics. */
export const DAY_1_ACADEMY_SLUGS = [
  "getting-started",
  "operating-model",
  "security-candidate-privacy",
] as const;

export const EQUIPMENT_ITEM_KEYS = [
  "laptop",
  "clerk_login",
  "email",
  "workforceos_access",
] as const;

export type EquipmentItemKey = (typeof EQUIPMENT_ITEM_KEYS)[number];

export const EQUIPMENT_ITEM_LABELS: Record<EquipmentItemKey, string> = {
  laptop: "Laptop",
  clerk_login: "Clerk login",
  email: "Email",
  workforceos_access: "WorkforceOS access",
};

export const STAFF_POLICY_KEYS = ["security_candidate_privacy"] as const;
export type StaffPolicyKey = (typeof STAFF_POLICY_KEYS)[number];

export const STAFF_POLICY_LABELS: Record<StaffPolicyKey, string> = {
  security_candidate_privacy: "Security & Candidate Privacy",
};

export function isStaffOnboardingCadence(value: string): value is StaffOnboardingCadence {
  return (STAFF_ONBOARDING_CADENCES as readonly string[]).includes(value);
}

export function isEquipmentItemKey(value: string): value is EquipmentItemKey {
  return (EQUIPMENT_ITEM_KEYS as readonly string[]).includes(value);
}

export function isStaffPolicyKey(value: string): value is StaffPolicyKey {
  return (STAFF_POLICY_KEYS as readonly string[]).includes(value);
}

export function assertManagerNotSelf(userId: string, managerId: string | null | undefined) {
  if (managerId && managerId === userId) {
    throw new Error("A person cannot be their own manager.");
  }
}

/**
 * Suggested cadence from elapsed time. Display-only — do not auto-advance
 * stored state or send calendar events from this function.
 */
export function suggestedCadenceFromElapsed(startedAt: Date, now: Date): StaffOnboardingCadence {
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  if (elapsedDays < 2) return "day_1";
  if (elapsedDays < 8) return "week_1";
  if (elapsedDays < 15) return "week_2";
  if (elapsedDays < 22) return "week_3";
  return "week_4";
}

export function week1RequiredSlugs(principal: Principal) {
  return requiredTrainingSlugs(principal).filter(
    (slug) => !(DAY_1_ACADEMY_SLUGS as readonly string[]).includes(slug),
  );
}

export function allDay1AcademyComplete(completedSlugs: Iterable<string>) {
  const done = new Set(completedSlugs);
  return DAY_1_ACADEMY_SLUGS.every((slug) => done.has(slug));
}

export function allWeek1RequiredComplete(principal: Principal, completedSlugs: Iterable<string>) {
  const done = new Set(completedSlugs);
  return week1RequiredSlugs(principal).every((slug) => done.has(slug));
}

/**
 * Tracked cadence from completed work. Completing Week 4 review is the only
 * path to `complete`. This never grants permissions.
 */
export function deriveStaffOnboardingCadence(input: {
  day1AcademyComplete: boolean;
  week1RequiredComplete: boolean;
  week2ShadowComplete: boolean;
  week3SupervisedComplete: boolean;
  week4Reviewed: boolean;
}): StaffOnboardingCadence {
  if (input.week4Reviewed) return "complete";
  if (input.week3SupervisedComplete) return "week_4";
  if (input.week2ShadowComplete) return "week_3";
  if (input.week1RequiredComplete) return "week_2";
  if (input.day1AcademyComplete) return "week_1";
  return "day_1";
}
