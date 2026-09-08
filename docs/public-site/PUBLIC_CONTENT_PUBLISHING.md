# Public content publishing

Status: accepted  
This is a lightweight publishing layer, not a CMS.

## Split of control

| Belongs in WorkforceOS | Remains in public website code |
| --- | --- |
| Featured jobs | Homepage core positioning |
| Featured SkillBridge Opportunities | About, services, industries structure |
| Homepage hiring banner | Permanent brand copy |
| Urgent hiring notice | Legal pages |
| Temporary announcements | Visual system (navy, teal, slate, Cormorant, Inter) |
| Featured industry campaigns | Navigation and page layout |

Jobs and SkillBridge public roles stay single-source in WorkforceOS `jobs` / `job_postings`. Featured rows reference those records. They do not duplicate website job pages.

Public SkillBridge features are **published SkillBridge-eligible employer/host-company job postings** facilitated by PierOne, not PierOne-owned slots and not `skillbridge_opportunities` (those are candidate–employer operating records with Restricted PII).

## Roles and permissions

| Permission | Meaning |
| --- | --- |
| `public_content.read` | View the Public content module and Scout live/scheduled lists |
| `public_content.manage` | Create, edit, schedule, archive |
| `public_content.publish` | Activate or deactivate (make eligible to appear) |

Managing Partner, Operations Administrator, and Strategy/Technology Administrator have all three. Talent Partner and Read Only can view. Recruiters do not receive publishing access automatically.

## Publishing process

1. Open **Public website → Public content**.
2. Create an item (banner, featured job, announcement, campaign, or notice).
3. Link a public, published, open job when featuring a role.
4. Set optional start/end and priority (lower numbers appear first).
5. Activate. Activation requires `public_content.publish`.
6. Preview current public placement from Overview. Placement links open the live public pages (`/`, `/careers`, `/skillbridge`), not unpublished routes.

Plain text only. No arbitrary HTML or CSS. Banner styles are `navy`, `teal`, or `light`.

## Active rule

An item is publicly active only when:

- `is_active = true`
- `starts_at` is null or `<= now`
- `ends_at` is null or `> now`
- linked job (when required) remains public, published, and open

Closed jobs drop from `GET /api/public/v1/content` immediately at query time. The featured row is not rewritten.

## Scheduling

Dates are evaluated at read time. Inngest is not used for activation or expiration.

## Preview

Overview lists currently rendering items, their placement, and the public path they link to. It does not expose draft website pages.

## Cache / revalidation

- Gateway: `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`
- Public site fetch: `next: { revalidate: 60 }`
- After a WorkforceOS publish change, WorkforceOS POSTs to the public site `/api/revalidate` when `PUBLIC_CAREERS_URL` and `PUBLIC_SITE_INTEGRATION_SECRET` are set. If that call fails, the 60-second TTL still expires the stale page.

Changing an active Public Content record does **not** require a website code deployment.

## Public API

`GET /api/public/v1/content`  
Optional `?placement=home|careers|skillbridge|site_wide`

Response groups: `featuredJobs`, `featuredSkillBridge`, `banners`, `announcements`, `campaigns`, `urgentNotices`.

Public DTOs omit internal ids, creator ids, notes, and audit history.

## Scout

Read: “Show me what's currently featured on the public website.” / “Show scheduled public announcements.”

Writes (CREATE/UPDATE, confirmation required): feature a job, feature a SkillBridge role, create a hiring banner, remove the current urgent hiring notice.

Scout cannot publish arbitrary unsupported content types automatically.
