# Interview scheduling

`CalendarProvider` (`lib/calendar`) exposes `getAvailability`, `createEvent`, `updateEvent`, and `cancelEvent`.

## Phase 10 status: mock only

`getCalendarProvider()` always returns `MockCalendarProvider`. `liveScheduling` is `false` even when Microsoft or Google client credentials exist. Those credentials remain Integration Hub workspace references (not a second Outlook/Gmail, and not live slot booking).

Mock events are unmistakably non-production:

- `provider: "mock"`
- `mock: true`
- `externalEventId` prefix `MOCK-NON-PRODUCTION-`
- meeting URL host `mock.non-production.workforceos.invalid`

Candidate self-scheduling is **not** in Phase 10. Recruiters schedule internally from the application / interview flow.

`interview_calendar_events` stores provider, external event id, owner, start/end, timezone, meeting URL, and status. Do not rely only on email metadata.

Interview reminders are an Inngest function (`workforceos/interview-reminder`) with idempotency on interview id + window.

## Remaining live OAuth setup (follow-on)

Do not treat workspace credentials as a working scheduler.

1. Register Microsoft Graph and/or Google Calendar OAuth apps with calendar.readonly + calendar.events scopes (exact scopes from counsel/IT).
2. Store client id/secret per environment. Do not put them in client bundles.
3. Implement a live adapter that satisfies `CalendarProvider` and only then change `getCalendarProvider()` to select it.
4. Persist refresh tokens through Integration Hub `integration_connections` / `external_records`. PostgreSQL remains the system of record for interview rows.
5. Keep the mock adapter for tests and unconfigured environments.
6. Candidate self-scheduling, if needed later, must reuse the same adapter and stored `interview_calendar_events`.
