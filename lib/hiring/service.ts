import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  activities,
  applicationAnswers,
  applicationPreEmploymentChecks,
  applicationStageHistory,
  applications,
  backgroundChecks,
  candidateDedupeFlags,
  candidates,
  companies,
  drugScreens,
  employees,
  files,
  interviewCalendarEvents,
  interviewPlanStages,
  interviewPlans,
  interviewScorecards,
  interviews,
  jobDescriptionVersions,
  jobPostings,
  jobRequisitions,
  jobs,
  offers,
  onboardingInstances,
  onboardingTasks,
  onboardingTemplateTasks,
  onboardingTemplates,
  prehireRecords,
  scorecardResponses,
  skillbridgeProfiles,
  transactionalEmailEvents,
  users,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { approveRequest, requestApproval } from "../approvals/service";
import { getBackgroundCheckProvider } from "../background-checks";
import { getCalendarProvider } from "../calendar";
import { getDrugScreenProvider } from "../drug-screens";
import { getEmailProvider } from "../email";
import { createInAppNotification } from "../notifications/service";
import { presentCandidate } from "../privacy/present-candidate";
import { can, requirePermission, type Principal } from "../rbac/permissions";
import { createJobWithInternalSearch } from "../repositories/recruiting";
import { createSkillBridgeOpportunity, createSkillBridgeProfile } from "../skillbridge/service";
import { getStorageProvider } from "../storage";
import { resumeStorageFailureMessage } from "../storage/diagnostics";
import { tryApplyResumeToCandidate } from "../talent/apply-resume";
import { matchExistingCandidate, normalizeEmail } from "./dedupe";
import { sanitizeResumeFilename, validateResumeUpload } from "./files";
import { assertDispositionReason, defaultPipelineName, type JobContextType } from "./stages";
import {
  applicationReceivedEmail,
  interviewInvitationEmail,
  interviewReminderEmail,
  offerNoticeEmail,
  onboardingWelcomeEmail,
  skillbridgePublicDisclaimer,
} from "./templates";

export class HiringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HiringError";
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "role"
  );
}

async function recordEmailEvent(input: {
  organizationId: string;
  provider: string;
  template: string;
  recipient: string;
  entityType?: string;
  entityId?: string;
  status: "queued" | "sent" | "delivered" | "failed" | "bounced";
  providerMessageId?: string | null;
  error?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(transactionalEmailEvents)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      template: input.template,
      recipient: input.recipient,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
      sentAt: input.status === "sent" || input.status === "delivered" ? new Date() : null,
    })
    .returning();
  return row;
}

function emailRecordStatus(status: "queued" | "sent" | "failed") {
  return status === "failed" ? ("failed" as const) : ("sent" as const);
}

export async function listRequisitions(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(jobRequisitions)
    .where(eq(jobRequisitions.organizationId, organizationId))
    .orderBy(desc(jobRequisitions.updatedAt));
}

export async function createRequisition(input: {
  principal: Principal;
  title: string;
  department?: string | null;
  employmentType?: string | null;
  location?: string | null;
  workplaceType?: string | null;
  headcount?: number;
  reason?: string | null;
  hiringManagerUserId?: string | null;
  recruiterUserId?: string | null;
  companyId?: string | null;
}) {
  requirePermission(input.principal, "jobs.create");
  const db = getDb();
  const [row] = await db
    .insert(jobRequisitions)
    .values({
      organizationId: input.principal.organizationId,
      title: input.title,
      department: input.department ?? null,
      employmentType: input.employmentType ?? null,
      location: input.location ?? null,
      workplaceType: input.workplaceType ?? null,
      headcount: input.headcount ?? 1,
      reason: input.reason ?? null,
      hiringManagerUserId: input.hiringManagerUserId ?? null,
      recruiterUserId: input.recruiterUserId ?? input.principal.id,
      companyId: input.companyId ?? null,
      createdByUserId: input.principal.id,
      status: "draft",
      approvalStatus: "draft",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "job_requisition.created",
    recordType: "job_requisition",
    recordId: row.id,
    after: { title: row.title, status: row.status },
  });
  return row;
}

export async function submitRequisitionForApproval(input: { principal: Principal; requisitionId: string }) {
  requirePermission(input.principal, "jobs.create");
  const db = getDb();
  const [req] = await db.select().from(jobRequisitions).where(eq(jobRequisitions.id, input.requisitionId)).limit(1);
  if (!req || req.organizationId !== input.principal.organizationId) throw new HiringError("Requisition not found");
  const approval = await requestApproval({
    organizationId: input.principal.organizationId,
    recordType: "job_requisition",
    recordId: req.id,
    approvalType: "requisition",
    requestingUserId: input.principal.id,
  });
  const [updated] = await db
    .update(jobRequisitions)
    .set({ status: "pending_approval", approvalStatus: "pending", updatedAt: new Date() })
    .where(eq(jobRequisitions.id, req.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "job_requisition.approval_requested",
    recordType: "job_requisition",
    recordId: req.id,
    after: { approvalId: approval.id },
  });
  return { requisition: updated, approval };
}

export async function approveRequisition(input: { principal: Principal; requisitionId: string; approvalId: string }) {
  requirePermission(input.principal, "jobs.approve");
  await approveRequest(input.approvalId, input.principal.id, "Requisition approved");
  const db = getDb();
  const [updated] = await db
    .update(jobRequisitions)
    .set({ status: "approved", approvalStatus: "approved", updatedAt: new Date() })
    .where(eq(jobRequisitions.id, input.requisitionId))
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "job_requisition.approved",
    recordType: "job_requisition",
    recordId: input.requisitionId,
  });
  return updated;
}

export async function createJobFromRequisition(input: {
  principal: Principal;
  requisitionId: string;
  jobContextType?: JobContextType;
  skillbridgeEligible?: boolean;
}) {
  requirePermission(input.principal, "jobs.write");
  const db = getDb();
  const [req] = await db.select().from(jobRequisitions).where(eq(jobRequisitions.id, input.requisitionId)).limit(1);
  if (!req || req.organizationId !== input.principal.organizationId) throw new HiringError("Requisition not found");
  if (req.status !== "approved" && req.status !== "open") {
    throw new HiringError("Requisition must be approved before a job is created.");
  }
  const context = input.jobContextType ?? (req.companyId ? "client" : "internal");
  const created = await createJobWithInternalSearch({
    organizationId: input.principal.organizationId,
    actorUserId: input.principal.id,
    title: req.title,
    companyId: req.companyId,
    description: req.reason,
    employmentType: req.employmentType,
    workplaceType: req.workplaceType,
    locationLabel: req.location,
    compensationMin: req.compensationMin,
    compensationMax: req.compensationMax,
    searchOwnerUserId: req.recruiterUserId ?? input.principal.id,
    status: "draft",
  });
  await db
    .update(jobs)
    .set({
      jobContextType: context,
      department: req.department,
      postingVisibility: "internal_only",
      clientVisibility: context === "client" ? "confidential" : "internal_only",
      skillbridgeEligible: input.skillbridgeEligible ?? context === "skillbridge",
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, created.job.id));
  const [fresh] = await db.select().from(jobs).where(eq(jobs.id, created.job.id)).limit(1);
  return fresh;
}

