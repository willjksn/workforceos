import Link from "next/link";

import { AcademyHelp } from "@/components/academy/academy-help";
import { inviteUserAction, setUserAccessStatusAction } from "@/lib/actions/admin";
import { requireAppPermission } from "@/lib/auth/guard";
import { assignableRoleSlugs } from "@/lib/rbac/assign-role";
import { isAccessTemplateSlug } from "@/lib/rbac/access-bundles";
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
import { UserStatusField } from "../_components/role-assign-field";

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
  const startingTemplates = assignableRoles.filter((role) => isAccessTemplateSlug(role.slug));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Team & Access"
        description="Organizational title is display-only. Only an Administrator with Access bundles permission (admin.roles) can assign modules or templates. Open a person to check any combination for any employee. Training follows effective access, not title."
        actions={<AcademyHelp articleSlug="module-admin-people" />}
      />
      {rows.length === 0 ? (
        <EmptyState>No people are recorded for this organization.</EmptyState>
      ) : (
        <DataTable columns={["Name", "Title", "Email", "Access bundles", "Sign-in"]}>
          {rows.map((user) => {
            const isSelf = user.id === principal.id;
            return (
              <tr key={user.id}>
                <td className="align-middle">
                  <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/admin/users/${user.id}`}>
                    {user.fullName}
                  </Link>
                  {isSelf ? <span className="ml-2 text-[11px] text-muted-foreground">You</span> : null}
                </td>
                <td className="align-middle text-muted-foreground">{user.organizationalTitle || "—"}</td>
                <td className="align-middle">{user.email}</td>
                <td className="align-middle">
                  {user.roles.map((role) => role.name).join(", ") || "—"}
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
      {canAssign && startingTemplates.length > 0 ? (
        <CreatePanel
          title="Invite person"
          description="Sends a Clerk invitation with one starting template. Add module checkboxes on their Team & Access record. Title is not a permission. Only admin.roles can invite and assign access."
        >
          <ActionForm action={inviteUserAction} className="max-w-xl space-y-3">
            <Field label="Work email" name="email">
              <input className={inputClassName} id="email" name="email" type="email" autoComplete="off" required />
            </Field>
            <Field label="Name" name="fullName">
              <input className={inputClassName} id="fullName" name="fullName" autoComplete="off" placeholder="Optional" />
            </Field>
            <Field label="Organizational title" name="organizationalTitle">
              <input
                className={inputClassName}
                id="organizationalTitle"
                name="organizationalTitle"
                autoComplete="off"
                placeholder="Display only — not an access bundle"
              />
            </Field>
            <Field label="Starting access template" name="roleSlug">
              <select className={inputClassName} id="roleSlug" name="roleSlug" required defaultValue="">
                <option value="" disabled>
                  Choose a starting template
                </option>
                {startingTemplates.map((role) => (
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
