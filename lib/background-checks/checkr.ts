import { integrationCredential, isCheckrLiveApiWired } from "../integrations/credentials";
import { integrationFetch } from "../integrations/http";
import type { BackgroundCheckProvider, BackgroundInvitation } from "./types";

const CHECKR_API = "https://api.checkr.com/v1";

function checkrAuthHeader() {
  const key = integrationCredential("CHECKR_API_KEY");
  if (!key) throw new Error("CHECKR_API_KEY is not set.");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export const CHECKR_ADVERSE_ACTION_NOTICE =
  "WorkforceOS does not generate FCRA adverse-action letters. A human reviewer must decide next steps. Counsel issues any legally required notices.";

export class CheckrBackgroundCheckProvider implements BackgroundCheckProvider {
  readonly name = "checkr";
  readonly configured = isCheckrLiveApiWired();

  async createInvitation(input: { candidateId: string; email: string; package?: string }): Promise<BackgroundInvitation> {
    const candidateResponse = await integrationFetch(`${CHECKR_API}/candidates`, {
      method: "POST",
      headers: {
        Authorization: checkrAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: input.email }),
    });
    const candidate = (await candidateResponse.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!candidateResponse.ok || !candidate.id) {
      throw new Error("Checkr candidate create failed.");
    }
    const invitationResponse = await integrationFetch(`${CHECKR_API}/invitations`, {
      method: "POST",
      headers: {
        Authorization: checkrAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        candidate_id: candidate.id,
        package: input.package ?? "essential",
      }),
    });
    const invitation = (await invitationResponse.json().catch(() => ({}))) as { id?: string };
    if (!invitationResponse.ok || !invitation.id) {
      throw new Error("Checkr invitation create failed.");
    }
    return {
      provider: "checkr",
      mock: false,
      providerCandidateId: candidate.id,
      invitationId: invitation.id,
    };
  }

  async getCandidateStatus(providerCandidateId: string) {
    const response = await integrationFetch(`${CHECKR_API}/candidates/${encodeURIComponent(providerCandidateId)}`, {
      headers: { Authorization: checkrAuthHeader() },
    });
    const payload = (await response.json().catch(() => ({}))) as { adjudication?: string };
    return { status: payload.adjudication ?? "pending" };
  }

  async getReportStatus(providerReportId: string) {
    const response = await integrationFetch(`${CHECKR_API}/reports/${encodeURIComponent(providerReportId)}`, {
      headers: { Authorization: checkrAuthHeader() },
    });
    const payload = (await response.json().catch(() => ({}))) as { status?: string };
    return {
      status: payload.status ?? "pending",
      summary: `${CHECKR_ADVERSE_ACTION_NOTICE} Human review required.`,
    };
  }

  async handleWebhook() {
    return { ok: true as const };
  }
}

export function checkrNeverAutoRejects() {
  return true;
}
