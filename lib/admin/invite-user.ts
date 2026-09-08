import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { roles, users } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { sendWorkforceOsInvitation } from "../auth/clerk-invite";
import { assertRoleAssignmentAllowed } from "../rbac/assign-role";
import { AuthorizationError, requirePermission, type Principal, type RoleSlug } from "../rbac/permissions";
import { assignUserRole, countManagingPartners } from "../repositories/platform";

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function inviteDisplayName(fullName: string | undefined, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;
  const local = email.split("@")[0]?.replace(/[._+-]+/g, " ").trim();
  return local || email;
}

export function inviteResultMessage(input: {
  email: string;
  roleName: string;
  resent: boolean;
  invitationSent: boolean;
}) {
  if (input.invitationSent) {
    const verb = input.resent ? "resent" : "sent";
    return `Invitation ${verb} to ${input.email}. They will have ${input.roleName} when they sign in.`;
  }
  const recorded = input.resent ? "Updated" : "Recorded";
  return `${recorded} ${input.email} as invited with ${input.roleName}. Clerk is not configured, so no email was sent.`;
}

export async function inviteOrganizationUser(input: {
  actor: Principal;
  email: string;
  fullName?: string;
  roleSlug: RoleSlug;
  sendInvitation?: typeof sendWorkforceOsInvitation;
}) {
  requirePermission(input.actor, "admin.users");
  requirePermission(input.actor, "admin.roles");

  const email = normalizeInviteEmail(input.email);
  if (!email.includes("@")) {
    throw new Error("Enter a valid work email.");
  }
  const fullName = inviteDisplayName(input.fullName, email);
  const sendInvitation = input.sendInvitation ?? sendWorkforceOsInvitation;

  const db = getDb();
  const [actorRow] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, input.actor.id))
    .limit(1);
  if (actorRow && normalizeInviteEmail(actorRow.email) === email) {
    throw new AuthorizationError("You cannot invite yourself.");
  }

  const [roleRow] = await db
    .select()
    .from(roles)
    .where(
      and(eq(roles.organizationId, input.actor.organizationId), eq(roles.slug, input.roleSlug), isNull(roles.archivedAt)),
    )
    .limit(1);
  if (!roleRow) {
    throw new Error("That role is not available.");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, input.actor.organizationId), eq(users.email, email)))
    .limit(1);

  if (existing?.id === input.actor.id) {
    throw new AuthorizationError("You cannot invite yourself.");
  }

  const managingPartnerCount = await countManagingPartners(input.actor.organizationId);
  let resent = false;
  let userId: string;

  if (existing) {
    if (existing.archivedAt) {
      throw new Error("That email belongs to an archived person. Restore them instead of inviting again.");
    }
    if (existing.status === "disabled") {
      throw new Error("That person is disabled. Enable them on this page instead of inviting again.");
    }
    if (existing.status === "active" || existing.clerkUserId) {
      throw new Error("That person already has access. Assign their role on this page.");
    }
    if (existing.status !== "invited") {
      throw new Error("That person already has access. Assign their role on this page.");
    }

    resent = true;
    userId = existing.id;
    if (input.fullName?.trim() && existing.fullName !== fullName) {
      await db
        .update(users)
        .set({ fullName, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
    await assignUserRole({
      actor: input.actor,
      userId: existing.id,
      roleSlug: input.roleSlug,
    });
  } else {
    assertRoleAssignmentAllowed({
      actor: input.actor,
      nextSlug: input.roleSlug,
      currentSlugs: [],
      managingPartnerCount,
    });

    const [created] = await db
      .insert(users)
      .values({
        organizationId: input.actor.organizationId,
        clerkUserId: null,
        email,
        fullName,
        status: "invited",
      })
      .returning();
    if (!created) {
      throw new Error("Unable to record the invited person.");
    }
    userId = created.id;
    await assignUserRole({
      actor: input.actor,
      userId: created.id,
      roleSlug: input.roleSlug,
    });
  }

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: resent ? "user.invite.resend" : "user.invited",
    recordType: "user",
    recordId: userId,
    after: { email, roleSlug: input.roleSlug, invitation: "clerk" },
  });

  try {
    const delivery = await sendInvitation(email);
    return {
      userId,
      email,
      roleSlug: input.roleSlug,
      roleName: roleRow.name,
      resent,
      invitationSent: delivery.sent,
      message: inviteResultMessage({
        email,
        roleName: roleRow.name,
        resent,
        invitationSent: delivery.sent,
      }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Clerk could not send the invitation email.";
    throw new Error(
      `Saved as invited with ${roleRow.name}. ${reason} Open Invite person and submit again to resend the email.`,
    );
  }
}
