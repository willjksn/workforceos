# WorkforceOS Master Specification

Status: Phase 1 foundation  
Audience: engineering agents and maintainers  
Canonical: this file is the architecture source of truth for implementation.

## Purpose

WorkforceOS is an internal operating system for a Workforce & Talent Solutions firm. It is not a generic ATS and not a public SaaS platform in V1.

It will eventually manage company CRM, Talent CRM, recruiting/search, military talent translation, workforce development, legal document operations, finance/AR workflow, integrations, background AI agents, audit history, approvals, and institutional knowledge.

Phase 1 builds only the technical foundation required for those later modules.

## Product boundaries

In V1, WorkforceOS:

- is internal-first
- treats PostgreSQL as the system of record
- treats AI as an internal operating engine, not a client-facing marketing claim
- does not include temp staffing or payroll
- does not include a public job marketplace
- does not store founder ownership or cap-table information in the normal application

## Approved technology stack

| Concern | Choice |
| --- | --- |
| Application | Next.js App Router + TypeScript |
| Hosting | Vercel |
| Database | Neon PostgreSQL |
| ORM | Drizzle |
| Authn | Clerk |
| Authz | Local PostgreSQL roles/permissions, enforced server-side |
| File storage | StorageProvider abstraction; Cloudflare R2 / S3-compatible in production; local adapter in development |
| Search | pgvector semantic search; pg_trgm fuzzy search; PostgreSQL full-text where useful |
| Background jobs | Inngest |
| AI models | Provider abstraction; agents do not own data |
| Monitoring | Hook interface now; Sentry may be wired later |

Firebase and Firestore are prohibited.

## Application structure

The repository uses a root-level `app/` directory from the original Next.js scaffold. Keep that layout unless a documented decision changes it.

Server-only modules live under `db/` and `lib/`. Client components must not import database, environment secrets, or authorization internals.

## Architecture rules

1. PostgreSQL is the primary source of truth.
2. External tools (Apollo, SeekOut, LinkedIn, O\*NET, DocuSign, QuickBooks, and future providers) are integrations, not systems of record.
3. AI agents do not own data.
4. AI agents may create drafts and recommendations but may not silently overwrite approved human decisions.
5. All business-critical AI outputs retain provenance: agent, model, model version, timestamp, confidence, and source references where applicable.
6. Authorization is enforced server-side.
7. Database credentials are never exposed to the browser.
8. Important records use UUID primary keys.
9. Operational records use soft-delete/archive where appropriate.
10. Candidate privacy deletion is a separate controlled process, not ordinary archive.
11. Avoid excessive JSONB. Use relational tables for data that is searched, filtered, joined, sorted, aggregated, or reported on.
12. Ownership/cap-table information is not part of the normal WorkforceOS application.

## Domain map (future modules)

Phase 1 implemented schema and service foundations. Phase 2 adds operating UI for CRM, Talent Network, Professional Search, and Military Talent Opportunity Assessment on that foundation.

- CRM: companies, contacts, opportunities, signals
- Talent Network: candidates, pools, rediscovery
- Recruiting: jobs, matches, submissions, interviews, offers, placements
- Military Talent: occupation translation, installations, civilian mappings
- Workforce Development: assessments, forecasts, pipeline planning
- Services: five launch service engines and versioned workflows
- Legal: document packages linked to services and engagements
- Finance: AR operating workflow
- AI: agent registry, runs, outputs, approvals
- Platform: users, roles, audit, integrations, files, search

## Data ownership

| Data | Owner |
| --- | --- |
| Companies, contacts, opportunities | WorkforceOS PostgreSQL |
| Candidates and talent pools | WorkforceOS PostgreSQL |
| Jobs and matches | WorkforceOS PostgreSQL |
| Military mappings | WorkforceOS PostgreSQL; external occupation systems are references |
| Files | Object storage metadata in PostgreSQL; binaries in the storage provider |
| Identity credentials | Clerk for authentication only |
| Application authorization | Local `users`, `roles`, and `user_roles` |
| AI recommendations | `agent_outputs` plus approvals; humans remain authoritative |

## Security baseline

- Candidate records are Restricted PII.
- Server-side permission checks wrap all mutations.
- Proxy/Clerk route protection is an optimistic gate, not the authorization system.
- Secrets stay in server environment variables.
- Audit events are append-only through application logic.

## Related documents

- [SERVICE_CATALOG.md](../business/SERVICE_CATALOG.md)
- [SERVICE_WORKFLOWS.md](../workflows/SERVICE_WORKFLOWS.md)
- [DATA_DICTIONARY.md](../database/DATA_DICTIONARY.md)
- [SCHEMA_SPEC.md](../database/SCHEMA_SPEC.md)
- [DECISION_LOG.md](../decisions/DECISION_LOG.md)
- [INTEGRATION_PLAN.md](../integrations/INTEGRATION_PLAN.md)
- [REQUIREMENTS_REGISTRY.md](../requirements/REQUIREMENTS_REGISTRY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
