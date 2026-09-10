import Link from "next/link";
import { notFound } from "next/navigation";

import {
  copyUserAccessAction,
  resetUserPermissionOverridesAction,
  setUserAccessBundlesAction,
  setUserAccessStatusAction,
  setUserOrganizationalTitleAction,
  setUserPermissionOverrideAction,
} from "@/lib/actions/admin";
import { setUserManagerAction } from "@/lib/actions/staff-onboarding";
import { getAcademyArticle } from "@/lib/academy/catalog";
import { academyArticleHref } from "@/lib/academy/types";
import { requireAppPermission } from "@/lib/auth/guard";
import { assignableRoleSlugs } from "@/lib/rbac/assign-role";
import { isAccessTemplateSlug, isFunctionalBundleSlug } from "@/lib/rbac/access-bundles";
import { PERMISSIONS, can, type RoleSlug } from "@/lib/rbac/permissions";
import { getOrganizationUser, listOrganizationRoles, listOrganizationUsers } from "@/lib/repositories/platform";
import { STAFF_ONBOARDING_CADENCE_LABELS, STAFF_POLICY_LABELS } from "@/lib/staff-onboarding";
import { getStaffOnboardingSnapshot } from "@/lib/staff-onboarding/service";
import { ActionForm } from "../../../_components/action-form";
import {
  CreatePanel,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionHeader,
  inputClassName,
} from "../../../_components/ui";
import { UserStatusField } from "../../_components/role-assign-field";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("admin.users");
  const { id } = await params;
  const canAssign = can(principal, "admin.roles");
  const [detail, roles, people] = await Promise.all([
    getOrganizationUser(principal.organizationId, id),
    canAssign ? listOrganizationRoles(principal.organizationId) : Promise.resolve([]),
    listOrganizationUsers(principal.organizationId),
  ]);
  if (!detail) notFound();
  const onboarding = await getStaffOnboardingSnapshot({ actor: principal, userId: id });
  const managerChoices = people.filter((person) => person.id !== detail.user.id);

  const allowedSlugs = assignableRoleSlugs(principal);
  const assignableRoles = roles.filter((role) => allowedSlugs.includes(role.slug as RoleSlug));
  const moduleRoles = assignableRoles.filter((role) => isFunctionalBundleSlug(role.slug));
  const templateRoles = assignableRoles.filter((role) => isAccessTemplateSlug(role.slug));
  const assignedSlugs = new Set(detail.roles.map((role) => role.slug));
  const isSelf = detail.user.id === principal.id;
  const copySources = people.filter((person) => person.id !== detail.user.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin · Team & Access"
        title={detail.user.fullName}
        description="Title is display-only. Only an Administrator with Access bundles permission can change modules or templates. Check any combination for this person. Effective permissions are the union of assigned bundles, then grant/deny overrides. Deny wins."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link className="text-sm text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/admin/users/${detail.user.id}/onboarding`}>
              Staff onboarding
            </Link>
            <Link className="text-sm text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href="/app/admin/users">
              Back to Team & Access
            </Link>
          </div>
        }
        metadata={
          <p>
            {detail.user.email}
            {isSelf ? " · You" : ""}
          </p>
        }
      />

      <section className="mt-8 space-y-4">
        <SectionHeader
          title="Profile"
          description="Name and email come from the local user record. Organizational title never grants access."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-navy">Name</p>
            <p className="mt-1 text-sm text-muted-foreground">{detail.user.fullName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-navy">Email</p>
            <p className="mt-1 text-sm text-muted-foreground">{detail.user.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-navy">Manager</p>
            <p className="mt-1 text-sm text-muted-foreground">{onboarding.manager?.fullName ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-navy">Sign-in</p>
            <div className="mt-1">
              {isSelf ? (
                <p className="text-sm text-navy">{detail.user.status === "active" ? "Active" : detail.user.status}</p>
              ) : (
                <UserStatusField
                  userId={detail.user.id}
                  fullName={detail.user.fullName}
                  status={detail.user.status as "active" | "invited" | "disabled"}
                  action={setUserAccessStatusAction}
                />
              )}
            </div>
          </div>
        </div>
        <ActionForm action={setUserOrganizationalTitleAction} className="max-w-xl space-y-3">
          <input type="hidden" name="userId" value={detail.user.id} />
          <Field label="Organizational title" name="organizationalTitle">
            <input
              className={inputClassName}
              id="organizationalTitle"
              name="organizationalTitle"
              defaultValue={detail.user.organizationalTitle ?? ""}
              placeholder="e.g. Managing Partner — display only"
            />
          </Field>
          <PrimaryButton>Save title</PrimaryButton>
        </ActionForm>
        <ActionForm action={setUserManagerAction} className="max-w-xl space-y-3">
          <input type="hidden" name="userId" value={detail.user.id} />
          <Field label="Manager" name="managerId">
            <select className={inputClassName} id="managerId" name="managerId" defaultValue={detail.user.managerId ?? ""}>
              <option value="">No manager</option>
              {managerChoices.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </Field>
          <PrimaryButton>Save manager</PrimaryButton>
        </ActionForm>
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Module access"
          description="Check any combination for this employee. Title does not grant these. Only admin.roles can save. Recruiter Standard still has no commercial opportunities unless you also check CRM & Business Development."
        />
        {canAssign && moduleRoles.length > 0 ? (
          <ActionForm action={setUserAccessBundlesAction} className="space-y-8">
            <input type="hidden" name="userId" value={detail.user.id} />
            <ul className="grid gap-2 sm:grid-cols-2">
              {moduleRoles.map((role) => (
                <li key={role.id}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="roleSlug"
                      value={role.slug}
                      defaultChecked={assignedSlugs.has(role.slug)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-navy">{role.name}</span>
                      {role.description ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{role.description}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div>
              <SectionHeader
                title="Access templates"
                description="Shortcuts only. They do not lock module checkboxes. A person can hold templates and modules together."
              />
              <ul className="mt-3 space-y-2">
                {templateRoles.map((role) => (
                  <li key={role.id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="roleSlug"
                        value={role.slug}
                        defaultChecked={assignedSlugs.has(role.slug)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium text-navy">{role.name}</span>
                        {role.description ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{role.description}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <PrimaryButton>Save access</PrimaryButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted-foreground">
            {detail.roles.map((role) => role.name).join(", ") || "No access assigned."}{" "}
            {canAssign ? "" : "You can view this record. Assigning access requires admin.roles."}
          </p>
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Effective permissions"
          description="Server-side result after bundle union and overrides. Hiding a screen is not security."
        />
        {detail.effectivePermissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No effective permissions.</p>
        ) : (
          <ul className="columns-1 gap-x-8 text-sm text-navy sm:columns-2">
            {detail.effectivePermissions.map((permission) => (
              <li key={permission} className="break-inside-avoid py-0.5">
                {permission}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canAssign ? (
        <section className="mt-10 space-y-6">
          <SectionHeader
            title="Permission overrides"
            description="Optional per-person grant or deny. Applied after bundle union. Explicit deny overrides a bundle grant. Explicit grant adds a permission."
          />
          {detail.overrides.length > 0 ? (
            <ul className="mb-4 space-y-1 text-sm">
              {detail.overrides.map((override) => (
                <li key={override.permission}>
                  <span className="font-medium text-navy">{override.effect}</span>
                  <span className="text-muted-foreground"> · {override.permission}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No overrides.</p>
          )}
          <ActionForm action={setUserPermissionOverrideAction} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <input type="hidden" name="userId" value={detail.user.id} />
            <Field label="Permission" name="permission">
              <select className={inputClassName} id="permission" name="permission" required defaultValue="">
                <option value="" disabled>
                  Choose a permission
                </option>
                {PERMISSIONS.map((permission) => (
                  <option key={permission} value={permission}>
                    {permission}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Effect" name="effect">
              <select className={inputClassName} id="effect" name="effect" defaultValue="grant">
                <option value="grant">Grant</option>
                <option value="deny">Deny</option>
              </select>
            </Field>
            <div className="flex items-end">
              <PrimaryButton>Save override</PrimaryButton>
            </div>
          </ActionForm>
          <ActionForm action={resetUserPermissionOverridesAction}>
            <input type="hidden" name="userId" value={detail.user.id} />
            <button className="text-sm text-navy underline decoration-border underline-offset-4 hover:decoration-teal" type="submit">
              Reset overrides
            </button>
          </ActionForm>
        </section>
      ) : null}

      {canAssign && copySources.length > 0 ? (
        <CreatePanel
          title="Copy access from another person"
          description="Copies their access bundles. Optionally also copies grant/deny overrides."
        >
          <ActionForm action={copyUserAccessAction} className="max-w-xl space-y-3">
            <input type="hidden" name="targetUserId" value={detail.user.id} />
            <Field label="Copy from" name="sourceUserId">
              <select className={inputClassName} id="sourceUserId" name="sourceUserId" required defaultValue="">
                <option value="" disabled>
                  Choose a person
                </option>
                {copySources.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                    {person.roles.length ? ` — ${person.roles.map((role) => role.name).join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Include overrides" name="includeOverrides">
              <select className={inputClassName} id="includeOverrides" name="includeOverrides" defaultValue="yes">
                <option value="yes">Bundles and overrides</option>
                <option value="no">Bundles only</option>
              </select>
            </Field>
            <PrimaryButton>Copy access</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}

      <section className="mt-10">
        <SectionHeader
          title="Required training"
          description="Required from effective access, not title. Completion does not grant permissions."
        />
        <p className="mb-3 text-sm text-muted-foreground">
          Staff cadence: {STAFF_ONBOARDING_CADENCE_LABELS[onboarding.record.cadence]} ·{" "}
          <Link className="text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/admin/users/${detail.user.id}/onboarding`}>
            Open staff onboarding
          </Link>
        </p>
        <ul className="space-y-1 text-sm">
          {onboarding.requiredTraining.map((slug) => {
            const article = getAcademyArticle(slug);
            const done = onboarding.completedSlugs.includes(slug);
            return (
              <li key={slug}>
                <Link className="text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={academyArticleHref(slug)}>
                  {article?.title ?? slug}
                </Link>
                <span className="text-muted-foreground">{done ? " · Completed" : " · Required"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeader title="Systems / equipment" description="Stored checklist. Not a procurement system." />
        <ul className="space-y-1 text-sm text-muted-foreground">
          {onboarding.equipment.map((item) => (
            <li key={item.itemKey}>
              {item.itemKey.replaceAll("_", " ")}
              {item.completedAt ? " · ready" : " · pending"}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeader title="Policy acknowledgements" description="Timestamped. Not a legal CMS." />
        <ul className="space-y-1 text-sm text-muted-foreground">
          {onboarding.policies.map((policy) => (
            <li key={policy.policyKey}>
              {STAFF_POLICY_LABELS[policy.policyKey]}
              {policy.acknowledgedAt ? ` · ${policy.acknowledgedAt.toLocaleString()}` : " · not acknowledged"}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
