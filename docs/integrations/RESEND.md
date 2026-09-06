# Resend

Resend is the WorkforceOS transactional email implementation (`EmailProvider` → `ResendEmailProvider`).

## Environment

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
```

Do not put these in client bundles. Tests and unconfigured environments use `MockEmailProvider`. Automated tests must not send to real candidates.

## Production domain

Verify a sending domain before go-live. Recommended:

- `careers@pieronepartners.com`
- `recruiting@pieronepartners.com`
- `noreply@pieronepartners.com`

DNS is not assumed complete.

## Use

Application received, interview invite/reminder/cancel, resume request, offer notice, onboarding welcome/reminder, start-date reminder.

Not a replacement for a recruiter's Microsoft/Google mailbox. Scout drafts; humans send from the mailbox when the message is personal.

Events: `transactional_email_events` (provider, template, recipient, entity, status, provider_message_id). Avoid storing raw bodies unless required.
