export const OUTCOME_WINDOWS = ["30d", "90d", "180d", "365d", "all"] as const;
export type OutcomeWindow = (typeof OUTCOME_WINDOWS)[number];

export const DEFAULT_OUTCOME_WINDOW: OutcomeWindow = "90d";

export function parseOutcomeWindow(value: string | null | undefined): OutcomeWindow {
  if (value && (OUTCOME_WINDOWS as readonly string[]).includes(value)) return value as OutcomeWindow;
  return DEFAULT_OUTCOME_WINDOW;
}

export function windowBounds(window: OutcomeWindow, now: Date) {
  const end = now;
  if (window === "all") {
    return { start: null as Date | null, end, label: "all available history" };
  }
  const days = window === "30d" ? 30 : window === "90d" ? 90 : window === "180d" ? 180 : 365;
  const start = new Date(end.getTime() - days * 86_400_000);
  const label = window === "30d"
    ? "the last 30 days"
    : window === "90d"
      ? "the last 90 days"
      : window === "180d"
        ? "the last 6 months"
        : "the last 12 months";
  return { start, end, label };
}
