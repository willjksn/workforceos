# PierOne Partners operating manual

Status: Phase F canonical company manual (2026-09-09)  
Audience: PierOne operators and service owners  
This document describes how **PierOne Partners the company** operates in WorkforceOS. It is not a deploy, recover, or PITR guide. Engineering runbooks stay in `docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md`.

Service names, military language, and access rules follow `docs/business/SERVICE_CATALOG.md`, `docs/workflows/SERVICE_WORKFLOWS.md`, DEC-MIL-005, DEC-RBAC-001, and DEC-AUTH-002. Do not invent a sixth launch service. Material process rules live in approved `service_versions` / `service_workflows` records — this manual maps those steps to screens; it does not replace the workflow tables.

## Who we are

PierOne Partners is a **Workforce & Talent Solutions** firm. We help employers solve immediate talent needs and build stronger future workforce pipelines. We are not a temp staffing agency, payroll company, public job marketplace, or SkillBridge host program.

WorkforceOS is the internal operating system for that work. PierOnePartners.com is the public front door. Chat is not the system of record.

## How we operate

Every engagement follows **SOLVE → BUILD → OPERATE**.

| Mode | Meaning | Typical WorkforceOS work |
| --- | --- | --- |
| **SOLVE** | Diagnose the client problem and name the right offer. | Website inquiry → CRM → qualification → discovery → solution plan |
| **BUILD** | Design and sell the engagement. | Proposal → contract (legal package inside the workflow) → delivery project |
| **OPERATE** | Deliver, report, invoice, and expand from stored work. | Project delivery → reporting → invoice → expansion |

Professional & Technical Search still executes search on jobs and the Talent Network. Assessment and fractional work execute on delivery projects. Military Talent pathway operations overlay Talent Network candidates; they are not a sixth service.

## Title ≠ Access

Organizational title is display-only (`users.organizational_title`). It is never a permission. Access comes from one or more PostgreSQL **access bundles** (`roles` / `user_roles`), plus optional grant/deny overrides (`user_permission_overrides`; deny wins). Clerk authenticates; Clerk metadata is not authorization (DEC-AUTH-002, DEC-AUTH-001).

A person may hold a title such as “Recruiter” and still need a **Senior Talent Partner** bundle to own commercial opportunities. Assigning a title in People does not grant screens.

Live access bundle names (not job titles):

| Access bundle | Who it is for | Commercial opportunities? |
| --- | --- | --- |
| Administrator / Executive | Firm leadership | Yes (full access) |
| Operations | Operations and delivery | Yes |
| Strategy & Technology | Platform administration | Yes |
| Senior Talent Partner | Search and talent leadership | Yes |
| Recruiter Standard | Search execution | **No** (DEC-RBAC-001) |
| Workforce Consultant | Workforce assessments | Yes |
| Military Talent Partner | Military talent practice | No opportunity ownership; pathway and mapping work |
| Read only | Reviewers | View only; no restricted candidate PII |

Do not call the military access bundle **Military Talent Specialist**. The live slug is `military-talent-partner`. `military-talent-specialist` is a one-release alias only (DEC-MIL-005, DEC-AUTH-002).

People and bundles: `/app/admin/users` (Team & Access). Access bundles and access review are tabs on that screen (`/app/admin/roles`, `/app/admin/access-review`). New PierOne employees follow **staff onboarding** at `/app/academy/onboarding` (admin view: `/app/admin/users/[id]/onboarding`). That cadence is Day 1–Week 4 and is **not** the ATS hire queue at `/app/onboarding`. Academy article: Employee onboarding. Completing training does not grant permissions.

## Five offers

These are the five launch services. Display names are canonical for operators and the public site. Do not rename an offer without a Decision Log entry. Do not add a sixth.

| Display name | Code | Notes | What PierOne sells |
| --- | --- | --- | --- |
| **Professional & Technical Search** | `professional-search` | Slug and workflow keys stay `professional-search` (DEC-SVC-005). Public path `/services/professional-technical-search`. | Retained or project search. Internal Talent Network first, then approved external sources. |
| **Military Talent Opportunity Assessment** | `military-talent-opportunity-assessment` | Public path matches the display name. | Assess whether a client need can be served through military talent translation. SkillBridge is a pathway type inside this practice, not a separate service. |
| **Talent Acquisition Performance Assessment** | `ta-performance-assessment` | Catalog short name: TA Performance Assessment. | Evaluate a client’s TA operating performance and recommend improvements. |
| **Fractional Talent Partner** | `fractional-talent-partner` | Public path matches the display name. | Scoped fractional talent leadership. Not temp staffing or payroll. Scope is never unlimited recruiting. |
| **Workforce Pipeline Assessment** | `workforce-pipeline-assessment` | Public path matches the display name. | Demand, supply, gaps, and a human-approved Workforce Pipeline Plan. |

