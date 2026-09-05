export const PIPELINE_STAGES = [
  "identified",
  "rediscovered",
  "contacted",
  "interested",
  "screening",
  "qualified",
  "submitted",
  "interview",
  "finalist",
  "offer",
  "placed",
  "rejected",
  "withdrawn",
  "nurture",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const LEGACY_PIPELINE: Record<string, PipelineStage> = {
  sourced: "identified",
  screened: "screening",
  interviewing: "interview",
  offered: "offer",
  declined: "rejected",
};

export function normalizePipelineStage(status: string): PipelineStage {
  if ((PIPELINE_STAGES as readonly string[]).includes(status)) {
    return status as PipelineStage;
  }
  return LEGACY_PIPELINE[status] ?? "identified";
}

export const ADVANCEMENT_ORDER: PipelineStage[] = [
  "identified",
  "rediscovered",
  "contacted",
  "interested",
  "screening",
  "qualified",
  "submitted",
  "interview",
  "finalist",
  "offer",
  "placed",
];

export function isTerminalPipelineStage(stage: PipelineStage) {
  return stage === "placed" || stage === "rejected" || stage === "withdrawn";
}

export function materialRejectionRequiresHuman(stage: PipelineStage, actorType: "human" | "agent" | "system") {
  return stage === "rejected" && actorType !== "human";
}
