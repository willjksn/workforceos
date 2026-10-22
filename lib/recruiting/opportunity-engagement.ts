import { and, desc, eq, inArray, isNull, lte, max, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "../../db";
import {
  candidateClearances,
  candidateCredentials,
  candidateEngagements,
  candidateJobMatchFactors,
  candidateJobMatches,
  candidateSkills,
  candidates,
  companies,
  companyContacts,
  contacts,
  interviews,
  jobs,
  opportunityEngagementEvents,
  opportunityEngagementMessages,
  opportunityEngagementRoutes,
  opportunityEngagements,
  placements,
  skillbridgeProfiles,
  skills,
  submissions,
  transactionalEmailEvents,
  users,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { isTransactionalEmailConfigured, type SendTransactionalInput } from "../email";
import { ResendEmailProvider } from "../email/resend";
import type { SendResult } from "../email/types";
import { getServerEnv } from "../env";
import { createInAppNotification } from "../notifications/service";
import { opportunityContextLabel } from "./opportunity-match";
import {
  CANDIDATE_RESPONSES,
  EMPLOYER_RESPONSES,
  NO_FIT_NEXT_ACTIONS,
  TERMINAL_ENGAGEMENT_STATUSES,
  type CandidateResponse,
  type EmployerResponse,
  type QueueBucket,
  agingDays,
  canAuthorizeEmployerRoute,
  clearanceSharingWording,
  defaultFollowUpAt,
  draftPublicOutreach,
  draftTalentReview,
  employerFacingCapability,
  engagementStartBlock,
  externalDeliveryPlan,
  followUpAlertIntents,
  isTerminalEngagement,
  nextStateForEmployerResponse,
  publicOpportunityLabel,
  queueBuckets,
  sharingBlock,
} from "./engagement-policy";

export class EngagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngagementError";
  }
}

export type EngagementMailSender = (input: SendTransactionalInput) => Promise<SendResult>;

type Actor = { organizationId: string; actorUserId: string };

const TERMINAL = [...TERMINAL_ENGAGEMENT_STATUSES];
const engagementOwners = alias(users, "engagement_owners");

function day(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

async function loadBundle(organizationId: string, matchId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      match: candidateJobMatches,
      candidate: candidates,
      job: jobs,
      companyName: companies.name,
      companyClientStatus: companies.clientStatus,
    })
    .from(candidateJobMatches)
    .innerJoin(candidates, and(
      eq(candidates.id, candidateJobMatches.candidateId),
      eq(candidates.organizationId, organizationId),
    ))
    .innerJoin(jobs, and(eq(jobs.id, candidateJobMatches.jobId), eq(jobs.organizationId, organizationId)))
    .leftJoin(companies, and(eq(companies.id, jobs.companyId), eq(companies.organizationId, organizationId)))
    .where(and(eq(candidateJobMatches.id, matchId), eq(candidateJobMatches.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new EngagementError("Match was not found in this organization.");
  return row;
}

async function assertMatchUntouched(
  organizationId: string,
  matchId: string,
  category: string | null,
  score: string,
) {
  const db = getDb();
  const [row] = await db
    .select({
      matchCategory: candidateJobMatches.matchCategory,
      score: candidateJobMatches.score,
    })
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.id, matchId), eq(candidateJobMatches.organizationId, organizationId)))
    .limit(1);
  if (!row || row.matchCategory !== category || row.score !== score) {
    throw new EngagementError("Engagement must not change the calculated match.");
  }
}

async function resolveOwner(organizationId: string, preferred: Array<string | null>, actorUserId: string) {
  const db = getDb();
  for (const id of [...preferred, actorUserId]) {
    if (!id) continue;
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId), eq(users.status, "active")))
      .limit(1);
    if (user) return user.id;
  }
  throw new EngagementError("An active owner in this organization is required.");
}

async function assertEmployerContact(organizationId: string, companyId: string | null, contactId: string) {
  const db = getDb();
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.organizationId, organizationId), isNull(contacts.archivedAt)))
    .limit(1);
  if (!contact) throw new EngagementError("Contact was not found in this organization.");
  if (contact.doNotContact) throw new EngagementError("This contact is marked do not contact.");
  if (!companyId) throw new EngagementError("This job has no company, so there is no employer contact to use.");
  const [link] = await db
    .select({ id: companyContacts.id })
    .from(companyContacts)
    .where(and(eq(companyContacts.companyId, companyId), eq(companyContacts.contactId, contactId)))
    .limit(1);
  const [jobLink] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(
      eq(jobs.organizationId, organizationId),
      eq(jobs.companyId, companyId),
      eq(jobs.hiringManagerContactId, contactId),
    ))
    .limit(1);
  if (!link && !jobLink) {
    throw new EngagementError("The contact is not linked to this employer.");
  }
  return contact;
}

async function recordWorkflowEvent(input: {
  organizationId: string;
  engagementId: string;
  routeId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  actorUserId: string;
}) {
  const db = getDb();
  await db.insert(opportunityEngagementEvents).values({
    organizationId: input.organizationId,
    engagementId: input.engagementId,
    routeId: input.routeId ?? null,
    eventType: input.eventType,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    note: input.note ?? null,
    actorUserId: input.actorUserId,
  });
}

async function rememberCandidateTouch(input: {
  candidateId: string;
  jobId: string;
  companyId: string | null;
  actorUserId: string;
  subject: string;
  summary: string;
  responseStatus?: string | null;
  nextFollowUpAt?: Date | null;
}) {
  const db = getDb();
  await db.insert(candidateEngagements).values({
    candidateId: input.candidateId,
    engagementType: "note",
    direction: "internal",
    subject: input.subject,
    summary: input.summary,
    userId: input.actorUserId,
    responseStatus: input.responseStatus ?? null,
    relatedCompanyId: input.companyId,
    relatedJobId: input.jobId,
    nextFollowUpAt: input.nextFollowUpAt ?? null,
  });
}

