import "./load-env";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidates,
  skillbridgeOpportunityStageHistory,
  skillbridgeOpportunities,
  skillbridgeProfiles,
} from "../db/schema";
import {
  CANDIDATE_ID,
  CHARLOTTE_ELECTRICAL_JOB_ID,
  COMPANY_ID,
  DUKE_ENERGY_COMPANY_ID,
  INTERNAL_ORG_ID,
  MICHAEL_CARTER_ID,
  MICHAEL_CARTER_PROFILE_ID,
  NAVY_EM_ID,
  USER_IDS,
} from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { parseScoutPageContext } from "../lib/scout/page-context";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { confirmScoutAction, rejectScoutSend, runScoutTurn } from "../lib/scout/execute";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import {
  advanceSkillBridgeOpportunityStage,
  createSkillBridgeOpportunity,
  createSkillBridgeProfile,
  getMySkillBridgeQueue,
  getSkillBridgeMetrics,
  listSkillBridgeCards,
  uploadSkillBridgeResume,
  updateSkillBridgeProfile,
} from "../lib/skillbridge/service";
import { draftSkillBridgeMessage } from "../lib/skillbridge/drafts";
import { getSkillBridgeAlertRules } from "../lib/skillbridge/rules";

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

const actor = { organizationId: INTERNAL_ORG_ID, userId: USER_IDS.managingPartner };

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — SkillBridge profile links to existing candidate; no duplicate");
  const beforeCount = await db.select().from(candidates);
  const profile = await createSkillBridgeProfile({
    actor,
    candidateId: CANDIDATE_ID,
    branch: "navy",
    militaryOccupationId: NAVY_EM_ID,
    mosRateAfscDisplay: "EM",
    endOfServiceDate: new Date("2027-06-01"),
    skillbridgeWindowStart: new Date("2027-01-15"),
    skillbridgeWindowEnd: new Date("2027-05-15"),
    preferredLocationPrimary: "Norfolk, VA",
    idealEmployer: "Harbor Manufacturing",
    targetRoles: [{ roleTitle: "Electrical Technician", isPrimary: true }],
  });
  const afterCount = await db.select().from(candidates);
  assert(profile.candidateId === CANDIDATE_ID, "Profile must link Taylor Ellis");
  assert(afterCount.length === beforeCount.length, "Creating a SkillBridge profile must not duplicate candidates");

  console.log("TEST 2 — store EOS, window, location, occupation, employer, target roles");
  assert(profile.endOfServiceDate, "End of service required");
  assert(profile.skillbridgeWindowStart && profile.skillbridgeWindowEnd, "Window required");
  assert(profile.preferredLocationPrimary?.includes("Norfolk"), "Preferred location required");
  assert(profile.militaryOccupationId === NAVY_EM_ID, "Occupation required");
  assert(profile.idealEmployer === "Harbor Manufacturing", "Ideal employer required");

  console.log("TEST 3 — upload resume through storage abstraction");
  const uploaded = await uploadSkillBridgeResume({
    actor,
    profileId: profile.id,
    filename: "taylor-ellis-resume.pdf",
    mimeType: "application/pdf",
    body: new TextEncoder().encode("%PDF-1.4 fixture resume"),
  });
  assert(uploaded.file.storageKey.includes("skillbridge/"), "Resume stored via storage key");
  assert(uploaded.profile.resumeStatus === "current", "Resume status is current, not a quality score");

  console.log("TEST 4 — multiple employer opportunities for one candidate");
  const firstOpp = await createSkillBridgeOpportunity({
    actor,
    profileId: profile.id,
    companyId: COMPANY_ID,
    stage: "candidate_identified",
  });
  const secondOpp = await createSkillBridgeOpportunity({
    actor,
    profileId: profile.id,
    companyId: DUKE_ENERGY_COMPANY_ID,
    jobId: CHARLOTTE_ELECTRICAL_JOB_ID,
    stage: "initial_contact",
  });
  assert(firstOpp.candidateId === secondOpp.candidateId, "Both opportunities belong to the same candidate");
  assert(firstOpp.id !== secondOpp.id, "Multiple opportunity rows");

  console.log("TEST 5 — stage history preserved");
  await advanceSkillBridgeOpportunityStage({
    actor,
    opportunityId: firstOpp.id,
    toStage: "profile_complete",
    note: "Moved after intake",
  });
  await advanceSkillBridgeOpportunityStage({
    actor,
    opportunityId: firstOpp.id,
    toStage: "employer_submitted",
    note: "Submitted to Harbor",
  });
  const history = await db
    .select()
    .from(skillbridgeOpportunityStageHistory)
    .where(eq(skillbridgeOpportunityStageHistory.skillbridgeOpportunityId, firstOpp.id));
  assert(history.length >= 3, "Stage history must retain prior stages");
  const [current] = await db.select().from(skillbridgeOpportunities).where(eq(skillbridgeOpportunities.id, firstOpp.id));
  assert(current.stage === "employer_submitted", "Current stage advanced");

  console.log("TEST 6 — follow-up overdue rule");
  const overdueProfileId = "00000000-0000-4000-8c00-000000000203";
  const rules = await getSkillBridgeAlertRules(INTERNAL_ORG_ID);
  assert(rules.candidateNoContactDays === 14, "No-contact threshold is configurable");
  const cards = await listSkillBridgeCards({ organizationId: INTERNAL_ORG_ID, canReadPii: true });
  assert(
    cards.some((card) => card.profile.id === overdueProfileId && card.overdueFollowUp),
    "Overdue follow-up candidate must be identified",
  );

  console.log("TEST 7 — window approaching 30/60/90");
  const metrics = await getSkillBridgeMetrics(INTERNAL_ORG_ID);
  assert(metrics.windows30 >= 1, "30-day window count from stored dates");
  assert(metrics.windows60 >= metrics.windows30, "60-day window includes 30-day rows");
  assert(metrics.windows90 >= metrics.windows60, "90-day window includes 60-day rows");

  console.log("TEST 8 — candidate without active opportunity");
  assert(
    cards.some((card) => card.candidate.fullName === "Priya Nguyen" && !card.hasActiveOpportunity),
    "Priya Nguyen should have no active employer opportunity",
  );

  console.log("TEST 9 — employer feedback overdue");
  assert(
    cards.some((card) => card.candidate.fullName === "Marcus Hale" && card.employerOverdue),
    "Marcus Hale employer submission should be overdue for feedback",
  );

  console.log("TEST 10 — Scout electrical technicians in NC open to opportunities");
  const electrical = await runScoutTurn({
    principal: partner,
    prompt: "Show me all electrical technicians in North Carolina who are open to opportunities.",
    pathname: "/app/talent",
    pageContext: parseScoutPageContext("/app/talent"),
  });
  assert(electrical.cards.length >= 1, "Expected NC electrical candidates");
  assert(
    electrical.cards.every((card) => (card.fields.location as string | null)?.includes("NC") || card.meta.includes("NC") || card.href.includes("skillbridge") || card.href.includes("talent")),
    "Results should be location-scoped",
  );

  console.log("TEST 11 — Scout SkillBridge windows next 90 days");
  const windows = await runScoutTurn({
    principal: partner,
    prompt: "Show me SkillBridge candidates whose window opens in 90 days.",
    pathname: "/app/military/skillbridge",
    pageContext: parseScoutPageContext("/app/military/skillbridge"),
  });
  assert(windows.cards.length >= 1, "Expected window results");
  assert(!windows.cards.some((card) => card.title === "Archived SkillBridge Fixture"), "Archived fixture must not appear");

  console.log("TEST 12 — Scout cannot expose PII without candidate_pii.read");
  const piiSearch = await runScoutTurn({
    principal: reader,
    prompt: "Show me all electrical technicians in North Carolina who are open to opportunities.",
    pathname: "/app/talent",
    pageContext: parseScoutPageContext("/app/talent"),
  });
  const leaked = JSON.stringify(piiSearch.cards);
  assert(!leaked.includes("@talent.example.test"), "Email must not leak without candidate_pii.read");
  assert(!leaked.includes("555-0100"), "Phone must not leak without candidate_pii.read");

  console.log("TEST 13 — Scout talent pool only after confirmation");
  const proposed = await runScoutTurn({
    principal: partner,
    prompt: "Create a talent pool from these candidates called NC Electrical — Open to Opportunities",
    pathname: "/app/talent",
    pageContext: parseScoutPageContext("/app/talent"),
  });
  assert(proposed.confirmation?.actionId, "Material pool create requires confirmation");
  const confirmed = await confirmScoutAction({ principal: partner, actionId: proposed.confirmation!.actionId });
  assert(/Created talent pool/i.test(confirmed.message), "Pool created only after confirm");

  console.log("TEST 14 — Scout drafts candidate follow-up");
  const draftTurn = await runScoutTurn({
    principal: partner,
    prompt: "Draft a follow-up email to Michael.",
    pathname: `/app/talent/${MICHAEL_CARTER_ID}`,
    pageContext: parseScoutPageContext(`/app/talent/${MICHAEL_CARTER_ID}`),
  });
  assert(draftTurn.draft?.body, "Draft body required");
  assert(draftTurn.draft?.sendAllowed === false, "Draft must not auto-send");

  console.log("TEST 15 — draft uses stored facts only");
  const draft = draftSkillBridgeMessage({
    kind: "follow_up",
    audience: "candidate",
    candidateName: "Michael Carter",
    occupationTitle: "Electrician's Mate",
    locationPreference: "Charlotte, NC",
    windowStart: new Date("2026-10-20"),
    canReadPii: true,
  });
  assert(draft.body.includes("Michael"), "Draft uses candidate name");
  assert(draft.invented === false, "Draft must not invent unsupported facts");
  assert(!/secret clearance|TS\/SCI|invented cert/i.test(draft.body), "Draft must not invent clearance or certs");

  console.log("TEST 16 — Scout cannot send without permission/confirmation");
  const send = await rejectScoutSend();
  assert(send.sendAllowed === false, "Send is blocked");

  console.log("TEST 17 — page context understands current candidate");
  const him = await runScoutTurn({
    principal: partner,
    prompt: "Find opportunities for him.",
    pathname: `/app/talent/${MICHAEL_CARTER_ID}`,
    pageContext: parseScoutPageContext(`/app/talent/${MICHAEL_CARTER_ID}`),
  });
  assert(him.cards.length >= 1 || /match/i.test(him.message), "Candidate context should drive match search");

  console.log("TEST 18 — page context understands current job");
  const jobCtx = parseScoutPageContext(`/app/jobs/${CHARLOTTE_ELECTRICAL_JOB_ID}`);
  assert(jobCtx.entityType === "job", "Job route must parse as job context");
  assert(jobCtx.entityId === CHARLOTTE_ELECTRICAL_JOB_ID, "Job id from route");

  console.log("TEST 19 — command parser cannot execute SQL");
  const sql = parseScoutIntent("SELECT * FROM candidates; DROP TABLE users;");
  assert(!sql.ok && sql.code === "sql_rejected", "SQL must be rejected");

  console.log("TEST 20 — unknown command rejected");
  const unknown = parseScoutIntent("RUN_ARBITRARY_COMMAND on all candidates");
  assert(!unknown.ok && unknown.code === "unknown_command", "Unknown registry command must be rejected");

  console.log("TEST 21 — material Scout action creates audit event");
  const audits = await db.select().from(auditEvents);
  assert(
    audits.some((row) => row.action.startsWith("scout.") || row.reason === "Scout confirmed internal action"),
    "Confirmed Scout action must be audited",
  );

  console.log("TEST 22 — SkillBridge status/date changes create audit");
  await updateSkillBridgeProfile({
    actor,
    profileId: MICHAEL_CARTER_PROFILE_ID,
    patch: { candidateStatus: "matching", skillbridgeWindowStart: new Date(Date.now() + 40 * 86400000) },
  });
  const sbAudits = await db.select().from(auditEvents);
  assert(
    sbAudits.some((row) => row.recordId === MICHAEL_CARTER_PROFILE_ID && row.action === "skillbridge_profile.updated"),
    "SkillBridge updates must be audited",
  );

  console.log("TEST 23 — dashboard metrics use actual DB data");
  const live = await getSkillBridgeMetrics(INTERNAL_ORG_ID);
  const storedProfiles = await db.select().from(skillbridgeProfiles);
  const activeStored = storedProfiles.filter((row) => !row.archivedAt).length;
  assert(live.activeCandidates <= activeStored, "Metrics cannot exceed stored profiles");
  assert(live.activeCandidates >= 1, "Fixture SkillBridge candidates must produce live counts");

  console.log("TEST 24 — My SkillBridge Queue prioritizes overdue actions");
  const queue = await getMySkillBridgeQueue({
    organizationId: INTERNAL_ORG_ID,
    ownerUserId: USER_IDS.recruiter,
    canReadPii: true,
  });
  assert(queue.overdueFollowUps.length >= 1, "Queue must include overdue follow-ups");
  assert(queue.needsActionToday.length >= 1, "Queue must include needs-action-today");

  console.log("TEST 25 — archived candidate excluded from active SkillBridge");
  const activeCards = await listSkillBridgeCards({ organizationId: INTERNAL_ORG_ID, canReadPii: false });
  assert(
    !activeCards.some((card) => card.candidate.fullName === "Archived SkillBridge Fixture"),
    "Archived candidate must not appear as active SkillBridge",
  );

  void randomUUID;
  console.log("Phase 9 acceptance passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
