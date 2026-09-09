import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { retryIntegrationAction } from "@/lib/actions/finance";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { getDb } from "@/db";
import { integrationConnections, integrationEvents } from "@/db/schema";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { getIntegrationHubStatus } from "@/lib/integrations/hub";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Card, EmptyState, PageHeader, PageShell, PrimaryButton, StatusBadge, formatDate, formatLabel } from "../../_components/ui";

const SETUP: Record<string, string> = {
  quickbooks: "Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REFRESH_TOKEN, and QUICKBOOKS_REALM_ID for live posting. WorkforceOS still owns operating invoices; QuickBooks is the ledger.",
  docusign: "Set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_SECRET_KEY, and DOCUSIGN_ACCOUNT_ID for live envelopes. Until then, use manual execution. Unsigned webhooks cannot mark a contract executed.",
  apollo: "Set APOLLO_API_KEY. Enrichment writes a review record and will not overwrite approved CRM fields without a human accept.",
  onet: "Set ONET_API_KEY for live imports. The UI never calls O*NET per page. Unconfigured imports are labeled fixtures with source and version.",
  seekout: "Set SEEKOUT_API_KEY. Internal Talent Network search must complete before SeekOut lookup. hireEZ remains a thin placeholder.",
  "linkedin-recruiter": "Store LinkedIn profile URLs and Recruiter project/reference IDs only. Scraping is prohibited. RSC/CRM Connect is a future adapter.",
  microsoft: "Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REFRESH_TOKEN for live interview events. Client IDs alone stay CONFIGURED. WorkforceOS does not duplicate Outlook.",
  google: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN for live interview events. Client IDs alone stay CONFIGURED. WorkforceOS does not duplicate Gmail.",
  checkr: "Set CHECKR_API_KEY and CHECKR_WEBHOOK_SECRET for live invitations. Results never auto-reject. WorkforceOS does not generate FCRA adverse-action letters.",
};

export default async function IntegrationProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const principal = await requireAnyAppPermission(["integrations.read", "admin.users", "admin.roles"]);
  const { provider } = await params;
  const entry = INTEGRATION_CATALOG.find((item) => item.id === provider);
  if (!entry) notFound();
  const health = (await getIntegrationHubStatus()).find((item) => item.provider === provider);
  const db = getDb();
  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.organizationId, principal.organizationId));
  const connection = connections.find((row) => row.provider === provider) ?? null;
  const events = await db
    .select()
    .from(integrationEvents)
    .where(eq(integrationEvents.organizationId, principal.organizationId));
  const providerEvents = events.filter((row) => row.provider === provider).slice(0, 20);
  const failed = providerEvents.filter((row) => row.deadLetter || row.status === "failed" || row.status === "error");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Integrations"
        title={entry.name}
        description={entry.summary}
        metadata={health?.configured ? "Credentials present" : "Not configured"}
      />
      <Card className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge tone={health?.configured ? "success" : "neutral"}>
                {health?.configured ? "Credentials present" : "Not configured"}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{connection?.environment ?? "unconfigured"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Account</dt>
            <dd>{connection?.accountLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scopes</dt>
            <dd>{connection?.scopes ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd>{formatDate(connection?.lastSyncAt ?? health?.lastSyncAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last success</dt>
            <dd>{formatDate(connection?.lastSuccessAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last error</dt>
            <dd>{connection?.lastError ?? health?.lastError ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">{SETUP[provider] ?? "Adapter interface is registered. Credentials are optional to boot the app."}</p>
      </Card>
      {failed.length > 0 && can(principal, "integrations.manage") ? (
        <section className="mt-8">
          <h2 className="section-title">Failed events</h2>
          <ul className="mt-3 space-y-3">
            {failed.map((event) => (
              <li key={event.id} className="rounded border border-border p-3 text-sm">
                <p>{event.action} · {formatLabel(event.status)} · retries {event.retryCount}</p>
                <p className="text-muted-foreground">{event.detail}</p>
                <ActionForm action={retryIntegrationAction} className="mt-2">
                  <input type="hidden" name="eventId" value={event.id} />
                  <PrimaryButton>Retry</PrimaryButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-8">
        <h2 className="section-title">Recent events</h2>
        {providerEvents.length === 0 ? (
          <EmptyState title="No integration events.">Sync jobs and webhooks append here. Failures are visible; they are not silent.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {providerEvents.map((event) => (
              <li key={event.id}>
                {event.action} · {event.status}
                {event.deadLetter ? " · dead letter" : ""}
                {event.detail ? ` · ${event.detail}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
