import { PrimaryButton, buttonClassName } from "@/components/ui/button";
import {
  draftCandidateCapabilitiesAction,
  reviewCandidateCapabilityAction,
} from "@/lib/actions/capability-translation";
import {
  basisLabel,
  reviewStateLabel,
  type ReviewStatus,
} from "@/lib/military/capability-translation";
import type { loadCapabilityProfile } from "@/lib/military-talent/capability-profile";
import type { loadTransitionEvidence } from "@/lib/military-talent/transition-evidence";

import { ActionForm } from "../../../_components/action-form";
import { formatLabel } from "../../../_components/ui";

type Evidence = Awaited<ReturnType<typeof loadTransitionEvidence>>;
type Translation = Awaited<ReturnType<typeof loadCapabilityProfile>>;

function CapabilityCard({
  row,
  profileId,
  canReview,
}: {
  row: Translation["proposed"][number];
  profileId: string;
  canReview: boolean;
}) {
  return (
    <article className="rounded-[8px] border border-card-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-navy">{row.skillName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {basisLabel(row.basis)}
            {row.competencyCluster ? ` · ${row.competencyCluster}` : ""}
            {row.confidence != null ? ` · confidence ${row.confidence}` : ""}
          </p>
        </div>
        <p className="text-sm font-medium text-navy">{reviewStateLabel(row.reviewStatus as ReviewStatus)}</p>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {row.evidence.length === 0 ? <li>No evidence citation is stored for this capability.</li> : null}
        {row.evidence.map((item) => (
          <li key={`${item.evidenceType}-${item.evidenceId}`}>{item.citation}</li>
        ))}
      </ul>
      {canReview && row.reviewStatus !== "approved" ? (
        <div className="mt-3 space-y-2">
          <ActionForm action={reviewCandidateCapabilityAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="candidateSkillId" value={row.id} />
            <input type="hidden" name="profileId" value={profileId} />
            <button name="status" value="approved" className={buttonClassName("primary")} type="submit">
              Approve
            </button>
            <button name="status" value="rejected" className={buttonClassName("secondary")} type="submit">
              Reject
            </button>
            <button name="status" value="needs_review" className={buttonClassName("secondary")} type="submit">
              Mark needs evidence
            </button>
          </ActionForm>
          <ActionForm action={reviewCandidateCapabilityAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="candidateSkillId" value={row.id} />
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="status" value="approved" />
            <label className="block min-w-64 flex-1 text-sm">
              Edit citation, then approve
              <input name="citation" className="mt-1 w-full rounded-[6px] border border-border px-3 py-2 text-sm" />
            </label>
            <PrimaryButton>Edit and approve</PrimaryButton>
          </ActionForm>
        </div>
      ) : null}
    </article>
  );
}

export function CapabilityTranslationSection({
  profileId,
  candidateId,
  evidence,
  translation,
  canDraft,
  canReview,
}: {
  profileId: string;
  candidateId: string;
  evidence: Evidence;
  translation: Translation;
  canDraft: boolean;
  canReview: boolean;
}) {
  return (
    <section id="capability-translation" className="scroll-mt-6">
      <h2 className="section-title">Capability translation</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Military evidence becomes civilian capabilities, then civilian occupations and job families.
        The same occupation does not copy every reference capability onto a person. Pending and rejected
        capabilities stay off employer-facing translation. This does not rank jobs or submit a candidate.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-navy">Military evidence</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {evidence.experiences.map((row) => (
              <li key={row.experience.id}>
                {formatLabel(row.occupation.branch)} {row.occupation.code} · {row.occupation.title}
                {row.experience.leadershipLevel ? ` · leadership ${row.experience.leadershipLevel}` : ""}
              </li>
            ))}
            {evidence.duties.map((row) => (
              <li key={row.id}>Duty: {row.title}{row.description ? ` — ${row.description}` : ""}</li>
            ))}
            {evidence.equipment.map((row) => (
              <li key={row.id}>Equipment: {row.name}{row.description ? ` — ${row.description}` : ""}</li>
            ))}
            {evidence.training.map((row) => (
              <li key={row.id}>Training: {row.schoolName}{row.description ? ` — ${row.description}` : ""}</li>
            ))}
            {evidence.credentials.map((row) => (
              <li key={row.id}>Credential: {row.name}</li>
            ))}
            {evidence.clearance ? (
              <li>Reported clearance: {formatLabel(evidence.clearance.clearanceLevel)}. Not an independent verification.</li>
            ) : null}
            {evidence.experiences.length === 0 && evidence.duties.length === 0 ? <li>No structured military evidence yet.</li> : null}
          </ul>
          {canDraft ? (
            <ActionForm action={draftCandidateCapabilitiesAction} className="mt-4">
              <input type="hidden" name="candidateId" value={candidateId} />
              <input type="hidden" name="profileId" value={profileId} />
              <PrimaryButton>Draft capabilities from evidence</PrimaryButton>
            </ActionForm>
          ) : null}
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-navy">Proposed civilian capabilities</h3>
            <div className="mt-2 space-y-3">
              {translation.proposed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending capabilities. Drafting does nothing when evidence does not support a catalog skill.</p>
              ) : (
                translation.proposed.map((row) => (
                  <CapabilityCard key={row.id} row={row} profileId={profileId} canReview={canReview} />
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-navy">Reviewed capabilities</h3>
            <div className="mt-2 space-y-3">
              {translation.reviewed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No human-reviewed capabilities yet. Employer-facing translation uses this list.</p>
              ) : (
                translation.reviewed.map((row) => (
                  <CapabilityCard key={row.id} row={row} profileId={profileId} canReview={false} />
                ))
              )}
            </div>
          </div>
          {translation.excluded.length ? (
            <div>
              <h3 className="text-sm font-medium text-navy">Excluded</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {translation.excluded.map((row) => (
                  <li key={row.id}>{row.skillName} · {reviewStateLabel(row.reviewStatus)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-navy">Potential civilian occupations and job families</h3>
        <div className="mt-2 space-y-3">
          {translation.occupations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Occupations appear when reviewed capabilities overlap a civilian occupation&apos;s skills. Title similarity is not enough.
            </p>
          ) : (
            translation.occupations.map((occupation) => (
              <article key={occupation.occupationId} className="rounded-[8px] border border-card-border bg-card p-4 text-sm">
                <p className="font-medium text-navy">{occupation.title}</p>
                {occupation.jobFamilies.length ? (
                  <p className="mt-1 text-muted-foreground">Job families: {occupation.jobFamilies.join(", ")}</p>
                ) : null}
                <p className="mt-2">{occupation.why}</p>
                <p className="mt-2 text-muted-foreground">Supporting capabilities</p>
                <ul className="mt-1 list-disc pl-5">
                  {occupation.supporting.map((item) => (
                    <li key={item.skillId}>
                      {item.skillName}
                      {item.citations.length ? ` — ${item.citations.join(" ")}` : ""}
                    </li>
                  ))}
                </ul>
                {occupation.gaps.length ? (
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {occupation.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
