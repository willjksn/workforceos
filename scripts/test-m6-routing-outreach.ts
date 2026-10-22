import "./load-env";

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateEngagements,
  candidateJobMatches,
  candidates,
  companies,
  companyContacts,
  contacts,
  inAppNotifications,
  interviews,
  jobs,
  opportunityEngagementEvents,
  opportunityEngagementMessages,
  opportunityEngagementRoutes,
  opportunityEngagements,
  organizations,
  submissions,
  transactionalEmailEvents,
  users,
} from "../db/schema";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { opportunityContextLabel } from "../lib/recruiting/opportunity-match";
import {
  EngagementError,
  confirmExternalSend,
  listEngagementQueue,
  markSentManually,
  recordCandidateResponse,
  recordEmployerResponse,
  recordFormalSubmission,
  referToAnotherContact,
  routeToAuthorizedReviewer,
  scheduleEngagementInterview,
  setEngagementFollowUp,
  startEmployerOutreach,
  startEngagement,
  scanEngagementFollowUps,
} from "../lib/recruiting/opportunity-engagement";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  if (/prod/i.test(branch) || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing the M6 routing test against production.");
  }

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const companyA = randomUUID();
  const contactA = randomUUID();
  const contactB = randomUUID();
  const candidateA = randomUUID();
  const candidateC = randomUUID();
  const candidateD = randomUUID();
  const candidateE = randomUUID();
  const clientJob = randomUUID();
  const publicJob = randomUUID();
  const closedJob = randomUUID();
  const fitJob = randomUUID();
  const noFitJob = randomUUID();
  const declineJob = randomUUID();
  const consentJob = randomUUID();
  const otherJob = randomUUID();
  const ids = {
    client: randomUUID(),
    public: randomUUID(),
    closed: randomUUID(),
    fit: randomUUID(),
    noFit: randomUUID(),
    decline: randomUUID(),
    consent: randomUUID(),
    other: randomUUID(),
    civilian: randomUUID(),
  };
  const civilianJob = randomUUID();

  async function cleanup() {
    const orgIds = [orgA, orgB];
    const engagementRows = await db
      .select({ id: opportunityEngagements.id })
      .from(opportunityEngagements)
      .where(inArray(opportunityEngagements.organizationId, orgIds));
    const engagementIds = engagementRows.map((row) => row.id);
    if (engagementIds.length) {
      await db.delete(opportunityEngagementMessages).where(inArray(opportunityEngagementMessages.engagementId, engagementIds));
      await db.delete(opportunityEngagementEvents).where(inArray(opportunityEngagementEvents.engagementId, engagementIds));
      await db.update(opportunityEngagementRoutes).set({ priorRouteId: null }).where(inArray(opportunityEngagementRoutes.engagementId, engagementIds));
      await db.delete(opportunityEngagementRoutes).where(inArray(opportunityEngagementRoutes.engagementId, engagementIds));
      await db.delete(opportunityEngagements).where(inArray(opportunityEngagements.id, engagementIds));
    }
    await db.delete(inAppNotifications).where(inArray(inAppNotifications.organizationId, orgIds));
    await db.delete(transactionalEmailEvents).where(inArray(transactionalEmailEvents.organizationId, orgIds));
    await db.delete(interviews).where(inArray(interviews.candidateId, [candidateA, candidateC, candidateD, candidateE]));
    await db.delete(submissions).where(inArray(submissions.candidateId, [candidateA, candidateC, candidateE]));
    await db.delete(candidateEngagements).where(inArray(candidateEngagements.candidateId, [candidateA, candidateC, candidateE]));
    await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.organizationId, orgIds));
    await db.delete(companyContacts).where(inArray(companyContacts.contactId, [contactA, contactB]));
    await db.delete(contacts).where(inArray(contacts.organizationId, orgIds));
    await db.delete(jobs).where(inArray(jobs.organizationId, orgIds));
    await db.delete(candidates).where(inArray(candidates.organizationId, orgIds));
    await db.delete(companies).where(inArray(companies.organizationId, orgIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, orgIds));
    await db.delete(users).where(inArray(users.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M6 Route A", slug: `m6-a-${suffix}` },
      { id: orgB, name: "M6 Route B", slug: `m6-b-${suffix}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email: `m6-${suffix}@workforceos.test`,
      fullName: "M6 Recruiter",
      status: "active",
    });
    await db.insert(companies).values({ id: companyA, organizationId: orgA, name: "Harbor Instruments", clientStatus: "active" });
    await db.insert(contacts).values([
      { id: contactA, organizationId: orgA, fullName: "Alex Reviewer", email: `alex-${suffix}@harbor.test`, title: "Maintenance manager" },
      { id: contactB, organizationId: orgA, fullName: "Jane Transmission", email: `jane-${suffix}@harbor.test`, title: "Transmission supervisor" },
    ]);
    await db.insert(companyContacts).values([
      { companyId: companyA, contactId: contactA, roleTitle: "Hiring manager" },
      { companyId: companyA, contactId: contactB, roleTitle: "Transmission" },
    ]);
    await db.insert(candidates).values([
      { id: candidateA, organizationId: orgA, fullName: "Navy ET Fixture", city: "Norfolk", consentStatus: "granted", militaryStatus: "veteran", ownerUserId: userA },
      { id: candidateC, organizationId: orgA, fullName: "No Consent Fixture", consentStatus: "unknown", ownerUserId: userA },
      { id: candidateD, organizationId: orgB, fullName: "Other Tenant", consentStatus: "granted" },
      { id: candidateE, organizationId: orgA, fullName: "Casey Nguyen", city: "Austin", consentStatus: "granted", militaryStatus: "none", ownerUserId: userA },
    ]);
    await db.insert(jobs).values([
      { id: clientJob, organizationId: orgA, companyId: companyA, title: "Plant Electrician", status: "open", jobContextType: "client", hiringManagerContactId: contactA, searchOwnerUserId: userA },
      { id: publicJob, organizationId: orgA, companyId: companyA, title: "Instrumentation Technician", status: "open", jobContextType: "monitored_public", hiringManagerContactId: contactA, authorizedEmployerRoute: false },
      { id: closedJob, organizationId: orgA, companyId: companyA, title: "Closed Technician", status: "closed", jobContextType: "client", closedAt: new Date() },
      { id: fitJob, organizationId: orgA, companyId: companyA, title: "Future Fit Technician", status: "open", jobContextType: "client" },
      { id: noFitJob, organizationId: orgA, companyId: companyA, title: "No Fit Technician", status: "open", jobContextType: "client" },
      { id: declineJob, organizationId: orgA, companyId: companyA, title: "Decline Technician", status: "open", jobContextType: "client" },
      { id: consentJob, organizationId: orgA, companyId: companyA, title: "Consent Technician", status: "open", jobContextType: "client" },
      { id: civilianJob, organizationId: orgA, companyId: companyA, title: "Materials Coordinator", status: "open", jobContextType: "monitored_public", authorizedEmployerRoute: false },
      { id: otherJob, organizationId: orgB, title: "Other Tenant Job", status: "open", jobContextType: "client" },
    ]);

    const matchRows = [
      [ids.client, candidateA, clientJob, orgA, "strong_match"],
      [ids.public, candidateA, publicJob, orgA, "possible_match"],
      [ids.closed, candidateA, closedJob, orgA, "strong_match"],
      [ids.fit, candidateA, fitJob, orgA, "possible_match"],
      [ids.noFit, candidateA, noFitJob, orgA, "strong_match"],
      [ids.decline, candidateA, declineJob, orgA, "possible_match"],
      [ids.consent, candidateC, consentJob, orgA, "possible_match"],
      [ids.civilian, candidateE, civilianJob, orgA, "possible_match"],
      [ids.other, candidateD, otherJob, orgB, "strong_match"],
    ] as const;
    await db.insert(candidateJobMatches).values(matchRows.map(([id, candidateId, jobId, organizationId, matchCategory]) => ({
      id,
      organizationId,
      candidateId,
      jobId,
      score: "80.00",
      matchCategory,
      freshness: "current",
      recruiterDisposition: "viable",
      dispositionByUserId: organizationId === orgA ? userA : null,
    })));

    console.log("A — a match does not start itself");
    let blocked = false;
    try {
      await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.client, explicitStart: false });
    } catch (error) {
      blocked = error instanceof EngagementError;
    }
    assert(blocked, "explicit start is required");

    console.log("B — viable match starts an engagement");
    const started = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.client, explicitStart: true });
    assert(started.status === "ready_for_review", "engagement is ready for review");
    assert(started.ownerUserId === userA, "owner is set");

    console.log("C/F — authorized reviewer route records contact, time, owner, job, and candidate");
    const routed = await routeToAuthorizedReviewer({
      organizationId: orgA,
      actorUserId: userA,
      engagementId: started.id,
      contactId: contactA,
      note: "Reviewed by recruiter.",
    });
    assert(routed.route.contactId === contactA, "route stores the contact");
    assert(routed.route.openedAt instanceof Date, "route stores a timestamp");
    assert(routed.engagement.ownerUserId === userA, "owner remains");
    assert(routed.engagement.jobId === clientJob && routed.engagement.candidateId === candidateA, "job and candidate stay on the engagement");
    assert(routed.message.deliveryState === "draft", "route does not send by itself");

    console.log("D — public job rejects client routing");
    const publicStarted = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.public, explicitStart: true });
    let publicBlocked = false;
    try {
      await routeToAuthorizedReviewer({ organizationId: orgA, actorUserId: userA, engagementId: publicStarted.id, contactId: contactA });
    } catch (error) {
      publicBlocked = error instanceof EngagementError && /authorized employer route/.test(error.message);
    }
    assert(publicBlocked, "public routing was rejected");

    console.log("E/U — public outreach is allowed and stays a public opportunity");
    const outreach = await startEmployerOutreach({ organizationId: orgA, actorUserId: userA, engagementId: publicStarted.id, contactId: contactA });
    assert(outreach.engagement.mode === "public_outreach", "mode is public outreach");
    assert(opportunityContextLabel("monitored_public") === "Public opportunity", "public label");
    assert(outreach.draft.body.includes("publicly posted"), "draft does not imply a client submission");

    console.log("P/Q — confirmed send records delivery, and a missing provider stays manual");
    const sent = await confirmExternalSend({
      organizationId: orgA,
      actorUserId: userA,
      engagementId: started.id,
      confirmed: true,
      providerConfigured: true,
      sender: async () => ({ provider: "test", mock: false, providerMessageId: "m6-test", status: "sent" }),
    });
    assert(sent.deliveryState === "sent", "confirmed send records delivery");
    const [mail] = await db.select().from(transactionalEmailEvents).where(and(
      eq(transactionalEmailEvents.organizationId, orgA),
      eq(transactionalEmailEvents.entityId, started.id),
    ));
    assert(mail?.status === "sent" && mail.provider === "test", "delivery log stores the attempt");
    const manual = await confirmExternalSend({
      organizationId: orgA,
      actorUserId: userA,
      engagementId: publicStarted.id,
      confirmed: true,
      providerConfigured: false,
    });
    assert(manual.deliveryState === "not_configured", "missing provider does not pretend to send");
    const publicMail = await db.select().from(transactionalEmailEvents).where(eq(transactionalEmailEvents.entityId, publicStarted.id));
    assert(publicMail.length === 0, "not configured does not write a sent provider event");
    await markSentManually({ organizationId: orgA, actorUserId: userA, engagementId: publicStarted.id, confirmed: true });

    console.log("G/H/I/V — employer responses persist and do not change the match");
    await recordEmployerResponse({ organizationId: orgA, actorUserId: userA, engagementId: started.id, response: "interested", respondedBy: "Alex Reviewer" });
    const fit = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.fit, explicitStart: true });
    await routeToAuthorizedReviewer({ organizationId: orgA, actorUserId: userA, engagementId: fit.id, contactId: contactA });
    await markSentManually({ organizationId: orgA, actorUserId: userA, engagementId: fit.id, confirmed: true });
    await recordEmployerResponse({ organizationId: orgA, actorUserId: userA, engagementId: fit.id, response: "possible_future_fit" });
    const noFit = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.noFit, explicitStart: true });
    await routeToAuthorizedReviewer({ organizationId: orgA, actorUserId: userA, engagementId: noFit.id, contactId: contactA });
    await markSentManually({ organizationId: orgA, actorUserId: userA, engagementId: noFit.id, confirmed: true });
    await recordEmployerResponse({ organizationId: orgA, actorUserId: userA, engagementId: noFit.id, response: "not_a_fit" });
    const [stillStrong] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, ids.noFit));
    assert(stillStrong?.matchCategory === "strong_match", "not a fit leaves the match category");
    const [interested] = await db.select().from(opportunityEngagements).where(eq(opportunityEngagements.id, started.id));
    const [future] = await db.select().from(opportunityEngagements).where(eq(opportunityEngagements.id, fit.id));
    const [declinedEmployer] = await db.select().from(opportunityEngagements).where(eq(opportunityEngagements.id, noFit.id));
    assert(interested?.employerResponse === "interested", "interested persists");
    assert(future?.employerResponse === "possible_future_fit", "possible future fit persists");
    assert(declinedEmployer?.employerResponse === "not_a_fit" && declinedEmployer.status === "no_fit", "not a fit persists");

    console.log("J — referral keeps the original route");
    await referToAnotherContact({ organizationId: orgA, actorUserId: userA, engagementId: started.id, contactId: contactB, note: "Send this to Jane in Transmission." });
    const routes = await db.select().from(opportunityEngagementRoutes).where(eq(opportunityEngagementRoutes.engagementId, started.id));
    assert(routes.length === 2, "referral adds a route");
    const original = routes.find((route) => route.sequence === 1);
    assert(original?.responseStatus === "interested" && original.contactId === contactA, "original response stays");
    assert(routes.some((route) => route.contactId === contactB && route.priorRouteId === original?.id), "next route points at the original");

    console.log("K/L — no response gets a follow-up and overdue appears in the queue");
    await recordEmployerResponse({ organizationId: orgA, actorUserId: userA, engagementId: publicStarted.id, response: "no_response" });
    const [waiting] = await db.select().from(opportunityEngagements).where(eq(opportunityEngagements.id, publicStarted.id));
    assert(waiting?.nextFollowUpAt, "no response stores a follow-up");
    await setEngagementFollowUp({
      organizationId: orgA,
      actorUserId: userA,
      engagementId: publicStarted.id,
      nextFollowUpAt: new Date("2026-10-01T12:00:00Z"),
    });
    const queue = await listEngagementQueue(orgA, userA, new Date("2026-10-22T18:00:00Z"));
    assert(queue.some((row) => row.id === publicStarted.id && row.buckets.includes("overdue")), "overdue follow-up is in the queue");

    console.log("M — the follow-up scan does not send email");
    const before = await db.select({ id: transactionalEmailEvents.id }).from(transactionalEmailEvents).where(eq(transactionalEmailEvents.organizationId, orgA));
    const scan = await scanEngagementFollowUps(new Date("2026-10-22T18:00:00Z"), orgA);
    const after = await db.select({ id: transactionalEmailEvents.id }).from(transactionalEmailEvents).where(eq(transactionalEmailEvents.organizationId, orgA));
    assert(scan.emailsSent === 0 && after.length === before.length, "scan created no email");

    console.log("N — candidate declined stays separate from the employer response");
    const decline = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.decline, explicitStart: true });
    await routeToAuthorizedReviewer({ organizationId: orgA, actorUserId: userA, engagementId: decline.id, contactId: contactA });
    await markSentManually({ organizationId: orgA, actorUserId: userA, engagementId: decline.id, confirmed: true });
    await recordEmployerResponse({ organizationId: orgA, actorUserId: userA, engagementId: decline.id, response: "interested" });
    await recordCandidateResponse({ organizationId: orgA, actorUserId: userA, engagementId: decline.id, response: "declined" });
    const [both] = await db.select().from(opportunityEngagements).where(eq(opportunityEngagements.id, decline.id));
    assert(both?.candidateResponse === "declined" && both.employerResponse === "interested", "candidate response does not replace the employer response");

    console.log("O — sharing without consent is blocked");
    const consent = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.consent, explicitStart: true });
    await routeToAuthorizedReviewer({ organizationId: orgA, actorUserId: userA, engagementId: consent.id, contactId: contactA });
    let consentBlocked = false;
    try {
      await markSentManually({ organizationId: orgA, actorUserId: userA, engagementId: consent.id, confirmed: true });
    } catch (error) {
      consentBlocked = error instanceof EngagementError && /consent/.test(error.message);
    }
    assert(consentBlocked, "consent blocks external sharing");

    console.log("R — interview interest enters the interview table");
    const scheduled = await scheduleEngagementInterview({
      organizationId: orgA,
      actorUserId: userA,
      engagementId: fit.id,
      scheduledFor: new Date("2026-11-02T15:00:00Z"),
    });
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, scheduled.interview.id));
    assert(interview?.status === "scheduled" && interview.jobId === fitJob, "interview row is the existing workflow");

    console.log("S — cross-tenant engagement creation fails");
    let isolated = false;
    try {
      await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.other, explicitStart: true });
    } catch (error) {
      isolated = error instanceof EngagementError;
    }
    assert(isolated, "other organization match cannot start here");

    console.log("T — recruiter still lacks opportunities.read");
    assert(!ROLE_PERMISSIONS.recruiter.includes("opportunities.read"), "recruiter bundle");
    assert(!ROLE_PERMISSIONS.recruiter.includes("scout.external_actions"), "recruiter cannot bypass Scout send");

    console.log("W — closed job cannot start");
    let closedBlocked = false;
    try {
      await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.closed, explicitStart: true });
    } catch (error) {
      closedBlocked = error instanceof EngagementError && /reopened/.test(error.message);
    }
    assert(closedBlocked, "closed job blocked");

    console.log("X — a non-military candidate uses the same workflow");
    const civilian = await startEngagement({ organizationId: orgA, actorUserId: userA, matchId: ids.civilian, explicitStart: true });
    assert(civilian.candidateId === candidateE && civilian.status === "ready_for_review", "civilian engagement started");
    let civilianRouteBlocked = false;
    try {
      await routeToAuthorizedReviewer({ organizationId: orgA, actorUserId: userA, engagementId: civilian.id, contactId: contactA });
    } catch (error) {
      civilianRouteBlocked = error instanceof EngagementError;
    }
    assert(civilianRouteBlocked, "public civilian match still cannot use client routing");

    let leaked = false;
    try {
      await recordFormalSubmission({ organizationId: orgA, actorUserId: userA, engagementId: publicStarted.id, confirmed: true });
    } catch (error) {
      leaked = error instanceof EngagementError && /not a candidate submission/.test(error.message);
    }
    assert(leaked, "public outreach is not a submission");

    console.log("M6 routing smoke passed");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
