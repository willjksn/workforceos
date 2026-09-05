import { requireAppPermission } from "@/lib/auth/guard";
import { listWatchlists } from "@/lib/repositories/talent";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow } from "../../_components/ui";

export default async function WatchlistsPage() {
  const principal = await requireAppPermission("candidates.read");
  const pools = await listWatchlists(principal.organizationId, principal.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Pools"
        title="Watchlists"
        description="User-scoped talent pools. Organization pools stay under Talent Pools."
      />
      {pools.length === 0 ? (
        <EmptyState title="No personal watchlists yet.">
          Organization pools remain on Talent Pools. A watchlist is yours, not a second candidate record.
        </EmptyState>
      ) : (
        <RecordList className="mt-6">
          {pools.map((pool) => (
            <RecordRow key={pool.id} href={`/app/talent/pools/${pool.id}`} title={pool.name} />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
