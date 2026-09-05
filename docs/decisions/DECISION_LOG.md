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

## DEC-WF-001 — Workforce roles are planning-level, not recruiting jobs

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: `workforce_roles` are client occupation/job-family planning records. They do not duplicate `jobs` requisitions. A recruiting job may later reference a workforce role, but activating search still uses `jobs` and `search_projects`.
- Reason: Mixing strategic headcount planning with requisition execution would break Professional Search and invent demand from open reqs.
- Affected modules: workforce, recruiting
- Reconsideration: if a later phase needs a formal job-to-role link, add a junction table without merging the entities.

## DEC-WF-002 — One canonical skills and occupation taxonomy

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 5 reuses `skills`, `civilian_occupations`, and `occupation_skills`. Skill families are a column on `skills`, not a second taxonomy. Workforce role skills, training programs, and career-path levels join to the same `skills` rows.
- Reason: Duplicate taxonomies would drift military, recruiting, and workforce intelligence apart.
- Affected modules: workforce, military, recruiting, talent
- Reconsideration: only if an official O*NET extract requires a versioned import table; canonical rows would still be the join target.

## DEC-WF-003 — Forecasts, gaps, and scenarios are estimates with provenance

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Demand forecasts, supply models, gaps, and scenarios store source, source date/version, assumptions, confidence, version, reviewer, and fixture labeling. They are never presented as certain. Delivered assessments are not overwritten; changes create a new version or `superseded` status.
- Reason: Opaque or invented workforce numbers would create client liability.
- Affected modules: workforce, AI, audit
- Reconsideration: none for V1.

## DEC-WF-004 — Labor-market data stays behind the Integration Hub

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: BLS, Census/LEHD/LODES, and O*NET are Integration Hub adapters. Unconfigured sources expose interfaces, import metadata, and labeled fixtures only. Fixture observations must not be presented as real labor-market intelligence. Do not invent BLS/Census/O*NET values.
- Reason: WFOS-INT-001. Hardcoding provider logic into the Workforce module would contaminate planning records.
- Affected modules: integrations, workforce
- Reconsideration: when credentials exist, adapters can import into `labor_market_observations` with source metadata.

## DEC-WF-005 — Expand the Phase 4 WPA engine; no second project system

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Workforce Pipeline Assessment remains a launch service. Phase 5 expands its analysis, deliverable, and roadmap. Approved roadmap items create `project_tasks` on existing delivery `projects`. Do not add a parallel workforce project table.
- Reason: A second project system would split delivery, billing, and approvals.
- Affected modules: workforce, projects, services
- Reconsideration: none for V1.

## DEC-WF-006 — Talent Network overlay uses aggregates by default

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Workforce executive views show Talent Network coverage as counts (matching candidates, silver medalists, military candidates, geography, readiness). Candidate PII is not shown unless the user has `candidate_pii.read` and opens a talent record.
- Reason: Restricted PII does not belong on workforce planning dashboards.
- Affected modules: workforce, talent, security
- Reconsideration: if a named-candidate drill-in is required, it must reuse Talent Network pages and PII guards.

## DEC-WF-007 — Military overlay reuses Phase 3 mappings

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Workforce military supply is computed from existing `military_civilian_mappings`, installations, bridge training, and Talent Network military filters. Phase 5 does not duplicate occupation libraries. Installation interactive maps remain deferred to Phase 3.5; list/region geography is sufficient.
- Reason: Duplicate military data would diverge from the translator of record.
- Affected modules: workforce, military
- Reconsideration: Phase 3.5 map may consume stored coordinates; it still must not fabricate them.

## DEC-FIN-002 — Operational finance vs QuickBooks ledger

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 6 extends DEC-FIN-001. WorkforceOS owns operational finance: contract value, service revenue, placement fees, recurring fees, billing schedules, invoice expectations, invoice references, an AR operating view, revenue events, and engagement economics. QuickBooks remains the accounting ledger. WorkforceOS does not become a general ledger, payroll, tax, AP, benefits, or expense-management system.
- Reason: The firm needs operating visibility without duplicating accounting. Billing events stay operational triggers; invoices and payments in WorkforceOS are operating records that may map to QuickBooks through the Integration Hub.
- Affected modules: finance, integrations, legal, recruiting
- Reconsideration: none for V1. Live QuickBooks posting still requires configured credentials and does not make WorkforceOS the accounting source of truth.