export async function saveJobDescriptionVersion(input: {
  principal: Principal;
  jobId: string;
  content: string;
  aiGenerated?: boolean;
  aiModel?: string | null;
}) {
  requirePermission(input.principal, "jobs.write");
  const db = getDb();
  const versions = await db.select().from(jobDescriptionVersions).where(eq(jobDescriptionVersions.jobId, input.jobId));
  const version = versions.length + 1;
  const [row] = await db
    .insert(jobDescriptionVersions)
    .values({
      jobId: input.jobId,
      version,
      content: input.content,
      createdByUserId: input.principal.id,
      aiGenerated: input.aiGenerated ?? false,
      aiModel: input.aiModel ?? null,
      status: "draft",
    })
    .returning();
  await db.update(jobs).set({ description: input.content, updatedAt: new Date() }).where(eq(jobs.id, input.jobId));
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "job_description.version_saved",
    recordType: "job_description_version",
    recordId: row.id,
    after: { version, aiGenerated: row.aiGenerated },
  });
  return row;
}

export async function approveJobDescriptionVersion(input: { principal: Principal; versionId: string }) {
  requirePermission(input.principal, "jobs.approve");
  const db = getDb();
  const [row] = await db
    .update(jobDescriptionVersions)
    .set({
      status: "approved",
      approvedByUserId: input.principal.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobDescriptionVersions.id, input.versionId))
    .returning();
  return row;
}

export async function publishJob(input: {
  principal: Principal;
  jobId: string;
  publicTitle?: string;
  publicDescription?: string;
  visibility?: "public" | "unlisted" | "internal_only";
  clientVisibility?: "public" | "confidential" | "internal_only";
  companyDisplay?: string | null;
  salaryDisplay?: string | null;
  expiresAt?: Date | null;
}) {
  requirePermission(input.principal, "jobs.publish");
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
  if (!job || job.organizationId !== input.principal.organizationId) throw new HiringError("Job not found");
  const [latest] = await db
    .select()
    .from(jobDescriptionVersions)
    .where(eq(jobDescriptionVersions.jobId, job.id))
    .orderBy(desc(jobDescriptionVersions.version))
    .limit(1);
  if (latest?.aiGenerated && latest.status !== "approved") {
    throw new HiringError("AI-generated job descriptions require human approval before publishing.");
  }
  const visibility = input.visibility ?? "public";
  const slugBase = slugify(input.publicTitle ?? job.title);
  let slug = slugBase;
  let n = 1;
  while (true) {
    const [clash] = await db
      .select()
      .from(jobPostings)
      .where(and(eq(jobPostings.organizationId, job.organizationId), eq(jobPostings.slug, slug)))
      .limit(1);
    if (!clash) break;
    n += 1;
    slug = `${slugBase}-${n}`;
  }
  const description = input.publicDescription ?? latest?.content ?? job.description ?? job.title;
  const [company] = job.companyId
    ? await db.select().from(companies).where(eq(companies.id, job.companyId)).limit(1)
    : [null];
  const clientVisibility = input.clientVisibility ?? job.clientVisibility;
  const companyDisplay =
    clientVisibility === "confidential" || clientVisibility === "internal_only"
      ? input.companyDisplay ?? "Confidential client"
      : input.companyDisplay ?? company?.name ?? "PierOne Partners";
  const [posting] = await db
    .insert(jobPostings)
    .values({
      organizationId: job.organizationId,
      jobId: job.id,
      slug,
      publicTitle: input.publicTitle ?? job.title,
      publicDescription: description,
      location: job.locationLabel,
      workplaceType: job.workplaceType,
      employmentType: job.employmentType,
      salaryDisplay: input.salaryDisplay ?? null,
      companyDisplay,
      visibility,
      clientVisibility,
      publicStatus: visibility === "public" || visibility === "unlisted" ? "published" : "internal",
      publishedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
      applicationOpen: visibility !== "internal_only",
      skillbridgeEligible: job.skillbridgeEligible || job.jobContextType === "skillbridge",
      skillbridgeDisclaimer: job.jobContextType === "skillbridge" ? skillbridgePublicDisclaimer() : null,
    })
    .returning();
  await db
    .update(jobs)
    .set({
      publicSlug: slug,
      postingVisibility: visibility,
      clientVisibility,
      status: job.status === "draft" ? "open" : job.status,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
  await recordAuditEvent({
    organizationId: job.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "job.published",
    recordType: "job_posting",
    recordId: posting.id,
    after: { slug, visibility, clientVisibility },
  });
  return posting;
}

export async function closeJob(input: { principal: Principal; jobId: string }) {
  requirePermission(input.principal, "jobs.close");
  const db = getDb();
  await db.update(jobs).set({ status: "closed", postingVisibility: "closed", updatedAt: new Date() }).where(eq(jobs.id, input.jobId));
  await db
    .update(jobPostings)
    .set({ applicationOpen: false, publicStatus: "closed", visibility: "closed", updatedAt: new Date() })
    .where(eq(jobPostings.jobId, input.jobId));
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "job.closed",
    recordType: "job",
    recordId: input.jobId,
  });
}

export function toPublicJob(posting: typeof jobPostings.$inferSelect, job: typeof jobs.$inferSelect) {
  const confidential = posting.clientVisibility !== "public";
  return {
    slug: posting.slug,
    title: posting.publicTitle,
    description: posting.publicDescription,
    location: posting.location,
    workplaceType: posting.workplaceType,
    employmentType: posting.employmentType,
    salaryDisplay: posting.salaryDisplay,
    companyDisplay: confidential ? posting.companyDisplay ?? "Confidential client" : posting.companyDisplay,
    publishedAt: posting.publishedAt,
    expiresAt: posting.expiresAt,
    skillbridgeEligible: posting.skillbridgeEligible,
    skillbridgeDisclaimer: posting.skillbridgeDisclaimer,
    jobContextType: job.jobContextType,
    applicationOpen: posting.applicationOpen && job.status !== "closed" && job.status !== "cancelled" && job.status !== "filled",
    clientName: confidential ? null : posting.companyDisplay,
    compensationMin: null,
    compensationMax: null,
    hiringManager: null,
    recruiter: null,
    internalNotes: null,
  };
}

export async function listPublicJobs() {
  const db = getDb();
  const rows = await db
    .select({ posting: jobPostings, job: jobs })
    .from(jobPostings)
    .innerJoin(jobs, eq(jobs.id, jobPostings.jobId))
    .where(
      and(
        eq(jobPostings.visibility, "public"),
        eq(jobPostings.applicationOpen, true),
        eq(jobPostings.publicStatus, "published"),
        isNull(jobs.archivedAt),
      ),
    )
    .orderBy(desc(jobPostings.publishedAt));
  return rows
    .filter((row) => !row.posting.expiresAt || row.posting.expiresAt > new Date())
    .map((row) => toPublicJob(row.posting, row.job));
}

