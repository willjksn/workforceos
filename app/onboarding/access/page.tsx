import { completeHireOnboardingTaskAction } from "@/lib/actions/public-access";
import { getHireOnboardingAccess } from "@/lib/hiring/onboarding-access";
import { PublicAccessError } from "@/lib/public-access/tokens";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

import { PublicActionForm } from "../../schedule/_components/public-action-form";

export const dynamic = "force-dynamic";

export default async function HireOnboardingAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!token) {
    return (
      <main className="min-h-full bg-[#F7F8F9] px-6 py-16 text-[#102A3A]">
        <h1 className="font-serif text-3xl">Hire onboarding</h1>
        <p className="mt-4 text-sm text-[#6B7280]">
          This page is for new-hire tasks with a signed token. It is not PierOne staff Academy onboarding and does not use
          /app.
        </p>
      </main>
    );
  }
  try {
    await assertRateLimit({ key: `public-onboarding:${ip}`, ...RATE_LIMITS.publicOnboardingAccess });
    const context = await getHireOnboardingAccess(token);
    return (
      <main className="min-h-full bg-[#F7F8F9] text-[#102A3A]">
        <header className="border-b border-[#DCE2E7] bg-[#0E2D4A] px-6 py-10 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-[#4E7B8C]">New-hire onboarding</p>
          <h1 className="mt-3 font-serif text-4xl">{context.jobTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            Hello {context.firstName}. These are hire tasks only. This is not PierOne staff training at /app/academy/onboarding.
          </p>
        </header>
        <section className="mx-auto max-w-xl space-y-4 px-6 py-10">
          {context.tasks.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No new-hire tasks are assigned to you on this checklist.</p>
          ) : (
            context.tasks.map((task) => (
              <div key={task.id} className="border border-[#DCE2E7] bg-white p-4">
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-[#6B7280]">{task.status}</p>
                {task.status !== "completed" ? (
                  <PublicActionForm action={completeHireOnboardingTaskAction}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <button className="mt-2 border border-[#0E2D4A] px-3 py-1 text-sm" type="submit">
                      Mark complete
                    </button>
                  </PublicActionForm>
                ) : null}
              </div>
            ))
          )}
        </section>
      </main>
    );
  } catch (error) {
    const message =
      error instanceof RateLimitError
        ? error.message
        : error instanceof PublicAccessError
          ? error.message
          : "This onboarding link is not available.";
    return (
      <main className="min-h-full bg-[#F7F8F9] px-6 py-16 text-[#102A3A]">
        <h1 className="font-serif text-3xl">Hire onboarding</h1>
        <p className="mt-4 text-sm text-[#6B7280]">{message}</p>
      </main>
    );
  }
}
