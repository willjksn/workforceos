import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  activities,
  companies,
  companyContacts,
  contacts,
  opportunities,
  publicIntakeSettings,
  websiteInquiries,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { getEmailProvider } from "../email";
import { inquiryAcknowledgementEmail } from "../hiring/templates";
import { createInAppNotification } from "../notifications/service";
import { resolveOwnerByRole, resolvePublicOrganizationId } from "../public-api/organization";
import { normalizeEmail, normalizePhone, normalizeWebsiteHost, stripHtml } from "../public-api/normalize";
import { PublicGatewayError } from "../public-api/write-access";
import type { InquiryPayload } from "@pierone/public-api-contracts";

export class InquiryError extends PublicGatewayError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = "InquiryError";
  }
}

async function getIntakeSettings(organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(publicIntakeSettings)
    .where(eq(publicIntakeSettings.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

export async function resolveInquiryOwner(organizationId: string) {
  const settings = await getIntakeSettings(organizationId);
  return resolveOwnerByRole({
    organizationId,
    userId: settings?.inquiryOwnerUserId,
    roleSlug: settings?.inquiryOwnerRoleSlug ?? "managing-partner",
  });
}

export async function resolveMilitaryTalentOwner(organizationId: string) {
  const settings = await getIntakeSettings(organizationId);
  return resolveOwnerByRole({
    organizationId,
    userId: settings?.militaryTalentOwnerUserId,
    roleSlug: settings?.militaryTalentOwnerRoleSlug ?? "military-talent-partner",
  });
}

export async function resolveApplicationNotifyOwner(organizationId: string) {
  const settings = await getIntakeSettings(organizationId);
  return resolveOwnerByRole({
    organizationId,
    userId: settings?.applicationNotifyUserId,
    roleSlug: settings?.applicationNotifyRoleSlug ?? "recruiter",
  });
}

async function matchCompany(input: { organizationId: string; website?: string | null; name: string }) {
  const db = getDb();
  const host = normalizeWebsiteHost(input.website);
  if (host) {
    const rows = await db
      .select({ id: companies.id, website: companies.website, name: companies.name })
      .from(companies)
      .where(and(eq(companies.organizationId, input.organizationId), isNull(companies.archivedAt)));
    const hits = rows.filter((row) => normalizeWebsiteHost(row.website) === host);
    if (hits.length === 1) return { status: "linked" as const, companyId: hits[0].id };
    if (hits.length > 1) return { status: "ambiguous" as const, companyId: null };
    const [created] = await db
      .insert(companies)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        website: `https://${host}`,
        companyType: "prospect",
        clientStatus: "prospect",
        notes: "Created from PierOne public website inquiry. Domain match was unique.",
      })
      .returning();
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: "system" },
      action: "company.created",
      recordType: "company",
      recordId: created.id,
      after: { source: "pierone_public_website", host },
    });
    return { status: "created" as const, companyId: created.id };
  }
  return { status: "unresolved" as const, companyId: null };
}

async function matchContact(input: {
  organizationId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  title?: string | null;
  companyId?: string | null;
  ownerUserId?: string | null;
}) {
  const db = getDb();
  const email = normalizeEmail(input.email);
  if (!email) throw new InquiryError("A valid work email is required.");
  const rows = await db
    .select({ id: contacts.id, email: contacts.email })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, input.organizationId),
        isNull(contacts.archivedAt),
        sql`lower(${contacts.email}) = ${email}`,
      ),
    );
  const unique = [...new Set(rows.map((row) => row.id))];
  if (unique.length > 1) return { status: "ambiguous" as const, contactId: null };
  if (unique.length === 1) {
    const contactId = unique[0];
    await db
      .update(contacts)
      .set({
        phone: input.phone ?? undefined,
        title: input.title ?? undefined,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId));
    if (input.companyId) {
      await db
        .insert(companyContacts)
        .values({ companyId: input.companyId, contactId, roleTitle: input.title, isPrimary: false })
        .onConflictDoNothing();
    }
    return { status: "linked" as const, contactId };
  }
  const [created] = await db
    .insert(contacts)
    .values({
      organizationId: input.organizationId,
      fullName: input.fullName,
      email,
      phone: input.phone ?? null,
      title: input.title ?? null,
      ownerUserId: input.ownerUserId ?? null,
    })
    .returning();
  if (input.companyId) {
    await db.insert(companyContacts).values({
      companyId: input.companyId,
      contactId: created.id,
      roleTitle: input.title,
      isPrimary: true,
    });
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "system" },
    action: "contact.created",
    recordType: "contact",
    recordId: created.id,
    after: { source: "pierone_public_website" },
  });
  return { status: "created" as const, contactId: created.id };
}