export async function getPublicJobBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({ posting: jobPostings, job: jobs })
    .from(jobPostings)
    .innerJoin(jobs, eq(jobs.id, jobPostings.jobId))
    .where(eq(jobPostings.slug, slug))
    .limit(1);
  if (!row) return null;
  if (row.posting.visibility !== "public" && row.posting.visibility !== "unlisted") return null;
  return { ...toPublicJob(row.posting, row.job), posting: row.posting, job: row.job };
}

export type PublicApplicationInput = {
  slug: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  source?: typeof applications.$inferInsert.source;
  answers?: Array<{ key: string; answer: string }>;
  resume?: { filename: string; mimeType: string; body: Uint8Array } | null;
  honeypot?: string | null;
  branch?: string | null;
  mos?: string | null;
  rank?: string | null;
  installation?: string | null;
  skillbridgeWindow?: string | null;
  ip?: string | null;
};

export async function submitPublicApplication(input: PublicApplicationInput) {
  if (input.honeypot) throw new HiringError("Application rejected.");
  const found = await getPublicJobBySlug(input.slug);
  if (!found) throw new HiringError("Job not found.");
  const { posting, job } = found;
  if (!posting.applicationOpen || job.status === "closed" || job.status === "cancelled" || job.status === "filled") {
    throw new HiringError("This job is not accepting applications.");
  }
  if (posting.expiresAt && posting.expiresAt < new Date()) {
    throw new HiringError("This job is not accepting applications.");
  }
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) throw new HiringError("A valid email is required.");
  const db = getDb();
  const recent = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(
      and(
        eq(applications.jobId, job.id),
        sql`lower(${candidates.email}) = ${email}`,
        gte(applications.appliedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(1);
  if (recent[0]) throw new HiringError("An application for this job was already submitted recently.");

  const match = await matchExistingCandidate({
    organizationId: job.organizationId,
    email,
    phone: input.phone,
  });
  let candidateId: string;
  let duplicateReviewRequired = false;
  if (match.kind === "matched") {
    candidateId = match.candidateId;
  } else {
    const [created] = await db
      .insert(candidates)
      .values({
        organizationId: job.organizationId,
        fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
        email,
        phone: input.phone ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        source: input.source ?? "career_site",
        militaryStatus: job.jobContextType === "skillbridge" ? "veteran" : "unknown",
      })
      .returning();
    candidateId = created.id;
    if (match.kind === "ambiguous") {
      duplicateReviewRequired = true;
      await db.insert(candidateDedupeFlags).values({
        organizationId: job.organizationId,
        candidateIds: match.candidateIds,
        reason: match.reason,
        status: "pending_review",
      });
    }
  }

  let resumeFileId: string | null = null;
  if (input.resume) {
    const checked = validateResumeUpload({
      filename: input.resume.filename,
      mimeType: input.resume.mimeType,
      sizeBytes: input.resume.body.byteLength,
      body: input.resume.body,
    });
    const storage = getStorageProvider();
    const safeName = sanitizeResumeFilename(input.resume.filename);
    const key = `applications/${job.organizationId}/${candidateId}/${Date.now()}-${safeName}`;
    let stored;
    try {
      stored = await storage.upload({
        key,
        body: input.resume.body,
        mimeType: checked.mimeType,
        filename: safeName,
      });
    } catch (error) {
      throw new HiringError(resumeStorageFailureMessage(error));
    }
    const [file] = await db
      .insert(files)
      .values({
        organizationId: job.organizationId,
        storageProvider: storage.name,
        storageKey: stored.key,
        filename: input.resume.filename,
        mimeType: checked.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum ?? null,
        privacyClass: "restricted_pii",
      })
      .returning();
    resumeFileId = file.id;
    await db.update(candidates).set({ currentResumeFileId: file.id, updatedAt: new Date() }).where(eq(candidates.id, candidateId));
  }

  const pipeline = defaultPipelineName(job.jobContextType);
  const [application] = await db
    .insert(applications)
    .values({
      organizationId: job.organizationId,
      candidateId,
      jobId: job.id,
      jobPostingId: posting.id,
      source: input.source ?? "career_site",
      status: "submitted",
      currentStage: "applied",
      pipeline,
      submittedAt: new Date(),
      lastActivityAt: new Date(),
      recruiterUserId: job.searchOwnerUserId,
      duplicateReviewRequired,
    })
    .returning();

  await db.insert(applicationStageHistory).values({
    applicationId: application.id,
    fromStage: null,
    toStage: "applied",
    source: "public_application",
  });

  const standardAnswers = [
    { key: "first_name", answer: input.firstName },
    { key: "last_name", answer: input.lastName },
    { key: "preferred_name", answer: input.preferredName ?? "" },
    { key: "email", answer: email },
    { key: "phone", answer: input.phone ?? "" },
    ...(input.answers ?? []),
  ];
  for (const answer of standardAnswers) {
    await db.insert(applicationAnswers).values({
      applicationId: application.id,
      questionKey: answer.key,
      answer: answer.answer,
      fileId: answer.key === "resume" ? resumeFileId : null,
    });
  }
  if (resumeFileId) {
    await db.insert(applicationAnswers).values({
      applicationId: application.id,
      questionKey: "resume",
      answer: "uploaded",
      fileId: resumeFileId,
    });
  }

  await db.insert(activities).values({
    organizationId: job.organizationId,
    activityType: "status_change",
    subject: "Application submitted",
    details: `Applied to ${job.title}`,
    candidateId,
    createdByUserId: null,
  });

  let skillbridgeProfileId: string | null = null;
  if (job.jobContextType === "skillbridge") {
    const actor = { organizationId: job.organizationId, userId: job.searchOwnerUserId ?? (await systemUserId(job.organizationId)) };
    const [existingProfile] = await db
      .select()
      .from(skillbridgeProfiles)
      .where(eq(skillbridgeProfiles.candidateId, candidateId))
      .limit(1);
    if (existingProfile) {
      skillbridgeProfileId = existingProfile.id;
    } else {
      const profile = await createSkillBridgeProfile({
        actor,
        candidateId,
        branch: (input.branch as "navy") ?? undefined,
        mosRateAfscDisplay: input.mos ?? undefined,
        rankTitle: input.rank ?? undefined,
        currentDutyLocation: input.installation ?? undefined,
        preferredLocationPrimary: [input.city, input.region].filter(Boolean).join(", ") || undefined,
      });
      skillbridgeProfileId = profile.id;
    }
    if (job.companyId) {
      await createSkillBridgeOpportunity({
        actor,
        profileId: skillbridgeProfileId,
        companyId: job.companyId,
        jobId: job.id,
        stage: "candidate_identified",
        source: "public_application",
      });
    }
  }

  if (resumeFileId && input.resume) {
    await tryApplyResumeToCandidate({
      organizationId: job.organizationId,
      candidateId,
      fileId: resumeFileId,
      filename: input.resume.filename,
      mimeType: input.resume.mimeType,
      body: input.resume.body,
      actor: { type: "system" },
    });
  }

  await recordAuditEvent({
    organizationId: job.organizationId,
    actor: { type: "system" },
    action: "application.submitted",
    recordType: "application",
    recordId: application.id,
    after: { candidateId, jobId: job.id, source: application.source, duplicateReviewRequired },
  });

  if (job.searchOwnerUserId) {
    await createInAppNotification({
      organizationId: job.organizationId,
      userId: job.searchOwnerUserId,
      kind: "application_received",
      title: "New application",
      body: `${input.firstName} ${input.lastName} applied to ${job.title}`,
      href: `/app/recruiting/applications/${application.id}`,
      recordType: "application",
      recordId: application.id,
    });
  }

  const mail = applicationReceivedEmail({ firstName: input.firstName, jobTitle: posting.publicTitle, appliedAt: application.appliedAt });
  const emailResult = await getEmailProvider().sendTransactional({
    organizationId: job.organizationId,
    to: email,
    template: "application_received",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    entityType: "application",
    entityId: application.id,
  });
  await recordEmailEvent({
    organizationId: job.organizationId,
    provider: emailResult.provider,
    template: "application_received",
    recipient: email,
    entityType: "application",
    entityId: application.id,
    status: emailResult.status === "failed" ? "failed" : "sent",
    providerMessageId: emailResult.providerMessageId,
    error: emailResult.error ?? null,
  });

  return { application, candidateId, duplicateReviewRequired, skillbridgeProfileId };
}

async function systemUserId(organizationId: string) {
  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, organizationId)).limit(1);
  return user?.id ?? organizationId;
}

