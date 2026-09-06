import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  civilianOccupations,
  companies,
  contacts,
  enrichmentReviews,
  occupationAlternateTitles,
  occupationDataImports,
  occupationSkills,
  skills,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { canOpenExternalSourcing } from "../recruiting/external-sourcing";
import {
  isApolloConfigured,
  isCheckrConfigured,
  isDocuSignConfigured,
  isDrugScreenConfigured,
  isGoogleConfigured,
  isMicrosoftConfigured,
  isOnetConfigured,
  isQuickBooksConfigured,
  isResendConfigured,
  isSeekOutConfigured,
} from "./credentials";
import type { EsignAdapter, EsignResult } from "./esign";
import type { IntegrationAdapter, IntegrationHealth } from "./hub";
import { upsertExternalRecord } from "./records";
import { logIntegrationEvent, markConnection } from "./retry";

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationError";
  }
}

type OrgContext = { organizationId: string; actorUserId?: string | null };

function labeledHealth(provider: string, configured: boolean, extra?: Partial<IntegrationHealth>): IntegrationHealth {
  return {
    provider,
    configured,
    connectionHealth: configured ? "healthy" : "not_configured",
    lastSyncAt: extra?.lastSyncAt ?? null,
    lastError: configured ? extra?.lastError ?? null : `${provider} is not configured. Adapter and labeled mock/dev setup only.`,
  };
}

class BaseAdapter implements IntegrationAdapter {
  constructor(
    public readonly provider: string,
    private readonly configured: () => boolean,
  ) {}

  async connect(): Promise<IntegrationHealth> {
    return this.healthCheck();
  }
  async disconnect(): Promise<IntegrationHealth> {
    return labeledHealth(this.provider, false);
  }
  async healthCheck(): Promise<IntegrationHealth> {
    return labeledHealth(this.provider, this.configured());
  }
  async sync(): Promise<IntegrationHealth> {
    return this.healthCheck();
  }
  async lookup(): Promise<unknown[]> {
    return [];
  }
  async importRecords(): Promise<{ imported: number }> {
    return { imported: 0 };
  }
  async exportRecords(): Promise<{ exported: number }> {
    return { exported: 0 };
  }
}

export class QuickBooksAdapter extends BaseAdapter {
  constructor() {
    super("quickbooks", isQuickBooksConfigured);
  }

  async mockExportInvoice(input: OrgContext & { invoiceId: string; invoiceNumber: string; amount: string }) {
    const configured = isQuickBooksConfigured();
    const externalId = configured ? `qb-live-${input.invoiceId}` : `qb-dev-${input.invoiceId}`;
    const mapping = await upsertExternalRecord({
      organizationId: input.organizationId,
      provider: "quickbooks",
      externalId,
      entityType: "invoice",
      entityId: input.invoiceId,
      payload: {
        invoiceNumber: input.invoiceNumber,
        amount: input.amount,
        mode: configured ? "credentials_present" : "dev_mock",
      },
    });
    await logIntegrationEvent({
      organizationId: input.organizationId,
      provider: "quickbooks",
      action: "invoice.export",
      status: configured ? "exported_pending_oauth" : "dev_mock",
      detail: configured
        ? "QuickBooks credentials are present but live OAuth posting is not enabled. Mapping stored."
        : "Labeled QuickBooks mock. Not a production connection.",
      idempotencyKey: `quickbooks:invoice:${input.invoiceId}`,
      payload: { invoiceId: input.invoiceId, externalId },
    });
    await markConnection({
      organizationId: input.organizationId,
      provider: "quickbooks",
      status: configured ? "credentials_present" : "dev_mock",
      environment: configured ? "sandbox" : "dev_mock",
      accountLabel: configured ? "QuickBooks (credentials present, OAuth not completed)" : "QuickBooks labeled mock",
      success: true,
    });
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: input.actorUserId ? "human" : "system", userId: input.actorUserId },
      action: "quickbooks.invoice_mapped",
      recordType: "invoice",
      recordId: input.invoiceId,
      after: mapping,
    });
    return mapping;
  }

  async mapCustomer(input: OrgContext & { companyId: string; companyName: string }) {
    return upsertExternalRecord({
      organizationId: input.organizationId,
      provider: "quickbooks",
      externalId: `qb-customer-${input.companyId}`,
      entityType: "company",
      entityId: input.companyId,
      payload: { name: input.companyName, mode: isQuickBooksConfigured() ? "credentials_present" : "dev_mock" },
    });
  }

  async mapPayment(input: OrgContext & { paymentId: string }) {
    return upsertExternalRecord({
      organizationId: input.organizationId,
      provider: "quickbooks",
      externalId: `qb-payment-${input.paymentId}`,
      entityType: "payment",
      entityId: input.paymentId,
      payload: { mode: isQuickBooksConfigured() ? "credentials_present" : "dev_mock" },
    });
  }
}

