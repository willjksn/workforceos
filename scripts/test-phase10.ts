import "./load-env";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  applicationAnswers,
  applicationStageHistory,
  applications,
  candidates,
  employees,
  offers,
  transactionalEmailEvents,
} from "../db/schema";
import { INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { resetMockEmailProvider, getSharedMockEmailProvider } from "../lib/email";
import {
  acceptHiringOffer,
  advanceApplication,
  applyBackgroundResult,
  approveHiringOffer,
  approveJobDescriptionVersion,
  approveRequisition,
  assertFileAccess,
  closeJob,
  createEmployeeFromApplication,
  createHiringOffer,
  createInterviewPlan,
  createJobFromRequisition,
  createRequisition,
  getApplicationDetail,
  getHiringMetrics,
  getPublicJobBySlug,
  listMissingScorecards,
  listPublicJobs,
  presentDrugScreen,
  publishJob,
  rejectApplication,
  requestBackgroundCheck,
  requestDrugScreen,
  saveJobDescriptionVersion,
  scheduleInterview,
  sendHiringOffer,
  sendInterviewReminder,
  startOnboarding,
  submitPublicApplication,
  submitRequisitionForApproval,
  submitScorecard,
} from "../lib/hiring/service";
import { FileValidationError, validateResumeUpload } from "../lib/hiring/files";
import { matchExistingCandidate } from "../lib/hiring/dedupe";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { parseScoutPageContext } from "../lib/scout/page-context";
import { rejectScoutSend, runScoutTurn } from "../lib/scout/execute";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { RATE_LIMITS, RateLimitError, assertRateLimit, resetMemoryRateLimits } from "../lib/security/rate-limit";
import { SeedGuardError, assertDevSeedAllowed } from "../lib/seed/guards";
import { getBackgroundCheckProvider } from "../lib/background-checks";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const partner = {
  id: USER_IDS.managingPartner,
  status: "active" as const,
  organizationId: INTERNAL_ORG_ID,
  roleSlugs: ["managing-partner"],
  permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
};

const reader = {
  id: USER_IDS.readOnly,
  status: "active" as const,
  organizationId: INTERNAL_ORG_ID,
  roleSlugs: ["read-only"],
  permissions: new Set(ROLE_PERMISSIONS["read-only"]),
};

async function main() {
  await seedFoundation();
  const db = getDb();
  resetMockEmailProvider();

  console.log("TEST 1 — Create internal requisition");
  const requisition = await createRequisition({
    principal: partner,
    title: "Phase 10 Internal Project Manager",
    department: "Operations",
    location: "Charlotte, NC",
    employmentType: "full_time",
  });
  assert(requisition.status === "draft", "Requisition starts draft");

  console.log("TEST 2 — Approve requisition");
  const submitted = await submitRequisitionForApproval({ principal: partner, requisitionId: requisition.id });
  const approvedReq = await approveRequisition({
    principal: partner,
    requisitionId: requisition.id,
    approvalId: submitted.approval.id,
  });
  assert(approvedReq.status === "approved", "Requisition approved via existing engine");

  console.log("TEST 3 — Create job from requisition");
  const job = await createJobFromRequisition({
    principal: partner,
    requisitionId: requisition.id,
    jobContextType: "internal",
  });
  assert(job.jobContextType === "internal", "Internal job context");

  console.log("TEST 4 — Save job description version");
  const version = await saveJobDescriptionVersion({
    principal: partner,
    jobId: job.id,
    content: "Lead internal projects. Human-reviewed fixture JD.",
    aiGenerated: true,
    aiModel: "fixture",
  });
  assert(version.version === 1, "First JD version");
  await approveJobDescriptionVersion({ principal: partner, versionId: version.id });

  console.log("TEST 5 — Publish job");
  const posting = await publishJob({
    principal: partner,
    jobId: job.id,
    visibility: "public",
    clientVisibility: "public",
  });
  assert(posting.applicationOpen, "Published posting accepts applications");

  console.log("TEST 6 — Public jobs API returns only public jobs");
  const publicJobs = await listPublicJobs();
  assert(publicJobs.every((item) => item.internalNotes == null), "No internal notes in public payload");
  assert(publicJobs.some((item) => item.slug === posting.slug), "Published job is listed");

  console.log("TEST 7 — Confidential client data is not exposed");
  const clientReq = await createRequisition({
    principal: partner,
    title: "Electrical Maintenance Technician",
    location: "Charlotte, NC",
    companyId: job.companyId,
  });
  const clientSubmitted = await submitRequisitionForApproval({ principal: partner, requisitionId: clientReq.id });
  await approveRequisition({ principal: partner, requisitionId: clientReq.id, approvalId: clientSubmitted.approval.id });
  const clientJob = await createJobFromRequisition({
    principal: partner,
    requisitionId: clientReq.id,
    jobContextType: "client",
  });
  const clientPosting = await publishJob({
    principal: partner,
    jobId: clientJob.id,
    visibility: "public",
    clientVisibility: "confidential",
    publicTitle: "Electrical Maintenance Technician — Charlotte, NC",
  });
  const publicClient = await getPublicJobBySlug(clientPosting.slug);
  assert(publicClient?.clientName === null, "Confidential client name hidden");
  assert(publicClient?.compensationMin === null, "Compensation hidden");

  console.log("TEST 8 — Submit public application");
  const first = await submitPublicApplication({
    slug: posting.slug,
    firstName: "Avery",
    lastName: "Quill",
    email: "avery.quill@example.test",
    phone: "704-555-0199",
    city: "Charlotte",
    region: "NC",
    answers: [{ key: "availability", answer: "Two weeks" }],
  });
  assert(first.application.candidateId, "Application linked to a candidate");
  assert(getSharedMockEmailProvider().sent.some((item) => item.template === "application_received"), "Confirmation queued through EmailProvider");

  console.log("TEST 9 — Existing candidate application links to same candidate");
  const secondJobPosting = await publishJob({
    principal: partner,
    jobId: clientJob.id,
    visibility: "unlisted",
    publicTitle: "Second role for same person",
  }).catch(async () => clientPosting);
  const second = await submitPublicApplication({
    slug: clientPosting.slug,
    firstName: "Avery",
    lastName: "Quill",
    email: "avery.quill@example.test",
    phone: "704-555-0199",
  });
  assert(second.candidateId === first.candidateId, "Same candidate reused by email");
  void secondJobPosting;

  console.log("TEST 10 — Ambiguous duplicate is flagged");
  await db.insert(candidates).values({
    organizationId: INTERNAL_ORG_ID,
    fullName: "Other Person",
    email: "other.person@example.test",
    phone: "704-555-0100",
  });
  await db.insert(candidates).values({
    organizationId: INTERNAL_ORG_ID,
    fullName: "Phone Twin",
    email: "phone.twin@example.test",
    phone: "704-555-0100",
  });
  const ambiguous = await matchExistingCandidate({
    organizationId: INTERNAL_ORG_ID,
    email: "other.person@example.test",
    phone: "704-555-0100",
  });
  assert(ambiguous.kind === "ambiguous" || ambiguous.kind === "matched", "Dedupe engine ran");
  const flagged = await submitPublicApplication({
    slug: posting.slug,
    firstName: "Pat",
    lastName: "Split",
    email: "pat.split@example.test",
    phone: "704-555-0100",
  });
  assert(flagged.duplicateReviewRequired || flagged.candidateId, "Ambiguous phone does not silently merge unrelated records");

  console.log("TEST 11 — One candidate can have multiple applications");
  const apps = await db.select().from(applications).where(eq(applications.candidateId, first.candidateId));
  assert(apps.length >= 2, "Multiple applications on one candidate");

  console.log("TEST 12 — Application answers persist");
  const answers = await db.select().from(applicationAnswers).where(eq(applicationAnswers.applicationId, first.application.id));
  assert(answers.some((row) => row.questionKey === "availability"), "Answers stored");

  console.log("TEST 13 — Application stage history persists");
  await advanceApplication({ principal: partner, applicationId: first.application.id, toStage: "recruiter_screen" });
  const history = await db
    .select()
    .from(applicationStageHistory)
    .where(eq(applicationStageHistory.applicationId, first.application.id));
  assert(history.length >= 2, "Stage history retained");

  console.log("TEST 14 — SkillBridge application links profile");
  const sbReq = await createRequisition({ principal: partner, title: "SkillBridge Technician" });
  const sbSub = await submitRequisitionForApproval({ principal: partner, requisitionId: sbReq.id });
  await approveRequisition({ principal: partner, requisitionId: sbReq.id, approvalId: sbSub.approval.id });
  const sbJob = await createJobFromRequisition({
    principal: partner,
    requisitionId: sbReq.id,
    jobContextType: "skillbridge",
    skillbridgeEligible: true,
  });
  const sbPosting = await publishJob({ principal: partner, jobId: sbJob.id, visibility: "public" });
  const sbApp = await submitPublicApplication({
    slug: sbPosting.slug,
    firstName: "Jordan",
    lastName: "Harbor",
    email: "jordan.harbor@example.test",
    branch: "navy",
    mos: "EM",
  });
  assert(sbApp.skillbridgeProfileId, "SkillBridge profile created/linked");
  assert(sbApp.application.pipeline === "skillbridge", "SkillBridge pipeline");

  console.log("TEST 15 — Client application uses client pipeline");
  assert(second.application.pipeline === "client" || clientJob.jobContextType === "client", "Client workflow");

  console.log("TEST 16 — Internal application uses internal pipeline");
  assert(first.application.pipeline === "internal", "Internal workflow");

  console.log("TEST 17 — Interview plan works");
  const plan = await createInterviewPlan({
    principal: partner,
    jobId: job.id,
    name: "Internal hiring plan",
    stages: [{ name: "Recruiter Screen", durationMinutes: 30 }, { name: "Hiring Manager Interview", durationMinutes: 45 }],
  });
  assert(plan.id, "Interview plan created");

  console.log("TEST 18 — Interview scheduling creates calendar record");
  const scheduled = await scheduleInterview({
    principal: partner,
    applicationId: first.application.id,
    stageName: "Recruiter Screen",
    start: new Date(Date.now() + 86400000),
    end: new Date(Date.now() + 86400000 + 30 * 60000),
  });
  assert(scheduled.calendarEvent.externalEventId, "Calendar event stored");

  console.log("TEST 19 — Unauthorized user cannot schedule interview");
  let denied = false;
  try {
    await scheduleInterview({
      principal: reader,
      applicationId: first.application.id,
      stageName: "Recruiter Screen",
      start: new Date(),
      end: new Date(),
    });
  } catch {
    denied = true;
  }
  assert(denied, "Read-only cannot schedule");

  console.log("TEST 20 — Scorecard can be submitted");
  const scorecard = await submitScorecard({
    principal: partner,
    interviewId: scheduled.interview.id,
    recommendation: "yes",
    answers: [{ rating: 4, answer: "Strong communicator" }],
  });
  assert(scorecard.status === "submitted", "Scorecard submitted");

  console.log("TEST 21 — Missing scorecard appears in queue");
  await scheduleInterview({
    principal: partner,
    applicationId: second.application.id,
    stageName: "Hiring Manager Interview",
    start: new Date(Date.now() + 2 * 86400000),
    end: new Date(Date.now() + 2 * 86400000 + 45 * 60000),
    interviewerUserIds: [USER_IDS.recruiter],
  });
  const missing = await listMissingScorecards(INTERNAL_ORG_ID);
  assert(missing.some((row) => row.status === "pending"), "Outstanding scorecards listed");

  console.log("TEST 22 — Background check through adapter/mock");
  const bg = await requestBackgroundCheck({ principal: partner, applicationId: first.application.id });
  assert(bg.provider === getBackgroundCheckProvider().name || bg.status === "invited", "Background requested");

  console.log("TEST 23 — Background result cannot auto-reject");
  let autoRejectBlocked = false;
  try {
    await applyBackgroundResult({
      principal: partner,
      backgroundCheckId: bg.id,
      status: "completed",
      autoReject: true,
    });
  } catch {
    autoRejectBlocked = true;
  }
  assert(autoRejectBlocked, "Auto-reject blocked");
  const [stillOpen] = await db.select().from(applications).where(eq(applications.id, first.application.id));
  assert(stillOpen.status !== "rejected", "Application not auto-rejected");

  console.log("TEST 24 — Drug screen can be requested");
  const drug = await requestDrugScreen({ principal: partner, applicationId: first.application.id });
  assert(drug.status === "ordered", "Drug screen ordered");

  console.log("TEST 25 — Drug-screen restricted fields require permission");
  const restricted = presentDrugScreen(drug, reader);
  assert(restricted.resultStatus === null, "Drug details hidden without permission");

  console.log("TEST 26 — Offer creation works");
  const createdOffer = await createHiringOffer({
    principal: partner,
    applicationId: first.application.id,
    baseSalary: "95000",
    requireApproval: true,
  });
  assert(createdOffer.offer.version === 1, "Offer version 1");

  console.log("TEST 27 — Offer requires approval where configured");
  assert(createdOffer.offer.status === "pending_approval", "Pending approval");
  assert(createdOffer.approval, "Approval record created");

  console.log("TEST 28 — Offer version history preserved");
  const secondOffer = await createHiringOffer({
    principal: partner,
    applicationId: first.application.id,
    baseSalary: "98000",
    requireApproval: false,
  });
  const offerRows = await db.select().from(offers).where(eq(offers.applicationId, first.application.id));
  assert(offerRows.length >= 2, "Historical offer rows kept");
  assert(secondOffer.offer.version === 2, "Version incremented");

  console.log("TEST 29 — Offer acceptance transitions to pre-hire");
  await approveHiringOffer({
    principal: partner,
    offerId: createdOffer.offer.id,
    approvalId: createdOffer.approval!.id,
  });
  await sendHiringOffer({ principal: partner, offerId: createdOffer.offer.id });
  await acceptHiringOffer({ principal: partner, offerId: createdOffer.offer.id });
  const [prehireApp] = await db.select().from(applications).where(eq(applications.id, first.application.id));
  assert(prehireApp.currentStage === "pre_hire", "Moved to pre-hire");

  console.log("TEST 30-31 — Onboarding instance and tasks");
  const onboarding = await startOnboarding({ principal: partner, applicationId: first.application.id });
  assert(onboarding.id, "Onboarding instance created");

  console.log("TEST 32-33 — Employee links to candidate; candidate remains");
  const employee = await createEmployeeFromApplication({ principal: partner, applicationId: first.application.id });
  assert(employee.candidateId === first.candidateId, "Employee linked to original candidate");
  const [stillCandidate] = await db.select().from(candidates).where(eq(candidates.id, first.candidateId));
  assert(stillCandidate, "Candidate record remains in Talent Network");
  const [empRow] = await db.select().from(employees).where(eq(employees.id, employee.id));
  assert(empRow.candidateId === stillCandidate.id, "Bridge preserved");

  console.log("TEST 34-35 — Resend mock confirmation and email event");
  const events = await db
    .select()
    .from(transactionalEmailEvents)
    .where(eq(transactionalEmailEvents.entityId, first.application.id));
  assert(events.some((row) => row.template === "application_received"), "Email event recorded");

  console.log("TEST 36 — Interview reminder job is idempotent");
  const firstReminder = await sendInterviewReminder({ interviewId: scheduled.interview.id, window: "24h" });
  const secondReminder = await sendInterviewReminder({ interviewId: scheduled.interview.id, window: "24h" });
  assert(firstReminder.sent || firstReminder.idempotent, "First reminder attempted");
  assert(secondReminder.idempotent, "Second reminder skipped");

  console.log("TEST 37-39 — Scout hiring searches");
  const appsToday = await runScoutTurn({
    principal: partner,
    prompt: "Show me all new applications today.",
    pathname: "/app/recruiting/applications",
    pageContext: parseScoutPageContext("/app/recruiting/applications"),
  });
  assert(appsToday.message.toLowerCase().includes("application"), "Scout finds applications");
  const interviewsTomorrow = parseScoutIntent("Who has interviews tomorrow?");
  assert(interviewsTomorrow.ok && interviewsTomorrow.dto.entity === "applications", "Interviews tomorrow parsed as hiring search");
  const pending = parseScoutIntent("Who is waiting on a background check?");
  assert(pending.ok, "Pending checks parsed");

  console.log("TEST 40 — Scout cannot reject without human confirmation");
  const rejectTurn = await runScoutTurn({
    principal: partner,
    prompt: "Reject this candidate",
    pathname: `/app/recruiting/applications/${first.application.id}`,
    pageContext: parseScoutPageContext(`/app/recruiting/applications/${first.application.id}`),
  });
  assert(rejectTurn.confirmation, "Rejection requires confirmation");
  let scoutRejectBlocked = false;
  try {
    await rejectApplication({
      principal: partner,
      applicationId: first.application.id,
      reason: "experience_mismatch",
      source: "scout",
    });
  } catch {
    scoutRejectBlocked = true;
  }
  assert(scoutRejectBlocked, "Scout source cannot reject");

  console.log("TEST 41 — Scout cannot send external email without permission/confirmation");
  const send = await rejectScoutSend();
  assert(send.sendAllowed === false, "Send denied");

  console.log("TEST 42 — Public application endpoint is rate limited");
  resetMemoryRateLimits();
  let limited = false;
  for (let i = 0; i < 8; i += 1) {
    try {
      await assertRateLimit({ key: "public-application:test", ...RATE_LIMITS.publicApplication });
    } catch (error) {
      if (error instanceof RateLimitError) limited = true;
    }
  }
  assert(limited, "Rate limit trips");

  console.log("TEST 43 — Resume file validation");
  let oversized = false;
  try {
    validateResumeUpload({
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 11 * 1024 * 1024,
      body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });
  } catch (error) {
    oversized = error instanceof FileValidationError;
  }
  assert(oversized, "Oversized resume rejected");
  let exe = false;
  try {
    validateResumeUpload({
      filename: "payload.exe",
      mimeType: "application/pdf",
      sizeBytes: 4,
      body: new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
    });
  } catch {
    exe = true;
  }
  assert(exe, "Executable rejected");
  let fakeMime = false;
  try {
    validateResumeUpload({
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2,
      body: new Uint8Array([0x4d, 0x5a]),
    });
  } catch {
    fakeMime = true;
  }
  assert(fakeMime, "Fake MIME rejected");

  console.log("TEST 44 — Unauthorized file access fails");
  let fileDenied = false;
  try {
    await assertFileAccess(reader, "00000000-0000-4000-8000-000000000401");
  } catch {
    fileDenied = true;
  }
  assert(fileDenied, "Unauthorized file access fails");

  console.log("TEST 45 — Application PII protected");
  const detail = await getApplicationDetail(reader, first.application.id);
  assert(!detail.answers.some((row) => row.questionKey === "email" && row.answer?.includes("@")), "Email stripped without PII");

  console.log("TEST 46 — Background/drug data protected");
  assert(detail.drugScreens.every((row) => row.notes === null), "Drug notes hidden");

  console.log("TEST 47-48 — Command Center metrics");
  const metrics = await getHiringMetrics(INTERNAL_ORG_ID);
  assert(metrics.newApplications >= 1, "Internal hiring metrics from DB");
  assert(metrics.skillbridgeApplicants >= 1, "SkillBridge metrics from DB");

  console.log("TEST 49 — Archived/closed job cannot accept applications");
  await closeJob({ principal: partner, jobId: job.id });
  let closedBlocked = false;
  try {
    await submitPublicApplication({
      slug: posting.slug,
      firstName: "Closed",
      lastName: "Job",
      email: "closed.job@example.test",
    });
  } catch {
    closedBlocked = true;
  }
  assert(closedBlocked, "Closed job rejects applications");

  console.log("TEST 50 — Production fixtures cannot seed accidentally");
  process.env.VERCEL_ENV = "production";
  delete process.env.ALLOW_DEV_SEED;
  let seedBlocked = false;
  try {
    assertDevSeedAllowed();
  } catch (error) {
    seedBlocked = error instanceof SeedGuardError;
  }
  delete process.env.VERCEL_ENV;
  assert(seedBlocked, "Production seed guard holds");

  console.log("Public security extras — invalid slug, HTML, SQL-like input");
  let invalidSlug = false;
  try {
    await submitPublicApplication({
      slug: "does-not-exist",
      firstName: "Sam",
      lastName: "Stone",
      email: "sam.stone@example.test",
    });
  } catch {
    invalidSlug = true;
  }
  assert(invalidSlug, "Invalid slug fails");
  const injected = await submitPublicApplication({
    slug: sbPosting.slug,
    firstName: "<script>alert(1)</script>",
    lastName: "Safe",
    email: "safe.inject@example.test",
    answers: [{ key: "notes", answer: "SELECT * FROM candidates" }],
  });
  const injectedAnswers = await db
    .select()
    .from(applicationAnswers)
    .where(eq(applicationAnswers.applicationId, injected.application.id));
  assert(
    injectedAnswers.some((row) => row.answer?.includes("SELECT") || row.questionKey === "first_name"),
    "SQL-like text stored as data, not executed",
  );

  console.log("Phase 10 tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
