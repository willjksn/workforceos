import "./load-env";

import { createHmac, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  billingSchedules,
  companies,
  enrichmentReviews,
  invoices,
  jobs,
  occupationDataImports,
  offers,
  opportunities,
  placements,
  searchProjects,
} from "../db/schema";
import { CANDIDATE_ID, INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import {
  approveDiscovery,
  approveSolutionPlanRecord,
  createContractPackage,
  createDeliveryProject,
  createDiscovery,
  createSolutionPlanFromDiscovery,
  executeContractManual,
} from "../lib/delivery/engine";
import {
  accountsReceivableView,
  approveFinanceAdjustment,
  createInvoiceFromBillingEvent,
  FinanceError,
  recordPayment,
  recordPlacementFeeEvent,
  requestFeeOverride,
  storeContractBillingTerms,
} from "../lib/finance/engine";
import { getApolloAdapter, getOnetAdapter, getQuickBooksAdapter } from "../lib/integrations/providers";
import { logIntegrationEvent, retryFailedEvent } from "../lib/integrations/retry";
import { receiveProviderWebhook, WebhookError } from "../lib/integrations/webhooks";
import { canOpenExternalSourcing } from "../lib/recruiting/external-sourcing";
import { getDocuSignAdapter, getEsignAdapter } from "../lib/integrations/esign";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const actor = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.managingPartner,
  roleSlugs: ["managing-partner"],
};

const reader = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.readOnly,
  roleSlugs: ["read-only"],
};

async function createClient(serviceCode: string) {
  const db = getDb();
  const companyId = randomUUID();
  const opportunityId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    organizationId: INTERNAL_ORG_ID,
    name: `Phase 6 ${serviceCode} ${companyId.slice(0, 8)}`,
    website: "https://approved.example.test",
    notes: "Phase 6 acceptance disposable company",
  });
  await db.insert(opportunities).values({
    id: opportunityId,
    organizationId: INTERNAL_ORG_ID,
    companyId,
    name: `${serviceCode} opportunity`,
    serviceCode,
    stage: "discovery_scheduled",
  });
  return { companyId, opportunityId };
}

