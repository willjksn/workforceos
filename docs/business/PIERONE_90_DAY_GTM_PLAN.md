# PierOne Partners 90-day GTM / launch operations plan

Status: Phase K (2026-09-09)  
Audience: Managing Partner, Senior Talent Partner, Operations, and other commercial owners  
This is the written 90-day sales and operating plan. **WorkforceOS is the system of execution** (CRM + Command Center + playbooks). It is not a second CRM and not a public job marketplace.

Company operating model: `docs/business/PIERONE_OPERATING_MANUAL.md`. Repeatable delivery maps: `docs/business/SERVICE_PLAYBOOKS.md`. Do not invent a sixth launch service. Do not invent military-mapping or workflow rules here — execute approved `service_workflows` records.

Weekly review in the OS: **Command Center → GTM** at `/app?cadence=gtm`. Academy: 90-day GTM review.

## Locked scope

### Five launch services only

Display names are canonical for operators and the public site. The search offer is **Professional & Technical Search**; the slug stays `professional-search` (DEC-SVC-005). Not a sixth service.

| Display name | Code | Typical GTM motion |
| --- | --- | --- |
| Professional & Technical Search | `professional-search` | Retained or project search. Talent Network first. |
| Military Talent Opportunity Assessment | `military-talent-opportunity-assessment` | Employer conversation: can this need be served through military talent translation? |
| Talent Acquisition Performance Assessment | `ta-performance-assessment` | Diagnose a client TA function. |
| Fractional Talent Partner | `fractional-talent-partner` | Scoped fractional talent leadership. Not temp staffing or payroll. |
| Workforce Pipeline Assessment | `workforce-pipeline-assessment` | Demand, supply, gaps, human-approved plan. |

Do not sell temp staffing, payroll, a public marketplace, or cap-table work. SkillBridge is a **pathway type** inside Military Talent operations, not a sixth offer and not a PierOne-owned host program.

### Focus industries (locked for this plan)

These are emphasis areas for target accounts. They are **not** new services.

**Tier 1**

- Energy / Utilities
- Advanced Manufacturing
- Infrastructure
- Industrial / Technical Operations

**Tier 2**

- Data Centers
- Aerospace / Defense
- Engineering
- Supply Chain / Logistics

Store the account on **Companies** (`/app/companies`). Set `gtm_tier` (Tier 1 / Tier 2) and `gtm_region` (Southeast / National). Keep `industry` as the human label. Do not invent a parallel accounts table.

### Access (Title ≠ Access)

Organizational title is display-only (DEC-AUTH-002). Recruiter Standard has **no** `opportunities.read` (DEC-RBAC-001) and must not see the commercial GTM pipeline. Website inquiries are **intake, not auto-opportunities** (DEC-WEB-004). Military Talent Partner language stays intermediary (DEC-MIL-005).

## Two motions

| Motion | Who | Where it lives | What “good” looks like |
| --- | --- | --- | --- |
| **Southeast business development** | Managing Partner / Senior Talent Partner / Operations (`opportunities.read`) | Companies + Opportunities + Discovery + Proposals | Named Tier 1/2 accounts in `gtm_region=southeast`, next actions on file, discoveries and proposals in flight |
| **National recruiting** | Recruiter Standard executes search; Talent Partner owns the commercial relationship | Jobs + Talent Network. Recruiters do **not** own Opportunities | Internal Talent Network search before external sourcing (WFOS-TAL-002). Jobs and submissions move. Commercial stages stay on the Talent Partner |

WorkforceOS is one OS. Recruiters reach authorized job work from Talent and Jobs, not from the GTM board.

## 90-day arc

Dates are operating windows, not a second calendar product. Record work on existing objects as you go.

### Days 1–30 — Install the target list and first conversations

1. Classify target accounts on Companies: industry label, `gtm_tier`, `gtm_region`, owner, `next_action` / `next_action_at`.
2. Run Southeast outbound against Tier 1 first, then Tier 2. National recruiting opens or works jobs only after a human-owned opportunity exists for one of the five services.
3. Qualify website inquiries on `/app/crm/inquiries`. Convert to an opportunity only after a human decides — never auto-create.
4. Book discovery. Do not skip to proposal.
5. Start employer conversations for Military Talent Opportunity Assessment where the need is SkillBridge-eligible or direct-hire military talent. PierOne is the **intermediary**, not the host.

