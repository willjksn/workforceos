import { getSystemHealth } from "@/lib/health/status";
import { healthStatusLabel, healthStatusTone } from "@/lib/health/taxonomy";
import { verifyProductionAiAction, verifyProductionAiFallbackAction } from "@/lib/actions/ai";
import { describeAiRuntime } from "@/lib/ai/capabilities";
import { formatAiEvidence, loadLastAiFallbackEvidence, loadLastLiveAiEvidence } from "@/lib/ai/health-probe";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { ActionForm } from "../../_components/action-form";
import { Card, PageHeader, PageShell, StatusBadge, ButtonLink, PrimaryButton, Button } from "../../_components/ui";

export const maxDuration = 60;

export default async function SystemHealthPage() {
  await requirePlatformAdmin();
  const health = await getSystemHealth();
  const runtime = describeAiRuntime();
  const lastLive = await loadLastLiveAiEvidence().catch(() => null);
  const lastFallback = runtime.fallbackConfigured
    ? await loadLastAiFallbackEvidence().catch(() => null)
    : null;
  const verified = runtime.mode === "live" && Boolean(lastLive);
  const fallbackLabel = runtime.fallbackConfigured
    ? lastFallback?.provider === "gemini"
      ? "Gemini — LIVE"
      : "Gemini — CONFIGURED"
    : "Deferred";
  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="System status"
        description="Honest connection state. LIVE means a verified operating path. MOCK, MANUAL, NOT CONFIGURED, and DEFERRED are never shown as green HEALTHY. Secrets are never shown."
        actions={<ButtonLink href="/app/integrations">Connected tools</ButtonLink>}
      />
      <Card className="mt-8">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium text-navy">AI Runtime Verification</p>
          <StatusBadge tone={healthStatusTone(verified ? "LIVE" : runtime.mode === "live" ? "CONFIGURED" : "HEURISTIC")}>
            {verified ? "LIVE" : runtime.mode === "live" ? "CONFIGURED" : "HEURISTIC"}
          </StatusBadge>
        </div>
        <dl className="mt-4 grid gap-2 text-sm text-navy">
          <div>
            <dt className="text-muted-foreground">Primary provider</dt>
            <dd>OpenAI</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">FAST</dt>
            <dd>{runtime.capabilityModels.FAST}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">STANDARD</dt>
            <dd>{runtime.capabilityModels.STANDARD}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">REASONING</dt>
            <dd>{runtime.capabilityModels.REASONING}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fallback provider</dt>
            <dd>{fallbackLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PII used in verification</dt>
            <dd>No</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last verified</dt>
            <dd>{formatAiEvidence(lastLive, "None recorded")}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Tests FAST, STANDARD, and REASONING with harmless JSON. Does not use candidate or client records. API keys are not displayed.
        </p>
        <ActionForm action={verifyProductionAiAction} className="mt-4">
          <PrimaryButton>Run AI verification</PrimaryButton>
        </ActionForm>
        {runtime.fallbackConfigured ? (
          <ActionForm action={verifyProductionAiFallbackAction} className="mt-3">
            <Button type="submit" variant="secondary">
              Run fallback test
            </Button>
          </ActionForm>
        ) : null}
      </Card>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {health.checks.map((check) => (
          <Card key={check.title}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-navy">{check.title}</p>
              <StatusBadge tone={healthStatusTone(check.status)}>{healthStatusLabel(check.status)}</StatusBadge>
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
