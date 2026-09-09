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
