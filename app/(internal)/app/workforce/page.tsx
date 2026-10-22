import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { getWorkforceCommandSnapshot, listWorkforceAssessments } from "@/lib/repositories/workforce";
import { loadWorkforcePortfolio } from "@/lib/workforce/pipeline-supply";
import { MetricCard } from "@/components/ui/display";
import { PageHeader, PageShell, RecordList, RecordRow, SectionHeader, formatLabel } from "../_components/ui";
import { WorkforceSubnav } from "./_components/workforce-subnav";

export default async function WorkforceHubPage() {
  const principal = await requireAppPermission("workforce.read");
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
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/app/workforce/gaps" label="Critical workforce gaps" value={command.criticalGaps.length} />
        <MetricCard href="/app/workforce/assessments" label="Assessments in progress" value={command.assessmentsInProgress.length} />
        <MetricCard href="/app/workforce/pipelines" label="Pipeline capacity risk" value={command.pipelineCapacityRisk.length} />
        <MetricCard href="/app/admin/approvals" label="Recommendations awaiting approval" value={command.recommendationsAwaitingApproval.length} />
      </section>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
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
      </div>
      <section className="mt-10">
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
      </section>
      <p className="mt-8 text-sm text-muted-foreground">
        Installation interactive maps remain deferred. List/region geography is used here. Labor-market APIs are adapters only until configured.
      </p>
      <p className="mt-2 text-sm">
        <Link className="underline" href="/app/services/workforce-pipeline-assessment">
          Workforce Pipeline Assessment service engine
        </Link>
      </p>
    </PageShell>
  );
}
