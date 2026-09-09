import type { RoleSlug } from "./permissions";

export const ROLE_GUIDE: Record<
  RoleSlug,
  {
    audience: string;
    access: string;
  }
> = {
  "managing-partner": {
    audience: "Firm leadership",
    access: "Full access to WorkforceOS, including people, roles, and connected tools.",
  },
  "operations-administrator": {
    audience: "Operations and delivery",
    access: "Can administer people, delivery, legal, and finance. Cannot change roles.",
  },
  "strategy-technology-administrator": {
    audience: "Platform and technology",
    access: "Can administer people and assign roles, except Managing Partner. Also manages platform settings.",
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
  "military-talent-specialist": {
    audience: "Military talent practice",
    access: "Military-to-civilian mapping and related talent work. No admin screens.",
  },
  "read-only": {
    audience: "Reviewers",
    access: "Can view records. Cannot change them or see restricted candidate contact details.",
  },
};

export function guideForRole(slug: string) {
  if (slug in ROLE_GUIDE) return ROLE_GUIDE[slug as RoleSlug];
  return {
    audience: "Assigned role",
    access: "Access is granted from PostgreSQL roles, not Clerk metadata.",
  };
}
