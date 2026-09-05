<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# WorkforceOS agent instructions

You are working in WorkforceOS, an internal operating system for a Workforce & Talent Solutions firm.

Read these canonical documents instead of inventing architecture:

- `docs/architecture/WORKFORCEOS_MASTER_SPEC.md`
- `docs/business/SERVICE_CATALOG.md`
- `docs/database/DATA_DICTIONARY.md`
- `docs/database/SCHEMA_SPEC.md`
- `docs/decisions/DECISION_LOG.md`
- `docs/integrations/INTEGRATION_PLAN.md`
- `docs/requirements/REQUIREMENTS_REGISTRY.md`
- `docs/workflows/SERVICE_WORKFLOWS.md`
- `docs/architecture/DEPLOYMENT.md`
- `docs/architecture/DATABASE_DEPLOYMENT.md`
- `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`

Project rules in `.cursor/rules/` are binding:

- `architecture.mdc`
- `database.mdc`
- `security.mdc`
- `workflow.mdc`

Phase 1 is foundation only. Do not build full CRM or Talent Network UI unless explicitly asked. Do not use Firebase. Do not add temp staffing, payroll, public job marketplace, or cap-table features.
