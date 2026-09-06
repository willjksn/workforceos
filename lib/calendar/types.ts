export type CalendarSlot = {
  start: Date;
  end: Date;
  timezone: string;
};

export type CalendarEventInput = {
  title: string;
  start: Date;
  end: Date;
  timezone: string;
  attendees: string[];
  description?: string;
  location?: string;
};

export type CalendarEventRecord = {
  provider: string;
  mock: boolean;
  externalEventId: string;
  meetingUrl: string | null;
  start: Date;
  end: Date;
  timezone: string;
  status: "scheduled" | "updated" | "cancelled";
};

export interface CalendarProvider {
  readonly name: string;
  readonly configured: boolean;
  readonly liveScheduling: boolean;
  getAvailability(input: { owner: string; from: Date; to: Date; durationMinutes: number }): Promise<CalendarSlot[]>;
  createEvent(input: CalendarEventInput): Promise<CalendarEventRecord>;
  updateEvent(externalEventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEventRecord>;
  cancelEvent(externalEventId: string): Promise<CalendarEventRecord>;
}
