import { and, eq, isNull, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidates,
  companies,
  contacts,
  externalRecords,
  occupationDataImports,
  opportunities,
  projects,
  workforceAssessments,
} from "../../db/schema";
import { CLOSED_OPPORTUNITY_STAGES } from "../crm/stages";

export type DataQualityFlag = {
  code: string;
  title: string;
  count: number;
  href: string;
  note: string;
};

const STALE_MS = 90 * 24 * 60 * 60 * 1000;
const MAPPING_STALE_MS = 180 * 24 * 60 * 60 * 1000;

export async function evaluateDataQuality(organizationId: string): Promise<DataQualityFlag[]> {
  const db = getDb();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_MS);
  const mappingStaleBefore = new Date(now.getTime() - MAPPING_STALE_MS);

  const companyRows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.organizationId, organizationId), isNull(companies.archivedAt)));
  const missingCompanyFields = companyRows.filter(
    (row) => !row.industry || !row.website || row.employeeCount == null,
  ).length;

  const contactRows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.organizationId, organizationId), isNull(contacts.archivedAt)));
  const staleContacts = contactRows.filter(
    (row) => !row.lastContactedAt || row.lastContactedAt < staleBefore,
  ).length;

  const opportunityRows = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.organizationId, organizationId),
        isNull(opportunities.archivedAt),
      ),
    );
  const staleOpportunities = opportunityRows.filter(
    (row) =>
      !(CLOSED_OPPORTUNITY_STAGES as readonly string[]).includes(row.stage) &&
      row.updatedAt < staleBefore,
  ).length;

  const candidateRows = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        isNull(candidates.privacyDeletedAt),
      ),
    );
  const incompleteProfiles = candidateRows.filter(
    (row) => !row.currentTitle || !row.email || !row.lastProfileReviewAt,
  ).length;
  const missingConsent = candidateRows.filter((row) => row.consentStatus === "unknown").length;

  const imports = await db.select().from(occupationDataImports);
  const outdatedMapping = imports.filter((row) => row.createdAt < mappingStaleBefore).length + (imports.length === 0 ? 1 : 0);

  const assessments = await db
    .select()
    .from(workforceAssessments)
    .where(and(eq(workforceAssessments.organizationId, organizationId), isNull(workforceAssessments.archivedAt)));
  const staleAssumptions = assessments.filter(
    (row) => ["draft", "data_collection", "analysis"].includes(row.status) && row.updatedAt < staleBefore,
  ).length;

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId));
  const incompleteProjects = projectRows.filter((row) => !row.companyId || !row.ownerUserId || !row.startDate).length;

  const mappingIssues = await db
    .select()
    .from(externalRecords)
    .where(and(eq(externalRecords.organizationId, organizationId), or(isNull(externalRecords.externalId), eq(externalRecords.externalId, ""))));

  return [
    {
      code: "missing_company_fields",
      title: "Missing company fields",
      count: missingCompanyFields,
      href: "/app/companies",
      note: "Industry, website, or employee count is blank. Completeness only.",
    },
    {
      code: "stale_contacts",
      title: "Stale contacts",
      count: staleContacts,
      href: "/app/contacts",
      note: "No contact in 90 days. This is freshness, not relationship quality.",
    },
    {
      code: "stale_opportunities",
      title: "Stale opportunities",
      count: staleOpportunities,
      href: "/app/opportunities",
      note: "Open opportunities with no update in 90 days.",
    },
    {
      code: "candidate_profile_completeness",
      title: "Candidate profile completeness",
      count: incompleteProfiles,
      href: "/app/talent",
      note: "Missing title, email, or profile review date. Not a performance score.",
    },
    {
      code: "missing_consent",
      title: "Missing consent",
      count: missingConsent,
      href: "/app/talent",
      note: "Consent status is unknown.",
    },
    {
      code: "outdated_military_mapping_source",
      title: "Outdated military mapping source",
      count: outdatedMapping,
      href: "/app/military/occupations",
      note: "No recent occupation import, or last import is older than 180 days.",
    },
    {
      code: "stale_workforce_assumptions",
      title: "Stale workforce assumptions",
      count: staleAssumptions,
      href: "/app/workforce/assessments",
      note: "In-progress assessments not updated in 90 days.",
    },
    {
      code: "incomplete_project_records",
      title: "Incomplete project records",
      count: incompleteProjects,
      href: "/app/projects",
      note: "Missing client, owner, or start date.",
    },
    {
      code: "integration_mapping_issues",
      title: "Integration mapping issues",
      count: mappingIssues.length,
      href: "/app/integrations",
      note: "External records missing an external ID.",
    },
  ];
}