export async function submitWebsiteInquiry(input: InquiryPayload & { ip?: string | null }) {
  if (input.honeypot) throw new InquiryError("Inquiry rejected.");
  const organizationId = await resolvePublicOrganizationId();
  const ownerUserId = await resolveInquiryOwner(organizationId);
  const firstName = stripHtml(input.firstName);
  const lastName = stripHtml(input.lastName);
  const companyName = stripHtml(input.company);
  const email = normalizeEmail(input.email);
  if (!email) throw new InquiryError("A valid work email is required.");
  const companyMatch = await matchCompany({
    organizationId,
    website: input.companyWebsite,
    name: companyName,
  });
  const contactMatch = await matchContact({
    organizationId,
    email,
    fullName: `${firstName} ${lastName}`.trim(),
    phone: normalizePhone(input.phone),
    title: input.title ? stripHtml(input.title) : null,
    companyId: companyMatch.companyId,
    ownerUserId,
  });

  const db = getDb();
  const [inquiry] = await db
    .insert(websiteInquiries)
    .values({
      organizationId,
      companyId: companyMatch.companyId,
      contactId: contactMatch.contactId,
      ownerUserId,
      firstName,
      lastName,
      email,
      phone: normalizePhone(input.phone),
      companyName,
      companyWebsite: input.companyWebsite ? stripHtml(input.companyWebsite) : null,
      title: input.title ? stripHtml(input.title) : null,
      serviceInterest: input.serviceInterest,
      challenge: stripHtml(input.challenge),
      timeline: input.timeline ? stripHtml(input.timeline) : null,
      roleCount: input.roleCount ? stripHtml(input.roleCount) : null,
      location: input.location ? stripHtml(input.location) : null,
      referralSource: input.referralSource ? stripHtml(input.referralSource) : null,
      source: "pierone_public_website",
      subsource: input.pagePath ? stripHtml(input.pagePath) : "contact_form",
      landingUrl: input.landingUrl ? stripHtml(input.landingUrl) : null,
      referrer: input.referrer ? stripHtml(input.referrer) : null,
      utmSource: input.utmSource ? stripHtml(input.utmSource) : null,
      utmMedium: input.utmMedium ? stripHtml(input.utmMedium) : null,
      utmCampaign: input.utmCampaign ? stripHtml(input.utmCampaign) : null,
      utmContent: input.utmContent ? stripHtml(input.utmContent) : null,
      utmTerm: input.utmTerm ? stripHtml(input.utmTerm) : null,
      companyMatchStatus: companyMatch.status,
      contactMatchStatus: contactMatch.status,
      status: "new",
    })
    .returning();

  await db.insert(activities).values({
    organizationId,
    activityType: "system",
    subject: "Website inquiry submitted",
    details: `${firstName} ${lastName} submitted a PierOne website inquiry for ${input.serviceInterest}.`,
    createdByUserId: ownerUserId,
    companyId: companyMatch.companyId,
    contactId: contactMatch.contactId,
  });

  await recordAuditEvent({
    organizationId,
    actor: { type: "system" },
    action: "website_inquiry.submitted",
    recordType: "website_inquiry",
    recordId: inquiry.id,
    after: {
      serviceInterest: input.serviceInterest,
      companyMatchStatus: companyMatch.status,
      contactMatchStatus: contactMatch.status,
      source: "pierone_public_website",
    },
  });

  if (ownerUserId) {
    await createInAppNotification({
      organizationId,
      userId: ownerUserId,
      kind: "website_inquiry_received",
      title: "New website inquiry",
      body: `${companyName} · ${input.serviceInterest}`,
      href: `/app/crm/inquiries/${inquiry.id}`,
      recordType: "website_inquiry",
      recordId: inquiry.id,
    });
  }

  const mail = inquiryAcknowledgementEmail({ firstName });
  const sent = await getEmailProvider().sendTransactional({
    organizationId,
    to: email,
    template: "inquiry_acknowledgement",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    entityType: "website_inquiry",
    entityId: inquiry.id,
  });
  await db.insert(activities).values({
    organizationId,
    activityType: "email",
    subject: "Acknowledgement sent",
    details: sent.status === "failed" ? sent.error ?? "Acknowledgement email failed." : "Acknowledgement email queued.",
    createdByUserId: ownerUserId,
    companyId: companyMatch.companyId,
    contactId: contactMatch.contactId,
  });

  return { inquiry, emailStatus: sent.status };
}

