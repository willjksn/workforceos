# Changelog

## Unreleased

### AI launch simplification — 2026-09-10

- OpenAI is the production AI provider for launch (FAST / STANDARD / REASONING). Gemini availability fallback remains supported by the architecture but is deferred until post-launch validation.
- System Status has one **AI Runtime Verification** card (`Run AI verification`). **Run fallback test** appears only when `AI_FALLBACK_ENABLED=true` and `AI_FALLBACK_PROVIDER=gemini`.
- Leftover Gemini secrets are not deleted. Hops stay off until `AI_FALLBACK_ENABLED=true`. Fallback status is **DEFERRED**, not a production failure.
- Do not reopen Anthropic.

### System Status honesty + AI verification — 2026-09-10

- System Status badges use LIVE / CONFIGURED / DEGRADED / MOCK / MANUAL / NOT CONFIGURED / DEFERRED / DEVELOPMENT / ERROR. MOCK, MANUAL, NOT CONFIGURED, and DEFERRED are never green HEALTHY.
- OpenAI is LIVE only after a recorded live completion. Key presence alone is CONFIGURED (or DEGRADED if class model ids are unset).
- Gemini, DocuSign, QuickBooks, SeekOut, Apollo, Sentry, Calendar, embeddings, and labor-market fixtures are split and labeled honestly.
- Admin System Status runs FAST / STANDARD / REASONING verification from the AI Runtime Verification card. Gemini is not a launch dependency.
- Controlled probes throw the provider HTTP failure (status/code) instead of returning heuristic. `/app/admin` redirects to Team & Access. OpenAI cards show the completion host only.
- OpenAI-compatible completions send `max_completion_tokens` (Gemini still starts with `max_tokens`). GPT-5 / o-series and unknown OpenAI ids omit `temperature` rather than sending 0.2. `unsupported_value` / `unsupported_parameter` retries stay as a safety net and are not Gemini hops.
- Live OpenAI verification uses configured FAST/STANDARD/REASONING model ids only.
- Gemini fallback hops only for timeout / 408 / 429 / 5xx / abort / empty body, and only when explicitly enabled. Unknown model ids (404 / model_not_found) stay configuration defects.


### Admin sidebar — daily destinations only — 2026-09-09

- Admin nav keeps Team & Access, Review Queue, AI & Automation, Public content, and Connected tools.
- Access bundles and Access review are tabs on Team & Access. Knowledge stays a tab under AI & Automation. Integration Hub and System status open from Connected tools. Data quality opens from Alerts. Approval history opens from Review Queue. Routes and permissions are unchanged.

### Legal templates — open a stored draft — 2026-09-09

- Template names on `/app/legal/templates` link to `/app/legal/templates/[id]`. Drafts are the yellow rows on that list; there is no separate drafts inbox. The detail page is read-only stored language.

### Phase 12 — Flexible module access, admin-only assignment — 2026-09-09

- Accepted DEC-AUTH-003: title stays display-only. Any employee may hold any mix of functional module bundles (Finance, Military Talent, Projects, and so on). Job-shaped templates remain shortcuts.
- Only `admin.roles` can assign modules, templates, or overrides (Administrator / Executive and Strategy & Technology). Operations cannot assign access. Recruiter Standard still has no `opportunities.read`.
- Admin → Team & Access person detail: module checkboxes plus templates. Invite still picks one starting template; add modules on the person record.
- `scripts/sync-role-permissions.ts` inserts missing module bundle rows per organization. Recruiter template contents are unchanged.

### AI Operating Model Stage 1 + Stage 2 — 2026-09-09

