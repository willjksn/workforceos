import { createPlacementAction, setOfferStatusAction } from "@/lib/actions/recruiting";
import { buttonClassName } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listOffers } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import {
  DataTable,
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
  formatDate,
  formatLabel,
  inputClassName,
} from "../_components/ui";

export default async function OffersPage() {
  const principal = await requireAppPermission("offers.read");
  const rows = await listOffers(principal.organizationId);
  const canWrite = can(principal, "offers.write");
  const canPlace = can(principal, "placements.write");
  const canReadPii = can(principal, "candidate_pii.read");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Offers"
        description="Offers are recorded, not sent. Risk flags are operational notes, not automated negotiation."
      />
      {rows.length === 0 ? (
        <EmptyState title="No offers recorded.">
          Record an offer from a completed interview. Sending the offer to the candidate stays outside this screen.
        </EmptyState>
      ) : (
        <DataTable columns={["Candidate", "Job", "Salary", "Expires", "Status", "Risk", "Actions"]}>
          {rows.map((row) => {
            const presented = presentCandidate(row.candidate, canReadPii);
            const risks = [
              row.offer.compensationGap ? "comp gap" : null,
              row.offer.candidateHesitation ? "hesitation" : null,
              row.offer.competingOffer ? "competing" : null,
              row.offer.delayedClientProcess ? "delay" : null,
              row.offer.relocationConcern ? "relocation" : null,
            ].filter(Boolean);
            return (
              <tr key={row.offer.id} className="align-top">
                <td>{presented.fullName}</td>
                <td>{row.job.title}</td>
                <td>{row.offer.baseSalary ?? "—"}</td>
                <td>{formatDate(row.offer.expirationDate)}</td>
                <td>
                  <StatusBadge>{formatLabel(row.offer.status)}</StatusBadge>
                </td>
                <td>{risks.join(", ") || "—"}</td>
                <td>
                  {canWrite ? (
                    <ActionForm action={setOfferStatusAction} className="flex gap-2">
                      <input type="hidden" name="offerId" value={row.offer.id} />
                      <select className={inputClassName} name="status" defaultValue={row.offer.status}>
                        <option value="draft">draft</option>
                        <option value="extended">extended</option>
                        <option value="accepted">accepted</option>
                        <option value="declined">declined</option>
                        <option value="withdrawn">withdrawn</option>
                        <option value="expired">expired</option>
                      </select>
                      <button className={buttonClassName("ghost")} type="submit">
                        Save
                      </button>
                    </ActionForm>
                  ) : null}
                  {canPlace && row.offer.status === "accepted" ? (
                    <ActionForm action={createPlacementAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="offerId" value={row.offer.id} />
                      <input className={inputClassName} type="date" name="startDate" required />
                      <button className={buttonClassName("ghost")} type="submit">
                        Create placement
                      </button>
                    </ActionForm>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </PageShell>
  );
}
