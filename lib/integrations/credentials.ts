import { neverLiveWithoutCredentials, wiringFromFlags, type ProviderWiringStatus } from "./wiring";

export function integrationCredential(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function isQuickBooksConfigured() {
  return Boolean(integrationCredential("QUICKBOOKS_CLIENT_ID") && integrationCredential("QUICKBOOKS_CLIENT_SECRET"));
}

/** Live QB posting needs OAuth tokens + realm, not just the app client. */
export function isQuickBooksLiveWired() {
  return neverLiveWithoutCredentials(
    isQuickBooksConfigured(),
    Boolean(integrationCredential("QUICKBOOKS_REFRESH_TOKEN") && integrationCredential("QUICKBOOKS_REALM_ID")),
  );
}

export function isDocuSignConfigured() {
  return Boolean(integrationCredential("DOCUSIGN_INTEGRATION_KEY") && integrationCredential("DOCUSIGN_USER_ID"));
}

export function isDocuSignLiveWired() {
  return neverLiveWithoutCredentials(
    isDocuSignConfigured(),
    Boolean(integrationCredential("DOCUSIGN_SECRET_KEY") && integrationCredential("DOCUSIGN_ACCOUNT_ID")),
  );
}

export function isApolloConfigured() {
  return Boolean(integrationCredential("APOLLO_API_KEY"));
}

export function isApolloLiveWired() {
  return isApolloConfigured();
}

export function isOnetConfigured() {
  return Boolean(integrationCredential("ONET_API_KEY"));
}

export function isSeekOutConfigured() {
  return Boolean(integrationCredential("SEEKOUT_API_KEY"));
}

export function isSeekOutLiveWired() {
  return isSeekOutConfigured();
}

export function isMicrosoftConfigured() {
  return Boolean(integrationCredential("MICROSOFT_CLIENT_ID") && integrationCredential("MICROSOFT_CLIENT_SECRET"));
}

export function isMicrosoftCalendarLive() {
  return neverLiveWithoutCredentials(isMicrosoftConfigured(), Boolean(integrationCredential("MICROSOFT_REFRESH_TOKEN")));
}

export function isGoogleConfigured() {
  return Boolean(integrationCredential("GOOGLE_CLIENT_ID") && integrationCredential("GOOGLE_CLIENT_SECRET"));
}

export function isGoogleCalendarLive() {
  return neverLiveWithoutCredentials(isGoogleConfigured(), Boolean(integrationCredential("GOOGLE_REFRESH_TOKEN")));
}

export function isCalendarLiveWired() {
  return isGoogleCalendarLive() || isMicrosoftCalendarLive();
}

export function isResendConfigured() {
  return Boolean(integrationCredential("RESEND_API_KEY") && integrationCredential("RESEND_FROM_EMAIL"));
}

export function isCheckrConfigured() {
  return Boolean(integrationCredential("CHECKR_API_KEY"));
}

/** Live Checkr HTTP API is selected only when the API key is present. */
export function isCheckrLiveApiWired() {
  return isCheckrConfigured();
}

export function isDrugScreenConfigured() {
  return false;
}

export function isBlsConfigured() {
  return Boolean(integrationCredential("BLS_API_KEY"));
}

export function isCensusConfigured() {
  return Boolean(integrationCredential("CENSUS_API_KEY"));
}

export function isSentryConfigured() {
  return Boolean(integrationCredential("SENTRY_DSN"));
}

export function webhookSecret(provider: string) {
  return (
    integrationCredential(`${provider.toUpperCase().replace(/[^A-Z]/g, "_")}_WEBHOOK_SECRET`) ??
    integrationCredential("INTEGRATION_WEBHOOK_SECRET")
  );
}

export function calendarWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: isMicrosoftCalendarLive() ? "microsoft" : isGoogleCalendarLive() ? "google" : "calendar",
    configured: isMicrosoftConfigured() || isGoogleConfigured(),
    liveWired: isCalendarLiveWired(),
    mockDetail:
      "Interview scheduling uses MockCalendarProvider. Microsoft/Google OAuth tokens are not present. Workspace client IDs, when set later, stay Integration Hub references until a refresh token exists.",
    configuredDetail:
      "Microsoft/Google app credentials are present as Integration Hub references. liveScheduling stays false until an OAuth refresh token exists (GOOGLE_REFRESH_TOKEN or MICROSOFT_REFRESH_TOKEN).",
    liveDetail: "Live calendar scheduling is enabled. OAuth refresh tokens are present. Token values are not displayed.",
  });
}

