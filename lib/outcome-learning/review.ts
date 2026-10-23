import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { outcomeLearningRecommendations } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { RECOMMENDATION_TYPES, type RecommendationDraft, type RecommendationType } from "./analyze";
import { EVIDENCE_BANDS, type EvidenceBand } from "./thresholds";
import { OUTCOME_WINDOWS, type OutcomeWindow } from "./windows";

export const REVIEW_STATES = ["new", "reviewing", "accepted_as_note", "dismissed", "needs_more_data"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export type StoredRecommendation = typeof outcomeLearningRecommendations.$inferSelect;

const AUDIT_ACTION: Record<Exclude<ReviewState, "new">, string> = {
  reviewing: "outcome_recommendation.reviewing",
  accepted_as_note: "outcome_recommendation.accepted_as_note",
  dismissed: "outcome_recommendation.dismissed",
  needs_more_data: "outcome_recommendation.needs_more_data",
};

export async function listStoredRecommendations(organizationId: string, timeWindow: OutcomeWindow) {
  const db = getDb();
  return db
    .select()
    .from(outcomeLearningRecommendations)
    .where(and(
      eq(outcomeLearningRecommendations.organizationId, organizationId),
      eq(outcomeLearningRecommendations.timeWindow, timeWindow),
    ));
}

export async function recordRecommendationReview(input: {
  organizationId: string;
  actorUserId: string;
  timeWindow: OutcomeWindow;
  windowStart: Date | null;
  windowEnd: Date;
  draft: RecommendationDraft;
  reviewState: Exclude<ReviewState, "new">;
  reviewNote: string | null;
}) {
  if (!(RECOMMENDATION_TYPES as readonly string[]).includes(input.draft.recommendationType)) {
    throw new Error("Unknown recommendation type.");
  }
  if (!(EVIDENCE_BANDS as readonly string[]).includes(input.draft.evidenceBand)) {
    throw new Error("Unknown evidence band.");
  }
  if (!(OUTCOME_WINDOWS as readonly string[]).includes(input.timeWindow)) {
    throw new Error("Unknown time window.");
  }
  const db = getDb();
  const now = new Date();
  const identity = and(
    eq(outcomeLearningRecommendations.organizationId, input.organizationId),
    eq(outcomeLearningRecommendations.recommendationType, input.draft.recommendationType),
    eq(outcomeLearningRecommendations.subjectKey, input.draft.subjectKey),
    eq(outcomeLearningRecommendations.timeWindow, input.timeWindow),
  );
  const [existing] = await db.select().from(outcomeLearningRecommendations).where(identity).limit(1);
  const values = {
    sampleCount: input.draft.sampleCount,
    evidenceBand: input.draft.evidenceBand,
    observedPattern: input.draft.observedPattern,
    whyItMatters: input.draft.whyItMatters,
    humanReviewPrompt: input.draft.humanReviewPrompt,
    sourceRecords: input.draft.sourceRecords,
    sourceFilter: input.draft.sourceFilter,
    supportingSummary: input.draft.supportingSummary,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    reviewState: input.reviewState,
    reviewedByUserId: input.actorUserId,
    reviewedAt: now,
    reviewNote: input.reviewNote,
    generatedAt: now,
    updatedAt: now,
  };
  const [saved] = existing
    ? await db.update(outcomeLearningRecommendations).set(values).where(and(
      eq(outcomeLearningRecommendations.id, existing.id),
      eq(outcomeLearningRecommendations.organizationId, input.organizationId),
    )).returning()
    : await db.insert(outcomeLearningRecommendations).values({
      organizationId: input.organizationId,
      recommendationType: input.draft.recommendationType,
      subjectKey: input.draft.subjectKey,
      timeWindow: input.timeWindow,
      ...values,
    }).returning();
  if (!saved) return null;
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: AUDIT_ACTION[input.reviewState],
    recordType: "outcome_learning_recommendation",
    recordId: saved.id,
    before: existing ? { reviewState: existing.reviewState, reviewNote: existing.reviewNote } : undefined,
    after: { reviewState: saved.reviewState, reviewNote: saved.reviewNote, sampleCount: saved.sampleCount },
    reason: input.reviewNote ?? undefined,
  });
  return saved;
}

export async function reviewStoredRecommendation(input: {
  organizationId: string;
  actorUserId: string;
  recommendationId: string;
  reviewState: Exclude<ReviewState, "new">;
  reviewNote?: string | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(outcomeLearningRecommendations)
    .where(and(
      eq(outcomeLearningRecommendations.id, input.recommendationId),
      eq(outcomeLearningRecommendations.organizationId, input.organizationId),
    ))
    .limit(1);
  if (!existing) return null;
  return recordRecommendationReview({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    timeWindow: existing.timeWindow as OutcomeWindow,
    windowStart: existing.windowStart,
    windowEnd: existing.windowEnd,
    reviewState: input.reviewState,
    reviewNote: input.reviewNote ?? existing.reviewNote,
    draft: {
      recommendationType: existing.recommendationType as RecommendationType,
      subjectKey: existing.subjectKey,
      sampleCount: existing.sampleCount,
      evidenceBand: existing.evidenceBand as EvidenceBand,
      observedPattern: existing.observedPattern,
      whyItMatters: existing.whyItMatters,
      humanReviewPrompt: existing.humanReviewPrompt,
      sourceRecords: existing.sourceRecords,
      sourceFilter: existing.sourceFilter,
      supportingSummary: existing.supportingSummary,
    },
  });
}
