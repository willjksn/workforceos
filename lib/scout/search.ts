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
import { searchHiringForScout, listMissingScorecards, getHiringMetrics } from "../hiring/service";
import { listSkillBridgeCards } from "../skillbridge/service";
import { findSkillBridgeMatches } from "../skillbridge/matching";

const SCOUT_RESULT_LIMIT = 25;

export type ScoutResultCard = {
  type:
    | "candidate"
    | "job"
    | "opportunity"
    | "skillbridge"
    | "record"
    | "application"
    | "inquiry"
    | "company"
    | "contact"
    | "project"
    | "finance"
    | "knowledge";
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
    summary: `Found ${matches.length} employer opportunity matches.`,
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
    return searchJobs(input.organizationId, filters.title ?? filters.skill, filters.city ?? filters.region, filters.skillbridgeEligible === true);
  }

  if (input.dto.entity === "public_content") {
    if (!input.permissions.has("public_content.read")) return { summary: "No public content access.", cards: [] };
    const { listPublicContentItems } = await import("../public-content/service");
    const principalLike = {
      id: input.userId,
      status: "active" as const,
      organizationId: input.organizationId,
      roleSlugs: [],
      permissions: input.permissions,
    };
    let rows = await listPublicContentItems({ principal: principalLike });
    if (filters.availability?.includes("scheduled")) {
      rows = rows.filter((row) => row.status === "scheduled");
    } else {
      rows = rows.filter((row) => row.rendering || row.status === "live");
    }
    const cards = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
      type: "record" as const,
      id: row.id,
      title: row.title,
      href: `/app/public-content/${row.id}`,
      meta: `${row.contentType} · ${row.status} · ${row.placement}`,
      fields: { status: row.status, type: row.contentType, placement: row.placement },
    }));
    return { summary: `${cards.length} public content items.`, cards };
  }

  if (input.dto.entity === "website_inquiries" || input.dto.entity === "website_leads") {
    if (!input.permissions.has("opportunities.read")) return { summary: "No inquiry access.", cards: [] };
    const { listWebsiteInquiries } = await import("../inquiries/service");
    let rows = await listWebsiteInquiries(input.organizationId, filters.title ?? filters.candidateName);
    if (filters.needsFollowUp) {
      rows = rows.filter((row) => row.status === "new" || row.status === "reviewing");
    }
    if (filters.industry) {
      rows = rows.filter((row) => row.serviceInterest.includes("military") || row.serviceInterest === filters.industry);
    }
    const cards = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
      type: "inquiry" as const,
      id: row.id,
      title: `${row.companyName} — ${row.firstName} ${row.lastName}`,
      href: `/app/crm/inquiries/${row.id}`,
      meta: `${row.serviceInterest} · ${row.status}`,
      fields: {
        status: row.status,
        service: row.serviceInterest,
        submitted: row.submittedAt.toISOString(),
      },
    }));
    return { summary: `${cards.length} website inquiries.`, cards };
  }

  if (input.dto.entity === "applications" || input.dto.entity === "hiring" || /\bapplication/.test(input.dto.entity ?? "")) {
    if (!input.permissions.has("applications.read")) return { summary: "No application access.", cards: [] };
    const cards = await searchHiringForScout({
      organizationId: input.organizationId,
      prompt: input.dto.note ?? input.dto.filters?.title ?? "new applications",
      canReadPii: input.canReadPii,
    });
    if (/\bscorecard/.test(JSON.stringify(input.dto).toLowerCase())) {
      const missing = await listMissingScorecards(input.organizationId);
      return {
        summary: `${missing.length} scorecards are outstanding.`,
        cards: missing.map((row) => ({
          type: "application" as const,
          id: row.id,
          title: "Missing scorecard",
          href: `/app/recruiting/applications/${row.applicationId ?? ""}`,
          meta: row.status,
          fields: { status: row.status },
        })),
      };
    }
    const metrics = await getHiringMetrics(input.organizationId);
    return {
      summary: `Found ${cards.length} applications. ${metrics.awaitingReview} awaiting review.`,
      cards,
    };
  }

  if (input.dto.entity === "companies" || input.dto.entity === "company") {
    if (!input.permissions.has("companies.read")) return { summary: "No company access.", cards: [] };
    return searchCompanies(input.organizationId, filters.title ?? filters.candidateName ?? filters.industry);
  }

  if (input.dto.entity === "contacts" || input.dto.entity === "contact") {
    if (!input.permissions.has("contacts.read")) return { summary: "No contact access.", cards: [] };
    return searchContacts(input.organizationId, filters.title ?? filters.candidateName, input.canReadPii);
  }

  if (input.dto.entity === "opportunities" || input.dto.entity === "opportunity") {
    if (!input.permissions.has("opportunities.read")) return { summary: "No opportunity access.", cards: [] };
    return searchOpportunities(input.organizationId, filters.title ?? filters.industry);
  }

  if (input.dto.entity === "projects" || input.dto.entity === "project") {
    if (!input.permissions.has("projects.read")) return { summary: "No project access.", cards: [] };
    return searchProjects(input.organizationId, filters.title);
  }

  if (input.dto.entity === "finance" || input.dto.entity === "invoices") {
    if (!input.permissions.has("finance.read") && !input.permissions.has("invoices.read")) {
      return { summary: "No finance access.", cards: [] };
    }
    return searchFinance(input.organizationId, filters.title);
  }

  if (input.dto.entity === "knowledge" || input.dto.entity === "training") {
    if (!input.permissions.has("knowledge.read") && !input.permissions.has("training_programs.read")) {
      return { summary: "No knowledge or training access.", cards: [] };
    }
    return searchKnowledgeAndTraining(input.organizationId, input.permissions, filters.title ?? filters.skill);
  }

  if (input.dto.entity === "skillbridge" || filters.windowWithinDays || filters.hasActiveOpportunity === false || filters.employerFeedbackOverdue || filters.needsFollowUp) {
    if (!input.permissions.has("skillbridge.read") && !input.permissions.has("military.read")) {
      return { summary: "No Military Talent access.", cards: [] };
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
    .where(and(...conditions))
    .limit(100);

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

  const cards: ScoutResultCard[] = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => {
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

async function searchJobs(organizationId: string, query?: string, location?: string, skillbridgeEligible?: boolean) {
  const db = getDb();
  const rows = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNull(jobs.archivedAt),
        skillbridgeEligible ? or(eq(jobs.skillbridgeEligible, true), eq(jobs.jobContextType, "skillbridge")) : undefined,
        query ? or(ilike(jobs.title, `%${query}%`), ilike(jobs.locationLabel, `%${query}%`)) : undefined,
        location ? or(ilike(jobs.locationLabel, `%${location}%`), ilike(jobs.title, `%${location}%`)) : undefined,
      ),
    )
    .limit(SCOUT_RESULT_LIMIT);
  return {
    summary: skillbridgeEligible
      ? `Found ${rows.length} SkillBridge-eligible employer opportunities.`
      : `Found ${rows.length} jobs.`,
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

async function searchCompanies(organizationId: string, query?: string) {
  const { listCompanies } = await import("../repositories/crm");
  const rows = await listCompanies(organizationId, query);
  const cards: ScoutResultCard[] = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
    type: "company" as const,
    id: row.id,
    title: row.name,
    href: `/app/companies/${row.id}`,
    meta: [row.industry, row.clientStatus, row.relationshipStrength].filter(Boolean).join(" · "),
    fields: { industry: row.industry, status: row.clientStatus },
  }));
  return { summary: `Found ${cards.length} authorized company records.`, cards };
}