async function nextSequence(engagementId: string) {
  const db = getDb();
  const [row] = await db
    .select({ value: max(opportunityEngagementRoutes.sequence) })
    .from(opportunityEngagementRoutes)
    .where(eq(opportunityEngagementRoutes.engagementId, engagementId));
  return Number(row?.value ?? 0) + 1;
}

async function requireEngagement(organizationId: string, engagementId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(opportunityEngagements)
    .where(and(
      eq(opportunityEngagements.id, engagementId),
      eq(opportunityEngagements.organizationId, organizationId),
      isNull(opportunityEngagements.archivedAt),
    ))
    .limit(1);
  if (!row) throw new EngagementError("Engagement was not found in this organization.");
  return row;
}

async function reviewFacts(organizationId: string, matchId: string, candidateId: string, recruiterNote: string | null) {
  const db = getDb();
  const bundle = await loadBundle(organizationId, matchId);
  const capabilityRows = await db
    .select({
      name: skills.name,
      basis: candidateSkills.capabilityBasis,
      reviewStatus: candidateSkills.reviewStatus,
      source: candidateSkills.source,
    })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(and(
      eq(candidateSkills.organizationId, organizationId),
      eq(candidateSkills.candidateId, candidateId),
      isNull(candidateSkills.archivedAt),
    ));
  const capabilities = capabilityRows
    .map((row) => employerFacingCapability(row))
    .filter((name): name is string => Boolean(name));
  const credentialRows = await db
    .select({ name: candidateCredentials.name, issuer: candidateCredentials.issuer, status: candidateCredentials.status })
    .from(candidateCredentials)
    .where(and(
      eq(candidateCredentials.organizationId, organizationId),
      eq(candidateCredentials.candidateId, candidateId),
      isNull(candidateCredentials.archivedAt),
    ));
  const credentials = credentialRows
    .filter((row) => row.status !== "expired" && row.status !== "revoked")
    .map((row) => row.issuer ? `${row.name} (${row.issuer})` : row.name);
  const [clearance] = await db
    .select({
      level: candidateClearances.clearanceLevel,
      status: candidateClearances.clearanceStatus,
      humanVerified: candidateClearances.humanVerified,
    })
    .from(candidateClearances)
    .where(and(
      eq(candidateClearances.organizationId, organizationId),
      eq(candidateClearances.candidateId, candidateId),
    ))
    .limit(1);
  const factors = await db
    .select({
      group: candidateJobMatchFactors.factorGroup,
      label: candidateJobMatchFactors.label,
    })
    .from(candidateJobMatchFactors)
    .where(and(
      eq(candidateJobMatchFactors.organizationId, organizationId),
      eq(candidateJobMatchFactors.matchId, matchId),
    ));
  const [profile] = await db
    .select({
      branch: skillbridgeProfiles.branch,
      display: skillbridgeProfiles.mosRateAfscDisplay,
      separationDate: skillbridgeProfiles.separationDate,
      etsDate: skillbridgeProfiles.etsDate,
      eaosDate: skillbridgeProfiles.eaosDate,
      endOfServiceDate: skillbridgeProfiles.endOfServiceDate,
    })
    .from(skillbridgeProfiles)
    .where(and(
      eq(skillbridgeProfiles.organizationId, organizationId),
      eq(skillbridgeProfiles.candidateId, candidateId),
    ))
    .limit(1);
  const timing = profile?.separationDate ?? profile?.etsDate ?? profile?.eaosDate ?? profile?.endOfServiceDate ?? null;
  const militaryContext = profile?.branch
    ? [profile.branch.replaceAll("_", " "), profile.display].filter(Boolean).join(" ")
    : null;
  const location = [bundle.candidate.city, bundle.candidate.region].filter(Boolean).join(", ") || null;
  return {
    bundle,
    facts: {
      candidateName: bundle.candidate.fullName,
      location,
      availability: bundle.candidate.availability === "unknown" ? null : bundle.candidate.availability,
      transitionTiming: day(timing),
      capabilities,
      credentials,
      clearanceWording: clearanceSharingWording(clearance ?? null),
      aligned: factors.filter((row) => row.group === "aligned").map((row) => row.label),
      gaps: factors.filter((row) => row.group === "documented_gap").map((row) => row.label),
      jobTitle: bundle.job.title,
      companyName: bundle.companyName,
      recruiterNote,
      militaryContext,
      resumeOnFile: Boolean(bundle.candidate.currentResumeFileId) && bundle.candidate.consentStatus === "granted",
    },
  };
}