export async function listApplications(input: {
  principal: Principal;
  view?: string;
  jobId?: string;
  stage?: string;
  source?: string;
}) {
  requirePermission(input.principal, "applications.read");
  const db = getDb();
  const conditions = [eq(applications.organizationId, input.principal.organizationId), isNull(applications.archivedAt)];
  if (input.jobId) conditions.push(eq(applications.jobId, input.jobId));
  if (input.stage) conditions.push(eq(applications.currentStage, input.stage));
  if (input.source) {
    conditions.push(eq(applications.source, input.source as typeof applications.$inferSelect.source));
  }
  if (input.view === "needs_review") conditions.push(eq(applications.currentStage, "applied"));
  if (input.view === "mine") conditions.push(eq(applications.recruiterUserId, input.principal.id));
  const rows = await db
    .select({ application: applications, candidate: candidates, job: jobs })
    .from(applications)
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(...conditions))
    .orderBy(desc(applications.appliedAt))
    .limit(100);
  const canPii = can(input.principal, "candidate_pii.read");
  return rows.map((row) => ({
    ...row,
    candidate: presentCandidate(row.candidate, canPii),
  }));
}

export async function getApplicationDetail(principal: Principal, applicationId: string) {
  requirePermission(principal, "applications.read");
  const db = getDb();
  const [row] = await db
    .select({ application: applications, candidate: candidates, job: jobs })
    .from(applications)
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, applicationId), eq(applications.organizationId, principal.organizationId)))
    .limit(1);
  if (!row) throw new HiringError("Application not found");
  const answers = await db.select().from(applicationAnswers).where(eq(applicationAnswers.applicationId, applicationId));
  const history = await db
    .select()
    .from(applicationStageHistory)
    .where(eq(applicationStageHistory.applicationId, applicationId))
    .orderBy(applicationStageHistory.createdAt);
  const canPii = can(principal, "candidate_pii.read");
  const canBg = can(principal, "background_checks.read");
  const canDrug = can(principal, "drug_screens.read");
  const bg = canBg
    ? await db.select().from(backgroundChecks).where(eq(backgroundChecks.applicationId, applicationId))
    : [];
  const drug = canDrug ? await db.select().from(drugScreens).where(eq(drugScreens.applicationId, applicationId)) : [];
  const resumeAnswer = answers.find((item) => item.questionKey === "resume" && item.fileId);
  const resumeFileId = canPii ? (resumeAnswer?.fileId ?? row.candidate.currentResumeFileId) : null;
  let resumeFile: { id: string; filename: string; mimeType: string; sizeBytes: number } | null = null;
  if (resumeFileId) {
    const [file] = await db.select().from(files).where(eq(files.id, resumeFileId)).limit(1);
    if (file && file.organizationId === principal.organizationId) {
      resumeFile = {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      };
    }
  }
  return {
    application: row.application,
    job: row.job,
    candidate: presentCandidate(row.candidate, canPii),
    answers: canPii
      ? answers
      : answers.filter((item) => !["email", "phone", "resume"].includes(item.questionKey)),
    history,
    resumeFile,
    backgroundChecks: bg.map((item) => ({
      id: item.id,
      status: item.status,
      reviewStatus: item.reviewStatus,
      resultSummary: canBg ? item.resultSummary : null,
      provider: item.provider,
    })),
    drugScreens: drug.map((item) => ({
      id: item.id,
      status: item.status,
      resultStatus: canDrug ? item.resultStatus : null,
      notes: null,
      provider: item.provider,
    })),
  };
}

export async function advanceApplication(input: {
  principal: Principal;
  applicationId: string;
  toStage: string;
  reason?: string;
}) {
  requirePermission(input.principal, "applications.advance");
  return changeStage(input.principal, input.applicationId, input.toStage, input.reason, "human");
}

export async function rejectApplication(input: {
  principal: Principal;
  applicationId: string;
  reason: string;
  source?: string;
}) {
  requirePermission(input.principal, "applications.reject");
  assertDispositionReason(input.reason);
  if (input.source === "scout" || input.source === "ai") {
    throw new HiringError("Scout cannot independently reject a candidate. A human must confirm the disposition.");
  }
  const db = getDb();
  const updated = await changeStage(input.principal, input.applicationId, "rejected", input.reason, "human");
  await db
    .update(applications)
    .set({ status: "rejected", disposition: "rejected", dispositionReason: input.reason, updatedAt: new Date() })
    .where(eq(applications.id, input.applicationId));
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "application.rejected",
    recordType: "application",
    recordId: input.applicationId,
    reason: input.reason,
  });
  return updated;
}

export async function nurtureApplication(input: { principal: Principal; applicationId: string }) {
  requirePermission(input.principal, "applications.review");
  return changeStage(input.principal, input.applicationId, "nurture", "nurture", "human");
}

async function changeStage(
  principal: Principal,
  applicationId: string,
  toStage: string,
  reason: string | undefined,
  source: string,
) {
  const db = getDb();
  const [existing] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!existing || existing.organizationId !== principal.organizationId) throw new HiringError("Application not found");
  await db.insert(applicationStageHistory).values({
    applicationId,
    fromStage: existing.currentStage,
    toStage,
    changedByUserId: principal.id,
    reason: reason ?? null,
    source,
  });
  const [updated] = await db
    .update(applications)
    .set({
      currentStage: toStage,
      lastActivityAt: new Date(),
      status: toStage === "hired" ? "hired" : toStage === "withdrawn" ? "withdrawn" : "in_process",
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId))
    .returning();
  await db.insert(activities).values({
    organizationId: principal.organizationId,
    activityType: "status_change",
    subject: `Stage: ${toStage}`,
    candidateId: existing.candidateId,
    createdByUserId: principal.id,
  });
  return updated;
}

