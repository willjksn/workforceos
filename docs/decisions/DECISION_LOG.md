# Decision Log

Status: Phase 1 architectural decisions  
Database mirror: `decision_log` table, seeded from this file.

## DEC-DB-001 — PostgreSQL over Firebase

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: PostgreSQL is the system of record. Firebase/Firestore are prohibited.
- Reason: Relational integrity, server-side authorization, pgvector/pg_trgm, auditability, and future reporting require a relational database. Firebase is not an approved system of record.
- Affected modules: all
- Reconsideration: only if PostgreSQL cannot meet a documented operational constraint; would require a new proposed-change document.

## DEC-APP-001 — Next.js and Vercel retained

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: Keep the existing Next.js App Router application on Vercel. Keep the root-level `app/` directory from the scaffold.
- Reason: The repository was already initialized as Next.js. Consistency matters more than moving to `src/`.
- Affected modules: application, deployment
- Reconsideration: if App Router or Vercel becomes incompatible with required runtime capabilities.

## DEC-DB-002 — Neon as primary database

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: Neon PostgreSQL is the primary database, accessed with the Neon serverless driver.
- Reason: Serverless/Vercel compatibility, branching for preview environments, managed PostgreSQL.
- Affected modules: database, deployment
- Reconsideration: if Neon branching, extensions, or connection behavior cannot support production load.

## DEC-DB-003 — Drizzle as ORM

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: Drizzle ORM with SQL migrations.
- Reason: Typed schema close to SQL, Neon support via neon-http and neon-serverless, migration files that can be reviewed.
- Affected modules: database
- Reconsideration: if Drizzle cannot represent required Postgres features without unsafe escape hatches.

## DEC-SEC-001 — WorkforceOS is internal-first

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: V1 is an internal operating system. Prefer invite-controlled Clerk users over public registration.
- Reason: Candidate PII and client data must not be exposed through a public product surface.
- Affected modules: auth, users, all UI
- Reconsideration: if a later phase explicitly launches a controlled client portal.

## DEC-AI-001 — AI is an internal operating engine

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: AI assists internal work. It is not a client-facing marketing claim and does not own company knowledge.
- Reason: Provenance, approval, and human control are required for material outputs.
- Affected modules: agents, approvals, services
- Reconsideration: only after approval workflow and provenance are proven in production use.

## DEC-BIZ-001 — No temp staffing or payroll in V1

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: Do not implement temp staffing or payroll products.
- Reason: Out of launch scope. Fractional Talent Partner is an advisory/operating engagement, not staffing payroll.
- Affected modules: services, finance, projects
- Reconsideration: new product decision with legal/finance review.

## DEC-SEC-002 — No ownership or cap-table data in normal WorkforceOS

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: Do not store founder ownership percentages or cap-table records in the application.
- Reason: Ownership data is not part of the operating system and would create an unnecessary sensitive-data surface.
- Affected modules: organizations, finance, users
- Reconsideration: only if a separate, explicitly approved ownership system is required outside this app.

## DEC-SEM-001 — Temporary embedding dimension

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted-temporary
- Decision: `semantic_documents.embedding` uses vector dimension 1536 for development schema creation.
- Reason: Drizzle/pgvector require a dimension at table creation. No production embedding model is selected yet.
- Affected modules: semantic search
- Reconsideration: required before production semantic search. Changing dimension will need a new column or rebuild.

## DEC-AUTH-001 — Clerk authenticates; PostgreSQL authorizes

- Date: 2026-09-04
- Owner: Product Build
- Status: accepted
- Decision: Clerk is the identity provider. Local `users`/`roles`/`user_roles` are the authorization source of truth. Clerk metadata is never the sole permission source.
- Reason: Application permissions must survive provider changes and remain auditable in PostgreSQL.
- Affected modules: auth, rbac
- Reconsideration: if Clerk Organizations become the multi-tenant model; local permission records would still remain required.

## DEC-CRM-001 — First-class CRM records and stored opportunity scores

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Contacts, opportunities, and signals are first-class operating records with their own routes. Opportunity scores use a stored 100-point model (ICP 20, trigger 25, demonstrated pain 20, service fit 15, buyer access 10, timing/budget 10) with optional human override and reason. Company `annual_revenue` and `employee_count` are operating-size fields, not ownership or cap-table data. Command Center metrics are live PostgreSQL aggregates.
- Reason: Nested company-only CRM cannot support pipeline, signal review, or role-aware operating snapshots. Scores must be persisted so the UI cannot invent them at render time.
- Affected modules: crm, command center, audit
- Reconsideration: if a later phase replaces the scoring model; existing `opportunity_scores` rows would need a versioned migration.

## DEC-REC-001 — Internal Talent Network first; job-specific scores only

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Activating a job starts an Internal Talent Network search. External sourcing adapters stay behind the Integration Hub and remain blocked until internal search is marked complete. Candidate scores are job-specific component records with explanations. There is no universal candidate quality score, and scores never auto-reject.
- Reason: PierOne is a professional search firm. Internal reuse and explainable fit are operating rules, not UI preferences.
- Affected modules: recruiting, talent, integrations
- Reconsideration: only if a documented search agreement requires a different sourcing order.