## DEC-FIN-003 — Expand Phase 4 billing tables; do not create a second billing system

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Expand existing `billing_schedules` and `billing_events`. Add `invoices`, `payments`, `revenue_events`, cost entries, and adjustments beside them. QuickBooks, DocuSign, and Apollo IDs map only through `external_records`. Do not add provider-specific IDs to core finance tables.
- Reason: A parallel invoice/billing model would drift from Phase 4 delivery triggers and invent a second commercial history.
- Affected modules: finance, integrations
- Reconsideration: none for V1.

## DEC-FIN-004 — Commercial amounts come only from stored contract terms

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Placement fees, minimum fees, retained-search structure, milestone amounts, and fractional monthly fees come from stored search agreements, contracts, and `contract_billing_terms`. The application does not invent percentages, splits, or due dates. Human overrides require reason, user, date, `finance.approve`, and an audit event.
- Reason: Fabricated fee or milestone terms would create false AR and client liability.
- Affected modules: finance, recruiting, legal
- Reconsideration: none for V1.

## DEC-INT-002 — Unconfigured providers are adapters plus labeled mocks

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: QuickBooks, DocuSign, Apollo, O\*NET, SeekOut, LinkedIn, Microsoft, and Google stay behind the Integration Hub. Missing credentials yield adapter interfaces, labeled mock/dev behavior, and setup instructions. The app must not present a fake production connection.
- Reason: WFOS-INT-001. Pretend-live integrations would contaminate CRM, legal, and finance records.
- Affected modules: integrations, finance, legal, recruiting
- Reconsideration: when credentials and OAuth exist, adapters may perform live sync while WorkforceOS remains the operational system of record.

## DEC-INT-003 — DocuSign never marks a contract executed without confirmation

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Manual contract execution remains available when DocuSign is unconfigured. Provider webhooks and status polls may update envelope and contract status only after signature validation. Neither a mock adapter nor an unsigned webhook may set `contracts.status = executed`.
- Reason: Execution is a legal fact. Silent or mock completion would create false commercial coverage.
- Affected modules: legal, integrations
- Reconsideration: none for V1.

## DEC-INT-004 — Apollo must not silently overwrite approved CRM data

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Apollo (and similar enrichment) writes proposed payloads to review records with source, external ID, last sync, and confidence. Applying enrichment to companies or contacts requires a human accept. Approved CRM fields are not overwritten automatically.
- Reason: Apollo is a research provider, not the CRM system of record.
- Affected modules: integrations, crm
- Reconsideration: none for V1.

## DEC-INT-005 — SeekOut is the Phase 6 preferred sourcing adapter

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 6 implements SeekOut as the preferred external sourcing adapter. hireEZ remains a thin Integration Hub placeholder. LinkedIn supports profile URL and Recruiter project/reference IDs plus a future RSC/CRM Connect adapter only. Do not scrape LinkedIn. Internal Talent Network search must complete before any external sourcing adapter runs.
- Reason: Part 17 requires one preferred provider. Duplicate deep adapters would split sourcing operations. Scraping LinkedIn is prohibited.
- Affected modules: integrations, recruiting
- Reconsideration: if hireEZ is later selected as the operating provider, swap the deep adapter without changing Talent CRM tables.

## DEC-INT-006 — Workspace tools store references, not a second inbox

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Microsoft 365 and Google Workspace integrations store calendar, meeting, interview, and email/thread references through the Integration Hub. WorkforceOS does not duplicate Outlook or Gmail.
- Reason: Operating work needs pointers to workspace events without becoming a mail client.
- Affected modules: integrations, recruiting, projects
- Reconsideration: if a later phase needs send-as-user, it still must not copy mailboxes into PostgreSQL.

