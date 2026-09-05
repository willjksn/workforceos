import type { workforceCriticalityEnum } from "../../db/schema/enums";

type Severity = (typeof workforceCriticalityEnum.enumValues)[number];

export type GapThreshold = {
  severity: Severity;
  minGap: number;
  minGapPercent: number;
};

export const DEFAULT_GAP_THRESHOLDS: GapThreshold[] = [
  { severity: "critical", minGap: 25, minGapPercent: 30 },
  { severity: "high", minGap: 10, minGapPercent: 15 },
  { severity: "moderate", minGap: 5, minGapPercent: 8 },
  { severity: "low", minGap: 0, minGapPercent: 0 },
];

export function computeGap(demand: number, supply: number) {
  return Math.round(demand) - Math.round(supply);
}

export function classifyGapSeverity(gap: number, demand: number, thresholds: GapThreshold[] = DEFAULT_GAP_THRESHOLDS): Severity {
  const gapPercent = demand > 0 ? (gap / demand) * 100 : gap > 0 ? 100 : 0;
  const ordered = [...thresholds].sort((a, b) => b.minGap - a.minGap);
  for (const threshold of ordered) {
    if (gap >= threshold.minGap || gapPercent >= threshold.minGapPercent) {
      return threshold.severity;
    }
  }
  return "low";
}

export type PipelineAllocation = {
  sourceType: string;
  plannedCount: number;
  actualCount?: number;
};

export function pipelineCoverage(gap: number, allocations: PipelineAllocation[]) {
  const planned = allocations.reduce((sum, row) => sum + row.plannedCount, 0);
  const actual = allocations.reduce((sum, row) => sum + (row.actualCount ?? 0), 0);
  const remaining = gap - planned;
  return {
    planned,
    actual,
    remaining,
    coversGap: planned >= gap,
    warning: planned < gap
      ? `Planned pipeline capacity (${planned}) does not cover the forecast gap (${gap}).`
      : null,
  };
}

export function scarcityFromEvidence(input: {
  laborSupplyKnown: boolean;
  hiringDifficulty?: string | null;
  historicalTimeToFillDays?: number | null;
  militarySupplyKnown: boolean;
  internalPipelineCount?: number | null;
}): "unknown" | "estimated" | "internal_only" | "scarce" | "moderate" | "abundant" {
  if (!input.laborSupplyKnown) {
    if ((input.internalPipelineCount ?? 0) > 0 || input.militarySupplyKnown) return "internal_only";
    return "unknown";
  }
  if ((input.historicalTimeToFillDays ?? 0) >= 90 || input.hiringDifficulty === "high") return "scarce";
  if ((input.internalPipelineCount ?? 0) >= 20 && (input.historicalTimeToFillDays ?? 0) < 45) return "abundant";
  if (input.hiringDifficulty || input.historicalTimeToFillDays) return "estimated";
  return "moderate";
}