Internal catalog: `/app/services` and `/app/services/[code]`. Public copy lives in `sites/pierone`; operational public content is published from `/app/public-content`.

## Locked principles

- PierOne is the **intermediary** between transitioning service members and employer/host-company opportunities. PierOne is generally **not** the SkillBridge host (DEC-MIL-005).
- SkillBridge is a pathway/opportunity type, not a PierOne-owned program and not a sixth launch service.
- SkillBridge people are existing Talent Network candidates. Do not duplicate a candidate per employer or job.
- New jobs search the **internal Talent Network before external sourcing** (WFOS-TAL-002).
- Material AI recommendations need provenance. Material client-facing AI outputs need **human approval**. Agents cannot approve their own material output.
- **Scout cannot send externally yet.** External send is hard-denied. Humans send. Phase I is required before `scout.external_actions` is enabled.
- Five services only. No temp staffing, payroll, public job marketplace, or cap-table features.
- Legal packages belong inside operational workflows and must link to services/engagements.
- Restricted candidate PII requires `candidate_pii.read`. Scout strips email, phone, compensation, and resume before any model context.

## Scout

Scout is the official persistent assistant (tooltip: **Open Scout**). Chat is not the system of record. Scout never generates SQL.

Closed command families only (`lib/scout/commands.ts`):

`SEARCH` · `SUMMARIZE` · `DRAFT` · `CREATE` · `UPDATE` · `ASSIGN` · `ADD_TO_POOL` · `ADD_TO_JOB` · `CREATE_TASK` · `CREATE_FOLLOW_UP` · `SHOW_RECORD` · `SHOW_DASHBOARD` · `FIND_MATCHES`

Read commands may run immediately. Material internal writes (`CREATE`, `UPDATE`, `ASSIGN`, pool/job/task/follow-up) require confirmation. Drafts follow Draft → Human Review → Send/Copy and never auto-send. Knowledge citations use approved `knowledge_records` (AI & Automation → Knowledge at `/app/ai-operations/knowledge`).

## Canonical client flow

Website Inquiry → CRM → Qualification → Discovery → Solution → Proposal → Contract → Project → Delivery → Reporting → Invoice → Expansion

This is the commercial spine. Recruiter Standard does **not** own this spine (DEC-RBAC-001). Recruiters reach authorized job work from Talent, not from Opportunities.

### 1. Website Inquiry

- **WorkforceOS screen:** Public intake on PierOnePartners.com `/contact` (also `/work-with-us`, which redirects to `/contact`). Service pages and `/what-we-do` use the same inquiry form. Records land in **Website inquiries** `/app/crm/inquiries` and `/app/crm/inquiries/[id]`.
- **Owner / access:** Senior Talent Partner, Operations, Strategy & Technology, Administrator / Executive, Workforce Consultant (`opportunities.read`). Recruiter Standard cannot open this list.
- **Approval:** None at intake. An inquiry is not an opportunity. Opportunities are not auto-created.
- **Scout:** `SEARCH` website inquiries. `SHOW_RECORD` on the inquiry. `CREATE` opportunity-from-inquiry only after confirmation, from this screen.
- **Next:** Qualify on the inquiry detail, then CRM.

### 2. CRM

- **WorkforceOS screen:** **Companies** `/app/companies` and `/app/companies/[id]`; **Contacts** `/app/contacts` and `/app/contacts/[id]`; **Opportunities** `/app/opportunities` and `/app/opportunities/[id]`. Command Center `/app` shows pipeline counts. **Signals** `/app/signals` is supporting context, not a required step.
- **Owner / access:** Company/contact read is broader (Recruiter Standard can read companies/contacts). Opportunity **ownership** stays on Senior Talent Partner, Operations, Workforce Consultant, Strategy & Technology, and Administrator / Executive.
- **Approval:** Creating or advancing an opportunity is a human write (`opportunities.write`).
- **Scout:** `SEARCH` / `SUMMARIZE` companies, contacts, opportunities. `SHOW_RECORD`. `CREATE` / `UPDATE` / `ASSIGN` with confirmation when the operator has commercial write access.
- **Next:** Qualification if the record is still an inquiry; Discovery once an opportunity exists.

