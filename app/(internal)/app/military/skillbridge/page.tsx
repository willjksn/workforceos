import Link from "next/link";

import { requireAnyAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { getMySkillBridgeQueue, getSkillBridgeMetrics, listSkillBridgeCards } from "@/lib/skillbridge/service";
import { MetricCard, StatusBadge } from "@/components/ui/display";
import { EmptyState, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

const VIEWS = [
  { id: "all", label: "All Candidates" },
  { id: "needs-action", label: "Needs Action" },
  { id: "windows", label: "Windows Approaching" },
  { id: "without-opportunities", label: "Without Opportunities" },
  { id: "employer-feedback", label: "Employer Feedback Needed" },
  { id: "interviews", label: "Interviews" },
  { id: "pending", label: "SkillBridge Pending" },
  { id: "active", label: "SkillBridge Active" },
  { id: "conversion", label: "Conversion Pending" },
  { id: "hired", label: "Hired" },
] as const;

export default async function SkillBridgeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; queue?: string }>;
}) {
  const principal = await requireAnyAppPermission(["skillbridge.read", "military.read"]);
  const params = await searchParams;
  const view = params.view ?? "all";
  const canReadPii = can(principal, "candidate_pii.read");
  const canManage = can(principal, "skillbridge.manage");
  const metrics = await getSkillBridgeMetrics(principal.organizationId);
  const cards = await listSkillBridgeCards({
    organizationId: principal.organizationId,
    view,
    canReadPii,
  });
  const queue = await getMySkillBridgeQueue({
    organizationId: principal.organizationId,
    ownerUserId: principal.id,
    global: canManage && params.queue === "all",
    canReadPii,
  });

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Military talent"
        title="Pathway operations"
        description="SkillBridge is one pathway inside Military Talent operations, not a PierOne-owned program. Profiles are Transition Talent overlays on Talent Network candidates. PierOne is the intermediary; host companies and employers own SkillBridge-eligible opportunities."
      />
      <MilitarySubnav active="/app/military/skillbridge" />
      {can(principal, "skillbridge.manage") || can(principal, "military.review") ? (
        <p className="mt-3 text-sm">
          <Link className="text-navy underline" href="/app/military/skillbridge/alerts">
            Edit alert-rule windows
          </Link>
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active transitioning talent" value={metrics.activeCandidates} />
        <MetricCard label="Windows next 30 days" value={metrics.windows30} />
        <MetricCard label="Windows next 60 days" value={metrics.windows60} />
        <MetricCard label="Windows next 90 days" value={metrics.windows90} />
        <MetricCard label="Windows next 180 days" value={metrics.windows180} />
        <MetricCard label="Without opportunity" value={metrics.withoutOpportunity} />
        <MetricCard label="Needs candidate follow-up" value={metrics.needsCandidateFollowUp} />
        <MetricCard label="Needs employer follow-up" value={metrics.needsEmployerFollowUp} />
        <MetricCard label="Interviews upcoming" value={metrics.interviewsUpcoming} />
        <MetricCard label="Pending approval" value={metrics.pendingApproval} />
        <MetricCard label="SkillBridge active" value={metrics.skillbridgeActive} />
        <MetricCard label="Conversion pending" value={metrics.conversionPending} />
        <MetricCard label="Hired / converted" value={metrics.hired} />
      </div>

      <section className="mt-10">
        <h2 className="section-title">My Military Talent queue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManage ? (
            <Link href={params.queue === "all" ? "/app/military/skillbridge" : "/app/military/skillbridge?queue=all"} className="text-navy underline">
              {params.queue === "all" ? "Show my queue" : "Manager / global queue"}
            </Link>
          ) : (
            "Assigned to you."
          )}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QueueCard title="Needs action today" count={queue.needsActionToday.length} />
          <QueueCard title="Candidate follow-ups" count={queue.candidateFollowUps.length} />
          <QueueCard title="Employer follow-ups" count={queue.employerFollowUps.length} />
          <QueueCard title="Documents needed" count={queue.documentsNeeded.length} />
          <QueueCard title="Windows approaching" count={queue.windowsApproaching.length} />
          <QueueCard title="Without opportunities" count={queue.withoutOpportunities.length} />
          <QueueCard title="Upcoming interviews" count={queue.upcomingInterviews.length} />
          <QueueCard title="Starting soon" count={queue.startingSoon.length} />
          <QueueCard title="Ending soon" count={queue.endingSoon.length} />
          <QueueCard title="Conversion decisions" count={queue.conversionDecisions.length} />
          <QueueCard title="Overdue follow-ups" count={queue.overdueFollowUps.length} />
        </div>
      </section>

      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Military Talent pathway views">
        {VIEWS.map((item) => (
          <Link
            key={item.id}
            href={`/app/military/skillbridge?view=${item.id}`}
            className={`rounded-[6px] px-3 py-1.5 text-sm ${view === item.id ? "bg-navy text-white" : "border border-border text-navy"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-3">
        {cards.length === 0 ? (
          <EmptyState title="No transitioning talent in this view.">
            These people are existing Talent Network candidates with a Transition Talent Profile. Create a profile from a candidate record. A public job posting is not required first.
          </EmptyState>
        ) : (
          cards.map((card) => (
            <article key={card.profile.id} className="rounded-[8px] border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/app/military/skillbridge/${card.profile.id}`} className="font-serif text-xl text-navy">
                    {card.candidate.fullName}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[card.occupation ? `${formatLabel(card.occupation.branch)} · ${card.occupation.code}` : formatLabel(card.profile.branch ?? "unknown"), card.profile.rankTitle ?? card.profile.payGrade]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusBadge tone={card.hasActiveOpportunity ? "teal" : "warning"}>
                  {card.currentOpportunity ? formatLabel(card.currentOpportunity.stage) : "No opportunity"}
                </StatusBadge>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Installation / location" value={card.installation?.name ?? card.profile.currentDutyLocation} />
                <Field label="EOS / ETS / EAOS" value={card.profile.endOfServiceDate?.toLocaleDateString() ?? card.profile.etsDate?.toLocaleDateString() ?? card.profile.eaosDate?.toLocaleDateString()} />
                <Field label="SkillBridge window" value={card.profile.skillbridgeWindowStart && card.profile.skillbridgeWindowEnd ? `${card.profile.skillbridgeWindowStart.toLocaleDateString()}–${card.profile.skillbridgeWindowEnd.toLocaleDateString()}` : null} />
                <Field label="Target roles" value={card.targetRoles.map((row) => row.roleTitle).join(", ")} />
                <Field label="Preferred location" value={card.profile.preferredLocationPrimary} />
                <Field label="Ideal employer" value={[card.profile.idealEmployer, card.profile.idealIndustry].filter(Boolean).join(" · ")} />
                <Field label="Last contact" value={card.profile.lastContactedAt?.toLocaleDateString()} />
                <Field label="Next action" value={card.profile.nextAction} />
                <Field label="Resume" value={formatLabel(card.profile.resumeStatus)} />
              </dl>
              {card.risks.length ? (
                <p className="mt-3 text-xs text-warning">{card.risks.join(" · ")}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link className="text-navy underline" href={`/app/military/skillbridge/${card.profile.id}`}>
                  Open transition profile
                </Link>
                <Link className="text-navy underline" href={`/app/talent/${card.candidate.id}`}>
                  Open full candidate profile
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}

function QueueCard({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      <p className="mt-1 font-serif text-2xl text-navy">{count}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-navy">{value || "—"}</dd>
    </div>
  );
}
