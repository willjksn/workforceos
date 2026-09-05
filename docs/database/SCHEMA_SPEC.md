# Schema Specification

Status: Phase 2 CRM/Talent operating schema  
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
| `db/schema/system/` | audit, approvals, files, requirements, decision log, semantic documents |
| `db/schema/crm/` | companies through opportunities and opportunity_scores |
| `db/schema/talent/` | candidates and pools |
| `db/schema/recruiting/` | jobs through placements |
| `db/schema/military/` | military translation tables |
| `db/schema/workforce/` | occupation/skill foundations used by workforce services |
| `db/schema/services/` | services, versions, workflows, solution plans |
| `db/schema/projects/` | projects, phases, tasks |
| `db/schema/legal/` | reserved legal linkage foundation |
| `db/schema/finance/` | reserved finance operating foundation |
| `db/schema/integrations/` | integration hub tables |
| `db/schema/ai/` | agent runs and outputs |
| `db/schema/operating/` | activities, candidate_engagements, candidate_designations, saved views |

## Key uniqueness rules

- A candidate is stored once and reused across clients and jobs.
- `candidate_talent_pools` unique on `(candidate_id, talent_pool_id)`.
- `candidate_job_matches` unique on `(candidate_id, job_id)`.
- Do not duplicate a candidate per requisition.

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
