import "./load-env";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { companies, contacts, opportunities } from "../db/schema";
import { COMPANY_ID, INTERNAL_ORG_ID } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { getCommandCenterSnapshot } from "../lib/repositories/command-center";
import { getCompanyGraph } from "../lib/repositories/crm";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — Command Center uses stored company and talent counts");
  const snapshot = await getCommandCenterSnapshot(INTERNAL_ORG_ID);
  assert(snapshot.talent.candidateCount >= 1, "Expected stored candidate count");
  assert(snapshot.crm.staleOpportunities, "Expected CRM stale-opportunity list from stored rows");

  console.log("TEST 2 — Harbor company graph is readable");
  const graph = await getCompanyGraph(COMPANY_ID, INTERNAL_ORG_ID);
  assert(graph?.company.id === COMPANY_ID, "Harbor company missing");

  console.log("TEST 3 — contacts and opportunities exist as first-class rows");
  const [contactCount] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.organizationId, INTERNAL_ORG_ID)).limit(1);
  const [opportunityCount] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.organizationId, INTERNAL_ORG_ID))
    .limit(1);
  const [companyCount] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, COMPANY_ID)).limit(1);
  assert(contactCount, "Expected a stored contact");
  assert(opportunityCount, "Expected a stored opportunity");
  assert(companyCount, "Expected Harbor company");

  console.log("Phase 2 acceptance passed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