export async function startEngagement(input: Actor & { matchId: string; explicitStart: boolean }) {
  const bundle = await loadBundle(input.organizationId, input.matchId);
  const block = engagementStartBlock({
    explicitStart: input.explicitStart,
    freshness: bundle.match.freshness,
    matchCategory: bundle.match.matchCategory,
    disposition: bundle.match.recruiterDisposition,
    jobStatus: bundle.job.status,
    candidatePrivacyDeleted: Boolean(bundle.candidate.privacyDeletedAt),
    candidateArchived: Boolean(bundle.candidate.archivedAt),
    candidateDoNotContact: bundle.candidate.doNotContact,
    candidateAvailability: bundle.candidate.availability,
  });
  if (block) throw new EngagementError(block);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(opportunityEngagements)
    .where(and(
      eq(opportunityEngagements.matchId, input.matchId),
      eq(opportunityEngagements.organizationId, input.organizationId),
    ))
    .limit(1);
  if (existing) return existing;
  const ownerUserId = await resolveOwner(
    input.organizationId,
    [bundle.match.dispositionByUserId, bundle.candidate.ownerUserId, bundle.job.searchOwnerUserId],
    input.actorUserId,
  );
  const [created] = await db
    .insert(opportunityEngagements)
    .values({
      organizationId: input.organizationId,
      matchId: bundle.match.id,
      candidateId: bundle.candidate.id,
      jobId: bundle.job.id,
      companyId: bundle.job.companyId,
      status: "ready_for_review",
      ownerUserId,
      waitingOn: "recruiter",
      nextAction: "Choose authorized routing or employer outreach.",
    })
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: created.id,
    eventType: "engagement_started",
    toStatus: created.status,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.started",
    recordType: "opportunity_engagement",
    recordId: created.id,
    after: { status: created.status, matchId: created.matchId, ownerUserId },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return created;
}

export async function setAuthorizedEmployerRoute(input: Actor & { jobId: string; authorized: boolean }) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, input.jobId), eq(jobs.organizationId, input.organizationId)))
    .limit(1);
  if (!job) throw new EngagementError("Job was not found in this organization.");
  const [updated] = await db
    .update(jobs)
    .set({ authorizedEmployerRoute: input.authorized, updatedAt: new Date() })
    .where(and(eq(jobs.id, job.id), eq(jobs.organizationId, input.organizationId)))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job.authorized_route_set",
    recordType: "job",
    recordId: job.id,
    before: { authorizedEmployerRoute: job.authorizedEmployerRoute, jobContextType: job.jobContextType },
    after: { authorizedEmployerRoute: updated.authorizedEmployerRoute },
  });
  return updated;
}

async function openRoute(input: Actor & {
  engagementId: string;
  contactId: string;
  kind: "talent_review" | "employer_outreach" | "referral";
  mode: "authorized_routing" | "public_outreach";
  note?: string | null;
}) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  if (isTerminalEngagement(engagement.status)) throw new EngagementError("This engagement is already closed.");
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  if (input.mode === "authorized_routing" && !canAuthorizeEmployerRoute({
    jobContextType: bundle.job.jobContextType,
    authorizedEmployerRoute: bundle.job.authorizedEmployerRoute,
    companyId: bundle.job.companyId,
    hiringManagerContactId: bundle.job.hiringManagerContactId,
    companyClientStatus: bundle.companyClientStatus,
  })) {
    throw new EngagementError("This public opportunity has no authorized employer route. Start employer outreach instead.");
  }
  const contact = await assertEmployerContact(input.organizationId, bundle.job.companyId, input.contactId);
  const { facts } = await reviewFacts(
    input.organizationId,
    engagement.matchId,
    engagement.candidateId,
    input.note ?? null,
  );
  const draft = input.mode === "authorized_routing"
    ? draftTalentReview(facts)
    : draftPublicOutreach({
      jobTitle: facts.jobTitle,
      companyName: facts.companyName,
      relevantExperience: facts.aligned[0] ?? facts.capabilities[0] ?? null,
      militaryContext: facts.militaryContext,
      recruiterNote: input.note ?? null,
    });
  const db = getDb();
  const sequence = await nextSequence(engagement.id);
  const [route] = await db
    .insert(opportunityEngagementRoutes)
    .values({
      organizationId: input.organizationId,
      engagementId: engagement.id,
      priorRouteId: engagement.currentRouteId,
      sequence,
      kind: input.kind,
      contactId: contact.id,
    })
    .returning();
  const [message] = await db
    .insert(opportunityEngagementMessages)
    .values({
      organizationId: input.organizationId,
      engagementId: engagement.id,
      routeId: route.id,
      channel: "email",
      contactId: contact.id,
      recipientLabel: contact.fullName,
      subject: draft.subject,
      template: input.mode === "authorized_routing" ? "talent_review" : "employer_outreach",
      body: draft.body,
      deliveryState: "draft",
      actorUserId: input.actorUserId,
    })
    .returning();
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      mode: input.mode,
      status: "ready_for_outreach",
      currentContactId: contact.id,
      currentRouteId: route.id,
      waitingOn: "recruiter",
      nextAction: "Review the draft and confirm before anything is sent.",
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    routeId: route.id,
    eventType: input.kind === "referral" ? "referred" : "draft_prepared",
    fromStatus: engagement.status,
    toStatus: updated.status,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: input.kind === "referral" ? "engagement.referred" : "engagement.outreach_drafted",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { mode: input.mode, routeId: route.id, contactId: contact.id, messageId: message.id },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return { engagement: updated, route, message, draft };
}

export async function routeToAuthorizedReviewer(input: Actor & {
  engagementId: string;
  contactId: string;
  note?: string | null;
}) {
  return openRoute({ ...input, kind: "talent_review", mode: "authorized_routing" });
}

export async function startEmployerOutreach(input: Actor & {
  engagementId: string;
  contactId: string;
  note?: string | null;
}) {
  return openRoute({ ...input, kind: "employer_outreach", mode: "public_outreach" });
}

export async function addManualEmployerContact(input: Actor & {
  companyId: string;
  fullName: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const db = getDb();
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, input.companyId), eq(companies.organizationId, input.organizationId)))
    .limit(1);
  if (!company) throw new EngagementError("Company was not found in this organization.");
  const [contact] = await db
    .insert(contacts)
    .values({
      organizationId: input.organizationId,
      fullName: input.fullName.trim(),
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      ownerUserId: input.actorUserId,
    })
    .returning();
  await db.insert(companyContacts).values({
    companyId: company.id,
    contactId: contact.id,
    roleTitle: input.title ?? null,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.contact_changed",
    recordType: "contact",
    recordId: contact.id,
    after: { companyId: company.id, source: "manual_public" },
  });
  return contact;
}

