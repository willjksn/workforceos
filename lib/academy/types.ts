import type { Permission } from "@/lib/rbac/permissions";
import type { ScoutCommandFamily } from "@/lib/scout/commands";

export const ACADEMY_SECTIONS = [
  "getting-started",
  "operating-model",
  "access-quick-starts",
  "user-manual",
  "service-playbooks",
  "recruiting-hiring",
  "military-talent",
  "workforce-consulting",
  "projects",
  "proposals",
  "contracts",
  "finance",
  "scout",
  "ai-use",
  "security",
  "admin",
  "faqs",
  "release-notes",
] as const;

export type AcademySectionId = (typeof ACADEMY_SECTIONS)[number];

export const ACADEMY_SECTION_LABELS: Record<AcademySectionId, string> = {
  "getting-started": "Getting Started",
  "operating-model": "PierOne Operating Model",
  "access-quick-starts": "Access Quick Starts",
  "user-manual": "User Manual",
  "service-playbooks": "Service Delivery Playbooks",
  "recruiting-hiring": "Recruiting & Hiring",
  "military-talent": "Military Talent",
  "workforce-consulting": "Workforce Consulting",
  projects: "Projects",
  proposals: "Proposals",
  contracts: "Contracts",
  finance: "Finance",
  scout: "Scout",
  "ai-use": "AI Use & Human Review",
  security: "Security & Candidate Privacy",
  admin: "Admin",
  faqs: "FAQs",
  "release-notes": "Release Notes",
};

export const ACADEMY_BASE_PATH = "/app/academy";

export const TRAINING_PROGRESS_STATUSES = ["assigned", "in_progress", "completed"] as const;
export type TrainingProgressStatus = (typeof TRAINING_PROGRESS_STATUSES)[number];

export const TRAINING_DISPLAY_STATES = [
  "required",
  "assigned",
  "in_progress",
  "completed",
  "not_required",
] as const;
export type TrainingDisplayState = (typeof TRAINING_DISPLAY_STATES)[number];

export type AcademyField = {
  name: string;
  notes: string;
};

export type AcademyArticle = {
  slug: string;
  title: string;
  section: AcademySectionId;
  summary: string;
  sources: string[];
  contextualRoutes?: string[];
  isTrainingModule?: boolean;
  requiredIfAny?: Permission[];
  purpose: string;
  whenToUse: string;
  whoUsesIt: string;
  accessRequired: Permission[];
  screenOverview: Array<{ href: string; label: string; note?: string }>;
  fields?: AcademyField[];
  stepByStep: string[];
  scoutCommands: ScoutCommandFamily[];
  approvalRequirements: string;
  relatedSlugs: string[];
  commonMistakes: string[];
  troubleshooting: string[];
};

export function academyArticleHref(slug: string) {
  return `${ACADEMY_BASE_PATH}/${slug}`;
}

export function isTrainingProgressStatus(value: string): value is TrainingProgressStatus {
  return (TRAINING_PROGRESS_STATUSES as readonly string[]).includes(value);
}
