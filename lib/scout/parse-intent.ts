import { z } from "zod";

import { isRegisteredCommand, type ScoutCommandFamily } from "./commands";
import type { ScoutPageContext } from "./page-context";

const SQL_PATTERN =
  /\bselect\b[\s\S]*\bfrom\b|\binsert\s+into\b|\bdelete\s+from\b|\bdrop\s+(table|database|schema|index)\b|\balter\s+table\b|\btruncate\s+table\b|\bcreate\s+table\b|\bgrant\s+\w+\s+on\b|\brevoke\s+\w+\b|\bpg_sleep\s*\(|;\s*--|^\s*--/i;

const UNSAFE_PROMPT_PATTERN =
  /\b(delete\s+all|drop\s+all|ignore\s+(the\s+)?permissions|bypass\s+(rbac|authorization)|show\s+(me\s+)?every\s+candidate\s+email)\b/i;

export const scoutSearchFiltersSchema = z.object({
  skill: z.string().trim().max(120).optional(),
  title: z.string().trim().max(200).optional(),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  availability: z.array(z.string()).optional(),
  openToOpportunities: z.boolean().optional(),
  branch: z.string().trim().max(40).optional(),
  occupationCode: z.string().trim().max(40).optional(),
  windowWithinDays: z.number().int().positive().max(365).optional(),
  hasActiveOpportunity: z.boolean().optional(),
  employerFeedbackOverdue: z.boolean().optional(),
  lastContactedDays: z.number().int().positive().max(365).optional(),
  needsFollowUp: z.boolean().optional(),
  industry: z.string().trim().max(120).optional(),
  idealEmployer: z.string().trim().max(200).optional(),
  installation: z.string().trim().max(200).optional(),
  candidateName: z.string().trim().max(200).optional(),
  ownerScope: z.enum(["me", "all"]).optional(),
});

export const scoutCommandDtoSchema = z.object({
  family: z.enum([
    "SEARCH",
    "SUMMARIZE",
    "DRAFT",
    "CREATE",
    "UPDATE",
    "ASSIGN",
    "ADD_TO_POOL",
    "ADD_TO_JOB",
    "CREATE_TASK",
    "CREATE_FOLLOW_UP",
    "SHOW_RECORD",
    "SHOW_DASHBOARD",
    "FIND_MATCHES",
  ]),
  entity: z.string().trim().max(80).optional(),
  filters: scoutSearchFiltersSchema.optional(),
  poolName: z.string().trim().max(200).optional(),
  candidateIds: z.array(z.string().uuid()).optional(),
  jobId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  skillbridgeProfileId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  draftKind: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(200).optional(),
  preferredLocation: z.string().trim().max(200).optional(),
  ownerUserId: z.string().uuid().optional(),
  followUpAt: z.string().datetime().optional(),
  note: z.string().trim().max(2000).optional(),
  dashboard: z.enum(["skillbridge", "queue", "daily_brief", "command_center"]).optional(),
});

export type ScoutCommandDto = z.infer<typeof scoutCommandDtoSchema>;

export type ScoutParseResult =
  | { ok: true; dto: ScoutCommandDto; summary: string }
  | { ok: false; error: string; code: "sql_rejected" | "unknown_command" | "invalid" };

function regionFromText(text: string) {
  if (/\bnorth carolina\b|\bnc\b/.test(text)) return "NC";
  if (/\bvirginia\b|\bva\b/.test(text)) return "VA";
  if (/\braileigh\b/.test(text)) return "NC";
  return undefined;
}

function cityFromText(text: string) {
  if (/\bcharlotte\b/.test(text)) return "Charlotte";
  if (/\braleigh\b/.test(text)) return "Raleigh";
  if (/\bnorfolk\b/.test(text)) return "Norfolk";
  return undefined;
}

export function parseScoutIntent(prompt: string, pageContext?: ScoutPageContext | null): ScoutParseResult {
  const raw = prompt.trim();
  if (!raw) return { ok: false, error: "Prompt is empty.", code: "invalid" };
  if (SQL_PATTERN.test(raw)) {
    return {
      ok: false,
      error: "Scout cannot execute SQL. Use a registered command.",
      code: "sql_rejected",
    };
  }
  if (UNSAFE_PROMPT_PATTERN.test(raw)) {
    return {
      ok: false,
      error: "Scout cannot ignore permissions or run destructive bulk actions.",
      code: "unknown_command",
    };
  }

  const upper = raw.toUpperCase();
  const explicit = upper.match(
    /\b(SEARCH|SUMMARIZE|DRAFT|CREATE|UPDATE|ASSIGN|ADD_TO_POOL|ADD_TO_JOB|CREATE_TASK|CREATE_FOLLOW_UP|SHOW_RECORD|SHOW_DASHBOARD|FIND_MATCHES|[A-Z][A-Z0-9_]{2,})\b/,
  );
  if (explicit) {
    const token = explicit[1];
    if (token && !isRegisteredCommand(token) && /^[A-Z][A-Z0-9_]+$/.test(token) && token.includes("_")) {
      return {
        ok: false,
        error: `Command ${token} is not in the Scout registry.`,
        code: "unknown_command",
      };
    }
  }

  const text = raw.toLowerCase();
  const filters: z.infer<typeof scoutSearchFiltersSchema> = {};

  const region = regionFromText(text);
  if (region) filters.region = region;
  const city = cityFromText(text);
  if (city) filters.city = city;

  if (/\belectrical\b/.test(text)) {
    filters.skill = "electrical";
    filters.title = "electrical";
  }
  if (/\bplc\b/.test(text)) filters.skill = "plc";
  if (/\bnavy\b/.test(text)) filters.branch = "navy";
  if (/\barmy\b/.test(text)) filters.branch = "army";
  if (/\bair force\b/.test(text)) filters.branch = "air_force";
  if (/\bmarine\b/.test(text)) filters.branch = "marine_corps";
  if (/\bcoast guard\b/.test(text)) filters.branch = "coast_guard";
  if (/\bem\b|electrician'?s mate/.test(text)) filters.occupationCode = "EM";
  if (/\bduke energy\b/.test(text)) filters.idealEmployer = "Duke Energy";
  if (/\benergy and utilities\b|\butilities\b/.test(text)) filters.industry = "energy";
  if (/\bcamp lejeune\b/.test(text)) filters.installation = "Camp Lejeune";

  if (/\bopen to opportunities\b|\bavailable now\b|\bopen to work\b/.test(text)) {
    filters.openToOpportunities = true;
    filters.availability = ["available_now", "passive"];
  }

  const windowMatch = text.match(/next (\d+)\s*days|within (\d+)\s*days|in (\d+)\s*days/);
  if (windowMatch) {
    filters.windowWithinDays = Number(windowMatch[1] ?? windowMatch[2] ?? windowMatch[3]);
  } else if (/\b90 days\b|\bnext 90\b/.test(text) || /\bwindows?\b/.test(text) && /\b90\b/.test(text)) {
    filters.windowWithinDays = 90;
  } else if (/\bsix months\b|\b6 months\b/.test(text)) {
    filters.windowWithinDays = 180;
  }

  if (/\bwithout (an )?active (employer )?opportunit/.test(text) || /\bno opportunit/.test(text)) {
    filters.hasActiveOpportunity = false;
  }
  if (/\bemployer feedback overdue\b|\bwaiting on feedback\b/.test(text)) {
    filters.employerFeedbackOverdue = true;
  }
  if (/\bnot been contacted\b|\bhasn'?t been contacted\b|\boverdue for contact\b/.test(text)) {
    const days = text.match(/(\d+)\s*days/)?.[1];
    filters.lastContactedDays = days ? Number(days) : 14;
  }
  if (
    /\bneeds? (my )?attention\b|\bfollow-?up today\b|\bwho needs follow-?up\b|\btoday'?s priorities\b/.test(text)
  ) {
    filters.needsFollowUp = true;
    filters.ownerScope = "me";
  }

  let family: ScoutCommandFamily = "SEARCH";
  let entity = "candidates";
  let summary = "Search authorized records.";

  if (/\bdraft\b/.test(text)) {
    family = "DRAFT";
    summary = "Draft a message for human review.";
  } else if (/\breject (this |the )?(candidate|application)\b|\breject this person\b/.test(text)) {
    family = "UPDATE";
    entity = "application_reject";
    summary = "Rejecting a candidate requires human confirmation.";
  } else if (/\bschedule (an )?interview\b/.test(text)) {
    family = "CREATE";
    entity = "interview";
    summary = "Schedule an interview (confirmation required).";
  } else if (/\bcreate a talent pool\b|\bcreate a watchlist\b|\bcreate a pool\b/.test(text)) {
    family = "ADD_TO_POOL";
    summary = "Create or populate a talent pool (confirmation required).";
  } else if (/\badd these candidates to this job\b|\badd to (this |the )?job\b/.test(text)) {
    family = "ADD_TO_JOB";
    summary = "Add candidates to a job (confirmation required).";
  } else if (/\bcreate a follow-?up\b|\bmark .* follow-?up\b|\bfollow-?up list\b|\bfollow-?up task\b/.test(text)) {
    family = "CREATE_FOLLOW_UP";
    summary = "Create follow-up work (confirmation required).";
  } else if (/\bcreate a note\b/.test(text)) {
    family = "CREATE";
    entity = "note";
    summary = "Create a note (confirmation required).";
  } else if (/\bupdate\b.*\bpreferred location\b|\bwants?\b.*\binstead of\b/.test(text)) {
    family = "UPDATE";
    entity = "preferred_location";
    summary = "Update a preferred location (confirmation required).";
  } else if (/\bassign\b/.test(text) && /\bowner\b/.test(text)) {
    family = "ASSIGN";
    summary = "Assign an owner (confirmation required).";
  } else if (/\bfind (matching )?(jobs|opportunities)|opportunities for\b|\bmatches for\b/.test(text)) {
    family = "FIND_MATCHES";
    entity = "jobs";
    summary = "Find matching jobs or employer opportunities.";
  } else if (/\bsummarize\b/.test(text)) {
    family = "SUMMARIZE";
    summary = "Summarize the current authorized record.";
  } else if (/\bopen the skillbridge record\b|\bshow the record\b/.test(text)) {
    family = "SHOW_RECORD";
    entity = "skillbridge_profile";
    summary = "Open the current SkillBridge record.";
  } else if (/\bdaily brief\b|\btoday'?s priorities\b|\bwho needs my attention\b/.test(text)) {
    family = "SHOW_DASHBOARD";
    summary = "Show today's operating priorities.";
  } else if (
    /\bapplication|\bwho applied\b|\binterviews tomorrow\b|\bscorecards?\b|\bbackground check\b|\bdrug screen\b|\boffers? expire\b|\bnew hires?\b|\bonboarding\b/.test(
      text,
    )
  ) {
    entity = "applications";
    summary = "Search hiring and application records.";
  } else if (/\bskillbridge\b/.test(text) || filters.windowWithinDays || filters.hasActiveOpportunity === false || filters.employerFeedbackOverdue) {
    entity = "skillbridge";
    summary = "Search SkillBridge operating records.";
  } else if (/\bopen jobs\b|\bjobs that match\b/.test(text)) {
    entity = "jobs";
    summary = "Search jobs.";
  }

  const poolName = raw.match(/called[:\s]+([^\n]+)/i)?.[1]?.trim();
  const dto: ScoutCommandDto = {
    family,
    entity,
    filters: Object.keys(filters).length ? filters : undefined,
    poolName: poolName || (family === "ADD_TO_POOL" ? "Scout pool" : undefined),
    dashboard: family === "SHOW_DASHBOARD" ? "daily_brief" : undefined,
    draftKind: family === "DRAFT"
      ? (/\bfollow-?up\b/.test(text)
        ? "follow_up"
        : /\breject/.test(text)
          ? "rejection"
          : /\binterview/.test(text)
            ? "interview_invitation"
            : /\bonboarding/.test(text)
              ? "onboarding_welcome"
              : /\bresume\b/.test(text)
                ? "resume_request"
                : "custom")
      : undefined,
    candidateId: pageContext?.entityType === "candidate" ? pageContext.entityId ?? undefined : undefined,
    jobId: pageContext?.entityType === "job" ? pageContext.entityId ?? undefined : undefined,
    skillbridgeProfileId:
      pageContext?.entityType === "skillbridge_profile" ? pageContext.entityId ?? undefined : undefined,
    companyId: pageContext?.entityType === "company" ? pageContext.entityId ?? undefined : undefined,
    note: entity === "applications" || family === "DRAFT" ? raw.slice(0, 500) : undefined,
  };

  if (family === "FIND_MATCHES" && !dto.candidateId && pageContext?.entityType === "candidate") {
    dto.candidateId = pageContext.entityId ?? undefined;
  }
  if ((/\bhim\b|\bher\b|\bthis candidate\b|\bcurrent candidate\b|\bfor michael\b/.test(text)) && pageContext?.entityType === "candidate") {
    dto.candidateId = pageContext.entityId ?? undefined;
  }
  if (/\bthis job\b/.test(text) && pageContext?.entityType === "job") {
    dto.jobId = pageContext.entityId ?? undefined;
  }

  const parsed = scoutCommandDtoSchema.safeParse(dto);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid Scout command.", code: "invalid" };
  }
  return { ok: true, dto: parsed.data, summary };
}
