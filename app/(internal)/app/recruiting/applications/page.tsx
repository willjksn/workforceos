import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { getHiringMetrics, listApplications } from "@/lib/hiring/service";
import { ListPager, PageHeader, PageShell, formatLabel } from "../../_components/ui";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const principal = await requireAppPermission("applications.read");
  const { view, page } = await searchParams;
  const result = await listApplications({ principal, view, page });
  const rows = result.items;
  const metrics = await getHiringMetrics(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Applications"
        description="One candidate record. Each application is a relationship to a job."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <p className="border border-border bg-white p-4 text-sm">New this week: {metrics.newApplications}</p>
        <p className="border border-border bg-white p-4 text-sm">Awaiting review: {metrics.awaitingReview}</p>
        <p className="border border-border bg-white p-4 text-sm">SkillBridge-eligible: {metrics.skillbridgeApplicants}</p>
        <p className="border border-border bg-white p-4 text-sm">Onboarding at risk: {metrics.onboardingAtRisk}</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ["", "All"],
          ["needs_review", "Needs review"],
          ["mine", "My applications"],
        ].map(([value, label]) => (
          <Link key={value} className="border border-border px-3 py-1" href={`/app/recruiting/applications${value ? `?view=${value}` : ""}`}>
            {label}
          </Link>
        ))}
      </div>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-3">Candidate</th>
            <th className="p-3">Job</th>
            <th className="p-3">Stage</th>
            <th className="p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.application.id} className="border-b border-border">
              <td className="p-3">
                <Link className="font-medium text-navy" href={`/app/recruiting/applications/${row.application.id}`}>
                  {row.candidate.fullName}
                </Link>
              </td>
              <td className="p-3">{row.job.title}</td>
              <td className="p-3">{formatLabel(row.application.currentStage)}</td>
              <td className="p-3">{formatLabel(row.application.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ListPager
        pathname="/app/recruiting/applications"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ view }}
      />
    </PageShell>
  );
}
