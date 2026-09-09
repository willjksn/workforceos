import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { backgroundChecks, contracts, esignEnvelopes, integrationWebhookReceipts } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { webhookSecret } from "./credentials";
import { stableEventId, verifyWebhookSignature } from "./providers";
import { logIntegrationEvent } from "./retry";

export class WebhookError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

export async function receiveProviderWebhook(input: {
  provider: string;
  organizationId?: string | null;
  rawBody: string;
  signature: string | null;
  eventId?: string | null;
}) {
  const secret = webhookSecret(input.provider);
  const signatureValid = verifyWebhookSignature({
    provider: input.provider,
    rawBody: input.rawBody,
    signature: input.signature,
    secret,
  });
  if (!signatureValid) {
    throw new WebhookError("Unsigned or invalid webhook payload rejected", 401);
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(input.rawBody) as Record<string, unknown>;
  } catch {
    throw new WebhookError("Webhook body must be JSON");
  }
  const externalEventId =
    input.eventId ??
    (typeof parsed.eventId === "string" ? parsed.eventId : null) ??
    stableEventId(input.provider, input.rawBody);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(integrationWebhookReceipts)
    .where(eq(integrationWebhookReceipts.externalEventId, externalEventId))
    .limit(1);
  if (existing) {
    return { receipt: existing, replay: true };
  }
  const [receipt] = await db
    .insert(integrationWebhookReceipts)
    .values({
      organizationId: input.organizationId ?? null,
      provider: input.provider,
      externalEventId,
      signatureValid: true,
      status: "queued",
      payload: parsed,
    })
    .returning();
  if (input.organizationId) {
    await logIntegrationEvent({
      organizationId: input.organizationId,
      provider: input.provider,
      action: "webhook.received",
      status: "queued",
      externalEventId,
      idempotencyKey: `webhook:${input.provider}:${externalEventId}`,
    });
  }
  return { receipt, replay: false };
}

export async function applyDocuSignStatus(input: {
  organizationId: string;
  envelopeId: string;
  status: string;
  completedDocumentKey?: string | null;
  actorUserId?: string | null;
  confirmed: boolean;
}) {
  if (!input.confirmed) {
    throw new WebhookError("DocuSign status changes require provider or manual confirmation");
  }
  const db = getDb();
  const [envelope] = await db
    .select()
    .from(esignEnvelopes)
    .where(eq(esignEnvelopes.providerEnvelopeId, input.envelopeId))
    .limit(1);
  if (!envelope) throw new WebhookError("Envelope not found", 404);
  const completed = input.status === "completed";
  const [updatedEnvelope] = await db
    .update(esignEnvelopes)
    .set({
      status: completed ? "completed" : envelope.status,
      completedDocumentKey: input.completedDocumentKey ?? envelope.completedDocumentKey,
      completedAt: completed ? new Date() : envelope.completedAt,
      signerStatus: input.status,
      updatedAt: new Date(),
    })
    .where(eq(esignEnvelopes.id, envelope.id))
    .returning();
  if (completed) {
    const [before] = await db.select().from(contracts).where(eq(contracts.id, envelope.contractId)).limit(1);
    if (before) {
      const [after] = await db
        .update(contracts)
        .set({
          status: "executed",
          signatureStatus: "completed",
          executionDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, before.id))
        .returning();
      await recordAuditEvent({
        organizationId: input.organizationId,
        actor: { type: input.actorUserId ? "human" : "system", userId: input.actorUserId },
        action: "docusign.contract_executed",
        recordType: "contract",
        recordId: after.id,
        before,
        after,
      });
    }
  } else {
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: input.actorUserId ? "human" : "system", userId: input.actorUserId },
      action: "docusign.status_changed",
      recordType: "esign_envelope",
      recordId: updatedEnvelope.id,
      after: updatedEnvelope,
    });
  }
  return updatedEnvelope;
}

export async function applyCheckrWebhook(input: {
  organizationId: string;
  providerCandidateId?: string | null;
  invitationId?: string | null;
  reportId?: string | null;
  status?: string | null;
}) {
  const db = getDb();
  const rows = input.providerCandidateId
    ? await db
        .select()
        .from(backgroundChecks)
        .where(eq(backgroundChecks.providerCandidateId, input.providerCandidateId))
        .limit(1)
    : [];
  const [row] = rows;
  if (!row || row.organizationId !== input.organizationId) {
    return { updated: false, autoRejected: false };
  }
  const reviewStatus = input.status === "clear" || input.status === "cleared" ? "review_required" : "review_required";
  await db
    .update(backgroundChecks)
    .set({
      status: "review_required",
      providerReportId: input.reportId ?? row.providerReportId,
      resultSummary:
        "Checkr webhook received. Human review required. Results never auto-reject. WorkforceOS does not generate FCRA adverse-action letters.",
      reviewStatus,
      updatedAt: new Date(),
    })
    .where(eq(backgroundChecks.id, row.id));
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "system" },
    action: "checkr.webhook_received",
    recordType: "background_check",
    recordId: row.id,
    after: { autoRejected: false, reviewStatus },
  });
  return { updated: true, autoRejected: false, backgroundCheckId: row.id };
}
