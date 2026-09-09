# Checkr

Checkr is the preferred background-check provider. The live HTTP path is implemented behind `CHECKR_API_KEY`. Without that key, WorkforceOS stays on `ManualBackgroundCheckProvider`.

## Honest classification

| Claim | Status |
| --- | --- |
| Adapter interface | Yes — `BackgroundCheckProvider` |
| Manual operating workflow | Yes — when `CHECKR_API_KEY` is unset |
| Live Checkr HTTP client | Yes — invitations and status when the key is present (test doubles in CI) |
| Sandbox-ready | Code path ready. Production stays BLOCKED until Encrypted `CHECKR_API_KEY` / `CHECKR_WEBHOOK_SECRET` exist in Vercel |
| Webhook signature verification | Yes — unsigned payloads are rejected; `CHECKR_WEBHOOK_SECRET` or `INTEGRATION_WEBHOOK_SECRET` |
| Auto-reject from results | **Never** — `applyBackgroundResult({ autoReject: true })` throws. Webhooks never reject an application |

`getBackgroundCheckProvider()` returns Checkr only when `CHECKR_API_KEY` is set. Human review is required. WorkforceOS does not generate FCRA adverse-action letters; counsel issues any legally required notices.

## Sandbox / production setup (Phase M)

1. Create a Checkr **sandbox** account first. Do not use production credentials in preview.
2. Store `CHECKR_API_KEY` and `CHECKR_WEBHOOK_SECRET` in the matching Vercel environment only. Do not put values in git or `NEXT_PUBLIC_*`.
3. Point Checkr webhooks at `/api/integrations/webhooks/checkr`. Unsigned payloads are rejected and intake is rate-limited.
4. Keep statuses provider-neutral on `background_checks`. Do not store full third-party reports when provider-hosted access is enough.
5. Keep human review. Adapters must not reject candidates.
6. Legal disclosure / adverse-action text must come from counsel, not product copy.

Do not claim Checkr is live in production until Encrypted Vercel vars exist. Phase M owns key input.