### Days 31–60 — Convert conversations

1. Complete discovery and write a solution for one of the five codes.
2. Advance proposals through internal review before send. Humans send.
3. Keep outbound cadence: every target account has a stored next action. Overdue GTM follow-ups appear on `/app?cadence=gtm`.
4. Publish thought leadership from **Public Content** (`/app/public-content`) — do not stand up a second CMS (DEC-WEB-010).
5. Ask for referrals after a discovery or a closed-won conversation. Record the referred company as a Company, not a note in chat.

### Days 61–90 — Deliver and prove the motion

1. Won work becomes a contract and delivery project. Delivery KPIs are project health, overdue deliverables, and (for search) Talent Network → submission → interview movement.
2. Review win/conversion on the GTM board from stored opportunity stages. Do not invent a forecast.
3. Expand only into another of the five services on the same company.
4. Hold the weekly GTM review in WorkforceOS. Scout may summarize counts the operator can already read. Scout does not generate SQL, does not send, and does not approve.

## Motions mapped to live screens

Each row cites the operating manual / playbook screen. Chat is not the system of record.

### Target-account list

| | |
| --- | --- |
| **Motion** | Build and keep the Tier 1 / Tier 2 list. Southeast vs national. |
| **WorkforceOS screens** | Companies `/app/companies` and `/app/companies/[id]`. Weekly roll-up: `/app?cadence=gtm`. |
| **Data** | `companies.industry`, `companies.gtm_tier`, `companies.gtm_region`, owner, `next_action`, `next_action_at`. Locations stay on `company_locations`. |
| **Owner / access** | `companies.read` / `companies.write`. Commercial review of the list on the GTM board also needs `opportunities.read`. |
| **Playbook / manual** | Operating manual CRM step. Playbook 8 (Client Discovery) CRM step. |
| **Scout** | `SEARCH` / `SUMMARIZE` companies. `SHOW_DASHBOARD` weekly GTM review. |
| **Do not** | Create an accounts table, a sequencer, or cap-table fields. |

### Southeast BD outbound cadence

| | |
| --- | --- |
| **Motion** | Recurring outreach and follow-up on Southeast Tier 1/2 accounts. |
| **WorkforceOS screens** | Company activity `/app/companies/[id]?tab=activity`. Opportunity `/app/opportunities/[id]`. Signals `/app/signals` are supporting context only. |
| **Data** | `companies.next_action` / `next_action_at`. `activities.follow_up_at` on outreach/meeting/task rows. Opportunity stage. |
| **Cadence (documented, not a product)** | Tier 1 Southeast: next action at least every **7 days** until discovery is scheduled or the account is parked (`nurture` / lost with a reason). Tier 2: every **14 days**. After discovery complete: next action is proposal or a dated nurture. National recruiting accounts use the job’s last activity, not this BD cadence. |
| **Owner / access** | Commercial owners (`opportunities.write` / `companies.write`). Recruiter Standard does not run this board. |
| **Scout** | `CREATE_FOLLOW_UP` with confirmation. `SEARCH` overdue work the operator can already see. |
| **Do not** | Build an email sequencer, buy a second cadence tool, or let Scout send (external send stays denied until a human confirms on a permitted path). |

### Website inquiry intake

| | |
| --- | --- |
| **Motion** | Public front door → qualify. Inquiry ≠ opportunity. |
| **WorkforceOS screens** | PierOnePartners.com `/contact`. Internal: `/app/crm/inquiries` and `/app/crm/inquiries/[id]`. |
| **Data** | `website_inquiries` with one of the five `service_interest` codes (or `other`, which still must map to a launch service before conversion). |
| **Owner / access** | `opportunities.read` to open the list (DEC-WEB-004, DEC-RBAC-001). |
| **Playbook** | Playbook 8 step 1. Operating manual Website Inquiry. |
| **Scout** | `SEARCH` website inquiries. `CREATE` opportunity-from-inquiry only after confirmation. |
| **KPI on GTM board** | Open inquiries (not converted, not closed). |

