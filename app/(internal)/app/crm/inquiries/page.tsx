import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listWebsiteInquiries } from "@/lib/inquiries/service";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SearchForm,
  StatusBadge,
  formatLabel,
} from "../../_components/ui";

export default async function WebsiteInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const principal = await requireAppPermission("opportunities.read");
  const { q } = await searchParams;
  const rows = await listWebsiteInquiries(principal.organizationId, q);

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Website intake"
        title="Website inquiries"
        description="Employer inquiries submitted from pieronepartners.com. Qualify here before creating an opportunity."
      />
      <FilterBar>
        <SearchForm action="/app/crm/inquiries" q={q} placeholder="Search name, company, or email" className="" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No website inquiries.">
          Public employer inquiries appear here after they pass validation on the PierOne website.
        </EmptyState>
      ) : (
        <DataTable columns={["Company", "Contact", "Service", "Status", "Submitted"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/crm/inquiries/${row.id}`}>
                  {row.companyName}
                </Link>
              </td>
              <td>
                {row.firstName} {row.lastName}
              </td>
              <td>{formatLabel(row.serviceInterest)}</td>
              <td>
                <StatusBadge tone={row.status === "new" ? "warning" : "navy"}>{formatLabel(row.status)}</StatusBadge>
              </td>
              <td>{row.submittedAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
