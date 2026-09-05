import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listWatchlists } from "@/lib/repositories/talent";
import { EmptyState, PageHeader } from "../../_components/ui";

export default async function WatchlistsPage() {
  const principal = await requireAppPermission("candidates.read");
  const pools = await listWatchlists(principal.organizationId, principal.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Watchlists"
        description="User-scoped talent pools. Organization pools stay under Talent Pools."
      />
      {pools.length === 0 ? (
        <EmptyState>No personal watchlists yet.</EmptyState>
      ) : (
        <ul className="mt-6 space-y-2 text-sm">
          {pools.map((pool) => (
            <li key={pool.id}>
              <Link className="underline" href={`/app/talent/pools/${pool.id}`}>
                {pool.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
