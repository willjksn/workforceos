# Resend

Resend is the WorkforceOS transactional email implementation (`EmailProvider` → `ResendEmailProvider`). Recruiter-authored mail still uses Microsoft 365 or Google Workspace. Scout drafts; it does not send.

## Environment

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
```

Do not put these in client bundles. Never commit real keys.

| Environment | Behavior |
| --- | --- |
| `NODE_ENV=test` or Vitest | `MockEmailProvider` |
| development, keys unset | `MockEmailProvider` (labeled mock; events still recorded) |
| production, keys unset | `UnconfiguredEmailProvider` — send returns `status: failed` with a clear error. It does not silently pretend mail was sent. |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set | `ResendEmailProvider` |

## Production domain

Verify a sending domain in Resend before go-live. Recommended:

- `careers@pieronepartners.com`
- `recruiting@pieronepartners.com`
- `noreply@pieronepartners.com`

DNS (SPF / DKIM / DMARC) is **not assumed complete**. Missing DNS means Resend API calls can still be made but messages may not deliver. Application records and `transactional_email_events` remain the system of record.

## Templates

Implemented in `lib/hiring/templates.ts`:

- `application_received`
- `interview_invitation` / `interview_confirmation` / `interview_reminder` / `interview_rescheduled` / `interview_cancelled`
- `resume_request` / `application_update`
- `background_check_next_step` / `drug_screen_next_step`
- `offer_available`
- `onboarding_welcome` / `onboarding_reminder` / `start_date_reminder`

## Events

`transactional_email_events` stores provider, template, recipient, entity, status, `provider_message_id`, and error. Do not store raw HTML bodies. Failed sends are `failed`, not silent success.

## Go-live checklist

1. Create a Resend account and API key for this environment only.
2. Add and verify the sending domain. Wait until DNS checks pass.
3. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on Vercel Production (and Preview if you want preview mail).
4. Send one test `application_received` to an internal inbox.
5. Confirm System Health shows Resend keys present and does not display secrets.