export async function confirmExternalSend(input: Actor & {
  engagementId: string;
  confirmed: boolean;
  providerConfigured?: boolean;
  sender?: EngagementMailSender;
}) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  if (!engagement.currentRouteId) throw new EngagementError("Prepare a draft before sending.");
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const consentGranted = sharingBlock(bundle.candidate.consentStatus) === null;
  const configured = input.providerConfigured ?? isTransactionalEmailConfigured();
  const plan = externalDeliveryPlan({
    confirmed: input.confirmed,
    providerConfigured: configured,
    consentGranted,
  });
  if (plan.action === "refuse") throw new EngagementError(plan.reason);
  const db = getDb();
  const [message] = await db
    .select()
    .from(opportunityEngagementMessages)
    .where(and(
      eq(opportunityEngagementMessages.engagementId, engagement.id),
      eq(opportunityEngagementMessages.routeId, engagement.currentRouteId),
      eq(opportunityEngagementMessages.organizationId, input.organizationId),
    ))
    .orderBy(desc(opportunityEngagementMessages.draftedAt))
    .limit(1);
  if (!message?.body || !message.subject) throw new EngagementError("The draft is empty.");
  if (plan.action === "manual_only") {
    await db
      .update(opportunityEngagementMessages)
      .set({ deliveryState: "not_configured", provider: "not_configured", updatedAt: new Date() })
      .where(eq(opportunityEngagementMessages.id, message.id));
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: "human", userId: input.actorUserId },
      action: "engagement.send_confirmed",
      recordType: "opportunity_engagement",
      recordId: engagement.id,
      after: { deliveryState: "not_configured", messageId: message.id },
    });
    return { deliveryState: "not_configured" as const, body: message.body, subject: message.subject };
  }
  const contact = engagement.currentContactId
    ? await assertEmployerContact(input.organizationId, engagement.companyId, engagement.currentContactId)
    : null;
  if (!contact?.email) throw new EngagementError("The contact has no email. Mark the outreach sent manually or add an email.");
  const sender = input.sender ?? (async (mail: SendTransactionalInput) => {
    const env = getServerEnv();
    return new ResendEmailProvider(env.RESEND_API_KEY ?? "", env.RESEND_FROM_EMAIL ?? "").sendTransactional(mail);
  });
  const result = await sender({
    organizationId: input.organizationId,
    to: contact.email,
    template: engagement.mode === "authorized_routing" ? "talent_review" : "employer_outreach",
    subject: message.subject,
    text: message.body,
    html: `<pre>${message.body.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] ?? char))}</pre>`,
    entityType: "opportunity_engagement",
    entityId: engagement.id,
  });
  const sent = result.status === "sent";
  const sentAt = sent ? new Date() : null;
  const nextStatus = engagement.mode === "authorized_routing" ? "routed" : "contacted";
  const followUpAt = sent ? defaultFollowUpAt(nextStatus, sentAt ?? new Date()) : engagement.nextFollowUpAt;
  await db.insert(transactionalEmailEvents).values({
    organizationId: input.organizationId,
    provider: result.mock ? "mock" : result.provider,
    template: engagement.mode === "authorized_routing" ? "talent_review" : "employer_outreach",
    recipient: contact.email,
    entityType: "opportunity_engagement",
    entityId: engagement.id,
    status: sent ? "sent" : "failed",
    providerMessageId: result.providerMessageId || null,
    error: result.error ?? null,
    sentAt,
  });
  await db
    .update(opportunityEngagementMessages)
    .set({
      deliveryState: sent ? "sent" : "failed",
      provider: result.provider,
      providerMessageId: result.providerMessageId || null,
      sentAt,
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagementMessages.id, message.id));
  if (sent && sentAt) {
    await db
      .update(opportunityEngagementRoutes)
      .set({ sentAt, followUpAt: followUpAt ?? sentAt, updatedAt: new Date() })
      .where(eq(opportunityEngagementRoutes.id, engagement.currentRouteId));
    await db
      .update(opportunityEngagements)
      .set({
        status: nextStatus,
        waitingOn: "employer",
        nextFollowUpAt: followUpAt ?? sentAt,
        lastActivityAt: sentAt,
        nextAction: "Wait for a response, then record it.",
        updatedAt: new Date(),
      })
      .where(eq(opportunityEngagements.id, engagement.id));
    await rememberCandidateTouch({
      candidateId: engagement.candidateId,
      jobId: engagement.jobId,
      companyId: engagement.companyId,
      actorUserId: input.actorUserId,
      subject: message.subject,
      summary: `External ${nextStatus} message confirmed.`,
      nextFollowUpAt: followUpAt,
    });
  }
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    routeId: engagement.currentRouteId,
    eventType: "external_send_confirmed",
    fromStatus: engagement.status,
    toStatus: sent ? nextStatus : engagement.status,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.send_confirmed",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { deliveryState: sent ? "sent" : "failed", messageId: message.id },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  if (!sent) throw new EngagementError(result.error || "Email delivery failed.");
  return { deliveryState: "sent" as const, body: message.body, subject: message.subject };
}

