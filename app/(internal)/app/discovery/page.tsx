import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listDiscoveries, loadApprovedWorkflow } from "@/lib/delivery/engine";
import { getOpportunityGraph, listCompaniesForSelect, listOpportunities } from "@/lib/repositories/crm";
import { listLaunchServices } from "@/lib/repositories/services";
import { can } from "@/lib/rbac/permissions";
import { StatusBadge } from "@/components/ui/display";
import { DiscoveryCreateForm } from "./discovery-create-form";
import {
  CreatePanel,
  DataTable,
  EmptyState,
  PageHeader,
  PageShell,
  formatLabel,
} from "../_components/ui";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const principal = await requireAppPermission("discovery.read");
  const params = await searchParams;
  const rows = await listDiscoveries(principal.organizationId);
  const canWrite = can(principal, "discovery.write");
  const services = canWrite ? await listLaunchServices() : [];
  const companies = canWrite ? await listCompaniesForSelect(principal.organizationId) : [];
  const opportunities = canWrite ? await listOpportunities(principal.organizationId) : [];
  const questionsByService: Record<string, Array<{ key: string; label: string; required?: boolean }>> = {};
  for (const { service } of services) {
    const workflow = await loadApprovedWorkflow(service.code);
    questionsByService[service.code] = workflow.definition?.requiredDiscoveryInputs ?? [];
  }
  const focused =
    canWrite && params.opportunityId
      ? await getOpportunityGraph(params.opportunityId, principal.organizationId)
      : null;

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Solutions"
        title="Discovery"
        description="Discovery is tied to a company, opportunity, and recommended service. Question sets come from the approved workflow."
      />
      {rows.length === 0 ? (
        <EmptyState title="No discovery records yet.">
          Start from an opportunity and the approved service workflow.
        </EmptyState>
      ) : (
        <DataTable columns={["Discovery", "Company", "Service", "Status"]}>
          {rows.map((row) => (
            <tr key={row.discovery.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/discovery/${row.discovery.id}`}>
                  {row.discovery.title}
                </Link>
              </td>
              <td>{row.companyName}</td>
              <td>{row.serviceName}</td>
              <td>
                <StatusBadge tone={row.discovery.status === "approved" ? "success" : "navy"}>
                  {formatLabel(row.discovery.status)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {canWrite ? (
        <CreatePanel
          title="Start discovery"
          description={
            focused
              ? `Prefilled from ${focused.company.name} · ${focused.opportunity.name}. Answers are stored against the approved service version.`
              : "Answers are stored against the approved service version. AI may draft summaries; humans approve."
          }
        >
          <DiscoveryCreateForm
            services={services.map(({ service }) => ({ code: service.code, name: service.name }))}
            companies={companies.map((company) => ({ id: company.id, name: company.name }))}
            opportunities={opportunities.map(({ opportunity, companyName }) => ({
              id: opportunity.id,
              label: `${companyName} · ${opportunity.name}`,
              serviceCode: opportunity.serviceCode,
            }))}
            questionsByService={questionsByService}
            defaultCompanyId={focused?.company.id}
            defaultOpportunityId={focused?.opportunity.id}
            defaultServiceCode={focused?.opportunity.serviceCode ?? undefined}
            defaultTitle={focused ? `${focused.opportunity.name} discovery` : undefined}
          />
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
