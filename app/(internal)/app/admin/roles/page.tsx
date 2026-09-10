import { requireAppPermission } from "@/lib/auth/guard";
import { isFunctionalBundleSlug } from "@/lib/rbac/access-bundles";
import { guideForRole } from "@/lib/rbac/role-guide";
import { listOrganizationRoles } from "@/lib/repositories/platform";
import { DataTable, EmptyState, PageHeader, PageShell, SectionHeader } from "../../_components/ui";
import { TeamAccessSubnav } from "../_components/team-access-subnav";

export default async function AdminRolesPage() {
  const principal = await requireAppPermission("admin.roles");
  const rows = await listOrganizationRoles(principal.organizationId);
  const modules = rows.filter((role) => isFunctionalBundleSlug(role.slug));
  const templates = rows.filter((role) => !isFunctionalBundleSlug(role.slug));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Access bundles"
        description="Module checkboxes are functions. Templates are shortcuts. Job titles are display-only. Only admin.roles can assign either on Team & Access. Clerk authenticates; it does not grant access. Only a Managing Partner can grant Managing Partner."
      />
      <TeamAccessSubnav active="/app/admin/roles" />
      {rows.length === 0 ? (
        <EmptyState>No access bundles are configured for this organization.</EmptyState>
      ) : (
        <div className="space-y-10">
          <section>
            <SectionHeader title="Modules" description="Assign these to any employee. They union; they do not overwrite each other." />
            <DataTable columns={["Module", "Who it is for", "What they can do", "People"]}>
              {modules.map((role) => {
                const guide = guideForRole(role.slug);
                return (
                  <tr key={role.id}>
                    <td className="align-top">
                      <p className="font-medium text-navy">{role.name}</p>
                    </td>
                    <td className="align-top text-muted-foreground">{guide.audience}</td>
                    <td className="align-top text-muted-foreground">{guide.access}</td>
                    <td className="align-top">{Number(role.assignedCount)}</td>
                  </tr>
                );
              })}
            </DataTable>
          </section>
          <section>
            <SectionHeader title="Templates" description="Job-shaped shortcuts. Applying one does not prevent later module changes." />
            <DataTable columns={["Template", "Who it is for", "What they can do", "People"]}>
              {templates.map((role) => {
                const guide = guideForRole(role.slug);
                return (
                  <tr key={role.id}>
                    <td className="align-top">
                      <p className="font-medium text-navy">{role.name}</p>
                    </td>
                    <td className="align-top text-muted-foreground">{guide.audience}</td>
                    <td className="align-top text-muted-foreground">{guide.access}</td>
                    <td className="align-top">{Number(role.assignedCount)}</td>
                  </tr>
                );
              })}
            </DataTable>
          </section>
        </div>
      )}
    </PageShell>
  );
}