export async function markSentManually(input: Actor & { engagementId: string; confirmed: boolean }) {
  if (!input.confirmed) throw new EngagementError("External delivery requires explicit confirmation.");
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const block = sharingBlock(bundle.candidate.consentStatus);
  if (block) throw new EngagementError(block);
  if (!engagement.currentRouteId) throw new EngagementError("Prepare a draft before marking it sent.");
  const db = getDb();
  const sentAt = new Date();
  const nextStatus = engagement.mode === "authorized_routing" ? "routed" : "contacted";
  const followUpAt = defaultFollowUpAt(nextStatus, sentAt);
  await db
    .update(opportunityEngagementMessages)
    .set({ deliveryState: "manual_sent", provider: "manual", sentAt, updatedAt: new Date() })
    .where(and(
      eq(opportunityEngagementMessages.routeId, engagement.currentRouteId),
      eq(opportunityEngagementMessages.organizationId, input.organizationId),
    ));
  await db
    .update(opportunityEngagementRoutes)
    .set({ sentAt, followUpAt, updatedAt: new Date() })
    .where(eq(opportunityEngagementRoutes.id, engagement.currentRouteId));
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: nextStatus,
      waitingOn: "employer",
      nextFollowUpAt: followUpAt,
      lastActivityAt: sentAt,
      nextAction: "Wait for a response, then record it.",
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    routeId: engagement.currentRouteId,
    eventType: "marked_sent_manually",
    fromStatus: engagement.status,
    toStatus: nextStatus,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.send_confirmed",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { deliveryState: "manual_sent" },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function recordEmployerResponse(input: Actor & {
  engagementId: string;
  response: EmployerResponse;
  note?: string | null;
  respondedBy?: string | null;
}) {
  if (!EMPLOYER_RESPONSES.includes(input.response)) throw new EngagementError("Response is not recognized.");
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  if (!engagement.currentRouteId) throw new EngagementError("There is no route to attach this response to.");
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const next = nextStateForEmployerResponse(input.response, engagement.status);
  const db = getDb();
  const respondedAt = new Date();
  const followUpAt = input.response === "no_response"
    ? engagement.nextFollowUpAt ?? defaultFollowUpAt(engagement.status, respondedAt)
    : defaultFollowUpAt(next.status, respondedAt) ?? engagement.nextFollowUpAt;
  await db
    .update(opportunityEngagementRoutes)
    .set({
      responseStatus: input.response,
      responseNote: input.note ?? null,
      respondedAt,
      respondedByLabel: input.respondedBy ?? null,
      followUpAt,
      updatedAt: new Date(),
    })
    .where(and(
      eq(opportunityEngagementRoutes.id, engagement.currentRouteId),
      eq(opportunityEngagementRoutes.organizationId, input.organizationId),
    ));
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: next.status,
      employerResponse: input.response,
      waitingOn: next.waitingOn,
      nextFollowUpAt: followUpAt,
      lastActivityAt: respondedAt,
      nextAction: input.response === "not_a_fit"
        ? "Choose a next step. Nothing is sent automatically."
        : input.note ?? engagement.nextAction,
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await rememberCandidateTouch({
    candidateId: engagement.candidateId,
    jobId: engagement.jobId,
    companyId: engagement.companyId,
    actorUserId: input.actorUserId,
    subject: "Employer response",
    summary: input.response.replaceAll("_", " "),
    responseStatus: input.response,
    nextFollowUpAt: followUpAt,
  });
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    routeId: engagement.currentRouteId,
    eventType: "response_recorded",
    fromStatus: engagement.status,
    toStatus: updated.status,
    note: input.note ?? null,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.response_recorded",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { response: input.response, status: updated.status },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function referToAnotherContact(input: Actor & {
  engagementId: string;
  contactId: string;
  note?: string | null;
}) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const authorized = canAuthorizeEmployerRoute({
    jobContextType: bundle.job.jobContextType,
    authorizedEmployerRoute: bundle.job.authorizedEmployerRoute,
    companyId: bundle.job.companyId,
    hiringManagerContactId: bundle.job.hiringManagerContactId,
    companyClientStatus: bundle.companyClientStatus,
  });
  const mode = engagement.mode === "authorized_routing" || engagement.mode === "public_outreach"
    ? engagement.mode
    : authorized
      ? "authorized_routing"
      : "public_outreach";
  if (engagement.currentRouteId) {
    const db = getDb();
    const [current] = await db
      .select({ responseStatus: opportunityEngagementRoutes.responseStatus })
      .from(opportunityEngagementRoutes)
      .where(and(
        eq(opportunityEngagementRoutes.id, engagement.currentRouteId),
        eq(opportunityEngagementRoutes.organizationId, input.organizationId),
      ))
      .limit(1);
    await db
      .update(opportunityEngagementRoutes)
      .set({
        responseStatus: current?.responseStatus ?? "refer_to_another_manager",
        responseNote: current?.responseStatus ? undefined : input.note ?? null,
        respondedAt: current?.responseStatus ? undefined : new Date(),
        updatedAt: new Date(),
        closedAt: new Date(),
      })
      .where(eq(opportunityEngagementRoutes.id, engagement.currentRouteId));
  }
  const opened = await openRoute({
    ...input,
    kind: "referral",
    mode,
  });
  await getDb()
    .update(opportunityEngagements)
    .set({ status: "referred", employerResponse: "refer_to_another_manager", updatedAt: new Date() })
    .where(eq(opportunityEngagements.id, engagement.id));
  return opened;
}