export class DocuSignAdapter implements EsignAdapter, IntegrationAdapter {
  provider = "docusign";

  private result(status: EsignResult["status"], extra?: Partial<EsignResult>): EsignResult {
    const configured = isDocuSignConfigured();
    return {
      provider: this.provider,
      configured,
      status,
      error: extra?.error ?? (configured ? null : "DocuSign is not configured. Use manual execution."),
      envelopeId: extra?.envelopeId ?? null,
    };
  }

  async connect() {
    return labeledHealth(this.provider, isDocuSignConfigured());
  }
  async disconnect() {
    return labeledHealth(this.provider, false);
  }
  async healthCheck() {
    return labeledHealth(this.provider, isDocuSignConfigured());
  }
  async sync() {
    return this.healthCheck();
  }
  async lookup() {
    return [];
  }
  async importRecords() {
    return { imported: 0 };
  }
  async exportRecords() {
    return { exported: 0 };
  }

  async createEnvelope(input: { contractId: string; signerEmail?: string | null; title: string }) {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("created", { envelopeId: `ds-dev-${input.contractId}` });
  }
  async send(envelopeId: string) {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("sent", { envelopeId });
  }
  async status(envelopeId: string) {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("sent", { envelopeId });
  }
  async completedDocument() {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("sent", {
      error: "Envelope is not completed. WorkforceOS will not mark the contract executed.",
    });
  }
  async auditCertificate() {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("sent");
  }
}

export class ApolloAdapter extends BaseAdapter {
  constructor() {
    super("apollo", isApolloConfigured);
  }