### 3. Qualification

- **WorkforceOS screen:** There is no `/app/qualification` route. Qualification is **Website inquiry detail** `/app/crm/inquiries/[id]` (status + **convert to opportunity**) and then **Opportunity** `/app/opportunities/[id]`.
- **Owner / access:** Same commercial owners as Website Inquiry. Recruiter Standard cannot convert inquiries.
- **Approval:** Human conversion. Company/contact matching is reviewed on the inquiry before an opportunity exists.
- **Scout:** `SEARCH` inquiries. `CREATE` opportunity-from-inquiry (confirm). `SHOW_RECORD` on the new opportunity.
- **Next:** Discovery.

### 4. Discovery

- **WorkforceOS screen:** **Discovery** `/app/discovery` and `/app/discovery/[id]`.
- **Owner / access:** Senior Talent Partner, Workforce Consultant, Recruiter Standard (discovery read/write), Military Talent Partner, Operations, Administrator / Executive.
- **Approval:** Discovery notes are operator work. Client-facing findings later require human approval on the solution or deliverable.
- **Scout:** `SEARCH` / `SUMMARIZE` the opportunity or discovery. `CREATE_TASK` / `CREATE_FOLLOW_UP` with confirmation. `DRAFT` internal notes (human review before anything leaves the firm).
- **Next:** Solution plan.

### 5. Solution

- **WorkforceOS screen:** **Solution Plans** `/app/solutions` and `/app/solutions/[id]`. Service definition: `/app/services` / `/app/services/[code]`.
- **Owner / access:** Senior Talent Partner, Workforce Consultant, Military Talent Partner (write/approve on solutions), Operations, Administrator / Executive.
- **Approval:** Solution plan approval (`solutions.approve`) before a proposal is generated. Pricing outside the configured range requires `pricing.approve`.
- **Scout:** `SEARCH` / `SUMMARIZE` solutions. `DRAFT` is not a substitute for an approved plan. Material AI solution language goes to the Review Queue `/app/ai-operations/review`.
- **Next:** Proposal.

### 6. Proposal

- **WorkforceOS screen:** **Proposals** `/app/proposals` and `/app/proposals/[id]`.
- **Owner / access:** Senior Talent Partner, Workforce Consultant, Operations, Administrator / Executive (`proposals.read` / `proposals.write`). Recruiter Standard can read proposals, not own the commercial path.
- **Approval:** Draft → `internal_review` → human `proposals.approve` → then send. Proposals cannot be sent until approved. Scout cannot send.
- **Scout:** `SEARCH` / `SUMMARIZE` / `SHOW_RECORD`. `DRAFT` stays internal until a human approves and sends.
- **Next:** Contract.

### 7. Contract

- **WorkforceOS screen:** **Contracts** `/app/contracts` and `/app/contracts/[id]`. Legal templates: `/app/legal/templates`. Packages stay on the engagement, not a free-standing legal product.
- **Owner / access:** Operations, Senior Talent Partner, Administrator / Executive (`contracts.read`; execute/approve is a tighter permission).
- **Approval:** Human contract approval / execute (`contracts.approve`). Live DocuSign envelopes are Phase I; record execution in WorkforceOS until then.
- **Scout:** `SEARCH` / `SHOW_RECORD`. Scout cannot execute contracts or send them.
- **Next:** Project. Delivery projects require an executed contract unless a Managing Partner override is audited.

### 8. Project

- **WorkforceOS screen:** **Projects** `/app/projects` and `/app/projects/[id]`. This is consulting delivery, not a search project. Professional & Technical Search execution still uses the job / search-project path under **Jobs**.
- **Owner / access:** Operations, Senior Talent Partner, Workforce Consultant, Administrator / Executive (`projects.read` / `projects.write`). Recruiter Standard can read projects.
- **Approval:** Project create is gated by the contract rule above.
- **Scout:** `SEARCH` / `SUMMARIZE` / `SHOW_RECORD` projects. `CREATE_TASK` / `ASSIGN` with confirmation.
- **Next:** Delivery.