- Accepted `docs/architecture/AI_OPERATING_MODEL.md` and DEC-AI-012: OpenAI primary, Gemini availability fallback only, no Anthropic now. DEC-AI-005 / DEC-AI-011 evolve; they are not replaced.
- Stage 1: Recruiter, Talent Partner, and Military Talent Partner get `agents.read` (Review Queue) and never `agents.manage`. Workforce Consultant gets `agents.read` + `scout.draft`. Review Queue decide requires the matching domain approve permission. Recruiter still has no `opportunities.read`.
- Stage 2 code path: Gemini via the existing OpenAI-compatible HTTP client (`AI_FALLBACK_PROVIDER`, `GEMINI_API_KEY`, `AI_FALLBACK_BASE_URL`, `AI_MODEL_*_FALLBACK`). Failover is timeout / 408 / 429 / 5xx / abort / empty body only — never style or tone. Circuit breaker and cost caps are not bypassed by hopping. System Health shows primary LIVE/HEURISTIC and fallback configured yes/no without secrets.
- Production Gemini is BLOCKED until `GEMINI_API_KEY` is set. Do not claim production AI is LIVE until System Health says so. Stage 3 embeddings/RAG is not started. No Scout-as-LLM assist. No `scout.recruiting` / `scout.finance`. Capability-class ids stay in env; GPT-5.6 Luna/Terra/Sol are not hard-coded in app code.

### Professional & Technical Search display name — 2026-09-09

- Accepted DEC-SVC-005: canonical public and operator copy is **Professional & Technical Search**. Slug and workflow keys stay `professional-search`. Not a sixth service.
- Catalog, operating manual, playbooks, Academy, Scout knowledge titles, and operator UI labels use the display name. Public site already used it.
- Signed-in leftover-CTA click-through on production was blocked (Clerk + no usable browser session). Public `/services/professional-technical-search` already shows Professional & Technical Search.

### Leftover IA — 2026-09-09

- Commercial path is one primary CTA per stage: Company → Opportunity → Discovery → Solution / Service Plan → Build Proposal → Draft → Internal Approval → Send Client → Accepted → Contract / SOW → Project → Delivery. Build proposal stays hidden until the solution plan is approved and no proposal is in flight.
- AI costs sit under Admin → AI & Automation (`agents.manage`). Review Queue is `agents.read`. Recruiters now have Review Queue access and still do not see cost/provider/prompt admin.
- Reports titles and empty states are operating questions. Removed leftover “Stored records only” / “Stored jobs only” wording.
- Legal templates use DRAFT — NOT APPROVED FOR USE vs ATTORNEY APPROVED. Remaining “Structural templates…” copy is gone.
- Add company is the single create path on Companies. Command Center and Scout do not add company records.
- Old `/app/recruiting/requisitions` and `/app/search-projects` list URLs redirect onto Jobs views. Jobs remains the recruiting entry.
- Academy `operating-concepts` explains candidate vs application, job vs requisition vs posting, employer opportunity vs job, program vs project vs engagement, solution vs proposal vs SOW, and template vs agreement vs contract.
- Finance hub shows Proposal Pricing → Contract Value → Project Value → Invoice → AR → Payment → Revenue Reporting. Not a general ledger (DEC-FIN-002).

### Phase L — Post-launch scale — 2026-09-09

- Closed Phase A1: operator-confirmed 2026-09-09 that the four launch-smoke PDFs were deleted from production R2. Archived `files` rows remain. Bucket was not wiped.
- Jobs, Talent, applications, and pipeline lists use server-side page size 25 (hard max 100) with a UI pager.
- Command Center `recruitingAnalytics` is SQL counts plus 8-row exception lists. It no longer hydrates full job/match/submission graphs for counts.
- SkillBridge alert rules are operator-editable at `/app/military/skillbridge/alerts` (`skillbridge.manage` / `military.review`). Starting/ending-soon 14-day windows are stored rules.
- ETS (Army/USMC) and EAOS (Navy) dates sit on the same Transition Talent Profile as EOS / separation / retirement. Candidates are not duplicated.
- Scheduled report CSV jobs (`reports.export`) run on an Inngest cron and store job rows. Talent PII stays on-demand. Not a BI platform.
- Scout search pages 25 results with a hard max of 100. Send gates unchanged. No SQL. No PII to models.
- Embeddings stay development-hash `vector(1536)` (DEC-SEM-001). `AI_MODEL_EMBEDDING` is not configured; dimension change is deferred.
- BLS/Census adapters are live only when API keys are present; otherwise labeled fixtures.
- Candidate self-scheduling uses a tokenized `/schedule/[token]` link and the existing CalendarProvider. Unauthorized without a token. Rate-limited.
- Hire onboarding tokens are issued for `/onboarding/access`. Distinct from PierOne staff Academy onboarding. Thin applicant status is `/careers/status/[token]` against the existing application row.
- Client portal and full LMS remain deferred (DEC-SEC-001 / Phase E). Recruiter still has no `opportunities.read`.

