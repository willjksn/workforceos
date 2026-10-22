import "./load-env";

import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateJobMatches,
  candidates,
  careerSourceSyncRuns,
  careerSources,
  companies,
  jobDescriptionVersions,
  jobs,
  opportunities,
  organizations,
  users,
} from "../db/schema";
import { employerJobContentHash } from "../lib/integrations/career-sources/content-hash";
import { isPrivateAddress } from "../lib/integrations/career-sources/network-guards";
import { safeFetch } from "../lib/integrations/career-sources/safe-fetch";
import { createCareerSource, createEmployerDemandJob } from "../lib/recruiting/employer-demand";
import {
  importCsvJobs,
  importManualJob,
  OpportunityDiscoveryError,
  syncCareerSource,
} from "../lib/recruiting/opportunity-discovery";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const board = (jobsPayload: unknown[]) => ({ jobs: jobsPayload });

function greenhouseJob(id: number, description: string) {
  return {
    id,
    title: id === 101 ? "Field Technician" : "Planner",
    absolute_url: `https://boards.greenhouse.io/acme/jobs/${id}`,
    location: { name: "Austin" },
    content: description,
    departments: [{ name: "Operations" }],
  };
}

function depsFor(payload: unknown[] | "throw") {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (payload === "throw") throw new Error("board unavailable");
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { status: 200 });
    return new Response(JSON.stringify(board(payload)), { status: 200 });
  };
  return { fetchImpl, lookup: async () => ["8.8.8.8"], minIntervalMs: 0 };
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  if (/prod/i.test(branch) || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing the M4 opportunity discovery test against production.");
  }

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const candidateA = randomUUID();
  const email = `m4-${suffix}@workforceos.test`;

  async function cleanup() {
    const jobRows = await db.select({ id: jobs.id }).from(jobs).where(inArray(jobs.organizationId, [orgA, orgB]));
    const jobIds = jobRows.map((row) => row.id);
    await db.delete(careerSourceSyncRuns).where(inArray(careerSourceSyncRuns.organizationId, [orgA, orgB]));
    if (jobIds.length) {
      await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.jobId, jobIds));
      await db.delete(jobDescriptionVersions).where(inArray(jobDescriptionVersions.jobId, jobIds));
    }
    await db.delete(jobs).where(inArray(jobs.organizationId, [orgA, orgB]));
    await db.delete(careerSources).where(inArray(careerSources.organizationId, [orgA, orgB]));
    await db.delete(candidates).where(inArray(candidates.organizationId, [orgA, orgB]));
    await db.delete(companies).where(inArray(companies.organizationId, [orgA, orgB]));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, [orgA, orgB]));
    await db.delete(users).where(inArray(users.organizationId, [orgA, orgB]));
    await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  }

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M4 Discovery A", slug: `m4-a-${suffix}` },
      { id: orgB, name: "M4 Discovery B", slug: `m4-b-${suffix}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email,
      fullName: "M4 Operator",
      status: "active",
    });
    await db.insert(companies).values([
      { id: companyA, organizationId: orgA, name: "Acme Field" },
      { id: companyB, organizationId: orgB, name: "Other Field" },
    ]);
    await db.insert(candidates).values({
      id: candidateA,
      organizationId: orgA,
      fullName: "Fixture Person",
      email,
    });

    console.log("Q — existing manual jobs still work");
    const manual = await createEmployerDemandJob({
      organizationId: orgA,
      actorUserId: userA,
      title: "Hand entered technician",
      jobContextType: "client",
      companyId: companyA,
    });
    assert(manual.careerSourceId === null && manual.externalKey === null, "manual job has no career source");

    console.log("R — M1 context and horizon stay intact");
    const exploratory = await createEmployerDemandJob({
      organizationId: orgA,
      actorUserId: userA,
      title: "Future maintenance need",
      jobContextType: "exploratory",
      companyId: companyA,
      demandHorizon: "future",
    });
    const evergreenSource = await createCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      companyId: companyA,
      sourceType: "manual_url",
      name: "M4 evergreen source",
      careersUrl: "https://jobs.example.test/careers",
    });
    const evergreen = await createEmployerDemandJob({
      organizationId: orgA,
      actorUserId: userA,
      title: "Evergreen technician",
      jobContextType: "monitored_public",
      companyId: companyA,
      careerSourceId: evergreenSource.id,
      externalKey: "EVERGREEN-1",
      sourceUrl: "https://jobs.example.test/jobs/evergreen",
      contentHash: "m1-hash",
      demandHorizon: "evergreen",
      skillbridgeEligible: true,
    });

    console.log("P — match score fixture");
    const [match] = await db.insert(candidateJobMatches).values({
      organizationId: orgA,
      candidateId: candidateA,
      jobId: manual.id,
      score: "12.50",
    }).returning();

    console.log("S — not yet synced");
    const source = await createCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      companyId: companyA,
      sourceType: "employer_api",
      adapterKey: "greenhouse_public_board",
      name: "Acme Greenhouse",
      careersUrl: "https://boards.greenhouse.io/acme",
    });
    assert(source.healthStatus === "not_yet_synced", "new source is not yet synced");

    console.log("F — structured adapter creates normalized jobs");
    const first = await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: source.id,
      trigger: "manual",
      deps: depsFor([
        greenhouseJob(101, "<p>Maintain equipment.</p>"),
        greenhouseJob(102, "<p>Plan the work.</p>"),
      ]),
    });
    assert(first.outcome === "succeeded", first.message);
    assert(first.newCount === 2, "two jobs created");
    const [live] = await db.select().from(careerSources).where(eq(careerSources.id, source.id));
    assert(live.healthStatus === "live", "successful structured sync is live");
    const sourced = await db.select().from(jobs).where(eq(jobs.careerSourceId, source.id));
    assert(sourced.length === 2, "two canonical jobs");
    assert(sourced.every((row) => row.jobContextType === "monitored_public"), "context is monitored public");
    assert(sourced.every((row) => row.demandHorizon === "current"), "discovered horizon stays current");
    assert(sourced.every((row) => row.skillbridgeEligible === false), "discovered jobs are not SkillBridge by default");
    const technician = sourced.find((row) => row.externalKey === "101");
    assert(technician, "technician job stored");
    const versions = () => db.select().from(jobDescriptionVersions).where(eq(jobDescriptionVersions.jobId, technician.id));
    assert((await versions()).length === 1, "first observation writes one description version");

    console.log("J — source URL attribution persists");
    assert(technician.sourceUrl === "https://boards.greenhouse.io/acme/jobs/101", "source URL stored");
    assert(technician.companyId === companyA, "company stored");
    assert(technician.lastObservedAt instanceof Date, "last observed timestamp stored");

    console.log("C — re-import does not duplicate");
    const again = await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: source.id,
      trigger: "manual",
      deps: depsFor([greenhouseJob(101, "<p>Maintain equipment.</p>"), greenhouseJob(102, "<p>Plan the work.</p>")]),
    });
    assert(again.newCount === 0 && again.unchangedCount === 2, "same keys are unchanged");
    const afterReimport = await db.select().from(jobs).where(eq(jobs.careerSourceId, source.id));
    assert(afterReimport.length === 2, "re-import did not insert a duplicate");

    console.log("E — whitespace-only change does not create a version");
    await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: source.id,
      trigger: "manual",
      deps: depsFor([
        greenhouseJob(101, "<p>Maintain&nbsp;equipment.</p>"),
        greenhouseJob(102, "<p>Plan the work.</p>"),
      ]),
    });
    assert((await versions()).length === 1, "whitespace and markup did not version the description");

    console.log("D — changed description creates a version");
    const changed = await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: source.id,
      trigger: "manual",
      deps: depsFor([
        greenhouseJob(101, "<p>Maintain equipment and pumps.</p>"),
        greenhouseJob(102, "<p>Plan the work.</p>"),
      ]),
    });
    assert(changed.changedCount === 1, "material description change is counted");
    const versionRows = await versions();
    assert(versionRows.length === 2, "material change writes a description version");
    assert(versionRows.every((row) => row.externalKey === "101"), "version keeps the external key");
    assert(new Set(versionRows.map((row) => row.contentHash)).size === 2, "version hashes differ");

    console.log("G — source outage does not close jobs");
    const outage = await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: source.id,
      trigger: "manual",
      deps: depsFor("throw"),
    });
    assert(outage.outcome === "failed" && outage.closedCount === 0, "outage closes nothing");
    const duringOutage = await db.select().from(jobs).where(eq(jobs.careerSourceId, source.id));
    assert(duringOutage.every((row) => row.status === "open" && row.closedAt === null), "existing jobs stay open");
    const [errored] = await db.select().from(careerSources).where(eq(careerSources.id, source.id));
    assert(errored.healthStatus === "error", "outage is an error, not live");

    console.log("H — confirmed removed posting becomes closed");
    const removed = await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: source.id,
      trigger: "manual",
      deps: depsFor([greenhouseJob(101, "<p>Maintain equipment and pumps.</p>")]),
    });
    assert(removed.closedCount === 1, "missing open key is closed");
    const closed = duringOutage.find((row) => row.externalKey === "102");
    const [closedRow] = await db.select().from(jobs).where(eq(jobs.id, closed!.id));
    assert(closedRow.status === "closed" && closedRow.closedAt instanceof Date, "closed_at is set");

    console.log("I — closed posting remains readable");
    assert(closedRow.title === "Planner", "closed job title remains");
    assert(closedRow.archivedAt === null, "closed job is not archived");

    console.log("A — manual URL job stored with a source");
    const manualSource = await createCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      companyId: companyA,
      sourceType: "manual_url",
      name: "Acme manual pages",
      careersUrl: "https://jobs.example.test/manual",
    });
    const manualImport = await importManualJob({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: manualSource.id,
      job: {
        externalKey: "manual-1",
        title: "Manual import technician",
        location: "Austin",
        description: "Entered by an operator.",
        sourceUrl: "https://jobs.example.test/jobs/manual-1",
        department: null,
        employmentType: null,
        workplaceType: null,
        publicSalaryText: null,
        compensationMin: null,
        compensationMax: null,
        qualifications: null,
        certifications: null,
        education: null,
        experience: null,
      },
    });
    assert(manualImport.outcome === "succeeded" && manualImport.newCount === 1, "manual URL import creates a job");
    const [manualJob] = await db.select().from(jobs).where(eq(jobs.externalKey, "manual-1"));
    assert(manualJob.careerSourceId === manualSource.id, "manual job keeps its source");
    assert(manualJob.sourceUrl === "https://jobs.example.test/jobs/manual-1", "manual source URL stored");
    const [manualHealth] = await db.select().from(careerSources).where(eq(careerSources.id, manualSource.id));
    assert(manualHealth.healthStatus === "manual", "manual import is manual, not live");

    console.log("B — CSV import creates canonical jobs");
    const csvSource = await createCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      companyId: companyA,
      sourceType: "csv",
      name: "Acme CSV",
    });
    const csv = [
      "external_id,title,company,location,description,source_url,open",
      "CSV-1,CSV Technician,Acme Field,Austin,From a file,https://jobs.example.test/jobs/csv-1,open",
      "CSV-2,CSV Planner,Acme Field,Dallas,Also from a file,https://jobs.example.test/jobs/csv-2,open",
    ].join("\n");
    const imported = await importCsvJobs({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: csvSource.id,
      csvText: csv,
    });
    assert(imported.newCount === 2, "CSV creates two jobs");
    const csvAgain = await importCsvJobs({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: csvSource.id,
      csvText: csv,
    });
    assert(csvAgain.newCount === 0 && csvAgain.unchangedCount === 2, "CSV re-import does not duplicate");
    const csvJobs = await db.select().from(jobs).where(eq(jobs.careerSourceId, csvSource.id));
    assert(csvJobs.length === 2, "CSV jobs stay unique");

    const [evergreenAfter] = await db.select().from(jobs).where(eq(jobs.id, evergreen.id));
    assert(evergreenAfter.demandHorizon === "evergreen", "evergreen horizon unchanged");
    assert(evergreenAfter.skillbridgeEligible === true, "existing SkillBridge flag unchanged");
    assert(evergreenAfter.jobContextType === "monitored_public", "existing monitored context unchanged");
    const [exploratoryAfter] = await db.select().from(jobs).where(eq(jobs.id, exploratory.id));
    assert(exploratoryAfter.jobContextType === "exploratory" && exploratoryAfter.demandHorizon === "future", "exploratory demand unchanged");
    const [manualAfter] = await db.select().from(jobs).where(eq(jobs.id, manual.id));
    assert(manualAfter.careerSourceId === null && manualAfter.status === "open", "hand-entered job unchanged");

    console.log("O — no candidate data is involved");
    const people = await db.select().from(candidates).where(eq(candidates.organizationId, orgA));
    assert(people.length === 1, "discovery did not create a candidate");
    const audits = await db.select().from(auditEvents).where(eq(auditEvents.organizationId, orgA));
    assert(!JSON.stringify(audits).includes(email), "audit snapshots do not include the fixture email");
    assert(audits.some((row) => row.action === "career_source.sync_completed"), "sync is audited");

    console.log("P — matching score unchanged");
    const [matchAfter] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, match.id));
    assert(matchAfter.score === match.score, "candidate job match score is unchanged");
    const opps = await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.organizationId, orgA));
    assert(opps.length === 0, "CRM opportunities were not created");

    console.log("K — cross-organization source and job writes fail");
    let functionRejected = false;
    try {
      await syncCareerSource({
        organizationId: orgB,
        actorUserId: userA,
        careerSourceId: source.id,
        trigger: "manual",
        deps: depsFor([greenhouseJob(101, "<p>Maintain equipment and pumps.</p>")]),
      });
    } catch (error) {
      functionRejected = error instanceof OpportunityDiscoveryError;
    }
    assert(functionRejected, "sync rejects another organization's source");
    let rawJobRejected = false;
    try {
      await db.execute(sql`
        insert into jobs (organization_id, company_id, title, career_source_id, external_key, source_url, job_context_type)
        values (${orgB}::uuid, ${companyB}::uuid, 'Cross job', ${source.id}::uuid, 'cross-key', 'https://example.com/cross', 'monitored_public')
      `);
    } catch {
      rawJobRejected = true;
    }
    assert(rawJobRejected, "database rejects a job attached to another organization's source");
    let rawRunRejected = false;
    try {
      await db.execute(sql`
        insert into career_source_sync_runs (organization_id, career_source_id, status, trigger)
        values (${orgB}::uuid, ${source.id}::uuid, 'succeeded', 'manual')
      `);
    } catch {
      rawRunRejected = true;
    }
    assert(rawRunRejected, "database rejects a sync run for another organization's source");
    let rawSourceRejected = false;
    try {
      await db.execute(sql`
        insert into career_sources (organization_id, company_id, source_type, name)
        values (${orgB}::uuid, ${companyA}::uuid, 'csv', 'Cross source')
      `);
    } catch {
      rawSourceRejected = true;
    }
    assert(rawSourceRejected, "database rejects a source attached to another organization's company");

    console.log("L — private URL fetch is rejected");
    let privateRejected = false;
    try {
      await safeFetch("http://10.1.2.3/jobs", { fetchImpl: async () => new Response("no"), lookup: async () => ["10.1.2.3"], minIntervalMs: 0 });
    } catch {
      privateRejected = true;
    }
    assert(privateRejected && isPrivateAddress("169.254.169.254"), "private and metadata addresses are rejected");

    console.log("M — redirect to a private URL is rejected");
    let redirectRejected = false;
    let redirectCalls = 0;
    try {
      await safeFetch("https://public.example/job", {
        fetchImpl: async () => {
          redirectCalls += 1;
          return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
        },
        lookup: async () => ["8.8.8.8"],
        minIntervalMs: 0,
      });
    } catch {
      redirectRejected = true;
    }
    assert(redirectRejected && redirectCalls === 1, "redirect to loopback is not followed");

    console.log("N — unsupported source is not bypassed");
    const workday = await createCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      companyId: companyA,
      sourceType: "public_careers_page",
      name: "Workday page",
      careersUrl: "https://acme.wd5.myworkdayjobs.com/en-US/careers",
    });
    assert(workday.healthStatus === "blocked", "login-wall host is blocked at registration");
    let fetches = 0;
    const refused = await syncCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      careerSourceId: workday.id,
      trigger: "manual",
      deps: {
        fetchImpl: async () => {
          fetches += 1;
          return new Response("no");
        },
        lookup: async () => ["8.8.8.8"],
        minIntervalMs: 0,
      },
    });
    assert(refused.outcome === "refused" && fetches === 0, "Workday sync does not fetch");
    assert(!ROLE_PERMISSIONS.recruiter.includes("opportunities.read"), "recruiter still lacks opportunities.read");

    const same = employerJobContentHash({
      externalKey: "x",
      title: "Field Technician",
      location: null,
      description: "Maintain equipment.",
      sourceUrl: "https://example.com/jobs/1",
      department: null,
      employmentType: null,
      workplaceType: null,
      publicSalaryText: null,
      compensationMin: null,
      compensationMax: null,
      qualifications: null,
      certifications: null,
      education: null,
      experience: null,
    });
    assert(same.length === 64, "content hash is sha256");
    console.log("M4 opportunity discovery smoke passed");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
