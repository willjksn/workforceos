import Link from "next/link";

import { updateAcademyTrainingAction } from "@/lib/actions/academy";
import {
  acknowledgeStaffPolicyAction,
  recordStaffOnboardingWeek4ReviewAction,
  setStaffEquipmentItemAction,
  setStaffOnboardingCadenceAction,
  setStaffOnboardingMilestoneAction,
} from "@/lib/actions/staff-onboarding";
import { getAcademyArticle } from "@/lib/academy/catalog";
import { academyArticleHref } from "@/lib/academy/types";
import {
  EQUIPMENT_ITEM_LABELS,
  STAFF_ONBOARDING_CADENCE_LABELS,
  STAFF_ONBOARDING_CADENCES,
  STAFF_POLICY_LABELS,
  type EquipmentItemKey,
} from "@/lib/staff-onboarding";
import type { getStaffOnboardingSnapshot } from "@/lib/staff-onboarding/service";
import { buttonClassName } from "@/components/ui/button";
import { ActionForm } from "./action-form";
import { Field, PrimaryButton, SectionHeader, inputClassName } from "./ui";

type Snapshot = Awaited<ReturnType<typeof getStaffOnboardingSnapshot>>;

function StateLabel({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={done ? "text-navy" : "text-muted-foreground"}>{done ? "Done" : label}</span>
  );
}

