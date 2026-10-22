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
| `users` | Local application users mapped from Clerk. Authoritative status and identity for authorization. `last_login_at` is updated on Clerk sync. `organizational_title` is display-only and is never used for authorization (DEC-AUTH-002). `manager_id` is a nullable self-FK to `users.id` (indexed; `ON DELETE SET NULL`; check constraint forbids self-manager). |
| `roles` | Access bundles: job-shaped **templates** (e.g. Recruiter Standard) and **functional modules** (e.g. Finance, Military Talent). Not job titles. A person may hold many. Only `admin.roles` assigns them (DEC-AUTH-003). |
| `user_roles` | Many-to-many user/access-bundle assignments. A person may hold zero or more bundles. |
| `user_permission_overrides` | Optional per-user grant or deny after the bundle union. Unique on `(user_id, permission_id)`. Deny wins over grant. |
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
| `user_training_progress` | Lightweight Academy completion (`user_id`, `module_slug`, `status`, timestamps). Unique on `(user_id, module_slug)`. Required vs Not Required is computed from effective permissions in code, not stored here. Completion does not grant permissions. Not an LMS. PierOne staff cadence lives in `staff_onboarding`, not this table. |
| `staff_onboarding` | PierOne employee Day 1–Week 4 cadence. Unique on `user_id`. Created at Admin invite with cadence `day_1`. Distinct from ATS hire `onboarding_instances`. Week 4 review timestamps do not grant permissions. Organizations are not cascade-deleted. |
| `staff_onboarding_equipment` | Lightweight systems checklist (laptop, Clerk login, email, WorkforceOS access). Unique on `(onboarding_id, item_key)`. Not a procurement system. |
| `staff_policy_acknowledgements` | Timestamped staff policy acknowledgements (at least `security_candidate_privacy`). Unique on `(user_id, policy_key)`. Not a legal CMS. |

## CRM

| Table | Purpose |
| --- | --- |
| `companies` | Prospect/client companies. Operating size fields (`employee_count`, `annual_revenue`) are not ownership data. Optional `gtm_tier` (`tier_1` / `tier_2`) and `gtm_region` (`southeast` / `national`) mark the 90-day target-account list. Not a second accounts table. |
| `company_locations` | Company sites. |
| `contacts` | People at companies. First-class records, not nested-only. `UNIQUE (id, organization_id)` lets recruiting routes reference a contact inside the same organization. Relationship strength and owner stay on this row. A manually entered public business contact is still a CRM contact. |
| `company_contacts` | Company/contact relationships. |
| `opportunity_signals` | Workforce or commercial signals with review status and optional resulting opportunity. |
| `opportunities` | Commercial opportunities with stage, service, and stored score/band. |
| `opportunity_scores` | 100-point component scores and optional human override. |

## Skills and occupations

| Table | Purpose |
| --- | --- |
| `skills` | Canonical civilian capabilities. `skill_family` is the category. Optional `competency_cluster_id`, `description`, `source`, and `source_version`. O\*NET fields stay `onet_source` / `onet_version`. The same skill can be a candidate capability, a workforce role requirement, a gap, and later a match input. There is no second taxonomy. |
| `competency_clusters` | Lightweight skill grouping: Electrical/Electronics, Maintenance & Reliability, Operations, Supply Chain & Logistics, Cyber/IT, Leadership & Supervision, Program/Project Management, Safety/Compliance. Not a skill list. |
| `skill_aliases` | Alternate labels for one skill. |
| `job_families` | Employer-neutral families such as Supply Chain, Logistics, and Electrical Maintenance. Not an employer mapping. Does not replace free-text `job_family` columns. |
| `civilian_occupations` | Civilian occupation records with O\*NET source fields. |
| `civilian_occupation_job_families` | Occupation-to-job-family links. |
| `occupation_skills` | Occupation-to-skill links. |

## Talent