### 9. Delivery

- **WorkforceOS screen:** Project detail tabs on `/app/projects/[id]` (phases, tasks, deliverables, meetings, billing) and **Deliverables** `/app/projects/deliverables`. Workforce Pipeline work also uses **Workforce planning** `/app/workforce` and assessment detail `/app/workforce/assessments/[assessmentId]`.
- **Owner / access:** Same as Project, plus Workforce Consultant for pipeline intelligence (`workforce.approve` for client-facing plans).
- **Approval:** Client-facing deliverables require `deliverables.approve`. Agents cannot approve their own output.
- **Scout:** `SEARCH` / `SUMMARIZE`. `CREATE_TASK` / `CREATE_FOLLOW_UP`. `DRAFT` stays in review.
- **Next:** Reporting.

### 10. Reporting

- **WorkforceOS screen:** **Reports** `/app/reports` and `/app/reports/[category]`. Leadership roll-up: **Command Center** `/app`. Weekly operating reviews (not extra nav items): `/app?cadence=leadership` (pipeline, proposals, recruiting delivery, Military Talent pathway, project health, cash/AR, derived risks), `/app?cadence=operations`, `/app?cadence=talent`, `/app?cadence=military`, `/app?cadence=finance`, `/app?cadence=gtm` (90-day GTM). Alerts: `/app/alerts`.
- **Owner / access:** Bundles with `reports.read` (Senior Talent Partner, Recruiter Standard, Workforce Consultant, Military Talent Partner, Operations, Administrator / Executive). Cadence widgets still hide without the module permission (`opportunities.read`, `jobs.read`, `military.read`, `finance.read`, and so on). Recruiter Standard does not see the commercial opportunity pipeline (DEC-RBAC-001). PII CSV export is a separate permission.
- **Approval:** Reports and cadence boards read stored rows. They do not invent metrics. Scout `SHOW_DASHBOARD` / weekly operating review repeats counts the operator can already read; humans still own decisions.
- **Scout:** `SHOW_DASHBOARD` (Command Center executive summary or Military Talent daily brief). `SEARCH` / `SUMMARIZE` the module in context. Scout never generates SQL and still cannot send.
- **Next:** Invoice when billing events exist.

#### Leadership cadence

PierOne weekly pipeline review runs inside WorkforceOS, not a slide deck. Managing Partner and other authorized bundles open **Command Center → Leadership**. Operations, Talent, Military Talent, Finance, and GTM reviews are sibling boards on the same page. Academy: Weekly operating review.

#### 90-day GTM cadence

The written plan is `docs/business/PIERONE_90_DAY_GTM_PLAN.md`. Weekly GTM review is **Command Center → GTM** at `/app?cadence=gtm`. Target-account tiers and Southeast vs national live on Companies (`gtm_tier`, `gtm_region`). Recruiter Standard does not see this commercial board (DEC-RBAC-001). Inquiries stay intake (DEC-WEB-004). Academy: 90-day GTM review.

### 11. Invoice

- **WorkforceOS screen:** **Finance** `/app/finance` and **Invoices** `/app/finance/invoices`. AR: `/app/finance/ar`. Payments: `/app/finance/payments`. There is no `/app/finance/invoices/[id]` route — work the invoice list. Company finance tab: `/app/companies/[id]?tab=finance`.
- **Owner / access:** Operations, Administrator / Executive, Senior Talent Partner (`finance.read` / `invoices.read`; write is tighter). Recruiter Standard does not own finance.
- **Approval:** Invoice expectations are created from stored billing events / contract terms. QuickBooks posting is off until Phase I. Amounts are never invented.
- **Scout:** `SEARCH` finance. `SHOW_RECORD` links to `/app/finance/invoices`. Scout cannot post AR.
- **Next:** Expansion after closeout, or a new opportunity on the same company.

### 12. Expansion

