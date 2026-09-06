import { isGoogleConfigured, isMicrosoftConfigured } from "../integrations/credentials";
import { getSharedMockCalendarProvider } from "./mock";
import type { CalendarProvider } from "./types";

export type { CalendarEventInput, CalendarEventRecord, CalendarProvider, CalendarSlot } from "./types";
export { MockCalendarProvider, getSharedMockCalendarProvider } from "./mock";

export function getCalendarProvider(): CalendarProvider {
  return getSharedMockCalendarProvider();
}

export function calendarProviderStatus() {
  const workspace = isMicrosoftConfigured() ? "microsoft" : isGoogleConfigured() ? "google" : "none";
  return {
    provider: "mock" as const,
    configured: false,
    liveScheduling: false,
    nonProduction: true,
    workspaceCredentials: workspace,
    detail:
      "Interview scheduling always uses MockCalendarProvider. Microsoft/Google OAuth slot booking is not enabled. Workspace credentials, when present, are Integration Hub references only.",
  };
}
