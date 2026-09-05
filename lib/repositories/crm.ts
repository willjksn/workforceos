import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  activities,
  companies,
  companyContacts,
  companyLocations,
  contacts,
  opportunities,
  opportunityScores,
  opportunitySignals,
  users,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import {
  classifyOpportunityScore,
  effectiveOpportunityScore,
  totalOpportunityScore,
  type ScoreBand,
  type ScoreComponents,
} from "../crm/scoring";
import type { OpportunityStage } from "../crm/stages";
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
  industry?: string | null;
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
      industry: input.industry,
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
  const [before] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, params.companyId), eq(companies.organizationId, params.organizationId)))
    .limit(1);
  if (!before) return null;
  const [after] = await db
    .update(companies)
    .set({ name: params.name, updatedAt: new Date() })
    .where(and(eq(companies.id, params.companyId), eq(companies.organizationId, params.organizationId)))
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
  serviceCode?: string | null;
  valueAmount?: string | null;
  primaryContactId?: string | null;
  problemStatement?: string | null;
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
      serviceCode: input.serviceCode,
      valueAmount: input.valueAmount,
      primaryContactId: input.primaryContactId,
      problemStatement: input.problemStatement,
      ownerUserId: input.actorUserId,
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
  evidence?: string | null;
  source?: string | null;
  reviewStatus?: typeof opportunitySignals.$inferInsert.reviewStatus;
}) {
  const db = getDb();
  const [signal] = await db
    .insert(opportunitySignals)
    .values({
      companyId: input.companyId,
      signalType: input.signalType,
      title: input.title,
      details: input.details,
      evidence: input.evidence,
      source: input.source,
      reviewStatus: input.reviewStatus ?? "pending_review",
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

export async function listContacts(
  organizationId: string,
  filters?: { query?: string; companyId?: string },
) {
  const db = getDb();
  const search = sanitizeSearchQuery(filters?.query);
  const rows = await db
    .select({
      contact: contacts,
      companyId: companies.id,
      companyName: companies.name,
      isPrimary: companyContacts.isPrimary,
    })
    .from(contacts)
    .leftJoin(companyContacts, eq(companyContacts.contactId, contacts.id))
    .leftJoin(
      companies,
      and(eq(companyContacts.companyId, companies.id), isNull(companies.archivedAt)),
    )
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        isNull(contacts.archivedAt),
        filters?.companyId ? eq(companies.id, filters.companyId) : undefined,
        search
          ? or(
              ilike(contacts.fullName, `%${search}%`),
              ilike(contacts.title, `%${search}%`),
              ilike(contacts.email, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(contacts.fullName);

  const grouped = new Map<
    string,
    {
      contact: typeof contacts.$inferSelect;
      companies: Array<{ id: string; name: string; isPrimary: boolean }>;
    }
  >();
  for (const row of rows) {
    const current = grouped.get(row.contact.id) ?? { contact: row.contact, companies: [] };
    if (row.companyId && row.companyName) {
      current.companies.push({
        id: row.companyId,
        name: row.companyName,
        isPrimary: row.isPrimary ?? false,
      });
    }
    grouped.set(row.contact.id, current);
  }
  return [...grouped.values()];
}

export async function getContactGraph(contactId: string, organizationId: string) {
  const db = getDb();
  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.organizationId, organizationId),
        isNull(contacts.archivedAt),
      ),
    )
    .limit(1);
  if (!contact) return null;
  const linkedCompanies = await db
    .select({ company: companies, link: companyContacts })
    .from(companyContacts)
    .innerJoin(companies, eq(companyContacts.companyId, companies.id))
    .where(and(eq(companyContacts.contactId, contactId), isNull(companies.archivedAt)));
  const relatedOpportunities = await db
    .select({ opportunity: opportunities, companyName: companies.name })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .where(
      and(
        eq(opportunities.primaryContactId, contactId),
        eq(opportunities.organizationId, organizationId),
        isNull(opportunities.archivedAt),
      ),
    );
  const relatedActivities = await listActivities({
    organizationId,
    contactId,
  });
  return { contact, companies: linkedCompanies, opportunities: relatedOpportunities, activities: relatedActivities };
}

export async function createContact(input: {
  organizationId: string;
  actorUserId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  companyId?: string | null;
  department?: string | null;
  buyerPersona?: string | null;
}) {
  const db = getDb();
  const [contact] = await db
    .insert(contacts)
    .values({
      organizationId: input.organizationId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      title: input.title,
      department: input.department,
      buyerPersona: input.buyerPersona,
      ownerUserId: input.actorUserId,
    })
    .returning();
  if (input.companyId) {
    await db.insert(companyContacts).values({
      companyId: input.companyId,
      contactId: contact.id,
      roleTitle: input.title,
      isPrimary: false,
    });
  }
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

export async function listOpportunitiesFiltered(
  organizationId: string,
  filters?: { query?: string; stage?: string; scoreBand?: string },
) {
  const db = getDb();
  const search = sanitizeSearchQuery(filters?.query);
  return db
    .select({
      opportunity: opportunities,
      companyName: companies.name,
    })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .where(
      and(
        eq(opportunities.organizationId, organizationId),
        isNull(opportunities.archivedAt),
        filters?.stage ? eq(opportunities.stage, filters.stage as OpportunityStage) : undefined,
        filters?.scoreBand ? eq(opportunities.scoreBand, filters.scoreBand as ScoreBand) : undefined,
        search ? or(ilike(opportunities.name, `%${search}%`), ilike(companies.name, `%${search}%`)) : undefined,
      ),
    )
    .orderBy(desc(opportunities.updatedAt));
}

export async function getOpportunityGraph(opportunityId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      opportunity: opportunities,
      company: companies,
      primaryContact: contacts,
      ownerName: users.fullName,
    })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(contacts, eq(opportunities.primaryContactId, contacts.id))
    .leftJoin(users, eq(opportunities.ownerUserId, users.id))
    .where(
      and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.organizationId, organizationId),
        isNull(opportunities.archivedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  const [score] = await db
    .select()
    .from(opportunityScores)
    .where(eq(opportunityScores.opportunityId, opportunityId))
    .limit(1);
  const linkedSignals = await db
    .select()
    .from(opportunitySignals)
    .where(eq(opportunitySignals.resultingOpportunityId, opportunityId))
    .orderBy(desc(opportunitySignals.detectedAt));
  const companyContactsForSelect = await db
    .select({ contact: contacts })
    .from(companyContacts)
    .innerJoin(contacts, eq(companyContacts.contactId, contacts.id))
    .where(eq(companyContacts.companyId, row.company.id));
  const relatedActivities = await listActivities({
    organizationId,
    opportunityId,
  });
  return {
    ...row,
    score: score ?? null,
    signals: linkedSignals,
    companyContacts: companyContactsForSelect.map((item) => item.contact),
    activities: relatedActivities,
  };
}

export async function updateOpportunityStage(input: {
  organizationId: string;
  actorUserId: string;
  opportunityId: string;
  stage: typeof opportunities.$inferInsert.stage;
  lostReason?: string | null;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.id, input.opportunityId),
        eq(opportunities.organizationId, input.organizationId),
        isNull(opportunities.archivedAt),
      ),
    )
    .limit(1);
  if (!before) return null;
  const [after] = await db
    .update(opportunities)
    .set({
      stage: input.stage,
      lostReason: input.stage === "lost" ? input.lostReason : before.lostReason,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, input.opportunityId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "opportunity.stage_changed",
    recordType: "opportunity",
    recordId: input.opportunityId,
    before,
    after,
    reason: input.stage === "lost" ? input.lostReason ?? undefined : undefined,
  });
  await createActivity({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    activityType: "status_change",
    subject: `Stage changed to ${input.stage}`,
    companyId: after.companyId,
    opportunityId: after.id,
  });
  return after;
}