export async function createInterviewPlan(input: {
  principal: Principal;
  jobId?: string | null;
  name: string;
  stages: Array<{ name: string; durationMinutes?: number; interviewType?: string }>;
}) {
  requirePermission(input.principal, "interviews.write");
  const db = getDb();
  const [plan] = await db
    .insert(interviewPlans)
    .values({
      organizationId: input.principal.organizationId,
      jobId: input.jobId ?? null,
      name: input.name,
    })
    .returning();
  for (const [index, stage] of input.stages.entries()) {
    await db.insert(interviewPlanStages).values({
      planId: plan.id,
      name: stage.name,
      durationMinutes: stage.durationMinutes ?? 30,
      interviewType: stage.interviewType ?? "video",
      sortOrder: index,
    });
  }
  return plan;
}

export async function scheduleInterview(input: {
  principal: Principal;
  applicationId: string;
  stageName: string;
  start: Date;
  end: Date;
  timezone?: string;
  interviewerUserIds?: string[];
}) {
  requirePermission(input.principal, "interviews.schedule");
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!application || application.organizationId !== input.principal.organizationId) {
    throw new HiringError("Application not found");
  }
  const calendar = getCalendarProvider();
  const event = await calendar.createEvent({
    title: `Interview — ${input.stageName}`,
    start: input.start,
    end: input.end,
    timezone: input.timezone ?? "America/New_York",
    attendees: [],
    description: "WorkforceOS interview",
  });
  const [interview] = await db
    .insert(interviews)
    .values({
      candidateId: application.candidateId,
      jobId: application.jobId,
      applicationId: application.id,
      stage: input.stageName,
      format: "video",
      locationOrLink: event.meetingUrl,
      status: "scheduled",
      scheduledFor: input.start,
    })
    .returning();
  await db.insert(interviewCalendarEvents).values({
    interviewId: interview.id,
    provider: event.provider,
    externalEventId: event.externalEventId,
    calendarOwner: input.principal.id,
    startsAt: event.start,
    endsAt: event.end,
    timezone: event.timezone,
    meetingUrl: event.meetingUrl,
    status: event.status,
  });
  for (const interviewerUserId of input.interviewerUserIds ?? [input.principal.id]) {
    await db.insert(interviewScorecards).values({
      organizationId: input.principal.organizationId,
      interviewId: interview.id,
      applicationId: application.id,
      interviewerUserId,
      status: "pending",
    });
  }
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, application.candidateId)).limit(1);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, application.jobId)).limit(1);
  if (candidate?.email && can(input.principal, "transactional_email.send")) {
    const mail = interviewInvitationEmail({
      firstName: candidate.fullName.split(" ")[0] ?? "there",
      jobTitle: job?.title ?? "the role",
      when: input.start,
    });
    const sent = await getEmailProvider().sendTransactional({
      organizationId: input.principal.organizationId,
      to: candidate.email,
      template: "interview_invitation",
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      entityType: "interview",
      entityId: interview.id,
    });
    await recordEmailEvent({
      organizationId: input.principal.organizationId,
      provider: sent.provider,
      template: "interview_invitation",
      recipient: candidate.email,
      entityType: "interview",
      entityId: interview.id,
      status: emailRecordStatus(sent.status),
      providerMessageId: sent.providerMessageId,
      error: sent.error ?? null,
    });
  }
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "interview.scheduled",
    recordType: "interview",
    recordId: interview.id,
    after: { applicationId: application.id, externalEventId: event.externalEventId },
  });
  return { interview, calendarEvent: event };
}

const interviewReminderKeys = new Set<string>();

export async function sendInterviewReminder(input: { interviewId: string; window?: string }) {
  const key = `interview-reminder:${input.interviewId}:${input.window ?? "default"}`;
  if (interviewReminderKeys.has(key)) return { sent: false, idempotent: true };
  interviewReminderKeys.add(key);
  const db = getDb();
  const [interview] = await db.select().from(interviews).where(eq(interviews.id, input.interviewId)).limit(1);
  if (!interview?.scheduledFor) return { sent: false, idempotent: false };
  const [existing] = await db
    .select()
    .from(transactionalEmailEvents)
    .where(
      and(
        eq(transactionalEmailEvents.entityId, interview.id),
        eq(transactionalEmailEvents.template, "interview_reminder"),
      ),
    )
    .limit(1);
  if (existing) return { sent: false, idempotent: true };
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, interview.candidateId)).limit(1);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, interview.jobId)).limit(1);
  if (!candidate?.email) return { sent: false, idempotent: false };
  const mail = interviewReminderEmail({
    firstName: candidate.fullName.split(" ")[0] ?? "there",
    jobTitle: job?.title ?? "the role",
    when: interview.scheduledFor,
  });
  const sent = await getEmailProvider().sendTransactional({
    organizationId: candidate.organizationId,
    to: candidate.email,
    template: "interview_reminder",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    entityType: "interview",
    entityId: interview.id,
  });
  await recordEmailEvent({
    organizationId: candidate.organizationId,
    provider: sent.provider,
    template: "interview_reminder",
    recipient: candidate.email,
    entityType: "interview",
    entityId: interview.id,
    status: emailRecordStatus(sent.status),
    providerMessageId: sent.providerMessageId,
    error: sent.error ?? null,
  });
  return { sent: sent.status !== "failed", idempotent: false };
}

export function resetInterviewReminderIdempotency() {
  interviewReminderKeys.clear();
}

export async function submitScorecard(input: {
  principal: Principal;
  interviewId: string;
  recommendation: "strong_yes" | "yes" | "mixed" | "no" | "strong_no";
  answers?: Array<{ rating?: number; answer?: string }>;
}) {
  requirePermission(input.principal, "interviews.score");
  const db = getDb();
  const [card] = await db
    .select()
    .from(interviewScorecards)
    .where(
      and(
        eq(interviewScorecards.interviewId, input.interviewId),
        eq(interviewScorecards.interviewerUserId, input.principal.id),
      ),
    )
    .limit(1);
  const [updated] = card
    ? await db
        .update(interviewScorecards)
        .set({
          status: "submitted",
          recommendation: input.recommendation,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(interviewScorecards.id, card.id))
        .returning()
    : await db
        .insert(interviewScorecards)
        .values({
          organizationId: input.principal.organizationId,
          interviewId: input.interviewId,
          interviewerUserId: input.principal.id,
          status: "submitted",
          recommendation: input.recommendation,
          submittedAt: new Date(),
        })
        .returning();
  for (const answer of input.answers ?? []) {
    await db.insert(scorecardResponses).values({
      scorecardId: updated.id,
      rating: answer.rating ?? null,
      answer: answer.answer ?? null,
    });
  }
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "scorecard.submitted",
    recordType: "interview_scorecard",
    recordId: updated.id,
  });
  return updated;
}

export async function listMissingScorecards(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(interviewScorecards)
    .where(and(eq(interviewScorecards.organizationId, organizationId), eq(interviewScorecards.status, "pending")));
}

