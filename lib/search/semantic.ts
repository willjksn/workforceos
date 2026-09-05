import { createHash } from "node:crypto";

import { and, cosineDistance, eq, sql } from "drizzle-orm";

import { getDb } from "../../db";
import { semanticDocuments, TEMPORARY_EMBEDDING_DIMENSIONS } from "../../db/schema";

export { TEMPORARY_EMBEDDING_DIMENSIONS };

export type SemanticDocumentInput = {
  organizationId: string;
  entityType: string;
  entityId: string;
  documentType: string;
  content: string;
  embedding?: number[];
  embeddingModel?: string;
  embeddingVersion?: string;
};

export function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export async function indexSemanticDocument(input: SemanticDocumentInput) {
  if (input.embedding && input.embedding.length !== TEMPORARY_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Development embeddings must use ${TEMPORARY_EMBEDDING_DIMENSIONS} dimensions until a production model is selected (DEC-SEM-001).`,
    );
  }

  const db = getDb();
  const [row] = await db
    .insert(semanticDocuments)
    .values({
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      documentType: input.documentType,
      content: input.content,
      contentHash: hashContent(input.content),
      embedding: input.embedding,
      embeddingModel: input.embeddingModel ?? "unspecified-development",
      embeddingVersion: input.embeddingVersion ?? "dev",
      embeddingDimensions: input.embedding?.length ?? null,
    })
    .returning();
  return row;
}

export async function searchSemanticDocuments(params: {
  organizationId: string;
  embedding: number[];
  limit?: number;
}) {
  if (params.embedding.length !== TEMPORARY_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Development search embeddings must use ${TEMPORARY_EMBEDDING_DIMENSIONS} dimensions (DEC-SEM-001).`,
    );
  }

  const db = getDb();
  const distance = cosineDistance(semanticDocuments.embedding, params.embedding);
  return db
    .select({
      id: semanticDocuments.id,
      entityType: semanticDocuments.entityType,
      entityId: semanticDocuments.entityId,
      documentType: semanticDocuments.documentType,
      content: semanticDocuments.content,
      distance,
    })
    .from(semanticDocuments)
    .where(
      and(
        eq(semanticDocuments.organizationId, params.organizationId),
        sql`${semanticDocuments.embedding} is not null`,
      ),
    )
    .orderBy(distance)
    .limit(params.limit ?? 10);
}
