# Data Dictionary

Status: Phase 10 careers, ATS, and onboarding  
Schema source of truth: [SCHEMA_SPEC.md](./SCHEMA_SPEC.md) and `db/schema/`.

## Conventions

- UUID primary keys on important records
- `timestamptz` for timestamps
- Foreign keys indexed
- Many-to-many via junction tables
- Soft-delete/archive via `archived_at` on operational records
- Candidate privacy deletion is a separate controlled process
- JSONB only for non-queryable payloads such as audit snapshots and provider-specific metadata that is not routinely filtered

## Privacy classes

| Class | Examples |
| --- | --- |
| Public | Published service catalog names |
| Internal | Company CRM operating data |
| Confidential | Legal packages, finance operating records |
| Restricted PII | Candidates and candidate-derived personal data |

## Core identity

| Table | Purpose |
| --- | --- |
| `organizations` | Internal WorkforceOS tenant. Seed one firm organization. Do not store ownership percentages. |
| `users` | Local application users mapped from Clerk. Authoritative status and identity for authorization. `last_login_at` is updated on Clerk sync. |
| `roles` | Named roles such as Managing Partner and Recruiter. |
| `user_roles` | Many-to-many user/role assignments. |
| `agents` | Registered AI agents with autonomy level and cost limits. Default was disabled in earlier phases; Phase 7 enables the approved registry. |

## Platform

| Table | Purpose |
| --- | --- |
| `audit_events` | Append-only business change history. |
| `approvals` | Generic human approval requests. |
| `agent_runs` | Execution instances with task, workflow, model, cost, review state, and errors. |
| `agent_outputs` | Drafts/recommendations with provenance, missing data, assumptions, and review category. |
| `prompt_versions` | Versioned agent prompts. Approved rows are immutable. |
| `ai_model_configs` | Provider/model/task configuration, limits, timeout, and fallback. |
| `knowledge_records` | Approved institutional knowledge (playbooks, methodology, lessons). |
| `automation_rules` | Named event-driven automation rules. |
| `automation_rule_runs` | Automation executions. |
| `agent_handoffs` | Visible agent-to-agent handoffs. |
| `ai_usage_events` | Token/cost ledger. Optional `model_tier`, `web_search_calls`, and `tavily_requests` columns (migration `0010`). |
| `research_sessions` | External research run metadata (query, providers, cost). Created with hiring tables in `0010` because the schema was already registered when that migration was generated. |
| `external_research_results` | Sourced research rows tied to a research session. Not a second system of record. |
| `research_cache` | Short-lived provider response cache keyed by query. |
| `ai_circuit_breakers` | Repeated-failure circuit breakers. |
| `meeting_extractions` | Meeting intelligence drafts pending human approval. |
| `files` | Object-storage metadata only. Binaries are not stored in PostgreSQL. Public application resumes use `StorageProvider` with `privacy_class=restricted_pii`. `retention_until` supports later deletion jobs. |
| `privacy_deletion_requests` | Controlled candidate privacy deletion (anonymize Restricted PII). Distinct from `archived_at`. |
| `rate_limit_buckets` | Per-key request windows for AI, export, search, webhook, and auth-sensitive actions. |
| `integration_connections` | Provider connection configuration status. |
| `external_records` | Maps external provider records to WorkforceOS records. |
| `integration_events` | Integration sync/lookup activity. |
| `integration_webhook_receipts` | Idempotent webhook receipts. Unsigned payloads are rejected. |
| `enrichment_reviews` | Review-gated Apollo (and similar) enrichment. Approved CRM fields are not overwritten silently. |
| `workspace_event_references` | Calendar/meeting/email references. Not a second inbox. |
| `requirements` | Locked and evolving product requirements. |
| `decision_log` | Architectural decisions. |
| `system_settings` | Seed/version metadata. |
| `semantic_documents` | Embeddings for later semantic search. |

## CRM

| Table | Purpose |
| --- | --- |
| `companies` | Prospect/client companies. Operating size fields (`employee_count`, `annual_revenue`) are not ownership data. |
| `company_locations` | Company sites. |
| `contacts` | People at companies. First-class records, not nested-only. |
| `company_contacts` | Company/contact relationships. |
| `opportunity_signals` | Workforce or commercial signals with review status and optional resulting opportunity. |
| `opportunities` | Commercial opportunities with stage, service, and stored score/band. |
| `opportunity_scores` | 100-point component scores and optional human override. |

## Skills and occupations

| Table | Purpose |
| --- | --- |
| `skills` | Canonical skills. `skill_family` classifies technical, leadership, business, digital, and safety/compliance skills. There is no second taxonomy. |
| `civilian_occupations` | Civilian occupation records with O\*NET source fields. |
| `occupation_skills` | Occupation-to-skill links. |

## Talent