### Production ops — 2026-09-09

- Applied Drizzle `0017_quiet_scale` to Neon `production-launch`. Confirmed `skillbridge_profiles.ets_date` / `eaos_date`, `public_access_tokens`, `report_export_schedules` / `report_export_jobs`, and SkillBridge alert-rule codes `window_starting_soon` / `window_ending_soon`. Org FKs `ON DELETE restrict`. `npm run db:check` OK; no development fixtures. Checkpoint `prod-migrate-checkpoint-20260909-0017` expires 2026-09-16. `db:check` expected-tag list is still stale (13 through `0012`; 18 applied).
- Applied Drizzle `0014_rainy_doomsday`, `0015_dizzy_wrecker`, and `0016_lyrical_giant_girl` to Neon `production-launch`. `0013_nervous_maggott` was already present. `npm run db:check` OK; no development fixtures. Checkpoint branch `prod-migrate-checkpoint-20260909` expires 2026-09-16.
- Four archived launch-smoke PDF keys were re-identified on production. Operator confirmed 2026-09-09 that the objects were deleted in Cloudflare R2. Archived `files` rows remain. Bucket was not wiped.

### Phase K — 90-day GTM / launch operations

- Written plan: `docs/business/PIERONE_90_DAY_GTM_PLAN.md`. Five launch services only. Locked Tier 1/2 industries. Southeast BD vs national recruiting. Inquiries stay intake (DEC-WEB-004).
- Target accounts stay on Companies. Added `gtm_tier` and `gtm_region` only. No parallel accounts table. Outbound cadence uses stored company next actions and activity follow-up dates — not a sequencer.
- Command Center weekly GTM review at `/app?cadence=gtm`. Live aggregates (counts + 8-row exception lists). Hidden without `opportunities.read`. Recruiter Standard cannot see the commercial GTM pipeline.
- Thought leadership links existing Public Content. Scout `SHOW_DASHBOARD` / “weekly GTM review” repeats counts the operator can already read. No SQL, no candidate PII to models, no send.
- Academy article `ninety-day-gtm-review`. Knowledge seed `pierone-90-day-gtm-plan`. Operating manual points at the GTM cadence.

### Phase J — Management operating rhythms

- Command Center `/app` now hosts weekly review boards (tabs, not extra nav items): Leadership, Operations, Talent, Military Talent, Finance. Each widget is a business question, a live PostgreSQL aggregate, a short exception list, and a link to the operating screen.
- Recruiter Standard still cannot see the commercial opportunity pipeline (DEC-RBAC-001). Finance widgets require `finance.read`. Military copy stays intermediary; SkillBridge is a pathway type.
- Risks are derived from stale opportunities, overdue deliverables, past-due AR, and failed integrations. Alerts stay on `/app/alerts`.
- Scout `SHOW_DASHBOARD` / “weekly operating review” summarizes counts the operator can already read. No SQL, no candidate email/phone/compensation/resume in model context, no new autonomy. Humans still own decisions.
- Academy article `weekly-operating-review`. Operating manual points at the leadership cadence.

### Phase I — Live Integration Go-Live

