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
  isApolloLiveWired,
  isCheckrLiveApiWired,
  isDocuSignConfigured,
  isDocuSignLiveWired,
  isDrugScreenConfigured,
  isGoogleCalendarLive,
  isGoogleConfigured,
  isMicrosoftCalendarLive,
  isMicrosoftConfigured,
  isOnetConfigured,
  isQuickBooksConfigured,
  isQuickBooksLiveWired,
  isResendConfigured,
  isSeekOutConfigured,
  isSeekOutLiveWired,
} from "./credentials";
import type { EsignAdapter, EsignResult } from "./esign";
import type { IntegrationAdapter, IntegrationHealth } from "./hub";
import { integrationCredential } from "./credentials";
import { integrationFetch } from "./http";
import { upsertExternalRecord } from "./records";
import { logIntegrationEvent, markConnection } from "./retry";
import type { ProviderWiring } from "./wiring";

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationError";
  }
}

type OrgContext = { organizationId: string; actorUserId?: string | null };

function labeledHealth(
  provider: string,
  configured: boolean,
  extra?: Partial<IntegrationHealth> & { liveWired?: boolean },
): IntegrationHealth {
  const liveWired = Boolean(configured && (extra?.liveWired ?? configured));
  const wiring: ProviderWiring = liveWired ? "live" : configured ? "configured" : "mock";
  return {
    provider,
    configured,
    liveWired,
    wiring,
    connectionHealth: liveWired ? "healthy" : configured ? "unknown" : "not_configured",
    lastSyncAt: extra?.lastSyncAt ?? null,
    lastError: configured
      ? extra?.lastError ?? null
      : `${provider} is not configured. Adapter and labeled mock/dev setup only.`,
  };
}

class BaseAdapter implements IntegrationAdapter {
  constructor(
    public readonly provider: string,
    private readonly configured: () => boolean,
    private readonly liveWired: () => boolean = () => false,
  ) {}

  async connect(): Promise<IntegrationHealth> {
    return this.healthCheck();
  }
  async disconnect(): Promise<IntegrationHealth> {
    return labeledHealth(this.provider, false, { liveWired: false });
  }
  async healthCheck(): Promise<IntegrationHealth> {
    return labeledHealth(this.provider, this.configured(), { liveWired: this.liveWired() });
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
    super("quickbooks", isQuickBooksConfigured, isQuickBooksLiveWired);
  }

  async postInvoice(input: OrgContext & { invoiceId: string; invoiceNumber: string; amount: string }) {
    return this.exportInvoice(input);
  }

  async mockExportInvoice(input: OrgContext & { invoiceId: string; invoiceNumber: string; amount: string }) {
    return this.exportInvoice(input);
  }

