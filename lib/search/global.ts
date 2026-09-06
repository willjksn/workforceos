import { presentCandidate } from "../privacy/present-candidate";
import { can, type Principal } from "../rbac/permissions";
import { listCompanies, listContacts } from "../repositories/crm";
import { listJobs } from "../repositories/recruiting";
import { searchActiveCandidates } from "../repositories/talent";
import { sanitizeSearchQuery } from "../validation/forms";

export type GlobalSearchHit = {
  type: "company" | "contact" | "candidate" | "job";
  id: string;
  title: string;
  meta: string;
  href: string;
};

export function normalizeGlobalSearchQuery(raw: string) {
  const query = sanitizeSearchQuery(raw);
  return query.length >= 2 ? query : null;
}

export async function searchWorkforceOs(principal: Principal, rawQuery: string): Promise<GlobalSearchHit[]> {
  const query = normalizeGlobalSearchQuery(rawQuery);
  if (!query) return [];

  const hits: GlobalSearchHit[] = [];
  const perType = 5;

  if (can(principal, "companies.read")) {
    const companies = await listCompanies(principal.organizationId, query);
    for (const company of companies.slice(0, perType)) {
      hits.push({
        type: "company",
        id: company.id,
        title: company.name,
        meta: [company.industry, company.clientStatus.replaceAll("_", " ")].filter(Boolean).join(" · ") || "Company",
        href: `/app/companies/${company.id}`,
      });
    }
  }

  if (can(principal, "contacts.read")) {
    const contacts = await listContacts(principal.organizationId, { query });
    for (const row of contacts.slice(0, perType)) {
      hits.push({
        type: "contact",
        id: row.contact.id,
        title: row.contact.fullName,
        meta: [row.contact.title, row.companies[0]?.name].filter(Boolean).join(" · ") || "Contact",
        href: `/app/contacts/${row.contact.id}`,
      });
    }
  }

  if (can(principal, "candidates.read")) {
    const canReadPii = can(principal, "candidate_pii.read");
    const candidates = await searchActiveCandidates(principal.organizationId, query);
    for (const candidate of candidates.slice(0, perType)) {
      const presented = presentCandidate(candidate, canReadPii);
      hits.push({
        type: "candidate",
        id: candidate.id,
        title: presented.fullName,
        meta: presented.currentTitle ?? "Talent Network",
        href: `/app/talent/${candidate.id}`,
      });
    }
  }

  if (can(principal, "jobs.read")) {
    const jobs = await listJobs(principal.organizationId, query);
    for (const row of jobs.slice(0, perType)) {
      hits.push({
        type: "job",
        id: row.job.id,
        title: row.job.title,
        meta: [row.companyName, row.job.status.replaceAll("_", " ")].filter(Boolean).join(" · ") || "Job",
        href: `/app/jobs/${row.job.id}`,
      });
    }
  }

  return hits;
}