- Integration Hub now distinguishes MOCK / MANUAL vs CONFIGURED (credentials present) vs LIVE (tokens or API key actually wired). LIVE is never shown when credentials are missing.
- Calendar: Google/Microsoft interview events when an OAuth refresh token exists. Client IDs alone stay CONFIGURED with `liveScheduling=false`.
- Scout send: allowed only with `scout.external_actions` + `transactional_email.send` + a confirmation token + Resend. Recruiters still do not get `scout.external_actions`. Resend stays transactional (DEC-HIRE-004).
- DocuSign live envelopes when account + secret are set. Contracts still require `confirmed=true` before executed (DEC-INT-003).
- QuickBooks live invoice posting when refresh token + realm exist. Idempotent. WorkforceOS remains the operating record (DEC-FIN-002).
- Checkr invitations + signed webhook when `CHECKR_API_KEY` is set. Results never auto-reject. No FCRA adverse-action letters are generated.
- SeekOut/Apollo live lookup only after internal Talent Network search. Apollo still cannot overwrite approved CRM (DEC-INT-004).
- Official `@sentry/node` SDK initializes when `SENTRY_DSN` is present. Events redact secrets and candidate contact fields (DEC-OBS-001).
- Production vendor keys remain Phase M / Vercel Encrypted. This pass does not upload or rotate secrets.

### Phase H — PierOne employee onboarding

- Staff path from Admin invite → access bundles → Day 1 checklist → required Academy → Week 4 human review. Routes: `/app/academy/onboarding` and `/app/admin/users/[id]/onboarding`. Distinct from ATS hire `/app/onboarding`.
- People profile adds manager (`users.manager_id`, no self-manager), required training by effective access, systems/equipment checklist, and timestamped Security & Candidate Privacy acknowledgement.
- Completing Academy or Week 4 review does not grant permissions. Recruiter Standard still has no `opportunities.read`. Military Talent Partner language is unchanged.
- Academy article `employee-onboarding`. Scout SEARCH can link it. External send stays hard-denied. No new secrets.

### Phase E — WorkforceOS Academy / Help & Training

- In-app Academy at `/app/academy` (nav: Help & Training; tooltip/Scout: Academy). Articles cite the operating manual, ten service playbooks, DEC-SEC / `candidate_pii`, DEC-AI human-review rules, and Title ≠ Access — they do not rewrite those sources.
- Required training is computed from effective permissions (`lib/academy/training.ts`), never from organizational title. Recruiter Standard does not get AI-cost training (`agents.manage`). Completing a module writes `user_training_progress` only and does not grant permissions.
- Contextual `? Help` on Command Center, Companies, Opportunities, Discovery, Proposals, Jobs, Talent, Military, Projects, Finance, Admin People, and Scout. Scout procedural answers can link `/app/academy/[slug]`. External send stays hard-denied.
- Schema: `user_training_progress` (UUID PK, timestamptz, indexed `user_id`, unique user+module). No organization cascade-delete.

### Phase G — Service delivery playbooks

- Added ten PierOne delivery playbooks under `docs/business/playbooks/` with a short index at `docs/business/SERVICE_PLAYBOOKS.md`. Each step maps to a live WorkforceOS screen, required data, access-bundle owner, permission slug, approval gate, closed Scout command, deliverable, and next step.
- Seeded approved knowledge records for those playbooks in `db/seed/phase7.ts` so Scout can cite them after re-seed. No candidate PII in knowledge.
- Company operating manual (`PIERONE_OPERATING_MANUAL.md`) now points at the playbooks. Engineering deploy/recover playbook is unchanged. Scout send is not started.

### Phase F — PierOne company operating manual

