import { getSystemHealth } from "@/lib/health/status";
import { healthStatusLabel, healthStatusTone } from "@/lib/health/taxonomy";
import { verifyProductionAiAction, verifyProductionAiFallbackAction } from "@/lib/actions/ai";
import { describeAiRuntime } from "@/lib/ai/capabilities";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { ActionForm } from "../../_components/action-form";
import { Card, PageHeader, PageShell, StatusBadge, ButtonLink, PrimaryButton } from "../../_components/ui";

export const maxDuration = 60;

export default async function SystemHealthPage() {
  await requirePlatformAdmin();
  const health = await getSystemHealth();
  const runtime = describeAiRuntime();
  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="System status"
        description="Honest connection state. LIVE means a verified operating path. MOCK, MANUAL, and NOT CONFIGURED are never shown as green HEALTHY. Secrets are never shown."
        actions={<ButtonLink href="/app/integrations">Connected tools</ButtonLink>}
      />
      <Card className="mt-8">
        <p className="font-medium text-navy">Live OpenAI model test</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Calls the configured FAST, STANDARD, and REASONING models. Does not use the synthetic unavailable-model id. API keys are not displayed.
        </p>
        <p className="mt-2 text-sm text-navy">
          Resolved FAST={runtime.capabilityModels.FAST} · STANDARD={runtime.capabilityModels.STANDARD} · REASONING=
          {runtime.capabilityModels.REASONING}
        </p>
        <ActionForm action={verifyProductionAiAction} className="mt-4">
          <PrimaryButton>Run live OpenAI test</PrimaryButton>
        </ActionForm>
      </Card>
      <Card className="mt-4">
        <p className="font-medium text-navy">Controlled fallback probe</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Separate from the live model test. Intentionally requests a nonexistent model so OpenAI fails availability and Gemini may hop. Never treated as the production FAST model.
        </p>
        <ActionForm action={verifyProductionAiFallbackAction} className="mt-4">
          <PrimaryButton>Run controlled fallback probe</PrimaryButton>
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
