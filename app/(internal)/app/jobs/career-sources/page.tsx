import Link from "next/link";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { careerSources, companies } from "@/db/schema";
import { requireAppPermission } from "@/lib/auth/guard";
import { careerSourceHonesty } from "@/lib/command-center/source-health";
import { PageHeader, PageShell } from "../../_components/ui";
import { JobsSubnav } from "../_components/jobs-subnav";

export default async function CareerSourcesPage() {
  const principal = await requireAppPermission("jobs.read");
  const db = getDb();
  const rows = await db
    .select({
      id: careerSources.id,
      name: careerSources.name,
      status: careerSources.healthStatus,
      lastSuccessfulSyncAt: careerSources.lastSuccessfulSyncAt,
      companyName: companies.name,
      companyId: companies.id,
      sourceType: careerSources.sourceType,
    })
    .from(careerSources)
    .innerJoin(companies, and(eq(companies.id, careerSources.companyId), eq(companies.organizationId, principal.organizationId)))
    .where(eq(careerSources.organizationId, principal.organizationId));

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Jobs"
        title="Career Sources"
        description="Approved discovery paths that write employer demand onto jobs. A configured adapter is not LIVE until a successful sync is stored."
      />
      <JobsSubnav active="/app/jobs/career-sources" />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No career sources yet. Add one from a company.</p>
      ) : (
        <ul className="mt-6 space-y-3 text-sm">
          {rows.map((row) => {
            const honesty = careerSourceHonesty(row.status, row.lastSuccessfulSyncAt);
            return (
              <li key={row.id}>
                <Link className="font-medium text-navy underline" href={`/app/companies/${row.companyId}?tab=career-sources`}>
                  {row.companyName} · {row.name}
                </Link>
                <span className="text-muted-foreground">
                  {" · "}
                  {honesty}
                  {" · stored health "}
                  {row.status}
                  {" · "}
                  {row.sourceType}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
