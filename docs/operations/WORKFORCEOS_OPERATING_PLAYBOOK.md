# WorkforceOS Operating Playbook

Internal operating procedures for deploying, recovering, and running WorkforceOS. This is not a second product spec. Canonical architecture remains `docs/architecture/WORKFORCEOS_MASTER_SPEC.md`. Remaining work is tracked in `docs/operations/MASTER_COMPLETION_LEDGER.md`. Production API key names and required-vs-optional status live in `docs/operations/PRODUCTION_API_KEYS.md`. Never paste secret values into docs or System Health.

## Environments

| Environment | App | Database | Seed |
| --- | --- | --- | --- |
| Local | `npm run dev` | Neon development branch | `npm run db:seed:dev` |
| Vercel preview | Git preview deployment | Neon preview branch | optional `db:seed:dev` |
| Vercel production | `main` | Protected Neon production branch | `npm run db:seed:prod` only |

The Neon default branch may be named `production` while still holding Harbor/Taylor Ellis fixtures. Treat that branch as development data until a clean production branch is created and Vercel production `DATABASE_URL` points at it.

## Deploy

1. Confirm `npm run lint`, `npm run typecheck`, `npm test`, phase tests, `npm run test:smoke`, and `npm run build` on the release commit.
2. Merge to `main`. Vercel builds from GitHub `willjksn/workforceos`. `next build` does **not** migrate or seed.
3. Apply pending Drizzle migrations to the target Neon branch with the **direct** URL:

```bash
$env:DATABASE_URL_UNPOOLED="<direct-connection-string>"
npm run db:migrate
npm run db:check
```

4. Deploy or wait for Vercel promotion.
5. Confirm `/app/admin/system-health`, Clerk sign-in, one authorized read, one authorized write, and an audit event.

Preview vs production: preview uses Clerk test keys and a preview database. Production uses Clerk live keys and the protected production database.

## Migrate

- Change schema in `db/schema/`.
- Generate `npm run db:generate`. Review SQL. Do not rewrite already-applied files `0000`–`0009`.
- Apply with `npm run db:migrate` using `DATABASE_URL_UNPOOLED`.
- Update `docs/database/MIGRATIONS.md` and `docs/database/DATA_DICTIONARY.md`.

Rollback of a bad migration is restore-from-backup / PITR, not `drizzle-kit push` and not editing applied SQL.

## Seed

| Command | When |
| --- | --- |
| `npm run db:seed:prod` | Production and any clean branch. Organization, roles, services, workflows, requirements, agents, approved reference data. |
| `npm run db:seed:dev` | Local/preview fixtures only (Harbor, Taylor Ellis, Navy EM, Cedar Ridge, labeled SkillBridge people). |

`db:seed:dev` refuses to run when `NODE_ENV=production` or `VERCEL_ENV=production` unless `ALLOW_DEV_SEED=true`. Do not set that override on Vercel production.

After first Clerk login, grant Managing Partner:

```bash
npm run db:bootstrap-admin -- --email you@company.com
```

## User onboarding

1. A Managing Partner or Strategy & Technology Administrator invites from `/app/admin/users` (**Invite person**), sets an optional organizational title (display only), and chooses a starting access bundle. Clerk emails the invite; the local `users` row is recorded as invited with that bundle. Clerk metadata is not authorization.
2. They accept the email and sign in at `/sign-in` (or complete `/sign-up` from the invite). Local sync attaches their Clerk id and activates the invited row; the bundle is already assigned.
3. Open `/app/admin/users/[id]` to assign multiple access bundles, view effective permissions, set grant/deny overrides, copy access from another person, or reset overrides. Title ≠ Access (DEC-AUTH-002).
4. To resend, submit **Invite person** again with the same email. Disabled local users are rejected even if a Clerk session still exists.

## Role changes

Use `/app/admin/users` (People + person detail) and `/app/admin/roles` (access-bundle catalog). Bundle assignment is audited. The last Managing Partner cannot be removed. Review stale accounts on `/app/admin/access-review`. Training requirements are Phase E and do not grant access.

## Integration reconnect

1. Open `/app/admin/integrations`.
2. Confirm the provider is labeled configured vs mock. Unconfigured providers stay mocks.
3. Rotate credentials in Vercel env vars. Never paste secrets into the UI or logs.
4. Re-run a health check from System status. Failed syncs appear on `/app/alerts` and Integration Hub.

Unsigned webhooks are rejected. Webhook intake is rate-limited.

## Failed job handling

