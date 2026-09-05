export const AUTONOMY_LEVELS = {
  0: "read_only",
  1: "recommend_draft",
  2: "write_internal_draft",
  3: "execute_internal_workflow",
  4: "external_action_requires_human",
} as const;

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export function parseAutonomyLevel(value: number | null | undefined): AutonomyLevel {
  if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4) return value;
  return 1;
}

export function canWriteDraftRecords(level: AutonomyLevel) {
  return level >= 2;
}

export function canExecuteInternalWorkflow(level: AutonomyLevel) {
  return level >= 3;
}

export function canQueueExternalAction(level: AutonomyLevel) {
  return level >= 4;
}

export function autonomyLabel(level: AutonomyLevel) {
  return AUTONOMY_LEVELS[level];
}
