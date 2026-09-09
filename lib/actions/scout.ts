"use server";

import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { parseScoutPageContext } from "@/lib/scout/page-context";
import { confirmScoutAction, runScoutTurn } from "@/lib/scout/execute";
import { executeApprovedScoutSend, issueScoutSendConfirmation, rejectScoutSend } from "@/lib/scout/send";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { suggestedScoutPrompts } from "@/lib/scout/prompts";

export type ScoutClientResult = {
  error?: string;
  sessionId?: string;
  message?: string;
  cards?: Array<{ type: string; id: string; title: string; href: string; meta: string; fields: Record<string, string | number | null> }>;
  confirmation?: { actionId: string; title: string; body: string } | null;
  draft?: { subject: string; body: string; sendAllowed: boolean; facts: string[]; confirmationToken?: string } | null;
  links?: Array<{ href: string; label: string }>;
  prompts?: string[];
};

function fail(error: unknown): ScoutClientResult {
  if (error instanceof AuthorizationError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Scout could not complete that request." };
}

export async function scoutPromptAction(input: {
  prompt: string;
  pathname: string;
  sessionId?: string | null;
}): Promise<ScoutClientResult> {
  try {
    const principal = await requireAppPermission("scout.use");
    const pageContext = parseScoutPageContext(input.pathname);
    const result = await runScoutTurn({
      principal,
      prompt: input.prompt,
      pathname: input.pathname,
      sessionId: input.sessionId,
      pageContext,
    });
    return {
      sessionId: result.sessionId,
      message: result.message,
      cards: result.cards,
      confirmation: result.confirmation,
      draft: result.draft,
      links: result.links,
      prompts: suggestedScoutPrompts(pageContext.module, pageContext.entityType),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function scoutConfirmAction(actionId: string): Promise<ScoutClientResult> {
  try {
    const principal = await requireAppPermission("scout.internal_actions");
    const result = await confirmScoutAction({ principal, actionId });
    return {
      message: result.message,
      cards: result.cards,
      confirmation: null,
      draft: result.draft,
      links: result.links,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function scoutSendDraftAction(input?: {
  confirmationToken?: string | null;
  to?: string | null;
  subject?: string | null;
  body?: string | null;
}): Promise<ScoutClientResult> {
  try {
    const principal = await requireAppPermission("scout.use");
    const subject = input?.subject?.trim() || "";
    const body = input?.body?.trim() || "";
    const to = input?.to?.trim() || "";
    if (!input?.confirmationToken) {
      const blocked = await rejectScoutSend();
      if (!canSendPrepare(principal) || !subject || !body) {
        return { error: blocked.message, draft: { subject, body, sendAllowed: false, facts: [] } };
      }
      const token = issueScoutSendConfirmation({ principal, subject, body, to: to || undefined });
      return {
        error: "Confirm send to proceed. Scout will not send until you confirm this step.",
        draft: {
          subject,
          body,
          sendAllowed: false,
          facts: ["Human confirmation required.", "Transactional provider only."],
          confirmationToken: token,
        },
      };
    }
    if (!to) {
      return { error: "A recipient address is required for transactional send.", draft: { subject, body, sendAllowed: false, facts: [] } };
    }
    const result = await executeApprovedScoutSend({
      principal,
      confirmationToken: input.confirmationToken,
      to,
      subject,
      body,
    });
    return {
      error: result.sendAllowed ? undefined : result.message,
      message: result.sendAllowed ? result.message : undefined,
      draft: { subject, body, sendAllowed: result.sendAllowed, facts: [result.message] },
    };
  } catch (error) {
    return fail(error);
  }
}

function canSendPrepare(principal: Awaited<ReturnType<typeof requireAppPermission>>) {
  return principal.permissions.has("scout.external_actions") && principal.permissions.has("transactional_email.send");
}