| Table | Purpose |
| --- | --- |
| `candidates` | Permanent Talent CRM people. Restricted PII. Not requisition-specific duplicates. `privacy_deleted_at` marks anonymization (not ordinary archive). |
| `candidate_experiences` | Work history. |
| `candidate_skills` | Candidate skill links with optional proficiency and verification. |
| `talent_pools` | Static or dynamic pools, including user-scoped watchlists. |
| `talent_pool_rules` | Rules for dynamic pools. |
| `candidate_talent_pools` | Many-to-many membership. |
| `candidate_designations` | Job-agnostic designations such as silver medalist. |
| `candidate_engagements` | Outreach/engagement history. |

## Operating

| Table | Purpose |
| --- | --- |
| `activities` | Notes, calls, meetings, and follow-ups linked to CRM or talent records. |
| `saved_views` | User-owned list filters and column sets. |
| `in_app_notifications` | User-visible operating alerts that point at source records. Not a second inbox. |

## Recruiting

| Table | Purpose |
| --- | --- |
| `jobs` | Requisitions/search assignments with operational intake fields, internal-search timestamps, and activity. |
| `job_skills` | Canonical skill requirements (`required`, `preferred`, `nice_to_have`) with years, weight, and human verification. |
| `candidate_job_matches` | Job-specific component scores, strengths/gaps, provenance, pipeline stage, and human review. Unique on `(candidate_id, job_id)`. |
| `candidate_screenings` | Structured, job-related screening notes for a match. |
| `search_projects` | Internal-first search containers with strategy, fee, and guarantee terms from the search agreement. |
| `submissions` | Recruiter-prepared client packets. Human approval required before client submission. |
| `interviews` | Interview history. Multiple interviews per candidate/job are retained. |
| `offers` | Recorded offers. The system does not send or auto-negotiate offers. |
| `placements` | Placement records with fee/guarantee copied from search-agreement terms. Billing is a queued hook only. |
| `placement_guarantees` | Guarantee windows calculated from agreement days. |

## Military

| Table | Purpose |
| --- | --- |
| `military_occupations` | MOS, ratings, AFSC, and related classifications with source/version. |
| `candidate_military_experiences` | Candidate military history linked to a Talent Network candidate. |
| `candidate_military_translations` | Candidate-specific translations pending human review. |
| `military_occupation_skills` | Occupation skill links through the canonical skills taxonomy. |
| `military_installations` | Bases/installations with optional sourced coordinates and `coordinate_source`. |
| `military_occupation_installations` | Likely presence mappings with why/confidence/review/provenance. |
| `military_civilian_mappings` | Military-to-civilian translations, including reverse search, provenance, and review status. |
| `bridge_training_recommendations` | Skill-gap and credential recommendations. Do not promise employment. |
| `occupation_data_imports` | Repeatable importer run log. Approved mappings are not silently deleted. |
| `skillbridge_profiles` | One SkillBridge overlay per Talent Network candidate (unique `candidate_id`). Window, EOS, occupation, location, resume status, owner. Not a second person table. |
| `skillbridge_preferred_locations` | Junction of preferred locations for filtering. |
| `skillbridge_target_roles` | Junction of civilian target roles. |
| `skillbridge_opportunities` | Many-to-many candidate–employer SkillBridge pipeline rows with stage. |
| `skillbridge_opportunity_stage_history` | Prior stages retained; current stage lives on the opportunity. |
| `skillbridge_notes` | Operating notes on a profile/opportunity. Timeline also reuses `activities`. |
| `skillbridge_documents` | Metadata links to `files` (resume/certs). No binaries in PostgreSQL. Resume status is missing/outdated/current/needs_review. |
| `skillbridge_alert_rules` | Configurable follow-up, window, no-opportunity, employer-feedback, resume, and conversion thresholds. |

## Scout

Chat history is not the system of record.

| Table | Purpose |
| --- | --- |
| `scout_sessions` | Per-user Scout drawer sessions with explicit page path/module/entity context. |
| `scout_messages` | User/Scout/system messages plus parsed command family and DTO payload. |
| `scout_actions` | Proposed/executed Scout commands. Material writes stay `proposed` until human confirmation. |

## Workforce planning (Phase 5)

Workforce roles are planning-level. They do not duplicate recruiting `jobs`. Forecasts, gaps, and scenarios are versioned estimates with provenance and are never presented as certain. Delivered assessments are not overwritten.

