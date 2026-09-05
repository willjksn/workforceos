"use server";

import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { parseScoutPageContext } from "@/lib/scout/page-context";
import { confirmScoutAction, rejectScoutSend, runScoutTurn } from "@/lib/scout/execute";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { suggestedScoutPrompts } from "@/lib/scout/prompts";

export type ScoutClientResult = {
  error?: string;
  sessionId?: string;
  message?: string;
  cards?: Array<{ type: string; id: string; title: string; href: string; meta: string; fields: Record<string, string | number | null> }>;
  confirmation?: { actionId: string; title: string; body: string } | null;
  draft?: { subject: string; body: string; sendAllowed: false; facts: string[] } | null;
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

export async function scoutSendDraftAction(): Promise<ScoutClientResult> {
  try {
    await requireAppPermission("scout.use");
    const blocked = await rejectScoutSend();
    return { error: blocked.message, draft: { subject: "", body: "", sendAllowed: false, facts: [] } };
  } catch (error) {
    return fail(error);
  }
}