export async function requestBackgroundCheck(input: { principal: Principal; applicationId: string }) {
  requirePermission(input.principal, "background_checks.request");
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!application) throw new HiringError("Application not found");
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, application.candidateId)).limit(1);
  const provider = getBackgroundCheckProvider();
  const invitation = await provider.createInvitation({
    candidateId: application.candidateId,
    email: candidate?.email ?? "unknown@example.test",
  });
  const [row] = await db
    .insert(backgroundChecks)
    .values({
      organizationId: input.principal.organizationId,
      candidateId: application.candidateId,
      applicationId: application.id,
      jobId: application.jobId,
      provider: invitation.provider,
      providerCandidateId: invitation.providerCandidateId,
      status: "invited",
      requestedAt: new Date(),
      invitationSentAt: new Date(),
      consentStatus: "pending",
      reviewStatus: "pending",
    })
    .returning();
  await db.insert(applicationPreEmploymentChecks).values({
    applicationId: application.id,
    checkType: "background_check",
    status: "invited",
  });
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "background_check.requested",
    recordType: "background_check",
    recordId: row.id,
  });
  return row;
}

export async function applyBackgroundResult(input: {
  principal: Principal;
  backgroundCheckId: string;
  status: "completed" | "review_required" | "cleared" | "adverse_review";
  summary?: string | null;
  autoReject?: boolean;
}) {
  requirePermission(input.principal, "background_checks.review");
  if (input.autoReject) {
    throw new HiringError("Background-check results cannot automatically reject a candidate.");
  }
  const db = getDb();
  const [updated] = await db
    .update(backgroundChecks)
    .set({
      status: input.status,
      resultSummary: input.summary ?? "Provider summary on file. Human review required.",
      completedAt: new Date(),
      reviewStatus: input.status === "cleared" ? "cleared" : "review_required",
      reviewedByUserId: input.principal.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(backgroundChecks.id, input.backgroundCheckId))
    .returning();
  return updated;
}

export async function requestDrugScreen(input: { principal: Principal; applicationId: string }) {
  requirePermission(input.principal, "drug_screens.request");
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!application) throw new HiringError("Application not found");
  const provider = getDrugScreenProvider();
  const order = await provider.createOrder({ candidateId: application.candidateId });
  const [row] = await db
    .insert(drugScreens)
    .values({
      organizationId: input.principal.organizationId,
      candidateId: application.candidateId,
      applicationId: application.id,
      jobId: application.jobId,
      provider: order.provider,
      status: "ordered",
      orderedAt: new Date(),
      reviewRequired: true,
      resultStatus: "pending",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "drug_screen.requested",
    recordType: "drug_screen",
    recordId: row.id,
  });
  return row;
}

export function presentDrugScreen(
  row: typeof drugScreens.$inferSelect,
  principal: Principal,
) {
  if (!can(principal, "drug_screens.read")) {
    return { id: row.id, status: "restricted", resultStatus: null, notes: null };
  }
  return {
    id: row.id,
    status: row.status,
    resultStatus: row.resultStatus,
    notes: null,
    collectionSite: row.collectionSite,
  };
}

export async function createHiringOffer(input: {
  principal: Principal;
  applicationId: string;
  baseSalary?: string | null;
  title?: string | null;
  startDate?: string | null;
  expirationDate?: string | null;
  requireApproval?: boolean;
}) {
  requirePermission(input.principal, "offers.create");
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!application) throw new HiringError("Application not found");
  const existing = await db.select().from(offers).where(eq(offers.applicationId, application.id));
  const version = existing.length + 1;
  const requireApproval = input.requireApproval ?? true;
  const [row] = await db
    .insert(offers)
    .values({
      candidateId: application.candidateId,
      jobId: application.jobId,
      applicationId: application.id,
      status: requireApproval ? "pending_approval" : "draft",
      baseSalary: input.baseSalary ?? null,
      offerDate: new Date().toISOString().slice(0, 10),
      expirationDate: input.expirationDate ?? null,
      notes: input.title ?? null,
      version,
    })
    .returning();
  let approval = null;
  if (requireApproval) {
    approval = await requestApproval({
      organizationId: input.principal.organizationId,
      recordType: "offer",
      recordId: row.id,
      approvalType: "offer",
      requestingUserId: input.principal.id,
    });
  }
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "offer.created",
    recordType: "offer",
    recordId: row.id,
    after: { version, status: row.status },
  });
  return { offer: row, approval };
}

export async function approveHiringOffer(input: { principal: Principal; offerId: string; approvalId: string }) {
  requirePermission(input.principal, "offers.approve");
  await approveRequest(input.approvalId, input.principal.id, "Offer approved");
  const db = getDb();
  const [updated] = await db
    .update(offers)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(offers.id, input.offerId))
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "offer.approved",
    recordType: "offer",
    recordId: input.offerId,
  });
  return updated;
}

export async function sendHiringOffer(input: { principal: Principal; offerId: string }) {
  requirePermission(input.principal, "offers.send");
  const db = getDb();
  const [offer] = await db.select().from(offers).where(eq(offers.id, input.offerId)).limit(1);
  if (!offer) throw new HiringError("Offer not found");
  if (offer.status !== "approved" && offer.status !== "draft") {
    throw new HiringError("Offer must be approved before sending.");
  }
  const [updated] = await db.update(offers).set({ status: "sent", updatedAt: new Date() }).where(eq(offers.id, offer.id)).returning();
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, offer.candidateId)).limit(1);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, offer.jobId)).limit(1);
  if (candidate?.email) {
    const mail = offerNoticeEmail({ firstName: candidate.fullName.split(" ")[0] ?? "there", jobTitle: job?.title ?? "the role" });
    const sent = await getEmailProvider().sendTransactional({
      organizationId: input.principal.organizationId,
      to: candidate.email,
      template: "offer_available",
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      entityType: "offer",
      entityId: offer.id,
    });
    await recordEmailEvent({
      organizationId: input.principal.organizationId,
      provider: sent.provider,
      template: "offer_available",
      recipient: candidate.email,
      entityType: "offer",
      entityId: offer.id,
      status: emailRecordStatus(sent.status),
      providerMessageId: sent.providerMessageId,
      error: sent.error ?? null,
    });
  }
  return updated;
}

export async function acceptHiringOffer(input: { principal: Principal; offerId: string }) {
  requirePermission(input.principal, "offers.write");
  const db = getDb();
  const [offer] = await db.select().from(offers).where(eq(offers.id, input.offerId)).limit(1);
  if (!offer) throw new HiringError("Offer not found");
  await db.update(offers).set({ status: "accepted", updatedAt: new Date() }).where(eq(offers.id, offer.id));
  if (offer.applicationId) {
    await changeStage(input.principal, offer.applicationId, "pre_hire", "offer_accepted", "human");
    const [application] = await db.select().from(applications).where(eq(applications.id, offer.applicationId)).limit(1);
    if (application) {
      await db
        .insert(prehireRecords)
        .values({
          applicationId: application.id,
          candidateId: application.candidateId,
          startDate: offer.expirationDate,
        })
        .onConflictDoNothing();
    }
  }
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "offer.accepted",
    recordType: "offer",
    recordId: offer.id,
  });
  return offer;
}

