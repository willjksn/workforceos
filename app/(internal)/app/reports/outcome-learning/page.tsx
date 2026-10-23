import Link from "next/link";

import { reviewOutcomeRecommendationAction } from "@/lib/actions/outcome-learning";
import { requireAppPermission } from "@/lib/auth/guard";
import { loadOutcomeReport } from "@/lib/outcome-learning/load";
import { listStoredRecommendations } from "@/lib/outcome-learning/review";
import { ADVISORY_BOUNDARY, bandLabel } from "@/lib/outcome-learning/thresholds";
import { categoryLabel, contextLabel, programLabel } from "@/lib/outcome-learning/vocabulary";
import { OUTCOME_WINDOWS, parseOutcomeWindow } from "@/lib/outcome-learning/windows";
import { loadWorkforcePortfolio } from "@/lib/workforce/pipeline-supply";
import { ActionForm } from "../../_components/action-form";
import { DataTable, PageHeader, PageShell, SectionHeader } from "../../_components/ui";
import { Card } from "@/components/ui/display";
import type { RecommendationDraft } from "@/lib/outcome-learning/analyze";

const WINDOW_LABEL: Record<(typeof OUTCOME_WINDOWS)[number], string> = {
  "30d": "30 days",
  "90d": "90 days",
  "180d": "6 months",
  "365d": "12 months",
  all: "All available",
};

