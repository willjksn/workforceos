import { requireAppPermission } from "@/lib/auth/guard";
import { guideForRole } from "@/lib/rbac/role-guide";
import { listOrganizationRoles } from "@/lib/repositories/platform";
import { EmptyState, PageHeader, PageShell } from "../../_components/ui";

export default async function AdminRolesPage() {
  const principal = await requireAppPermission("admin.roles");
  const rows = await listOrganizationRoles(principal.organizationId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Roles & access"
        description="People sign in with Clerk. Assign their WorkforceOS role on People. Managing Partner and Strategy & Technology Administrator can assign roles. Only a Managing Partner can grant Managing Partner."
      />
      {rows.length === 0 ? (
        <EmptyState>No roles are configured for this organization.</EmptyState>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr>
              <th>Role</th>
              <th>Who it is for</th>
              <th>What they can do</th>
              <th>People</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
