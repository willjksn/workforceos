import { afterEach, describe, expect, it, vi } from "vitest";

import { getBackgroundCheckProvider } from "../lib/background-checks";
import { CHECKR_ADVERSE_ACTION_NOTICE } from "../lib/background-checks/checkr";
import { calendarProviderStatus, getCalendarProvider } from "../lib/calendar";
import { resetServerEnvCache } from "../lib/env";
import { applyBackgroundResult } from "../lib/hiring/service";
import {
  calendarWiringStatus,
  checkrWiringStatus,
  docusignWiringStatus,
  isCalendarLiveWired,
  isCheckrLiveApiWired,
  isDocuSignLiveWired,
  isQuickBooksLiveWired,
  isSeekOutLiveWired,
  quickbooksWiringStatus,
  seekoutWiringStatus,
} from "../lib/integrations/credentials";
import { jsonResponse, resetIntegrationFetchForTests, setIntegrationFetchForTests } from "../lib/integrations/http";
import { applyDocuSignStatus } from "../lib/integrations/webhooks";
import { getDocuSignAdapter } from "../lib/integrations/esign";
import { getQuickBooksAdapter, getSeekOutAdapter, verifyWebhookSignature } from "../lib/integrations/providers";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { isScoutExternalSendEnabled } from "../lib/scout/execute";
import {
  consumeScoutSendConfirmation,
  evaluateScoutSendGates,
  issueScoutSendConfirmation,
  rejectScoutSend,
  resetScoutSendConfirmationsForTests,
} from "../lib/scout/send";
import { redactLogValue } from "../lib/observability/redact";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
  resetIntegrationFetchForTests();
  resetScoutSendConfirmationsForTests();
});

describe("Phase I provider honesty", () => {
  it("keeps calendar mock when unconfigured", () => {
    expect(getCalendarProvider().name).toBe("mock");
    expect(getCalendarProvider().liveScheduling).toBe(false);
    expect(calendarProviderStatus().liveLabel).toBe("MOCK");
    expect(calendarWiringStatus().wiring).toBe("mock");
    expect(isCalendarLiveWired()).toBe(false);
  });

  it("keeps liveScheduling false when only app credentials exist", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    expect(isCalendarLiveWired()).toBe(false);
    expect(getCalendarProvider().liveScheduling).toBe(false);
    expect(calendarWiringStatus().liveLabel).toBe("CONFIGURED");
    expect(calendarWiringStatus().detail).not.toMatch(/LIVE —/);
  });

  it("uses the live Google calendar path when refresh tokens exist without calling Google by default", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("GOOGLE_REFRESH_TOKEN", "refresh");
    setIntegrationFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "test-access" });
      if (url.includes("/events")) return jsonResponse({ id: "google-event-1", hangoutLink: "https://meet.example.test/1" });
      return jsonResponse({});
    });
    const calendar = getCalendarProvider();
    expect(calendar.name).toBe("google");
    expect(calendar.liveScheduling).toBe(true);
    expect(calendarProviderStatus().liveLabel).toBe("LIVE");
    const event = await calendar.createEvent({
      title: "Interview",
      start: new Date("2026-09-10T15:00:00.000Z"),
      end: new Date("2026-09-10T15:30:00.000Z"),
      timezone: "America/New_York",
      attendees: [],
    });
    expect(event.mock).toBe(false);
    expect(event.externalEventId).toBe("google-event-1");
  });

  it("labels Checkr mock/manual when unconfigured and live when the key is present", async () => {
    expect(isCheckrLiveApiWired()).toBe(false);
    expect(getBackgroundCheckProvider().name).toBe("manual");
    expect(checkrWiringStatus().liveLabel).toBe("MANUAL");
    vi.stubEnv("CHECKR_API_KEY", "checkr-test-key");
    expect(isCheckrLiveApiWired()).toBe(true);
    expect(getBackgroundCheckProvider().name).toBe("checkr");
    expect(getBackgroundCheckProvider().configured).toBe(true);
    setIntegrationFetchForTests(async (input) => {
      const url = String(input);
      if (url.endsWith("/candidates")) return jsonResponse({ id: "cand_1" });
      if (url.endsWith("/invitations")) return jsonResponse({ id: "inv_1" });
      return jsonResponse({});
    });
    const invitation = await getBackgroundCheckProvider().createInvitation({
      candidateId: "cand-local",
      email: "candidate@example.test",
    });
    expect(invitation.mock).toBe(false);
    expect(invitation.invitationId).toBe("inv_1");
    expect(CHECKR_ADVERSE_ACTION_NOTICE).toMatch(/does not generate FCRA/);
  });

  it("never auto-rejects from a background result", async () => {
    await expect(
      applyBackgroundResult({
        principal: principalFor("managing-partner"),
        backgroundCheckId: "00000000-0000-4000-8000-000000000001",
        status: "completed",
        autoReject: true,
      }),
    ).rejects.toThrow(/cannot automatically reject/);
  });

  it("keeps DocuSign mock when unconfigured and never auto-executes", async () => {
    expect(isDocuSignLiveWired()).toBe(false);
    expect(docusignWiringStatus().liveLabel).toBe("MOCK");
    const envelope = await getDocuSignAdapter().createEnvelope({ contractId: "c1", title: "MSA" });
    expect(envelope.status).toBe("not_configured");
    await expect(
      applyDocuSignStatus({
        organizationId: "org-1",
        envelopeId: "missing",
        status: "completed",
        confirmed: false,
      }),
    ).rejects.toThrow(/confirmation/);
  });

  it("uses the DocuSign live path when env doubles are present", async () => {
    vi.stubEnv("DOCUSIGN_INTEGRATION_KEY", "ik");
    vi.stubEnv("DOCUSIGN_USER_ID", "user");
    vi.stubEnv("DOCUSIGN_SECRET_KEY", "secret");
    vi.stubEnv("DOCUSIGN_ACCOUNT_ID", "acct");
    expect(isDocuSignLiveWired()).toBe(true);
    setIntegrationFetchForTests(async () => jsonResponse({ envelopeId: "ds-live-1" }));
    const created = await getDocuSignAdapter().createEnvelope({ contractId: "c1", title: "MSA" });
    expect(created.configured).toBe(true);
    expect(created.envelopeId).toBe("ds-live-1");
    const completed = await getDocuSignAdapter().completedDocument("ds-live-1");
    expect(completed.error).toMatch(/confirmed=true/);
  });

  it("keeps QuickBooks mock when unconfigured and live-posts when tokens exist", async () => {
    expect(isQuickBooksLiveWired()).toBe(false);
    expect(quickbooksWiringStatus().liveLabel).toBe("MOCK");
    vi.stubEnv("QUICKBOOKS_CLIENT_ID", "id");
    vi.stubEnv("QUICKBOOKS_CLIENT_SECRET", "secret");
    expect(isQuickBooksLiveWired()).toBe(false);
    expect(quickbooksWiringStatus().liveLabel).toBe("CONFIGURED");
    vi.stubEnv("QUICKBOOKS_REFRESH_TOKEN", "refresh");
    vi.stubEnv("QUICKBOOKS_REALM_ID", "realm");
    expect(isQuickBooksLiveWired()).toBe(true);
    expect(getQuickBooksAdapter()).toBeTruthy();
  });

  it("blocks SeekOut until internal search completes and goes live only with a key", async () => {
    expect(isSeekOutLiveWired()).toBe(false);
    expect(seekoutWiringStatus().liveLabel).toBe("MOCK");
    await expect(
      getSeekOutAdapter().lookupCandidates({
        jobId: "job-1",
        internalSearchCompletedAt: null,
        query: "electrician",
      }),
    ).rejects.toThrow(/Internal Talent Network/);
    vi.stubEnv("SEEKOUT_API_KEY", "seekout-test");
    setIntegrationFetchForTests(async () => jsonResponse({ results: [{ id: "s1", name: "Pat", title: "Electrician" }] }));
    const live = await getSeekOutAdapter().lookupCandidates({
      jobId: "job-1",
      internalSearchCompletedAt: new Date(),
      query: "electrician",
    });
    expect(live.mode).toBe("live");
    expect(live.results[0]?.externalId).toBe("s1");
  });

  it("rejects unsigned webhooks", () => {
    expect(
      verifyWebhookSignature({
        provider: "checkr",
        rawBody: "{}",
        signature: null,
        secret: "secret",
      }),
    ).toBe(false);
  });
});

