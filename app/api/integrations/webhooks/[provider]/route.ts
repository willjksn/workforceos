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
    throw error;
  }
}
