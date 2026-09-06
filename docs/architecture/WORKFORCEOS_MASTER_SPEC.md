# WorkforceOS Master Specification

Status: Phase 10 Careers, ATS, and employee onboarding  
Audience: engineering agents and maintainers  
Canonical: this file is the architecture source of truth for implementation.

## Purpose

WorkforceOS is an internal operating system for a Workforce & Talent Solutions firm. It is not a generic ATS and not a public SaaS platform in V1.

It will eventually manage company CRM, Talent CRM, recruiting/search, military talent translation, workforce development, legal document operations, finance/AR workflow, integrations, background AI agents, audit history, approvals, and institutional knowledge.

Phase 1 built the technical foundation. Phase 4 activates service engines, proposals, contracts, and project delivery. Phase 5 expands Workforce Pipeline Assessment into workforce development and intelligence. Phase 6 activates operational finance and Integration Hub business adapters. Phase 7 activates AI operations, prompt versioning, the Review Queue, named automation, and approved knowledge retrieval. Phase 8 finishes executive reporting, the Command Center, operational alerts, data quality, and production hardening. Phase 9 adds Scout (the persistent in-app assistant) and SkillBridge operations as a first-class Military Talent workflow. Phase 10 extends WorkforceOS into PierOne careers, applicant tracking, pre-employment, offers, and new-hire onboarding. It is not a public job marketplace and not a payroll/benefits HRIS. Do not start Phase 11 unless explicitly asked.

## Product boundaries

In V1, WorkforceOS:

- is internal-first
- treats PostgreSQL as the system of record
- treats AI as an internal operating engine, not a client-facing marketing claim
- does not include temp staffing or payroll
- does not include a public job marketplace
- does not store founder ownership or cap-table information in the normal application

## Approved technology stack

| Concern | Choice |
| --- | --- |
| Application | Next.js App Router + TypeScript |
| Hosting | Vercel |
| Database | Neon PostgreSQL |
| ORM | Drizzle |
| Authn | Clerk |
| Authz | Local PostgreSQL roles/permissions, enforced server-side |
| File storage | StorageProvider abstraction; Cloudflare R2 / S3-compatible in production; local adapter in development |
| Search | pgvector semantic search; pg_trgm fuzzy search; PostgreSQL full-text where useful |
| Background jobs | Inngest |
| AI models | Provider abstraction; agents do not own data |
| Monitoring | Sentry when `SENTRY_DSN` is set; redacted server logs otherwise |

Firebase and Firestore are prohibited.

## Application structure

The repository uses a root-level `app/` directory from the original Next.js scaffold. Keep that layout unless a documented decision changes it. The PierOne public website is a second Next.js app at `sites/pierone` (DEC-WEB-002). It does not import `db/` or Drizzle.

Server-only modules live under `db/` and `lib/`. Client components must not import database, environment secrets, or authorization internals.

## Architecture rules

1. PostgreSQL is the primary source of truth.
2. External tools (Apollo, SeekOut, LinkedIn, O\*NET, DocuSign, QuickBooks, and future providers) are integrations, not systems of record.
3. AI agents do not own data.
4. AI agents may create drafts and recommendations but may not silently overwrite approved human decisions.
5. All business-critical AI outputs retain provenance: agent, model, model version, timestamp, confidence, and source references where applicable.
6. Authorization is enforced server-side.
7. Database credentials are never exposed to the browser.
8. Important records use UUID primary keys.
9. Operational records use soft-delete/archive where appropriate.
10. Candidate privacy deletion is a separate controlled process, not ordinary archive.
11. Avoid excessive JSONB. Use relational tables for data that is searched, filtered, joined, sorted, aggregated, or reported on.
12. Ownership/cap-table information is not part of the normal WorkforceOS application.

## Domain map (future modules)

Phase 1 built the technical foundation. Phase 2 added operating UI for CRM, Talent Network, Professional Search, and Military Talent Opportunity Assessment. Phase 3 activates recruiting operations and the military talent translator. Phase 4 activates the five launch service engines, proposals, contracts, and delivery projects. Phase 5 adds workforce development and workforce intelligence without a second taxonomy or project system.

