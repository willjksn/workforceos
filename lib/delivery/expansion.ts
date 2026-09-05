/** Expansion suggestions stored on approved service versions and re-read from PostgreSQL. */
export const APPROVED_EXPANSION_MAP: Record<string, string[]> = {
  "professional-search": [
    "fractional-talent-partner",
    "military-talent-opportunity-assessment",
    "workforce-pipeline-assessment",
  ],
  "military-talent-opportunity-assessment": [
    "fractional-talent-partner",
    "workforce-pipeline-assessment",
  ],
  "ta-performance-assessment": ["fractional-talent-partner", "professional-search"],
  "fractional-talent-partner": [
    "professional-search",
    "military-talent-opportunity-assessment",
    "workforce-pipeline-assessment",
  ],
  "workforce-pipeline-assessment": [
    "military-talent-opportunity-assessment",
    "fractional-talent-partner",
    "professional-search",
  ],
};

export function expansionCodesFromVersion(
  stored: string[] | null | undefined,
  serviceCode: string,
) {
  if (stored && stored.length > 0) return stored;
  return APPROVED_EXPANSION_MAP[serviceCode] ?? [];
}
