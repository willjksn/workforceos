import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { getWorkforceCommandSnapshot, listWorkforceAssessments } from "@/lib/repositories/workforce";
import { loadWorkforcePortfolio } from "@/lib/workforce/pipeline-supply";
import { MetricCard } from "@/components/ui/display";
import { PageHeader, PageShell, RecordList, RecordRow, SectionHeader, formatLabel } from "../_components/ui";
import { WorkforceSubnav } from "./_components/workforce-subnav";

function healthMatches(health: string, filter: string) {
  if (filter === "gap") return health === "gap" || health === "critical";
  return health === filter;
}

export default async function WorkforceHubPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string }>;
}) {
  const principal = await requireAppPermission("workforce.read");
  const { health } = await searchParams;
  const healthFilter = health === "critical" || health === "gap" || health === "watch" || health === "healthy" ? health : undefined;
  const [command, assessments, portfolio] = await Promise.all([
    getWorkforceCommandSnapshot(principal.organizationId),
    listWorkforceAssessments(principal.organizationId),
    loadWorkforcePortfolio(principal.organizationId),
  ]);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce intelligence"
        title="Workforce Pipeline Assessment work"
        description="Planning estimates for demand, supply, gaps, and pipelines on Workforce Pipeline Assessment engagements. Forecasts are not guaranteed. Client-facing recommendations require human approval. This is not a sixth commercial service."
      />
      <WorkforceSubnav active="/app/workforce" />
      <p className="mt-4 text-sm text-muted-foreground">
        More workforce tools stay on their routes:{" "}
        <Link className="underline" href="/app/workforce/gaps">Gaps</Link>,{" "}
        <Link className="underline" href="/app/workforce/skills">Skills</Link>,{" "}
        <Link className="underline" href="/app/workforce/pipelines">Pipelines</Link>,{" "}
        <Link className="underline" href="/app/workforce/forecasts">Forecasts</Link>,{" "}
        <Link className="underline" href="/app/more">More</Link>.
      </p>
      {healthFilter ? (
        <section className="mt-8">
          <SectionHeader title={`Roles · ${formatLabel(healthFilter)}`} />
          <p className="mb-3 text-sm text-muted-foreground">
            M7 portfolio health as of {portfolio.calculatedAt}. Known supply counts stored people.{" "}
            <Link className="underline" href="/app/workforce">Full overview</Link>
          </p>
          <RecordList>
            {portfolio.roles.filter((role) => healthMatches(role.health, healthFilter)).map((role) => (
              <RecordRow
                key={role.id}
                href={`/app/workforce/roles/${role.id}`}
                title={role.title}
                meta={`Health ${formatLabel(role.health)} · demand ${role.demandQuantity} · known supply ${role.knownSupply} · gap ${role.quantityGap}`}
              />
            ))}
          </RecordList>
          {portfolio.roles.some((role) => healthMatches(role.health, healthFilter)) ? null : (
            <p className="mt-2 text-sm text-muted-foreground">No items need attention.</p>
          )}
        </section>
      ) : null}
      {healthFilter ? null : <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/app/workforce/gaps" label="Critical workforce gaps" value={command.criticalGaps.length} />
        <MetricCard href="/app/workforce/assessments" label="Assessments in progress" value={command.assessmentsInProgress.length} />
        <MetricCard href="/app/workforce/pipelines" label="Pipeline capacity risk" value={command.pipelineCapacityRisk.length} />
        <MetricCard href="/app/admin/approvals" label="Recommendations awaiting approval" value={command.recommendationsAwaitingApproval.length} />
      </section>}
      {healthFilter ? null : <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader title="High-risk roles" />
          <RecordList>
            {command.highRiskRoles.slice(0, 8).map((role) => (
              <RecordRow
                key={role.id}
                href="/app/workforce/roles"
                title={role.title}
                meta={`${formatLabel(role.criticality)} · headcount ${role.currentHeadcount}`}
              />
            ))}
          </RecordList>
        </section>
        <section>
          <SectionHeader title="Recent assessments" />
          <RecordList>
            {assessments.slice(0, 8).map((row) => (
              <RecordRow
                key={row.assessment.id}
                href={`/app/workforce/assessments/${row.assessment.id}`}
                title={row.assessment.title}
                meta={`${row.companyName} · ${formatLabel(row.assessment.status)} · v${row.assessment.versionNumber}`}
              />
            ))}
          </RecordList>
        </section>
      </div>}
      {healthFilter ? null : <section className="mt-10">
        <SectionHeader title="Job family portfolio" />
        <p className="mb-3 text-sm text-muted-foreground">
          Calculated {portfolio.calculatedAt}. Supply is distinct people already in this organization. Military talent is one channel inside that supply. Roles without a job family stay listed separately.
        </p>
        <RecordList>
          {portfolio.families.map((family) => (
            <RecordRow
              key={family.jobFamilyId}
              href="/app/workforce/roles"
              title={family.jobFamilyName}
              meta={`Demand ${family.demand} · Supply ${family.knownSupply} · Gap ${family.quantityGap} · Pipeline ${family.activePipeline} · Placements ${family.placements} · ${formatLabel(family.health)}`}
            />
          ))}
          {portfolio.unlinkedRoles.map((role) => (
            <RecordRow
              key={role.roleId}
              href={`/app/workforce/roles/${role.roleId}`}
              title={role.title}
              meta={`Job family not linked. ${role.freeTextJobFamily ? `Free text: ${role.freeTextJobFamily}. ` : ""}Demand ${role.demandQuantity} · Supply ${role.knownSupply} · ${formatLabel(role.health)}`}
            />
          ))}
        </RecordList>
      </section>}
      {healthFilter ? null : <p className="mt-8 text-sm text-muted-foreground">
        Installation interactive maps remain deferred. List/region geography is used here. Labor-market APIs are adapters only until configured.
      </p>}
      <p className="mt-2 text-sm">
        <Link className="underline" href="/app/services/workforce-pipeline-assessment">
          Workforce Pipeline Assessment service engine
        </Link>
      </p>
    </PageShell>
  );
}