- CRM: companies, contacts, opportunities, signals
- Talent Network: candidates, pools, rediscovery
- Recruiting: jobs, internal-first search projects, job-specific matches, pipeline, submissions, interviews, offers, placements, guarantees
- Military Talent: occupation library, skills translator, reverse search, installations, bridge training, human mapping review, SkillBridge operations
- Scout: persistent page-aware assistant with a closed command registry; chat is not the system of record
- Workforce Development: planning-level workforce roles, baselines, versioned forecasts, supply, gaps, pipelines, career paths, scenarios, and the expanded Workforce Pipeline Assessment deliverable
- Services: five launch service engines, versioned workflows, discovery, solution plans, proposals
- Legal: templates, contract packages, execution, e-sign abstraction
- Finance: operational billing, invoice expectations, AR view, revenue events (QuickBooks remains the ledger)
- AI: agent registry, runs, outputs, prompt versions, review queue, automation, knowledge retrieval, approvals
- Platform: users, roles, audit, integrations, files, search, reports, alerts, data quality

## Reporting and production hardening (Phase 8)

- Command Center and Reports read stored PostgreSQL aggregates. Missing values stay empty. There is no BI dashboard builder.
- Operational alerts are derived from source records. Data Quality flags completeness and freshness only; they are not performance scores.
- Candidate PII CSV requires `reports.export_pii` plus an audit event. Privacy deletion anonymizes Restricted PII and is distinct from archive.
- Production seed (`db:seed:prod`) is catalog-only. Development fixtures cannot run when `NODE_ENV=production` or `VERCEL_ENV=production`.
- Rate limits apply to AI runs, exports, search, webhooks, and auth-sensitive admin actions without blocking ordinary page loads.

## Data ownership

| Data | Owner |
| --- | --- |
| Companies, contacts, opportunities | WorkforceOS PostgreSQL |
| Candidates and talent pools | WorkforceOS PostgreSQL |
| Jobs and matches | WorkforceOS PostgreSQL |
| Workforce assessments, roles, forecasts, gaps, pipelines | WorkforceOS PostgreSQL; labor-market APIs are references only |
| Military mappings | WorkforceOS PostgreSQL; external occupation systems are references |
| Files | Object storage metadata in PostgreSQL; binaries in the storage provider |
| Identity credentials | Clerk for authentication only |
| Application authorization | Local `users`, `roles`, and `user_roles` |
| AI recommendations | `agent_outputs` plus approvals; humans remain authoritative |

## Security baseline

- Candidate records are Restricted PII.
- Server-side permission checks wrap all mutations.
- Proxy/Clerk route protection is an optimistic gate, not the authorization system.
- Secrets stay in server environment variables.
- Audit events are append-only through application logic.

## Recruiting and military operating rules (Phase 3)

- Activating a job (`search_active`) starts an Internal Talent Network search. External sourcing hooks stay blocked until that search is marked complete.
- `candidate_job_matches` are job-specific. There is no universal candidate quality score. Component scores are stored and explained. Scores never auto-reject a candidate.
- Pipeline movement and material rejection are audited. AI/system actors cannot reject a candidate without a human.
- Placement guarantee days and fee terms come from the search agreement / search project. The application does not invent contract terms.
- Military mappings store source, version, confidence, origin, and review status. Agent drafts start pending. The originating agent cannot approve them.
- Military candidates reuse Talent Network candidate records. There is no separate military candidate database.
- Installation map rendering is deferred to Phase 3.5. List/geo fields and `coordinate_source` are the Phase 3 foundation. Coordinates are never fabricated.

## Service delivery rules (Phase 4)