async function searchContacts(organizationId: string, query?: string, canReadPii?: boolean) {
  const { listContacts } = await import("../repositories/crm");
  const rows = await listContacts(organizationId, { query });
  const cards: ScoutResultCard[] = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
    type: "contact" as const,
    id: row.contact.id,
    title: row.contact.fullName,
    href: `/app/contacts/${row.contact.id}`,
    meta: [row.contact.title, row.companies[0]?.name].filter(Boolean).join(" · "),
    fields: stripScoutPii(
      {
        title: row.contact.title,
        company: row.companies[0]?.name ?? null,
        email: canReadPii ? row.contact.email : null,
      },
      Boolean(canReadPii),
    ),
  }));
  return { summary: `Found ${cards.length} authorized contact records.`, cards };
}

async function searchOpportunities(organizationId: string, query?: string) {
  const { listOpportunities } = await import("../repositories/crm");
  let rows = await listOpportunities(organizationId);
  if (query) {
    const needle = query.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.opportunity.name.toLowerCase().includes(needle) ||
        (row.companyName ?? "").toLowerCase().includes(needle),
    );
  }
  const cards: ScoutResultCard[] = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
    type: "opportunity" as const,
    id: row.opportunity.id,
    title: row.opportunity.name,
    href: `/app/opportunities/${row.opportunity.id}`,
    meta: `${row.companyName} · ${row.opportunity.stage}`,
    fields: { company: row.companyName, stage: row.opportunity.stage },
  }));
  return { summary: `Found ${cards.length} authorized opportunities.`, cards };
}