export default async function OutcomeLearningPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const principal = await requireAppPermission("reports.read");
  const params = await searchParams;
  const selected = parseOutcomeWindow(params.window);
  const portfolio = await loadWorkforcePortfolio(principal.organizationId);
  const report = await loadOutcomeReport({
    organizationId: principal.organizationId,
    window: selected,
    roles: portfolio.roles.map((role) => ({
      id: role.id,
      title: role.title,
      jobFamilyName: role.jobFamilyName,
      demandQuantity: role.demandQuantity,
      knownSupply: role.knownSupply,
      activePipeline: role.activePipeline,
    })),
  });
  const stored = await listStoredRecommendations(principal.organizationId, selected);
  const storedByKey = new Map(stored.map((row) => [`${row.recommendationType}|${row.subjectKey}`, row]));

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Reports"
        title="Outcome learning"
        description="What is working, where matches stall, and which patterns a person should review. These figures are advisory."
      />
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{report.caveat}</p>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{ADVISORY_BOUNDARY}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        As of {report.asOf}. Window: {report.windowLabel}. Read directly from stored records. No blended client and public conversion rate.
      </p>
      <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Time window">
        {OUTCOME_WINDOWS.map((window) => (
          <Link
            key={window}
            className={window === selected ? "font-medium text-navy underline" : "text-navy underline"}
            href={`/app/reports/outcome-learning?window=${window}`}
          >
            {WINDOW_LABEL[window]}
          </Link>
        ))}
      </nav>

      <section className="mt-10">
        <SectionHeader
          title="Match performance"
          description="Each rate uses that category and context as the denominator. Client routing and public outreach are separate."
        />
        <DataTable columns={["Context", "Category", "Sample", "Evidence", "Engagement", "Interest", "Interview", "Placement", "Not a Fit", "No response", "Candidate declined"]}>
          {report.matchPerformance.map((row) => (
            <tr key={`${row.context}-${row.category}`}>
              <td>{contextLabel(row.context)}</td>
              <td>{row.label}</td>
              <td>{row.sample}</td>
              <td>{bandLabel(row.band)}</td>
              <td>{row.engagement.text}</td>
              <td>{row.interest.text}</td>
              <td>{row.interview.text}</td>
              <td>{row.placement.text}</td>
              <td>{row.noFit.text}</td>
              <td>{row.noResponse.text}</td>
              <td>{row.candidateDeclined.text}</td>
            </tr>
          ))}
        </DataTable>
        {report.matchPerformance.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No current matches in this window.</p> : null}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Pipeline funnel"
          description="Match, viable, engagement, employer interest, interview, placement. Military Talent and other Talent Network figures are aggregates. They do not rank people."
        />
        <DataTable columns={["Context", "Slice", "Sample", "Evidence", "Match", "Viable", "Engagement", "Interest", "Interview", "Placement"]}>
          {report.funnels.filter((row) => row.sample > 0).map((row) => (
            <tr key={`${row.context}-${row.program}-${row.jobFamily}`}>
              <td>{contextLabel(row.context)}</td>
              <td>{row.program === "all" ? row.jobFamily : `${programLabel(row.program)} · ${row.jobFamily}`}</td>
              <td>{row.sample}</td>
              <td>{bandLabel(row.band)}</td>
              <td>{row.match}</td>
              <td>{row.viable}</td>
              <td>{row.engagement}</td>
              <td>{row.interest}</td>
              <td>{row.interview}</td>
              <td>{row.placement}</td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Capability and gap signals"
          description="A signal needs at least 5 relevant outcomes. Fewer than that stays off this list. Compensation factors are excluded."
        />
        {report.factorSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No factor pattern meets the sample threshold. {report.withheldFactorLabels} comparisons are below 5 outcomes.</p>
        ) : (
          <ul className="space-y-3">
            {report.factorSignals.map((row) => (
              <li key={`${row.group}-${row.label}-${row.jobFamily}-${row.outcome}`}>
                <Card>
                  <p className="font-medium text-navy">{row.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.text} {bandLabel(row.band)}. Sample size {row.denominator}.</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">Approved capabilities</h3>
        {report.capabilitySignals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No approved capability co-occurrence in this window. Pending and rejected capabilities are not used.</p>
        ) : (
          <DataTable columns={["Capability", "Matches", "Engagements", "Interviews", "Placements", "Not a Fit", "Evidence"]}>
            {report.capabilitySignals.slice(0, 25).map((row) => (
              <tr key={row.skillName}>
                <td>{row.skillName}</td>
                <td>{row.matches}</td>
                <td>{row.engagements}</td>
                <td>{row.interviews}</td>
                <td>{row.placements}</td>
                <td>{row.noFit}</td>
                <td>{bandLabel(row.band)}</td>
              </tr>
            ))}
          </DataTable>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Absence of a placement is not evidence a capability is wrong.</p>
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Military mapping signals"
          description="Organization outcome counts for shared reference mappings. Review status is not changed here."
        />
        {report.mappingSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved candidate capability in this organization cites a military mapping in the current read.</p>
        ) : (
          <DataTable columns={["Mapping", "Review status", "People", "Matches", "Interviews", "Placements", "Not a Fit", "Evidence"]}>
            {report.mappingSignals.slice(0, 25).map((row) => (
              <tr key={row.mappingId}>
                <td>{row.occupationCode} → {row.skillName}</td>
                <td>{row.reviewStatus}</td>
                <td>{row.candidates}</td>
                <td>{row.matches}</td>
                <td>{row.interviews}</td>
                <td>{row.placements}</td>
                <td>{row.noFit}</td>
                <td>{bandLabel(row.band)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Employer outcomes and timing"
          description="Operational counts for companies with at least 5 engagements. There is no employer score."
        />
        {report.employerMetrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No company has 5 engagements in this window. {report.withheldEmployers} companies are below that threshold.</p>
        ) : (
          <DataTable columns={["Company", "Context", "Engagements", "Response", "Interview", "Not a Fit", "Referral", "Placement", "Avg response hours", "Evidence"]}>
            {report.employerMetrics.map((row) => (
              <tr key={`${row.context}-${row.companyId}`}>
                <td>{row.companyName}</td>
                <td>{contextLabel(row.context)}</td>
                <td>{row.engagements}</td>
                <td>{row.response.text}</td>
                <td>{row.interview.text}</td>
                <td>{row.noFit.text}</td>
                <td>{row.referral.text}</td>
                <td>{row.placement.text}</td>
                <td>{row.responseHours == null ? `Insufficient evidence (${row.responseSamples})` : `${row.responseHours} hours (${row.responseSamples})`}</td>
                <td>{bandLabel(row.band)}</td>
              </tr>
            ))}
          </DataTable>
        )}
        <DataTable className="mt-4" columns={["Context", "Interval", "Average hours", "Samples", "Evidence"]}>
          {report.timing.map((row) => (
            <tr key={`${row.context}-${row.label}`}>
              <td>{contextLabel(row.context)}</td>
              <td>{row.label}</td>
              <td>{row.hours == null ? "Insufficient evidence" : row.hours}</td>
              <td>{row.samples}</td>
              <td>{bandLabel(row.band)}</td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Workforce feedback"
          description="Information for a workforce role. Known supply still comes from the workforce plan. This section does not change role requirements."
        />
        {report.workforceFeedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workforce role has a canonical job family to compare.</p>
        ) : (
          <ul className="space-y-3">
            {report.workforceFeedback.map((row) => (
              <li key={row.roleId}>
                <Card>
                  <p className="font-medium text-navy">{row.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.jobFamilyName}. Demand {row.demandQuantity}. Known supply {row.knownSupply ?? "not calculated"}. Active pipeline {row.activePipeline ?? "not calculated"}.
                    Client Strong Matches {row.strongMatches}, interviews {row.strongInterviews}, placements {row.strongPlacements}, Not a Fit {row.strongNoFit}. {bandLabel(row.band)}.
                  </p>
                  {row.gapNote ? <p className="mt-1 text-sm text-muted-foreground">{row.gapNote}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Recommendations"
          description="A saved review is a note. It does not change the matcher, a mapping, a requirement, or a route."
        />
        {report.recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendation in this window.</p>
        ) : (
          <ul className="space-y-4">
            {report.recommendations.map((item) => {
              const saved = storedByKey.get(`${item.recommendationType}|${item.subjectKey}`);
              return (
                <li key={`${item.recommendationType}-${item.subjectKey}`}>
                  <Card>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.recommendationType.replaceAll("_", " ")}</p>
                    <p className="mt-1 font-medium text-navy">{item.observedPattern}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.whyItMatters}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.humanReviewPrompt}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sample size {item.sampleCount}. {bandLabel(item.evidenceBand)}. Window: {report.windowLabel}. Source: {item.sourceRecords}. Filter: {item.sourceFilter}. {item.supportingSummary}
                    </p>
                    <p className="mt-2 text-sm">Review state: {saved?.reviewState ?? "new"}{saved?.reviewNote ? ` · ${saved.reviewNote}` : ""}</p>
                    <RecommendationReview item={item} reportWindow={report.window} windowStart={report.windowStart} windowEnd={report.windowEnd} />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function RecommendationReview({
  item,
  reportWindow,
  windowStart,
  windowEnd,
}: {
  item: RecommendationDraft;
  reportWindow: string;
  windowStart: string | null;
  windowEnd: string;
}) {
  return (
    <ActionForm action={reviewOutcomeRecommendationAction} className="mt-4 space-y-2">
      <input type="hidden" name="recommendationType" value={item.recommendationType} />
      <input type="hidden" name="subjectKey" value={item.subjectKey} />
      <input type="hidden" name="timeWindow" value={reportWindow} />
      <input type="hidden" name="windowStart" value={windowStart ?? ""} />
      <input type="hidden" name="windowEnd" value={windowEnd} />
      <input type="hidden" name="sampleCount" value={item.sampleCount} />
      <input type="hidden" name="evidenceBand" value={item.evidenceBand} />
      <input type="hidden" name="observedPattern" value={item.observedPattern} />
      <input type="hidden" name="whyItMatters" value={item.whyItMatters} />
      <input type="hidden" name="humanReviewPrompt" value={item.humanReviewPrompt} />
      <input type="hidden" name="sourceRecords" value={item.sourceRecords} />
      <input type="hidden" name="sourceFilter" value={item.sourceFilter} />
      <input type="hidden" name="supportingSummary" value={item.supportingSummary} />
      <label className="block text-sm text-muted-foreground">
        Review note
        <input name="reviewNote" maxLength={2000} className="mt-1 w-full rounded border border-card-border px-2 py-1 text-sm" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button name="reviewState" value="reviewing" className="text-sm underline" type="submit">Mark reviewing</button>
        <button name="reviewState" value="accepted_as_note" className="text-sm underline" type="submit">Accept as note</button>
        <button name="reviewState" value="dismissed" className="text-sm underline" type="submit">Dismiss</button>
        <button name="reviewState" value="needs_more_data" className="text-sm underline" type="submit">Needs more data</button>
      </div>
    </ActionForm>
  );
}
