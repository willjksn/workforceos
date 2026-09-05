# Changelog

## Unreleased

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

Later phases add workforce-development delivery, finance/QuickBooks, and service-engine execution, not an architecture replacement.