### Discovery

| | |
| --- | --- |
| **Motion** | Diagnose the client problem and name one of the five offers. |
| **WorkforceOS screens** | Discovery `/app/discovery` and `/app/discovery/[id]`. Opportunity stages `discovery_scheduled` / `discovery_complete`. |
| **Owner / access** | Commercial owners. Recruiter may hold `discovery.read` for search context but does not own the GTM pipeline. |
| **Playbook** | Playbook 8. Operating manual Discovery. |
| **Approval** | Human-approved discovery before a client-facing solution. Agents cannot approve their own material output. |
| **KPI on GTM board** | Discoveries in `draft` / `in_review` on GTM accounts. |

### Military employer conversations

| | |
| --- | --- |
| **Motion** | Talk to employers about SkillBridge-eligible or direct-hire military talent needs. PierOne is the intermediary, generally **not** the SkillBridge host. |
| **WorkforceOS screens** | Opportunity with `serviceCode=military-talent-opportunity-assessment` (`/app/opportunities`). Employer/host matches: `/app/military/opportunities`. Pathway ops: `/app/military/skillbridge` (Playbook 6 — not a sixth offer). |
| **Owner / access** | Senior Talent Partner owns the commercial assessment. Military Talent Partner runs pathway matching. Recruiter Standard does not own the commercial opportunity. |
| **Playbook** | Playbook 2 (Military Talent Opportunity Assessment). Playbook 6 (pathway ops). |
| **Scout** | `SEARCH` opportunities / employer opportunities. `FIND_MATCHES` on a Transition Talent Profile. Do not invent MOS maps. |
| **KPI on GTM board** | Open Military Talent Opportunity Assessment opportunities, plus open employer/host matches when the operator has `military.read` / `skillbridge.read`. |
| **Do not** | Duplicate a candidate per employer. Call SkillBridge a PierOne-owned program. Use the retired Specialist title in new prose. |

### Proposal conversion

| | |
| --- | --- |
| **Motion** | Turn an approved solution into a sent, then accepted, proposal. |
| **WorkforceOS screens** | Proposals `/app/proposals` and `/app/proposals/[id]`. Opportunity stage `proposal` / `negotiation` / `won`. |
| **Owner / access** | `opportunities.read` on the GTM board. Internal review before send. |
| **Playbook** | Playbook 9 (Proposal / Contract Handoff). Operating manual Proposal / Contract. |
| **Approval** | `internal_review` before send. Humans send. Scout drafts stay in review. |
| **KPI on GTM board** | Proposals in `draft`, `internal_review`, `sent`, or `viewed` on GTM accounts. Win/conversion from stored `won` vs closed stages. |

### National recruiting model

| | |
| --- | --- |
| **Motion** | Execute search nationally once a Professional & Technical Search (or other launch) engagement exists. |
| **WorkforceOS screens** | Jobs `/app/jobs`. Talent `/app/talent`. Submissions `/app/submissions`. Interviews `/app/interviews`. Command Center Talent board `/app?cadence=talent`. |
| **Owner / access** | Recruiter Standard: jobs/candidates/submissions. No commercial GTM board. Talent Partner owns the client opportunity. |
| **Playbook** | Playbook 1 (Professional & Technical Search). Playbook 7 (Recruiting & Hiring). |
| **Rule** | Internal Talent Network before SeekOut/Apollo/LinkedIn. Do not duplicate candidates. |
| **KPI** | Active searches, submissions, interviews, placements — reviewed on the Talent cadence, not rebuilt on GTM. |

### Delivery KPIs

