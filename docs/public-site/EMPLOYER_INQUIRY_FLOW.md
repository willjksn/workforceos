# Employer inquiry flow

1. Visitor submits `/contact` (or a service page form) on the public website.
2. The website server validates with Zod and POSTs to WorkforceOS `POST /api/public/v1/inquiries`.
3. WorkforceOS rate-limits, checks honeypot, HMAC (required in production), and sanitizes text.
4. A `website_inquiries` row is created with `source = pierone_public_website`.
5. Company matching uses normalized website host only. Unique host → link or create. Ambiguous host → leave unlinked. Name-only → unlinked (`company_match_status = unresolved`).
6. Contact matching uses normalized email. Unique email → link/update. None → create. Name-only matches are not used.
7. An Activity is recorded. An in-app notification is sent to the configured owner role (default `managing-partner`).
8. `EmailProvider` sends an acknowledgement. Timing is not promised.
9. Operators review `/app/crm/inquiries`. Opportunities are created only by a human (or a confirmed Scout convert action).