- **WorkforceOS screen:** There is no `/app/expansion` route. Expansion suggestions appear on **Company** `/app/companies/[id]?tab=solutions` after project closeout. Open or create the next **Opportunity** `/app/opportunities` / `/app/opportunities/[id]` for the recommended service code. Do not invent a service that is not one of the five.
- **Owner / access:** Same commercial owners as CRM. Human review of `expansion_recommendations` is required.
- **Approval:** Suggested ≠ sold. A new opportunity, solution, proposal, and contract follow this same spine.
- **Scout:** `SEARCH` / `SUMMARIZE` the company. `CREATE` a follow-up or (with confirmation) help open commercial work the operator is allowed to own.
- **Next:** Return to Qualification / Discovery on the new opportunity (SOLVE again).

## Canonical recruiting flow

Job → Candidate → Application → Screening → Matching → Client Submission → Interview → Offer → Hire → Onboarding

This is search and hiring execution. Recruiter Standard owns this path. Internal Talent Network search must complete before external sourcing.

### 1. Job

- **WorkforceOS screen:** **Jobs** `/app/jobs` and `/app/jobs/[id]`. Jobs is the recruiting entry. Older `/app/search-projects` and `/app/recruiting/requisitions` URLs still resolve into the Jobs nav — do not treat them as a second intake. Public careers publishing is a job-posting action, not a marketplace.
- **Owner / access:** Recruiter Standard, Senior Talent Partner, Military Talent Partner (`jobs.read` / `jobs.write`). Publish/approve uses `jobs.approve` / `jobs.publish`.
- **Approval:** Public postings omit confidential client identity. A public posting is not required to start internal matching.
- **Scout:** `SEARCH` / `SHOW_RECORD` jobs. `CREATE` / `UPDATE` with confirmation.
- **Next:** Candidate (Talent Network), then Application if they apply or are attached.

### 2. Candidate

- **WorkforceOS screen:** **Candidates** `/app/talent` and `/app/talent/[id]`. Supporting: Talent Search `/app/talent/search`, Pools `/app/talent/pools`, Silver Medalists `/app/talent/silver-medalists`, Watchlists `/app/talent/watchlists`, Rediscovery `/app/talent/rediscovery`, Nurture `/app/talent/nurture`. One global candidate record — never duplicate per job.
- **Owner / access:** Recruiter Standard, Senior Talent Partner, Military Talent Partner. Restricted email/phone/compensation/resume requires `candidate_pii.read`.
- **Approval:** None to view an authorized candidate. Privacy deletion is a separate controlled process.
- **Scout:** `SEARCH` / `SUMMARIZE` / `SHOW_RECORD` candidates (PII stripped from model context). `ADD_TO_POOL` / `ADD_TO_JOB` with confirmation.
- **Next:** Application or Matching.

### 3. Application

- **WorkforceOS screen:** **Applications** `/app/recruiting/applications` and `/app/recruiting/applications/[applicationId]`. Public apply: PierOnePartners.com `/careers` and `/jobs/[slug]` → WorkforceOS public gateway. Internal apply is the same application table.
- **Owner / access:** Recruiter Standard, Senior Talent Partner (`applications.read` / review / advance).
- **Approval:** An application is Candidate↔Job. Do not create a second person.
- **Scout:** `SEARCH` hiring queues / applications. `SHOW_RECORD`.
- **Next:** Screening.

### 4. Screening

- **WorkforceOS screen:** There is no `/app/screening` route. Use **Application detail** `/app/recruiting/applications/[applicationId]` and **Recruiting Workbench** `/app/recruiting/workbench` (needs-review, scorecards, checks).
- **Owner / access:** Recruiter Standard, Senior Talent Partner (`applications.review` / `applications.advance` / `applications.reject`).
- **Approval:** Material rejection is a human decision. Scores never auto-reject. Background/drug results are human-reviewed; Checkr HTTP and live drug screening are not wired.
- **Scout:** `SEARCH` / `SUMMARIZE`. Scout cannot independently reject a candidate.
- **Next:** Matching (or Client Submission if already matched).

### 5. Matching

- **WorkforceOS screen:** There is no `/app/matching` route. Job-specific matches live on **Job** `/app/jobs/[id]` (run / complete internal Talent Network search) and **Job pipeline** `/app/jobs/[id]/pipeline`. Cross-job list: **Candidate Pipeline** `/app/pipeline`. Talent Search `/app/talent/search` finds people; it does not replace job-specific scores (WFOS-TAL-003).
- **Owner / access:** Recruiter Standard, Senior Talent Partner. External sourcing adapters stay blocked until internal search is marked complete.
- **Approval:** Humans advance pipeline stages. Scores have provenance and never auto-reject.
- **Scout:** `FIND_MATCHES`. `SEARCH` candidates/jobs. `ADD_TO_JOB` with confirmation.
- **Next:** Client Submission.

