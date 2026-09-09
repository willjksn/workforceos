"use server";

import { headers } from "next/headers";

import { completeHireOnboardingTaskByToken } from "@/lib/hiring/onboarding-access";
import { pickSelfScheduleSlot } from "@/lib/hiring/self-schedule";
import { PublicAccessError } from "@/lib/public-access/tokens";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";

export type PublicActionState = { error?: string; ok?: boolean };

function clientKey(prefix: string) {
  return `${prefix}:public`;
}

export async function pickSelfScheduleSlotAction(
  _prev: PublicActionState,
  formData: FormData,
): Promise<PublicActionState> {
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertRateLimit({ key: `${clientKey("self-schedule")}:${ip}`, ...RATE_LIMITS.publicSelfSchedule });
    const token = String(formData.get("token") ?? "");
    const start = String(formData.get("start") ?? "");
    const end = String(formData.get("end") ?? "");
    if (!token || !start || !end) return { error: "Choose an available slot." };
    await pickSelfScheduleSlot({ token, start: new Date(start), end: new Date(end) });
    return { ok: true };
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    if (error instanceof PublicAccessError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Unable to book that slot." };
  }
}

export async function completeHireOnboardingTaskAction(
  _prev: PublicActionState,
  formData: FormData,
): Promise<PublicActionState> {
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertRateLimit({ key: `${clientKey("onboarding")}:${ip}`, ...RATE_LIMITS.publicOnboardingAccess });
    const token = String(formData.get("token") ?? "");
    const taskId = String(formData.get("taskId") ?? "");
    await completeHireOnboardingTaskByToken({ token, taskId });
    return { ok: true };
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    if (error instanceof PublicAccessError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Unable to complete that task." };
  }
}
