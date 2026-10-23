"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { RECOMMENDATION_TYPES } from "@/lib/outcome-learning/analyze";
import { recordRecommendationReview, REVIEW_STATES } from "@/lib/outcome-learning/review";
import { EVIDENCE_BANDS } from "@/lib/outcome-learning/thresholds";
import { OUTCOME_WINDOWS } from "@/lib/outcome-learning/windows";

type ActionState = { error?: string; message?: string };

const reviewSchema = z.object({
  recommendationType: z.enum(RECOMMENDATION_TYPES),
  subjectKey: z.string().trim().min(1).max(160),
  timeWindow: z.enum(OUTCOME_WINDOWS),
  windowStart: z.string().datetime().optional().or(z.literal("")),
  windowEnd: z.string().datetime(),
  sampleCount: z.coerce.number().int().min(0).max(1_000_000),
  evidenceBand: z.enum(EVIDENCE_BANDS),
  observedPattern: z.string().trim().min(1).max(4000),
  whyItMatters: z.string().trim().min(1).max(4000),
  humanReviewPrompt: z.string().trim().min(1).max(4000),
  sourceRecords: z.string().trim().min(1).max(1000),
  sourceFilter: z.string().trim().min(1).max(1000),
  supportingSummary: z.string().trim().min(1).max(2000),
  reviewState: z.enum(REVIEW_STATES).exclude(["new"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

export async function reviewOutcomeRecommendationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAppPermission("reports.read");
  const parsed = reviewSchema.safeParse({
    recommendationType: formData.get("recommendationType"),
    subjectKey: formData.get("subjectKey"),
    timeWindow: formData.get("timeWindow"),
    windowStart: formData.get("windowStart") || "",
    windowEnd: formData.get("windowEnd"),
    sampleCount: formData.get("sampleCount"),
    evidenceBand: formData.get("evidenceBand"),
    observedPattern: formData.get("observedPattern"),
    whyItMatters: formData.get("whyItMatters"),
    humanReviewPrompt: formData.get("humanReviewPrompt"),
    sourceRecords: formData.get("sourceRecords"),
    sourceFilter: formData.get("sourceFilter"),
    supportingSummary: formData.get("supportingSummary"),
    reviewState: formData.get("reviewState"),
    reviewNote: formData.get("reviewNote") || undefined,
  });
  if (!parsed.success) return { error: "The recommendation could not be saved. Check the note and try again." };
  const saved = await recordRecommendationReview({
    organizationId: principal.organizationId,
    actorUserId: principal.id,
    timeWindow: parsed.data.timeWindow,
    windowStart: parsed.data.windowStart ? new Date(parsed.data.windowStart) : null,
    windowEnd: new Date(parsed.data.windowEnd),
    reviewState: parsed.data.reviewState,
    reviewNote: parsed.data.reviewNote ?? null,
    draft: parsed.data,
  });
  if (!saved) return { error: "The recommendation was not saved for this organization." };
  revalidatePath("/app/reports/outcome-learning");
  return {
    message: saved.reviewState === "accepted_as_note"
      ? "Saved as a note. Match rules, mappings, and requirements are unchanged."
      : "Review recorded. No matching or routing rule was changed.",
  };
}