| Table | Purpose |
| --- | --- |
| `workforce_assessments` | Client workforce assessment versions. Unique on `(company_id, version_number)`. |
| `workforce_roles` | Planning-level occupations/job families for a client. May link to a canonical civilian occupation. |
| `workforce_role_skills` | Role skill requirements through the canonical `skills` table. |
| `workforce_baselines` | Headcount, vacancies, attrition, retirement, and related assumptions. |
| `workforce_forecasts` / `workforce_forecast_results` / `workforce_forecast_components` / `workforce_forecast_overrides` | Versioned 12/24/36-month demand models with configurable components and audited overrides. |
| `workforce_supply_entries` | Expected supply by source type (internal, military, education, Talent Network, recruiting). |
| `workforce_gaps` / `workforce_gap_thresholds` | Demand minus supply with stored severity thresholds. |
| `talent_scarcity_indicators` | Scarcity classification from available evidence; unknown/estimated/internal-only when labor-market APIs are unconfigured. |
| `talent_pipelines` / `talent_pipeline_allocations` | Pipeline strategy and gap allocation across sources. Warns when planned capacity is below the gap. |
| `education_partners` / `training_programs` / `apprenticeships` | Education and training planning records. Outcome rates are stored only when supplied. |
| `career_paths` / `career_path_levels` / `career_path_edges` | Sequential and lateral career pathways. |
| `skills_gap_analyses` | Individual, aggregate, or military-transition skill gap output. |
| `workforce_scenarios` / `workforce_scenario_inputs` / `workforce_scenario_outputs` | Planning scenarios. Not guaranteed forecasts. |
| `workforce_recommendations` | AI or analyst drafts. Client-facing use requires human approval. |
| `workforce_pipeline_plans` | Expanded Phase 4 WPA deliverable (PierOne HTML). Human approval before client delivery. |
| `workforce_roadmap_items` | 0–90 day through 12–24 month actions; may link to existing `project_tasks`. |
| `workforce_kpis` / `workforce_risks` | Stored KPI and risk records. Financial KPIs are omitted without source data. |
| `labor_market_source_metadata` / `labor_market_observations` | Integration Hub source status and labeled fixtures. Never invent BLS/Census/O\*NET values. |
| `workforce_geographies` | List/region geography. Interactive installation maps remain deferred to Phase 3.5. |

## Services and delivery

| Table | Purpose |
| --- | --- |
| `services` | Launch service catalog with practice area and pricing model. |
| `service_versions` | Approved versioned definitions. Never overwritten once approved. |
| `service_workflow_definitions` | Workflow metadata: discovery inputs, legal package, project template, billing and completion rules. |
| `service_workflows` | Ordered, versioned steps agents must follow. |
| `discoveries` | Service-specific discovery tied to company, opportunity, and recommended service. |
| `solution_plans` | Client-specific plans tied to a service version, with pricing and provenance. |
| `proposals` | Client proposals generated from approved solution plans. |
| `proposal_versions` | Immutable history after a proposal is sent. |
| `legal_templates` | Structural legal templates. Not attorney-authoritative by default. |
| `contracts` | Service-specific contract packages and execution status. |
| `contract_billing_terms` | Stored milestone/fee terms. Amounts are never invented in finance code. |
| `esign_envelopes` | E-sign provider abstraction (DocuSign-ready; manual execution in Phase 4). |
| `legal_packages` | Legal document records linked to services, engagements, and contracts. |
| `project_templates` | Delivery templates tied to a service workflow. Distinct from `search_projects`. |
| `projects` | Delivery projects created from plan + workflow + contract. |
| `project_phases` | Project phases. |
| `project_tasks` | Tasks generated from templates/plans. |
| `project_deliverables` | Explicit deliverable records. Client-facing rows require human approval. |
| `project_risks` / `project_issues` | Delivery risk and issue tracking. Material open risks keep a project at risk. |
| `project_meetings` | Cadence meetings for delivery projects. |
| `project_kpis` | Stored KPI values only; never fabricated. |
| `billing_schedules` / `billing_events` | Operational billing triggers expanded in Phase 6. Not the QuickBooks ledger. |
| `revenue_events` | Operational revenue triggers (start, milestone, monthly, deposit). |
| `invoices` / `payments` | Invoice expectations, balances, and payment references. Provider IDs map through `external_records`. |
| `finance_cost_entries` / `finance_adjustments` | Optional delivery costs and approved write-offs, fee overrides, and schedule changes. |
| `expansion_recommendations` | Suggested follow-on services. Human review required before creating revenue opportunities. |
| `project_closeouts` | Closeout snapshot, lessons, and knowledge capture. |
| `job_requisitions` | Formal headcount request. Approval uses the existing `approvals` table. |
| `job_description_versions` | Versioned JD content. AI-generated rows need human approval before public publish. |
| `job_postings` | Public/unlisted posting projection of a job. Never the confidential source of truth. |
| `applications` | Candidate↔Job application. Not a person record. |
| `application_answers` / `application_stage_history` | Normalized answers and immutable stage history. |
| `interview_plans` / `interview_scorecards` | Reusable interview stages and interviewer feedback. |
| `background_checks` / `drug_screens` | Provider-neutral pre-employment rows. Restricted. |
| `offers` | Existing recruiting offers plus `application_id` and `version`. |
| `employees` | Employment bridge to `candidate_id`. Not payroll. |
| `onboarding_templates` / `onboarding_instances` / `onboarding_tasks` | New-hire checklists. |
| `transactional_email_events` | Resend/mock send log. |
| `website_inquiries` | Public employer intake from pieronepartners.com. Not an automatic opportunity. |
| `public_intake_settings` | Role-based owner assignment for website inquiries, military talent, and application notifications. No hardcoded person IDs. |
| `public_content_items` | Lightweight public operational content: featured jobs, SkillBridge features, banners, notices, announcements, industry campaigns. Not a CMS. Featured rows FK to `jobs`. Active state is computed at read time. |

## Explicitly excluded

Ownership percentages, cap-table records, payroll, and temp-staffing assignment engines are not part of this dictionary.
