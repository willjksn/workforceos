import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  companies,
  companyContacts,
  companyLocations,
  contacts,
  opportunities,
  opportunitySignals,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";

export async function createCompanyFixture(input: {
  organizationId: string;
  actorUserId?: string;
  company: typeof companies.$inferInsert;
  locations: Array<Omit<typeof companyLocations.$inferInsert, "companyId">>;
  contacts: Array<typeof contacts.$inferInsert>;
  signals: Array<Omit<typeof opportunitySignals.$inferInsert, "companyId">>;
  opportunity: Omit<typeof opportunities.$inferInsert, "companyId">;
}) {
  const db = getDb();
  const [company] = await db.insert(companies).values(input.company).returning();

  const locations = await db
    .insert(companyLocations)
    .values(input.locations.map((location) => ({ ...location, companyId: company.id })))
    .returning();

  const createdContacts = await db.insert(contacts).values(input.contacts).returning();
  await db.insert(companyContacts).values(
    createdContacts.map((contact, index) => ({
      companyId: company.id,
      contactId: contact.id,
      isPrimary: index === 0,
    })),
  );

  const signals = await db
    .insert(opportunitySignals)
    .values(input.signals.map((signal) => ({ ...signal, companyId: company.id })))
    .returning();

  const [opportunity] = await db
    .insert(opportunities)
    .values({ ...input.opportunity, companyId: company.id })
    .returning();

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: input.actorUserId ? "human" : "system", userId: input.actorUserId },
    action: "company.created",
    recordType: "company",
    recordId: company.id,
    after: company,
  });

  return { company, locations, contacts: createdContacts, signals, opportunity };
}

export async function getCompanyGraph(companyId: string) {
  const db = getDb();
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return null;
  const locations = await db
    .select()
    .from(companyLocations)
    .where(and(eq(companyLocations.companyId, companyId), isNull(companyLocations.archivedAt)));
  const linkedContacts = await db
    .select({ contact: contacts, link: companyContacts })
    .from(companyContacts)
    .innerJoin(contacts, eq(companyContacts.contactId, contacts.id))
    .where(eq(companyContacts.companyId, companyId));
  const signals = await db
    .select()
    .from(opportunitySignals)
    .where(eq(opportunitySignals.companyId, companyId));
  const relatedOpportunities = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.companyId, companyId));
  return { company, locations, contacts: linkedContacts, signals, opportunities: relatedOpportunities };
}

export async function updateCompanyName(params: {
  organizationId: string;
  companyId: string;
  name: string;
  actorUserId?: string;
}) {
  const db = getDb();
  const [before] = await db.select().from(companies).where(eq(companies.id, params.companyId)).limit(1);
  const [after] = await db
    .update(companies)
    .set({ name: params.name, updatedAt: new Date() })
    .where(eq(companies.id, params.companyId))
    .returning();
  await recordAuditEvent({
    organizationId: params.organizationId,
    actor: { type: params.actorUserId ? "human" : "system", userId: params.actorUserId },
    action: "company.updated",
    recordType: "company",
    recordId: params.companyId,
    before,
    after,
  });
  return after;
}
