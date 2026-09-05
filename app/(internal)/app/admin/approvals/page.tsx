import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { requireCurrentPrincipal } from "@/lib/auth/session";

export default async function ApprovalsAdminPage() {
  await requireCurrentPrincipal();
  const db = getDb();
  const rows = await db.select().from(approvals).orderBy(desc(approvals.createdAt)).limit(50);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Approvals</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Type</th>
            <th>Status</th>
            <th>Record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-2">{row.approvalType}</td>
              <td>{row.status}</td>
              <td>
                {row.recordType}:{row.recordId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
