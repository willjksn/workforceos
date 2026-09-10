import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/auth/guard";
import { INTEGRATION_CATALOG, integrationStatusLabel } from "@/lib/integrations/catalog";
import { getIntegrationHubStatus } from "@/lib/integrations/hub";
import { Card, PageHeader, PageShell, StatusBadge, formatDate, ButtonLink } from "../../_components/ui";

export default async function IntegrationsAdminPage() {
  await requirePlatformAdmin();
  const providers = await getIntegrationHubStatus();
  const byId = Object.fromEntries(providers.map((item) => [item.provider, item]));
  const groups = [...new Set(INTEGRATION_CATALOG.map((item) => item.group))];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin · Integration Hub"
        title="Integration Hub"
        description="Credentials and health for external products. Operators check status on Connected tools. These tools feed WorkforceOS; they do not replace PostgreSQL."
        actions={<ButtonLink href="/app/integrations">Connected tools</ButtonLink>}
      />
      <div className="mt-8 space-y-8">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="section-title">{group}</h2>
            <div className="mt-3 grid gap-3">
              {INTEGRATION_CATALOG.filter((item) => item.group === group).map((item) => {
                const health = byId[item.id];
                const status = health
                  ? integrationStatusLabel(health)
                  : { label: "Not connected yet", tone: "neutral" as const };
                return (
                  <Card key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-navy">
                          <Link className="underline" href={`/app/integrations/${item.id}`}>{item.name}</Link>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                      </div>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </div>
                    {health?.lastError ? (
                      <p className="mt-3 text-sm text-danger">{health.lastError}</p>
                    ) : null}
                    {health?.lastSyncAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">Last sync {formatDate(health.lastSyncAt)}</p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
