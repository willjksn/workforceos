import { isCheckrLiveApiWired } from "../integrations/credentials";
import { CheckrBackgroundCheckProvider, CHECKR_ADVERSE_ACTION_NOTICE } from "./checkr";
import type { BackgroundCheckProvider, BackgroundInvitation } from "./types";

export type { BackgroundCheckProvider, BackgroundInvitation } from "./types";
export { CheckrBackgroundCheckProvider, CHECKR_ADVERSE_ACTION_NOTICE } from "./checkr";

export class ManualBackgroundCheckProvider implements BackgroundCheckProvider {
  readonly name = "manual";
  readonly configured = false;

  async createInvitation(input: { candidateId: string }): Promise<BackgroundInvitation> {
    return {
      provider: "manual",
      mock: true,
      providerCandidateId: `manual-${input.candidateId}`,
      invitationId: `invite-${Date.now()}`,
    };
  }

  async getCandidateStatus() {
    return { status: "in_progress" };
  }

  async getReportStatus() {
    return { status: "completed", summary: "Manual workflow — human review required. Not a live Checkr report." };
  }

  async handleWebhook() {
    return { ok: true as const };
  }
}

export function getBackgroundCheckProvider(): BackgroundCheckProvider {
  if (isCheckrLiveApiWired()) return new CheckrBackgroundCheckProvider();
  return new ManualBackgroundCheckProvider();
}
