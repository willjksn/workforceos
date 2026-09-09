import Link from "next/link";

import { Card } from "@/components/ui/display";
import { PageHeader, PageShell } from "@/components/ui/page";
import { requireAppPermission } from "@/lib/auth/guard";
import { REPORT_CATEGORIES, REPORT_QUESTIONS } from "@/lib/reporting/filters";

export default async function ReportsIndexPage() {
  await requireAppPermission("reports.read");
  return (
    <PageShell>
      <PageHeader
        eyebrow="Reports"
        title="What needs attention?"
        description="Each report answers one operating question from stored PostgreSQL records. This is not a BI dashboard builder."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CATEGORIES.map((category) => (
          <Link key={category} href={`/app/reports/${category}`}>
            <Card>
              <p className="font-medium text-navy">{REPORT_QUESTIONS[category].title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{REPORT_QUESTIONS[category].summary}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
