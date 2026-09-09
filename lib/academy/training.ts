import { can, type Permission, type Principal } from "@/lib/rbac/permissions";

import { ACADEMY_ARTICLES, getAcademyArticle } from "./catalog";
import type { TrainingDisplayState, TrainingProgressStatus } from "./types";

/**
 * Required vs Not Required is computed from effective permissions, never from
 * organizational title or display job title (DEC-AUTH-002).
 *
 * Area modules use distinctive write/operate permissions so a Recruiter who can
 * only peek at delivery (`projects.read`) is not assigned Projects training.
 * AI-cost admin is `agents.manage` only — recruiters do not receive it.
 */
export const TRAINING_REQUIREMENT_MAP: Record<string, Permission[] | "always"> = {
  "getting-started": "always",
  "operating-model": "always",
  "access-quick-start": "always",
  "security-candidate-privacy": "always",
  scout: ["scout.use"],
  "recruiting-hiring": ["jobs.write", "applications.read", "candidates.write"],
  "military-talent": ["military.read", "skillbridge.read"],
  "workforce-consulting": ["workforce.write", "workforce.analyze"],
  projects: ["projects.write"],
  proposals: ["proposals.write"],
  contracts: ["contracts.write"],
  finance: ["finance.read", "invoices.read"],
  admin: ["admin.users", "admin.roles"],
  "ai-use-human-review": ["scout.draft", "agents.read"],
  "ai-cost-admin": ["agents.manage"],
};

export function trainingModuleSlugs() {
  return Object.keys(TRAINING_REQUIREMENT_MAP);
}

export function isTrainingModuleSlug(slug: string) {
  return slug in TRAINING_REQUIREMENT_MAP;
}

export function isTrainingRequired(principal: Principal, moduleSlug: string) {
  const rule = TRAINING_REQUIREMENT_MAP[moduleSlug];
  if (!rule) return false;
  if (rule === "always") return true;
  return rule.some((permission) => can(principal, permission));
}

export function requiredTrainingSlugs(principal: Principal) {
  return trainingModuleSlugs().filter((slug) => isTrainingRequired(principal, slug));
}

export function trainingDisplayState(input: {
  principal: Principal;
  moduleSlug: string;
  persisted?: TrainingProgressStatus | null;
}): TrainingDisplayState {
  const required = isTrainingRequired(input.principal, input.moduleSlug);
  if (input.persisted === "completed") return "completed";
  if (!required) return "not_required";
  if (input.persisted === "in_progress") return "in_progress";
  if (input.persisted === "assigned") return "assigned";
  return "required";
}

export function trainingModulesForPrincipal(principal: Principal) {
  return trainingModuleSlugs().map((slug) => {
    const article = getAcademyArticle(slug);
    return {
      slug,
      title: article?.title ?? slug,
      required: isTrainingRequired(principal, slug),
    };
  });
}

export function academyTrainingArticles() {
  return ACADEMY_ARTICLES.filter((article) => article.isTrainingModule);
}
