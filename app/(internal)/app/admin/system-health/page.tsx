import { getSystemHealth } from "@/lib/health/status";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { Card, PageHeader, PageShell, StatusBadge } from "../../_components/ui";

export default async function SystemHealthPage() {
  await requirePlatformAdmin();
  const health = await getSystemHealth();
  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="System status"
        description="Whether WorkforceOS can sign people in, reach PostgreSQL, and talk to connected tools. Secrets are never shown."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {health.checks.map((check) => (
          <Card key={check.title}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-navy">{check.title}</p>
              <StatusBadge tone={check.ok ? "success" : "danger"}>{check.ok ? "Healthy" : "Needs attention"}</StatusBadge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{check.detail}</p>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        {health.environment} · app {health.version} · seed {health.seedVersion}
      </p>
    </PageShell>
  );
}
