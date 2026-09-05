import { reviewMilitaryMappingAction } from "@/lib/actions/military";
import { buttonClassName } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { listMappingReviewQueue } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Card, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";
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
        <EmptyState title="No pending civilian mappings.">
          Agent-created mappings wait here. They cannot approve themselves.
        </EmptyState>
      ) : (
        <div className="mt-4 space-y-3">
          {queue.mappings.map((row) => (
            <Card key={row.mapping.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-navy">
                    {row.military.code} → {row.civilian.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Origin {formatLabel(row.mapping.origin)}
                    {row.mapping.explanation ? ` · ${row.mapping.explanation}` : ""}
                  </p>
                </div>
                <StatusBadge tone="warning">{formatLabel(row.mapping.reviewStatus)}</StatusBadge>
              </div>
              {canReview ? (
                <ActionForm action={reviewMilitaryMappingAction} className="mt-4 flex gap-2">
                  <input type="hidden" name="mappingId" value={row.mapping.id} />
                  <button name="status" value="approved" className={buttonClassName("primary")} type="submit">
                    Approve
                  </button>
                  <button name="status" value="rejected" className={buttonClassName("secondary")} type="submit">
                    Reject
                  </button>
                </ActionForm>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
