import { inngest } from "../client";
import { createInAppNotification } from "../../notifications/service";
import { getMySkillBridgeQueue, getSkillBridgeMetrics } from "../../skillbridge/service";
import { findSkillBridgeMatches } from "../../skillbridge/matching";
import { getDb } from "../../../db";
import { skillbridgeProfiles, users } from "../../../db/schema";
import { INTERNAL_ORG_ID } from "../../../db/seed/constants";
import { and, eq, isNull } from "drizzle-orm";

export const skillbridgeFollowUpScanJob = inngest.createFunction(
  {
    id: "workforceos-skillbridge-follow-up-scan",
    triggers: [{ event: "workforceos/skillbridge-follow-up-scan" }, { cron: "0 13 * * *" }],
  },
  async ({ event }) => {
    const organizationId =
      event.data && typeof event.data === "object" && "organizationId" in event.data
        ? String((event.data as { organizationId?: string }).organizationId ?? INTERNAL_ORG_ID)
        : INTERNAL_ORG_ID;
    const db = getDb();
    const owners = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.status, "active")));
    let created = 0;
    for (const owner of owners) {
      const queue = await getMySkillBridgeQueue({
        organizationId,
        ownerUserId: owner.id,
        canReadPii: false,
      });
      for (const card of queue.overdueFollowUps) {
        const row = await createInAppNotification({
          organizationId,
          userId: owner.id,
          kind: "follow_up_overdue",
          title: `Follow-up overdue: ${card.candidate.fullName}`,
          href: `/app/military/skillbridge/${card.profile.id}`,
          recordType: "skillbridge_profile",
          recordId: card.profile.id,
        });
        if (row) created += 1;
      }
      for (const card of queue.windowsApproaching) {
        const row = await createInAppNotification({
          organizationId,
          userId: owner.id,
          kind: "skillbridge_window_approaching",
          title: `SkillBridge window approaching: ${card.candidate.fullName}`,
          href: `/app/military/skillbridge/${card.profile.id}`,
          recordType: "skillbridge_profile",
          recordId: card.profile.id,
        });
        if (row) created += 1;
      }
      for (const card of queue.employerFollowUps) {
        const row = await createInAppNotification({
          organizationId,
          userId: owner.id,
          kind: "employer_response_overdue",
          title: `Employer feedback overdue: ${card.candidate.fullName}`,
          href: `/app/military/skillbridge/${card.profile.id}`,
          recordType: "skillbridge_profile",
          recordId: card.profile.id,
        });
        if (row) created += 1;
      }
      for (const card of queue.documentsNeeded) {
        const row = await createInAppNotification({
          organizationId,
          userId: owner.id,
          kind: "resume_missing",
          title: `Resume missing: ${card.candidate.fullName}`,
          href: `/app/military/skillbridge/${card.profile.id}`,
          recordType: "skillbridge_profile",
          recordId: card.profile.id,
        });
        if (row) created += 1;
      }
      for (const card of queue.conversionDecisions) {
        const row = await createInAppNotification({
          organizationId,
          userId: owner.id,
          kind: "conversion_decision_approaching",
          title: `Conversion decision: ${card.candidate.fullName}`,
          href: `/app/military/skillbridge/${card.profile.id}`,
          recordType: "skillbridge_profile",
          recordId: card.profile.id,
        });
        if (row) created += 1;
      }
    }
    const metrics = await getSkillBridgeMetrics(organizationId);
    return { created, activeCandidates: metrics.activeCandidates };
  },
);

export const skillbridgeMatchJob = inngest.createFunction(
  {
    id: "workforceos-skillbridge-match",
    triggers: [{ event: "workforceos/skillbridge-match" }],
  },
  async ({ event }) => {
    const data = event.data as { organizationId: string; profileId?: string };
    const db = getDb();
    const profiles = data.profileId
      ? await db
          .select()
          .from(skillbridgeProfiles)
          .where(
            and(
              eq(skillbridgeProfiles.organizationId, data.organizationId),
              eq(skillbridgeProfiles.id, data.profileId),
              isNull(skillbridgeProfiles.archivedAt),
            ),
          )
      : await db
          .select()
          .from(skillbridgeProfiles)
          .where(
            and(eq(skillbridgeProfiles.organizationId, data.organizationId), isNull(skillbridgeProfiles.archivedAt)),
          );
    const results = [];
    for (const profile of profiles) {
      const matches = await findSkillBridgeMatches({
        organizationId: data.organizationId,
        profileId: profile.id,
        limit: 5,
      });
      results.push({ profileId: profile.id, matchCount: matches.length });
    }
    return { profiles: results.length, results };
  },
);