  async proposeCompanyEnrichment(input: OrgContext & {
    companyId: string;
    proposed: Record<string, unknown>;
    externalId?: string;
    confidence?: number;
  }) {
    const db = getDb();
    const [company] = await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1);
    if (!company) throw new IntegrationError("Company not found");
    const [review] = await db
      .insert(enrichmentReviews)
      .values({
        organizationId: input.organizationId,
        provider: "apollo",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        externalId: input.externalId ?? `apollo-dev-${company.id}`,
        proposedPayload: input.proposed,
        confidence: input.confidence ?? 60,
        status: "pending_review",
        lastSyncAt: new Date(),
      })
      .returning();
    await upsertExternalRecord({
      organizationId: input.organizationId,
      provider: "apollo",
      externalId: review.externalId ?? `apollo-dev-${company.id}`,
      entityType: "company",
      entityId: company.id,
      payload: { reviewId: review.id, status: "pending_review" },
    });
    await logIntegrationEvent({
      organizationId: input.organizationId,
      provider: "apollo",
      action: "enrichment.proposed",
      status: "pending_review",
      detail: "Apollo proposed CRM fields. Approved CRM data was not overwritten.",
      idempotencyKey: `apollo:review:${review.id}`,
    });
    return { review, company };
  }

  async applyEnrichment(input: OrgContext & { reviewId: string; accept: boolean; notes?: string | null }) {
    const db = getDb();
    const [review] = await db.select().from(enrichmentReviews).where(eq(enrichmentReviews.id, input.reviewId)).limit(1);
    if (!review) throw new IntegrationError("Enrichment review not found");
    if (!input.accept) {
      const [updated] = await db
        .update(enrichmentReviews)
        .set({
          status: "rejected",
          reviewedByUserId: input.actorUserId ?? null,
          reviewedAt: new Date(),
          reviewNotes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(enrichmentReviews.id, review.id))
        .returning();
      return { review: updated, applied: false };
    }
    if (!input.actorUserId) {
      throw new IntegrationError("Applying Apollo enrichment requires a human reviewer");
    }
    const proposed = (review.proposedPayload ?? {}) as Record<string, unknown>;
    if (review.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, review.companyId)).limit(1);
      if (company) {
        const patch: Partial<typeof companies.$inferInsert> = { updatedAt: new Date() };
        if (!company.website && typeof proposed.website === "string") patch.website = proposed.website;
        if (!company.industry && typeof proposed.industry === "string") patch.industry = proposed.industry;
        if (company.employeeCount == null && typeof proposed.employeeCount === "number") {
          patch.employeeCount = proposed.employeeCount;
        }
        await db.update(companies).set(patch).where(eq(companies.id, company.id));
      }
    }
    if (review.contactId) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, review.contactId)).limit(1);
      if (contact) {
        const patch: Partial<typeof contacts.$inferInsert> = { updatedAt: new Date() };
        if (!contact.title && typeof proposed.title === "string") patch.title = proposed.title;
        if (!contact.email && typeof proposed.email === "string") patch.email = proposed.email;
        await db.update(contacts).set(patch).where(eq(contacts.id, contact.id));
      }
    }
    const [updated] = await db
      .update(enrichmentReviews)
      .set({
        status: "accepted",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        reviewNotes: input.notes ?? "Accepted empty-field fill only. Existing approved CRM values were kept.",
        updatedAt: new Date(),
      })
      .where(eq(enrichmentReviews.id, review.id))
      .returning();
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: "human", userId: input.actorUserId },
      action: "apollo.enrichment_accepted",
      recordType: "enrichment_review",
      recordId: review.id,
      after: updated,
    });
    return { review: updated, applied: true };
  }
}

export type OnetImportRecord = {
  onetCode: string;
  title: string;
  description?: string | null;
  alternateTitles?: string[];
  skills?: Array<{
    name: string;
    slug: string;
    family?: "technical" | "leadership" | "business" | "digital" | "safety_compliance" | "other";
  }>;
};

export class OnetAdapter extends BaseAdapter {
  constructor() {
    super("onet", isOnetConfigured);
  }

  async importCatalog(input: OrgContext & { records: OnetImportRecord[]; sourceVersion: string; source?: string }) {
    const db = getDb();
    let upserted = 0;
    const source = input.source ?? (isOnetConfigured() ? "onet-api" : "onet-dev-fixture");
    for (const record of input.records) {
      const [existing] = await db
        .select()
        .from(civilianOccupations)
        .where(eq(civilianOccupations.onetCode, record.onetCode))
        .limit(1);
      const occupation = existing
        ? (
            await db
              .update(civilianOccupations)
              .set({
                title: record.title,
                description: record.description ?? existing.description,
                onetSource: source,
                onetVersion: input.sourceVersion,
                updatedAt: new Date(),
              })
              .where(eq(civilianOccupations.id, existing.id))
              .returning()
          )[0]
        : (
            await db
              .insert(civilianOccupations)
              .values({
                title: record.title,
                code: record.onetCode,
                description: record.description ?? null,
                onetCode: record.onetCode,
                onetSource: source,
                onetVersion: input.sourceVersion,
              })
              .returning()
          )[0];
      upserted += 1;
      for (const title of record.alternateTitles ?? []) {
        await db
          .insert(occupationAlternateTitles)
          .values({
            occupationId: occupation.id,
            title,
            onetSource: source,
            onetVersion: input.sourceVersion,
          })
          .onConflictDoNothing();
      }
      for (const skill of record.skills ?? []) {
        const [skillRow] = await db.select().from(skills).where(eq(skills.slug, skill.slug)).limit(1);
        const stored =
          skillRow ??
          (
            await db
              .insert(skills)
              .values({
                name: skill.name,
                slug: skill.slug,
                skillFamily: skill.family ?? "technical",
                onetSource: source,
                onetVersion: input.sourceVersion,
              })
              .returning()
          )[0];
        await db.insert(occupationSkills).values({ occupationId: occupation.id, skillId: stored.id }).onConflictDoNothing();
        await db
          .update(skills)
          .set({ onetSource: source, onetVersion: input.sourceVersion, updatedAt: new Date() })
          .where(eq(skills.id, stored.id));
      }
    }
    const [log] = await db
      .insert(occupationDataImports)
      .values({
        source,
        sourceVersion: input.sourceVersion,
        summary: `O*NET ${input.sourceVersion}: ${upserted} occupations. ${isOnetConfigured() ? "Credentialed import." : "Labeled fixture import; not live O*NET."}`,
        recordsUpserted: upserted,
        recordsSkipped: 0,
        importedByUserId: input.actorUserId ?? null,
      })
      .returning();
    await logIntegrationEvent({
      organizationId: input.organizationId,
      provider: "onet",
      action: "catalog.import",
      status: "succeeded",
      detail: log.summary,
      payload: { sourceVersion: input.sourceVersion, source, upserted },
    });
    return log;
  }
}