| | |
| --- | --- |
| **Motion** | Prove we can deliver what we sold. |
| **WorkforceOS screens** | Projects `/app/projects`. Deliverables `/app/projects/deliverables`. Leadership `/app?cadence=leadership`. Operations `/app?cadence=operations`. |
| **Playbook** | Playbook 10 (Project Delivery / Closeout). |
| **KPI** | At-risk projects, overdue deliverables, placements on search work. Finance/AR stays on `/app?cadence=finance` (operating finance, not a general ledger). |
| **Do not** | Invent a separate GTM scorecard outside stored records. |

### Referrals

| | |
| --- | --- |
| **Motion** | Ask for introductions after discovery or a win. |
| **WorkforceOS screens** | Create the referred employer as a Company. Optional website inquiry if they came through the public form (`referral_source`). Link a new Opportunity only after qualification. |
| **Data** | Company + contact. Inquiry `referral_source` when the public form captured it. |
| **Do not** | Store referrals only in Scout chat. |

### Thought leadership

| | |
| --- | --- |
| **Motion** | Publish industry campaigns that support outbound (Energy, manufacturing, infrastructure, and the Tier 2 list). |
| **WorkforceOS screens** | Public Content `/app/public-content` and `/app/public-content?type=featured_industry_campaign`. Public site reads the same records. |
| **Owner / access** | `public_content.read` / `public_content.manage` / `public_content.publish`. |
| **Decision** | DEC-WEB-010 — this is not a CMS rebuild. |
| **KPI on GTM board** | Active `featured_industry_campaign` rows. |

## Weekly GTM review (how to run it)

1. Open `/app?cadence=gtm` (also linked from Command Center). Cards hide without `opportunities.read`.
2. Read live aggregates only: target accounts by tier, open opportunities in focus industries / tagged GTM accounts, discovery and proposals in flight, win/conversion, military employer conversations, website inquiries, thought-leadership campaigns, overdue follow-ups from stored dates.
3. Click through to the operating screen. Update next actions on the Company or Activity. Advance stages on the Opportunity.
4. Optional: ask Scout **weekly GTM review**. Scout repeats counts you can already read. No SQL. No candidate email, phone, compensation, or resume in model context. No send.
5. Risks and operational exceptions that are not GTM-specific stay on `/app/alerts`.

## Conversion and delivery KPI definitions

All figures are live PostgreSQL counts from stored rows. Missing values stay empty.

| KPI | Source | Window |
| --- | --- | --- |
| Target accounts by tier | `companies.gtm_tier` in (`tier_1`, `tier_2`), not archived | Current list |
| Open GTM opportunities | Open opportunity stages joined to a GTM-tiered company **or** a focus-industry label | Current |
| Discovery in flight | `discoveries.status` in `draft`, `in_review` on those companies | Current |
| Proposals in flight | `proposals.status` in `draft`, `internal_review`, `sent`, `viewed` on those companies | Current |
| Win / conversion | `won` ÷ (`won` + `lost` + `abandoned`) on those companies | All stored closed stages |
| Military employer conversations | Open opportunities with `service_code=military-talent-opportunity-assessment`; plus open employer/host matches when permitted | Current |
| Website inquiries | `website_inquiries` not `converted_to_opportunity` or `closed` | Current |
| Thought leadership | Active `featured_industry_campaign` public content | Current |
| Overdue GTM follow-ups | GTM-tiered `companies.next_action_at` or `activities.follow_up_at` earlier than now | Derived from stored dates |

## Scout and Academy

- Closed command: `SHOW_DASHBOARD` with dashboard `gtm` (prompts: “weekly GTM review”, “90-day GTM”, “GTM review”).
- Weekly operating review still summarizes every cadence the operator can see, including GTM.
- Knowledge seed slug `pierone-90-day-gtm-plan` (re-seed before Scout can cite it).
- Academy article `ninety-day-gtm-review`.

## Related documents

- Operating manual: `docs/business/PIERONE_OPERATING_MANUAL.md`
- Service playbooks: `docs/business/SERVICE_PLAYBOOKS.md`
- Catalog: `docs/business/SERVICE_CATALOG.md`
- Workflows: `docs/workflows/SERVICE_WORKFLOWS.md`
- Remaining work: `docs/operations/MASTER_COMPLETION_LEDGER.md`
