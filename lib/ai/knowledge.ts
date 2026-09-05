import { createHash } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../../db";
import { knowledgeRecords, semanticDocuments, TEMPORARY_EMBEDDING_DIMENSIONS } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { hashContent, indexSemanticDocument } from "../search/semantic";
import { AgentError } from "./errors";

export function developmentEmbedding(text: string) {
  const digest = createHash("sha256").update(text).digest();
  const values = Array.from({ length: TEMPORARY_EMBEDDING_DIMENSIONS }, (_, index) => {
    const byte = digest[index % digest.length] ?? 0;
    return (byte - 128) / 128;
  });
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / magnitude);
}

function canAccessKnowledge(
  record: { privacyClass: string; requiredPermission: string | null; status: string },
  permissions: ReadonlySet<string>,
) {
  if (record.status !== "approved") return false;
  if (record.privacyClass === "restricted_pii" && !permissions.has("candidate_pii.read")) return false;
  if (record.privacyClass === "confidential" && !permissions.has("legal.read") && !permissions.has("finance.read")) {
    if (record.requiredPermission && !permissions.has(record.requiredPermission)) return false;
  }
  if (record.requiredPermission && !permissions.has(record.requiredPermission)) return false;
  if (record.privacyClass === "restricted_pii") return false;
  return true;
}

export async function retrieveApprovedKnowledge(input: {
  organizationId: string;
  permissions: ReadonlySet<string>;
  query: string;
  limit?: number;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.organizationId, input.organizationId),
        eq(knowledgeRecords.status, "approved"),
      ),
    )
    .orderBy(desc(knowledgeRecords.updatedAt));
  const allowed = rows.filter((row) => canAccessKnowledge(row, input.permissions));
  const needle = input.query.toLowerCase();
  const ranked = allowed
    .map((row) => {
      const haystack = `${row.title} ${row.content} ${row.knowledgeType}`.toLowerCase();
      const score = needle.split(/\s+/).filter((token) => token && haystack.includes(token)).length;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 5)
    .map(({ row }) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      excerpt: row.content.slice(0, 400),
      knowledgeType: row.knowledgeType,
      version: row.version,
    }));
  return ranked;
}

export async function retrieveKnowledgeByEmbedding(input: {
  organizationId: string;
  permissions: ReadonlySet<string>;
  query: string;
  limit?: number;
}) {
  const embedding = developmentEmbedding(input.query);
  const db = getDb();
  const docs = await db
    .select()
    .from(semanticDocuments)
    .where(
      and(
        eq(semanticDocuments.organizationId, input.organizationId),
        eq(semanticDocuments.entityType, "knowledge_record"),
      ),
    );
  const ids = docs.map((doc) => doc.entityId);
  if (ids.length === 0) return retrieveApprovedKnowledge(input);
  const records = await db
    .select()
    .from(knowledgeRecords)
    .where(and(eq(knowledgeRecords.organizationId, input.organizationId), inArray(knowledgeRecords.id, ids)));
  const allowedIds = new Set(
    records.filter((row) => canAccessKnowledge(row, input.permissions)).map((row) => row.id),
  );
  const filteredDocs = docs.filter((doc) => allowedIds.has(doc.entityId));
  const scored = filteredDocs
    .map((doc) => {
      const docVec = (doc.embedding as number[] | null) ?? [];
      let dot = 0;
      for (let i = 0; i < Math.min(docVec.length, embedding.length); i += 1) {
        dot += (docVec[i] ?? 0) * embedding[i];
      }
      return { doc, score: dot };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 5);
  const byId = Object.fromEntries(records.map((row) => [row.id, row]));
  return scored.map(({ doc }) => {
    const row = byId[doc.entityId];
    return {
      id: row?.id ?? doc.entityId,
      title: row?.title ?? "Knowledge",
      source: row?.source ?? null,
      excerpt: (row?.content ?? doc.content).slice(0, 400),
      knowledgeType: row?.knowledgeType ?? "internal_process",
      version: row?.version ?? "1.0",
    };
  });
}

export async function createKnowledgeRecord(input: {
  organizationId: string;
  actorUserId: string;
  slug: string;
  title: string;
  knowledgeType: typeof knowledgeRecords.$inferInsert.knowledgeType;
  content: string;
  source?: string | null;
  privacyClass?: typeof knowledgeRecords.$inferInsert.privacyClass;
  requiredPermission?: string | null;
  version?: string;
  status?: "draft" | "approved";
  changeReason?: string;
}) {
  if (input.privacyClass === "restricted_pii") {
    throw new AgentError("Knowledge records cannot store Restricted candidate PII", "rbac");
  }
  const db = getDb();
  const [row] = await db
    .insert(knowledgeRecords)
    .values({
      organizationId: input.organizationId,
      slug: input.slug,
      title: input.title,
      knowledgeType: input.knowledgeType,
      content: input.content,
      source: input.source,
      privacyClass: input.privacyClass ?? "internal",
      requiredPermission: input.requiredPermission,
      version: input.version ?? "1.0",
      status: input.status ?? "draft",
      changeReason: input.changeReason,
      approvedByUserId: input.status === "approved" ? input.actorUserId : null,
      approvedAt: input.status === "approved" ? new Date() : null,
    })
    .returning();
  if (row.status === "approved") {
    await indexSemanticDocument({
      organizationId: input.organizationId,
      entityType: "knowledge_record",
      entityId: row.id,
      documentType: row.knowledgeType,
      content: row.content,
      embedding: developmentEmbedding(row.content),
      embeddingModel: "development-hash",
      embeddingVersion: "phase7-dev",
    });
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "knowledge_record.created",
    recordType: "knowledge_record",
    recordId: row.id,
    after: { slug: row.slug, status: row.status, privacyClass: row.privacyClass },
  });
  return row;
}

export async function approveKnowledgeRecord(input: {
  organizationId: string;
  actorUserId: string;
  knowledgeRecordId: string;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(knowledgeRecords)
    .where(eq(knowledgeRecords.id, input.knowledgeRecordId))
    .limit(1);
  if (!before) throw new AgentError("Knowledge record not found", "not_found");
  const [after] = await db
    .update(knowledgeRecords)
    .set({
      status: "approved",
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeRecords.id, input.knowledgeRecordId))
    .returning();
  const [existing] = await db
    .select()
    .from(semanticDocuments)
    .where(
      and(
        eq(semanticDocuments.entityType, "knowledge_record"),
        eq(semanticDocuments.entityId, after.id),
      ),
    )
    .limit(1);
  if (!existing) {
    await indexSemanticDocument({
      organizationId: input.organizationId,
      entityType: "knowledge_record",
      entityId: after.id,
      documentType: after.knowledgeType,
      content: after.content,
      embedding: developmentEmbedding(after.content),
      embeddingModel: "development-hash",
      embeddingVersion: "phase7-dev",
    });
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "knowledge_record.approved",
    recordType: "knowledge_record",
    recordId: after.id,
    before: { status: before.status },
    after: { status: after.status },
  });
  return after;
}

export { hashContent };