export async function listWebsiteInquiries(organizationId: string, query?: string) {
  const db = getDb();
  const search = query?.trim();
  return db
    .select()
    .from(websiteInquiries)
    .where(
      and(
        eq(websiteInquiries.organizationId, organizationId),
        isNull(websiteInquiries.archivedAt),
        search
          ? or(
              ilike(websiteInquiries.companyName, `%${search}%`),
              ilike(websiteInquiries.email, `%${search}%`),
              ilike(websiteInquiries.firstName, `%${search}%`),
              ilike(websiteInquiries.lastName, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(websiteInquiries.submittedAt))
    .limit(200);
}

export async function getWebsiteInquiry(organizationId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(websiteInquiries)
    .where(and(eq(websiteInquiries.id, id), eq(websiteInquiries.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function updateWebsiteInquiryStatus(input: {
  organizationId: string;
  actorUserId: string;
  inquiryId: string;
  status: typeof websiteInquiries.$inferSelect.status;
}) {
  const db = getDb();
  const current = await getWebsiteInquiry(input.organizationId, input.inquiryId);
  if (!current) throw new InquiryError("Inquiry not found.", 404);
  const [updated] = await db
    .update(websiteInquiries)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(websiteInquiries.id, input.inquiryId))
    .returning();
  await db.insert(activities).values({
    organizationId: input.organizationId,
    activityType: "status_change",
    subject: `Inquiry ${input.status.replaceAll("_", " ")}`,
    createdByUserId: input.actorUserId,
    companyId: current.companyId,
    contactId: current.contactId,
    opportunityId: current.opportunityId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "website_inquiry.status_changed",
    recordType: "website_inquiry",
    recordId: input.inquiryId,
    before: { status: current.status },
    after: { status: input.status },
  });
  return updated;
}

export async function convertInquiryToOpportunity(input: {
  organizationId: string;
  actorUserId: string;
  inquiryId: string;
}) {
  const inquiry = await getWebsiteInquiry(input.organizationId, input.inquiryId);
  if (!inquiry) throw new InquiryError("Inquiry not found.", 404);
  if (!inquiry.companyId) {
    throw new InquiryError("Link or create a company before converting this inquiry.");
  }
  if (inquiry.opportunityId) {
    return getWebsiteInquiry(input.organizationId, input.inquiryId);
  }
  const db = getDb();
  const [opportunity] = await db
    .insert(opportunities)
    .values({
      organizationId: input.organizationId,
      companyId: inquiry.companyId,
      name: `${inquiry.companyName} — ${inquiry.serviceInterest}`,
      stage: "identified",
      serviceCode: inquiry.serviceInterest === "other" ? null : inquiry.serviceInterest,
      ownerUserId: inquiry.ownerUserId ?? input.actorUserId,
      primaryContactId: inquiry.contactId,
      problemStatement: inquiry.challenge,
      notes: "Converted from PierOne public website inquiry. Human qualification required.",
    })
    .returning();
  await db
    .update(websiteInquiries)
    .set({
      opportunityId: opportunity.id,
      status: "converted_to_opportunity",
      updatedAt: new Date(),
    })
    .where(eq(websiteInquiries.id, inquiry.id));
  await db.insert(activities).values({
    organizationId: input.organizationId,
    activityType: "status_change",
    subject: "Inquiry converted to opportunity",
    createdByUserId: input.actorUserId,
    companyId: inquiry.companyId,
    contactId: inquiry.contactId,
    opportunityId: opportunity.id,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "website_inquiry.converted",
    recordType: "website_inquiry",
    recordId: inquiry.id,
    after: { opportunityId: opportunity.id },
  });
  return getWebsiteInquiry(input.organizationId, inquiry.id);
}
