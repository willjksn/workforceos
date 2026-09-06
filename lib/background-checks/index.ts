export type BackgroundInvitation = {
  provider: string;
  mock: boolean;
  providerCandidateId: string;
  invitationId: string;
};

export interface BackgroundCheckProvider {
  readonly name: string;
  readonly configured: boolean;
  createInvitation(input: { candidateId: string; email: string; package?: string }): Promise<BackgroundInvitation>;
  getCandidateStatus(providerCandidateId: string): Promise<{ status: string }>;
  getReportStatus(providerReportId: string): Promise<{ status: string; summary: string | null }>;
  handleWebhook(payload: unknown): Promise<{ ok: true }>;
}

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

/**
 * Kept as an explicit stub so a CHECKR_API_KEY cannot be mistaken for a live integration.
 * There is no Checkr HTTP client, sandbox client, or webhook verifier in this repository.
 * Do not select this provider from getBackgroundCheckProvider until a real API is wired.
 */
export class CheckrBackgroundCheckProvider implements BackgroundCheckProvider {
  readonly name = "checkr-stub";
  readonly configured = false;

  async createInvitation(input: { candidateId: string }): Promise<BackgroundInvitation> {
    return {
      provider: "checkr-stub",
      mock: true,
      providerCandidateId: `checkr-stub-not-live-${input.candidateId}`,
      invitationId: `checkr-stub-invite-${Date.now()}`,
    };
  }

  async getCandidateStatus() {
    return { status: "not_wired" };
  }

  async getReportStatus() {
    return {
      status: "not_wired",
      summary: "Checkr HTTP API is not implemented. Use the manual background-check workflow. Human review required.",
    };
  }

  async handleWebhook() {
    return { ok: true as const };
  }
}

export function getBackgroundCheckProvider(): BackgroundCheckProvider {
  return new ManualBackgroundCheckProvider();
}
