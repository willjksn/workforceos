import { createPlacementAction, setOfferStatusAction } from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listOffers } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { PageHeader, PageShell, formatDate, formatLabel, inputClassName } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

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
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
            <th>Job</th>
            <th>Salary</th>
            <th>Expires</th>
            <th>Status</th>
            <th>Risk</th>
            <th />
          </tr>
        </thead>
        <tbody>
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
              <tr key={row.offer.id} className="border-b border-border align-top">
                <td className="py-2">{presented.fullName}</td>
                <td>{row.job.title}</td>
                <td>{row.offer.baseSalary ?? "—"}</td>
                <td>{formatDate(row.offer.expirationDate)}</td>
                <td><StatusBadge>{formatLabel(row.offer.status)}</StatusBadge></td>
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
                      <button className="text-sm underline" type="submit">Save</button>
                    </ActionForm>
                  ) : null}
                  {canPlace && row.offer.status === "accepted" ? (
                    <ActionForm action={createPlacementAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="offerId" value={row.offer.id} />
                      <input className={inputClassName} type="date" name="startDate" required />
                      <button className="text-sm underline" type="submit">Create placement</button>
                    </ActionForm>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PageShell>
  );
}
