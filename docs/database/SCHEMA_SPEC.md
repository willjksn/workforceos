# Schema Specification

Status: Implemented through Phase K GTM company columns (`drizzle/0010`–`0016`)  
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
| `db/schema/core.ts` | organizations, users, roles, user_roles, user_permission_overrides, agents, system_settings |
| `db/schema/system/` | audit, approvals, files, privacy deletion requests, rate-limit buckets, requirements, decision log, semantic documents |
| `db/schema/crm/` | companies through opportunities and opportunity_scores |
| `db/schema/talent/` | candidates and pools |
| `db/schema/recruiting/` | jobs, job_skills, matches, screenings, search_projects, submissions, interviews, offers, placements, placement_guarantees, opportunity engagements |
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
| `db/schema/public-site/` | website_inquiries, public_intake_settings, public_content_items |
| `db/schema/academy/` | user_training_progress |
| `db/schema/staff/` | staff_onboarding, staff_onboarding_equipment, staff_policy_acknowledgements |

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

## Phase 10 hiring tables

Hiring tables are in `db/schema/hiring/` and `drizzle/0010_*`. Do not edit `0000`–`0009`. Index `applications.candidate_id`, `applications.job_id`, `applications.status`, `applications.current_stage`, `applications.applied_at`, posting slug, interview/offer `application_id`, and `employees.candidate_id`. Unique person identity stays on `candidates`.

## Phase C access model

- Migration `drizzle/0013_nervous_maggott.sql` adds `users.organizational_title` (nullable text, display only) and `user_permission_overrides` (`grant` / `deny`, unique on user + permission). Do not rewrite `0000`–`0012`.
- Organizations are not cascade-deleted. Override and `user_roles` rows cascade when a user or permission is hard-deleted.
- Role slug `military-talent-specialist` is renamed to `military-talent-partner` in the same migration. One-release code alias remains in `LEGACY_ROLE_SLUG_ALIASES`.

## Phase E Academy training progress

- Migration `drizzle/0014_rainy_doomsday.sql` adds `user_training_progress` (UUID PK, `user_id` FK to `users` with cascade on user delete, unique `(user_id, module_slug)`, timestamptz). It does not reference `organizations` and does not cascade-delete organizations.
- Required vs Not Required is not a stored column. It is computed from effective permissions in `lib/academy/training.ts`.
- Completion must not grant roles or permissions.

## Phase H PierOne staff onboarding

- Migration `drizzle/0015_dizzy_wrecker.sql` adds `users.manager_id` (nullable self-FK, `ON DELETE SET NULL`, indexed, check `users_manager_not_self`) and tables `staff_onboarding`, `staff_onboarding_equipment`, and `staff_policy_acknowledgements`.
- `staff_onboarding.organization_id` uses `ON DELETE restrict`. Do not cascade-delete organizations.
- These tables are not ATS hire `onboarding_instances` / `onboarding_tasks`.
- Completing Academy training or recording Week 4 review must not grant roles or permissions.

## Phase K 90-day GTM company columns

- Migration `drizzle/0016_lyrical_giant_girl.sql` adds nullable `companies.gtm_tier` (`tier_1` / `tier_2`) and `companies.gtm_region` (`southeast` / `national`) with org-scoped indexes. Do not rewrite `0000`–`0015`.
- These columns classify the existing Companies list. Do not add a parallel accounts table.
- `industry` remains the human label. Focus industries are a documented GTM list, not new services.

## Military + Workforce Core M1 employer demand

- Migration `drizzle/0018_m1_employer_demand.sql` is additive. It does not rewrite `0000`–`0017`.
- `drizzle/0019_m1_career_source_company_fk.sql` adds the tenant/company invariant. `0018` is unchanged because it is already applied on the development branch.
- `companies` has `UNIQUE (id, organization_id)`. `career_sources (company_id, organization_id)` references `companies (id, organization_id)` with `ON DELETE restrict`. A career source cannot name a company from another organization. The existing single-column company foreign key and the application check both remain.
- `career_sources` is organization-scoped. It stores source category, URLs, and sync timestamps. It does not store credentials. M4 adds the public adapter key, honest health, and sync runs described below.
- `jobs (career_source_id, organization_id)` references `career_sources (id, organization_id)`, so a job cannot attach another tenant's source. When `career_source_id` is set, `company_id` is required and `(career_source_id, organization_id, company_id)` must match that source. PostgreSQL skips that composite check when `career_source_id` is null, so a manual job stays valid with or without a company. `career_source_id` is indexed.
- Unique `(career_source_id, external_key)` rejects a duplicate external posting. Null pairs stay distinct, so manual jobs are unchanged.
- `jobs.demand_horizon` defaults to `current`. `evergreen` and `future` are horizons, not context types. Existing `internal`, `client`, and `skillbridge` context values remain valid. `monitored_public` and `exploratory` were added.
- `job_description_versions` remains the only description history.
- `skillbridge_profiles` stays the one-to-one Transition Talent Profile table. M1 does not rename it or add profile columns.

