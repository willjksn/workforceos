# Interview scheduling

`CalendarProvider` (`lib/calendar`) exposes `getAvailability`, `createEvent`, `updateEvent`, and `cancelEvent`.

Microsoft 365 and Google Workspace credentials, when present, are Integration Hub workspace adapters. Live OAuth slot booking is not enabled until that adapter implements scheduling. Unconfigured and test environments use `MockCalendarProvider`.

`interview_calendar_events` stores provider, external event id, owner, start/end, timezone, meeting URL, and status. Do not rely only on email metadata.

Interview reminders are an Inngest function (`workforceos/interview-reminder`) with idempotency on interview id + window.
