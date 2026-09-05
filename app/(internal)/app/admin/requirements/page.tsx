import { getDb } from "@/db";
import { requirements } from "@/db/schema";
import { requireCurrentPrincipal } from "@/lib/auth/session";

export default async function RequirementsAdminPage() {
  await requireCurrentPrincipal();
  const db = getDb();
  const rows = await db.select().from(requirements);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Requirements</h1>
      <ul className="mt-6 space-y-3 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="border-b pb-3">
            <strong>{row.code}</strong> — {row.title}
            <div className="text-zinc-600">
              {row.module} / {row.status}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