## Military + Workforce Core M2 Transition Talent Profile evidence

Field ownership for M2 (`DEC-PROD-002`). One candidate. One `skillbridge_profiles` row. Several `candidate_military_experiences` tours. No second person table. `education_partners` stay workforce-planning institutions.

| Field | Class |
| --- | --- |
| Name, contact, current city/region, person relocation, person remote preference, compensation expectations, broad career interests, resume file, consent/privacy, military status, last profile review | CANONICAL ON CANDIDATE |
| Current clearance (`candidate_clearances`) | CANONICAL ON CANDIDATE |
| Education (`candidate_education`) and credentials (`candidate_credentials`) | CANONICAL ON CANDIDATE |
| Tour branch and occupation via `military_occupations`, rank, pay grade, years, leadership scope, duty station, unit, historical clearance text, legacy duty/platform/training/certification narratives | CANONICAL ON MILITARY EXPERIENCE |
| Profile branch, rank, pay grade, and occupation display | CANONICAL ON TRANSITION PROFILE as the current snapshot. Tours win for history. |
| Separation, ETS, EAOS, end of service, retirement, availability, SkillBridge eligibility/approval/window, terminal leave, transition relocation, transition remote preference, target industry, target employer, career priorities, owner, status, next follow-up | CANONICAL ON TRANSITION PROFILE |
| Preferred locations, target roles, duties, equipment, training schools | CHILD TABLE |
| Profile completeness | DERIVED. Not stored. Not a score. |
| Match, rank, and rejection outcomes | DO NOT STORE on the profile. |
| Workforce `education_partners` as a person's school | DO NOT STORE |

- Migration `drizzle/0020_m2_transition_profile.sql` is additive. It does not rewrite `0000`–`0019`.
- `candidates UNIQUE (id, organization_id)` is the tenant target for profile, education, credential, clearance, and military-experience composite foreign keys.
- `candidate_military_experiences.organization_id` is backfilled from the candidate, then required. `UNIQUE (id, organization_id)` exists before duty, equipment, and training composite foreign keys. Those children cannot point at another organization's tour. Organization deletes stay `ON DELETE restrict`.
- Existing `platforms`, `training`, `certifications`, `clearance`, and `notes` text stays. M2 does not split ambiguous sentences into child rows.
- `skillbridge_target_roles.job_family` is optional text beside the existing free-text title and optional `civilian_occupation_id`. M2 did not add a job-family entity or a matcher. M3 adds `job_families` and does not replace this text.
- `skillbridge_profiles.career_priorities` is the current transition priority. `candidates.career_interests` stays the broad person interest.
- Resume apply still fills empty scalar fields only. Structured suggestions insert as `source = resume` and `human_verified = false`. Human-reviewed rows are not updated.

## Military + Workforce Core M3 capability translation

Canonical chain (`DEC-PROD-003`): military evidence → `skills` capability → civilian occupation and employer-neutral job family. Reference knowledge is not person evidence.

