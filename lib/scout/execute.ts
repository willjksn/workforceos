import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { activities, candidateJobMatches, candidates, scoutActions, scoutMessages, scoutSessions, skillbridgeProfiles } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { can, type Principal } from "../rbac/permissions";
import { addCandidateToPool, createTalentPool } from "../repositories/talent";
import { draftSkillBridgeMessage } from "../skillbridge/drafts";
import {
  addSkillBridgeFollowUp,
  getMySkillBridgeQueue,
  getSkillBridgeDetail,
  getSkillBridgeMetrics,
  updateSkillBridgeProfile,
} from "../skillbridge/service";
import { scheduleInterview } from "../hiring/service";
import { getCalendarProvider } from "../calendar";
import { scoutCommand } from "./commands";
import type { ScoutPageContext } from "./page-context";
import { parseScoutIntent, type ScoutCommandDto } from "./parse-intent";
import { executeScoutSearch, type ScoutResultCard } from "./search";

export type ScoutTurnResult = {
  sessionId: string;
  message: string;
  cards: ScoutResultCard[];
  confirmation: null | {
    actionId: string;
    title: string;
    body: string;
  };
  draft: null | { subject: string; body: string; sendAllowed: false; facts: string[] };
  links: Array<{ href: string; label: string }>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `scout-pool-${Date.now()}`;
}

async function ensureSession(input: {
  organizationId: string;
  userId: string;
  sessionId?: string | null;
  pageContext: ScoutPageContext;
}) {
  const db = getDb();
  if (input.sessionId) {
    const [existing] = await db.select().from(scoutSessions).where(eq(scoutSessions.id, input.sessionId)).limit(1);
    if (existing && existing.userId === input.userId) return existing;
  }
  const [session] = await db
    .insert(scoutSessions)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      title: "Scout",
      pagePathname: input.pageContext.pathname,
      pageModule: input.pageContext.module,
      entityType: input.pageContext.entityType,
      entityId: input.pageContext.entityId,
    })
    .returning();
  return session;
}

export async function runScoutTurn(input: {
  principal: Principal;
  prompt: string;
  pathname: string;
  sessionId?: string | null;
  pageContext: ScoutPageContext;
}): Promise<ScoutTurnResult> {
  if (!can(input.principal, "scout.use")) {
    throw new Error("Missing permission: scout.use");
  }
  const parsed = parseScoutIntent(input.prompt, input.pageContext);
  if (!parsed.ok) {
    const session = await ensureSession({
      organizationId: input.principal.organizationId,
      userId: input.principal.id,
      sessionId: input.sessionId,
      pageContext: input.pageContext,
    });
    await persistMessages(session.id, input.prompt, parsed.error);
    return {
      sessionId: session.id,
      message: parsed.error,
      cards: [],
      confirmation: null,
      draft: null,
      links: [],
    };
  }

  const definition = scoutCommand(parsed.dto.family);
  if (!definition) {
    throw new Error(`Command ${parsed.dto.family} is not in the Scout registry.`);
  }
  if (!can(input.principal, definition.permission) && !can(input.principal, "scout.use")) {
    throw new Error(`Missing permission: ${definition.permission}`);
  }
  if (definition.permission !== "scout.use" && !can(input.principal, definition.permission)) {
    throw new Error(`Missing permission: ${definition.permission}`);
  }

  const session = await ensureSession({
    organizationId: input.principal.organizationId,
    userId: input.principal.id,
    sessionId: input.sessionId,
    pageContext: input.pageContext,
  });
  const db = getDb();
  const [userMessage] = await db
    .insert(scoutMessages)
    .values({
      sessionId: session.id,
      role: "user",
      content: input.prompt,
      commandFamily: parsed.dto.family,
      payload: parsed.dto,
    })
    .returning();

  if (definition.confirm) {
    const [action] = await db
      .insert(scoutActions)
      .values({
        organizationId: input.principal.organizationId,
        sessionId: session.id,
        messageId: userMessage.id,
        userId: input.principal.id,
        commandFamily: parsed.dto.family,
        actionKey: parsed.dto.family.toLowerCase(),
        status: "proposed",
        confirmationRequired: "true",
        inputDto: parsed.dto,
        targetRecordType: parsed.dto.entity ?? null,
        targetRecordId: parsed.dto.candidateId ?? parsed.dto.jobId ?? parsed.dto.skillbridgeProfileId ?? null,
      })
      .returning();
    const body =
      parsed.dto.family === "ADD_TO_POOL"
        ? `Create a Talent Pool called ${parsed.dto.poolName ?? "Scout pool"} from the current result set.`
        : `Scout will ${parsed.dto.family.replaceAll("_", " ").toLowerCase()} after you confirm.`;
    await db.insert(scoutMessages).values({
      sessionId: session.id,
      role: "scout",
      content: body,
      commandFamily: parsed.dto.family,
      payload: { actionId: action.id },
    });
    return {
      sessionId: session.id,
      message: body,
      cards: [],
      confirmation: { actionId: action.id, title: parsed.dto.family.replaceAll("_", " "), body },
      draft: null,
      links: [],
    };
  }

  const executed = await executeAuthorizedCommand({
    principal: input.principal,
    dto: parsed.dto,
    pageContext: input.pageContext,
  });
  await db.insert(scoutMessages).values({
    sessionId: session.id,
    role: "scout",
    content: executed.message,
    commandFamily: parsed.dto.family,
    payload: { cards: executed.cards, draft: executed.draft },
  });
  return { sessionId: session.id, ...executed };
}