- The five launch services share one workflow engine. Agents and application code load the approved `service_versions` / `service_workflows` records before service-specific work.
- Approved service versions are immutable. Changes create a new version.
- `search_projects` are recruiting containers. `projects` are delivery engagements.
- Proposals, pricing outside the configured range, contracts, legal language, and client-facing deliverables require human approval. Agents cannot approve their own material output.
- Delivery project creation requires an executed contract unless a Managing Partner override is recorded and audited.
- Billing events are operational triggers. Invoice and payment rows are operating records. They do not make WorkforceOS the accounting ledger. QuickBooks remains the accounting source of truth.
- Seeded legal templates are not attorney-authoritative unless `attorney_approved` is true.

## Workforce development rules (Phase 5)

- `workforce_roles` are planning-level occupation records. They do not duplicate recruiting `jobs`. Activating search still uses `jobs` and `search_projects`.
- Skills and civilian occupations remain canonical. Skill families are a column on `skills`. Do not create a second taxonomy.
- Demand forecasts use configurable components (current required + growth + replacement + backlog − expected internal supply). Analysts may include, exclude, or override components with an audited reason.
- Forecasts, supply, gaps, and scenarios store source, source date/version, assumptions, confidence, version, reviewer, and fixture labeling. They are never presented as certain. Delivered assessments are not overwritten; changes create a new version.
- Gap severity uses stored thresholds. Pipeline allocation warns when planned capacity is below the gap. Scarcity is unknown/estimated/internal-only when labor-market APIs are unconfigured.
- Military overlay reuses Phase 3 mappings. Talent Network overlay uses aggregate counts by default (no candidate PII on executive workforce views).
- BLS, Census, and O\*NET stay behind the Integration Hub. Unconfigured sources are adapters plus labeled fixtures. Values are never invented.
- Client-facing workforce recommendations and Workforce Pipeline Plans require human approval. Agents cannot approve their own material output.
- Approved roadmaps create `project_tasks` on the existing delivery `projects` row. There is no second project system.
- Installation interactive maps remain deferred to Phase 3.5. List/region geography is sufficient.

## Scout (Phase 9)

- Official name is Scout. Tooltip: Open Scout. Do not brand it Copilot, Navigator, or a generic Assistant.
- Scout is a right-side drawer on authenticated screens. It does not navigate away unless an action requires an entity link.
- Natural language parses to a closed command registry: SEARCH, SUMMARIZE, DRAFT, CREATE, UPDATE, ASSIGN, ADD_TO_POOL, ADD_TO_JOB, CREATE_TASK, CREATE_FOLLOW_UP, SHOW_RECORD, SHOW_DASHBOARD, FIND_MATCHES. Unknown commands are rejected. The model never generates SQL.
- Execution path: prompt → intent parser → Zod DTO → authorize → existing query/service layer → PostgreSQL → structured result cards. Page context is the route (candidate/job/company/SkillBridge ids), not conversational memory.
- RBAC and Restricted PII stripping happen before any record is passed to a model. Without `candidate_pii.read`, email, phone, compensation, resume text, and other restricted fields are omitted.
- Read actions may run immediately. Material internal writes require confirmation. External actions require `scout.external_actions` plus human approval. Destructive actions always confirm. Drafts follow Draft → Human Review → Send/Copy and never auto-send.
- Permissions: `scout.use`, `scout.search`, `scout.draft`, `scout.internal_actions`, `scout.external_actions`. Scout cannot self-approve, send contracts, execute offers, reject candidates solely via AI, or bypass RBAC.
- `scout_sessions` / `scout_messages` / `scout_actions` are usability memory. PostgreSQL business tables remain the system of record.

## SkillBridge operations (Phase 9)

