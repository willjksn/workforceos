export const OPEN_OPPORTUNITY_STAGES = [
  "identified",
  "target",
  "qualified",
  "discovery_scheduled",
  "discovery_complete",
  "proposal",
  "negotiation",
  "nurture",
] as const;

export const CLOSED_OPPORTUNITY_STAGES = ["won", "lost", "abandoned"] as const;

export const OPPORTUNITY_STAGES = [
  ...OPEN_OPPORTUNITY_STAGES,
  ...CLOSED_OPPORTUNITY_STAGES,
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const LAUNCH_SERVICE_CODES = [
  "professional-search",
  "military-talent-opportunity-assessment",
  "ta-performance-assessment",
  "fractional-talent-partner",
  "workforce-pipeline-assessment",
] as const;

export function isClosedOpportunityStage(stage: string) {
  return (CLOSED_OPPORTUNITY_STAGES as readonly string[]).includes(stage);
}

export function isOpenOpportunityStage(stage: string) {
  return (OPEN_OPPORTUNITY_STAGES as readonly string[]).includes(stage);
}
