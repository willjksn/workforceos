# M8 — Command Center, Scout, and navigation

M8 consolidates how operators reach M1–M7. It does not add a matcher, a workforce engine, a business table, or a migration.

## Navigation map

Permanent peer destinations in `components/navigation/nav-config.ts` before M8: **56**.

Those peers were Command Center, Reports, Alerts, Help, Staff onboarding, nine Commercial links, six Delivery links, eighteen Talent links, thirteen Pathway links, and five Admin links.

After M8, a managing partner sees **8** top-level destinations. Children appear under the section they belong to. Everything else is on More, still permission-gated, and the old URLs still render.

| Before (peer) | After |
| --- | --- |
| Command Center, Reports, Alerts, Help, Staff onboarding | Command Center and Reports stay. Alerts, Help, and Staff onboarding move to More. |
| Companies, Contacts, CRM Opportunities, inquiries, signals, discovery, solutions, services, proposals | Companies stays. The rest move to More → CRM. CRM Opportunities stay labeled as commercial pursuits. |
| Projects, deliverables, contracts, legal, workforce, finance | Workforce stays. The rest move to More → Delivery. |
| Candidates plus pools, search, pipeline, submissions, interviews, offers, placements, jobs | Talent and Jobs stay. Specialist talent tools move to More. |
| Military Talent and twelve sibling military tools | Military Talent is a child of Talent. Capability Translation, Mapping Review, and Military Supply stay linked. Crosswalk, reverse lookup, installations, and analytics stay reachable and are not peer navigations. |
| AI, Review Queue, integrations, public content, Team & Access | More → Admin, plus Needs Review for the queues an operator can act on. |

Final hierarchy:

- Command Center `/app`
- Talent
  - Talent Network `/app/talent`
  - Military Talent `/app/military`
  - Needs Review `/app/review`
- Jobs
  - All Jobs `/app/jobs`
  - Follow-ups `/app/jobs/engagements`
  - Career Sources `/app/jobs/career-sources`
- Companies `/app/companies`
- Workforce
  - Overview `/app/workforce`
  - Roles `/app/workforce/roles`
  - Assessments `/app/workforce/assessments`
  - Military Supply `/app/workforce/military-supply`
- Scout `/app/scout` (the header control remains Open Scout)
- Reports `/app/reports`
- More `/app/more`

Desktop uses the labeled sidebar. Tablet (`md` up to `lg`) uses the icon rail of those top-level destinations. Phone uses the existing menu. Keyboard focus stays on links.

Keep: canonical record routes for a candidate, job, company, engagement, workforce role, and transition profile.

Consolidate: military translator tools under Military Talent. Workforce's long tab bar becomes four tabs plus links.

Redirect: none of the legacy list URLs were deleted. Headcount requests and internal searches still use their existing Jobs query parameters.

Hide from primary nav: CRM, finance, admin, alerts, academy, and the military specialist tools.

Deprecate later: Civilian Crosswalk and Reverse Search. They remain, labeled as legacy views of the same mappings. Do not add a second official translator.

Global search across candidates, jobs, companies, and workforce roles was not expanded. Existing Talent and Jobs search stays. Embeddings stay off.

## Command Center

`getOperationalCommandCenter` loads bounded counts in parallel and `composeOperationalBoard` orders the sections. React does not own the rules.

Sections, when the principal's permissions allow them:

- Needs attention — overdue follow-ups, candidate responses, referrals, No Fit, interviews, stale matches, pending reviews
- Talent — new members in seven days, incomplete transition profiles, people waiting more than five days, profiles with no open engagement
- Demand — new and changed public jobs, requirement review, open jobs without a strong match
- Pipeline — started engagements, employer review, interviews, No Fit
- Workforce — critical roles, gap roles, quantity gaps, empty active pipelines, from `loadWorkforcePortfolio`
- System — career sources that are not LIVE

Section order uses effective permissions. A military reviewer (`military.review` without `workforce.write`) sees talent before workforce. A planner (`workforce.read` without `candidates.write`) sees workforce first. A recruiter sees follow-ups, talent, jobs, and pipeline first. An owner with workforce administration, candidate administration, and CRM read sees the broader set. Job title text is not read.

Every count links to a filter the destination honors: `bucket`, `waiting`, `status=interview`, `status=started`, `view=employer_review`, `context=monitored_public`, `window=week`, `changed=week`, `requirements=review`, `match=stale`, `matches=none`, `health`, `joined=week`, `channel=military`, `workflow=none`, `profile=incomplete`. Interview status and employer-review counts use those filters because an interview is not the same queue bucket as "interview requested."

Time windows use `createdAt`, `updatedAt`, and M6 `lastActivityAt` / `nextFollowUpAt`. The page shows an as-of time. Row order is not a recency proxy.

A query that throws is `Unable to load this data`. A query that returns nothing is `No items need attention` or the section's empty sentence. Zeros are not substituted for failures.

There is no cache. The source is the canonical tables, freshness is the request time, and the next request reads again.

The older business snapshot remains at `/app?view=business` for principals who can read finance or CRM. It is not the landing page.

## Scout

Scout is still one assistant. `lib/scout/commands.ts` keeps the original families. `lib/scout/operational-commands.ts` adds closed command ids that those families carry. The parser never interpolates a prompt into SQL. An unknown `SNAKE_CASE` token is rejected. A command id that is not in the registry is rejected inside execution.

Permissions are checked in `executeOperationalScoutCommand` after the family check. Missing permission returns a rejection and does not call the canonical service.

Reads call existing services: M5 `listCandidateOpportunityMatches` and `listJobTalentMatches`, M6 `listEngagementQueue`, M7 `loadWorkforcePortfolio` and `loadWorkforceRolePipeline`. Why-match prints the stored category, aligned capabilities, gaps and unknowns, evidence, timing, and freshness. It does not ask a model for a second explanation.

Entity names that match more than one record return links. Scout does not pick one.

Results are capped at 25. Answers name stored fact, derived WorkforceOS calculation, or human-reviewed mapping, and include an as-of time and a link. Public jobs are labeled Public opportunity. CRM pursuits are a different command and require `opportunities.read`.

`candidate_pii.read` is required before email or phone is left on a card. Workforce answers do not request it. Known supply is a count of stored people. Military occupation channels are listed as occupations and the wording says they are not people.

The only controlled write is `ops.set_follow_up`. It requires `scout.internal_actions` and `jobs.write`, shows a confirmation through the existing Scout confirm path, then calls `setEngagementFollowUp`, which audits `engagement.follow_up_changed`. Without confirmation the service is not called.

Requests to email, route, submit, or mark a message sent return `ops.m6_handoff` and a link to Follow-ups. That command does not call the M6 send functions.

Passive reads follow the existing Scout convention and do not add audit rows. Command Center reads are not audited.

## Needs Review

`/app/review` counts military mappings, candidate capabilities, and job requirements, and links each to the screen that already reviews that record. AI review and approvals appear only with their existing permissions. There is no shared review table.

## Military

One candidate. The Transition Talent Profile is the overlay at `/app/military/candidates`, and the person link is `/app/talent/[id]`. Capability Translation is `/app/military/translator`. Mapping Review is `/app/military/review`. Military supply is `/app/workforce/military-supply`.

## Not in M8

M9 outcome learning is not started. M5 weights are unchanged. M10 brand migration is not started. Embeddings are not activated. No ATS dependency was added. Parked research `1a356d3` was not merged. Migrations `0025` and `0026` were not applied to production. No production migration was added.
