/**
 * Sample bands are shown next to every figure.
 * There is no hidden confidence score.
 *
 * Fewer than 5 relevant outcomes: insufficient evidence.
 * 5–19: early signal.
 * 20 or more: stronger operational pattern.
 */

export const INSUFFICIENT_BELOW = 5;
export const OPERATIONAL_PATTERN_AT = 20;

export const EVIDENCE_BANDS = ["insufficient", "early_signal", "operational_pattern"] as const;
export type EvidenceBand = (typeof EVIDENCE_BANDS)[number];

export function evidenceBand(sample: number): EvidenceBand {
  if (sample < INSUFFICIENT_BELOW) return "insufficient";
  if (sample < OPERATIONAL_PATTERN_AT) return "early_signal";
  return "operational_pattern";
}

export function bandLabel(band: EvidenceBand) {
  switch (band) {
    case "insufficient": return "Insufficient evidence";
    case "early_signal": return "Early signal";
    case "operational_pattern": return "Operational pattern";
    default: return band;
  }
}

export function formatCount(numerator: number, denominator: number) {
  if (denominator <= 0) return "0 of 0";
  const pct = Math.round((numerator / denominator) * 100);
  return `${numerator} of ${denominator} (${pct}%)`;
}

export const SELECTION_BIAS_CAVEAT =
  "These figures describe stored outcomes. They are shaped by which candidates a recruiter chose, which employers responded, which jobs were open, and which routes were tried. They are not a causal finding and they do not rank people.";

export const ADVISORY_BOUNDARY =
  "Outcome learning is advisory. Accepting a recommendation records a human note. It does not change match weights, match categories, military mappings, job requirements, candidate eligibility, or routing.";