## DEC-REC-002 — Guarantee and fee terms come from the search agreement

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Placement fee percent/amount and guarantee days are copied from the search project / search agreement. The application does not invent defaults. Finance invoicing is a queued billing hook only.
- Reason: Contract terms are commercial facts. Fabricated guarantee windows would create false operating data.
- Affected modules: recruiting, finance
- Reconsideration: if a later finance module becomes the system of record for invoices; guarantee windows would still originate from the agreement.

## DEC-MIL-001 — Military mappings need provenance and human review

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Military→civilian, installation, bridge-training, and candidate translation records store source, version, confidence, origin, and review status. Agent-generated mappings start pending. The originating agent cannot approve them. Development fixtures are labeled and are not authoritative production data.
- Reason: Military translation is a differentiator and a liability if invented. Hiring-manager copy may use only approved mappings.
- Affected modules: military, approvals, audit
- Reconsideration: if a trusted official extract is imported as reference data with `trustedReference`; those rows may start approved.

## DEC-MIL-002 — Installation map view deferred to Phase 3.5

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 3 ships list/geo foundation (`latitude`, `longitude`, `coordinate_source`) and occupation→installation targeting. An interactive map is deferred so Phase 3 is not blocked by a mapping dependency. Coordinates are never fabricated.
- Reason: List/geo plus ranked targeting satisfies the operating workflow. A map library would delay recruiting and translator delivery.
- Affected modules: military UI
- Reconsideration: Phase 3.5 if a lightweight map can consume stored coordinates without a large new dependency.

## DEC-DEP-001 — Separate Neon databases per Vercel environment

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Development, Vercel Preview, and Vercel Production each use a distinct Neon branch/database. Migrations are versioned Drizzle files applied explicitly. Production seed is catalog-only. Development fixtures never run in production. `next build` does not migrate or seed.
- Reason: The current default Neon branch is named `production` but contains development fixtures. Sharing one database would mix Harbor/Taylor Ellis data with live operations and make rollback unsafe.
- Affected modules: deployment, database, seed
- Reconsideration: if Neon-Vercel preview branching is enabled, preview still must not share the production connection string.

## DEC-SVC-001 — Reusable service workflow engine

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 4 uses one reusable service workflow engine for all five launch services. Approved `service_versions` and `service_workflows` are loaded from PostgreSQL before service-specific work. Application code does not hardcode material process, pricing, legal-package, or project-template rules in prompts.
- Reason: Five separate engines would drift. Version-controlled workflow records are the operating source of truth (WFOS-SVC-001).
- Affected modules: services, discovery, solutions, proposals, legal, projects
- Reconsideration: only if a service requires a fundamentally different state machine that cannot be expressed as versioned steps.

## DEC-SVC-002 — Search projects are not delivery projects

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: `search_projects` remain Internal Talent Network search containers for Professional Search. `projects` are delivery engagements created from an approved solution plan, service workflow, and (normally) executed contract.
- Reason: Mixing search execution with consulting delivery would break recruiting operations and billing.
- Affected modules: recruiting, projects
- Reconsideration: none for V1.

## DEC-SVC-003 — Approved service versions are immutable

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: An approved `service_versions` row is never overwritten. Scope, pricing guidance, deliverables, or workflow changes create a new version. Solution plans and proposals continue to reference the version they were created against.
- Reason: Client-facing scope and pricing must remain auditable against the definition that was sold.
- Affected modules: services
- Reconsideration: clerical typo fixes on non-material metadata would still require a new version to keep the rule simple.

## DEC-SVC-004 — Contract execution gate for delivery projects

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Creating a delivery project requires an executed contract unless a Managing Partner records an override with user, reason, and date. The override is audited. Recruiting `search_projects` are unaffected.
- Reason: Delivery work should not start without commercial coverage.
- Affected modules: projects, legal
- Reconsideration: if a later legal workflow supports limited notice-to-proceed, it must still be an explicit audited exception.

## DEC-FIN-001 — Billing events are operational triggers only

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 4 stores `billing_schedules` and `billing_events` as operating records. They do not create QuickBooks invoices unless that integration is already configured. Finance screens show triggers, not a general ledger.
- Reason: Full accounting is out of Phase 4 scope. Contract and project events still need an auditable billing hook.
- Affected modules: finance, projects
- Reconsideration: when QuickBooks is configured, events can be exported through the Integration Hub without becoming the system of record for invoices.

## DEC-LEGAL-001 — Legal templates are not attorney-authoritative by default

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Seeded legal templates are structural placeholders. They are not treated as attorney-approved language unless `attorney_approved` is true and status is `approved`. AI cannot mark templates or contracts approved.
- Reason: Invented legal language would create liability.
- Affected modules: legal
- Reconsideration: after counsel provides approved text, templates are versioned and the attorney-approved flag is set.
