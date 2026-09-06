export function integrationCredential(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function isQuickBooksConfigured() {
  return Boolean(integrationCredential("QUICKBOOKS_CLIENT_ID") && integrationCredential("QUICKBOOKS_CLIENT_SECRET"));
}

export function isDocuSignConfigured() {
  return Boolean(integrationCredential("DOCUSIGN_INTEGRATION_KEY") && integrationCredential("DOCUSIGN_USER_ID"));
}

export function isApolloConfigured() {
  return Boolean(integrationCredential("APOLLO_API_KEY"));
}

export function isOnetConfigured() {
  return Boolean(integrationCredential("ONET_API_KEY"));
}

export function isSeekOutConfigured() {
  return Boolean(integrationCredential("SEEKOUT_API_KEY"));
}

export function isMicrosoftConfigured() {
  return Boolean(integrationCredential("MICROSOFT_CLIENT_ID") && integrationCredential("MICROSOFT_CLIENT_SECRET"));
}

export function isGoogleConfigured() {
  return Boolean(integrationCredential("GOOGLE_CLIENT_ID") && integrationCredential("GOOGLE_CLIENT_SECRET"));
}

export function isResendConfigured() {
  return Boolean(integrationCredential("RESEND_API_KEY") && integrationCredential("RESEND_FROM_EMAIL"));
}

export function isCheckrConfigured() {
  return Boolean(integrationCredential("CHECKR_API_KEY"));
}

/** Live Checkr HTTP API is not implemented. A key alone is not a working integration. */
export function isCheckrLiveApiWired() {
  return false;
}

export function isDrugScreenConfigured() {
  return false;
}

export function webhookSecret(provider: string) {
  return (
    integrationCredential(`${provider.toUpperCase().replace(/[^A-Z]/g, "_")}_WEBHOOK_SECRET`) ??
    integrationCredential("INTEGRATION_WEBHOOK_SECRET")
  );
}
