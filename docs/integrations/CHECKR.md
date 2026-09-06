# Checkr

Checkr is the **preferred future** background-check provider. It is **not wired** in Phase 10.

## Honest classification

| Claim | Status |
| --- | --- |
| Adapter interface | Yes — `BackgroundCheckProvider` |
| Manual operating workflow | Yes — `ManualBackgroundCheckProvider` |
| Live Checkr HTTP client | **No** |
| Sandbox-ready | **No** — a `CHECKR_API_KEY` does not call Checkr |
| Webhook signature verification against Checkr | **No** |
| Auto-reject from results | **Never** — `applyBackgroundResult({ autoReject: true })` throws |

`CheckrBackgroundCheckProvider` exists only as a labeled stub (`checkr-stub`, `mock: true`). `getBackgroundCheckProvider()` always returns the manual provider.

## Sandbox setup (follow-on)

When a human is ready to wire Checkr:

1. Create a Checkr **sandbox** account. Do not use production credentials in preview.
2. Store `CHECKR_API_KEY` and `CHECKR_WEBHOOK_SECRET` in the matching Vercel environment only.
3. Implement a real HTTP client behind `BackgroundCheckProvider` (candidates, invitations, reports).
4. Verify webhooks with `CHECKR_WEBHOOK_SECRET`. Unsigned payloads must be rejected.
5. Keep statuses provider-neutral on `background_checks`. Do not store full third-party reports when provider-hosted access is enough.
6. Keep human review. Adapters must not reject candidates.
7. Legal disclosure / adverse-action text must come from counsel, not product copy.

## Production setup (follow-on)

Separate production Checkr credentials from sandbox. Repeat the sandbox steps against the live Checkr program only after counsel and operations sign off.

Until then, recruiters request a manual background-check row from the application page.
