import { requireAppPermission } from "@/lib/auth/guard";
import { listOrganizationRoles } from "@/lib/repositories/platform";
import { EmptyState, PageHeader } from "../../_components/ui";

export default async function AdminRolesPage() {
  const principal = await requireAppPermission("admin.roles");
  const rows = await listOrganizationRoles(principal.organizationId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Roles" description="Authorization roles stored in PostgreSQL, not Clerk metadata." />
      {rows.length === 0 ? (
        <EmptyState>No roles.</EmptyState>
      ) : (
        <ul className="mt-6 space-y-2 text-sm">
          {rows.map((role) => (
            <li key={role.id}>
              <span className="font-medium">{role.name}</span>
              <span className="text-zinc-500"> · {role.slug}</span>
              {role.description ? <p className="text-zinc-600">{role.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
