import Link from "next/link";

import { requireCurrentPrincipal } from "@/lib/auth/session";

export default async function AppHomePage() {
  const principal = await requireCurrentPrincipal();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Internal application</h1>
      <p className="mt-3 text-zinc-600">
        Phase 1 foundation is in place. CRM and Talent Network UI come later.
      </p>
      <p className="mt-6 text-sm">Signed in as {principal.id}</p>
      <p className="text-sm">Roles: {principal.roleSlugs.join(", ") || "none assigned"}</p>
      <Link className="mt-6 inline-block underline" href="/app/admin/system-health">
        Open system health
      </Link>
    </main>
  );
}