export function StaffOnboardingPanel({
  snapshot,
  showAdminControls,
}: {
  snapshot: Snapshot;
  showAdminControls: boolean;
}) {
  const { user, record, isSelf } = snapshot;
  const canComplete = isSelf || showAdminControls;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          title="Cadence"
          description="Tracked state, not a calendar. Completing Academy or this checklist never grants permissions."
        />
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Tracked</dt>
            <dd className="mt-1 font-medium text-navy">{STAFF_ONBOARDING_CADENCE_LABELS[record.cadence]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Derived from work</dt>
            <dd className="mt-1 text-navy">{STAFF_ONBOARDING_CADENCE_LABELS[snapshot.derivedCadence]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Elapsed suggestion</dt>
            <dd className="mt-1 text-navy">{STAFF_ONBOARDING_CADENCE_LABELS[snapshot.suggestedCadence]}</dd>
          </div>
        </dl>
        {showAdminControls && !record.week4ReviewedAt ? (
          <ActionForm action={setStaffOnboardingCadenceAction} className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Set tracked cadence" name="cadence">
              <select className={inputClassName} id="cadence" name="cadence" defaultValue={record.cadence}>
                {STAFF_ONBOARDING_CADENCES.filter((value) => value !== "complete").map((value) => (
                  <option key={value} value={value}>
                    {STAFF_ONBOARDING_CADENCE_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <PrimaryButton>Save cadence</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section>
        <SectionHeader
          title="Day 1 — Company, security, WorkforceOS basics"
          description="Academy: Getting Started, Operating Model, and Security. Also complete the systems checklist and Security & Candidate Privacy acknowledgement."
        />
        <ul className="space-y-2 text-sm">
          {snapshot.day1Slugs.map((slug) => {
            const article = getAcademyArticle(slug);
            const done = snapshot.completedSlugs.includes(slug);
            return (
              <li key={slug} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
                <Link className="text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={academyArticleHref(slug)}>
                  {article?.title ?? slug}
                </Link>
                {isSelf && !done ? (
                  <ActionForm action={updateAcademyTrainingAction}>
                    <input type="hidden" name="moduleSlug" value={slug} />
                    <button className={buttonClassName("primary")} name="status" value="completed" type="submit">
                      Mark complete
                    </button>
                  </ActionForm>
                ) : (
                  <StateLabel done={done} label="Required" />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeader
          title="Systems / equipment"
          description="Lightweight checklist only. This is not a procurement system."
        />
        <ul className="space-y-2 text-sm">
          {snapshot.equipment.map((item) => (
            <li key={item.itemKey} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
              <span>{EQUIPMENT_ITEM_LABELS[item.itemKey as EquipmentItemKey]}</span>
              {canComplete && !item.completedAt ? (
                <ActionForm action={setStaffEquipmentItemAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="itemKey" value={item.itemKey} />
                  <button className="text-sm text-teal underline" name="complete" value="yes" type="submit">
                    Mark ready
                  </button>
                </ActionForm>
              ) : (
                <StateLabel done={Boolean(item.completedAt)} label="Pending" />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeader
          title="Policy acknowledgements"
          description="Timestamped acknowledgements. Not a legal CMS. Completing this does not change access."
        />
        <ul className="space-y-2 text-sm">
          {snapshot.policies.map((policy) => (
            <li key={policy.policyKey} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
              <span>
                {STAFF_POLICY_LABELS[policy.policyKey]}
                {policy.acknowledgedAt ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Acknowledged {policy.acknowledgedAt.toLocaleString()}
                  </span>
                ) : null}
              </span>
              {canComplete && !policy.acknowledgedAt ? (
                <ActionForm action={acknowledgeStaffPolicyAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="policyKey" value={policy.policyKey} />
                  <PrimaryButton>Acknowledge</PrimaryButton>
                </ActionForm>
              ) : (
                <StateLabel done={Boolean(policy.acknowledgedAt)} label="Required" />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeader
          title="Week 1 — Access-specific workflows"
          description="Required Academy modules from effective access, not title. Recruiter Standard still has no opportunities.read."
        />
        {snapshot.week1Slugs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional required modules for current access beyond Day 1.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {snapshot.week1Slugs.map((slug) => {
              const article = getAcademyArticle(slug);
              const done = snapshot.completedSlugs.includes(slug);
              return (
                <li key={slug} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
                  <Link className="text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={academyArticleHref(slug)}>
                    {article?.title ?? slug}
                  </Link>
                  {isSelf && !done ? (
                    <ActionForm action={updateAcademyTrainingAction}>
                      <input type="hidden" name="moduleSlug" value={slug} />
                      <button className={buttonClassName("primary")} name="status" value="completed" type="submit">
                        Mark complete
                      </button>
                    </ActionForm>
                  ) : (
                    <StateLabel done={done} label="Required" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="Week 2 — Shadow / practice cases" description="Track that shadowing happened. WorkforceOS does not schedule it." />
        {canComplete && !record.week2ShadowCompletedAt ? (
          <ActionForm action={setStaffOnboardingMilestoneAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="milestone" value="week2_shadow" />
            <input type="hidden" name="complete" value="yes" />
            <PrimaryButton>Mark Week 2 complete</PrimaryButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted-foreground">
            {record.week2ShadowCompletedAt ? "Week 2 marked complete." : "Pending."}
          </p>
        )}
      </section>

      <section>
        <SectionHeader title="Week 3 — Supervised production work" description="Track supervised production. This does not raise permissions." />
        {canComplete && !record.week3SupervisedCompletedAt ? (
          <ActionForm action={setStaffOnboardingMilestoneAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="milestone" value="week3_supervised" />
            <input type="hidden" name="complete" value="yes" />
            <PrimaryButton>Mark Week 3 complete</PrimaryButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted-foreground">
            {record.week3SupervisedCompletedAt ? "Week 3 marked complete." : "Pending."}
          </p>
        )}
      </section>

      <section>
        <SectionHeader
          title="Week 4 — Access / training review"
          description="Human review only. Recording this review does not grant bundles or permission overrides."
        />
        {record.week4ReviewedAt ? (
          <p className="text-sm text-muted-foreground">
            Reviewed {record.week4ReviewedAt.toLocaleString()}
            {record.week4Notes ? ` · ${record.week4Notes}` : ""}. Access was not changed.
          </p>
        ) : showAdminControls ? (
          <ActionForm action={recordStaffOnboardingWeek4ReviewAction} className="max-w-xl space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Review notes" name="notes">
              <textarea className={inputClassName} id="notes" name="notes" rows={3} placeholder="Access still matches assigned bundles. Training complete is not a permission grant." />
            </Field>
            <PrimaryButton>Record Week 4 review</PrimaryButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted-foreground">A People administrator records the Week 4 review. Training completion does not grant access.</p>
        )}
      </section>
    </div>
  );
}
