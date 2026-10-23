import { can, type Permission, type Principal } from "@/lib/rbac/permissions";

import { careerSourceHonesty } from "./source-health";

export const COMMAND_CENTER_SECTIONS = [
  "needsAttention",
  "talent",
  "demand",
  "pipeline",
  "workforce",
  "system",
] as const;

export type CommandCenterSectionId = (typeof COMMAND_CENTER_SECTIONS)[number];

export type CommandCenterItem = {
  type: string;
  title: string;
  detail: string;
  count: number | null;
  href: string;
};

export type CommandCenterSection = {
  id: CommandCenterSectionId;
  title: string;
  status: "ready" | "empty" | "error";
  emptyLabel: string;
  items: CommandCenterItem[];
  error?: string;
};

export type OperationalCommandCenter = {
  generatedAt: string;
  sections: CommandCenterSection[];
};

export type EngagementFact = {
  id: string;
  status: string;
  buckets: string[];
  agingDays: number;
  waitingOn?: string | null;
  candidateName?: string | null;
};

export type WorkforceRoleFact = {
  id: string;
  title: string;
  health: string;
  quantityGap: number;
  knownSupply: number;
  demandQuantity: number;
  activePipeline: number;
};

export type ReviewFact = {
  militaryMappings: number;
  candidateCapabilities: number;
  jobRequirements: number;
};

export type TalentFact = {
  newMembers: number;
  profilesNeedingInformation: number;
  waitingBeyondDays: number | null;
  withoutWorkflow: number;
};

export type DemandFact = {
  newPublicJobs: number;
  changedPublicJobs: number;
  requirementReview: number;
  openWithoutStrongMatch: number;
  staleMatches: number;
};

export type SystemFact = {
  status: string;
  name: string;
  href: string;
  lastSuccessfulSyncAt: Date | string | null;
};

type Loaded<T> = { ok: true; value: T } | { ok: false; error: string };

export type CommandCenterFacts = {
  now: Date;
  engagements: Loaded<EngagementFact[]> | null;
  talent: Loaded<TalentFact> | null;
  demand: Loaded<DemandFact> | null;
  workforce: Loaded<WorkforceRoleFact[]> | null;
  reviews: Loaded<ReviewFact> | null;
  system: Loaded<SystemFact[]> | null;
};

const SECTION_TITLES: Record<CommandCenterSectionId, string> = {
  needsAttention: "Needs attention",
  talent: "Talent",
  demand: "Demand",
  pipeline: "Pipeline",
  workforce: "Workforce",
  system: "System",
};

const EMPTY_LABELS: Record<CommandCenterSectionId, string> = {
  needsAttention: "No items need attention.",
  talent: "No talent items in this window.",
  demand: "No demand items in this window.",
  pipeline: "No active pipeline items.",
  workforce: "No workforce gaps in the current plans.",
  system: "No configuration items need attention.",
};

function has(principal: Principal, permission: Permission) {
  return can(principal, permission);
}

/**
 * Section order follows effective permissions.
 * Job title text is not an input.
 */
export function commandCenterSectionOrder(principal: Principal): CommandCenterSectionId[] {
  const owner =
    has(principal, "workforce.write")
    && has(principal, "candidates.write")
    && has(principal, "opportunities.read");
  if (owner) {
    return ["needsAttention", "workforce", "talent", "demand", "pipeline", "system"];
  }
  if (has(principal, "military.review") && !has(principal, "workforce.write")) {
    return ["needsAttention", "talent", "pipeline", "demand", "workforce", "system"];
  }
  if (has(principal, "workforce.read") && !has(principal, "candidates.write")) {
    return ["workforce", "needsAttention", "demand", "pipeline", "talent", "system"];
  }
  if (has(principal, "candidates.read") && has(principal, "jobs.read")) {
    return ["needsAttention", "talent", "demand", "pipeline", "workforce", "system"];
  }
  return ["needsAttention", "talent", "demand", "pipeline", "workforce", "system"];
}