export async function confirmScoutAction(input: { principal: Principal; actionId: string }) {
  if (!can(input.principal, "scout.internal_actions")) {
    throw new Error("Missing permission: scout.internal_actions");
  }
  const db = getDb();
  const [action] = await db.select().from(scoutActions).where(eq(scoutActions.id, input.actionId)).limit(1);
  if (!action || action.userId !== input.principal.id) throw new Error("Scout action not found");
  if (action.status !== "proposed") throw new Error("Scout action is not awaiting confirmation");
  const dto = action.inputDto as ScoutCommandDto;
  const executed = await executeAuthorizedCommand({
    principal: input.principal,
    dto,
    pageContext: {
      pathname: "/app",
      module: "app",
      entityType: action.targetRecordType,
      entityId: action.targetRecordId,
    },
  });
  await db
    .update(scoutActions)
    .set({
      status: "executed",
      confirmedAt: new Date(),
      executedAt: new Date(),
      result: executed,
      updatedAt: new Date(),
    })
    .where(eq(scoutActions.id, action.id));
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: `scout.${action.commandFamily.toLowerCase()}`,
    recordType: action.targetRecordType ?? "scout_action",
    recordId: action.targetRecordId ?? action.id,
    after: { command: action.commandFamily, actionId: action.id },
    reason: "Scout confirmed internal action",
  });
  return executed;
}

export async function rejectScoutSend() {
  return { sendAllowed: false as const, message: "Scout cannot send external messages without scout.external_actions and human confirmation." };
}

