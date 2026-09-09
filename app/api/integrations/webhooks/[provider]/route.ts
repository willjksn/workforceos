import { NextResponse } from "next/server";

import { applyCheckrWebhook, WebhookError, receiveProviderWebhook } from "@/lib/integrations/webhooks";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-workforceos-signature") ??
    request.headers.get("x-docusign-signature-1") ??
    request.headers.get("intuit-signature") ??
    request.headers.get("x-checkr-signature") ??
    null;
  const eventId = request.headers.get("x-webhook-event-id");
  const organizationId = request.headers.get("x-organization-id");
  try {
    const { assertRateLimit, RATE_LIMITS } = await import("@/lib/security/rate-limit");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertRateLimit({ key: `webhook:${provider}:${ip}`, ...RATE_LIMITS.webhook });
    const result = await receiveProviderWebhook({
      provider,
      organizationId,
      rawBody,
      signature,
      eventId,
    });
    if (!result.replay && organizationId) {
      if (provider === "checkr") {
        const payload = result.receipt.payload as {
          data?: { object?: { candidate_id?: string; id?: string; status?: string } };
          type?: string;
        };
        await applyCheckrWebhook({
          organizationId,
          providerCandidateId: payload.data?.object?.candidate_id ?? null,
          invitationId: payload.data?.object?.id ?? null,
          reportId: payload.data?.object?.id ?? null,
          status: payload.data?.object?.status ?? null,
        });
      }
      await inngest.send({
        name:
          provider === "docusign"
            ? "workforceos/docusign.status"
            : provider === "quickbooks"
              ? "workforceos/quickbooks.sync"
              : provider === "checkr"
                ? "workforceos/workspace.sync"
                : "workforceos/workspace.sync",
        data: { organizationId, provider, receiptId: result.receipt.id },
      });
    }
    return NextResponse.json({ ok: true, replay: result.replay, id: result.receipt.id });
  } catch (error) {
    if (error instanceof WebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const { RateLimitError } = await import("@/lib/security/rate-limit");
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
}
