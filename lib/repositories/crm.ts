import { and, desc, eq, ilike, isNull } from "drizzle-orm";

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
import { sanitizeSearchQuery } from "../validation/forms";

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

export async function listCompanies(organizationId: string, query?: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  return db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.organizationId, organizationId),
        isNull(companies.archivedAt),
        search ? ilike(companies.name, `%${search}%`) : undefined,
      ),
    )
    .orderBy(companies.name);
}

export async function createCompany(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  companyType: typeof companies.$inferInsert.companyType;
  clientStatus: typeof companies.$inferInsert.clientStatus;
  relationshipStrength: typeof companies.$inferInsert.relationshipStrength;
  website?: string | null;
  notes?: string | null;
}) {
  const db = getDb();
  const [company] = await db
    .insert(companies)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      companyType: input.companyType,
      clientStatus: input.clientStatus,
      relationshipStrength: input.relationshipStrength,
      website: input.website,
      notes: input.notes,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "company.created",
    recordType: "company",
    recordId: company.id,
    after: company,
  });
  return company;
}

export async function getCompanyGraph(companyId: string, organizationId?: string) {
  const db = getDb();
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        organizationId ? eq(companies.organizationId, organizationId) : undefined,
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
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
    .where(eq(opportunitySignals.companyId, companyId))
    .orderBy(desc(opportunitySignals.detectedAt));
  const relatedOpportunities = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.companyId, companyId), isNull(opportunities.archivedAt)))
    .orderBy(opportunities.name);
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

export async function addCompanyLocation(input: {
  organizationId: string;
  actorUserId: string;
  companyId: string;
  name: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  isPrimary?: boolean;
}) {
  const db = getDb();
  const [location] = await db
    .insert(companyLocations)
    .values({
      companyId: input.companyId,
      name: input.name,
      city: input.city,
      region: input.region,
      country: input.country,
      isPrimary: input.isPrimary ?? false,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "company_location.created",
    recordType: "company_location",
    recordId: location.id,
    after: location,
  });
  return location;
}

export async function createContactForCompany(input: {
  organizationId: string;
  actorUserId: string;
  companyId: string;
  fullName: string;
  email?: string | null;
  title?: string | null;
  isPrimary?: boolean;
}) {
  const db = getDb();
  const [contact] = await db
    .insert(contacts)
    .values({
      organizationId: input.organizationId,
      fullName: input.fullName,
      email: input.email,
      title: input.title,
    })
    .returning();
  await db.insert(companyContacts).values({
    companyId: input.companyId,
    contactId: contact.id,
    roleTitle: input.title,
    isPrimary: input.isPrimary ?? false,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "contact.created",
    recordType: "contact",
    recordId: contact.id,
    after: contact,
  });
  return contact;
}

export async function createOpportunity(input: {
  organizationId: string;
  actorUserId: string;
  companyId: string;
  name: string;
  stage: typeof opportunities.$inferInsert.stage;
  notes?: string | null;
}) {
  const db = getDb();
  const [opportunity] = await db
    .insert(opportunities)
    .values({
      organizationId: input.organizationId,
      companyId: input.companyId,
      name: input.name,
      stage: input.stage,
      notes: input.notes,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "opportunity.created",
    recordType: "opportunity",
    recordId: opportunity.id,
    after: opportunity,
  });
  return opportunity;
}

export async function addOpportunitySignal(input: {
  organizationId: string;
  actorUserId: string;
  companyId: string;
  signalType: typeof opportunitySignals.$inferInsert.signalType;
  title: string;
  details?: string | null;
}) {
  const db = getDb();
  const [signal] = await db
    .insert(opportunitySignals)
    .values({
      companyId: input.companyId,
      signalType: input.signalType,
      title: input.title,
      details: input.details,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "opportunity_signal.created",
    recordType: "opportunity_signal",
    recordId: signal.id,
    after: signal,
  });
  return signal;
}

export async function listOpportunities(organizationId: string) {
  const db = getDb();
  return db
    .select({
      opportunity: opportunities,
      companyName: companies.name,
    })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .where(and(eq(opportunities.organizationId, organizationId), isNull(opportunities.archivedAt)))
    .orderBy(opportunities.name);
}

export async function getCompanyInOrganization(companyId: string, organizationId: string) {
  const db = getDb();
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        eq(companies.organizationId, organizationId),
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
  return company ?? null;
}

export async function listCompaniesForSelect(organizationId: string) {
  const db = getDb();
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.organizationId, organizationId), isNull(companies.archivedAt)))
    .orderBy(companies.name);
}
