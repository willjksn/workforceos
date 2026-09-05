import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateSkills,
  candidates,
  companies,
  jobs,
  skills,
} from "../../db/schema";
import { presentCandidate } from "../privacy/present-candidate";
import type { ScoutCommandDto } from "./parse-intent";
import { stripScoutPii } from "./pii";
import { listSkillBridgeCards } from "../skillbridge/service";
import { findSkillBridgeMatches } from "../skillbridge/matching";

export type ScoutResultCard = {
  type: "candidate" | "job" | "opportunity" | "skillbridge" | "record";
  id: string;
  title: string;
  href: string;
  meta: string;
  fields: Record<string, string | number | null>;
};

export async function executeScoutSearch(input: {
  organizationId: string;
  userId: string;
  dto: ScoutCommandDto;
  canReadPii: boolean;
  permissions: ReadonlySet<string>;
}): Promise<{ summary: string; cards: ScoutResultCard[] }> {
  const filters = input.dto.filters ?? {};
  if (input.dto.family === "FIND_MATCHES" || input.dto.entity === "jobs") {
    if (!input.permissions.has("jobs.read")) return { summary: "No job access.", cards: [] };
    if (input.dto.candidateId || input.dto.skillbridgeProfileId) {
      const matches = await findSkillBridgeMatches({
        organizationId: input.organizationId,
        candidateId: input.dto.candidateId,
        profileId: input.dto.skillbridgeProfileId,
      });
      return {
        summary: `Found ${matches.length} stored job matches.`,
        cards: matches.map((match) => ({
          type: "job" as const,
          id: match.jobId,
          title: match.jobTitle,
          href: match.href,
          meta: `${match.companyName} · ${match.location ?? "location on file"} · ${match.overall}`,
          fields: {
            company: match.companyName,
            location: match.location,
            status: match.status,
            match: match.overall,
          },
        })),
      };
    }
    return searchJobs(input.organizationId, filters.title ?? filters.skill, filters.city ?? filters.region);
  }

  if (input.dto.entity === "skillbridge" || filters.windowWithinDays || filters.hasActiveOpportunity === false || filters.employerFeedbackOverdue || filters.needsFollowUp) {
    if (!input.permissions.has("skillbridge.read") && !input.permissions.has("military.read")) {
      return { summary: "No SkillBridge access.", cards: [] };
    }
    return searchSkillBridge(input);
  }

  if (!input.permissions.has("candidates.read")) return { summary: "No candidate access.", cards: [] };
  return searchCandidates(input);
}

async function searchCandidates(input: {
  organizationId: string;
  dto: ScoutCommandDto;
  canReadPii: boolean;
}) {
  const db = getDb();
  const filters = input.dto.filters ?? {};
  const conditions = [
    eq(candidates.organizationId, input.organizationId),
    isNull(candidates.archivedAt),
    isNull(candidates.privacyDeletedAt),
  ];
  if (filters.region) conditions.push(eq(candidates.region, filters.region));
  if (filters.city) conditions.push(ilike(candidates.city, `%${filters.city}%`));
  if (filters.openToOpportunities) {
    conditions.push(inArray(candidates.availability, ["available_now", "passive"]));
  } else if (filters.availability?.length) {
    conditions.push(inArray(candidates.availability, filters.availability as Array<"available_now" | "passive" | "unknown" | "not_looking" | "do_not_contact">));
  }
  if (filters.title) {
    conditions.push(
      or(ilike(candidates.currentTitle, `%${filters.title}%`), ilike(candidates.fullName, `%${filters.title}%`))!,
    );
  }
  if (filters.candidateName) conditions.push(ilike(candidates.fullName, `%${filters.candidateName}%`));

  let rows = await db
    .select()
    .from(candidates)
    .where(and(...conditions));

  if (filters.skill) {
    const skillMatches = await db
      .select({ candidateId: candidateSkills.candidateId, name: skills.name })
      .from(candidateSkills)
      .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
      .where(ilike(skills.name, `%${filters.skill}%`));
    const ids = new Set(skillMatches.map((row) => row.candidateId));
    rows = rows.filter(
      (row) => ids.has(row.id) || (row.currentTitle ?? "").toLowerCase().includes(filters.skill!.toLowerCase()),
    );
  }

  const cards: ScoutResultCard[] = rows.slice(0, 25).map((row) => {
    const presented = presentCandidate(row, input.canReadPii);
    return {
      type: "candidate",
      id: row.id,
      title: row.fullName,
      href: `/app/talent/${row.id}`,
      meta: [row.currentTitle, [row.city, row.region].filter(Boolean).join(", "), row.availability]
        .filter(Boolean)
        .join(" · "),
      fields: stripScoutPii(
        {
          title: row.currentTitle,
          location: [row.city, row.region].filter(Boolean).join(", "),
          availability: row.availability,
          email: presented.email,
          phone: presented.phone,
        },
        input.canReadPii,
      ),
    };
  });
  return { summary: `Found ${cards.length} authorized candidate records.`, cards };
}

