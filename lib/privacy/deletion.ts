import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { candidates, privacyDeletionRequests } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { AuthorizationError, requirePermission, type Principal } from "../rbac/permissions";
import { assertOrganizationScope } from "../security/record-scope";

export async function executePrivacyDeletion(input: {
  actor: Principal;
  candidateId: string;
  reason: string;
}) {
  requirePermission(input.actor, "privacy.delete");
  const db = getDb();
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, input.candidateId)).limit(1);
  if (!candidate) throw new AuthorizationError("Record not found");
  assertOrganizationScope(candidate.organizationId, input.actor.organizationId);
  if (candidate.privacyDeletedAt) {
    return candidate;
  }

  const [request] = await db
    .insert(privacyDeletionRequests)
    .values({
      organizationId: input.actor.organizationId,
      candidateId: candidate.id,
      requestedByUserId: input.actor.id,
      status: "completed",
      reason: input.reason,
      completedAt: new Date(),
    })
    .returning();

  const [updated] = await db
    .update(candidates)
    .set({
      fullName: "REDACTED CANDIDATE",
      email: `redacted-${candidate.id}@privacy.local`,
      phone: null,
      linkedinUrl: null,
      compensationExpectations: null,
      currentCompany: null,
      city: null,
      region: null,
      careerInterests: null,
      doNotContact: true,
      consentStatus: "withdrawn",
      privacyDeletedAt: new Date(),
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, candidate.id))
    .returning();

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "candidate.privacy_deleted",
    recordType: "candidate",
    recordId: candidate.id,
    before: {
      id: candidate.id,
      fullName: "[redacted]",
      email: "[redacted]",
      phone: "[redacted]",
    },
    after: {
      id: updated.id,
      fullName: updated.fullName,
      privacyDeletedAt: updated.privacyDeletedAt,
      requestId: request.id,
    },
    reason: input.reason,
  });

  return updated;
}
