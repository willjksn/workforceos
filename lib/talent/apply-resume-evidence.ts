import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { candidateClearances, candidateCredentials, candidateEducation } from "../../db/schema";
import { planResumeEvidenceSuggestions } from "./resume-suggestions";

/**
 * Inserts resume suggestions into empty evidence only.
 * Existing rows, including human-reviewed rows, are not updated.
 */
export async function applyResumeEvidenceSuggestions(input: {
  organizationId: string;
  candidateId: string;
  text: string;
  sourceReference?: string | null;
}) {
  const db = getDb();
  const [educationRows, credentialRows, clearanceRows] = await Promise.all([
    db
      .select()
      .from(candidateEducation)
      .where(
        and(
          eq(candidateEducation.candidateId, input.candidateId),
          eq(candidateEducation.organizationId, input.organizationId),
        ),
      ),
    db
      .select()
      .from(candidateCredentials)
      .where(
        and(
          eq(candidateCredentials.candidateId, input.candidateId),
          eq(candidateCredentials.organizationId, input.organizationId),
        ),
      ),
    db
      .select()
      .from(candidateClearances)
      .where(
        and(
          eq(candidateClearances.candidateId, input.candidateId),
          eq(candidateClearances.organizationId, input.organizationId),
        ),
      )
      .limit(1),
  ]);
  const existingClearance = clearanceRows[0] ?? null;
  const plan = planResumeEvidenceSuggestions({
    text: input.text,
    existingEducation: educationRows.map((row) => ({
      institution: row.institution,
      degreeOrCredential: row.degreeOrCredential,
      humanVerified: row.humanVerified,
    })),
    existingCredentials: credentialRows.map((row) => ({
      name: row.name,
      humanVerified: row.humanVerified,
    })),
    existingClearance: existingClearance
      ? { clearanceLevel: existingClearance.clearanceLevel, humanVerified: existingClearance.humanVerified }
      : null,
  });

  const added: string[] = [];
  if (plan.education.length) {
    await db.insert(candidateEducation).values(
      plan.education.map((row) => ({
        organizationId: input.organizationId,
        candidateId: input.candidateId,
        institution: row.institution,
        degreeOrCredential: row.degreeOrCredential,
        fieldOfStudy: row.fieldOfStudy,
        source: row.source,
        sourceReference: input.sourceReference ?? null,
        humanVerified: false,
        confidence: row.confidence,
      })),
    );
    added.push("education");
  }
  if (plan.credentials.length) {
    await db.insert(candidateCredentials).values(
      plan.credentials.map((row) => ({
        organizationId: input.organizationId,
        candidateId: input.candidateId,
        name: row.name,
        source: row.source,
        sourceReference: input.sourceReference ?? null,
        humanVerified: false,
        confidence: row.confidence,
      })),
    );
    added.push("credentials");
  }
  if (plan.clearance && !existingClearance) {
    await db.insert(candidateClearances).values({
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      clearanceLevel: plan.clearance.clearanceLevel,
      clearanceStatus: plan.clearance.clearanceStatus,
      source: plan.clearance.source,
      sourceReference: input.sourceReference ?? null,
      humanVerified: false,
    });
    added.push("clearance");
  }

  return { added, preservedHumanReviewed: plan.preservedHumanReviewed };
}