### 6. Client Submission

- **WorkforceOS screen:** **Submissions** `/app/submissions` (list; no `/app/submissions/[id]` route). Job workspace also tracks submitted pipeline status.
- **Owner / access:** Recruiter Standard, Senior Talent Partner (`submissions.read` / `submissions.write` / `submissions.approve`).
- **Approval:** Human approves the client submission packet. Do not send a packet until approved.
- **Scout:** `SEARCH` / `SUMMARIZE`. `DRAFT` a packet summary for human review. Scout cannot send to the client.
- **Next:** Interview.

### 7. Interview

- **WorkforceOS screen:** **Interviews** `/app/interviews` (list; no interview detail route). Workbench links here.
- **Owner / access:** Recruiter Standard, Senior Talent Partner (`interviews.read` / write / schedule / score).
- **Approval:** Live calendar OAuth is Phase I (mock scheduling only). Candidate self-scheduling is not in V1.
- **Scout:** `SEARCH` / `CREATE` follow-up. Interview schedule writes confirm. Scout cannot send calendar invites externally as a live provider action.
- **Next:** Offer.

### 8. Offer

- **WorkforceOS screen:** **Offers** `/app/offers` (list; no `/app/offers/[id]` route).
- **Owner / access:** Recruiter Standard (create/send), Senior Talent Partner (includes `offers.approve`).
- **Approval:** Offers are versioned. Approve before send. WorkforceOS records offers; Scout cannot send them.
- **Next:** Hire.

### 9. Hire

- **WorkforceOS screen:** **Placements** `/app/placements` (list; no placement detail route). **Guarantees** `/app/guarantees` after placement when the search agreement requires it.
- **Owner / access:** Recruiter Standard, Senior Talent Partner (`placements.read` / `placements.write`).
- **Approval:** Placement copies fee and guarantee days from the search agreement. Humans record the hire.
- **Scout:** `SEARCH` / `SHOW_RECORD` (placements list). `UPDATE` with confirmation when allowed.
- **Next:** Onboarding.

### 10. Onboarding

- **WorkforceOS screen:** **Onboarding** `/app/onboarding`. This is candidate / new-hire onboarding (Phase 10). It is **not** PierOne employee Day 1–Week 4 access training (Phase H) and not `/onboarding/access` (deferred portal).
- **Owner / access:** Recruiter Standard, Senior Talent Partner (`onboarding.read` / manage).
- **Approval:** Tasks complete in-app without a candidate portal. Transactional email uses the email provider when configured; Scout cannot send it.
- **Next:** Silver-medalist / rediscovery preservation for people not hired; guarantee window for placed search.

## Canonical military flow

Locked (DEC-MIL-005). Do not invent MOS maps. Do not use Military Talent Specialist in operator copy.

Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity → Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other → Placement → Conversion

Operator access bundle: **Military Talent Partner**. Senior Talent Partner and Recruiter Standard also have military/talent overlap as listed below. Overview: `/app/military`.

### 1. Transitioning Service Member

- **WorkforceOS screen:** Public join **Military Talent Network** on PierOnePartners.com `/military-talent/join` (canonical). `/skillbridge/join` redirects there — do not document it as a second intake. Internal find: **Transitioning Talent** `/app/military/candidates` and **Candidates** `/app/talent`.
- **Owner / access:** Military Talent Partner, Recruiter Standard, Senior Talent Partner (`military.read`, `candidates.read`).
- **Approval:** A public job posting is not required before someone can join.
- **Scout:** `SEARCH` transitioning talent / candidates. Never invent a second person record.
- **Next:** Military Talent Network.

### 2. Military Talent Network

- **WorkforceOS screen:** **Military Talent** `/app/military` plus **Transitioning Talent** `/app/military/candidates`. These are Talent Network people, not a PierOne SkillBridge roster.
- **Owner / access:** Military Talent Partner (primary), Recruiter Standard, Senior Talent Partner.
- **Approval:** None to record membership. Do not duplicate the candidate per employer.
- **Scout:** `SEARCH` Military Talent. `SHOW_DASHBOARD` on `/app/military`.
- **Next:** Transition Talent Profile.

