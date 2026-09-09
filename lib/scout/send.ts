import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getEmailProvider, isTransactionalEmailConfigured } from "../email";
import { can, type Principal } from "../rbac/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";

const confirmationStore = new Map<string, { userId: string; expiresAt: number; subject: string; body: string; to?: string }>();

export type ScoutSendDraft = {
  subject: string;
  body: string;
  sendAllowed: boolean;
  facts: string[];
  confirmationToken?: string;
};

export type ScoutSendGateResult = {
  sendAllowed: false | true;
  message: string;
  confirmationToken?: string;
};

function confirmationSecret() {
  return process.env.INTEGRATION_WEBHOOK_SECRET?.trim() || process.env.SCOUT_SEND_CONFIRMATION_SECRET?.trim() || "workforceos-scout-send-dev";
}

export function evaluateScoutSendGates(input: {
  principal: Principal;
  confirmationToken?: string | null;
  transactionalReady?: boolean;
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!can(input.principal, "scout.external_actions")) {
    reasons.push("Missing permission: scout.external_actions");
  }
  if (!can(input.principal, "transactional_email.send")) {
    reasons.push("Missing permission: transactional_email.send");
  }
  const ready = input.transactionalReady ?? isTransactionalEmailConfigured();
  if (!ready) {
    reasons.push("Transactional email provider is not configured.");
  }
  if (!input.confirmationToken) {
    reasons.push("Human confirmation token is required.");
  }
  return { ok: reasons.length === 0, reasons };
}

export function issueScoutSendConfirmation(input: {
  principal: Principal;
  subject: string;
  body: string;
  to?: string;
}) {
  const token = `${randomBytes(16).toString("hex")}.${createHmac("sha256", confirmationSecret())
    .update(`${input.principal.id}:${Date.now()}`)
    .digest("hex")
    .slice(0, 24)}`;
  confirmationStore.set(token, {
    userId: input.principal.id,
    expiresAt: Date.now() + 15 * 60 * 1000,
    subject: input.subject,
    body: input.body,
    to: input.to,
  });
  return token;
}

export function consumeScoutSendConfirmation(input: { principal: Principal; confirmationToken: string }) {
  const stored = confirmationStore.get(input.confirmationToken);
  if (!stored) return null;
  if (stored.userId !== input.principal.id || stored.expiresAt < Date.now()) {
    confirmationStore.delete(input.confirmationToken);
    return null;
  }
  confirmationStore.delete(input.confirmationToken);
  return stored;
}

export function resetScoutSendConfirmationsForTests() {
  confirmationStore.clear();
}

export function isScoutSendPathEnabled() {
  return isTransactionalEmailConfigured();
}

export async function rejectScoutSend() {
  return {
    sendAllowed: false as const,
    message: "Scout cannot send external messages without scout.external_actions, a confirmation token, and a ready transactional provider.",
  };
}

export async function executeApprovedScoutSend(input: {
  principal: Principal;
  confirmationToken: string;
  to: string;
  subject: string;
  body: string;
}): Promise<ScoutSendGateResult> {
  const gates = evaluateScoutSendGates({
    principal: input.principal,
    confirmationToken: input.confirmationToken,
    transactionalReady: isTransactionalEmailConfigured(),
  });
  if (!gates.ok) {
    await recordAuditEvent({
      organizationId: input.principal.organizationId,
      actor: { type: "human", userId: input.principal.id },
      action: "scout.send_denied",
      recordType: "scout_draft",
      recordId: input.principal.id,
      after: { sendAllowed: false, reasons: gates.reasons },
    });
    return { sendAllowed: false, message: gates.reasons.join(" ") };
  }
  const consumed = consumeScoutSendConfirmation({
    principal: input.principal,
    confirmationToken: input.confirmationToken,
  });
  if (!consumed) {
    return { sendAllowed: false, message: "Confirmation token is invalid or expired." };
  }
  const expected = Buffer.from(input.confirmationToken);
  const provided = Buffer.from(input.confirmationToken);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { sendAllowed: false, message: "Confirmation token is invalid or expired." };
  }
  const sent = await getEmailProvider().sendTransactional({
    organizationId: input.principal.organizationId,
    to: input.to,
    template: "application_update",
    subject: input.subject,
    html: `<p>${input.body.replace(/</g, "&lt;")}</p>`,
    text: input.body,
    entityType: "scout_draft",
  });
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "scout.send_confirmed",
    recordType: "scout_draft",
    recordId: input.principal.id,
    after: { sendAllowed: true, provider: sent.provider, status: sent.status },
    reason: "Human confirmed Scout transactional send",
  });
  if (sent.status === "failed") {
    return { sendAllowed: false, message: sent.error ?? "Transactional send failed." };
  }
  return { sendAllowed: true, message: "Message sent through the transactional provider after human confirmation." };
}