export async function upsertOpportunityScore(input: {
  organizationId: string;
  actorUserId: string;
  opportunityId: string;
  components: ScoreComponents;
  overrideScore?: number | null;
  overrideReason?: string | null;
}) {
  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.id, input.opportunityId),
        eq(opportunities.organizationId, input.organizationId),
        isNull(opportunities.archivedAt),
      ),
    )
    .limit(1);
  if (!opportunity) return null;

  const total = totalOpportunityScore(input.components);
  const effective = effectiveOpportunityScore(total, input.overrideScore);
  const scoreBand = classifyOpportunityScore(effective);
  const [existing] = await db
    .select()
    .from(opportunityScores)
    .where(eq(opportunityScores.opportunityId, input.opportunityId))
    .limit(1);

  const scoreValues = {
    ...input.components,
    total,
    overrideScore: input.overrideScore ?? null,
    overrideReason: input.overrideReason ?? null,
    overrideUserId: input.overrideScore != null ? input.actorUserId : null,
    overrideAt: input.overrideScore != null ? new Date() : null,
    updatedAt: new Date(),
  };

  const [score] = existing
    ? await db
        .update(opportunityScores)
        .set(scoreValues)
        .where(eq(opportunityScores.id, existing.id))
        .returning()
    : await db
        .insert(opportunityScores)
        .values({ opportunityId: input.opportunityId, ...scoreValues })
        .returning();

  const [after] = await db
    .update(opportunities)
    .set({
      opportunityScore: effective,
      scoreBand,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, input.opportunityId))
    .returning();

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "opportunity.scored",
    recordType: "opportunity",
    recordId: input.opportunityId,
    before: opportunity,
    after,
    reason: input.overrideReason ?? undefined,
  });
  return { opportunity: after, score };
}

