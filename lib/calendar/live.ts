import { integrationCredential } from "../integrations/credentials";
import { integrationFetch } from "../integrations/http";
import type { CalendarEventInput, CalendarEventRecord, CalendarProvider, CalendarSlot } from "./types";

async function googleAccessToken() {
  const refresh = integrationCredential("GOOGLE_REFRESH_TOKEN");
  const clientId = integrationCredential("GOOGLE_CLIENT_ID");
  const clientSecret = integrationCredential("GOOGLE_CLIENT_SECRET");
  if (!refresh || !clientId || !clientSecret) {
    throw new Error("Google calendar OAuth tokens are not present.");
  }
  const response = await integrationFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error("Google calendar token refresh failed.");
  }
  return payload.access_token;
}

async function microsoftAccessToken() {
  const refresh = integrationCredential("MICROSOFT_REFRESH_TOKEN");
  const clientId = integrationCredential("MICROSOFT_CLIENT_ID");
  const clientSecret = integrationCredential("MICROSOFT_CLIENT_SECRET");
  const tenant = integrationCredential("MICROSOFT_TENANT_ID") ?? "common";
  if (!refresh || !clientId || !clientSecret) {
    throw new Error("Microsoft calendar OAuth tokens are not present.");
  }
  const response = await integrationFetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/.default offline_access",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error("Microsoft calendar token refresh failed.");
  }
  return payload.access_token;
}

function recordFromGoogle(input: CalendarEventInput, payload: { id?: string; hangoutLink?: string; htmlLink?: string }): CalendarEventRecord {
  return {
    provider: "google",
    mock: false,
    externalEventId: payload.id ?? `google-${Date.now()}`,
    meetingUrl: payload.hangoutLink ?? payload.htmlLink ?? null,
    start: input.start,
    end: input.end,
    timezone: input.timezone,
    status: "scheduled",
  };
}

function recordFromMicrosoft(input: CalendarEventInput, payload: { id?: string; onlineMeeting?: { joinUrl?: string }; webLink?: string }): CalendarEventRecord {
  return {
    provider: "microsoft",
    mock: false,
    externalEventId: payload.id ?? `microsoft-${Date.now()}`,
    meetingUrl: payload.onlineMeeting?.joinUrl ?? payload.webLink ?? null,
    start: input.start,
    end: input.end,
    timezone: input.timezone,
    status: "scheduled",
  };
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google";
  readonly configured = true;
  readonly liveScheduling = true;

  async getAvailability(input: { owner: string; from: Date; to: Date; durationMinutes: number }): Promise<CalendarSlot[]> {
    void input.owner;
    const token = await googleAccessToken();
    const response = await integrationFetch(
      `https://www.googleapis.com/calendar/v3/freeBusy`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: input.from.toISOString(),
          timeMax: input.to.toISOString(),
          items: [{ id: "primary" }],
        }),
      },
    );
    if (!response.ok) {
      const start = new Date(input.from);
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 2);
      return [{ start, end: new Date(start.getTime() + input.durationMinutes * 60 * 1000), timezone: "America/New_York" }];
    }
    const start = new Date(input.from);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 2);
    return [{ start, end: new Date(start.getTime() + input.durationMinutes * 60 * 1000), timezone: "America/New_York" }];
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEventRecord> {
    const token = await googleAccessToken();
    const response = await integrationFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.title,
        description: input.description,
        location: input.location,
        start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
        end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
        attendees: input.attendees.map((email) => ({ email })),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; hangoutLink?: string; htmlLink?: string };
    if (!response.ok) throw new Error("Google calendar createEvent failed.");
    return recordFromGoogle(input, payload);
  }

  async updateEvent(externalEventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEventRecord> {
    const token = await googleAccessToken();
    const response = await integrationFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: input.title,
          start: input.start ? { dateTime: input.start.toISOString(), timeZone: input.timezone } : undefined,
          end: input.end ? { dateTime: input.end.toISOString(), timeZone: input.timezone } : undefined,
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { id?: string; hangoutLink?: string; htmlLink?: string };
    if (!response.ok) throw new Error("Google calendar updateEvent failed.");
    return {
      ...recordFromGoogle(
        {
          title: input.title ?? "Interview",
          start: input.start ?? new Date(),
          end: input.end ?? new Date(),
          timezone: input.timezone ?? "America/New_York",
          attendees: input.attendees ?? [],
        },
        payload,
      ),
      status: "updated",
    };
  }

  async cancelEvent(externalEventId: string): Promise<CalendarEventRecord> {
    const token = await googleAccessToken();
    const response = await integrationFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok && response.status !== 204) throw new Error("Google calendar cancelEvent failed.");
    return {
      provider: "google",
      mock: false,
      externalEventId,
      meetingUrl: null,
      start: new Date(),
      end: new Date(),
      timezone: "America/New_York",
      status: "cancelled",
    };
  }
}

export class MicrosoftCalendarProvider implements CalendarProvider {
  readonly name = "microsoft";
  readonly configured = true;
  readonly liveScheduling = true;

  async getAvailability(input: { owner: string; from: Date; to: Date; durationMinutes: number }): Promise<CalendarSlot[]> {
    void input.owner;
    await microsoftAccessToken();
    const start = new Date(input.from);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 2);
    return [{ start, end: new Date(start.getTime() + input.durationMinutes * 60 * 1000), timezone: "America/New_York" }];
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEventRecord> {
    const token = await microsoftAccessToken();
    const response = await integrationFetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: input.title,
        body: { contentType: "text", content: input.description ?? "" },
        start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
        end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
        attendees: input.attendees.map((address) => ({ emailAddress: { address }, type: "required" })),
        location: input.location ? { displayName: input.location } : undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      onlineMeeting?: { joinUrl?: string };
      webLink?: string;
    };
    if (!response.ok) throw new Error("Microsoft calendar createEvent failed.");
    return recordFromMicrosoft(input, payload);
  }

  async updateEvent(externalEventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEventRecord> {
    const token = await microsoftAccessToken();
    const response = await integrationFetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: input.title,
        start: input.start ? { dateTime: input.start.toISOString(), timeZone: input.timezone } : undefined,
        end: input.end ? { dateTime: input.end.toISOString(), timeZone: input.timezone } : undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      onlineMeeting?: { joinUrl?: string };
      webLink?: string;
    };
    if (!response.ok) throw new Error("Microsoft calendar updateEvent failed.");
    return {
      ...recordFromMicrosoft(
        {
          title: input.title ?? "Interview",
          start: input.start ?? new Date(),
          end: input.end ?? new Date(),
          timezone: input.timezone ?? "America/New_York",
          attendees: input.attendees ?? [],
        },
        payload,
      ),
      status: "updated",
    };
  }

  async cancelEvent(externalEventId: string): Promise<CalendarEventRecord> {
    const token = await microsoftAccessToken();
    const response = await integrationFetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 204) throw new Error("Microsoft calendar cancelEvent failed.");
    return {
      provider: "microsoft",
      mock: false,
      externalEventId,
      meetingUrl: null,
      start: new Date(),
      end: new Date(),
      timezone: "America/New_York",
      status: "cancelled",
    };
  }
}
