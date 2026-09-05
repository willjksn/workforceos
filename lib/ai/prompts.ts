import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { promptVersions } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { AgentError } from "./errors";

export async function loadApprovedPrompt(input: {
  organizationId: string;
  agentId: string;
  promptName: string;
}) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(promptVersions)
    .where(
      and(
        eq(promptVersions.organizationId, input.organizationId),
        eq(promptVersions.agentId, input.agentId),
        eq(promptVersions.promptName, input.promptName),
        eq(promptVersions.status, "approved"),
      ),
    )
    .orderBy(desc(promptVersions.effectiveFrom))
    .limit(1);
  return row ?? null;
}

export async function createPromptVersion(input: {
  organizationId: string;
  actorUserId: string;
  agentId: string;
  promptName: string;
  version: string;
  content: string;
  changeReason: string;
  status?: "draft" | "approved";
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(promptVersions)
    .where(
      and(
        eq(promptVersions.agentId, input.agentId),
        eq(promptVersions.promptName, input.promptName),
        eq(promptVersions.version, input.version),
      ),
    )
    .limit(1);
  if (existing) {
    throw new AgentError("Prompt versions are immutable. Create a new version number.", "prompt");
  }
  const approved = input.status === "approved";
  const [row] = await db
    .insert(promptVersions)
    .values({
      organizationId: input.organizationId,
      agentId: input.agentId,
      promptName: input.promptName,
      version: input.version,
      content: input.content,
      changeReason: input.changeReason,
      status: input.status ?? "draft",
      approvedByUserId: approved ? input.actorUserId : null,
      approvedAt: approved ? new Date() : null,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "prompt_version.created",
    recordType: "prompt_version",
    recordId: row.id,
    after: { promptName: row.promptName, version: row.version, status: row.status },
  });
  return row;
}

export async function approvePromptVersion(input: {
  organizationId: string;
  actorUserId: string;
  promptVersionId: string;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, input.promptVersionId))
    .limit(1);
  if (!before) throw new AgentError("Prompt version not found", "not_found");
  if (before.status === "approved") {
    throw new AgentError("Approved production prompts cannot be edited. Create a new version.", "prompt");
  }
  const [after] = await db
    .update(promptVersions)
    .set({
      status: "approved",
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(promptVersions.id, input.promptVersionId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "prompt_version.approved",
    recordType: "prompt_version",
    recordId: after.id,
    before: { status: before.status },
    after: { status: after.status },
  });
  return after;
}

export function assertPromptImmutable(status: string) {
  if (status === "approved") {
    throw new AgentError("Approved production prompts cannot be silently edited.", "prompt");
  }
}