export function checkrWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "checkr",
    configured: isCheckrConfigured(),
    liveWired: isCheckrLiveApiWired(),
    manualWhenUnconfigured: true,
    mockDetail:
      "NOT CONFIGURED — ManualBackgroundCheckProvider only. Results never auto-reject. WorkforceOS does not generate FCRA adverse-action letters.",
    configuredDetail: "CHECKR_API_KEY is set. Live invitations and signed webhooks are available. Human review is required. Results never auto-reject.",
    liveDetail: "Checkr live API is wired. Human review is still required. Results never auto-reject. Adverse-action letters are not generated here.",
  });
}

export function docusignWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "docusign",
    configured: isDocuSignConfigured(),
    liveWired: isDocuSignLiveWired(),
    mockDetail: "NOT CONFIGURED — Manual contract execution remains. Unsigned webhooks cannot mark a contract executed.",
    configuredDetail:
      "DocuSign integration key and user id are present. Live envelopes stay off until DOCUSIGN_SECRET_KEY and DOCUSIGN_ACCOUNT_ID are set. Manual execution remains.",
    liveDetail: "DocuSign live envelopes are wired. Contracts still require confirmed signature status before executed.",
  });
}

export function quickbooksWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "quickbooks",
    configured: isQuickBooksConfigured(),
    liveWired: isQuickBooksLiveWired(),
    mockDetail: "NOT CONFIGURED — Operating invoices stay in WorkforceOS. QuickBooks is not the operating ledger.",
    configuredDetail:
      "QuickBooks app credentials are present. Live invoice posting stays off until QUICKBOOKS_REFRESH_TOKEN and QUICKBOOKS_REALM_ID are set.",
    liveDetail: "QuickBooks live posting is wired. WorkforceOS remains the operating record; QuickBooks is the accounting ledger.",
  });
}

export function seekoutWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "seekout",
    configured: isSeekOutConfigured(),
    liveWired: isSeekOutLiveWired(),
    mockDetail: "NOT CONFIGURED — Internal Talent Network search remains first. SeekOut stays a labeled mock.",
    configuredDetail: "SEEKOUT_API_KEY is set. External lookup runs only after internal Talent Network search completes.",
    liveDetail: "SeekOut live lookup is wired. Internal Talent Network search still runs first. Values are not displayed.",
  });
}

export function apolloWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "apollo",
    configured: isApolloConfigured(),
    liveWired: isApolloLiveWired(),
    mockDetail: "NOT CONFIGURED — Apollo enrichment stays review-gated labeled mock.",
    configuredDetail: "APOLLO_API_KEY is set. Proposed fields require a human accept. Approved CRM values are not overwritten.",
    liveDetail: "Apollo live enrichment is wired. Human accept is still required. Approved CRM values are not overwritten.",
  });
}

export function sentryWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "sentry",
    configured: isSentryConfigured(),
    liveWired: isSentryConfigured(),
    mockDetail: "NOT CONFIGURED — SENTRY_DSN is unset. Official SDK stays idle.",
    configuredDetail: "SENTRY_DSN is set. Official Sentry SDK is initialized. The DSN is not displayed.",
    liveDetail: "SENTRY_DSN is set. Official Sentry SDK is initialized. Events omit secrets and candidate contact fields.",
  });
}

export function resendWiringStatus(): ProviderWiringStatus {
  return wiringFromFlags({
    provider: "resend",
    configured: isResendConfigured(),
    liveWired: isResendConfigured(),
    mockDetail: "NOT CONFIGURED — MockEmailProvider in development/test; production transactional send fails clearly.",
    configuredDetail: "RESEND_API_KEY and RESEND_FROM_EMAIL are set. Transactional only; not a Microsoft/Google inbox.",
    liveDetail: "Resend transactional send is wired. Scout send still requires scout.external_actions and human confirmation.",
  });
}