export async function recordCandidateResponse(input: Actor & {
  engagementId: string;
  response: CandidateResponse;
  note?: string | null;
}) {
  if (!CANDIDATE_RESPONSES.includes(input.response)) throw new EngagementError("Candidate response is not recognized.");
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const db = getDb();
  const status = input.response === "declined" ? "withdrawn" : engagement.status;
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      candidateResponse: input.response,
      status,
      waitingOn: input.response === "needs_information" ? "candidate" : "recruiter",
      closedAt: status === "withdrawn" ? new Date() : engagement.closedAt,
      closeReason: status === "withdrawn" ? "candidate_declined" : engagement.closeReason,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await rememberCandidateTouch({
    candidateId: engagement.candidateId,
    jobId: engagement.jobId,
    companyId: engagement.companyId,
    actorUserId: input.actorUserId,
    subject: "Candidate response",
    summary: input.note?.trim() || input.response.replaceAll("_", " "),
    responseStatus: input.response,
  });
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    eventType: "candidate_response_recorded",
    fromStatus: engagement.status,
    toStatus: updated.status,
    note: input.note ?? null,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.response_recorded",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { candidateResponse: input.response, employerResponse: updated.employerResponse },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function setEngagementFollowUp(input: Actor & {
  engagementId: string;
  nextFollowUpAt: Date;
  nextAction?: string | null;
}) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const db = getDb();
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      nextFollowUpAt: input.nextFollowUpAt,
      nextAction: input.nextAction ?? engagement.nextAction,
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.follow_up_changed",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    before: { nextFollowUpAt: engagement.nextFollowUpAt },
    after: { nextFollowUpAt: updated.nextFollowUpAt },
  });
  return updated;
}

export async function setEngagementState(input: Actor & { engagementId: string; status: string; note?: string | null }) {
  const allowed = ["acknowledged", "reviewing", "needs_follow_up", "needs_information", "ready_for_outreach", "no_fit"];
  if (!allowed.includes(input.status)) throw new EngagementError("That state is not set from this action.");
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const followUpAt = defaultFollowUpAt(input.status, new Date()) ?? engagement.nextFollowUpAt;
  const db = getDb();
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: input.status,
      nextFollowUpAt: followUpAt,
      waitingOn: input.status === "needs_information" ? "candidate" : engagement.waitingOn,
      lastActivityAt: new Date(),
      nextAction: input.note ?? engagement.nextAction,
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    eventType: "state_changed",
    fromStatus: engagement.status,
    toStatus: updated.status,
    note: input.note ?? null,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.state_changed",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    before: { status: engagement.status },
    after: { status: updated.status },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function requestEngagementInterview(input: Actor & { engagementId: string; note?: string | null }) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const db = getDb();
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: "interview",
      interviewStatus: "requested",
      waitingOn: "recruiter",
      lastActivityAt: new Date(),
      nextAction: input.note ?? "Schedule the interview in the existing interview record.",
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    eventType: "interview_requested",
    fromStatus: engagement.status,
    toStatus: "interview",
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.interview_started",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { interviewStatus: "requested" },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function scheduleEngagementInterview(input: Actor & {
  engagementId: string;
  scheduledFor: Date;
  format?: string | null;
}) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const db = getDb();
  const [interview] = await db
    .insert(interviews)
    .values({
      candidateId: engagement.candidateId,
      jobId: engagement.jobId,
      submissionId: engagement.submissionId,
      stage: "requested",
      format: input.format ?? "video",
      status: "scheduled",
      scheduledFor: input.scheduledFor,
    })
    .returning();
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: "interview",
      interviewStatus: "scheduled",
      interviewId: interview.id,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    eventType: "interview_scheduled",
    toStatus: "interview",
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.interview_started",
    recordType: "interview",
    recordId: interview.id,
    after: { engagementId: engagement.id, scheduledFor: input.scheduledFor.toISOString() },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return { engagement: updated, interview };
}

export async function completeEngagementInterview(input: Actor & { engagementId: string; outcome: string }) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  if (!engagement.interviewId) throw new EngagementError("Schedule the interview before recording an outcome.");
  const db = getDb();
  await db
    .update(interviews)
    .set({ status: "completed", completedAt: new Date(), outcome: input.outcome, updatedAt: new Date() })
    .where(eq(interviews.id, engagement.interviewId));
  const [updated] = await db
    .update(opportunityEngagements)
    .set({ interviewStatus: "completed", lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.state_changed",
    recordType: "interview",
    recordId: engagement.interviewId,
    after: { interviewStatus: "completed" },
  });
  return updated;
}

export async function recordFormalSubmission(input: Actor & { engagementId: string; confirmed: boolean }) {
  if (!input.confirmed) throw new EngagementError("A formal submission requires explicit confirmation.");
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  if (engagement.mode !== "authorized_routing") {
    throw new EngagementError("Public outreach is not a candidate submission.");
  }
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const block = sharingBlock(bundle.candidate.consentStatus);
  if (block) throw new EngagementError(block);
  const { facts } = await reviewFacts(input.organizationId, engagement.matchId, engagement.candidateId, null);
  const draft = draftTalentReview(facts);
  const db = getDb();
  const [submission] = await db
    .insert(submissions)
    .values({
      candidateId: engagement.candidateId,
      jobId: engagement.jobId,
      matchId: engagement.matchId,
      submittedByUserId: input.actorUserId,
      status: "submitted",
      candidateSummary: draft.body,
      submittedAt: new Date(),
    })
    .returning();
  await db
    .update(opportunityEngagements)
    .set({ submissionId: submission.id, updatedAt: new Date() })
    .where(eq(opportunityEngagements.id, engagement.id));
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.state_changed",
    recordType: "submission",
    recordId: submission.id,
    after: { engagementId: engagement.id, kind: "formal_submission" },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return submission;
}

