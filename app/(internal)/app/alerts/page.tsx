import { requireAnyAppPermission } from "@/lib/auth/guard";
import { evaluateOperationalAlerts } from "@/lib/alerts/evaluate";
import { can } from "@/lib/rbac/permissions";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow, formatLabel } from "@/components/ui/page";

export default async function AlertsPage() {
  const principal = await requireAnyAppPermission(["alerts.read", "reports.read"]);
  const alerts = await evaluateOperationalAlerts(principal.organizationId);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations"
        title="Operational alerts"
        description="Exceptions computed from current records. Completeness issues live on Data Quality."
        actions={
          can(principal, "data_quality.read") ? (
            <ButtonLink href="/app/admin/data-quality">Data quality</ButtonLink>
          ) : undefined
        }
      />
      {alerts.length === 0 ? (
        <EmptyState title="No operational alerts.">Alerts appear when stored records cross the operating thresholds.</EmptyState>
      ) : (
        <RecordList>
          {alerts.map((alert) => (
            <RecordRow
              key={`${alert.code}-${alert.recordId}`}
              href={alert.href}
              title={alert.title}
              meta={`${formatLabel(alert.domain)} · ${alert.severity}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