export async function ensureDefaultOnboardingTemplate(organizationId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(onboardingTemplates)
    .where(and(eq(onboardingTemplates.organizationId, organizationId), eq(onboardingTemplates.slug, "general-employee")))
    .limit(1);
  if (existing) return existing;
  const [template] = await db
    .insert(onboardingTemplates)
    .values({ organizationId, name: "General Employee", slug: "general-employee" })
    .returning();
  const tasks = [
    { title: "Complete required forms", ownerRole: "new_hire", phase: "before_start", dueOffsetDays: -3, blocking: true },
    { title: "Review employee handbook", ownerRole: "new_hire", phase: "day_one", dueOffsetDays: 0 },
    { title: "Create company email", ownerRole: "it", phase: "before_start", dueOffsetDays: -2, blocking: true },
    { title: "Provision WorkforceOS", ownerRole: "operations", phase: "day_one", dueOffsetDays: 0 },
    { title: "Meet manager", ownerRole: "manager", phase: "week_one", dueOffsetDays: 5 },
    { title: "30-day check-in", ownerRole: "manager", phase: "first_30_days", dueOffsetDays: 30 },
  ];
  for (const [index, task] of tasks.entries()) {
    await db.insert(onboardingTemplateTasks).values({ ...task, templateId: template.id, sortOrder: index });
  }
  return template;
}

export async function startOnboarding(input: { principal: Principal; applicationId: string; startDate?: Date }) {
  requirePermission(input.principal, "onboarding.manage");
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!application) throw new HiringError("Application not found");
  const [existingInstance] = await db
    .select()
    .from(onboardingInstances)
    .where(eq(onboardingInstances.applicationId, application.id))
    .limit(1);
  if (existingInstance) throw new HiringError("Onboarding has already been started for this application.");
  const template = await ensureDefaultOnboardingTemplate(input.principal.organizationId);
  const [instance] = await db
    .insert(onboardingInstances)
    .values({
      organizationId: input.principal.organizationId,
      applicationId: application.id,
      templateId: template.id,
      startDate: (input.startDate ?? new Date()).toISOString().slice(0, 10),
      status: "active",
    })
    .returning();
  const templateTasks = await db
    .select()
    .from(onboardingTemplateTasks)
    .where(eq(onboardingTemplateTasks.templateId, template.id));
  const start = input.startDate ?? new Date();
  for (const task of templateTasks) {
    const due = new Date(start);
    due.setDate(due.getDate() + (task.dueOffsetDays ?? 0));
    await db.insert(onboardingTasks).values({
      instanceId: instance.id,
      title: task.title,
      ownerRole: task.ownerRole,
      dueAt: due,
      phase: task.phase,
      blocking: task.blocking,
      status: "pending",
    });
  }
  await changeStage(input.principal, application.id, "onboarding", "onboarding_started", "human");
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, application.candidateId)).limit(1);
  if (candidate?.email) {
    const mail = onboardingWelcomeEmail({ firstName: candidate.fullName.split(" ")[0] ?? "there" });
    const sent = await getEmailProvider().sendTransactional({
      organizationId: input.principal.organizationId,
      to: candidate.email,
      template: "onboarding_welcome",
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      entityType: "onboarding_instance",
      entityId: instance.id,
    });
    await recordEmailEvent({
      organizationId: input.principal.organizationId,
      provider: sent.provider,
      template: "onboarding_welcome",
      recipient: candidate.email,
      entityType: "onboarding_instance",
      entityId: instance.id,
      status: emailRecordStatus(sent.status),
      providerMessageId: sent.providerMessageId,
      error: sent.error ?? null,
    });
  }
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "onboarding.started",
    recordType: "onboarding_instance",
    recordId: instance.id,
  });
  return instance;
}

export async function createEmployeeFromApplication(input: { principal: Principal; applicationId: string }) {
  requirePermission(input.principal, "employees.manage");
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!application) throw new HiringError("Application not found");
  const [existing] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, input.principal.organizationId),
        eq(employees.candidateId, application.candidateId),
      ),
    )
    .limit(1);
  if (existing) {
    await changeStage(input.principal, application.id, "hired", "hired", "human");
    await db.update(applications).set({ status: "hired", updatedAt: new Date() }).where(eq(applications.id, application.id));
    return existing;
  }
  const [job] = await db.select().from(jobs).where(eq(jobs.id, application.jobId)).limit(1);
  const [row] = await db
    .insert(employees)
    .values({
      organizationId: input.principal.organizationId,
      candidateId: application.candidateId,
      status: "prehire",
      hireDate: new Date().toISOString().slice(0, 10),
      jobTitle: job?.title ?? null,
      department: job?.department ?? null,
      employmentType: job?.employmentType ?? null,
    })
    .returning();
  await changeStage(input.principal, application.id, "hired", "hired", "human");
  await db.update(applications).set({ status: "hired", updatedAt: new Date() }).where(eq(applications.id, application.id));
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "employee.created",
    recordType: "employee",
    recordId: row.id,
    after: { candidateId: application.candidateId },
  });
  return row;
}

export async function assertFileAccess(principal: Principal, fileId: string) {
  const db = getDb();
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file || file.organizationId !== principal.organizationId) {
    throw new HiringError("File not found");
  }
  if (file.privacyClass === "restricted_pii" && !can(principal, "candidate_pii.read")) {
    throw new HiringError("Missing permission: candidate_pii.read");
  }
  return file;
}

export async function downloadStoredFile(principal: Principal, fileId: string) {
  const file = await assertFileAccess(principal, fileId);
  const storage = getStorageProvider();
  const body = await storage.download(file.storageKey);
  return { file, body };
}

export async function listOnboardingQueue(principal: Principal) {
  requirePermission(principal, "onboarding.read");
  const db = getDb();
  const instances = await db
    .select({
      instance: onboardingInstances,
      application: applications,
      candidate: candidates,
      job: jobs,
    })
    .from(onboardingInstances)
    .innerJoin(applications, eq(applications.id, onboardingInstances.applicationId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(onboardingInstances.organizationId, principal.organizationId))
    .orderBy(desc(onboardingInstances.createdAt))
    .limit(50);
  const instanceIds = instances.map((row) => row.instance.id);
  const tasks = instanceIds.length
    ? await db.select().from(onboardingTasks).where(inArray(onboardingTasks.instanceId, instanceIds))
    : [];
  const canPii = can(principal, "candidate_pii.read");
  return instances.map((row) => ({
    instance: row.instance,
    application: row.application,
    job: row.job,
    candidate: presentCandidate(row.candidate, canPii),
    tasks: tasks.filter((task) => task.instanceId === row.instance.id),
  }));
}

export async function completeOnboardingTask(input: { principal: Principal; taskId: string }) {
  requirePermission(input.principal, "onboarding.complete");
  const db = getDb();
  const [task] = await db.select().from(onboardingTasks).where(eq(onboardingTasks.id, input.taskId)).limit(1);
  if (!task) throw new HiringError("Onboarding task not found");
  const [instance] = await db
    .select()
    .from(onboardingInstances)
    .where(eq(onboardingInstances.id, task.instanceId))
    .limit(1);
  if (!instance || instance.organizationId !== input.principal.organizationId) {
    throw new HiringError("Onboarding task not found");
  }
  const [updated] = await db
    .update(onboardingTasks)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(onboardingTasks.id, task.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "onboarding_task.completed",
    recordType: "onboarding_task",
    recordId: task.id,
    after: { instanceId: instance.id, title: task.title },
  });
  return updated;
}

