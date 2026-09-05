import { NextResponse } from "next/server";

import { WebhookError, receiveProviderWebhook } from "@/lib/integrations/webhooks";
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
      await inngest.send({
        name:
          provider === "docusign"
            ? "workforceos/docusign.status"
            : provider === "quickbooks"
              ? "workforceos/quickbooks.sync"
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