async function engagement(serviceCode: string, title: string) {
  const client = await createClient(serviceCode);
  const discovery = await createDiscovery({
    actor,
    companyId: client.companyId,
    opportunityId: client.opportunityId,
    serviceCode,
    title: `${title} discovery`,
    answers: { fixture: title },
  });
  await approveDiscovery({ actor, discoveryId: discovery.id });
  const plan = await createSolutionPlanFromDiscovery({
    actor,
    discoveryId: discovery.id,
    title: `${title} plan`,
  });
  await approveSolutionPlanRecord({ actor, solutionPlanId: plan.id });
  const pack = await createContractPackage({
    actor,
    solutionPlanId: plan.id,
    serviceCode,
    companyId: client.companyId,
    opportunityId: client.opportunityId,
  });
  const contract = pack.contracts[0];
  await executeContractManual({ actor, contractId: contract.id, signerName: "Phase 6 Signer" });
  return { ...client, plan, contract };
}

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — placement creates correct fee event");
  const searchCompanyId = randomUUID();
  await db.insert(companies).values({
    id: searchCompanyId,
    organizationId: INTERNAL_ORG_ID,
    name: `Phase 6 search ${searchCompanyId.slice(0, 8)}`,
  });
  const [job] = await db
    .insert(jobs)
    .values({
      organizationId: INTERNAL_ORG_ID,
      companyId: searchCompanyId,
      title: "Plant Electrician",
      status: "open",
    })
    .returning();
  const [search] = await db
    .insert(searchProjects)
    .values({
      jobId: job.id,
      companyId: searchCompanyId,
      name: "Phase 6 fee search",
      feePercent: "25.00",
      minimumFee: "15000.00",
      guaranteeDays: 90,
    })
    .returning();
  const [offer] = await db
    .insert(offers)
    .values({
      candidateId: CANDIDATE_ID,
      jobId: job.id,
      searchProjectId: search.id,
      status: "accepted",
      baseSalary: "82000.00",
    })
    .returning();
  const [placement] = await db
    .insert(placements)
    .values({
      candidateId: offer.candidateId,
      jobId: job.id,
      companyId: searchCompanyId,
      searchProjectId: search.id,
      offerId: offer.id,
      startDate: new Date("2026-09-15T00:00:00.000Z"),
      startingSalary: "82000.00",
      feePercent: "25.00",
      guaranteeDays: 90,
      status: "pending_start",
    })
    .returning();
  const feeEvent = await recordPlacementFeeEvent({ actor, placementId: placement.id });
  assert(feeEvent.fee === 20500, `Expected 20500, got ${feeEvent.fee}`);
  assert(feeEvent.billingEvent.amount === "20500.00", "Placement billing event amount mismatch");

  console.log("TEST 2 — minimum fee respected");
  const [lowOffer] = await db
    .insert(offers)
    .values({
      candidateId: offer.candidateId,
      jobId: job.id,
      searchProjectId: search.id,
      status: "accepted",
      baseSalary: "50000.00",
    })
    .returning();
  const [lowPlacement] = await db
    .insert(placements)
    .values({
      candidateId: offer.candidateId,
      jobId: job.id,
      companyId: searchCompanyId,
      searchProjectId: search.id,
      offerId: lowOffer.id,
      startDate: new Date("2026-09-16T00:00:00.000Z"),
      startingSalary: "50000.00",
      feePercent: "25.00",
      guaranteeDays: 90,
      status: "pending_start",
    })
    .returning();
  const minFee = await recordPlacementFeeEvent({ actor, placementId: lowPlacement.id });
  assert(minFee.minimumFeeApplied, "Minimum fee should apply");
  assert(minFee.fee === 15000, `Expected minimum 15000, got ${minFee.fee}`);

  console.log("TEST 3 — fractional engagement creates recurring schedule");
  const ftp = await engagement("fractional-talent-partner", "Phase 6 fractional");
  const ftpCreated = await createDeliveryProject({
    actor,
    solutionPlanId: ftp.plan.id,
    contractId: ftp.contract.id,
  });
  const ftpSchedules = await db.select().from(billingSchedules).where(eq(billingSchedules.projectId, ftpCreated.project.id));
  assert(ftpSchedules.some((row) => row.billingType === "monthly_recurring"), "Expected monthly recurring schedule");
  assert(ftpSchedules[0]?.recurrence === "monthly", "Expected monthly recurrence");

  console.log("TEST 4 — milestone project creates billing events");
  const wpaClient = await createClient("workforce-pipeline-assessment");
  const wpaDiscovery = await createDiscovery({
    actor,
    companyId: wpaClient.companyId,
    opportunityId: wpaClient.opportunityId,
    serviceCode: "workforce-pipeline-assessment",
    title: "Phase 6 milestone discovery",
    answers: { fixture: "Phase 6 milestone" },
  });
  await approveDiscovery({ actor, discoveryId: wpaDiscovery.id });
  const wpaPlan = await createSolutionPlanFromDiscovery({
    actor,
    discoveryId: wpaDiscovery.id,
    title: "Phase 6 milestone plan",
  });
  await approveSolutionPlanRecord({ actor, solutionPlanId: wpaPlan.id });
  const wpaPack = await createContractPackage({
    actor,
    solutionPlanId: wpaPlan.id,
    serviceCode: "workforce-pipeline-assessment",
    companyId: wpaClient.companyId,
    opportunityId: wpaClient.opportunityId,
  });
  await storeContractBillingTerms({
    actor,
    contractId: wpaPack.contracts[0].id,
    terms: [
      { name: "kickoff", billingType: "milestone", amount: "12000", dueTrigger: "assessment_kickoff" },
      { name: "midpoint", billingType: "milestone", amount: "12000", dueTrigger: "milestone_completed" },
      { name: "final", billingType: "milestone", amount: "16000", dueTrigger: "final_deliverable" },
    ],
  });
  await executeContractManual({ actor, contractId: wpaPack.contracts[0].id, signerName: "Phase 6 Signer" });
  const wpaProject = await createDeliveryProject({
    actor,
    solutionPlanId: wpaPlan.id,
    contractId: wpaPack.contracts[0].id,
  });
  const { listRevenueEvents } = await import("../lib/finance/engine");
  const revenue = await listRevenueEvents(INTERNAL_ORG_ID);
  const milestoneEvents = revenue.filter((row) => row.event.projectId === wpaProject.project.id);
  assert(milestoneEvents.length >= 3, "Expected milestone billing/revenue events from stored contract terms");

  console.log("TEST 5 — invoice maps to external accounting ID");
  const invoice = await createInvoiceFromBillingEvent({
    actor,
    billingEventId: feeEvent.billingEvent.id,
  });
  const mapping = await getQuickBooksAdapter().mockExportInvoice({
    organizationId: INTERNAL_ORG_ID,
    actorUserId: actor.userId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
  });
  assert(mapping.externalId.startsWith("qb-"), "Expected QuickBooks external_records mapping");
  assert(mapping.entityType === "invoice", "Mapping should be invoice entity");

  console.log("TEST 6 — AR aging works");
  await db
    .update(invoices)
    .set({ dueDate: new Date("2026-07-01T00:00:00.000Z"), status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, invoice.id));
  const ar = await accountsReceivableView(INTERNAL_ORG_ID);
  const aged = ar.find((row) => row.invoice.id === invoice.id);
  assert(aged?.agingBucket === "61_90" || aged?.agingBucket === "90_plus" || aged?.agingBucket === "31_60", "Expected an aging bucket");

  console.log("TEST 7 — payment updates invoice balance");
  const paid = await recordPayment({
    actor,
    invoiceId: invoice.id,
    amount: "5000",
    methodSummary: "ACH",
    sourceSystem: "workforceos",
  });
  assert(Number(paid.invoice.balanceDue) < Number(invoice.amount), "Balance should decrease");
  assert(paid.invoice.status === "partially_paid" || paid.invoice.paymentStatus === "partial", "Invoice should be partially paid");

  console.log("TEST 8 — unauthorized finance access blocked");
  let blocked = false;
  try {
    await createInvoiceFromBillingEvent({ actor: reader, billingEventId: minFee.billingEvent.id });
  } catch (error) {
    blocked = error instanceof FinanceError;
  }
  assert(blocked, "Read-only user must not create invoices");

  console.log("TEST 9 — fee override requires approval");
  const override = await requestFeeOverride({
    actor,
    placementId: placement.id,
    amount: "18000",
    reason: "Negotiated client reduction",
  });
  assert(override.adjustment.status === "pending", "Override starts pending");
  let readerBlocked = false;
  try {
    await approveFinanceAdjustment({ actor: reader, adjustmentId: override.adjustment.id });
  } catch (error) {
    readerBlocked = error instanceof FinanceError;
  }
  assert(readerBlocked, "Read-only cannot approve fee override");
  const approved = await approveFinanceAdjustment({ actor, adjustmentId: override.adjustment.id });
  assert(approved.status === "approved", "Managing Partner can approve override");

  console.log("TEST 10 — QuickBooks adapter dev/mock works");
  const qb = await getQuickBooksAdapter().healthCheck();
  assert(qb.configured === false, "Unconfigured QuickBooks must not look like production");
  assert(qb.connectionHealth === "not_configured", "QB health should be not_configured without credentials");

  console.log("TEST 11 — DocuSign adapter dev/mock works");
  const ds = getDocuSignAdapter();
  const envelope = await ds.createEnvelope({ contractId: randomUUID(), title: "Test" });
  assert(envelope.status === "not_configured", "DocuSign without credentials stays not_configured");
  const manual = getEsignAdapter();
  const manualResult = await manual.createEnvelope({ contractId: randomUUID(), title: "Manual" });
  assert(manualResult.status === "manual", "Manual execution remains available");

  console.log("TEST 12 — integration retry/error logging works");
  const failed = await logIntegrationEvent({
    organizationId: INTERNAL_ORG_ID,
    provider: "quickbooks",
    action: "sync",
    status: "failed",
    detail: "Forced failure for Phase 6",
    retryCount: 1,
  });
  const retried = await retryFailedEvent({
    organizationId: INTERNAL_ORG_ID,
    eventId: failed.id,
    actorUserId: actor.userId,
  });
  assert(retried.retryCount === 2, "Retry count should increment");
  assert(retried.status === "queued", "Manual retry should requeue");

  console.log("TEST 13 — O*NET import preserves source/version");
  const onet = await getOnetAdapter().importCatalog({
    organizationId: INTERNAL_ORG_ID,
    actorUserId: actor.userId,
    sourceVersion: "29.0-dev",
    records: [
      {
        onetCode: "17-3023.00",
        title: "Electrical and Electronic Engineering Technologists",
        alternateTitles: ["Electrical Technologist"],
        skills: [{ name: "Circuit Testing", slug: `circuit-testing-${randomUUID().slice(0, 8)}` }],
      },
    ],
  });
  assert(onet.sourceVersion === "29.0-dev", "O*NET source version must persist");
  const [importLog] = await db.select().from(occupationDataImports).where(eq(occupationDataImports.id, onet.id));
  assert(importLog?.source.includes("onet"), "Import log should record O*NET source");

  console.log("TEST 14 — Apollo enrichment does not overwrite approved CRM data silently");
  const apollo = await getApolloAdapter().proposeCompanyEnrichment({
    organizationId: INTERNAL_ORG_ID,
    actorUserId: actor.userId,
    companyId: searchCompanyId,
    proposed: { website: "https://apollo-overwrite.example.test", industry: "Energy" },
  });
  const [beforeApply] = await db.select().from(companies).where(eq(companies.id, searchCompanyId));
  assert(!beforeApply.website || beforeApply.website !== "https://apollo-overwrite.example.test", "Proposal must not apply immediately");
  await db.update(companies).set({ website: "https://approved.example.test", updatedAt: new Date() }).where(eq(companies.id, searchCompanyId));
  await getApolloAdapter().applyEnrichment({
    organizationId: INTERNAL_ORG_ID,
    actorUserId: actor.userId,
    reviewId: apollo.review.id,
    accept: true,
  });
  const [afterApply] = await db.select().from(companies).where(eq(companies.id, searchCompanyId));
  assert(afterApply.website === "https://approved.example.test", "Approved website must not be overwritten");
  const [review] = await db.select().from(enrichmentReviews).where(eq(enrichmentReviews.id, apollo.review.id));
  assert(review.status === "accepted", "Human accept is recorded");

  console.log("TEST 15 — internal Talent Network first rule still passes");
  assert(canOpenExternalSourcing(null) === false, "External sourcing stays blocked until internal search completes");
  assert(canOpenExternalSourcing(new Date()) === true, "External sourcing may open after internal search");

  let unsignedRejected = false;
  try {
    await receiveProviderWebhook({
      provider: "docusign",
      organizationId: INTERNAL_ORG_ID,
      rawBody: JSON.stringify({ eventId: randomUUID(), status: "completed" }),
      signature: null,
    });
  } catch (error) {
    unsignedRejected = error instanceof WebhookError;
  }
  assert(unsignedRejected, "Unsigned webhooks must be rejected");
  const secret = "phase6-webhook-secret";
  process.env.INTEGRATION_WEBHOOK_SECRET = secret;
  const body = JSON.stringify({ eventId: randomUUID(), status: "sent" });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const received = await receiveProviderWebhook({
    provider: "docusign",
    organizationId: INTERNAL_ORG_ID,
    rawBody: body,
    signature,
  });
  assert(received.replay === false, "First signed webhook should be accepted");

  console.log("Phase 6 acceptance passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
