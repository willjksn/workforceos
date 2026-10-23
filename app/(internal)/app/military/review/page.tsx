import { reviewOccupationCapabilityAction, reviewCandidateCapabilityAction } from "@/lib/actions/capability-translation";
import { reviewMilitaryMappingAction } from "@/lib/actions/military";
import { loadMappingCounts } from "@/lib/outcome-learning/load";
import { bandLabel, evidenceBand } from "@/lib/outcome-learning/thresholds";
import { windowBounds } from "@/lib/outcome-learning/windows";
import { buttonClassName } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { listPendingCapabilityReviews } from "@/lib/military-talent/capability-profile";
import { listMappingReviewQueue } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Card, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function MilitaryReviewPage() {
  const principal = await requireAppPermission("military.read");
  const queue = await listMappingReviewQueue();
  const capabilities = await listPendingCapabilityReviews(principal.organizationId);
  const canReview = can(principal, "military.review");
  const now = new Date();
  const bounds = windowBounds("90d", now);
  const mappingOutcomes = await loadMappingCounts(principal.organizationId, bounds.start, bounds.end);
  const outcomeByMapping = new Map(mappingOutcomes.map((row) => [row.mappingId, row]));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Mapping review"
        description="Agent-created mappings start pending and cannot self-approve. Human review is audited."
      />
      <MilitarySubnav active="/app/military/review" />
      <h2 className="mt-8 section-title">Occupation capabilities</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Reference knowledge for an occupation. Approving one does not give that capability to every person who held the occupation.
      </p>
      {capabilities.occupationSkills.length === 0 ? (
        <EmptyState title="No pending occupation capabilities.">
          AI and unreviewed fixture links wait here. The originating agent cannot approve them.
        </EmptyState>
      ) : (
        <div className="mt-4 space-y-3">
          {capabilities.occupationSkills.map((row) => (
            <Card key={row.link.id}>
              <p className="font-medium text-navy">
                {row.occupation.code} · {row.skill.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatLabel(row.link.reviewStatus)} · {row.link.mappingQuality}
                {row.link.evidenceReference ? ` · ${row.link.evidenceReference}` : ""}
              </p>
              <MappingOutcomeNote signal={outcomeByMapping.get(row.link.id)} />
              {canReview ? (
                <ActionForm action={reviewOccupationCapabilityAction} className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="occupationSkillId" value={row.link.id} />
                  <button name="status" value="approved" className={buttonClassName("primary")} type="submit">Approve</button>
                  <button name="status" value="rejected" className={buttonClassName("secondary")} type="submit">Reject</button>
                  <button name="status" value="needs_review" className={buttonClassName("secondary")} type="submit">Mark needs evidence</button>
                </ActionForm>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <h2 id="candidate-capabilities" className="mt-8 section-title">Candidate capabilities</h2>
      {capabilities.candidateRows.length === 0 ? (
        <EmptyState title="No pending candidate capabilities in this organization.">
          Person-specific drafts stay pending until a recruiter or reviewer approves them.
        </EmptyState>
      ) : (
        <div className="mt-4 space-y-3">
          {capabilities.candidateRows.map((row) => (
            <Card key={row.link.id}>
              <p className="font-medium text-navy">{row.candidate.fullName} · {row.skill.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatLabel(row.link.capabilityBasis)} · {row.link.evidenceSummary}
              </p>
              {canReview ? (
                <ActionForm action={reviewCandidateCapabilityAction} className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="candidateSkillId" value={row.link.id} />
                  <button name="status" value="approved" className={buttonClassName("primary")} type="submit">Approve</button>
                  <button name="status" value="rejected" className={buttonClassName("secondary")} type="submit">Reject</button>
                  <button name="status" value="needs_review" className={buttonClassName("secondary")} type="submit">Mark needs evidence</button>
                </ActionForm>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <h2 className="mt-8 section-title">Military → civilian titles</h2>
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

function MappingOutcomeNote({
  signal,
}: {
  signal: {
    candidates: number;
    matches: number;
    interviews: number;
    placements: number;
    noFit: number;
  } | undefined;
}) {
  if (!signal) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        No organization outcome count in the last 90 days. This does not change the mapping status.
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      Last 90 days, this organization: {signal.candidates} approved people, {signal.matches} matches, {signal.interviews} interviews, {signal.placements} placements, {signal.noFit} Not a Fit. Sample size {Math.max(signal.matches, signal.candidates)}. {bandLabel(evidenceBand(Math.max(signal.matches, signal.candidates)))}. A person decides whether that context matters. The status is not changed here.
    </p>
  );
}
