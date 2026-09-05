import { getDb } from "../../db";
import { auditEvents } from "../../db/schema";

const REDACTED_KEYS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "refreshToken",
  "ssn",
  "socialSecurityNumber",
];

export type AuditActor = {
  type: "human" | "agent" | "system";
  userId?: string | null;
  agentId?: string | null;
};

export type AuditEventInput = {
  organizationId: string;
  actor: AuditActor;
  action: string;
  recordType: string;
  recordId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

export function redactSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSnapshot(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
        if (REDACTED_KEYS.some((redacted) => key.toLowerCase().includes(redacted.toLowerCase()))) {
          return [key, "[redacted]"];
        }
        return [key, redactSnapshot(nested)];
      }),
    );
  }
  return value;
}

export async function recordAuditEvent(input: AuditEventInput) {
  const db = getDb();
  const [event] = await db
    .insert(auditEvents)
    .values({
      organizationId: input.organizationId,
      actorType: input.actor.type,
      actorUserId: input.actor.userId ?? null,
      actorAgentId: input.actor.agentId ?? null,
      action: input.action,
      recordType: input.recordType,
      recordId: input.recordId,
      beforeSnapshot: redactSnapshot(input.before) ?? null,
      afterSnapshot: redactSnapshot(input.after) ?? null,
      reason: input.reason,
    })
    .returning();
  return event;
}