- Added `docs/business/PIERONE_OPERATING_MANUAL.md`: who PierOne is, SOLVE → BUILD → OPERATE, the five catalog offers (Professional Search public alias noted), Title ≠ Access, and the client / recruiting / military flows mapped to live WorkforceOS screens.
- Seeded approved knowledge record `pierone-operating-manual` so Scout can cite the manual later. Did not start Academy (Phase E) or the ten Phase G service playbooks.
- Pointers from `AGENTS.md`, `WORKFORCEOS_MASTER_SPEC.md`, and the completion ledger. The engineering deploy playbook is unchanged.

### Phase D — Military Talent model lock

- Synchronized the DEC-MIL-005 intermediary model across spec, catalog, workflows, data dictionary, emails, Scout, knowledge seed, reports, public site CTAs, and leftover “My SkillBridge Queue” / Specialist prose.
- Operator-facing access copy is Military Talent Partner. `military-talent-specialist` remains a one-release slug alias only.
- SkillBridge stays a pathway/opportunity type, not a sixth launch service and not a PierOne-owned program. Canonical flow is locked in operating docs. In-app Academy is not claimed.

### Phase M — Production API keys

- Added `docs/operations/PRODUCTION_API_KEYS.md`: every `lib/env.ts` production variable by name (purpose, required vs optional, System Health signal, where to set). No secret values.
- System Health adds no-secret rows for Sentry, BLS/Census, SeekOut/Apollo, and DocuSign/QuickBooks. AI remains labeled LIVE vs HEURISTIC.

### Phase C — Title ≠ Access

- Organizational title is display-only (`users.organizational_title`). Access is 0..N PostgreSQL bundles plus optional grant/deny overrides (`user_permission_overrides`; deny wins). People detail is `/app/admin/users/[id]`.
- Renamed access bundle `military-talent-specialist` → `military-talent-partner` (Military Talent Partner). One-release alias documented. Recruiter still lacks `opportunities.read`.

### Phase B — AI as intentional production operation

- Features pick FAST / STANDARD / REASONING / EMBEDDING capability classes (`AI_MODEL_*`) instead of scattered model brand strings. `OPENAI_*` aliases remain. Missing keys stay honest `internal_heuristic`.
- System Health now labels AI **LIVE** vs **HEURISTIC**, plus embeddings path, Scout (closed commands, send denied), and last successful live AI call timestamp only. No secrets.
- Scout search covers companies, contacts, opportunities, candidates, jobs, Military Talent, employer opportunities, projects, finance, public content, and knowledge/training. External send stays hard-denied.

### Phase A production hygiene

- Remaining work is now tracked in `docs/operations/MASTER_COMPLETION_LEDGER.md`.
- Unknown Clerk users are no longer auto-created as active. Production Clerk sign-up is restricted (invite-only). `db:bootstrap-admin` records a missing email as invited instead of requiring a first public sign-in.

### Military Talent intermediary model

- Locked: PierOne is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is a pathway/opportunity type, not a PierOne-owned SkillBridge program.
- Public site copy, CTAs, emails, Scout, and WorkforceOS Military Talent navigation now use Transition Talent Profile / employer opportunity language. `/military-talent/join` is the canonical network intake; `/skillbridge/join` redirects there.
- Public gateway errors map HTML/non-JSON upstream responses to a safe "Service temporarily unavailable." message. Signed-out `/app` redirects to `/sign-in` instead of relying on Clerk `protect()` 404 behavior.

### PierOne public website + WorkforceOS public gateway

