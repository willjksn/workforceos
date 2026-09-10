import { getSystemHealth } from "@/lib/health/status";
import { healthStatusLabel, healthStatusTone } from "@/lib/health/taxonomy";
import { verifyProductionAiAction } from "@/lib/actions/ai";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { ActionForm } from "../../_components/action-form";
import { Card, PageHeader, PageShell, StatusBadge, ButtonLink, PrimaryButton } from "../../_components/ui";

export const maxDuration = 60;

export default async function SystemHealthPage() {
  await requirePlatformAdmin();
  const health = await getSystemHealth();
  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="System status"
        description="Honest connection state. LIVE means a verified operating path. MOCK, MANUAL, and NOT CONFIGURED are never shown as green HEALTHY. Secrets are never shown."
        actions={<ButtonLink href="/app/integrations">Connected tools</ButtonLink>}
      />
      <Card className="mt-8">
        <p className="font-medium text-navy">Controlled AI verification</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Runs FAST, STANDARD, and REASONING probes against the live provider with harmless internal JSON. Optionally forces an unavailable-model hop to Gemini. Does not change environment variables.
        </p>
        <ActionForm action={verifyProductionAiAction} className="mt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" name="includeGemini" value="1" defaultChecked />
            Include Gemini availability fallback (unavailable-model hop)
          </label>
          <span>
            <PrimaryButton>Run controlled AI verification</PrimaryButton>
          </span>
        </ActionForm>
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
