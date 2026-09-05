import { requireCurrentPrincipal } from "@/lib/auth/session";
import { listLaunchServices } from "@/lib/repositories/services";
import { AuthorizationError, can } from "@/lib/rbac/permissions";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow } from "../_components/ui";

export default async function ServicesPage() {
  const principal = await requireCurrentPrincipal();
  if (!can(principal, "solutions.read") && !can(principal, "jobs.read")) {
    throw new AuthorizationError("Missing permission: solutions.read");
  }
  const services = await listLaunchServices();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Recruiting / Delivery"
        title="Launch services"
        description="Workflows are version-controlled database records. Agents and operators follow the approved steps."
      />
      {services.length === 0 ? (
        <EmptyState title="No launch services recorded.">
          Seed the five launch services before operators can open a workflow.
        </EmptyState>
      ) : (
        <RecordList className="mt-6">
          {services.map(({ service, workflows }) => (
            <RecordRow
              key={service.id}
              href={`/app/services/${service.code}`}
              title={service.name}
              meta={service.description ?? undefined}
              trailing={<span className="text-sm text-muted-foreground">{workflows.length} steps</span>}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