- Added a separately deployable public website at `sites/pierone` (Vercel root `sites/pierone`) without relocating WorkforceOS `app/`.
- Extended the public gateway with `POST /api/public/v1/inquiries`, `POST /api/public/v1/military-talent`, and `GET /api/public/v1/health`. Employer inquiries become `website_inquiries` intake records; opportunities are not auto-created.
- Implemented the S3-compatible StorageProvider for private resume storage. Local adapter remains development-only.
- Shared public DTOs in `packages/public-api-contracts`. Production HMAC between the first-party website and WorkforceOS write APIs (`PUBLIC_SITE_INTEGRATION_SECRET` / `WORKFORCEOS_SITE_SECRET`). Development may omit the secret; production rejects unsigned public writes. Origin/Referer cannot skip HMAC. Multipart signatures hash exact body bytes. Request IDs are replay-blocked for 10 minutes.
- Added WorkforceOS Public Content (`public_content_items`, `/app/public-content`, `GET /api/public/v1/content`) so authorized users can feature jobs, SkillBridge roles, banners, notices, announcements, and industry campaigns without redeploying pieronepartners.com. Stable brand copy stays in `sites/pierone`. Schema migration `drizzle/0012_wise_scourge.sql`.
- Internal CRM view at `/app/crm/inquiries`. Scout can search website inquiries and convert them with confirmation.
- Added `npm run test:public-site`. Production HMAC is required; System Health no longer reports public write APIs as ready when storage, Resend, or the site secret are missing in production.

### Phase 10 — Careers, applicant tracking, and onboarding

- Extended WorkforceOS with job requisitions, job-description versions, public job postings, applications, interview plans/scorecards, pre-employment checks, offer versioning, employees, and onboarding templates. One global Candidate remains the person record.
- Public careers: `/careers`, `/jobs/[slug]`, `/api/public/v1/jobs`, `/api/public/v1/applications` (multipart resume upload for PDF/DOC/DOCX through StorageProvider). Rate limiting, magic-byte validation, and confidential-client redaction. Not a public job marketplace.
- Added EmailProvider (Resend + mock + production unconfigured-fail). CalendarProvider is mock-only (`liveScheduling` false). BackgroundCheckProvider is manual; Checkr HTTP API is not wired. DrugScreenProvider is always manual. Humans review; results never auto-reject.
- Scout searches hiring queues; material rejection and external sends still require a human. Command Center hiring metrics read PostgreSQL aggregates only. System Health does not display secrets.
- Internal onboarding at `/app/onboarding` works without a candidate portal. `/onboarding/access` and candidate self-scheduling are documented follow-on.
- Added `npm run test:phase10`. Schema migration `drizzle/0010_nostalgic_scarecrow.sql` (also creates research session/cache tables that were already in the Drizzle schema). Development fixtures are fake applicants only and cannot seed production.
- Parked unfinished AI/research runtime at `1a356d3` (`follow-on/parked-working-tree`) is not part of Phase 10 and must not be merged for this completion.

### Post-Phase-9 stabilization

- Locked Admin Approvals behind platform admin and organization scope. Command Center pending-approval widgets follow the same gate.
- Command Center no longer loads full finance engagement economics or unbounded recruiting/integration lists for dashboard counts.
- Scout SQL rejection no longer blocks natural-language UPDATE; result sets cap at 25; drafts are audited.
- SkillBridge window math uses UTC calendar days; queue windows follow stored alert-rule thresholds; follow-up scan has a daily Inngest cron and a unique notification index (`drizzle/0009_swift_saracen.sql`).
- Production-safe AI seed no longer requires a Managing Partner user row. Storage health is ready only for the working local adapter.
- Added operations docs: migration runbook, performance audit, disaster recovery, pilot plan, and post-launch backlog.

### Phase 9 — Scout + SkillBridge operations

- Added Scout, the persistent WorkforceOS intelligence assistant (tooltip: Open Scout). Right-side drawer on authenticated screens. Closed command registry; no model-generated SQL; chat is not the system of record.
- Scout uses route page context, RBAC/PII stripping before model context, confirmation cards for material writes, and Draft → Human Review → Send/Copy (never auto-send).
- Added SkillBridge operations as a first-class Military Talent workflow. SkillBridge people are existing Talent Network candidates (`skillbridge_profiles` 1:1). Employer opportunities, configurable alert rules, Inngest scans, and in-app notifications.
- Command Center and military reports include live SkillBridge counts. My SkillBridge Queue is owner-scoped (managers with `skillbridge.manage` can view global).
- Added schema migration `drizzle/0008_cooing_blade.sql` and `npm run test:phase9` (25 acceptance tests).
- Development fixtures include ≥12 labeled SkillBridge candidates. Production seed loads alert-rule defaults only, not those people.

