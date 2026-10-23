import Link from "next/link";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { loadReviewSummary } from "@/lib/command-center/load";
import { can } from "@/lib/rbac/permissions";
import { PageHeader, PageShell } from "../_components/ui";

export default async function NeedsReviewPage() {
  const principal = await requireCurrentPrincipal();
  const allowed = can(principal, "military.read") || can(principal, "candidates.read") || can(principal, "jobs.read") || can(principal, "agents.read");
  if (!allowed) {
    return (
      <PageShell>
        <PageHeader eyebrow="Work" title="Needs Review" description="Your access bundles do not include a review queue." />
      </PageShell>
    );
  }

  let summary: Awaited<ReturnType<typeof loadReviewSummary>> | null = null;
  let error: string | null = null;
  try {
    summary = await loadReviewSummary(principal.organizationId);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Query failed";
  }

  const rows = [
    can(principal, "military.read")
      ? { href: "/app/military/review", label: "Military mappings", count: summary?.militaryMappings ?? null }
      : null,
    can(principal, "candidates.read") || can(principal, "military.review")
      ? { href: "/app/military/review#candidate-capabilities", label: "Candidate capabilities", count: summary?.candidateCapabilities ?? null }
      : null,
    can(principal, "jobs.read")
      ? { href: "/app/jobs?requirements=review", label: "Job requirements", count: summary?.jobRequirements ?? null }
      : null,
    can(principal, "agents.read")
      ? { href: "/app/ai-operations/review", label: "AI review queue", count: null }
      : null,
    can(principal, "admin.users") || can(principal, "workforce.approve")
      ? { href: "/app/admin/approvals", label: "Approvals", count: null }
      : null,
  ].filter((row): row is { href: string; label: string; count: number | null } => Boolean(row));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Work"
        title="Needs Review"
        description="One entry point. Each count opens the workflow that owns that record. Nothing here approves itself."
      />
      {error ? <p role="alert" className="mt-6 text-sm">Unable to load this data. {error}</p> : null}
      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li key={row.href}>
            <Link className="font-medium text-navy underline" href={row.href}>
              {row.label}
              {row.count == null ? "" : `: ${row.count}`}
            </Link>
          </li>
        ))}
      </ul>
      {!error && rows.some((row) => row.count != null) && rows.filter((row) => row.count != null).every((row) => row.count === 0) ? (
        <p className="mt-4 text-sm text-muted-foreground">No items need attention.</p>
      ) : null}
    </PageShell>
  );
}
