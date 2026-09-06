import { requireAppPermission } from "@/lib/auth/guard";
import { getAccessReview } from "@/lib/admin/access-review";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function AccessReviewPage() {
  const principal = await requireAppPermission("admin.users");
  const rows = await getAccessReview(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Admin"
        title="Access review"
        description="Account status, roles, last login, and sensitive permissions. Sign-in is separate from what each person is allowed to do here."
      />
      {rows.length === 0 ? (
        <EmptyState>No people are recorded for this organization.</EmptyState>
      ) : (
        <DataTable columns={["Name", "Email", "Status", "Roles", "Last login", "Sensitive", "Stale"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.fullName}</td>
              <td>{row.email}</td>
              <td>{row.status}</td>
              <td>{row.roles.join(", ") || "—"}</td>
              <td>{row.lastLoginAt ? formatDate(row.lastLoginAt) : "Never"}</td>
              <td>{row.sensitivePermissions.join(", ") || "None"}</td>
              <td>{row.stale ? "Yes" : "No"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