- Migration `drizzle/0021_m3_capability_translation.sql` is additive. It does not rewrite `0000`–`0020`. `candidate_skills.organization_id` is backfilled from the candidate before it is required. `UNIQUE (id, organization_id)` is created before `candidate_skill_evidence` references that pair.
- `capability_basis` classifies explicit, reference-supported, and inferred capabilities. Review state remains `mapping_review_status`. Human reviewed means `approved`. Needs evidence is stored as `needs_review`.
- `candidate_skill_evidence` requires a non-empty citation. Duty, equipment, training, credential, clearance, and leadership pointers use the parent `(id, organization_id)` unique keys. Occupation-mapping pointers reference global `military_occupation_skills`.
- `skills.skill_family` remains the category. `competency_clusters` is a lookup, not a second skill table. `skill_aliases` holds alternate labels.
- `job_families` and `civilian_occupation_job_families` are employer-neutral. `workforce_roles.job_family`, `skillbridge_target_roles.job_family`, and `job_requisitions.job_family` stay free text. `jobs` has no job-family column.
- Employer-facing translation reads `review_status = approved` only. M5 opportunity matching counts approved `capability_translation` rows and explicit skills that are not rejected. Pending, needs-review, and rejected translation rows do not increase a match. Scout skill search and workforce overlay counts still omit unapproved translation.
- The originating agent cannot approve. Material translation is audited on draft and review, not on read.

## Military + Workforce Core M4 opportunity discovery

Public flow: public employer source → `career_sources` → normalized `jobs` → `job_description_versions`. No employer ATS, CRM, HRIS, or SSO connection is required. CRM `opportunities` stay sales pursuits.

- Migration `drizzle/0022_m4_opportunity_discovery.sql` is additive. It does not rewrite `0000`–`0021`. It adds `career_source_health`, source operating columns, `jobs.last_observed_at`, `jobs.public_compensation_text`, description-version source metadata, and `career_source_sync_runs`. The composite foreign key is created after `career_sources (id, organization_id)` already exists.
- The only automated adapter is the Greenhouse public job board API (`greenhouse_public_board`, `DEC-PROD-004`). Manual URL and CSV are operator-confirmed imports. Feed and generic careers URLs are not crawled.
- Source access states are `supported_structured`, `supported_public`, `manual_only`, `blocked`, and `error`. The runner refuses anything that is not an allowlisted Greenhouse board, one public job page, or an uploaded CSV. Login-wall hosts such as Workday are `blocked` and are not fetched.
- Content hash is SHA-256 of the folded title, location, description, department, employment type, workplace, public salary text, qualifications, certifications, education, experience, and canonical source URL. Folding strips tags, decodes entities, and collapses whitespace. Tracking query parameters (`utm_*`, `gclid`, `fbclid`, and the other listed campaign parameters) are removed. Letter-case and added words stay material. The same hash does not insert another `job_description_versions` row.
- A new external key inserts a `monitored_public` job. The same key and hash only refreshes `last_observed_at`. A changed hash updates the job and appends a version. A successful complete Greenhouse listing closes previously `open` or `search_active` keys that are absent, by setting `status = closed` and `closed_at`. The row is not deleted. CSV and manual imports do not close jobs that were simply absent. A failed sync closes nothing.
- The safe fetcher allows http and https only. It resolves DNS, rejects private, loopback, link-local, and metadata addresses, and binds the socket lookup to the validated public addresses so a later DNS answer cannot replace them. Every redirect is validated and pinned on its own before it is followed. Redirects are limited to three. The original hostname remains the Host header and TLS SNI, and certificate verification stays enabled. Discovery requests do not include candidate records.
- `health_status = live` only after a complete Greenhouse sync with no current failure. Manual imports stay `manual`. Never-run sources stay `not_yet_synced`.
- M4 does not score, rank, recommend, email, or contact anyone. It does not call a model. If a public page cannot be parsed safely, the operator types the fields and confirms.

## Military + Workforce Core M5 opportunity matching

Canonical flow: Transition Talent Profile → approved capabilities → match engine ← reviewed job requirements ← employer job. The same result is stored for candidate → opportunities and job → candidates.

