import { assignUserRoleAction, setUserAccessStatusAction } from "@/lib/actions/admin";
import { requireAppPermission } from "@/lib/auth/guard";
import { assignableRoleSlugs } from "@/lib/rbac/assign-role";
import { can, type RoleSlug } from "@/lib/rbac/permissions";
import { listOrganizationRoles, listOrganizationUsers } from "@/lib/repositories/platform";
import { EmptyState, PageHeader, PageShell } from "../../_components/ui";
import { RoleAssignField, UserStatusField } from "../_components/role-assign-field";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const principal = await requireAppPermission("admin.users");
  const canAssign = can(principal, "admin.roles");
  const [rows, roles] = await Promise.all([
    listOrganizationUsers(principal.organizationId),
    canAssign ? listOrganizationRoles(principal.organizationId) : Promise.resolve([]),
  ]);
  const allowedSlugs = assignableRoleSlugs(principal);
  const assignableRoles = roles.filter((role) => allowedSlugs.includes(role.slug as RoleSlug));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="People"
        description="Clerk signs people in. The role here is what they can do. Active can sign in. Disabled cannot, but stays on this list. Archived is hidden, not deleted."
      />
      {rows.length === 0 ? (
        <EmptyState>No people are recorded for this organization.</EmptyState>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const currentSlug = user.roles[0]?.slug ?? "";
              const canEditRole =
                canAssign && (currentSlug !== "managing-partner" || allowedSlugs.includes("managing-partner"));
              const isSelf = user.id === principal.id;
              return (
                <tr key={user.id}>
                  <td className="align-middle">
                    {user.fullName}
                    {isSelf ? <span className="ml-2 text-[11px] text-muted-foreground">You</span> : null}
                  </td>
                  <td className="align-middle">{user.email}</td>
                  <td className="align-middle">
                    {canEditRole ? (
                      <RoleAssignField
                        userId={user.id}
                        fullName={user.fullName}
                        currentSlug={currentSlug}
                        roles={assignableRoles.map((role) => ({ id: role.id, slug: role.slug, name: role.name }))}
                        action={assignUserRoleAction}
                      />
                    ) : (
                      user.roles.map((role) => role.name).join(", ") || "—"
                    )}
                  </td>
                  <td className="align-middle">
                    {isSelf ? (
                      <p className="text-sm text-navy">{user.status === "active" ? "Active" : user.status}</p>
                    ) : (
                      <UserStatusField
                        userId={user.id}
                        fullName={user.fullName}
                        status={user.status as "active" | "invited" | "disabled"}
                        action={setUserAccessStatusAction}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
