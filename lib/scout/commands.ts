import type { Permission } from "../rbac/permissions";

export const SCOUT_COMMAND_FAMILIES = [
  "SEARCH",
  "SUMMARIZE",
  "DRAFT",
  "CREATE",
  "UPDATE",
  "ASSIGN",
  "ADD_TO_POOL",
  "ADD_TO_JOB",
  "CREATE_TASK",
  "CREATE_FOLLOW_UP",
  "SHOW_RECORD",
  "SHOW_DASHBOARD",
  "FIND_MATCHES",
] as const;

export type ScoutCommandFamily = (typeof SCOUT_COMMAND_FAMILIES)[number];

export type ScoutRiskClass = "read" | "internal_write" | "external" | "destructive";

export type ScoutCommandDefinition = {
  family: ScoutCommandFamily;
  permission: Permission;
  risk: ScoutRiskClass;
  confirm: boolean;
  audit: boolean;
};

export const SCOUT_COMMAND_REGISTRY: Record<ScoutCommandFamily, ScoutCommandDefinition> = {
  SEARCH: { family: "SEARCH", permission: "scout.search", risk: "read", confirm: false, audit: false },
  SUMMARIZE: { family: "SUMMARIZE", permission: "scout.use", risk: "read", confirm: false, audit: false },
  DRAFT: { family: "DRAFT", permission: "scout.draft", risk: "internal_write", confirm: false, audit: true },
  CREATE: { family: "CREATE", permission: "scout.internal_actions", risk: "internal_write", confirm: true, audit: true },
  UPDATE: { family: "UPDATE", permission: "scout.internal_actions", risk: "internal_write", confirm: true, audit: true },
  ASSIGN: { family: "ASSIGN", permission: "scout.internal_actions", risk: "internal_write", confirm: true, audit: true },
  ADD_TO_POOL: {
    family: "ADD_TO_POOL",
    permission: "scout.internal_actions",
    risk: "internal_write",
    confirm: true,
    audit: true,
  },
  ADD_TO_JOB: {
    family: "ADD_TO_JOB",
    permission: "scout.internal_actions",
    risk: "internal_write",
    confirm: true,
    audit: true,
  },
  CREATE_TASK: {
    family: "CREATE_TASK",
    permission: "scout.internal_actions",
    risk: "internal_write",
    confirm: true,
    audit: true,
  },
  CREATE_FOLLOW_UP: {
    family: "CREATE_FOLLOW_UP",
    permission: "scout.internal_actions",
    risk: "internal_write",
    confirm: true,
    audit: true,
  },
  SHOW_RECORD: { family: "SHOW_RECORD", permission: "scout.use", risk: "read", confirm: false, audit: false },
  SHOW_DASHBOARD: { family: "SHOW_DASHBOARD", permission: "scout.use", risk: "read", confirm: false, audit: false },
  FIND_MATCHES: { family: "FIND_MATCHES", permission: "scout.search", risk: "read", confirm: false, audit: false },
};

export function isRegisteredCommand(value: string): value is ScoutCommandFamily {
  return (SCOUT_COMMAND_FAMILIES as readonly string[]).includes(value);
}

export function scoutCommand(family: string): ScoutCommandDefinition | null {
  if (!isRegisteredCommand(family)) return null;
  return SCOUT_COMMAND_REGISTRY[family];
}