| Table | Purpose |
| --- | --- |
| `candidates` | Permanent Talent CRM people. Restricted PII. Not requisition-specific duplicates. `privacy_deleted_at` marks anonymization (not ordinary archive). Compensation expectations, career interests, relocation, remote preference, military status, and the resume file stay here. `UNIQUE (id, organization_id)` is the tenant target for person-scoped evidence. |
| `candidate_experiences` | Civilian or general work history. |
| `candidate_skills` | One row per candidate and skill. Proficiency, source, confidence, `human_verified`, `capability_basis` (`explicit`, `reference_supported`, `inferred`), and `mapping_review_status`. `source = capability_translation` is an M3 draft and is excluded from M2 matching. Organization matches the candidate. |
| `candidate_education` | Person-level institution, degree or credential, field of study, completion, source, and human verification. Military and non-military candidates. Not `education_partners`. |
| `candidate_credentials` | Person-level name, issuer, credential id, dates, and status. Recruiter-visible. No verification service in M2. |
| `candidate_clearances` | Current clearance level, reported status, last known active date, source, and human verification. One row per candidate. Not an independent Pier 24 verification. |
| `talent_pools` | Static or dynamic pools, including user-scoped watchlists. |
| `talent_pool_rules` | Rules for dynamic pools. |
| `candidate_talent_pools` | Many-to-many membership. |
| `candidate_designations` | Job-agnostic designations such as silver medalist. |
| `candidate_engagements` | Touchpoint log for a candidate: channel, direction, summary, and follow-up. It is not the current routing state. M6 writes a note here when a person records a send or a response, and keeps the operational state on `opportunity_engagements`. |

## Operating

| Table | Purpose |
| --- | --- |
| `activities` | Notes, calls, meetings, and follow-ups linked to CRM or talent records. |
| `saved_views` | User-owned list filters and column sets. |
| `in_app_notifications` | User-visible operating alerts that point at source records. Not a second inbox. |

## Recruiting

| Table | Purpose |
| --- | --- |
| `jobs` | Employer demand. A client search, monitored public posting, exploratory need, evergreen role (`demand_horizon`), or future workforce need. `job_context_type` is `internal`, `client`, `skillbridge`, `monitored_public`, or `exploratory`. SkillBridge-eligible and direct-hire demand use `skillbridge_eligible`, not extra context values. `authorized_employer_route` is a human record that Pier24 may route talent to a reviewer. It defaults false. A company row or a hiring-manager contact does not set it. Public and exploratory jobs cannot use authorized routing until it is true. Optional `career_source_id`, `external_key`, `source_url`, `content_hash`, `closed_at`, `last_observed_at`, and `public_compensation_text` identify externally sourced demand. Manual jobs leave the source fields empty. Unique `(career_source_id, external_key)` allows multiple rows with nulls. A sourced job must use the same company as its career source. Closing a missing posting sets `status` and `closed_at`. The row stays readable. This is not a CRM pursuit. |
| `career_sources` | Tenant-scoped registry of where an employer's public demand originates (`public_careers_page`, `feed`, `employer_api`, `manual_url`, `csv`). Name, URLs, active flag, optional public `adapter_key`, `health_status` (`not_yet_synced`, `live`, `manual`, `error`, `blocked`), last attempt, last success, last error, and last discovered count. No credentials. `(company_id, organization_id)` references `companies (id, organization_id)`. `live` is only a complete Greenhouse sync. A source that has never succeeded stays `not_yet_synced`. |
| `career_source_sync_runs` | One discovery attempt for a career source. Counts new, changed, unchanged, closed, and error rows. `listing_complete` is false for CSV, manual URL, truncated listings, and failed runs. A failed run does not mean the jobs were closed. `(career_source_id, organization_id)` references `career_sources (id, organization_id)`. |
| `job_skills` | Canonical skill requirements (`required`, `preferred`, `nice_to_have`) on `skills`. Source, source text, review, confidence, and reviewer record where the requirement came from. Existing rows are approved recruiter entry. Pending drafts do not affect matches. |
| `job_requirements` | Non-skill requirements for one job: credential, education, clearance, experience, location, workplace, travel, license, job family, or occupation. Each row stores its source and source text. Unique on `(job_id, kind, label)`. Composite `(job_id, organization_id)` references `jobs`. |
| `candidate_job_matches` | One recommendation for a candidate and a job. Unique on `(candidate_id, job_id)`. Organization is the candidate's organization and must match the job. Category, freshness, input hash, explanation, and recruiter disposition sit beside the legacy component columns. Disposition does not change the calculated category. |
| `candidate_job_match_factors` | Aligned capabilities, documented gaps, unknowns, preferred gaps, and evidence for one match. Replaced when that match is recalculated. |
| `candidate_screenings` | Structured, job-related screening notes for a match. |
| `search_projects` | Internal-first search containers with strategy, fee, and guarantee terms from the search agreement. |
| `submissions` | Formal candidate submission against a client job. Human approval is required before that packet is treated as submitted. A talent review and public employer outreach are not submissions. |
| `interviews` | Interview history. Multiple interviews per candidate/job are retained. |
| `offers` | Recorded offers. The system does not send or auto-negotiate offers. |
| `placements` | Placement records with fee/guarantee copied from search-agreement terms. Billing is a queued hook only. |
| `placement_guarantees` | Guarantee windows calculated from agreement days. |
| `opportunity_engagements` | One operational record for a reviewed match: candidate, job, employer, owner, mode (`authorized_routing` or `public_outreach`), and workflow status. Unique on `match_id`. Match category stays on `candidate_job_matches`. Composite foreign keys keep the match, candidate, job, company, and current contact in the same organization. Queue reads use `(organization_id, status, owner_user_id, next_follow_up_at)`. |
| `opportunity_engagement_routes` | One routing or outreach attempt. A referral inserts the next row and leaves the earlier response in place. Kinds are `talent_review`, `employer_outreach`, and `referral`. |
| `opportunity_engagement_messages` | Draft or delivery record for one route: channel, recipient label, subject, template, delivery state, actor, and timestamps. Delivery states are `draft`, `copied`, `manual_sent`, `sent`, `failed`, and `not_configured`. |
| `opportunity_engagement_events` | Append-only workflow history for one engagement. Passive reads are not written here. |