export async function getHiringMetrics(organizationId: string) {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  async function counted(query: Promise<Array<{ value: number }>>) {
    const [row] = await query;
    return Number(row?.value ?? 0);
  }

  const [
    openJobs,
    newApplications,
    awaitingReview,
    interviewsThisWeek,
    backgroundPending,
    drugPending,
    offersOutstanding,
    offersAccepted,
    newHiresStarting,
    onboardingAtRisk,
    skillbridgeApplicants,
    skillbridgeUnmatched,
  ] = await Promise.all([
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(jobs)
        .where(and(eq(jobs.organizationId, organizationId), inArray(jobs.status, ["open", "search_active"]))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(applications)
        .where(and(eq(applications.organizationId, organizationId), gte(applications.appliedAt, weekAgo))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(applications)
        .where(and(eq(applications.organizationId, organizationId), eq(applications.currentStage, "applied"))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(interviews)
        .innerJoin(jobs, eq(jobs.id, interviews.jobId))
        .where(and(eq(jobs.organizationId, organizationId), gte(interviews.scheduledFor, now), lte(interviews.scheduledFor, weekAhead))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(backgroundChecks)
        .where(and(eq(backgroundChecks.organizationId, organizationId), inArray(backgroundChecks.status, ["invited", "consent_pending", "in_progress"]))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(drugScreens)
        .where(and(eq(drugScreens.organizationId, organizationId), inArray(drugScreens.status, ["ordered", "scheduled"]))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(offers)
        .innerJoin(jobs, eq(jobs.id, offers.jobId))
        .where(and(eq(jobs.organizationId, organizationId), inArray(offers.status, ["pending_approval", "approved", "sent", "extended"]))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(offers)
        .innerJoin(jobs, eq(jobs.id, offers.jobId))
        .where(and(eq(jobs.organizationId, organizationId), eq(offers.status, "accepted"))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(employees)
        .where(and(eq(employees.organizationId, organizationId), eq(employees.status, "prehire"))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(onboardingTasks)
        .innerJoin(onboardingInstances, eq(onboardingInstances.id, onboardingTasks.instanceId))
        .where(
          and(
            eq(onboardingInstances.organizationId, organizationId),
            eq(onboardingTasks.status, "pending"),
            lte(onboardingTasks.dueAt, now),
          ),
        ),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(and(eq(applications.organizationId, organizationId), eq(jobs.jobContextType, "skillbridge"))),
    ),
    counted(
      db
        .select({ value: sql<number>`count(*)` })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(
          and(
            eq(applications.organizationId, organizationId),
            eq(jobs.jobContextType, "skillbridge"),
            inArray(applications.currentStage, ["applied", "opportunity_matching", "no_match_yet"]),
          ),
        ),
    ),
  ]);

  return {
    openJobs,
    newApplications,
    awaitingReview,
    interviewsThisWeek,
    backgroundPending,
    drugPending,
    offersOutstanding,
    offersAccepted,
    newHiresStarting,
    onboardingAtRisk,
    skillbridgeApplicants,
    skillbridgeUnmatched,
  };
}

export async function searchHiringForScout(input: {
  organizationId: string;
  prompt: string;
  canReadPii: boolean;
}) {
  const db = getDb();
  const text = input.prompt.toLowerCase();
  if (/\binterviews? tomorrow\b/.test(text)) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rows = await db
      .select({ interview: interviews, candidate: candidates, job: jobs })
      .from(interviews)
      .innerJoin(candidates, eq(candidates.id, interviews.candidateId))
      .innerJoin(jobs, eq(jobs.id, interviews.jobId))
      .where(and(eq(jobs.organizationId, input.organizationId), gte(interviews.scheduledFor, start), lte(interviews.scheduledFor, end)))
      .limit(25);
    return rows.map((row) => ({
      type: "application" as const,
      id: row.interview.applicationId ?? row.interview.id,
      title: `${row.candidate.fullName} · ${row.job.title}`,
      href: row.interview.applicationId
        ? `/app/recruiting/applications/${row.interview.applicationId}`
        : `/app/interviews`,
      meta: row.interview.scheduledFor?.toISOString() ?? "scheduled",
      fields: { stage: row.interview.stage },
    }));
  }
  if (/\bbackground check\b/.test(text)) {
    const rows = await db
      .select()
      .from(backgroundChecks)
      .where(
        and(
          eq(backgroundChecks.organizationId, input.organizationId),
          inArray(backgroundChecks.status, ["invited", "consent_pending", "in_progress", "review_required"]),
        ),
      )
      .limit(25);
    return rows.map((row) => ({
      type: "application" as const,
      id: row.applicationId ?? row.id,
      title: "Background check pending",
      href: `/app/recruiting/applications/${row.applicationId ?? ""}`,
      meta: row.status,
      fields: { status: row.status },
    }));
  }
  if (/\bdrug screen\b/.test(text)) {
    const rows = await db
      .select()
      .from(drugScreens)
      .where(
        and(
          eq(drugScreens.organizationId, input.organizationId),
          inArray(drugScreens.status, ["ordered", "scheduled", "review_required"]),
        ),
      )
      .limit(25);
    return rows.map((row) => ({
      type: "application" as const,
      id: row.applicationId ?? row.id,
      title: "Drug screen pending",
      href: `/app/recruiting/applications/${row.applicationId ?? ""}`,
      meta: row.status,
      fields: { status: row.status },
    }));
  }
  const conditions = [eq(applications.organizationId, input.organizationId)];
  if (/\bnew applications?\b|\btoday\b|\bthis week\b/.test(text)) {
    const start = /\btoday\b/.test(text)
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    conditions.push(gte(applications.appliedAt, start));
  }
  if (/\bnot been reviewed\b|\bawaiting review\b|\bneeds review\b/.test(text)) {
    conditions.push(eq(applications.currentStage, "applied"));
  }
  if (/\bskillbridge\b/.test(text)) {
    conditions.push(eq(applications.pipeline, "skillbridge"));
  }
  const rows = await db
    .select({ application: applications, candidate: candidates, job: jobs })
    .from(applications)
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(...conditions))
    .limit(25);
  return rows.map((row) => ({
    type: "application" as const,
    id: row.application.id,
    title: `${row.candidate.fullName} → ${row.job.title}`,
    href: `/app/recruiting/applications/${row.application.id}`,
    meta: `${row.application.currentStage} · ${row.application.source}`,
    fields: {
      stage: row.application.currentStage,
      email: input.canReadPii ? row.candidate.email : null,
    },
  }));
}