export async function listSignals(
  organizationId: string,
  filters?: { query?: string; reviewStatus?: string; companyId?: string },
) {
  const db = getDb();
  const search = sanitizeSearchQuery(filters?.query);
  return db
    .select({
      signal: opportunitySignals,
      companyName: companies.name,
      companyId: companies.id,
    })
    .from(opportunitySignals)
    .innerJoin(companies, eq(opportunitySignals.companyId, companies.id))
    .where(
      and(
        eq(companies.organizationId, organizationId),
        isNull(companies.archivedAt),
        filters?.companyId ? eq(companies.id, filters.companyId) : undefined,
        filters?.reviewStatus
          ? eq(
              opportunitySignals.reviewStatus,
              filters.reviewStatus as typeof opportunitySignals.$inferSelect.reviewStatus,
            )
          : undefined,
        search
          ? or(ilike(opportunitySignals.title, `%${search}%`), ilike(companies.name, `%${search}%`))
          : undefined,
      ),
    )
    .orderBy(desc(opportunitySignals.detectedAt));
}

export async function getSignalInOrganization(signalId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({ signal: opportunitySignals, company: companies })
    .from(opportunitySignals)
    .innerJoin(companies, eq(opportunitySignals.companyId, companies.id))
    .where(
      and(
        eq(opportunitySignals.id, signalId),
        eq(companies.organizationId, organizationId),
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function reviewSignal(input: {
  organizationId: string;
  actorUserId: string;
  signalId: string;
  reviewStatus: "approved" | "dismissed";
}) {
  const existing = await getSignalInOrganization(input.signalId, input.organizationId);
  if (!existing) return null;
  const db = getDb();
  const [after] = await db
    .update(opportunitySignals)
    .set({ reviewStatus: input.reviewStatus, updatedAt: new Date() })
    .where(eq(opportunitySignals.id, input.signalId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "opportunity_signal.reviewed",
    recordType: "opportunity_signal",
    recordId: input.signalId,
    before: existing.signal,
    after,
  });
  return after;
}

export async function convertSignalToOpportunity(input: {
  organizationId: string;
  actorUserId: string;
  signalId: string;
  name: string;
  stage: typeof opportunities.$inferInsert.stage;
  serviceCode?: string | null;
}) {
  const existing = await getSignalInOrganization(input.signalId, input.organizationId);
  if (!existing) return null;
  if (existing.signal.resultingOpportunityId) {
    throw new Error("Signal already converted to an opportunity");
  }
  const opportunity = await createOpportunity({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    companyId: existing.company.id,
    name: input.name,
    stage: input.stage,
    serviceCode: input.serviceCode,
    notes: existing.signal.details,
  });
  const db = getDb();
  const [after] = await db
    .update(opportunitySignals)
    .set({
      reviewStatus: "converted",
      resultingOpportunityId: opportunity.id,
      updatedAt: new Date(),
    })
    .where(eq(opportunitySignals.id, input.signalId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "opportunity_signal.converted",
    recordType: "opportunity_signal",
    recordId: input.signalId,
    before: existing.signal,
    after,
  });
  return { signal: after, opportunity };
}

export async function listActivities(filters: {
  organizationId: string;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  candidateId?: string;
}) {
  const db = getDb();
  return db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, filters.organizationId),
        isNull(activities.archivedAt),
        filters.companyId ? eq(activities.companyId, filters.companyId) : undefined,
        filters.contactId ? eq(activities.contactId, filters.contactId) : undefined,
        filters.opportunityId ? eq(activities.opportunityId, filters.opportunityId) : undefined,
        filters.candidateId ? eq(activities.candidateId, filters.candidateId) : undefined,
      ),
    )
    .orderBy(desc(activities.occurredAt))
    .limit(50);
}

export async function createActivity(input: {
  organizationId: string;
  actorUserId: string;
  activityType: typeof activities.$inferInsert.activityType;
  subject: string;
  details?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  candidateId?: string | null;
  nextAction?: string | null;
  followUpAt?: Date | null;
}) {
  const db = getDb();
  const [activity] = await db
    .insert(activities)
    .values({
      organizationId: input.organizationId,
      activityType: input.activityType,
      subject: input.subject,
      details: input.details,
      createdByUserId: input.actorUserId,
      companyId: input.companyId,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      candidateId: input.candidateId,
      nextAction: input.nextAction,
      followUpAt: input.followUpAt,
    })
    .returning();
  if (input.companyId) {
    await db
      .update(companies)
      .set({
        lastActivityAt: activity.occurredAt,
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
        ...(input.followUpAt !== undefined ? { nextActionAt: input.followUpAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(companies.id, input.companyId));
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "activity.created",
    recordType: "activity",
    recordId: activity.id,
    after: activity,
  });
  return activity;
}

export async function listContactsForCompany(companyId: string) {
  const db = getDb();
  return db
    .select({ contact: contacts })
    .from(companyContacts)
    .innerJoin(contacts, eq(companyContacts.contactId, contacts.id))
    .where(and(eq(companyContacts.companyId, companyId), isNull(contacts.archivedAt)))
    .orderBy(contacts.fullName);
}

export async function listUsersForSelect(organizationId: string) {
  const db = getDb();
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), isNull(users.archivedAt)))
    .orderBy(users.fullName);
}
