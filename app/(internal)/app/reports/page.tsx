import Link from "next/link";

import { Card } from "@/components/ui/display";
import { PageHeader, PageShell } from "@/components/ui/page";
import { requireAppPermission } from "@/lib/auth/guard";
import { REPORT_CATEGORIES } from "@/lib/reporting/filters";

const TITLES: Record<(typeof REPORT_CATEGORIES)[number], string> = {
  business: "Business",
  sales: "Sales",
  recruiting: "Recruiting",
  talent: "Talent Network",
  military: "Military Talent",
  workforce: "Workforce",
  projects: "Projects",
  finance: "Finance",
  ai: "AI Operations",
};

export default async function ReportsIndexPage() {
  await requireAppPermission("reports.read");
  return (
    <PageShell>
      <PageHeader
        eyebrow="Reports"
        title="Operating reports"
        description="Filter operating reports by date, client, service, and owner. Save the views your team uses often."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CATEGORIES.map((category) => (
          <Link key={category} href={`/app/reports/${category}`}>
            <Card>
              <p className="font-medium text-navy">{TITLES[category]}</p>
              <p className="mt-1 text-sm text-muted-foreground">From your operating records.</p>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
