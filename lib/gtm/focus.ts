import { LAUNCH_SERVICE_CODES } from "../crm/stages";

/** Closed GTM account tiers. Not a new CRM object. */
export const GTM_TIERS = ["tier_1", "tier_2"] as const;
export type GtmTier = (typeof GTM_TIERS)[number];

/** Southeast BD vs national recruiting motion. */
export const GTM_REGIONS = ["southeast", "national"] as const;
export type GtmRegion = (typeof GTM_REGIONS)[number];

export const GTM_TIER_LABELS: Record<GtmTier, string> = {
  tier_1: "Tier 1",
  tier_2: "Tier 2",
};

export const GTM_REGION_LABELS: Record<GtmRegion, string> = {
  southeast: "Southeast",
  national: "National",
};

/** Locked focus industries for this 90-day plan — not new services. */
export const GTM_TIER_1_INDUSTRIES = [
  "Energy / Utilities",
  "Advanced Manufacturing",
  "Infrastructure",
  "Industrial / Technical Operations",
] as const;

export const GTM_TIER_2_INDUSTRIES = [
  "Data Centers",
  "Aerospace / Defense",
  "Engineering",
  "Supply Chain / Logistics",
] as const;

export const GTM_FOCUS_INDUSTRIES = [...GTM_TIER_1_INDUSTRIES, ...GTM_TIER_2_INDUSTRIES] as const;

/** ILIKE patterns for companies.industry when gtm_tier is not set. */
export const GTM_FOCUS_INDUSTRY_PATTERNS = [
  "%energy%",
  "%utilit%",
  "%manufactur%",
  "%infrastructure%",
  "%industrial%",
  "%technical operation%",
  "%data center%",
  "%aerospace%",
  "%defense%",
  "%defence%",
  "%engineering%",
  "%supply chain%",
  "%logistic%",
] as const;

export const GTM_LAUNCH_SERVICE_CODES = LAUNCH_SERVICE_CODES;

export const GTM_MILITARY_SERVICE_CODE = "military-talent-opportunity-assessment" as const;

export const GTM_PLAN_PATH = "docs/business/PIERONE_90_DAY_GTM_PLAN.md";
export const GTM_CADENCE_HREF = "/app?cadence=gtm";

export function isGtmTier(value: string | null | undefined): value is GtmTier {
  return Boolean(value && (GTM_TIERS as readonly string[]).includes(value));
}

export function isGtmRegion(value: string | null | undefined): value is GtmRegion {
  return Boolean(value && (GTM_REGIONS as readonly string[]).includes(value));
}
