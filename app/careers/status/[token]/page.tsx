import { getPublicApplicationStatus } from "@/lib/hiring/application-status";
import { PublicAccessError } from "@/lib/public-access/tokens";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ApplicationStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await assertRateLimit({ key: `public-status:${ip}`, ...RATE_LIMITS.publicApplicationStatus });
    const status = await getPublicApplicationStatus(token);
    return (
      <main className="min-h-full bg-[#F7F8F9] text-[#102A3A]">
        <header className="border-b border-[#DCE2E7] bg-[#0E2D4A] px-6 py-10 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-[#4E7B8C]">Application status</p>
          <h1 className="mt-3 font-serif text-4xl">{status.jobTitle}</h1>
        </header>
        <section className="mx-auto max-w-xl px-6 py-10 text-sm">
          <p>Stage: {status.stage.replaceAll("_", " ")}</p>
          <p>Status: {status.status}</p>
          <p>Applied: {status.appliedAt ? status.appliedAt.toLocaleDateString() : "—"}</p>
          <p className="mt-6 text-[#6B7280]">
            Read-only status from the existing application record. This is not a candidate login portal and does not
            expose email, phone, compensation, or resume.
          </p>
        </section>
      </main>
    );
  } catch (error) {
    const message =
      error instanceof RateLimitError
        ? error.message
        : error instanceof PublicAccessError
          ? error.message
          : "This status link is not available.";
    return (
      <main className="min-h-full bg-[#F7F8F9] px-6 py-16 text-[#102A3A]">
        <h1 className="font-serif text-3xl">Application status</h1>
        <p className="mt-4 text-sm text-[#6B7280]">{message}</p>
      </main>
    );
  }
}