describe("Phase I Scout send gates", () => {
  it("denies send without confirmation and permission", async () => {
    expect(isScoutExternalSendEnabled()).toBe(false);
    const denied = await rejectScoutSend();
    expect(denied.sendAllowed).toBe(false);
    const recruiter = principalFor("recruiter");
    expect(can(recruiter, "scout.external_actions")).toBe(false);
    expect(
      evaluateScoutSendGates({ principal: recruiter, confirmationToken: "token", transactionalReady: true }).ok,
    ).toBe(false);
  });

  it("keeps sendAllowed false until permission, confirmation, and Resend are all present", async () => {
    const partner = principalFor("managing-partner");
    expect(can(partner, "scout.external_actions")).toBe(true);
    expect(can(principalFor("operations-administrator"), "scout.external_actions")).toBe(true);
    expect(can(principalFor("strategy-technology-administrator"), "scout.external_actions")).toBe(true);
    expect(evaluateScoutSendGates({ principal: partner, transactionalReady: true }).ok).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.test");
    resetServerEnvCache();
    const token = issueScoutSendConfirmation({ principal: partner, subject: "Hello", body: "Body" });
    expect(
      evaluateScoutSendGates({
        principal: partner,
        confirmationToken: token,
        transactionalReady: true,
      }).ok,
    ).toBe(true);
    expect(consumeScoutSendConfirmation({ principal: partner, confirmationToken: token })).toMatchObject({
      subject: "Hello",
    });
    expect(consumeScoutSendConfirmation({ principal: partner, confirmationToken: token })).toBeNull();
  });
});

describe("Phase I observability redaction", () => {
  it("redacts tokens and candidate contact fields", () => {
    const redacted = redactLogValue({
      email: "hidden@example.test",
      phone: "555-0100",
      token: "secret-token",
      ssn: "000-00-0000",
      route: "/app/admin",
    });
    expect(redacted).toEqual({
      email: "[redacted]",
      phone: "[redacted]",
      token: "[redacted]",
      ssn: "[redacted]",
      route: "/app/admin",
    });
  });
});
