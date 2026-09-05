# Changelog

## Unreleased

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