### Phase 8 — Executive reporting + Command Center + production hardening

- Finalized the Executive Command Center with live PostgreSQL aggregates (business, sales, recruiting, talent, workforce, projects, AI, integrations). Empty values stay empty.
- Added a Reports module (date/client/service/owner filters, saved views, CSV export). PII CSV requires `reports.export_pii` and an audit event. Not a BI dashboard builder.
- Added Data Quality (completeness/freshness only), operational alerts, Admin access review, and a System status page that never shows secrets.
- Hardened privacy deletion (distinct from archive), rate limits, IDOR scoping, storage upload limits/checksum, seed guards, and optional Sentry via `SENTRY_DSN`.
- Added schema migration `drizzle/0007_chemical_quasar.sql`, `npm run test:phase2`, `npm run test:phase8`, `npm run test:smoke`, and operating playbooks under `docs/operations/`.

### Phase 7 — AI Operations + Automation

- Activated the approved agent registry (plus optional Finance, Compliance, and Candidate Engagement assistants) on top of PostgreSQL, approved workflows, RBAC, audit, approvals, and provenance.
- Added prompt versioning, provider abstraction with heuristic fallback, a reusable context builder, Review Queue, named automation rules, autonomy levels 0–4, knowledge records with ACL-filtered retrieval, cost limits, circuit breakers, and recorded agent handoffs.
- Agents cannot self-approve, submit candidates, send proposals, or execute contracts. Internal Talent Network search, project creation after contract execution, and billing events remain workflow-gated.
- Added schema migration `drizzle/0006_mushy_iron_lad.sql` and `npm run test:phase7`.

### Phase 6 — Finance + Billing + Business Integrations

- Expanded Phase 4 `billing_schedules` / `billing_events` into operational finance: invoices, payments, AR aging, revenue events, and engagement economics. QuickBooks remains the accounting ledger.
- Placement fees come from stored search-agreement terms (salary × percent, negotiated amount, minimum fee). Overrides require reason, user, date, `finance.approve`, and an audit event.
- Integration Hub adapters for QuickBooks, DocuSign, Apollo, O\*NET, SeekOut (preferred sourcing), LinkedIn (no scrape), and Microsoft/Google workspace references. Unconfigured providers are labeled mocks — never fake production connections.
- DocuSign keeps manual execution when credentials are missing. Unsigned webhooks cannot mark a contract executed. Apollo enrichment is review-gated and does not silently overwrite approved CRM fields.
- Added schema migration `drizzle/0005_unknown_satana.sql` and `npm run test:phase6`.
- Harbor, Taylor Ellis, Navy EM, and Cedar Ridge Energy remain development fixtures. Do not run `db:seed:dev` against real production.

### Phase 5 — Workforce Development + Workforce Intelligence

- Expanded Workforce Pipeline Assessment into planning-level workforce roles, baselines, versioned 12/24/36-month forecasts, supply, structured gaps, pipelines, education/training, career pathways, skills-gap analysis, and scenario modeling.
- Forecasts, gaps, and scenarios store provenance, assumptions, confidence, version, and reviewer. They are never presented as certain. Delivered assessments are not overwritten.
- Military overlay reuses Phase 3 mappings. Talent Network overlay uses aggregate counts (no unnecessary PII). BLS/Census/O\*NET stay behind the Integration Hub as unconfigured adapters plus labeled fixtures.
- Client-facing Workforce Pipeline Plans and AI drafts require human approval. Approved roadmaps create `project_tasks` on existing delivery projects.
- Added schema migration `drizzle/0004_melted_stryfe.sql` and `npm run test:phase5`.
- Development fixture: Cedar Ridge Energy. Harbor, Taylor Ellis, and Navy EM remain development fixtures. Do not run `db:seed:dev` against real production.