- Migration `drizzle/0023_m5_opportunity_matching.sql` is additive. It does not delete historical matches and does not rewrite `0000`–`0022`. `candidate_job_matches.organization_id` is backfilled from the candidate. A cross-organization row fails the migration instead of being deleted. `jobs UNIQUE (id, organization_id)` supports composite foreign keys so a match cannot pair another organization's candidate and job.
- Capability requirements stay on `job_skills`, using `skills`. Provenance columns record source, source text, review, confidence, and reviewer. Existing rows default to approved recruiter entry. Non-skill requirements live on `job_requirements` (`credential`, `education`, `clearance`, `experience`, `location`, `workplace`, `travel`, `license`, `job_family`, `occupation`). Explainability lines live on `candidate_job_match_factors` and are replaced when that match is recalculated.
- `match_category` is `strong_match`, `possible_match`, `developmental_match`, or `no_current_match`. `freshness` is `current`, `stale`, `queued`, or `error`. Existing matches start `stale`. `recruiter_disposition` is `viable`, `not_viable`, or `needs_information` and does not change the calculated category. The numeric `score` is the internal m5-v1 ordering value, not a displayed percentage.
- Strong means at least 75% of approved required capabilities align and no unresolved hard constraint. Possible means at least 40% align, at least two required capabilities align, or job-family overlap plus one aligned capability. Developmental means a smaller overlap. No Current Match means there is not enough reviewed evidence. A required license, an unmet explicit clearance, or an on-site location with no remote path and no recorded willingness to relocate prevents Strong. None of those hide or reject the person.
- Internal weights, when the dimension has evidence: required capabilities 40, preferred 15, credentials 10, location 10, timing 8, job family 7, clearance 5, experience 3, education 2. Compensation is compared only when both sides already have a number and does not add points. Military service years are not converted into civilian years. SkillBridge timing is used only when the job is SkillBridge-eligible.
- Current recommendations are `open` or `search_active` jobs. Closed jobs remain readable and drop out of the candidate's current list. A content hash, requirement, capability, or preference change changes `input_hash`, and the next read marks the row stale. Candidate → jobs evaluates up to 2,000 open jobs in the organization. Job → candidates loads at most 500 people who already share an approved skill or a reviewed job family, using `candidate_skills (organization_id, skill_id)`.
- Deterministic extraction drafts clearance, years, education, named credentials, and workplace from the description. A model may propose additional requirements, and any proposal whose source text is not an excerpt is discarded. Drafts stay pending and do not affect matches until a person approves them. Prompts contain job text only.
- No new permission is added. Recruiter still lacks `opportunities.read`. Material audits are requirement review, match recalculation, and recruiter disposition. Passive reads are not audited.

## Military + Workforce Core M6 routing and outreach

Canonical flow: match → human review → engagement → route or outreach → response → follow-up → interview, referral, or no fit → placement or closed. Public opportunity outreach is not client routing (`DEC-PROD-006`).

- Migration `drizzle/0024_m6_routing_outreach.sql` is additive. It does not rewrite `0000`–`0023`. It adds `jobs.authorized_employer_route` (default false) and `contacts UNIQUE (id, organization_id)` so a route can reference a contact in the same organization.
- `opportunity_engagements` is the one current operational record for a match. `candidate_engagements` stays the touchpoint log. `submissions` stays the formal client packet and is linked only when a person records one. `skillbridge_opportunities` stays readable and is not written by this workflow. `candidate_job_matches.pipeline_status` stays the older recruiting pipeline and is not a second copy of this status list.
- Mode is `authorized_routing` or `public_outreach`. Status is `ready_for_review`, `ready_for_outreach`, `routed`, `contacted`, `acknowledged`, `reviewing`, `interested`, `referred`, `interview`, `needs_follow_up`, `needs_information`, `no_fit`, `withdrawn`, `placed`, or `closed`. Employer response and candidate response are separate columns.
- `opportunity_engagement_routes` keeps every attempt. `opportunity_engagement_messages` records draft, manual, and provider delivery. `opportunity_engagement_events` records material transitions. A scheduled follow-up scan may create an in-app alert. It does not send email.
- `client`, `internal`, and `skillbridge` jobs may use authorized routing. `monitored_public` and `exploratory` jobs may not, unless `authorized_employer_route` is true. Sharing a candidate externally requires `candidates.consent_status = granted`.

## Military + Workforce Core M7 workforce pipeline

Canonical flow: employer need → workforce role → capability demand → talent supply → gap → pipeline strategy. Military talent is one supply channel (`DEC-PROD-007`).