export async function closeEngagement(input: Actor & { engagementId: string; reason: string }) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const db = getDb();
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: "closed",
      closeReason: input.reason,
      closedAt: new Date(),
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordWorkflowEvent({
    organizationId: input.organizationId,
    engagementId: engagement.id,
    eventType: "closed",
    fromStatus: engagement.status,
    toStatus: "closed",
    note: input.reason,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.closed",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { reason: input.reason },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function markEngagementPlaced(input: Actor & { engagementId: string; placementId?: string | null }) {
  const engagement = await requireEngagement(input.organizationId, input.engagementId);
  const bundle = await loadBundle(input.organizationId, engagement.matchId);
  const db = getDb();
  if (input.placementId) {
    const [placement] = await db
      .select({ id: placements.id, candidateId: placements.candidateId, jobId: placements.jobId })
      .from(placements)
      .where(eq(placements.id, input.placementId))
      .limit(1);
    if (!placement || placement.candidateId !== engagement.candidateId || placement.jobId !== engagement.jobId) {
      throw new EngagementError("Placement was not found for this candidate and job.");
    }
  }
  const [updated] = await db
    .update(opportunityEngagements)
    .set({
      status: "placed",
      placementId: input.placementId ?? null,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opportunityEngagements.id, engagement.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "engagement.state_changed",
    recordType: "opportunity_engagement",
    recordId: engagement.id,
    after: { status: "placed", placementId: input.placementId ?? null },
  });
  await assertMatchUntouched(input.organizationId, bundle.match.id, bundle.match.matchCategory, bundle.match.score);
  return updated;
}

export async function listEmployerContacts(organizationId: string, companyId: string | null, hiringManagerContactId?: string | null) {
  if (!companyId) return [];
  const db = getDb();
  const linked = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      email: contacts.email,
      title: contacts.title,
      roleTitle: companyContacts.roleTitle,
      doNotContact: contacts.doNotContact,
    })
    .from(companyContacts)
    .innerJoin(contacts, and(eq(contacts.id, companyContacts.contactId), eq(contacts.organizationId, organizationId)))
    .where(and(eq(companyContacts.companyId, companyId), isNull(contacts.archivedAt)));
  if (!hiringManagerContactId || linked.some((row) => row.id === hiringManagerContactId)) return linked;
  const [manager] = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      email: contacts.email,
      title: contacts.title,
      doNotContact: contacts.doNotContact,
    })
    .from(contacts)
    .where(and(eq(contacts.id, hiringManagerContactId), eq(contacts.organizationId, organizationId)))
    .limit(1);
  if (!manager) return linked;
  return [...linked, { ...manager, roleTitle: "Hiring manager" }];
}

function summaryFrom(row: {
  engagement: typeof opportunityEngagements.$inferSelect;
  candidateName: string;
  jobTitle: string;
  companyName: string | null;
  contactName: string | null;
  ownerName: string | null;
  jobContextType: string;
  matchCategory: string | null;
}, now: Date) {
  return {
    id: row.engagement.id,
    matchId: row.engagement.matchId,
    candidateId: row.engagement.candidateId,
    jobId: row.engagement.jobId,
    candidateName: row.candidateName,
    jobTitle: row.jobTitle,
    companyName: row.companyName,
    contactName: row.contactName,
    ownerName: row.ownerName,
    status: row.engagement.status,
    mode: row.engagement.mode,
    ownerUserId: row.engagement.ownerUserId,
    employerResponse: row.engagement.employerResponse,
    candidateResponse: row.engagement.candidateResponse,
    waitingOn: row.engagement.waitingOn,
    nextAction: row.engagement.nextAction,
    nextFollowUpAt: row.engagement.nextFollowUpAt,
    lastActivityAt: row.engagement.lastActivityAt,
    agingDays: agingDays(row.engagement.lastActivityAt, now),
    contextLabel: opportunityContextLabel(row.jobContextType),
    publicLabel: publicOpportunityLabel(row.jobContextType),
    matchCategory: row.matchCategory,
    interviewStatus: row.engagement.interviewStatus,
    buckets: queueBuckets({
      status: row.engagement.status,
      waitingOn: row.engagement.waitingOn,
      interviewStatus: row.engagement.interviewStatus,
      employerResponse: row.engagement.employerResponse,
      nextFollowUpAt: row.engagement.nextFollowUpAt,
    }, now) as QueueBucket[],
  };
}

const summarySelection = {
  engagement: opportunityEngagements,
  candidateName: candidates.fullName,
  jobTitle: jobs.title,
  companyName: companies.name,
  contactName: contacts.fullName,
  ownerName: engagementOwners.fullName,
  jobContextType: jobs.jobContextType,
  matchCategory: candidateJobMatches.matchCategory,
};

function summaryQuery() {
  return getDb()
    .select(summarySelection)
    .from(opportunityEngagements)
    .innerJoin(candidates, and(
      eq(candidates.id, opportunityEngagements.candidateId),
      eq(candidates.organizationId, opportunityEngagements.organizationId),
    ))
    .innerJoin(jobs, and(
      eq(jobs.id, opportunityEngagements.jobId),
      eq(jobs.organizationId, opportunityEngagements.organizationId),
    ))
    .innerJoin(candidateJobMatches, and(
      eq(candidateJobMatches.id, opportunityEngagements.matchId),
      eq(candidateJobMatches.organizationId, opportunityEngagements.organizationId),
    ))
    .leftJoin(companies, and(
      eq(companies.id, opportunityEngagements.companyId),
      eq(companies.organizationId, opportunityEngagements.organizationId),
    ))
    .leftJoin(contacts, and(
      eq(contacts.id, opportunityEngagements.currentContactId),
      eq(contacts.organizationId, opportunityEngagements.organizationId),
    ))
    .leftJoin(engagementOwners, and(
      eq(engagementOwners.id, opportunityEngagements.ownerUserId),
      eq(engagementOwners.organizationId, opportunityEngagements.organizationId),
    ));
}

