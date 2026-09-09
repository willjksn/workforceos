import { pickSelfScheduleSlotAction } from "@/lib/actions/public-access";
import { getSelfScheduleContext } from "@/lib/hiring/self-schedule";
import { PublicAccessError } from "@/lib/public-access/tokens";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

import { PublicActionForm } from "../_components/public-action-form";

export const dynamic = "force-dynamic";

export default async function SelfSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await assertRateLimit({ key: `public-self-schedule:${ip}`, ...RATE_LIMITS.publicSelfSchedule });
    const context = await getSelfScheduleContext(token);
    return (
      <main className="min-h-full bg-[#F7F8F9] text-[#102A3A]">
        <header className="border-b border-[#DCE2E7] bg-[#0E2D4A] px-6 py-10 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-[#4E7B8C]">PierOne Partners</p>
          <h1 className="mt-3 font-serif text-4xl">Choose an interview time</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            {context.jobTitle}. Calendar is {context.liveScheduling ? "live" : "labeled mock until OAuth tokens exist"}.
          </p>
        </header>
        <section className="mx-auto max-w-xl space-y-4 px-6 py-10">
          {context.slots.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No open slots right now.</p>
          ) : (
            context.slots.map((slot) => (
              <PublicActionForm key={slot.start.toISOString()} action={pickSelfScheduleSlotAction}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="start" value={slot.start.toISOString()} />
                <input type="hidden" name="end" value={slot.end.toISOString()} />
                <p className="text-sm">
                  {slot.start.toLocaleString()} – {slot.end.toLocaleTimeString()} ({slot.timezone})
                </p>
                <button className="mt-2 border border-[#0E2D4A] px-3 py-1 text-sm" type="submit">
                  Book this slot
                </button>
              </PublicActionForm>
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
          : "This scheduling link is not available.";
    return (
      <main className="min-h-full bg-[#F7F8F9] px-6 py-16 text-[#102A3A]">
        <h1 className="font-serif text-3xl">Interview scheduling</h1>
        <p className="mt-4 text-sm text-[#6B7280]">{message}</p>
      </main>
    );
  }
}