export class SeekOutAdapter extends BaseAdapter {
  constructor() {
    super("seekout", isSeekOutConfigured);
  }

  lookupCandidates(input: {
    jobId: string;
    internalSearchCompletedAt: Date | null | undefined;
    query: string;
  }) {
    if (!canOpenExternalSourcing(input.internalSearchCompletedAt)) {
      throw new IntegrationError("Internal Talent Network search must be completed before external sourcing.");
    }
    return {
      allowed: true as const,
      provider: "seekout" as const,
      mode: isSeekOutConfigured() ? "credentials_present" : "dev_mock",
      results: isSeekOutConfigured()
        ? []
        : [
            {
              externalId: "seekout-dev-1",
              displayName: "Labeled SeekOut mock profile",
              title: input.query,
              notes: "Mock result. Import requires human review. Not a live SeekOut connection.",
            },
          ],
    };
  }
}

export class LinkedInAdapter extends BaseAdapter {
  constructor() {
    super("linkedin-recruiter", () => false);
  }

  scrape() {
    throw new IntegrationError("LinkedIn scraping is not supported.");
  }
}

export class WorkspaceAdapter extends BaseAdapter {
  constructor(provider: "microsoft" | "google") {
    super(provider, provider === "microsoft" ? isMicrosoftConfigured : isGoogleConfigured);
  }
}

export function getQuickBooksAdapter() {
  return new QuickBooksAdapter();
}
export function getApolloAdapter() {
  return new ApolloAdapter();
}
export function getOnetAdapter() {
  return new OnetAdapter();
}
export function getSeekOutAdapter() {
  return new SeekOutAdapter();
}
export function getLinkedInAdapter() {
  return new LinkedInAdapter();
}

export function buildProviderAdapters(): IntegrationAdapter[] {
  return [
    new ApolloAdapter(),
    new OnetAdapter(),
    new BaseAdapter("bls", () => false),
    new BaseAdapter("census", () => false),
    new LinkedInAdapter(),
    new SeekOutAdapter(),
    new BaseAdapter("hireez", () => false),
    new WorkspaceAdapter("microsoft"),
    new WorkspaceAdapter("google"),
    new DocuSignAdapter(),
    new QuickBooksAdapter(),
    new BaseAdapter("checkr", isCheckrConfigured),
    new BaseAdapter("resend", isResendConfigured),
    new BaseAdapter("drug-screen", isDrugScreenConfigured),
  ];
}

export function verifyWebhookSignature(input: {
  provider: string;
  rawBody: string;
  signature: string | null;
  secret: string | null;
}) {
  if (!input.secret || !input.signature) return false;
  const digest = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
  const expected = Buffer.from(digest);
  const provided = Buffer.from(input.signature);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function stableEventId(provider: string, rawBody: string) {
  return `${provider}:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
}
