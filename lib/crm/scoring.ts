export const SCORE_WEIGHTS = {
  icpFit: 20,
  triggerScore: 25,
  demonstratedPain: 20,
  serviceFit: 15,
  buyerAccess: 10,
  timingBudget: 10,
} as const;

export type ScoreComponents = {
  icpFit: number;
  triggerScore: number;
  demonstratedPain: number;
  serviceFit: number;
  buyerAccess: number;
  timingBudget: number;
};

export type ScoreBand = "priority" | "active_qualified" | "nurture" | "monitor";

export function totalOpportunityScore(components: ScoreComponents) {
  return (
    clamp(components.icpFit, SCORE_WEIGHTS.icpFit) +
    clamp(components.triggerScore, SCORE_WEIGHTS.triggerScore) +
    clamp(components.demonstratedPain, SCORE_WEIGHTS.demonstratedPain) +
    clamp(components.serviceFit, SCORE_WEIGHTS.serviceFit) +
    clamp(components.buyerAccess, SCORE_WEIGHTS.buyerAccess) +
    clamp(components.timingBudget, SCORE_WEIGHTS.timingBudget)
  );
}

export function classifyOpportunityScore(total: number): ScoreBand {
  if (total >= 80) return "priority";
  if (total >= 65) return "active_qualified";
  if (total >= 50) return "nurture";
  return "monitor";
}

export function effectiveOpportunityScore(total: number, overrideScore?: number | null) {
  return overrideScore ?? total;
}

function clamp(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}
