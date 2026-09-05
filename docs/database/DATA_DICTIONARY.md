# Data Dictionary

Status: Phase 3 recruiting and military translator tables  
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
| `users` | Local application users mapped from Clerk. Authoritative status and identity for authorization. |
| `roles` | Named roles such as Managing Partner and Recruiter. |
| `user_roles` | Many-to-many user/role assignments. |
| `agents` | Registered AI agents. Default disabled. |

## Platform

| Table | Purpose |
| --- | --- |
| `audit_events` | Append-only business change history. |
| `approvals` | Generic human approval requests. |
| `agent_runs` | Execution instances of agents. |
| `agent_outputs` | Drafts/recommendations with provenance. |
| `files` | Object-storage metadata only. Binaries are not stored in PostgreSQL. |
| `integration_connections` | Provider connection configuration status. |
| `external_records` | Maps external provider records to WorkforceOS records. |
| `integration_events` | Integration sync/lookup activity. |
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
| `skills` | Canonical skills. |
| `civilian_occupations` | Civilian occupation records with O\*NET source fields. |
| `occupation_skills` | Occupation-to-skill links. |

## Talent

| Table | Purpose |
| --- | --- |
| `candidates` | Permanent Talent CRM people. Restricted PII. Not requisition-specific duplicates. |
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

## Services and delivery

| Table | Purpose |
| --- | --- |
| `services` | Launch service catalog. |
| `service_versions` | Approved versioned definitions. |
| `service_workflows` | Versioned steps agents must follow. |
| `solution_plans` | Client-specific plans tied to a service version. |
| `projects` | Delivery projects. |
| `project_phases` | Project phases. |
| `project_tasks` | Tasks generated from templates/plans. |

## Explicitly excluded

Ownership percentages, cap-table records, payroll, and temp-staffing assignment engines are not part of this dictionary.