export async function listCandidateEngagements(organizationId: string, candidateId: string, now = new Date()) {
  const rows = await summaryQuery().where(and(
    eq(opportunityEngagements.organizationId, organizationId),
    eq(opportunityEngagements.candidateId, candidateId),
    isNull(opportunityEngagements.archivedAt),
  ));
  return rows.map((row) => summaryFrom(row, now));
}

export async function listJobEngagements(organizationId: string, jobId: string, now = new Date()) {
  const rows = await summaryQuery().where(and(
    eq(opportunityEngagements.organizationId, organizationId),
    eq(opportunityEngagements.jobId, jobId),
    isNull(opportunityEngagements.archivedAt),
  ));
  return rows.map((row) => summaryFrom(row, now));
}

export async function listEngagementQueue(organizationId: string, ownerUserId: string | null, now = new Date()) {
  const filters = [
    eq(opportunityEngagements.organizationId, organizationId),
    isNull(opportunityEngagements.archivedAt),
    notInArray(opportunityEngagements.status, TERMINAL),
  ];
  if (ownerUserId) filters.push(eq(opportunityEngagements.ownerUserId, ownerUserId));
  const rows = await summaryQuery().where(and(...filters));
  return rows.map((row) => summaryFrom(row, now));
}

export async function getEngagementDetail(organizationId: string, engagementId: string, now = new Date()) {
  const [row] = await summaryQuery().where(and(
    eq(opportunityEngagements.id, engagementId),
    eq(opportunityEngagements.organizationId, organizationId),
  )).limit(1);
  if (!row) return null;
  const db = getDb();
  const [routes, messages, events, bundle] = await Promise.all([
    db.select().from(opportunityEngagementRoutes).where(and(
      eq(opportunityEngagementRoutes.engagementId, engagementId),
      eq(opportunityEngagementRoutes.organizationId, organizationId),
    )).orderBy(opportunityEngagementRoutes.sequence),
    db.select().from(opportunityEngagementMessages).where(and(
      eq(opportunityEngagementMessages.engagementId, engagementId),
      eq(opportunityEngagementMessages.organizationId, organizationId),
    )).orderBy(desc(opportunityEngagementMessages.draftedAt)),
    db.select().from(opportunityEngagementEvents).where(and(
      eq(opportunityEngagementEvents.engagementId, engagementId),
      eq(opportunityEngagementEvents.organizationId, organizationId),
    )).orderBy(opportunityEngagementEvents.occurredAt),
    loadBundle(organizationId, row.engagement.matchId),
  ]);
  return {
    summary: summaryFrom(row, now),
    engagement: row.engagement,
    routes,
    messages,
    events,
    authorizedRoute: canAuthorizeEmployerRoute({
      jobContextType: bundle.job.jobContextType,
      authorizedEmployerRoute: bundle.job.authorizedEmployerRoute,
      companyId: bundle.job.companyId,
      hiringManagerContactId: bundle.job.hiringManagerContactId,
      companyClientStatus: bundle.companyClientStatus,
    }),
    jobContextType: bundle.job.jobContextType,
    companyId: bundle.job.companyId,
    consentStatus: bundle.candidate.consentStatus,
    noFitActions: NO_FIT_NEXT_ACTIONS,
  };
}

export async function scanEngagementFollowUps(now = new Date(), organizationId?: string) {
  const db = getDb();
  const filters = [
    isNull(opportunityEngagements.archivedAt),
    lte(opportunityEngagements.nextFollowUpAt, now),
    notInArray(opportunityEngagements.status, TERMINAL),
  ];
  if (organizationId) filters.push(eq(opportunityEngagements.organizationId, organizationId));
  const rows = await db
    .select({
      id: opportunityEngagements.id,
      organizationId: opportunityEngagements.organizationId,
      ownerUserId: opportunityEngagements.ownerUserId,
      status: opportunityEngagements.status,
      candidateName: candidates.fullName,
      nextFollowUpAt: opportunityEngagements.nextFollowUpAt,
      employerResponse: opportunityEngagements.employerResponse,
    })
    .from(opportunityEngagements)
    .innerJoin(candidates, and(
      eq(candidates.id, opportunityEngagements.candidateId),
      eq(candidates.organizationId, opportunityEngagements.organizationId),
    ))
    .where(and(...filters));
  const intents = followUpAlertIntents(rows, now);
  let created = 0;
  for (const intent of intents) {
    const source = rows.find((row) => row.id === intent.engagementId);
    if (!source) continue;
    const notification = await createInAppNotification({
      organizationId: source.organizationId,
      userId: intent.userId,
      kind: intent.kind,
      title: intent.title,
      href: `/app/jobs/engagements/${intent.engagementId}`,
      recordType: "opportunity_engagement",
      recordId: intent.engagementId,
    });
    if (notification) created += 1;
  }
  return { created, emailsSent: 0 as const, considered: intents.length };
}

export async function engagementsByMatch(organizationId: string, matchIds: string[]) {
  if (!matchIds.length) return new Map<string, { id: string; matchId: string; status: string }>();
  const db = getDb();
  const rows = await db
    .select({ id: opportunityEngagements.id, matchId: opportunityEngagements.matchId, status: opportunityEngagements.status })
    .from(opportunityEngagements)
    .where(and(
      eq(opportunityEngagements.organizationId, organizationId),
      inArray(opportunityEngagements.matchId, matchIds),
    ));
  return new Map(rows.map((row) => [row.matchId, row]));
}