function sectionVisible(principal: Principal, id: CommandCenterSectionId) {
  if (id === "needsAttention") {
    return has(principal, "jobs.read") || has(principal, "candidates.read") || has(principal, "military.read");
  }
  if (id === "talent") return has(principal, "candidates.read") || has(principal, "military.read");
  if (id === "demand" || id === "pipeline") return has(principal, "jobs.read");
  if (id === "workforce") return has(principal, "workforce.read");
  if (id === "system") return has(principal, "jobs.read") || has(principal, "integrations.read");
  return false;
}

function ready(id: CommandCenterSectionId, items: CommandCenterItem[]): CommandCenterSection {
  return {
    id,
    title: SECTION_TITLES[id],
    status: items.length ? "ready" : "empty",
    emptyLabel: EMPTY_LABELS[id],
    items,
  };
}

function failed(id: CommandCenterSectionId, error: string): CommandCenterSection {
  return {
    id,
    title: SECTION_TITLES[id],
    status: "error",
    emptyLabel: EMPTY_LABELS[id],
    items: [],
    error,
  };
}

function item(type: string, count: number, title: string, detail: string, href: string): CommandCenterItem | null {
  if (count <= 0) return null;
  return { type, title, detail, count, href };
}

export function composeOperationalBoard(principal: Principal, facts: CommandCenterFacts): OperationalCommandCenter {
  const names = has(principal, "candidates.read");
  const built = new Map<CommandCenterSectionId, CommandCenterSection>();

  if (sectionVisible(principal, "needsAttention")) {
    const items: CommandCenterItem[] = [];
    let error: string | null = null;
    if (has(principal, "jobs.read")) {
      if (facts.engagements?.ok) {
        const rows = facts.engagements.value;
        const overdue = rows.filter((row) => row.buckets.includes("overdue")).length;
        const candidateResponse = rows.filter((row) => row.buckets.includes("candidate_response_needed")).length;
        const referrals = rows.filter((row) => row.buckets.includes("referral_needs_routing")).length;
        const noFit = rows.filter((row) => row.buckets.includes("no_fit_needs_decision")).length;
        const interviews = rows.filter((row) => row.buckets.includes("interview_next")).length;
        push(items, item("overdue_follow_ups", overdue, "overdue employer follow-ups", "M6 follow-up time is before today.", "/app/jobs/engagements?bucket=overdue"));
        push(items, item("candidate_response", candidateResponse, "candidates need a response", "Waiting on the candidate in an open engagement.", "/app/jobs/engagements?bucket=candidate_response_needed"));
        push(items, item("referrals", referrals, "referrals need routing", "Referred engagements still need a next route.", "/app/jobs/engagements?bucket=referral_needs_routing"));
        push(items, item("no_fit", noFit, "No Fit engagements need another path", "No Fit is an outcome, not a closed record, until someone chooses the next action.", "/app/jobs/engagements?bucket=no_fit_needs_decision"));
        push(items, item("interviews", interviews, "interviews need a next step", "Interview requested and not yet scheduled.", "/app/jobs/engagements?bucket=interview_next"));
      } else if (facts.engagements && !facts.engagements.ok) {
        error = facts.engagements.error;
      }
    }
    if (facts.reviews?.ok) {
      if (has(principal, "military.read")) {
        push(items, item("military_mappings", facts.reviews.value.militaryMappings, "military mappings need review", "Pending occupation mappings. Approving one does not copy it onto every person.", "/app/military/review"));
      }
      if (has(principal, "candidates.read") || has(principal, "military.review")) {
        push(items, item("candidate_capabilities", facts.reviews.value.candidateCapabilities, "candidate capabilities need review", "Person-specific drafts stay pending until a reviewer approves them.", "/app/military/review#candidate-capabilities"));
      }
      if (has(principal, "jobs.read")) {
        push(items, item("job_requirements", facts.reviews.value.jobRequirements, "job requirements need review", "Pending requirement drafts are not employer-facing until reviewed.", "/app/jobs?requirements=review"));
      }
    } else if (facts.reviews && !facts.reviews.ok && !error) {
      error = facts.reviews.error;
    }
    if (has(principal, "jobs.read") && facts.demand?.ok) {
      push(items, item("stale_matches", facts.demand.value.staleMatches, "stale matches", "Stored M5 results whose inputs changed after the last calculation.", "/app/jobs?match=stale"));
    }
    const attention = ready("needsAttention", items);
    if (error && items.length === 0) built.set("needsAttention", failed("needsAttention", error));
    else built.set("needsAttention", error ? { ...attention, error } : attention);
  }

  if (sectionVisible(principal, "talent")) {
    if (!facts.talent) {
      built.set("talent", ready("talent", []));
    } else if (!facts.talent.ok) {
      built.set("talent", failed("talent", facts.talent.error));
    } else {
      const talent = facts.talent.value;
      const items: CommandCenterItem[] = [];
      if (has(principal, "candidates.read")) {
        push(items, item("new_members", talent.newMembers, "new Talent Network members", "Created in the last 7 days. One person, one candidate record.", "/app/talent?joined=week"));
        if (talent.waitingBeyondDays != null) {
          push(items, item("waiting", talent.waitingBeyondDays, "people waiting more than 5 days", "Aging uses the engagement last-activity time, not row order.", "/app/jobs/engagements?waiting=5"));
        }
        push(items, item("without_workflow", talent.withoutWorkflow, "transitioning candidates without an active opportunity workflow", "A Transition Talent Profile with no open engagement. This is not a second person.", "/app/military/candidates?workflow=none"));
      }
      if (has(principal, "military.read")) {
        push(items, item("profiles_incomplete", talent.profilesNeedingInformation, "Transition Profiles need information", "Missing separation or end-of-service timing and a preferred location.", "/app/military/candidates?profile=incomplete"));
      }
      if (!names) {
        for (const entry of items) {
          entry.detail = `${entry.detail} Counts only. Candidate names stay behind candidates.read.`;
        }
      }
      built.set("talent", ready("talent", items));
    }
  }

  if (sectionVisible(principal, "demand")) {
    if (!facts.demand) {
      built.set("demand", ready("demand", []));
    } else if (!facts.demand.ok) {
      built.set("demand", failed("demand", facts.demand.error));
    } else {
      const demand = facts.demand.value;
      const items: CommandCenterItem[] = [];
      push(items, item("new_public", demand.newPublicJobs, "new monitored public jobs", "Public opportunity. Discovery is not an employer relationship.", "/app/jobs?context=monitored_public&window=week"));
      push(items, item("changed_public", demand.changedPublicJobs, "materially changed public jobs", "Updated in the last 7 days after the original discovery. Still a public opportunity.", "/app/jobs?context=monitored_public&changed=week"));
      push(items, item("requirements", demand.requirementReview, "jobs need requirement review", "Pending job requirements or skills.", "/app/jobs?requirements=review"));
      push(items, item("no_strong", demand.openWithoutStrongMatch, "open jobs without a current strong match", "Current openings whose stored matches are not Strong.", "/app/jobs?matches=none"));
      built.set("demand", ready("demand", items));
    }
  }

  if (sectionVisible(principal, "pipeline")) {
    if (!facts.engagements) {
      built.set("pipeline", ready("pipeline", []));
    } else if (!facts.engagements.ok) {
      built.set("pipeline", failed("pipeline", facts.engagements.error));
    } else {
      const rows = facts.engagements.value;
      const items: CommandCenterItem[] = [];
      const started = rows.filter((row) => ["ready_for_review", "ready_for_outreach", "routed", "contacted"].includes(row.status)).length;
      const reviewing = rows.filter((row) => row.status === "reviewing" || row.buckets.includes("employer_responded")).length;
      const interviews = rows.filter((row) => row.status === "interview").length;
      const noFit = rows.filter((row) => row.status === "no_fit").length;
      push(items, item("started", started, "engagements started", "Human-started routes that are not yet in interview.", "/app/jobs/engagements?status=started"));
      push(items, item("reviewing", reviewing, "employer reviewing", "Reviewing, or the employer has responded.", "/app/jobs/engagements?view=employer_review"));
      push(items, item("interviews", interviews, "interviews", "Engagement status is interview.", "/app/jobs/engagements?status=interview"));
      push(items, item("no_fit_pipeline", noFit, "No Fit needing another path", "Stored No Fit outcome on an open engagement.", "/app/jobs/engagements?bucket=no_fit_needs_decision"));
      built.set("pipeline", ready("pipeline", items));
    }
  }

  if (sectionVisible(principal, "workforce")) {
    if (!facts.workforce) {
      built.set("workforce", ready("workforce", []));
    } else if (!facts.workforce.ok) {
      built.set("workforce", failed("workforce", facts.workforce.error));
    } else {
      const roles = facts.workforce.value;
      const critical = roles.filter((role) => role.health === "critical");
      const gap = roles.filter((role) => role.health === "gap" || role.health === "critical");
      const largest = [...roles].sort((left, right) => right.quantityGap - left.quantityGap).filter((role) => role.quantityGap > 0);
      const weak = roles.filter((role) => role.demandQuantity > 0 && role.activePipeline === 0 && role.quantityGap > 0);
      const items: CommandCenterItem[] = [];
      push(items, item(
        "critical_roles",
        critical.length,
        "critical workforce roles",
        roleSummary(critical),
        "/app/workforce?health=critical",
      ));
      push(items, item(
        "gap_roles",
        gap.length,
        "gap roles",
        "Health is gap or critical from the M7 read model. Known supply is stored people.",
        "/app/workforce?health=gap",
      ));
      push(items, item(
        "largest_gaps",
        largest.length,
        "roles with a quantity gap",
        largest.slice(0, 3).map((role) => `${role.title} gap ${role.quantityGap}`).join("; ") || "No quantity gap.",
        largest[0] ? `/app/workforce/roles/${largest[0].id}` : "/app/workforce",
      ));
      push(items, item(
        "weak_pipeline",
        weak.length,
        "roles with demand and no active pipeline",
        "Active pipeline is stored engagements, not a forecast.",
        "/app/workforce?health=critical",
      ));
      built.set("workforce", ready("workforce", items));
    }
  }

  if (sectionVisible(principal, "system")) {
    if (!facts.system) {
      built.set("system", ready("system", []));
    } else if (!facts.system.ok) {
      built.set("system", failed("system", facts.system.error));
    } else {
      const items = facts.system.value.flatMap((source) => {
        const honesty = careerSourceHonesty(source.status, source.lastSuccessfulSyncAt);
        if (honesty === "LIVE") return [];
        const entry: CommandCenterItem = {
          type: `source-${source.name}`,
          title: source.name,
          detail: `${honesty}. Career source health is ${source.status}.`,
          count: null,
          href: source.href,
        };
        return [entry];
      }).slice(0, 8);
      built.set("system", ready("system", items));
    }
  }

  const sections = commandCenterSectionOrder(principal)
    .filter((id) => built.has(id))
    .map((id) => built.get(id)!);

  return { generatedAt: facts.now.toISOString(), sections };
}

function push(items: CommandCenterItem[], entry: CommandCenterItem | null) {
  if (entry) items.push(entry);
}

function roleSummary(roles: WorkforceRoleFact[]) {
  if (!roles.length) return "No critical roles.";
  return `Derived WorkforceOS calculation. ${roles.slice(0, 3).map((role) => role.title).join(", ")}`;
}