- Migration `drizzle/0025_m7_workforce_pipeline.sql` is additive. It does not rewrite `0000`–`0024`. `workforce_roles UNIQUE (id, organization_id)` is created before `workforce_role_jobs` references it, so a link cannot pair a role and a job from different organizations.
- `workforce_roles` gains `job_family_id`, `demand_quantity` (default 0), `demand_horizon` (default `future`, reusing M1 `current` / `evergreen` / `future`), `planning_horizon` (`0_90_days`, `3_6_months`, `6_12_months`, `12_24_months`), `demand_source` (`current_jobs`, `workforce_plan`, `manual_employer_need`, `aggregated_role`), and `required_clearance_level`. Existing rows stay future planning demand at quantity 0. Free-text `job_family` is preserved.
- `workforce_strategy_notes` records a channel and a note. The role, assessment, and education partner must share `organization_id`. Migration `drizzle/0026_m7_strategy_note_tenant.sql` adds those composite foreign keys. Deleting an assessment or education partner clears only that optional column. `created_by_user_id` and `workforce_role_capability_texts.reviewed_by_user_id` stay single-column user references, which is the M1–M6 convention. `users` has no `(id, organization_id)` unique key. Capability text has no organization column. Its mandatory `role_id` is the owner, and the service loads that role inside the actor's organization before review. `skills` and `job_families` stay global references. Channels are `military_talent_network`, `talent_network`, `targeted_campaign`, `skillbridge_pathway`, `education_partner`, `training_pathway`, `evergreen_pool`, `increase_sourcing`, and `review_requirements`.
- Known supply is computed on read. A person counts once. A translation capability counts only when `review_status = approved`. An explicit skill counts unless rejected. Archived, privacy-deleted, and do-not-contact people are excluded from known supply. Availability uses stored candidate availability and stored transition dates. Location uses city, region, preferred locations, and recorded relocation willingness. Credentials count only when `status = active` and the name overlaps the role text. Clearance uses the candidate-reported row and is labeled as not independently verified.
- Health is `critical` when demand is greater than zero, known supply is under 25 percent of that demand, and the active pipeline is empty. Otherwise a quantity gap is `gap`, a timing, location, credential, or clearance constraint is `watch`, and a covered role is `healthy`. There is no supply cache. `calculated_at` is the read time.

## Military + Workforce Core M9 outcome learning

Outcome learning is advisory (`DEC-PROD-009`). It does not automatically modify matching, mappings, requirements, candidate eligibility, or routing.

- Migration `drizzle/0027_m9_outcome_learning.sql` is additive. It does not rewrite `0000`–`0026`. It adds `outcome_learning_recommendations` only. There is no training table and no materialized outcome cache. Aggregates are grouped SQL at read time. The as-of time is the read time.
- A recommendation row is organization-scoped. `reviewed_by_user_id` uses `ON DELETE set null`. The organization foreign key uses `ON DELETE restrict`. Indexes cover `organization_id`, `reviewed_by_user_id`, and `(organization_id, time_window, review_state)`.
- Canonical outcomes stay on the source rows. `candidate_job_matches.match_category` is not rewritten. Employer Not a Fit, no response, candidate decline, and recruiter not-viable stay distinct. Pending and rejected capabilities are not positive evidence. Compensation factors are excluded from the learning query.
- Review states are `new`, `reviewing`, `accepted_as_note`, `dismissed`, and `needs_more_data`. `accepted_as_note` records a human acknowledgement. It is not a matcher, mapping, or requirement change.
- No new permission. Outcome reads use `reports.read`. Candidate-level drilldown is not part of the aggregate page. Passive reads are not audited. Review actions write `outcome_recommendation.reviewing`, `outcome_recommendation.accepted_as_note`, `outcome_recommendation.dismissed`, or `outcome_recommendation.needs_more_data`.

## Phase L scale tables

- Migration `drizzle/0017_quiet_scale.sql` adds `skillbridge_profiles.ets_date` / `eaos_date`, `public_access_tokens`, `report_export_schedules`, and `report_export_jobs`. Organization FKs use `ON DELETE restrict`.
- `public_access_tokens.token_hash` is unique. Raw tokens are not stored. Purposes: `interview_self_schedule`, `hire_onboarding`, `application_status`.
- Scheduled report jobs never persist talent PII. On-demand `reports.export_pii` is unchanged.
- Embedding column remains `vector(1536)` (DEC-SEM-001) until a production embedding model and dimension are chosen together.

## Public content items

`public_content_items` is a lightweight publishing table, not a CMS. Content types and placements are Postgres enums so new types can be added later without a JSON document store. `linked_job_id` references `jobs`. Closed or unpublished jobs are omitted from `GET /api/public/v1/content` at query time. Do not duplicate website job or SkillBridge opportunity records.

