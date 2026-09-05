import { reviewMilitaryMappingAction } from "@/lib/actions/military";
import { requireAppPermission } from "@/lib/auth/guard";
import { listMappingReviewQueue } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function MilitaryReviewPage() {
  const principal = await requireAppPermission("military.read");
  const queue = await listMappingReviewQueue();
  const canReview = can(principal, "military.review");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Mapping review"
        description="Agent-created mappings start pending and cannot self-approve. Human review is audited."
      />
      <MilitarySubnav active="/app/military/review" />
      <h2 className="mt-8 section-title">Military → civilian</h2>
      {queue.mappings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No pending civilian mappings.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {queue.mappings.map((row) => (
            <li key={row.mapping.id} className="rounded-[8px] border border-border p-4">
              <p>{row.military.code} → {row.civilian.title} · {formatLabel(row.mapping.reviewStatus)} · origin {row.mapping.origin}</p>
              <p className="mt-1 text-muted-foreground">{row.mapping.explanation}</p>
              {canReview ? (
                <ActionForm action={reviewMilitaryMappingAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="mappingId" value={row.mapping.id} />
                  <button name="status" value="approved" className="text-sm underline" type="submit">Approve</button>
                  <button name="status" value="rejected" className="text-sm underline" type="submit">Reject</button>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
