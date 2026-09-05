# Changelog

## Unreleased

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

Later phases add additional CRM depth, military translation UI, and delivery project execution, not an architecture replacement.