async function executeAuthorizedCommand(input: {
  principal: Principal;
  dto: ScoutCommandDto;
  pageContext: ScoutPageContext;
}): Promise<Omit<ScoutTurnResult, "sessionId">> {
  const canReadPii = can(input.principal, "candidate_pii.read");
  if (input.dto.family === "SEARCH" || input.dto.family === "FIND_MATCHES" || input.dto.family === "SHOW_RECORD") {
    if (input.dto.family === "SHOW_RECORD") {
      const id = input.dto.skillbridgeProfileId ?? input.pageContext.entityId;
      if (id && (input.pageContext.entityType === "skillbridge_profile" || input.dto.entity === "skillbridge_profile")) {
        return {
          message: "Open the Transition Talent Profile.",
          cards: [
            {
              type: "skillbridge",
              id,
              title: "Transition Talent Profile",
              href: `/app/military/skillbridge/${id}`,
              meta: "Current page context",
              fields: {},
            },
          ],
          confirmation: null,
          draft: null,
          links: [{ href: `/app/military/skillbridge/${id}`, label: "Open transition profile" }],
        };
      }
    }
    const result = await executeScoutSearch({
      organizationId: input.principal.organizationId,
      userId: input.principal.id,
      dto: input.dto,
      canReadPii,
      permissions: input.principal.permissions,
    });
    return { message: result.summary, cards: result.cards, confirmation: null, draft: null, links: result.cards.map((card) => ({ href: card.href, label: card.title })) };
  }

  if (input.dto.family === "SHOW_DASHBOARD") {
    const queue = await getMySkillBridgeQueue({
      organizationId: input.principal.organizationId,
      ownerUserId: input.principal.id,
      global: can(input.principal, "skillbridge.manage"),
      canReadPii,
    });
    const cards: ScoutResultCard[] = [
      ...queue.overdueFollowUps,
      ...queue.withoutOpportunities,
      ...queue.windowsApproaching,
      ...queue.employerFollowUps,
    ]
      .slice(0, 20)
      .map((card) => ({
        type: "skillbridge" as const,
        id: card.profile.id,
        title: card.candidate.fullName,
        href: `/app/military/skillbridge/${card.profile.id}`,
        meta: card.risks.join(" · ") || "Needs attention",
        fields: { status: card.profile.candidateStatus },
      }));
    return {
      message: cards.length ? "Today's Military Talent priorities from stored records." : "No stored Military Talent priorities for today.",
      cards,
      confirmation: null,
      draft: null,
      links: [{ href: "/app/military/skillbridge", label: "Military Talent priorities" }],
    };
  }

  if (input.dto.family === "SUMMARIZE") {
    if (input.pageContext.entityType === "website_inquiry" || input.dto.entity === "website_inquiries") {
      const { getWebsiteInquiry } = await import("../inquiries/service");
      const id = input.dto.websiteInquiryId ?? input.pageContext.entityId;
      const inquiry = id ? await getWebsiteInquiry(input.principal.organizationId, id) : null;
      return {
        message: inquiry
          ? `${inquiry.companyName}: ${inquiry.serviceInterest.replaceAll("-", " ")}. Status ${inquiry.status.replaceAll("_", " ")}. Company match ${inquiry.companyMatchStatus}.`
          : "No website inquiry in context.",
        cards: [],
        confirmation: null,
        draft: null,
        links: inquiry ? [{ href: `/app/crm/inquiries/${inquiry.id}`, label: inquiry.companyName }] : [],
      };
    }
    if (input.pageContext.entityType === "skillbridge_profile" && input.pageContext.entityId) {
      const detail = await getSkillBridgeDetail(input.pageContext.entityId, input.principal.organizationId, canReadPii);
      return {
        message: detail
          ? `${detail.card.candidate.fullName}: ${detail.card.profile.candidateStatus.replaceAll("_", " ")}. Window ${detail.card.profile.skillbridgeWindowStart?.toLocaleDateString() ?? "not on file"}.`
          : "No Transition Talent Profile in context.",
        cards: [],
        confirmation: null,
        draft: null,
        links: detail ? [{ href: `/app/military/skillbridge/${detail.card.profile.id}`, label: detail.card.candidate.fullName }] : [],
      };
    }
    if (input.pageContext.entityType === "company" && input.pageContext.entityId) {
      const { getCompanyInOrganization } = await import("../repositories/crm");
      const company = await getCompanyInOrganization(input.pageContext.entityId, input.principal.organizationId);
      return {
        message: company
          ? `${company.name}: ${company.clientStatus.replaceAll("_", " ")}. Industry ${company.industry ?? "not on file"}.`
          : "No company in context.",
        cards: [],
        confirmation: null,
        draft: null,
        links: company ? [{ href: `/app/companies/${company.id}`, label: company.name }] : [],
      };
    }
    if (input.pageContext.entityType === "opportunity" && input.pageContext.entityId) {
      const { getOpportunityGraph } = await import("../repositories/crm");
      const graph = await getOpportunityGraph(input.pageContext.entityId, input.principal.organizationId);
      return {
        message: graph
          ? `${graph.opportunity.name}: stage ${graph.opportunity.stage.replaceAll("_", " ")}.`
          : "No opportunity in context.",
        cards: [],
        confirmation: null,
        draft: null,
        links: graph ? [{ href: `/app/opportunities/${graph.opportunity.id}`, label: graph.opportunity.name }] : [],
      };
    }
    if (input.pageContext.entityType === "project" && input.pageContext.entityId) {
      const { getProjectBundle } = await import("../delivery/engine");
      const bundle = await getProjectBundle(input.pageContext.entityId, input.principal.organizationId);
      return {
        message: bundle
          ? `${bundle.project.name}: ${bundle.project.status.replaceAll("_", " ")}. Health ${bundle.project.health}.`
          : "No project in context.",
        cards: [],
        confirmation: null,
        draft: null,
        links: bundle ? [{ href: `/app/projects/${bundle.project.id}`, label: bundle.project.name }] : [],
      };
    }
    const metrics = await getSkillBridgeMetrics(input.principal.organizationId);
    return {
      message: `Transitioning talent in active Military Talent operations: ${metrics.activeCandidates}. SkillBridge windows in 90 days: ${metrics.windows90}. Without an employer match: ${metrics.withoutOpportunity}.`,
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: "/app/military", label: "Military Talent" }],
    };
  }

  if (input.dto.family === "DRAFT") {
    const candidateId = input.dto.candidateId ?? input.pageContext.entityId;
    const db = getDb();
    const [candidate] = candidateId
      ? await db
          .select()
          .from(candidates)
          .where(and(eq(candidates.id, candidateId), eq(candidates.organizationId, input.principal.organizationId)))
          .limit(1)
      : [];
    if (input.dto.draftKind === "rejection" || input.dto.draftKind === "interview_invitation" || input.dto.draftKind === "onboarding_welcome") {
      const subject =
        input.dto.draftKind === "rejection"
          ? "Application update"
          : input.dto.draftKind === "interview_invitation"
            ? "Interview invitation"
            : "Onboarding welcome";
      const body =
        input.dto.draftKind === "rejection"
          ? `Hello ${candidate?.fullName ?? "there"}, thank you for your interest. We will not be moving forward with this application. This draft is for human review only.`
          : input.dto.draftKind === "interview_invitation"
            ? `Hello ${candidate?.fullName ?? "there"}, we would like to schedule an interview. This draft is for human review only.`
            : `Hello ${candidate?.fullName ?? "there"}, welcome. Your onboarding tasks will be shared after a human sends this message.`;
      if (!can(input.principal, "transactional_email.send") || !can(input.principal, "scout.external_actions")) {
        await recordAuditEvent({
          organizationId: input.principal.organizationId,
          actor: { type: "human", userId: input.principal.id },
          action: "scout.draft",
          recordType: "scout_draft",
          recordId: candidate?.id ?? input.principal.id,
          after: { kind: input.dto.draftKind, sendAllowed: false },
        });
        return {
          message: "Draft ready for human review. Scout cannot send external email without confirmation and transactional_email.send.",
          cards: [],
          confirmation: null,
          draft: { subject, body, sendAllowed: false, facts: ["Scout does not send this message."] },
          links: [],
        };
      }
    }
    const draft = draftSkillBridgeMessage({
      kind: input.dto.draftKind ?? "follow_up",
      audience: "candidate",
      candidateName: candidate?.fullName ?? "the candidate",
      occupationTitle: candidate?.currentTitle,
      locationPreference: [candidate?.city, candidate?.region].filter(Boolean).join(", "),
      canReadPii,
    });
    await recordAuditEvent({
      organizationId: input.principal.organizationId,
      actor: { type: "human", userId: input.principal.id },
      action: "scout.draft",
      recordType: candidate ? "candidate" : "scout_draft",
      recordId: candidate?.id ?? input.principal.id,
      after: { kind: input.dto.draftKind ?? "follow_up", sendAllowed: false },
      reason: "Scout drafted an external message for human review",
    });
    return {
      message: "Draft ready for human review. Scout will not send this message.",
      cards: [],
      confirmation: null,
      draft: { subject: draft.subject, body: draft.body, sendAllowed: false, facts: draft.facts },
      links: candidateId ? [{ href: `/app/talent/${candidateId}`, label: candidate?.fullName ?? "Candidate" }] : [],
    };
  }

  if (input.dto.family === "ADD_TO_POOL") {
    const search = await executeScoutSearch({
      organizationId: input.principal.organizationId,
      userId: input.principal.id,
      dto: { ...input.dto, family: "SEARCH", entity: input.dto.entity ?? "candidates" },
      canReadPii,
      permissions: input.principal.permissions,
    });
    const name = input.dto.poolName ?? "Scout pool";
    const pool = await createTalentPool({
      organizationId: input.principal.organizationId,
      actorUserId: input.principal.id,
      name,
      slug: `${slugify(name)}-${Date.now().toString().slice(-6)}`,
      description: "Created from a confirmed Scout action",
    });
    for (const card of search.cards.filter((card) => card.type === "candidate" || card.type === "skillbridge")) {
      const candidateId = card.type === "candidate" ? card.id : (await lookupCandidateId(card.id)) ?? card.id;
      try {
        await addCandidateToPool({
          organizationId: input.principal.organizationId,
          actorUserId: input.principal.id,
          candidateId,
          talentPoolId: pool.id,
        });
      } catch {
        /* membership may already exist */
      }
    }
    return {
      message: `Created talent pool ${pool.name}.`,
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: `/app/talent/pools/${pool.id}`, label: pool.name }],
    };
  }

  if (input.dto.family === "CREATE_FOLLOW_UP") {
    const profileId = input.dto.skillbridgeProfileId ?? input.pageContext.entityId;
    if (!profileId) {
      return { message: "No Transition Talent Profile in context for follow-up.", cards: [], confirmation: null, draft: null, links: [] };
    }
    const followUpAt = input.dto.followUpAt ? new Date(input.dto.followUpAt) : new Date(Date.now() + 7 * 86400000);
    await addSkillBridgeFollowUp({
      actor: { organizationId: input.principal.organizationId, userId: input.principal.id },
      profileId,
      subject: input.dto.subject ?? "Scout follow-up",
      followUpAt,
    });
    return {
      message: "Follow-up recorded on the Transition Talent Profile.",
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: `/app/military/skillbridge/${profileId}`, label: "Transition Talent Profile" }],
    };
  }

  if (input.dto.family === "UPDATE" && input.dto.entity === "application_reject") {
    throw new Error("Scout cannot independently reject a candidate. A human must confirm the disposition from the application page.");
  }

  if (input.dto.family === "CREATE" && input.dto.entity === "interview") {
    const applicationId = input.dto.applicationId;
    if (!applicationId) {
      return {
        message: "Confirm the application, then schedule from the application page. Scout will not create a calendar event without an application.",
        cards: [],
        confirmation: null,
        draft: null,
        links: [{ href: "/app/recruiting/applications", label: "Applications" }],
      };
    }
    const slots = await getCalendarProvider().getAvailability({
      owner: input.principal.id,
      from: new Date(),
      to: new Date(Date.now() + 7 * 86400000),
      durationMinutes: 30,
    });
    const slot = slots[0];
    if (!slot) {
      return { message: "No available interview slots from the calendar adapter.", cards: [], confirmation: null, draft: null, links: [] };
    }
    const scheduled = await scheduleInterview({
      principal: input.principal,
      applicationId,
      stageName: "Recruiter Screen",
      start: slot.start,
      end: slot.end,
      timezone: slot.timezone,
    });
    return {
      message: `Interview scheduled after confirmation (${scheduled.calendarEvent.externalEventId}).`,
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: `/app/recruiting/applications/${applicationId}`, label: "Application" }],
    };
  }

  if (input.dto.family === "UPDATE" && input.dto.entity === "public_content_deactivate_urgent") {
    const { listPublicContentItems, setPublicContentActive } = await import("../public-content/service");
    if (!can(input.principal, "public_content.publish")) {
      return {
        message: "Publishing public content requires public_content.publish.",
        cards: [],
        confirmation: null,
        draft: null,
        links: [],
      };
    }
    const rows = await listPublicContentItems({ principal: input.principal, contentType: "urgent_hiring_notice" });
    const live = rows.filter((row) => row.rendering || row.isActive);
    for (const row of live) {
      await setPublicContentActive({ principal: input.principal, id: row.id, isActive: false });
    }
    return {
      message: live.length ? `Deactivated ${live.length} urgent hiring notice(s).` : "No active urgent hiring notice.",
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: "/app/public-content", label: "Public content" }],
    };
  }

  if (input.dto.family === "UPDATE" && input.dto.preferredLocation) {
    const profileId = input.dto.skillbridgeProfileId ?? input.pageContext.entityId;
    if (!profileId) {
      return { message: "No Transition Talent Profile to update.", cards: [], confirmation: null, draft: null, links: [] };
    }
    await updateSkillBridgeProfile({
      actor: { organizationId: input.principal.organizationId, userId: input.principal.id },
      profileId,
      patch: { preferredLocationPrimary: input.dto.preferredLocation },
    });
    return {
      message: `Updated preferred location to ${input.dto.preferredLocation}.`,
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: `/app/military/skillbridge/${profileId}`, label: "Transition Talent Profile" }],
    };
  }

  if (input.dto.family === "CREATE") {
    if (input.dto.entity === "opportunity_from_inquiry") {
      const { convertInquiryToOpportunity } = await import("../inquiries/service");
      const inquiryId = input.dto.websiteInquiryId ?? input.pageContext.entityId;
      if (!inquiryId) {
        return { message: "No website inquiry in context to convert.", cards: [], confirmation: null, draft: null, links: [] };
      }
      const inquiry = await convertInquiryToOpportunity({
        organizationId: input.principal.organizationId,
        actorUserId: input.principal.id,
        inquiryId,
      });
      return {
        message: inquiry?.opportunityId ? "Opportunity created from the website inquiry." : "Inquiry could not be converted.",
        cards: [],
        confirmation: null,
        draft: null,
        links: inquiry ? [{ href: `/app/crm/inquiries/${inquiry.id}`, label: "Website inquiry" }] : [],
      };
    }
    if (input.dto.entity?.startsWith("public_content_")) {
      const { createPublicContentItem } = await import("../public-content/service");
      if (!can(input.principal, "public_content.manage") || !can(input.principal, "public_content.publish")) {
        return {
          message: "Publishing public content requires public_content.manage and public_content.publish.",
          cards: [],
          confirmation: null,
          draft: null,
          links: [],
        };
      }
      const jobId = input.dto.jobId ?? (input.pageContext.entityType === "job" ? input.pageContext.entityId : null);
      if (input.dto.entity === "public_content_feature_job" || input.dto.entity === "public_content_feature_skillbridge") {
        if (!jobId) {
          return {
            message: "Open a job record first, then ask Scout to feature it.",
            cards: [],
            confirmation: null,
            draft: null,
            links: [],
          };
        }
        const skillbridge = input.dto.entity === "public_content_feature_skillbridge";
        const created = await createPublicContentItem({
          principal: input.principal,
          data: {
            contentType: skillbridge ? "featured_skillbridge" : "featured_job",
            title: skillbridge ? "Featured SkillBridge-eligible employer opportunity" : "Featured job",
            linkedJobId: jobId,
            placement: skillbridge ? "skillbridge" : "careers",
            isActive: true,
          },
        });
        return {
          message: skillbridge ? "SkillBridge-eligible employer opportunity featured on the public site." : "Job featured on the public site.",
          cards: [],
          confirmation: null,
          draft: null,
          links: [{ href: `/app/public-content/${created.id}`, label: "Public content item" }],
        };
      }
      const created = await createPublicContentItem({
        principal: input.principal,
        data: {
          contentType: "homepage_banner",
          title: "We're hiring",
          body: "PierOne is recruiting talent. Applying does not guarantee an interview.",
          ctaLabel: "View open roles",
          ctaUrl: "/careers",
          linkedJobId: jobId,
          placement: "home",
          styleVariant: "navy",
          isActive: true,
        },
      });
      return {
        message: "Hiring banner created and activated.",
        cards: [],
        confirmation: null,
        draft: null,
        links: [{ href: `/app/public-content/${created.id}`, label: "Hiring banner" }],
      };
    }
    const db = getDb();
    await db.insert(activities).values({
      organizationId: input.principal.organizationId,
      activityType: "note",
      subject: input.dto.subject ?? "Scout note",
      details: input.dto.note ?? input.dto.subject ?? "Scout note",
      createdByUserId: input.principal.id,
      candidateId: input.dto.candidateId ?? (input.pageContext.entityType === "candidate" ? input.pageContext.entityId : null),
    });
    return { message: "Note created.", cards: [], confirmation: null, draft: null, links: [] };
  }

  if (input.dto.family === "ASSIGN") {
    const profileId = input.dto.skillbridgeProfileId ?? input.pageContext.entityId;
    if (!profileId || !input.dto.ownerUserId) {
      return { message: "Owner assignment needs a Transition Talent Profile and owner.", cards: [], confirmation: null, draft: null, links: [] };
    }
    await updateSkillBridgeProfile({
      actor: { organizationId: input.principal.organizationId, userId: input.principal.id },
      profileId,
      patch: { ownerUserId: input.dto.ownerUserId },
    });
    return {
      message: "Owner assigned.",
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: `/app/military/skillbridge/${profileId}`, label: "Transition Talent Profile" }],
    };
  }

  if (input.dto.family === "ADD_TO_JOB") {
    const jobId = input.dto.jobId ?? (input.pageContext.entityType === "job" ? input.pageContext.entityId : null);
    if (!jobId) {
      return { message: "No job in context to add candidates.", cards: [], confirmation: null, draft: null, links: [] };
    }
    const search = await executeScoutSearch({
      organizationId: input.principal.organizationId,
      userId: input.principal.id,
      dto: { ...input.dto, family: "SEARCH", entity: "candidates" },
      canReadPii,
      permissions: input.principal.permissions,
    });
    const db = getDb();
    let added = 0;
    for (const card of search.cards.filter((card) => card.type === "candidate" || card.type === "skillbridge")) {
      const candidateId = card.type === "candidate" ? card.id : (await lookupCandidateId(card.id)) ?? card.id;
      try {
        await db
          .insert(candidateJobMatches)
          .values({
            candidateId,
            jobId,
            score: "0",
            source: "internal_talent_network",
            pipelineStatus: "identified",
            explanation: "Added from a confirmed Scout action",
          })
          .onConflictDoNothing();
        added += 1;
      } catch {
        /* membership may already exist */
      }
    }
    return {
      message: `Added ${added} candidates to the job pipeline as identified.`,
      cards: [],
      confirmation: null,
      draft: null,
      links: [{ href: `/app/jobs/${jobId}`, label: "Open job" }],
    };
  }

  if (input.dto.family === "CREATE_TASK") {
    const db = getDb();
    await db.insert(activities).values({
      organizationId: input.principal.organizationId,
      activityType: "task",
      subject: input.dto.subject ?? "Scout task",
      details: input.dto.note ?? null,
      createdByUserId: input.principal.id,
      candidateId: input.dto.candidateId ?? (input.pageContext.entityType === "candidate" ? input.pageContext.entityId : null),
    });
    return { message: "Task created.", cards: [], confirmation: null, draft: null, links: [] };
  }

  return { message: "Command recorded.", cards: [], confirmation: null, draft: null, links: [] };
}

async function lookupCandidateId(skillbridgeProfileId: string) {
  const db = getDb();
  const [row] = await db.select().from(skillbridgeProfiles).where(eq(skillbridgeProfiles.id, skillbridgeProfileId)).limit(1);
  return row?.candidateId ?? null;
}

async function persistMessages(sessionId: string, userText: string, scoutText: string) {
  const db = getDb();
  await db.insert(scoutMessages).values({ sessionId, role: "user", content: userText });
  await db.insert(scoutMessages).values({ sessionId, role: "scout", content: scoutText });
}

export function isScoutExternalSendEnabled() {
  return false;
}

export function assertScoutCannotSend() {
  return isScoutExternalSendEnabled();
}
