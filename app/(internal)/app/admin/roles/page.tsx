import { requireAppPermission } from "@/lib/auth/guard";
import { guideForRole } from "@/lib/rbac/role-guide";
import { listOrganizationRoles } from "@/lib/repositories/platform";
import { DataTable, EmptyState, PageHeader, PageShell } from "../../_components/ui";

export default async function AdminRolesPage() {
  const principal = await requireAppPermission("admin.roles");
  const rows = await listOrganizationRoles(principal.organizationId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Access bundles"
        description="An access bundle is a PostgreSQL role with a set of permissions. Job titles are display-only and are not permissions. Clerk authenticates; it does not grant access. Assign bundles on People. Only a Managing Partner can grant Managing Partner."
      />
      {rows.length === 0 ? (
        <EmptyState>No access bundles are configured for this organization.</EmptyState>
      ) : (
        <DataTable columns={["Access bundle", "Who it is for", "What they can do", "People"]}>
            {rows.map((role) => {
              const guide = guideForRole(role.slug);
              return (
                <tr key={role.id}>
                  <td className="align-top">
                    <p className="font-medium text-navy">{role.name}</p>
                    {role.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
                    ) : null}
                  </td>
                  <td className="align-top text-muted-foreground">{guide.audience}</td>
                  <td className="align-top text-muted-foreground">{guide.access}</td>
                  <td className="align-top">{Number(role.assignedCount)}</td>
                </tr>
              );
            })}
        </DataTable>
      )}
    </PageShell>
  );
}