### 3. Transition Talent Profile

- **WorkforceOS screen:** Pathway profile `/app/military/skillbridge/[id]` (UI: Transition Talent Profile; physical table `skillbridge_profiles`). Person record remains `/app/talent/[id]`. List of overlays: **Pathway operations** `/app/military/skillbridge`. There is no `/app/military/candidates/[id]` — the candidates list links to Talent.
- **Owner / access:** Military Talent Partner (`skillbridge.read` / write). Recruiter Standard has skillbridge write; Senior Talent Partner has manage.
- **Approval:** Profile completeness is operator work. Restricted PII still requires `candidate_pii.read`.
- **Scout:** `SEARCH` / `SHOW_RECORD` / `UPDATE` preferred location (confirm). `CREATE_FOLLOW_UP`.
- **Next:** Skills Translation.

### 4. Skills Translation

- **WorkforceOS screen:** **Skills Translator** `/app/military/translator`. Supporting library: Occupation Library `/app/military/occupations`, Civilian Crosswalk `/app/military/crosswalk`, Reverse Search `/app/military/reverse`, Installation Mapping `/app/military/installation-mapping`, Bridge Training `/app/military/bridge-training`. Human gate: **Mapping Review** `/app/military/review`.
- **Owner / access:** Military Talent Partner (`military.write`, `military.review`). Senior Talent Partner also reviews. Recruiter Standard can read mappings, not approve them.
- **Approval:** Agent mapping drafts start pending. The originating agent cannot approve them. Do not invent mapping rules (DEC-MIL-001).
- **Scout:** `SEARCH` / `SUMMARIZE`. `DRAFT` explanations for review. Material maps go to `/app/ai-operations/review` or Mapping Review.
- **Next:** Employer Opportunity.

### 5. Employer Opportunity

- **WorkforceOS screen:** **Employer Opportunities** `/app/military/opportunities` (list; no `/app/military/opportunities/[id]` route). Add/develop from the Transition Talent Profile `/app/military/skillbridge/[id]`. The employer/host company is explicit. Physical table `skillbridge_opportunities`.
- **Owner / access:** Military Talent Partner, Senior Talent Partner (`skillbridge.write`).
- **Approval:** Humans create the employer/host record. A public job is optional.
- **Scout:** `SEARCH` employer opportunities. `CREATE` / `UPDATE` with confirmation.
- **Next:** Match.

### 6. Match

- **WorkforceOS screen:** There is no `/app/military/match` route. Compare profile ↔ employer opportunity on **Transition Talent Profile** `/app/military/skillbridge/[id]` (stored match scores/explanations). Matching reuses job-match architecture. **Reverse Search** `/app/military/reverse` supports occupation→role exploration.
- **Owner / access:** Military Talent Partner. Humans connect or submit — scores do not auto-place.
- **Approval:** Human connect/submit. No auto-reject on score.
- **Scout:** `FIND_MATCHES`. `SEARCH` profiles and employer opportunities.
- **Next:** Employer Engagement.

### 7. Employer Engagement

- **WorkforceOS screen:** Same Transition Talent Profile `/app/military/skillbridge/[id]` (employer brief and message drafts) and **Employer Opportunities** `/app/military/opportunities`.
- **Owner / access:** Military Talent Partner. PierOne facilitates; the employer owns the opportunity.
- **Approval:** Employer briefs and message drafts require human review. Scout cannot send them.
- **Scout:** `DRAFT` (review/copy). `CREATE_FOLLOW_UP`. No external send.
- **Next:** Interview.

### 8. Interview

- **WorkforceOS screen:** **Interviews** `/app/interviews`, with pathway stage history on `/app/military/skillbridge/[id]`.
- **Owner / access:** Military Talent Partner (read interviews); Recruiter Standard / Senior Talent Partner schedule when the interview is a hiring interview.
- **Approval:** Service/command or host approvals are never assumed.
- **Scout:** `SEARCH` / `CREATE_FOLLOW_UP`. No live external calendar send.
- **Next:** Pathway decision.

### 9. SkillBridge / Direct Hire / Other