1. Check `/app/admin/system-health` queue failures and `/app/ai-operations/failures`.
2. Inspect Inngest (if configured) for the function name and error. Logs omit secrets and candidate contact fields.
3. Retry from the domain screen when a retry action exists (integration events, agent runs). Do not re-run by writing SQL.
4. If a circuit breaker is open, wait for the documented cooldown or have a Managing Partner review AI Operations.

## AI review queue

Material AI output lands on `/app/ai-operations/review` as `approvals` plus `agent_outputs`. Humans approve, reject, request changes, or edit. The originating agent cannot approve its own output. Client-facing drafts stay drafts until approved.

`agents.read` opens the Review Queue. `agents.manage` is cost, prompt, run, and provider admin (Admin → AI & Automation). Recruiter, Talent Partner, and Military Talent Partner have `agents.read` only. Workforce Consultant has `agents.read` and `scout.draft`. Decide also requires the domain approve permission for that output category (DEC-AI-012). Do not add `scout.recruiting` or `scout.finance`.

## Scout

Scout is the persistent in-app assistant (tooltip: Open Scout). It is a right-side drawer, not a new product surface.

- Grant `scout.use` to operators who may open it. Search/draft/internal/external actions are separate permissions.
- Material writes show a confirmation card. Confirming is a human action and is audited.
- Drafts never send. Copy or a later human-approved send path is required. `scout.external_actions` is required before any external send is even proposed.
- Do not treat Scout chat as the system of record. Correct data on the candidate, job, company, or Transition Talent Profile record.

## Military Talent pathway operations

PierOne is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is one pathway at `/app/military/skillbridge`, not a PierOne-owned program. Operator access bundle: Military Talent Partner.

Canonical flow: Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity Search / Development → Employer Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other Transition Pathway → Placement → Conversion.

- Create a Transition Talent Profile against an existing candidate (`skillbridge_profiles`). Do not create a second person. A public job posting is not required first.
- Employer opportunities (`skillbridge_opportunities`) must name a host company/employer. PierOne facilitates the match.
- The Military Talent queue is the owner's overdue follow-ups, windows, missing resumes, and employer feedback — not a PierOne SkillBridge program dashboard. Managers with `skillbridge.manage` can switch to the global queue.
- Alert thresholds are `skillbridge_alert_rules` (not hardcoded). Inngest `workforceos/skillbridge-follow-up-scan` and `workforceos/skillbridge-match` populate in-app notifications.
- Humans connect or submit to employers. Scout/agent drafts of briefs and emails stay drafts. Employer briefs are reviewable prose, not raw JSON.
- In-app Academy is not available yet. Use approved knowledge playbooks and this playbook.

## Careers and hiring (Phase 10)

- Public careers: `/careers`. Internal queues: `/app/recruiting/workbench` and `/app/recruiting/applications`.
- Transactional email is Resend (`EmailProvider`). Recruiter mailboxes remain Microsoft/Google. Verify the sending domain before production.
- Background checks: Checkr when configured, otherwise manual. Drug screens: NOT CONFIGURED until a vendor is chosen. Never treat a vendor result as an automatic hiring decision.
- Production seed must not load fake applicants.

## Backup / PITR / recovery

Neon provides branch checkpoints and point-in-time restore (PITR) on the paid project. WorkforceOS does not store backup credentials in the app.

**Backup**

- Confirm Neon PITR retention in the Neon console for the production branch.
- Before a production migration, create a child branch or checkpoint of production.

**Recovery (PITR)**

1. In Neon, restore the production branch to a timestamp before the incident (or create a new branch from that timestamp).
2. Point Vercel production `DATABASE_URL` / `DATABASE_URL_UNPOOLED` at the restored branch, or rename/promote per Neon’s restore flow.
3. Run `npm run db:check`. Confirm migration hashes match the application commit.
4. Sign in, open Command Center, confirm a known company/candidate/job still exists.
5. Record the incident in `docs/operations/INCIDENT_RESPONSE.md` notes for the event (no PII).

**Rollback (application)**

1. In Vercel, promote/redeploy the last known-good production deployment.
2. If the bad release required a new migration, restore the database to before that migration (PITR) rather than editing applied SQL.
3. Do not run `drizzle-kit push` against production.

**Disaster recovery test**

At least once before go-live, and after material schema changes:

1. Create a throwaway Neon branch from production (or from the current development branch if production is not clean yet).
2. Restore or fork to a timestamp.
3. Run `npm run db:check` and `npm run test:smoke` against that branch.
4. Record the date and operator. Do not copy Restricted PII off the branch.

## Incident handling

Follow `docs/operations/INCIDENT_RESPONSE.md` for auth, database, integration, AI, data-exposure, and deployment-regression events.