  async exportInvoice(input: OrgContext & { invoiceId: string; invoiceNumber: string; amount: string }) {
    const configured = isQuickBooksConfigured();
    const live = isQuickBooksLiveWired();
    let externalId = live ? `qb-live-${input.invoiceId}` : configured ? `qb-mapped-${input.invoiceId}` : `qb-dev-${input.invoiceId}`;
    let mode = live ? "live_posted" : configured ? "credentials_present" : "dev_mock";
    let status = live ? "posted" : configured ? "exported_pending_oauth" : "dev_mock";
    let detail = live
      ? "QuickBooks invoice posted through the Integration Hub. WorkforceOS remains the operating record."
      : configured
        ? "QuickBooks app credentials are present but OAuth tokens/realm are missing. Mapping stored; not a live post."
        : "Labeled QuickBooks mock. Not a production connection.";

    if (live) {
      const posted = await this.postLiveInvoice(input);
      externalId = posted.externalId;
      if (posted.error) {
        status = "failed";
        detail = posted.error;
        mode = "live_error";
      }
    }

    const mapping = await upsertExternalRecord({
      organizationId: input.organizationId,
      provider: "quickbooks",
      externalId,
      entityType: "invoice",
      entityId: input.invoiceId,
      payload: {
        invoiceNumber: input.invoiceNumber,
        amount: input.amount,
        mode,
      },
    });
    await logIntegrationEvent({
      organizationId: input.organizationId,
      provider: "quickbooks",
      action: "invoice.export",
      status,
      detail,
      idempotencyKey: `quickbooks:invoice:${input.invoiceId}`,
      payload: { invoiceId: input.invoiceId, externalId },
    });
    await markConnection({
      organizationId: input.organizationId,
      provider: "quickbooks",
      status: live ? "live" : configured ? "credentials_present" : "dev_mock",
      environment: live ? (integrationCredential("QUICKBOOKS_ENVIRONMENT") ?? "sandbox") : configured ? "sandbox" : "dev_mock",
      accountLabel: live
        ? "QuickBooks (live posting)"
        : configured
          ? "QuickBooks (credentials present, OAuth not completed)"
          : "QuickBooks labeled mock",
      success: status !== "failed",
    });
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: input.actorUserId ? "human" : "system", userId: input.actorUserId },
      action: live ? "quickbooks.invoice_posted" : "quickbooks.invoice_mapped",
      recordType: "invoice",
      recordId: input.invoiceId,
      after: mapping,
    });
    return mapping;
  }

  private async postLiveInvoice(input: { invoiceId: string; invoiceNumber: string; amount: string }) {
    const realmId = integrationCredential("QUICKBOOKS_REALM_ID");
    const refresh = integrationCredential("QUICKBOOKS_REFRESH_TOKEN");
    const clientId = integrationCredential("QUICKBOOKS_CLIENT_ID");
    const clientSecret = integrationCredential("QUICKBOOKS_CLIENT_SECRET");
    if (!realmId || !refresh || !clientId || !clientSecret) {
      return { externalId: `qb-live-${input.invoiceId}`, error: "QuickBooks OAuth tokens are incomplete." };
    }
    const tokenResponse = await integrationFetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
    });
    const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return { externalId: `qb-live-${input.invoiceId}`, error: "QuickBooks token refresh failed." };
    }
    const env = integrationCredential("QUICKBOOKS_ENVIRONMENT") === "production" ? "quickbooks.api" : "sandbox-quickbooks.api";
    const response = await integrationFetch(`https://${env}.intuit.com/v3/company/${realmId}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        DocNumber: input.invoiceNumber,
        Line: [{ Amount: Number(input.amount), DetailType: "SalesItemLineDetail" }],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { Invoice?: { Id?: string } };
    if (!response.ok) {
      return { externalId: `qb-live-${input.invoiceId}`, error: "QuickBooks invoice post failed." };
    }
    return { externalId: payload.Invoice?.Id ?? `qb-live-${input.invoiceId}`, error: null };
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
    return labeledHealth(this.provider, isDocuSignConfigured(), { liveWired: isDocuSignLiveWired() });
  }
  async disconnect() {
    return labeledHealth(this.provider, false, { liveWired: false });
  }
  async healthCheck() {
    return labeledHealth(this.provider, isDocuSignConfigured(), { liveWired: isDocuSignLiveWired() });
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
    if (!isDocuSignLiveWired()) {
      return this.result("created", { envelopeId: `ds-configured-${input.contractId}` });
    }
    const created = await this.createLiveEnvelope(input);
    return this.result(created.status, { envelopeId: created.envelopeId, error: created.error });
  }
  async send(envelopeId: string) {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    if (!isDocuSignLiveWired()) return this.result("sent", { envelopeId });
    const sent = await this.sendLiveEnvelope(envelopeId);
    return this.result(sent.status, { envelopeId, error: sent.error });
  }
  async status(envelopeId: string) {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    if (!isDocuSignLiveWired()) return this.result("sent", { envelopeId });
    const live = await this.liveEnvelopeStatus(envelopeId);
    return this.result(live.status, { envelopeId, error: live.error });
  }
  async completedDocument(_envelopeId: string) {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("sent", {
      error: "Envelope completion does not execute a contract. applyDocuSignStatus requires confirmed=true.",
    });
  }
  async auditCertificate() {
    if (!isDocuSignConfigured()) return this.result("not_configured");
    return this.result("sent");
  }

  private docusignBase() {
    return integrationCredential("DOCUSIGN_BASE_URL") ?? "https://demo.docusign.net";
  }

  private async createLiveEnvelope(input: { contractId: string; signerEmail?: string | null; title: string }) {
    const accountId = integrationCredential("DOCUSIGN_ACCOUNT_ID");
    const key = integrationCredential("DOCUSIGN_INTEGRATION_KEY");
    if (!accountId || !key) {
      return { status: "error" as const, envelopeId: null, error: "DocuSign account credentials are incomplete." };
    }
    const response = await integrationFetch(`${this.docusignBase()}/restapi/v2.1/accounts/${accountId}/envelopes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailSubject: input.title,
        status: "created",
        recipients: input.signerEmail
          ? { signers: [{ email: input.signerEmail, name: "Signer", recipientId: "1" }] }
          : undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { envelopeId?: string };
    if (!response.ok || !payload.envelopeId) {
      return { status: "error" as const, envelopeId: null, error: "DocuSign envelope create failed." };
    }
    return { status: "created" as const, envelopeId: payload.envelopeId, error: null };
  }

  private async sendLiveEnvelope(envelopeId: string) {
    const accountId = integrationCredential("DOCUSIGN_ACCOUNT_ID");
    if (!accountId) return { status: "error" as const, error: "DOCUSIGN_ACCOUNT_ID is missing." };
    const response = await integrationFetch(
      `${this.docusignBase()}/restapi/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(envelopeId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${integrationCredential("DOCUSIGN_INTEGRATION_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "sent" }),
      },
    );
    if (!response.ok) return { status: "error" as const, error: "DocuSign envelope send failed." };
    return { status: "sent" as const, error: null };
  }

  private async liveEnvelopeStatus(envelopeId: string) {
    const accountId = integrationCredential("DOCUSIGN_ACCOUNT_ID");
    if (!accountId) return { status: "error" as const, error: "DOCUSIGN_ACCOUNT_ID is missing." };
    const response = await integrationFetch(
      `${this.docusignBase()}/restapi/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(envelopeId)}`,
      {
        headers: { Authorization: `Bearer ${integrationCredential("DOCUSIGN_INTEGRATION_KEY")}` },
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { status?: string };
    if (!response.ok) return { status: "error" as const, error: "DocuSign status poll failed." };
    const completed = payload.status === "completed";
    return {
      status: completed ? ("completed" as const) : ("sent" as const),
      error: completed
        ? "Provider reports completed. WorkforceOS will not mark the contract executed without confirmed=true."
        : null,
    };
  }
}

export class ApolloAdapter extends BaseAdapter {
  constructor() {
    super("apollo", isApolloConfigured, isApolloLiveWired);
  }

  async liveProposeCompany(input: OrgContext & { companyId: string; domain?: string | null }) {
    if (!isApolloLiveWired()) {
      return this.proposeCompanyEnrichment({
        ...input,
        proposed: { note: "Apollo is not configured. No live enrich ran." },
      });
    }
    const key = integrationCredential("APOLLO_API_KEY");
    const response = await integrationFetch("https://api.apollo.io/api/v1/organizations/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key ?? "" },
      body: JSON.stringify({ domain: input.domain }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      organization?: { website_url?: string; industry?: string; estimated_num_employees?: number };
    };
    return this.proposeCompanyEnrichment({
      ...input,
      proposed: {
        website: payload.organization?.website_url,
        industry: payload.organization?.industry,
        employeeCount: payload.organization?.estimated_num_employees,
      },
      externalId: input.domain ? `apollo-${input.domain}` : undefined,
    });
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
    super("seekout", isSeekOutConfigured, isSeekOutLiveWired);
  }

  async lookupCandidates(input: {
    jobId: string;
    internalSearchCompletedAt: Date | null | undefined;
    query: string;
  }) {
    if (!canOpenExternalSourcing(input.internalSearchCompletedAt)) {
      throw new IntegrationError("Internal Talent Network search must be completed before external sourcing.");
    }
    if (!isSeekOutLiveWired()) {
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
    const key = integrationCredential("SEEKOUT_API_KEY");
    const response = await integrationFetch("https://api.seekout.com/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: input.query, jobId: input.jobId }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      results?: Array<{ id?: string; name?: string; title?: string }>;
    };
    return {
      allowed: true as const,
      provider: "seekout" as const,
      mode: "live" as const,
      results: (payload.results ?? []).map((row) => ({
        externalId: row.id ?? "seekout-live",
        displayName: row.name ?? "SeekOut profile",
        title: row.title ?? input.query,
        notes: "Live SeekOut result. Import requires human review. Does not create a Talent Network candidate.",
      })),
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
    super(
      provider,
      provider === "microsoft" ? isMicrosoftConfigured : isGoogleConfigured,
      provider === "microsoft" ? isMicrosoftCalendarLive : isGoogleCalendarLive,
    );
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
    new BaseAdapter("checkr", isCheckrLiveApiWired, isCheckrLiveApiWired),
    new BaseAdapter("resend", isResendConfigured, isResendConfigured),
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