- **WorkforceOS screen:** **Pathway operations** `/app/military/skillbridge` and profile `/app/military/skillbridge/[id]` (stages through SkillBridge approval/active, or hired/nurture/closed). This is not a PierOne SkillBridge program dashboard.
- **Owner / access:** Military Talent Partner (`skillbridge.manage` for queue-wide views).
- **Approval:** SkillBridge participation depends on a host employer, timing, and service/command approval. PierOne does not guarantee approvals, placements, or conversions.
- **Scout:** `SEARCH` / `UPDATE` stage with confirmation. `DRAFT` stay internal.
- **Next:** Placement.

### 10. Placement

- **WorkforceOS screen:** **Placements** `/app/placements` and pathway stage on `/app/military/skillbridge/[id]`. Host/employer must be explicit.
- **Owner / access:** Military Talent Partner (placements read), Recruiter Standard / Senior Talent Partner (placements write when recording the hire).
- **Approval:** Human records placement start.
- **Scout:** `SEARCH` / `SHOW_RECORD`. `UPDATE` with confirmation.
- **Next:** Conversion.

### 11. Conversion

- **WorkforceOS screen:** Pathway profile `/app/military/skillbridge/[id]` (`conversion_review` → `hired`). Analytics: `/app/military/analytics`. The person stays in the Talent Network (`/app/talent/[id]`).
- **Owner / access:** Military Talent Partner. Conversion to full-time employment is an employer decision PierOne supports, not a PierOne hire by default.
- **Approval:** Humans record conversion. Do not drop the Talent Network candidate.
- **Scout:** `SEARCH` / `SUMMARIZE` / `CREATE_FOLLOW_UP`.
- **Next:** Remain on the Talent Network for rediscovery; commercial expansion uses the client flow if the employer buys another of the five offers.

## Access at a glance

| Work | Typical bundle | Recruiter Standard? |
| --- | --- | --- |
| Website inquiries, opportunities, qualification | Senior Talent Partner / Operations / Administrator / Executive / Workforce Consultant | No |
| Discovery, jobs, candidates, submissions, interviews, offers, placements | Recruiter Standard and Senior Talent Partner | Yes |
| Solution / proposal / contract ownership | Senior Talent Partner, Workforce Consultant, Operations | Read-only on several of these |
| Workforce Pipeline intelligence | Workforce Consultant | Read workforce only |
| Military pathway and mapping review | Military Talent Partner | Pathway write; no mapping approve |
| People / access bundles | Strategy & Technology, Administrator / Executive (Operations can administer people, not bundles) | No |
| AI spend / Knowledge Sources | `agents.manage` / `knowledge.read` | Recruiter Standard has no AI cost admin |

## Service playbooks (Phase G)

Repeatable delivery maps live in `docs/business/SERVICE_PLAYBOOKS.md` and `docs/business/playbooks/`. This manual stays the company operating model (SOLVE → BUILD → OPERATE). Playbooks cite this file, the catalog, `docs/workflows/SERVICE_WORKFLOWS.md`, and approved `service_workflows` records — they do not replace those records.

1. Professional & Technical Search
2. Military Talent Opportunity Assessment
3. Talent Acquisition Performance Assessment
4. Fractional Talent Partner
5. Workforce Pipeline Assessment
6. Military Transition / SkillBridge-eligible operations (pathway ops, not a sixth client offer)
7. Recruiting & Hiring
8. Client Discovery
9. Proposal / Contract Handoff
10. Project Delivery / Closeout

## Related documents

- 90-day GTM plan: `docs/business/PIERONE_90_DAY_GTM_PLAN.md`
- Catalog: `docs/business/SERVICE_CATALOG.md`
- Service playbooks: `docs/business/SERVICE_PLAYBOOKS.md`
- Workflows: `docs/workflows/SERVICE_WORKFLOWS.md`
- Decisions: `docs/decisions/DECISION_LOG.md` (DEC-MIL-005, DEC-RBAC-001, DEC-AUTH-002)
- Architecture: `docs/architecture/WORKFORCEOS_MASTER_SPEC.md`
- Remaining work: `docs/operations/MASTER_COMPLETION_LEDGER.md`
- Deploy / recover / PITR: `docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md`
- In-app Academy (Help & Training): `/app/academy`. This manual remains the company operating model. Academy articles cite this file and the playbooks; they do not replace them. Training states follow effective access, not title. Completion does not grant permissions. PierOne staff Day 1–Week 4 onboarding lives at `/app/academy/onboarding` and the Employee onboarding Academy article.
