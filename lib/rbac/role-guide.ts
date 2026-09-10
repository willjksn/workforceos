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
  "crm-business-development": "CRM & Business Development",
  "talent-network": "Talent Network",
  recruiting: "Recruiting",
  "military-talent": "Military Talent",
  "workforce-consulting": "Workforce Consulting",
  projects: "Projects",
  proposals: "Proposals",
  contracts: "Contracts",
  finance: "Finance",
  "hiring-onboarding": "Hiring & Onboarding",
  "reports-analytics": "Reports & Analytics",
  scout: "Scout",
  "ai-review": "AI Review",
  "ai-administration": "AI Administration",
  "knowledge-training": "Knowledge & Training",
  "system-administration": "System Administration",
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
    access:
      "Transition Talent Profiles, employer/host-company opportunities, SkillBridge-eligible pathway work, and military-to-civilian mapping. No admin screens. SkillBridge is a pathway type, not a PierOne-owned program.",
  },
  "read-only": {
    audience: "Reviewers",
    access: "Can view records. Cannot change them or see restricted candidate contact details.",
  },
  "crm-business-development": {
    audience: "Module access",
    access: "Companies, contacts, opportunities, and discovery. Includes commercial pipeline ownership.",
  },
  "talent-network": {
    audience: "Module access",
    access: "Talent Network candidates, including restricted PII when this bundle is assigned.",
  },
  recruiting: {
    audience: "Module access",
    access: "Jobs, submissions, interviews, offers, and placements. Does not include opportunities.read.",
  },
  "military-talent": {
    audience: "Module access",
    access: "Military Talent, Transition Talent Profiles, and SkillBridge pathway operations.",
  },
  "workforce-consulting": {
    audience: "Module access",
    access: "Workforce assessments, forecasts, pipelines, and related planning records.",
  },
  projects: {
    audience: "Module access",
    access: "Delivery projects and deliverables.",
  },
  proposals: {
    audience: "Module access",
    access: "Proposals, solutions, and pricing approval.",
  },
  contracts: {
    audience: "Module access",
    access: "Contracts and legal packages.",
  },
  finance: {
    audience: "Module access",
    access: "Operating finance: invoices, payments, AR triggers. Not a general ledger.",
  },
  "hiring-onboarding": {
    audience: "Module access",
    access: "Applications, screening, offers send, hire onboarding, and employee records.",
  },
  "reports-analytics": {
    audience: "Module access",
    access: "Reports, alerts, and data quality. Does not include PII export.",
  },
  scout: {
    audience: "Module access",
    access: "Scout use, search, draft, and internal actions. Not external send and not AI cost admin.",
  },
  "ai-review": {
    audience: "Module access",
    access: "Review Queue. Humans approve material AI. Not costs, prompts, or providers.",
  },
  "ai-administration": {
    audience: "Module access",
    access: "AI costs, prompts, providers, and automations. Administrators only.",
  },
  "knowledge-training": {
    audience: "Module access",
    access: "Approved knowledge sources used by Scout and Academy citations.",
  },
  "system-administration": {
    audience: "Module access",
    access: "People, access assignment, integrations, public content, and privacy deletion.",
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