## DEC-AI-002 — Agents operate on PostgreSQL, not as a second database

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 7 agents receive context from PostgreSQL records, approved service workflows, approved knowledge, the current record, and the intersection of agent and human permissions. Conversational memory is not a source of truth. Agents draft and recommend; they do not silently overwrite approved human decisions.
- Reason: WFOS-AI-001 and DEC-AI-001. A hidden AI store would drift from CRM, Talent, recruiting, military, workforce, legal, and finance records.
- Affected modules: ai, workflows, knowledge, security
- Reconsideration: none for V1.

## DEC-AI-003 — Autonomy levels 0–4; no unsupervised external commitments

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Agents have an integer autonomy level: 0 read-only, 1 recommend/draft outputs, 2 write internal draft records, 3 execute approved internal workflow actions, 4 queue external actions that still require human approval. Level 4 never sends material external communications or legal/business commitments without an approved workflow and a human decision. No agent may mark opportunities won, submit candidates, issue offers, approve proposals, execute contracts, or close projects.
- Reason: AI must not bypass approvals or become an unsupervised actor.
- Affected modules: ai, approvals, crm, recruiting, legal, projects
- Reconsideration: none for V1.

## DEC-AI-004 — Approved production prompts are immutable

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Prompt templates are versioned (`prompt_versions`). An approved production prompt is never overwritten. Changes create a new version with effective date, approver, content, and change reason. Runtime loads the current approved version for the agent and prompt name.
- Reason: Silent prompt edits would make material outputs unauditable.
- Affected modules: ai
- Reconsideration: clerical typo fixes still create a new version so the rule stays simple.

## DEC-AI-005 — Provider abstraction with heuristic fallback

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Business logic is not hardwired to one model provider. Runtime selects provider, model, task type, temperature, timeout, cost limits, and an approved fallback from `ai_model_configs`. When `AI_API_KEY` is unset, the `internal_heuristic` provider produces deterministic drafts from stored records. Neon AI Gateway / OpenAI-compatible endpoints are supported when configured. Estimated cost and token usage are recorded when available.
- Reason: Phase 7 must run in development without live model credentials, and production must be able to change models without rewriting agents.
- Affected modules: ai, deployment
- Reconsideration: after a production embedding and chat model are selected, update DEC-SEM-001 and model configs together.

## DEC-AI-006 — Knowledge is approved, versioned, and ACL-filtered before retrieval

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Institutional knowledge lives in `knowledge_records` and may be indexed into `semantic_documents`. Retrieval applies organization, privacy class, approval status, and permission checks before returning content. Restricted candidate PII and unrelated client confidential data are not eligible for cross-context retrieval. Agents preserve sources on every knowledge-backed output.
- Reason: Semantic search without ACL would leak Restricted PII and client confidential data.
- Affected modules: ai, knowledge, security, search
- Reconsideration: production embeddings still require a selected model (DEC-SEM-001).

## DEC-AI-007 — Closed automation rules, not a no-code platform

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Phase 7 ships a fixed set of event-driven automation rules (high-score signal, job `search_active`, new candidate, overdue interview feedback, contract executed, project milestone complete, pending workforce recommendation). Rules invoke named agent tasks or approved internal workflow actions. Do not add an arbitrary no-code automation builder.
- Reason: Open-ended automation would bypass workflow, permission, and approval design.
- Affected modules: ai, inngest, recruiting, legal, finance, crm
- Reconsideration: additional named rules may be added when a documented operating event requires them.

## DEC-AI-008 — Review queue is the operating surface for material AI output

- Date: 2026-09-05
- Owner: Product Build
- Status: accepted
- Decision: Material agent outputs create `approvals` plus `agent_outputs` in a central Review Queue. Categories include candidate submission, AI rejection recommendation, military mapping, workforce recommendation, solution plan, proposal, pricing, contract/legal language, client deliverable, and invoice adjustment. Humans may approve, reject, request changes, or edit where the domain record allows. The originating agent cannot decide the approval.
- Reason: WFOS-AI-002. Scattered per-module AI inboxes would hide pending material work.
- Affected modules: ai, approvals, audit
- Reconsideration: none for V1.
