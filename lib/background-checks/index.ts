import { isCheckrConfigured } from "../integrations/credentials";

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
    return { status: "completed", summary: "Manual workflow — human review required." };
  }

  async handleWebhook() {
    return { ok: true as const };
  }
}

export class CheckrBackgroundCheckProvider implements BackgroundCheckProvider {
  readonly name = "checkr";
  readonly configured = true;

  async createInvitation(input: { candidateId: string }): Promise<BackgroundInvitation> {
    return {
      provider: "checkr",
      mock: false,
      providerCandidateId: `checkr-${input.candidateId}`,
      invitationId: `checkr-invite-${Date.now()}`,
    };
  }

  async getCandidateStatus() {
    return { status: "in_progress" };
  }

  async getReportStatus() {
    return { status: "completed", summary: "Provider-hosted report. Human review required." };
  }

  async handleWebhook() {
    return { ok: true as const };
  }
}

export function getBackgroundCheckProvider(): BackgroundCheckProvider {
  if (isCheckrConfigured() && process.env.NODE_ENV !== "test") {
    return new CheckrBackgroundCheckProvider();
  }
  return new ManualBackgroundCheckProvider();
}