## Military

| Table | Purpose |
| --- | --- |
| `military_occupations` | MOS, ratings, AFSC, and related classifications with source/version. |
| `candidate_military_experiences` | Tour history for one Talent Network candidate: occupation, rank, pay grade, unit, leadership scope, and legacy narrative text for duties, platforms, training, certifications, and historical clearance. `organization_id` matches the candidate. |
| `candidate_military_duties` | Structured duty evidence for one tour. Source and `human_verified` separate recruiter-entered evidence from resume or AI suggestions. Composite foreign key shares `organization_id` with the tour. |
| `candidate_military_equipment` | Structured platform, system, equipment, or tool evidence for one tour. Not a global skill. Tenant-safe composite foreign key. |
| `candidate_military_training` | Schools and training categories for one tour. The legacy `training` text on the tour remains. Not a learning system. |
| `candidate_military_translations` | Candidate-specific narrative translations pending human review. Not the capability library. |
| `candidate_skill_evidence` | Why a candidate skill exists: duty, equipment, training, credential, clearance, leadership, resume skill, recruiter entry, or an occupation mapping. Composite foreign keys keep person evidence in one organization. A citation is required. |
| `military_occupation_skills` | Reference occupation-to-skill links through `skills`. Source, evidence reference, confidence, review status, reviewer, origin, agent, and mapping quality. Not person-specific evidence. Existing rows were backfilled pending and `development_fixture`, not auto-approved. |
| `military_installations` | Bases/installations with optional sourced coordinates and `coordinate_source`. |
| `military_occupation_installations` | Likely presence mappings with why/confidence/review/provenance. |
| `military_civilian_mappings` | Military-to-civilian translations, including reverse search, provenance, and review status. |
| `bridge_training_recommendations` | Skill-gap and credential recommendations. Do not promise employment. |
| `occupation_data_imports` | Repeatable importer run log. Approved mappings are not silently deleted. |
| `skillbridge_profiles` | Transition Talent Profile overlay on a Talent Network candidate (unique `candidate_id`). Physical table name retained. Separation, ETS, EAOS, availability, SkillBridge pathway dates and approval, transition location and relocation, target industry and employer, career priorities, owner, and follow-up. Rank and occupation columns are the current display snapshot. Not a second person table. `(candidate_id, organization_id)` references `candidates (id, organization_id)`. |
| `skillbridge_preferred_locations` | Transition Profile preferred locations. Physical table name retained. |
| `skillbridge_target_roles` | Transition Profile target roles. Free-text title, optional `civilian_occupation_id`, and optional `job_family` text. Not a matcher. |
| `skillbridge_opportunities` | Employer / host-company opportunities: many-to-many candidate–employer pipeline rows with stage. SkillBridge-eligible is an opportunity type, not PierOne program ownership. |
| `skillbridge_opportunity_stage_history` | Prior stages retained; current stage lives on the opportunity. |
| `skillbridge_notes` | Operating notes on a profile/opportunity. Timeline also reuses `activities`. |
| `skillbridge_documents` | Metadata links to `files` (resume/certs). No binaries in PostgreSQL. Resume status is missing/outdated/current/needs_review. |
| `skillbridge_alert_rules` | Configurable follow-up, window, starting/ending-soon, no-opportunity, employer-feedback, resume, and conversion thresholds. Operator-editable. |

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
| `workforce_roles` | Planning-level demand for a client. Quantity, horizon, source, clearance, and optional `job_family_id`. Not a live `jobs` row. Free-text `job_family` stays until a person normalizes it. |
| `workforce_role_skills` | Role capability demand through canonical `skills`. `quantity_affected` is optional. |
| `workforce_role_jobs` | Links one workforce role to zero or more canonical jobs inside the same organization. A closed job stays linked and is not a current opening. |
| `workforce_role_capability_texts` | Free-text capability demand owned by its workforce role. Pending until a person links a global skill. Reviewer identity is service-checked, not a composite user key. |
| `workforce_strategy_notes` | Human pipeline-strategy notes. The database requires the role, assessment, and education partner to share the note's organization. Saving a note does not create a campaign, program, or enrollment. The author stays a service-checked user reference. |
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
| `job_description_versions` | Versioned JD content. Sourced postings store `content_hash`, `source_url`, and `external_key` on the version so a later reader can see what the public posting said. AI-generated rows need human approval before public publish. M4 source snapshots use status `source_recorded` and are not model output. |
| `job_postings` | Public/unlisted posting projection of a job. Never the confidential source of truth. |
| `applications` | Candidate↔Job application. Not a person record. |
| `application_answers` / `application_stage_history` | Normalized answers and immutable stage history. |
| `interview_plans` / `interview_scorecards` | Reusable interview stages and interviewer feedback. |
| `background_checks` / `drug_screens` | Provider-neutral pre-employment rows. Restricted. |
| `offers` | Existing recruiting offers plus `application_id` and `version`. |
| `employees` | Employment bridge to `candidate_id`. Not payroll. |
| `onboarding_templates` / `onboarding_instances` / `onboarding_tasks` | New-hire checklists. Distinct from PierOne staff Academy onboarding. |
| `public_access_tokens` | Hashed tokens for interview self-schedule, hire onboarding (`/onboarding/access`), and read-only application status. Not a client SaaS login. |
| `report_export_schedules` / `report_export_jobs` | Operator-scheduled non-PII CSV jobs. Not a BI platform. |
| `transactional_email_events` | Resend/mock send log. |
| `website_inquiries` | Public employer intake from pieronepartners.com. Not an automatic opportunity. |
| `public_intake_settings` | Role-based owner assignment for website inquiries, military talent, and application notifications. No hardcoded person IDs. |
| `public_content_items` | Lightweight public operational content: featured jobs, SkillBridge features, banners, notices, announcements, industry campaigns. Not a CMS. Featured rows FK to `jobs`. Active state is computed at read time. |

## Explicitly excluded

Ownership percentages, cap-table records, payroll, and temp-staffing assignment engines are not part of this dictionary.
