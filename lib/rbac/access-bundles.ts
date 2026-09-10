/**
 * Access templates are job-shaped shortcuts. Functional bundles are module
 * checkboxes. Title is never either. Only admin.roles may assign both.
 */
export const ACCESS_TEMPLATE_SLUGS = [
  "managing-partner",
  "operations-administrator",
  "strategy-technology-administrator",
  "talent-partner",
  "recruiter",
  "workforce-consultant",
  "military-talent-partner",
  "read-only",
] as const;

export const FUNCTIONAL_BUNDLE_SLUGS = [
  "crm-business-development",
  "talent-network",
  "recruiting",
  "military-talent",
  "workforce-consulting",
  "projects",
  "proposals",
  "contracts",
  "finance",
  "hiring-onboarding",
  "reports-analytics",
  "scout",
  "ai-review",
  "ai-administration",
  "knowledge-training",
  "system-administration",
] as const;

export type AccessTemplateSlug = (typeof ACCESS_TEMPLATE_SLUGS)[number];
export type FunctionalBundleSlug = (typeof FUNCTIONAL_BUNDLE_SLUGS)[number];

export function isAccessTemplateSlug(value: string): value is AccessTemplateSlug {
  return (ACCESS_TEMPLATE_SLUGS as readonly string[]).includes(value);
}

export function isFunctionalBundleSlug(value: string): value is FunctionalBundleSlug {
  return (FUNCTIONAL_BUNDLE_SLUGS as readonly string[]).includes(value);
}
