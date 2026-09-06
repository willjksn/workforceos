import type { getDb } from "../index";
import { applications, candidates, jobPostings, jobs } from "../schema";
import { COMPANY_ID, INTERNAL_ORG_ID, USER_IDS } from "./constants";

const P10 = "00000000-0000-4000-8d00";

export async function seedPhase10Fixtures(db: ReturnType<typeof getDb>) {
  const jobDefs = [
    { id: `${P10}-000000000001`, title: "Internal Recruiter", context: "internal" as const, slug: "internal-recruiter" },
    { id: `${P10}-000000000002`, title: "Operations Coordinator", context: "internal" as const, slug: "operations-coordinator" },
    { id: `${P10}-000000000003`, title: "Strategy Analyst", context: "internal" as const, slug: "strategy-analyst" },
    { id: `${P10}-000000000004`, title: "Plant Electrician", context: "client" as const, slug: "plant-electrician-charlotte" },
    { id: `${P10}-000000000005`, title: "Maintenance Supervisor", context: "client" as const, slug: "maintenance-supervisor" },
    { id: `${P10}-000000000006`, title: "Reliability Engineer", context: "client" as const, slug: "reliability-engineer" },
    { id: `${P10}-000000000007`, title: "SkillBridge Electrical Technician", context: "skillbridge" as const, slug: "skillbridge-electrical-technician" },
    { id: `${P10}-000000000008`, title: "SkillBridge Logistics Specialist", context: "skillbridge" as const, slug: "skillbridge-logistics-specialist" },
    { id: `${P10}-000000000009`, title: "SkillBridge Project Coordinator", context: "skillbridge" as const, slug: "skillbridge-project-coordinator" },
  ];

  for (const job of jobDefs) {
    await db
      .insert(jobs)
      .values({
        id: job.id,
        organizationId: INTERNAL_ORG_ID,
        companyId: job.context === "internal" ? null : COMPANY_ID,
        title: job.title,
        description: `Development fixture for ${job.title}. Not a real opening.`,
        status: "open",
        locationLabel: "Charlotte, NC",
        employmentType: "full_time",
        workplaceType: "on_site",
        searchOwnerUserId: USER_IDS.recruiter,
        jobContextType: job.context,
        postingVisibility: "public",
        clientVisibility: job.context === "client" ? "confidential" : "public",
        publicSlug: job.slug,
        skillbridgeEligible: job.context === "skillbridge",
      })
      .onConflictDoNothing();
    await db
      .insert(jobPostings)
      .values({
        organizationId: INTERNAL_ORG_ID,
        jobId: job.id,
        slug: job.slug,
        publicTitle: job.title,
        publicDescription: `Fake development posting for ${job.title}.`,
        location: "Charlotte, NC",
        employmentType: "full_time",
        workplaceType: "on_site",
        companyDisplay: job.context === "client" ? "Confidential client" : "PierOne Partners",
        visibility: "public",
        clientVisibility: job.context === "client" ? "confidential" : "public",
        publicStatus: "published",
        publishedAt: new Date(),
        applicationOpen: true,
        skillbridgeEligible: job.context === "skillbridge",
      })
      .onConflictDoNothing();
  }

  for (let i = 0; i < 22; i += 1) {
    const candidateId = `${P10}-0000000001${String(i).padStart(2, "0")}`;
    const applicationId = `${P10}-0000000002${String(i).padStart(2, "0")}`;
    const job = jobDefs[i % jobDefs.length];
    await db
      .insert(candidates)
      .values({
        id: candidateId,
        organizationId: INTERNAL_ORG_ID,
        fullName: `Fixture Applicant ${i + 1}`,
        email: `applicant${i + 1}@example.test`,
        phone: `70455501${String(i).padStart(2, "0")}`,
        city: "Charlotte",
        region: "NC",
        source: "career_site",
        currentTitle: "Applicant fixture",
      })
      .onConflictDoNothing();
    await db
      .insert(applications)
      .values({
        id: applicationId,
        organizationId: INTERNAL_ORG_ID,
        candidateId,
        jobId: job.id,
        source: i === 0 ? "skillbridge" : "career_site",
        status: "submitted",
        currentStage: i === 5 ? "interview" : i === 10 ? "pre_employment" : "applied",
        pipeline: job.context,
        recruiterUserId: USER_IDS.recruiter,
      })
      .onConflictDoNothing();
  }
}

export async function seedPhase10OnboardingTemplate() {
  const { ensureDefaultOnboardingTemplate } = await import("../../lib/hiring/service");
  await ensureDefaultOnboardingTemplate(INTERNAL_ORG_ID);
}