async function searchProjects(organizationId: string, query?: string) {
  const { listDeliveryProjects } = await import("../delivery/engine");
  let rows = await listDeliveryProjects(organizationId);
  if (query) {
    const needle = query.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.project.name.toLowerCase().includes(needle) ||
        (row.companyName ?? "").toLowerCase().includes(needle),
    );
  }
  const cards: ScoutResultCard[] = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
    type: "project" as const,
    id: row.project.id,
    title: row.project.name,
    href: `/app/projects/${row.project.id}`,
    meta: [row.companyName, row.serviceName, row.project.status].filter(Boolean).join(" · "),
    fields: { company: row.companyName, status: row.project.status, health: row.project.health },
  }));
  return { summary: `Found ${cards.length} authorized delivery projects.`, cards };
}

async function searchFinance(organizationId: string, query?: string) {
  const { listInvoices } = await import("../finance/engine");
  let rows = await listInvoices(organizationId);
  if (query) {
    const needle = query.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.invoice.invoiceNumber.toLowerCase().includes(needle) ||
        (row.companyName ?? "").toLowerCase().includes(needle),
    );
  }
  const cards: ScoutResultCard[] = rows.slice(0, SCOUT_RESULT_LIMIT).map((row) => ({
    type: "finance" as const,
    id: row.invoice.id,
    title: row.invoice.invoiceNumber,
    href: "/app/finance/invoices",
    meta: [row.companyName, row.invoice.status, row.aging.agingBucket].filter(Boolean).join(" · "),
    fields: { status: row.invoice.status, company: row.companyName },
  }));
  return { summary: `Found ${cards.length} authorized invoices.`, cards };
}

async function searchKnowledgeAndTraining(
  organizationId: string,
  permissions: ReadonlySet<string>,
  query?: string,
) {
  const cards: ScoutResultCard[] = [];
  if (permissions.has("knowledge.read")) {
    const { listKnowledge } = await import("../ai/engine");
    const rows = await listKnowledge(organizationId);
    for (const row of rows.slice(0, SCOUT_RESULT_LIMIT)) {
      if (query && !`${row.title} ${row.knowledgeType}`.toLowerCase().includes(query.toLowerCase())) continue;
      cards.push({
        type: "knowledge",
        id: row.id,
        title: row.title,
        href: "/app/ai-operations/knowledge",
        meta: `${row.knowledgeType} · ${row.status}`,
        fields: { type: row.knowledgeType, status: row.status },
      });
    }
  }
  if (permissions.has("training_programs.read")) {
    const { listTrainingPrograms } = await import("../repositories/workforce");
    const rows = await listTrainingPrograms(organizationId);
    for (const row of rows.slice(0, SCOUT_RESULT_LIMIT)) {
      if (query && !row.name.toLowerCase().includes(query.toLowerCase())) continue;
      cards.push({
        type: "knowledge",
        id: row.id,
        title: row.name,
        href: "/app/workforce",
        meta: "Training program",
        fields: { type: "training_program" },
      });
    }
  }
  return { summary: `${cards.length} authorized knowledge or training records.`, cards };
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
    if (filters.submittedToday) {
      const created = card.profile.createdAt;
      if (!created) return false;
      if (created.toDateString() !== now.toDateString()) return false;
    }
    if (filters.conversionPending && card.profile.candidateStatus !== "conversion_pending") return false;
    if (filters.windowEndingDays) {
      const end = card.profile.skillbridgeWindowEnd;
      if (!end) return false;
      const days = (end.getTime() - now.getTime()) / 86400000;
      if (days < 0 || days > filters.windowEndingDays) return false;
    }
    return true;
  });

  const limited = filtered.slice(0, SCOUT_RESULT_LIMIT);
  return {
    summary: `Found ${limited.length} transitioning service members.`,
    cards: limited.map((card) => ({
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
