import { requireAppPermission } from "@/lib/auth/guard";
import { listOrganizationUsers } from "@/lib/repositories/platform";
import { EmptyState, PageHeader } from "../../_components/ui";

export default async function AdminUsersPage() {
  const principal = await requireAppPermission("admin.users");
  const rows = await listOrganizationUsers(principal.organizationId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Users"
        description="Local PostgreSQL users. Clerk authenticates; these records authorize. User creation stays invite-only."
      />
      {rows.length === 0 ? (
        <EmptyState>No users.</EmptyState>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-2">{user.fullName}</td>
                <td>{user.email}</td>
                <td>{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
