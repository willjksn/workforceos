# Schema Specification

Status: Phase 9 Scout + SkillBridge operations  
Implementation: `db/schema/`  
Migrations: `drizzle/`

## Physical rules

- PostgreSQL on Neon
- Drizzle ORM schema modules, not a single giant file
- UUID primary keys
- `timestamptz` timestamps
- Index every foreign key
- Unique constraints on natural uniqueness (Clerk user id, pool membership pair, candidate-job match pair)
- `ON DELETE` is intentional:
  - Organizations are not cascade-deleted
  - Junction rows may cascade when their parents are hard-deleted
  - Operational records prefer archive over delete
- Extensions: `vector`, `pg_trgm`

## Module files

| Path | Contents |
| --- | --- |
| `db/schema/enums.ts` | Postgres enums |
| `db/schema/core.ts` | organizations, users, roles, user_roles, agents, system_settings |
| `db/schema/system/` | audit, approvals, files, privacy deletion requests, rate-limit buckets, requirements, decision log, semantic documents |
| `db/schema/crm/` | companies through opportunities and opportunity_scores |
| `db/schema/talent/` | candidates and pools |
| `db/schema/recruiting/` | jobs, job_skills, matches, screenings, search_projects, submissions, interviews, offers, placements, placement_guarantees |
| `db/schema/military/` | occupations, installations, mappings, bridge training, translations, occupation data imports |
| `db/schema/workforce/` | canonical `skills` / `civilian_occupations` / `occupation_skills`, plus Phase 5 planning tables |
| `db/schema/services/` | services, versions, workflow definitions, workflows, discoveries, solution plans, proposals |
| `db/schema/projects/` | project templates, delivery projects, phases, tasks, deliverables, risks, issues, KPIs, closeout, expansion |
| `db/schema/legal/` | templates, contracts, e-sign envelopes, legal packages |
| `db/schema/finance/` | billing schedules, billing events, invoices, payments, revenue events, cost entries, adjustments |
| `db/schema/integrations/` | integration hub, external records, webhook receipts, enrichment reviews, workspace references |
| `db/schema/ai/` | agent runs/outputs, prompt versions, model configs, knowledge records, automation, handoffs, usage, circuit breakers, meeting extractions |
| `db/schema/operating/` | activities, candidate_engagements, candidate_designations, saved views, in-app notifications |
| `db/schema/scout/` | scout_sessions, scout_messages, scout_actions |
| `db/schema/skillbridge/` | profiles, preferred locations, target roles, opportunities, stage history, notes, documents, alert rules |

## Key uniqueness rules

- A candidate is stored once and reused across clients and jobs.
- `candidate_talent_pools` unique on `(candidate_id, talent_pool_id)`.
- `candidate_job_matches` unique on `(candidate_id, job_id)`.
- `military_civilian_mappings` unique on `(military_occupation_id, civilian_occupation_id)`.
- `skillbridge_profiles` unique on `candidate_id`.
- Do not duplicate a candidate per requisition, SkillBridge employer, or as a separate military database.

## Phase 3 schema notes

- Migration `drizzle/0002_fancy_pretty_boy.sql` extends jobs, matches, search projects, interviews, and military provenance. It adds `candidate_screenings`, `placement_guarantees`, `bridge_training_recommendations`, `candidate_military_translations`, and `occupation_data_imports`.
- `candidate_pipeline_status` keeps legacy values (`sourced`, `screened`, `interviewing`, `offered`, `declined`) and adds Phase 3 stages. Application code normalizes legacy values.
- Job status includes `search_active`. Internal search timestamps live on both `jobs` and `search_projects`.
- Mapping review uses `pending | approved | rejected | needs_review`. Agent-origin rows start pending.

## Phase 4 schema notes

- Migration `drizzle/0003_vengeful_tyger_tiger.sql` adds discovery, proposal, contract, project-template, deliverable, risk/issue, billing, and expansion tables. It extends `service_versions`, `service_workflows`, `solution_plans`, `projects`, and `project_tasks`.
- `project_status` adds `at_risk`. `task_status` adds `not_started`, `waiting_client`, and `review` while keeping `pending`.
- `projects.contract_id` is stored without a Drizzle circular FK to `contracts`; `contracts.project_id` is the declared foreign key.
- Delivery `projects` are distinct from recruiting `search_projects`.