- SkillBridge people are existing Talent Network `candidates`. `skillbridge_profiles` are a 1:1 overlay. Do not duplicate a candidate per employer or job.
- Preferred locations and target roles are junction tables. Employer connections are `skillbridge_opportunities` with stage history. Filtered fields are relational columns, not JSONB.
- Resume status is `missing | outdated | current | needs_review` — not a quality score. Files use the existing storage abstraction; binaries stay out of PostgreSQL.
- Matching reuses the existing job-match architecture. Humans connect or submit. Employer briefs and message drafts require human review.
- Follow-up, window, no-opportunity, employer-feedback, resume-missing, and conversion rules live in configurable `skillbridge_alert_rules`. Inngest runs scans. In-app notifications are the delivery channel.
- Metrics and My SkillBridge Queue counts come from stored rows only. Permissions: `skillbridge.read`, `skillbridge.write`, `skillbridge.manage`, `skillbridge.export`. Restricted PII rules still apply.
- Development fixtures include labeled SkillBridge people. Production seed (`db:seed:prod`) loads alert-rule defaults only, not those people.

## Careers, ATS, and onboarding (Phase 10)

- There is one global `candidates` record. `applications` are Candidate↔Job relationships. Never duplicate a person because they applied twice or later became an employee.
- Jobs may be `internal`, `client`, or `skillbridge`. Approved jobs publish through `job_postings` to `/careers` and `/api/public/v1/jobs`. Public payloads omit confidential client identity, compensation internals, and recruiter notes.
- Public applications enter WorkforceOS through `/api/public/v1/applications` (validation, rate limit, multipart resume upload for PDF/DOC/DOCX). Binaries go to `StorageProvider`; PostgreSQL stores `files` metadata only. The public site never receives database credentials.
- PierOnePartners.com is the public business front door. It consumes `/api/public/v1` (jobs, applications, inquiries, military talent, public content). Employer inquiries create `website_inquiries` for human qualification. Frequently changing operational public content is published from WorkforceOS (`public_content_items`); stable brand copy stays in `sites/pierone`. See `docs/public-site/ARCHITECTURE.md` and `docs/public-site/PUBLIC_CONTENT_PUBLISHING.md`.
- Interview scheduling uses `CalendarProvider`. Phase 10 is **mock only** (`liveScheduling` is always false). Microsoft/Google credentials, when present, are Integration Hub workspace references — not live OAuth slot booking. Candidate self-scheduling is follow-on.
- Transactional system email uses `EmailProvider` / Resend when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set. Production without those keys fails clearly. Recruiter mailboxes stay on Microsoft/Google.
- Background and drug screening use provider adapters (`BackgroundCheckProvider`, `DrugScreenProvider`). Checkr is the preferred future background provider but the HTTP API is **not wired** (not sandbox-ready). Drug screening is **NOT CONFIGURED**; `ManualDrugScreenProvider` only. Humans review results; adapters never auto-reject.
- Offers reuse `offers` with versions. Onboarding uses templates and Inngest reminders. Internal `/app/onboarding` completes tasks without a candidate portal. `/onboarding/access` is reserved follow-on. `employees` link to `candidate_id`; the Talent Network record remains. Phase 10 is not payroll, benefits, performance, timekeeping, or a full HRIS.
- Scout can search hiring queues and draft messages. Scout cannot independently reject candidates or send transactional email.

## Related documents

- [SERVICE_CATALOG.md](../business/SERVICE_CATALOG.md)
- [SERVICE_WORKFLOWS.md](../workflows/SERVICE_WORKFLOWS.md)
- [DATA_DICTIONARY.md](../database/DATA_DICTIONARY.md)
- [SCHEMA_SPEC.md](../database/SCHEMA_SPEC.md)
- [DECISION_LOG.md](../decisions/DECISION_LOG.md)
- [INTEGRATION_PLAN.md](../integrations/INTEGRATION_PLAN.md)
- [REQUIREMENTS_REGISTRY.md](../requirements/REQUIREMENTS_REGISTRY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [PUBLIC_CONTENT_PUBLISHING.md](../public-site/PUBLIC_CONTENT_PUBLISHING.md)
- [DATABASE_DEPLOYMENT.md](./DATABASE_DEPLOYMENT.md)
- [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md)
- [WORKFORCEOS_OPERATING_PLAYBOOK.md](../operations/WORKFORCEOS_OPERATING_PLAYBOOK.md)
