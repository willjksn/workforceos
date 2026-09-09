import type { RoleSlug } from "./permissions";

export const ACCESS_BUNDLE_LABELS: Record<RoleSlug, string> = {
  "managing-partner": "Administrator / Executive",
  "operations-administrator": "Operations",
  "strategy-technology-administrator": "Strategy & Technology",
  "talent-partner": "Senior Talent Partner",
  recruiter: "Recruiter Standard",
  "workforce-consultant": "Workforce Consultant",
  "military-talent-partner": "Military Talent Partner",
  "read-only": "Read only",
};

export const ROLE_GUIDE: Record<
  RoleSlug,
  {
    audience: string;
    access: string;
  }
> = {
  "managing-partner": {
    audience: "Firm leadership",
    access: "Full access to WorkforceOS, including people, access bundles, and connected tools.",
  },
  "operations-administrator": {
    audience: "Operations and delivery",
    access: "Can administer people, delivery, legal, and finance. Cannot change access bundles.",
  },
  "strategy-technology-administrator": {
    audience: "Platform and technology",
    access: "Can administer people and assign access bundles, except Managing Partner. Also manages platform settings.",
  },
  "talent-partner": {
    audience: "Search and talent leadership",
    access: "Talent, jobs, military mapping, and solution work. No admin screens.",
  },
  recruiter: {
    audience: "Recruiting staff",
    access: "Candidates, jobs, and military talent for searches. No commercial opportunity ownership and no admin screens.",
  },
  "workforce-consultant": {
    audience: "Workforce delivery",
    access: "Workforce assessments, forecasts, pipelines, career paths, and client-facing recommendation approval. No admin screens.",
  },
  "military-talent-partner": {
    audience: "Military talent practice",
    access: "Military-to-civilian mapping and related talent work. No admin screens.",
  },
  "read-only": {
    audience: "Reviewers",
    access: "Can view records. Cannot change them or see restricted candidate contact details.",
  },
};

export function labelForAccessBundle(slug: string) {
  if (slug in ACCESS_BUNDLE_LABELS) return ACCESS_BUNDLE_LABELS[slug as RoleSlug];
  return slug;
}

export function guideForRole(slug: string) {
  if (slug in ROLE_GUIDE) return ROLE_GUIDE[slug as RoleSlug];
  return {
    audience: "Assigned access bundle",
    access: "Access is granted from PostgreSQL access bundles, not Clerk metadata. Job titles are display-only.",
  };
}
