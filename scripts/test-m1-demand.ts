import "./load-env";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidates,
  careerSources,
  companies,
  jobDescriptionVersions,
  jobRequisitions,
  jobs,
  organizations,
  searchProjects,
  skillbridgeProfiles,
  users,
} from "../db/schema";
import { saveJobDescriptionVersion } from "../lib/hiring/service";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { createCareerSource, createEmployerDemandJob, EmployerDemandError } from "../lib/recruiting/employer-demand";
import { createJobWithInternalSearch } from "../lib/repositories/recruiting";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  if (/prod/i.test(branch)) {
    throw new Error("Refusing the M1 demand test against a production Neon branch.");
  }

  const db = getDb();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const companyA = randomUUID();
  const companyA2 = randomUUID();
  const companyB = randomUUID();
  const candidateId = randomUUID();
  const createdJobIds: string[] = [];

  const principal = {
    id: userA,
    status: "active" as const,
    organizationId: orgA,
    roleSlugs: ["recruiter"],
    permissions: new Set(ROLE_PERMISSIONS.recruiter),
  };

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M1 Demand A", slug: `m1-demand-a-${orgA.slice(0, 8)}` },
      { id: orgB, name: "M1 Demand B", slug: `m1-demand-b-${orgB.slice(0, 8)}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email: `m1-${userA.slice(0, 8)}@workforceos.test`,
      fullName: "M1 Recruiter",
      status: "active",
    });
    await db.insert(companies).values([
      { id: companyA, organizationId: orgA, name: "M1 Employer A" },
      { id: companyA2, organizationId: orgA, name: "M1 Employer A2" },
      { id: companyB, organizationId: orgB, name: "M1 Employer B" },
    ]);

    console.log("A — existing contexts still insert");
    for (const jobContextType of ["internal", "client", "skillbridge"] as const) {
      const job = await createEmployerDemandJob({
        organizationId: orgA,
        actorUserId: userA,
        title: `M1 ${jobContextType}`,
        companyId: companyA,
        jobContextType,
      });
      createdJobIds.push(job.id);
      assert(job.jobContextType === jobContextType, `${jobContextType} context saved`);
      assert(job.demandHorizon === "current", "existing contexts default to current horizon");
      assert(job.careerSourceId === null, "existing contexts do not require a career source");
    }

    console.log("B — monitored public job without a candidate or requisition");
    const source = await createCareerSource({
      organizationId: orgA,
      actorUserId: userA,
      companyId: companyA,
      sourceType: "public_careers_page",
      name: "M1 public careers",
      baseUrl: "https://jobs.example.test",
      careersUrl: "https://jobs.example.test/careers",
    });
    const monitored = await createEmployerDemandJob({
      organizationId: orgA,
      actorUserId: userA,
      title: "Electrical technician",
      companyId: companyA,
      jobContextType: "monitored_public",
      careerSourceId: source.id,
      externalKey: "REQ-100",
      sourceUrl: "https://jobs.example.test/careers/REQ-100",
      contentHash: "abc123",
      demandHorizon: "evergreen",
      skillbridgeEligible: true,
    });
    createdJobIds.push(monitored.id);
    assert(monitored.companyId === companyA, "employer is stored");
    assert(monitored.careerSourceId === source.id, "career source is stored");
    assert(monitored.externalKey === "REQ-100", "external key is stored");
    assert(monitored.sourceUrl === "https://jobs.example.test/careers/REQ-100", "source URL is stored");
    assert(monitored.demandHorizon === "evergreen", "evergreen is a horizon on a monitored job");
    assert(monitored.skillbridgeEligible === true, "SkillBridge eligibility stays a flag");
    const requisitions = await db
      .select({ id: jobRequisitions.id })
      .from(jobRequisitions)
      .where(eq(jobRequisitions.organizationId, orgA));
    assert(requisitions.length === 0, "monitored job did not create a requisition");

    console.log("C — exploratory demand without a source, candidate, or requisition");
    const exploratory = await createEmployerDemandJob({
      organizationId: orgA,
      actorUserId: userA,
      title: "Future maintenance planner",
      companyId: companyA,
      jobContextType: "exploratory",
      demandHorizon: "future",
    });
    createdJobIds.push(exploratory.id);
    assert(exploratory.careerSourceId === null, "exploratory demand does not need a career source");
    assert(exploratory.externalKey === null, "exploratory demand does not need an external key");
    assert(exploratory.demandHorizon === "future", "future demand uses the horizon field");

    console.log("D — duplicate career source and external key is rejected");
    let duplicateRejected = false;
    try {
      await createEmployerDemandJob({
        organizationId: orgA,
        actorUserId: userA,
        title: "Electrical technician duplicate",
        companyId: companyA,
        jobContextType: "monitored_public",
        careerSourceId: source.id,
        externalKey: "REQ-100",
        sourceUrl: "https://jobs.example.test/careers/REQ-100",
      });
    } catch (error) {
      duplicateRejected = error instanceof EmployerDemandError;
    }
    assert(duplicateRejected, "duplicate external identity was rejected");

    console.log("E — manual job without a career source");
    const manual = await createJobWithInternalSearch({
      organizationId: orgA,
      actorUserId: userA,
      title: "M1 manual client search",
      companyId: companyA,
    });
    createdJobIds.push(manual.job.id);
    assert(manual.job.careerSourceId === null, "manual job has no career source");
    assert(manual.job.externalKey === null, "manual job has no external key");
    assert(manual.job.jobContextType === "client", "manual create keeps the client default");
    assert(manual.searchProject.id, "existing search-project create path still runs");

    console.log("F/G — transition profile still loads and stays one-to-one");
    await db.insert(candidates).values({
      id: candidateId,
      organizationId: orgA,
      fullName: "M1 Transition Candidate",
      militaryStatus: "veteran",
    });
    const [profile] = await db
      .insert(skillbridgeProfiles)
      .values({
        organizationId: orgA,
        candidateId,
        mosRateAfscDisplay: "LS",
        rankTitle: "LS2",
      })
      .returning();
    const [loaded] = await db
      .select()
      .from(skillbridgeProfiles)
      .where(and(eq(skillbridgeProfiles.id, profile.id), eq(skillbridgeProfiles.organizationId, orgA)));
    assert(loaded?.candidateId === candidateId, "existing SkillBridge profile row loads");
    let secondProfileRejected = false;
    try {
      await db.insert(skillbridgeProfiles).values({
        organizationId: orgA,
        candidateId,
      });
    } catch {
      secondProfileRejected = true;
    }
    assert(secondProfileRejected, "a candidate cannot have a second transition profile");

    console.log("I — tenant isolation");
    let crossOrgRejected = false;
    try {
      await createEmployerDemandJob({
        organizationId: orgB,
        actorUserId: userA,
        title: "Cross tenant",
        companyId: companyB,
        jobContextType: "monitored_public",
        careerSourceId: source.id,
        externalKey: "REQ-200",
        sourceUrl: "https://jobs.example.test/careers/REQ-200",
      });
    } catch (error) {
      crossOrgRejected = error instanceof EmployerDemandError;
    }
    assert(crossOrgRejected, "another organization cannot use this career source");
    let fkRejected = false;
    try {
      await db.insert(jobs).values({
        organizationId: orgB,
        companyId: companyB,
        title: "Raw cross tenant",
        jobContextType: "monitored_public",
        careerSourceId: source.id,
        externalKey: "REQ-300",
        sourceUrl: "https://jobs.example.test/careers/REQ-300",
      });
    } catch {
      fkRejected = true;
    }
    assert(fkRejected, "database foreign key rejects a cross-organization career source");

    let appCompanyRejected = false;
    try {
      await createCareerSource({
        organizationId: orgB,
        actorUserId: userA,
        companyId: companyA,
        sourceType: "manual_url",
        name: "Cross company source",
      });
    } catch (error) {
      appCompanyRejected = error instanceof EmployerDemandError;
    }
    assert(appCompanyRejected, "application rejects a career source for another organization's company");
    let companyFkRejected = false;
    try {
      await db.insert(careerSources).values({
        organizationId: orgB,
        companyId: companyA,
        sourceType: "manual_url",
        name: "Raw cross company source",
      });
    } catch {
      companyFkRejected = true;
    }
    assert(companyFkRejected, "database rejects a career source that references another organization's company");

    let mismatchRejected = false;
    try {
      await createEmployerDemandJob({
        organizationId: orgA,
        actorUserId: userA,
        title: "Wrong employer",
        companyId: companyA2,
        jobContextType: "monitored_public",
        careerSourceId: source.id,
        externalKey: "REQ-MISMATCH",
        sourceUrl: "https://jobs.example.test/careers/REQ-MISMATCH",
      });
    } catch (error) {
      mismatchRejected = error instanceof EmployerDemandError;
    }
    assert(mismatchRejected, "monitored public job cannot use a different employer than its career source");
    let jobCompanyFkRejected = false;
    try {
      await db.insert(jobs).values({
        organizationId: orgA,
        companyId: companyA2,
        title: "Raw employer mismatch",
        jobContextType: "monitored_public",
        careerSourceId: source.id,
        externalKey: "REQ-MISMATCH-RAW",
        sourceUrl: "https://jobs.example.test/careers/REQ-MISMATCH-RAW",
      });
    } catch {
      jobCompanyFkRejected = true;
    }
    assert(jobCompanyFkRejected, "database rejects a sourced job whose company differs from the career source");
    let sourcedWithoutCompanyRejected = false;
    try {
      await db.insert(jobs).values({
        organizationId: orgA,
        title: "Sourced without company",
        jobContextType: "monitored_public",
        careerSourceId: source.id,
        externalKey: "REQ-NO-COMPANY",
        sourceUrl: "https://jobs.example.test/careers/REQ-NO-COMPANY",
      });
    } catch {
      sourcedWithoutCompanyRejected = true;
    }
    assert(sourcedWithoutCompanyRejected, "a job with a career source must name that source's company");

    console.log("J — description versions still increment on the job");
    const first = await saveJobDescriptionVersion({
      principal,
      jobId: monitored.id,
      content: "First sourced description",
    });
    const second = await saveJobDescriptionVersion({
      principal,
      jobId: monitored.id,
      content: "Updated sourced description",
    });
    assert(first.version === 1 && second.version === 2, "description versions increment");
    const versions = await db
      .select()
      .from(jobDescriptionVersions)
      .where(eq(jobDescriptionVersions.jobId, monitored.id));
    assert(versions.length === 2, "both versions remain on job_description_versions");

    const sourceRows = await db.select().from(careerSources).where(eq(careerSources.id, source.id));
    assert(sourceRows.length === 1 && sourceRows[0]?.organizationId === orgA, "career source stays in its organization");
    console.log("M1 demand checks passed.");
  } finally {
    await db.delete(jobDescriptionVersions).where(eq(jobDescriptionVersions.createdByUserId, userA));
    if (createdJobIds.length) {
      await db.delete(searchProjects).where(eq(searchProjects.ownerUserId, userA));
    }
    await db.delete(jobs).where(eq(jobs.organizationId, orgA));
    await db.delete(jobs).where(eq(jobs.organizationId, orgB));
    await db.delete(skillbridgeProfiles).where(eq(skillbridgeProfiles.organizationId, orgA));
    await db.delete(candidates).where(eq(candidates.id, candidateId));
    await db.delete(careerSources).where(eq(careerSources.organizationId, orgA));
    await db.delete(careerSources).where(eq(careerSources.organizationId, orgB));
    await db.delete(companies).where(eq(companies.organizationId, orgA));
    await db.delete(companies).where(eq(companies.organizationId, orgB));
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, orgA));
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, orgB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(organizations).where(eq(organizations.id, orgA));
    await db.delete(organizations).where(eq(organizations.id, orgB));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
