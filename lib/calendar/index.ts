import { isGoogleConfigured, isMicrosoftConfigured } from "../integrations/credentials";
import { getSharedMockCalendarProvider } from "./mock";
import type { CalendarProvider } from "./types";

export type { CalendarEventInput, CalendarEventRecord, CalendarProvider, CalendarSlot } from "./types";
export { MockCalendarProvider, getSharedMockCalendarProvider } from "./mock";

export function getCalendarProvider(): CalendarProvider {
  return getSharedMockCalendarProvider();
}

export function calendarProviderStatus() {
  if (isMicrosoftConfigured()) return { provider: "microsoft", configured: true, liveScheduling: false };
  if (isGoogleConfigured()) return { provider: "google", configured: true, liveScheduling: false };
  return { provider: "mock", configured: false, liveScheduling: false };
}
