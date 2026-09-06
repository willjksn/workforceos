import type { CalendarEventInput, CalendarEventRecord, CalendarProvider, CalendarSlot } from "./types";

export class MockCalendarProvider implements CalendarProvider {
  readonly name = "mock";
  readonly configured = false;
  readonly liveScheduling = false;
  readonly nonProduction = true;
  readonly events = new Map<string, CalendarEventRecord>();

  async getAvailability(input: {
    owner: string;
    from: Date;
    to: Date;
    durationMinutes: number;
  }): Promise<CalendarSlot[]> {
    void input.owner;
    void input.to;
    const start = new Date(input.from);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 2);
    const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
    return [{ start, end, timezone: "America/New_York" }];
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEventRecord> {
    const record: CalendarEventRecord = {
      provider: "mock",
      mock: true,
      externalEventId: `MOCK-NON-PRODUCTION-${this.events.size + 1}`,
      meetingUrl: "https://mock.non-production.workforceos.invalid/interview",
      start: input.start,
      end: input.end,
      timezone: input.timezone,
      status: "scheduled",
    };
    this.events.set(record.externalEventId, record);
    return record;
  }

  async updateEvent(externalEventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEventRecord> {
    const existing = this.events.get(externalEventId);
    if (!existing) throw new Error("Calendar event not found");
    const updated: CalendarEventRecord = {
      ...existing,
      start: input.start ?? existing.start,
      end: input.end ?? existing.end,
      timezone: input.timezone ?? existing.timezone,
      status: "updated",
    };
    this.events.set(externalEventId, updated);
    return updated;
  }

  async cancelEvent(externalEventId: string): Promise<CalendarEventRecord> {
    const existing = this.events.get(externalEventId);
    if (!existing) throw new Error("Calendar event not found");
    const updated = { ...existing, status: "cancelled" as const };
    this.events.set(externalEventId, updated);
    return updated;
  }
}

const shared = new MockCalendarProvider();

export function getSharedMockCalendarProvider() {
  return shared;
}
