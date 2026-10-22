import "./load-env";

import { randomUUID } from "node:crypto";

import { inArray, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateClearances,
  candidateCredentials,
  candidateEducation,
  candidateEngagements,
  candidateJobMatches,
  candidateMilitaryDuties,
  candidateMilitaryEquipment,
  candidateMilitaryExperiences,
  candidateMilitaryTraining,
  candidates,
  militaryOccupations,
  organizations,
  skillbridgeDocuments,
  skillbridgeNotes,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skillbridgeTargetRoles,
  users,
} from "../db/schema";
import { persistMilitaryTalentIntake } from "../lib/military-talent/public-intake";
import { assessTransitionProfile } from "../lib/military-talent/profile-completeness";
import {
  addMilitaryDuty,
  addMilitaryEquipment,
  addMilitaryExperience,
  completeTransitionProfileReview,
  setCurrentClearance,
  TransitionEvidenceError,
  updateTransitionProfile,
} from "../lib/military-talent/transition-evidence";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { assertDevSeedAllowed } from "../lib/seed/guards";
import { applyResumeEvidenceSuggestions } from "../lib/talent/apply-resume-evidence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  if (/prod/i.test(branch)) {
    throw new Error("Refusing the M2 transition profile test against a production Neon branch.");
  }

  const db = getDb();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const candidateId = randomUUID();
  const civilianId = randomUUID();
  const bareCandidateId = randomUUID();
  const occupationId = randomUUID();
  const actor = { organizationId: orgA, userId: userA };

  async function cleanup() {
    const people = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(inArray(candidates.organizationId, [orgA, orgB]));
    const personIds = people.map((row) => row.id);
    const profiles = await db
      .select({ id: skillbridgeProfiles.id })
      .from(skillbridgeProfiles)
      .where(inArray(skillbridgeProfiles.organizationId, [orgA, orgB]));
    const profileIds = profiles.map((row) => row.id);
    if (profileIds.length) {
      await db.delete(skillbridgePreferredLocations).where(inArray(skillbridgePreferredLocations.skillbridgeProfileId, profileIds));
      await db.delete(skillbridgeTargetRoles).where(inArray(skillbridgeTargetRoles.skillbridgeProfileId, profileIds));
      await db.delete(skillbridgeNotes).where(inArray(skillbridgeNotes.skillbridgeProfileId, profileIds));
      await db.delete(skillbridgeDocuments).where(inArray(skillbridgeDocuments.skillbridgeProfileId, profileIds));
    }
    if (personIds.length) {
      await db.delete(candidateEngagements).where(inArray(candidateEngagements.candidateId, personIds));
      await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.candidateId, personIds));
    }
    await db.delete(candidateMilitaryDuties).where(inArray(candidateMilitaryDuties.organizationId, [orgA, orgB]));
    await db.delete(candidateMilitaryEquipment).where(inArray(candidateMilitaryEquipment.organizationId, [orgA, orgB]));
    await db.delete(candidateMilitaryTraining).where(inArray(candidateMilitaryTraining.organizationId, [orgA, orgB]));
    await db.delete(candidateEducation).where(inArray(candidateEducation.organizationId, [orgA, orgB]));
    await db.delete(candidateCredentials).where(inArray(candidateCredentials.organizationId, [orgA, orgB]));
    await db.delete(candidateClearances).where(inArray(candidateClearances.organizationId, [orgA, orgB]));
    await db.delete(candidateMilitaryExperiences).where(inArray(candidateMilitaryExperiences.organizationId, [orgA, orgB]));
    await db.delete(skillbridgeProfiles).where(inArray(skillbridgeProfiles.organizationId, [orgA, orgB]));
    await db.delete(candidates).where(inArray(candidates.organizationId, [orgA, orgB]));
    await db.delete(militaryOccupations).where(inArray(militaryOccupations.id, [occupationId]));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, [orgA, orgB]));
    await db.delete(users).where(inArray(users.organizationId, [orgA, orgB]));
    await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  }

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M2 Profile A", slug: `m2-profile-a-${orgA.slice(0, 8)}` },
      { id: orgB, name: "M2 Profile B", slug: `m2-profile-b-${orgB.slice(0, 8)}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email: `m2-${userA.slice(0, 8)}@workforceos.test`,
      fullName: "M2 Recruiter",
      status: "active",
    });
    await db.insert(militaryOccupations).values({
      id: occupationId,
      branch: "navy",
      classificationType: "rating",
      code: `M2${occupationId.slice(0, 6)}`,
      title: "M2 Test Rating",
    });
    await db.insert(candidates).values([
      {
        id: candidateId,
        organizationId: orgA,
        fullName: "M2 Sailor",
        militaryStatus: "active_duty",
        phone: "555-0100",
        compensationExpectations: "$90,000",
      },
      {
        id: civilianId,
        organizationId: orgA,
        fullName: "M2 Civilian",
        militaryStatus: "none",
      },
      {
        id: bareCandidateId,
        organizationId: orgA,
        fullName: "M2 Bare",
        militaryStatus: "unknown",
      },
    ]);

    console.log("A — one candidate, one Transition Talent Profile");
    const [profile] = await db
      .insert(skillbridgeProfiles)
      .values({
        organizationId: orgA,
        candidateId,
        branch: "navy",
        rankTitle: "Petty Officer",
        mosRateAfscDisplay: "EM",
        separationDate: new Date("2027-06-01T00:00:00.000Z"),
        skillbridgeWindowStart: new Date("2027-01-01T00:00:00.000Z"),
        skillbridgeWindowEnd: new Date("2027-05-01T00:00:00.000Z"),
      })
      .returning();
    const profiles = await db.select().from(skillbridgeProfiles).where(inArray(skillbridgeProfiles.candidateId, [candidateId]));
    assert(profiles.length === 1, "candidate has one transition profile");
    let secondProfileRejected = false;
    try {
      await db.insert(skillbridgeProfiles).values({ organizationId: orgA, candidateId });
    } catch {
      secondProfileRejected = true;
    }
    assert(secondProfileRejected, "a second transition profile for the same candidate is rejected");

    console.log("C — existing profile columns load unchanged");
    const [loaded] = await db.select().from(skillbridgeProfiles).where(inArray(skillbridgeProfiles.id, [profile.id]));
    assert(loaded.rankTitle === "Petty Officer", "snapshot rank remains readable");
    assert(loaded.careerPriorities == null, "new priority field stays empty when it was not provided");
    assert(loaded.mosRateAfscDisplay === "EM", "legacy occupation display remains");

    console.log("D — SkillBridge pathway dates remain functional");
    const updated = await updateTransitionProfile({
      actor,
      candidateId,
      patch: {
        skillbridgeWindowStart: new Date("2027-02-01T00:00:00.000Z"),
        skillbridgeWindowEnd: new Date("2027-05-15T00:00:00.000Z"),
      },
    });
    assert(updated.skillbridgeWindowStart?.toISOString().startsWith("2027-02-01"), "window start updates");
    assert(updated.skillbridgeWindowEnd?.toISOString().startsWith("2027-05-15"), "window end updates");
    assert(updated.separationDate?.toISOString().startsWith("2027-06-01"), "separation date stays in place");

    console.log("B — one candidate, multiple military experiences");
    const firstTour = await addMilitaryExperience({
      actor,
      candidateId,
      branch: "navy",
      code: `M2${occupationId.slice(0, 6)}`,
      rank: "E-5",
      unit: "Engineering",
    });
    const secondTour = await db
      .insert(candidateMilitaryExperiences)
      .values({
        organizationId: orgA,
        candidateId,
        militaryOccupationId: occupationId,
        rank: "E-4",
        platforms: "CVN electrical distribution",
        training: "A school narrative",
        certifications: "Navy COOL note",
        clearance: "Secret while assigned",
        notes: "Stood engineering watches",
      })
      .returning();
    const tours = await db
      .select()
      .from(candidateMilitaryExperiences)
      .where(inArray(candidateMilitaryExperiences.candidateId, [candidateId]));
    assert(tours.length === 2, "two tours attach to one candidate");

    console.log("E — structured duties attach to the correct experience");
    const duty = await addMilitaryDuty({
      actor,
      candidateId,
      experienceId: firstTour.id,
      title: "Maintained shipboard power",
      description: "Electrical distribution watches",
      source: "recruiter",
      humanVerified: true,
    });
    const duties = await db.select().from(candidateMilitaryDuties).where(inArray(candidateMilitaryDuties.organizationId, [orgA]));
    assert(duties.length === 1 && duties[0]?.candidateMilitaryExperienceId === firstTour.id, "duty stays on the first tour");
    assert(duties.every((row) => row.candidateMilitaryExperienceId !== secondTour[0]?.id), "second tour has no duty");
    const [narrative] = await db
      .select()
      .from(candidateMilitaryExperiences)
      .where(inArray(candidateMilitaryExperiences.id, [secondTour[0].id]));
    assert(narrative.notes === "Stood engineering watches", "legacy duty narrative is preserved");
    assert(narrative.platforms === "CVN electrical distribution", "legacy platform text is preserved");
    assert(narrative.training === "A school narrative", "legacy training text is preserved");
    assert(narrative.certifications === "Navy COOL note", "legacy certification text is preserved");
    assert(narrative.clearance === "Secret while assigned", "historical clearance text is preserved");
    const structuredFromText = duties.filter((row) => row.candidateMilitaryExperienceId === secondTour[0]?.id);
    assert(structuredFromText.length === 0, "ambiguous legacy text was not fabricated into duties");

    console.log("F — equipment evidence is tenant-safe");
    const equipment = await addMilitaryEquipment({
      actor,
      candidateId,
      experienceId: firstTour.id,
      name: "400 Hz distribution",
      kind: "system",
      source: "recruiter",
      humanVerified: true,
    });
    assert(equipment.organizationId === orgA, "equipment uses the candidate organization");
    let equipmentRejected = false;
    try {
      await db.execute(sql`
        insert into candidate_military_equipment (
          organization_id, candidate_military_experience_id, name, kind, source, human_verified
        ) values (
          ${orgB}::uuid, ${firstTour.id}::uuid, 'foreign system', 'system', 'recruiter', true
        )
      `);
    } catch {
      equipmentRejected = true;
    }
    assert(equipmentRejected, "database rejects equipment linked to another organization");

    console.log("G — education works for military and non-military candidates");
    await db.insert(candidateEducation).values([
      {
        organizationId: orgA,
        candidateId,
        institution: "Old Dominion University",
        degreeOrCredential: "Bachelor of Science",
        fieldOfStudy: "Electrical Engineering",
        source: "recruiter",
        humanVerified: true,
      },
      {
        organizationId: orgA,
        candidateId: civilianId,
        institution: "Community College",
        degreeOrCredential: "Associate of Science",
        source: "candidate",
        humanVerified: false,
      },
    ]);
    const education = await db.select().from(candidateEducation).where(inArray(candidateEducation.organizationId, [orgA]));
    assert(education.length === 2, "education rows exist for both candidates");
    assert(education.some((row) => row.candidateId === civilianId), "non-military candidate can have education");

    console.log("H — credentials stay candidate-scoped");
    const [credential] = await db
      .insert(candidateCredentials)
      .values({
        organizationId: orgA,
        candidateId,
        name: "OSHA 30",
        issuer: "OSHA",
        source: "recruiter",
        humanVerified: true,
      })
      .returning();
    assert(credential.candidateId === candidateId, "credential points at the candidate");
    assert(!("candidateMilitaryExperienceId" in credential), "credential is not tour-scoped");

    console.log("I — resume extraction does not overwrite human-reviewed values");
    await setCurrentClearance({
      actor,
      candidateId,
      clearanceLevel: "secret",
      clearanceStatus: "reported_active",
      source: "recruiter",
      humanVerified: true,
    });
    const suggestion = await applyResumeEvidenceSuggestions({
      organizationId: orgA,
      candidateId,
      text: `
Education
Bachelor of Science in Mechanical Engineering, Old Dominion University
Certifications
OSHA 30
CompTIA Security+
Active Top Secret clearance
`,
    });
    const [clearance] = await db.select().from(candidateClearances).where(inArray(candidateClearances.candidateId, [candidateId]));
    assert(clearance.clearanceLevel === "secret", "human-reviewed clearance level stays secret");
    assert(clearance.humanVerified === true, "human-reviewed clearance flag stays");
    const [school] = await db
      .select()
      .from(candidateEducation)
      .where(inArray(candidateEducation.candidateId, [candidateId]));
    const militaryEducation = (await db.select().from(candidateEducation).where(inArray(candidateEducation.candidateId, [candidateId]))).find(
      (row) => row.institution === "Old Dominion University",
    );
    assert(militaryEducation?.fieldOfStudy === "Electrical Engineering", "human-reviewed field of study stays");
    assert(militaryEducation?.humanVerified === true, "human-reviewed education stays verified");
    const credentialRows = await db.select().from(candidateCredentials).where(inArray(candidateCredentials.candidateId, [candidateId]));
    const osha = credentialRows.find((row) => row.name === "OSHA 30");
    assert(osha?.issuer === "OSHA" && osha.humanVerified === true, "human-reviewed credential stays");
    const addedCert = credentialRows.find((row) => row.name === "CompTIA Security+");
    assert(addedCert?.humanVerified === false && addedCert.source === "resume", "new credential is an unverified resume suggestion");
    assert(suggestion.preservedHumanReviewed.includes("clearance"), "clearance is reported as preserved");
    void school;

    console.log("J — source and review state distinguish inferred from human-reviewed evidence");
    const inferred = await addMilitaryDuty({
      actor,
      candidateId,
      experienceId: firstTour.id,
      title: "Inferred watchstanding",
      source: "ai_extraction",
      humanVerified: false,
      confidence: 30,
    });
    assert(duty.humanVerified === true && duty.source === "recruiter", "recruiter duty is human reviewed");
    assert(inferred.humanVerified === false && inferred.source === "ai_extraction", "AI duty stays pending");

    console.log("K — recruiter permissions remain unchanged");
    assert(ROLE_PERMISSIONS.recruiter.includes("jobs.write"), "recruiter keeps jobs.write");
    assert(ROLE_PERMISSIONS.recruiter.includes("jobs.read"), "recruiter keeps jobs.read");
    console.log("L — no CRM opportunities.read grant");
    assert(!ROLE_PERMISSIONS.recruiter.includes("opportunities.read"), "recruiter still lacks opportunities.read");

    console.log("M — cross-organization profile and evidence linking is rejected");
    let repoRejected = false;
    try {
      await addMilitaryDuty({
        actor: { organizationId: orgB, userId: userA },
        candidateId,
        experienceId: firstTour.id,
        title: "Wrong tenant",
      });
    } catch (error) {
      repoRejected = error instanceof TransitionEvidenceError;
    }
    assert(repoRejected, "repository rejects a duty for another organization");
    let rawDutyRejected = false;
    try {
      await db.execute(sql`
        insert into candidate_military_duties (
          organization_id, candidate_military_experience_id, title, source, human_verified
        ) values (
          ${orgB}::uuid, ${firstTour.id}::uuid, 'raw cross duty', 'recruiter', true
        )
      `);
    } catch {
      rawDutyRejected = true;
    }
    assert(rawDutyRejected, "database rejects a cross-organization duty");
    let rawProfileRejected = false;
    try {
      await db.execute(sql`
        insert into skillbridge_profiles (organization_id, candidate_id)
        values (${orgB}::uuid, ${bareCandidateId}::uuid)
      `);
    } catch {
      rawProfileRejected = true;
    }
    assert(rawProfileRejected, "database rejects a profile in another organization");
    let rawEducationRejected = false;
    try {
      await db.execute(sql`
        insert into candidate_education (
          organization_id, candidate_id, institution, degree_or_credential, source, human_verified
        ) values (
          ${orgB}::uuid, ${civilianId}::uuid, 'Elsewhere', 'B.A.', 'recruiter', true
        )
      `);
    } catch {
      rawEducationRejected = true;
    }
    assert(rawEducationRejected, "database rejects cross-organization education");
    let rawCredentialRejected = false;
    try {
      await db.execute(sql`
        insert into candidate_credentials (
          organization_id, candidate_id, name, source, human_verified
        ) values (
          ${orgB}::uuid, ${candidateId}::uuid, 'Foreign cert', 'recruiter', true
        )
      `);
    } catch {
      rawCredentialRejected = true;
    }
    assert(rawCredentialRejected, "database rejects cross-organization credentials");

    console.log("N — completeness is informational and does not change match behavior");
    const beforeMatches = await db.select().from(candidateJobMatches).where(inArray(candidateJobMatches.candidateId, [candidateId]));
    const completeness = assessTransitionProfile({
      militaryExperiences: tours.map((row) => ({ certifications: row.certifications, training: row.training })),
      duties: [{ humanVerified: false }],
      equipment: [],
      trainingRecords: [],
      education: [{ humanVerified: true }],
      credentials: [{ humanVerified: true }],
      skillsCount: 0,
      separationDate: updated.separationDate,
      etsDate: null,
      eaosDate: null,
      endOfServiceDate: null,
      retirementDate: null,
      availableDate: null,
      preferredLocationPrimary: null,
      preferredLocationCount: 0,
      candidateCity: null,
      targetRoleCount: 0,
      resumeStatus: "missing",
      hasResumeFile: false,
    });
    assert(completeness.affectsMatch === false && completeness.affectsRank === false && completeness.affectsReject === false, "completeness flags stay informational");
    await completeTransitionProfileReview({ actor, candidateId });
    const afterMatches = await db.select().from(candidateJobMatches).where(inArray(candidateJobMatches.candidateId, [candidateId]));
    assert(beforeMatches.length === afterMatches.length, "profile review did not write match rows");
    const reviewAudits = await db.select().from(auditEvents).where(inArray(auditEvents.organizationId, [orgA]));
    assert(
      reviewAudits.some((row) => row.action === "transition_profile.review_completed"),
      "profile review is audited",
    );
    assert(reviewAudits.some((row) => row.action === "transition_profile.updated"), "profile update is audited");
    assert(reviewAudits.some((row) => row.action === "clearance.changed"), "clearance change is audited");
    assert(reviewAudits.some((row) => row.action === "military_experience.added"), "military experience add is audited");

    console.log("O — military intake still creates and updates one candidate profile");
    const email = `m2-intake-${randomUUID().slice(0, 8)}@workforceos.test`;
    const created = await persistMilitaryTalentIntake({
      organizationId: orgA,
      ownerUserId: userA,
      firstName: "Riley",
      lastName: "Intake",
      email,
      branch: "navy",
      mos: "EM",
      rank: "E-5",
      separationDate: "2027-08-01",
      skillbridgeWindowStart: "2027-03-01",
      skillbridgeWindowEnd: "2027-07-01",
      preferredLocation: "Norfolk, VA",
    });
    const again = await persistMilitaryTalentIntake({
      organizationId: orgA,
      ownerUserId: userA,
      firstName: "Riley",
      lastName: "Intake",
      email,
      branch: "navy",
      mos: "EM",
      rank: "E-5",
      separationDate: "2027-09-01",
      skillbridgeWindowStart: "2027-04-01",
      skillbridgeWindowEnd: "2027-08-01",
      preferredLocation: "Norfolk, VA",
    });
    assert(created.reusedCandidate === false, "first intake creates the candidate");
    assert(again.reusedCandidate === true, "second intake reuses the candidate");
    assert(created.profileId === again.profileId, "second intake updates the same transition profile");
    const intakeProfiles = await db.select().from(skillbridgeProfiles).where(inArray(skillbridgeProfiles.candidateId, [created.candidateId]));
    assert(intakeProfiles.length === 1, "intake does not create a second profile");
    assert(intakeProfiles[0]?.skillbridgeWindowStart?.toISOString().startsWith("2027-04-01"), "pathway window remains writable");
    const intakeAudits = await db.select().from(auditEvents).where(inArray(auditEvents.recordId, [created.profileId]));
    assert(intakeAudits.some((row) => row.action === "military_talent.submitted"), "intake still audits the profile");

    console.log("M2 transition profile checks passed.");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