### Phase 4 — Service Engines + Proposals + Contracts + Project Delivery

- Added a reusable service workflow engine for the five launch services. Approved versions and workflows are loaded from PostgreSQL.
- Added discovery, solution plans, proposals (with versioning and HTML export), legal templates, contract packages, manual e-sign, delivery projects, deliverables, billing triggers, closeout, and expansion suggestions.
- Search projects remain recruiting containers. Delivery projects require an executed contract unless a Managing Partner override is audited.
- Added schema migration `drizzle/0003_vengeful_tyger_tiger.sql`.
- Added `npm run test:phase4`.
- Installation interactive map remains deferred to Phase 3.5. QuickBooks invoicing is not implemented.

### Deployment readiness

- Split production-safe seed (`db:seed:prod`) from development fixtures (`db:seed:dev`). Harbor, Taylor Ellis, and Navy EM test mappings are excluded from production seed.
- Hardened Vercel storage fallback so the local disk adapter is not used in production.
- Added `NEXT_PUBLIC_APP_URL` / `APP_URL`, `db:check` migration/extension/table validation, and first-admin bootstrap (`db:bootstrap-admin`).
- Documented Neon/Vercel/Clerk environment separation in `docs/architecture/DATABASE_DEPLOYMENT.md` and `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`.

### Phase 3 — Recruiting Operations + Military Talent Translator

- Added recruiting operations: job intake, canonical job skills, internal-first search, job-specific match components, pipeline, screening, submissions, interviews, offers, placements, and agreement-based guarantees.
- Added recruiting analytics from live PostgreSQL counts. External sourcing remains Integration Hub hooks and stays blocked until internal search is complete.
- Added military occupation library, skills translator, reverse search, installation targeting, bridge training, military candidate filter, and mapping review with provenance.
- Added schema migration `drizzle/0002_fancy_pretty_boy.sql` for recruiting and military operating columns/tables.
- Installation interactive map is deferred to Phase 3.5; list/geo and `coordinate_source` are the Phase 3 foundation.
- Inngest jobs cover internal talent search and stalled recruiting alerts (in-app only).

### Phase 2 — CRM Command Center

- Added Command Center aggregates from live PostgreSQL counts.
- Recast internal navigation around CRM, Talent Network, Recruiting, Military, and later-phase placeholders.
- Added first-class Contacts, Opportunities, and Signals routes with scoring, review, conversion, and activity logging.
- Expanded CRM/Talent schema for scoring, signals review, designations, and activities (`drizzle/0001_useful_frog_thor.sql`).
- Seeded additional demo companies and candidates without changing Harbor graph acceptance counts.

### Phase 2 — operating UI

- Added company CRM screens for companies, locations, contacts, signals, and opportunities.
- Added Talent Network screens for candidates and pools, with Restricted PII redaction.
- Added Professional Search jobs UI that always creates an internal Talent Network search project and scores job-specific matches.
- Seeded versioned workflow steps for all five launch services.
- Added Military Talent Opportunity Assessment UI: occupation translation, reverse civilian search, human-approved solution plans, and delivery projects.

### Phase 1 — technical foundation

- Stabilized the existing Next.js App Router application.
- Added architecture, business, database, decision, integration, requirements, and workflow documentation.
- Added Cursor project rules.
- Added typed environment validation.
- Added Neon/Drizzle foundation, pgvector, and pg_trgm.
- Added Clerk authentication with local user synchronization.
- Added RBAC, audit logging, approvals, agent registry, Inngest, storage abstraction, and Integration Hub foundations.
- Added initial CRM, talent, recruiting, military, service, project, and search schemas.
- Added tests, database acceptance script, system health page, and deployment notes.

Later phases add additional operating modules on this foundation; they are not an architecture replacement.
