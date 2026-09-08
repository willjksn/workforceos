import { assignUserRoleAction, inviteUserAction, setUserAccessStatusAction } from "@/lib/actions/admin";
import { requireAppPermission } from "@/lib/auth/guard";
import { assignableRoleSlugs } from "@/lib/rbac/assign-role";
import { can, type RoleSlug } from "@/lib/rbac/permissions";
import { listOrganizationRoles, listOrganizationUsers } from "@/lib/repositories/platform";
import { ActionForm } from "../../_components/action-form";
import {
  CreatePanel,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  inputClassName,
} from "../../_components/ui";
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
        description="Invite from this page and pick their role at the same time. Clerk emails the invite. The role is stored here, so the first sign-in is not Command Center-only. Active can sign in. Disabled cannot, but stays on this list. Archived is hidden, not deleted."
      />
      {rows.length === 0 ? (
        <EmptyState>No people are recorded for this organization.</EmptyState>
      ) : (
        <DataTable columns={["Name", "Email", "Role", "Access"]}>
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
        </DataTable>
      )}
      {canAssign && assignableRoles.length > 0 ? (
        <CreatePanel
          title="Invite person"
          description="Sends a Clerk invitation email and records them as invited with the role you choose. When they accept and sign in, that role is already assigned."
        >
          <ActionForm action={inviteUserAction} className="max-w-xl space-y-3">
            <Field label="Work email" name="email">
              <input className={inputClassName} id="email" name="email" type="email" autoComplete="off" required />
            </Field>
            <Field label="Name" name="fullName">
              <input className={inputClassName} id="fullName" name="fullName" autoComplete="off" placeholder="Optional" />
            </Field>
            <Field label="Role" name="roleSlug">
              <select className={inputClassName} id="roleSlug" name="roleSlug" required defaultValue="">
                <option value="" disabled>
                  Choose a role
                </option>
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.slug}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
            <PrimaryButton>Send invite</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
