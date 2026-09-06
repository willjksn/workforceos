import { getServerEnv } from "../env";
import { getSharedMockEmailProvider } from "./mock";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";
import { UnconfiguredEmailProvider } from "./unconfigured";

export type { EmailProvider, SendResult, SendTransactionalInput, TransactionalEmailTemplate } from "./types";
export { MockEmailProvider, getSharedMockEmailProvider, resetMockEmailProvider } from "./mock";
export { ResendEmailProvider } from "./resend";
export { UnconfiguredEmailProvider, UNCONFIGURED_EMAIL_ERROR } from "./unconfigured";

export function getEmailProvider(): EmailProvider {
  const env = getServerEnv();
  if (env.NODE_ENV === "test" || process.env.VITEST) {
    return getSharedMockEmailProvider();
  }
  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    return new ResendEmailProvider(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  }
  if (env.NODE_ENV === "production") {
    return new UnconfiguredEmailProvider();
  }
  return getSharedMockEmailProvider();
}

export function isTransactionalEmailConfigured() {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}