## Phase 5 schema notes

- Migration `drizzle/0004_melted_stryfe.sql` adds workforce assessments, roles, baselines, forecasts, supply, gaps, pipelines, education/training, career paths, skills-gap analyses, scenarios, recommendations, pipeline plans, KPIs, risks, labor-market metadata/observations, and geographies. Do not rewrite `0000`–`0003`.
- `skills.skill_family` is a column on the existing skills table. Do not add a second skills taxonomy.
- `workforce_roles` are planning-level and optional-linked to `civilian_occupations`. They are not recruiting `jobs`.
- Intelligence tables carry provenance: source, source date/version, internal assumption, analyst override, model, confidence, reviewer, generated at, data quality, fixture flag.
- `workforce_assessments` unique on `(company_id, version_number)`. Forecasts unique on `(assessment_id, version_number, horizon_months)`.
- `skills_gap_analyses.candidate_id` is a UUID without a Drizzle FK to avoid a circular `workforce` ↔ `talent` import.
- Approved roadmap items write `project_tasks` on existing delivery `projects`. There is no parallel workforce project table.

## Phase 6 schema notes

- Migration `drizzle/0005_unknown_satana.sql` expands `billing_schedules` and `billing_events` and adds `invoices`, `payments`, `revenue_events`, `finance_cost_entries`, `finance_adjustments`, `contract_billing_terms`, `occupation_alternate_titles`, `enrichment_reviews`, `integration_webhook_receipts`, and `workspace_event_references`. Do not rewrite `0000`–`0004`.
- QuickBooks, DocuSign, and Apollo IDs map through `external_records`. Do not add provider-specific IDs to core finance tables.
- Placement fee and milestone amounts come from stored search agreements / `contract_billing_terms`. The application does not invent commercial terms.

## Phase 7 schema notes

- Migration `drizzle/0006_mushy_iron_lad.sql` expands `agents`, `agent_runs`, `agent_outputs`, and `semantic_documents`, and adds prompt versions, model configs, knowledge records, automation rules, agent handoffs, usage events, circuit breakers, and meeting extractions. Do not rewrite `0000`–`0005`.
- Approved `prompt_versions` are immutable. Changes create a new version.
- Knowledge retrieval applies privacy class and required permission before returning content. Knowledge records do not store Restricted candidate PII.
- Automation is a closed named-ruleset (`automation_rules`), not a general-purpose workflow builder.

## Phase 8 schema notes

- Migration `drizzle/0007_chemical_quasar.sql` adds `privacy_deletion_requests`, `rate_limit_buckets`, `users.last_login_at`, `candidates.privacy_deleted_at`, `files.retention_until`, and composite indexes for reports/alerts. Do not rewrite `0000`–`0006`.
- Privacy deletion is not a foreign key from `privacy_deletion_requests.candidate_id` to `candidates` (avoids a circular schema import). Application code scopes by organization.
- Reports reuse `saved_views` with module `reports:{category}`. There is no separate BI schema.

## Phase 9 schema notes

- Migration `drizzle/0008_cooing_blade.sql` adds Scout session/message/action tables, SkillBridge operating tables, and `in_app_notifications`. Do not rewrite `0000`–`0007`.
- Scout command family is a Postgres enum matching the closed registry. Unknown commands never persist as executable actions.
- SkillBridge filtered fields (status, window dates, location, occupation, owner, resume status, opportunity stage) are relational columns. JSONB is limited to Scout DTO/result payloads.
- Resume files stay in object storage via `files` + `skillbridge_documents`.

## Semantic search

`semantic_documents.embedding` uses a temporary development dimension of 1536 until a production embedding model is selected. See DECISION_LOG `DEC-SEM-001`.

## Search indexes

pg_trgm GIN indexes on:

- company names
- candidate names
- candidate current title
- job titles
- civilian occupation titles/codes
- military occupation titles/codes

## Migration process

1. Change Drizzle schema files.
2. `npm run db:generate`
3. Review SQL.
4. `npm run db:migrate`
5. Update DATA_DICTIONARY if meaning changed.
6. Add or adjust tests.

Do not apply raw production SQL outside migrations unless an emergency runbook says otherwise.
