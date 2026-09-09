import {
  calendarWiringStatus,
  isGoogleCalendarLive,
  isGoogleConfigured,
  isMicrosoftCalendarLive,
  isMicrosoftConfigured,
} from "../integrations/credentials";
import { GoogleCalendarProvider, MicrosoftCalendarProvider } from "./live";
import { getSharedMockCalendarProvider } from "./mock";
import type { CalendarProvider } from "./types";

export type { CalendarEventInput, CalendarEventRecord, CalendarProvider, CalendarSlot } from "./types";
export { MockCalendarProvider, getSharedMockCalendarProvider } from "./mock";
export { GoogleCalendarProvider, MicrosoftCalendarProvider } from "./live";

export function getCalendarProvider(): CalendarProvider {
  if (isMicrosoftCalendarLive()) return new MicrosoftCalendarProvider();
  if (isGoogleCalendarLive()) return new GoogleCalendarProvider();
  return getSharedMockCalendarProvider();
}

export function calendarProviderStatus() {
  const wiring = calendarWiringStatus();
  const provider = getCalendarProvider();
  return {
    provider: provider.name,
    configured: wiring.configured,
    liveWired: wiring.liveWired,
    liveScheduling: provider.liveScheduling,
    wiring: wiring.wiring,
    liveLabel: wiring.liveLabel,
    nonProduction: !provider.liveScheduling,
    workspaceCredentials: isMicrosoftConfigured() ? "microsoft" : isGoogleConfigured() ? "google" : "none",
    detail: wiring.detail,
  };
}