async function searchJobs(organizationId: string, query?: string, location?: string) {
  const db = getDb();
  const rows = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNull(jobs.archivedAt),
        query ? or(ilike(jobs.title, `%${query}%`), ilike(jobs.locationLabel, `%${query}%`)) : undefined,
        location ? or(ilike(jobs.locationLabel, `%${location}%`), ilike(jobs.title, `%${location}%`)) : undefined,
      ),
    );
  return {
    summary: `Found ${rows.length} jobs.`,
    cards: rows.map(({ job, company }) => ({
      type: "job" as const,
      id: job.id,
      title: job.title,
      href: `/app/jobs/${job.id}`,
      meta: `${company?.name ?? "Unassigned"} · ${job.locationLabel ?? "location on file"} · ${job.status}`,
      fields: { company: company?.name ?? null, location: job.locationLabel, status: job.status },
    })),
  };
}

async function searchSkillBridge(input: {
  organizationId: string;
  userId: string;
  dto: ScoutCommandDto;
  canReadPii: boolean;
}) {
  const filters = input.dto.filters ?? {};
  const cards = await listSkillBridgeCards({
    organizationId: input.organizationId,
    ownerUserId: filters.ownerScope === "me" ? input.userId : null,
    canReadPii: input.canReadPii,
  });
  const now = new Date();
  const filtered = cards.filter((card) => {
    if (filters.branch && card.profile.branch !== filters.branch) return false;
    if (filters.occupationCode) {
      const code = (card.occupation?.code ?? card.profile.mosRateAfscDisplay ?? "").toUpperCase();
      if (!code.includes(filters.occupationCode.toUpperCase())) return false;
    }
    if (filters.city) {
      const hay = `${card.profile.preferredLocationPrimary ?? ""} ${card.preferredLocations.map((row) => `${row.city} ${row.locationLabel}`).join(" ")}`.toLowerCase();
      if (!hay.includes(filters.city.toLowerCase())) return false;
    }
    if (filters.region) {
      const hay = `${card.candidate.region ?? ""} ${card.preferredLocations.map((row) => row.region).join(" ")}`.toLowerCase();
      if (!hay.includes(filters.region.toLowerCase())) return false;
    }
    if (filters.windowWithinDays) {
      if (card.windowDays == null || card.windowDays < 0 || card.windowDays > filters.windowWithinDays) return false;
    }
    if (filters.hasActiveOpportunity === false && card.hasActiveOpportunity) return false;
    if (filters.employerFeedbackOverdue && !card.employerOverdue) return false;
    if (filters.needsFollowUp && !card.overdueFollowUp) return false;
    if (filters.lastContactedDays) {
      if (card.profile.lastContactedAt) {
        const days = (now.getTime() - card.profile.lastContactedAt.getTime()) / 86400000;
        if (days < filters.lastContactedDays) return false;
      }
    }
    if (filters.idealEmployer) {
      const hay = `${card.profile.idealEmployer ?? ""} ${card.profile.idealIndustry ?? ""}`.toLowerCase();
      if (!hay.includes(filters.idealEmployer.toLowerCase())) return false;
    }
    if (filters.industry) {
      const hay = `${card.profile.idealIndustry ?? ""} ${card.profile.idealEmployer ?? ""}`.toLowerCase();
      if (!hay.includes(filters.industry.toLowerCase())) return false;
    }
    if (filters.installation) {
      const hay = `${card.installation?.name ?? ""} ${card.profile.currentDutyLocation ?? ""}`.toLowerCase();
      if (!hay.includes(filters.installation.toLowerCase())) return false;
    }
    if (filters.skill || filters.title) {
      const hay = `${card.candidate.currentTitle ?? ""} ${card.targetRoles.map((row) => row.roleTitle).join(" ")}`.toLowerCase();
      const needle = (filters.skill ?? filters.title ?? "").toLowerCase();
      if (needle && !hay.includes(needle) && needle !== "electrical") return false;
      if (needle === "electrical" && !/electric|electrical|em|maintenance/.test(hay)) {
        // still allow MOS EM
        if ((card.occupation?.code ?? "") !== "EM") return false;
      }
    }
    return true;
  });

  return {
    summary: `Found ${filtered.length} SkillBridge records.`,
    cards: filtered.map((card) => ({
      type: "skillbridge" as const,
      id: card.profile.id,
      title: card.candidate.fullName,
      href: `/app/military/skillbridge/${card.profile.id}`,
      meta: [
        card.occupation ? `${card.occupation.branch} ${card.occupation.code}` : card.profile.branch,
        card.profile.preferredLocationPrimary,
        card.currentOpportunity ? `${card.currentOpportunity.companyName} · ${card.currentOpportunity.stage}` : "no active opportunity",
      ]
        .filter(Boolean)
        .join(" · "),
      fields: stripScoutPii(
        {
          branch: card.profile.branch,
          mos: card.occupation?.code ?? card.profile.mosRateAfscDisplay,
          window: card.profile.skillbridgeWindowStart?.toISOString() ?? null,
          location: card.profile.preferredLocationPrimary,
          stage: card.currentOpportunity?.stage ?? null,
          lastContact: card.profile.lastContactedAt?.toISOString() ?? null,
          email: card.candidate.email,
        },
        input.canReadPii,
      ),
    })),
  };
}
