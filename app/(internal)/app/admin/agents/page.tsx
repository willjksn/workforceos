import { getDb } from "@/db";
import { agents } from "@/db/schema";
import { requirePermission } from "@/lib/rbac/authorize";
import { requireCurrentPrincipal } from "@/lib/auth/session";

export default async function AgentsAdminPage() {
  const principal = await requireCurrentPrincipal();
  await requirePermission(principal.id, "agents.read");
  const db = getDb();
  const rows = await db.select().from(agents);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Registry only. Agents default to disabled. No autonomous workflows yet.
      </p>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((agent) => (
            <tr key={agent.id} className="border-b">
              <td className="py-2">{agent.name}</td>
              <td>{agent.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
