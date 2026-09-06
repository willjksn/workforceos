# Post-launch backlog

Do not build these items during Post-Phase-9 stabilization. New work enters the normal requirements / decision / release process.

| Title | Problem | Business value | Priority | Dependencies | Complexity | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Implement R2/S3 storage adapter | Production uploads throw “not implemented”; health must not look ready | Resume and contract files in production | P1 | Cloudflare R2 or S3 credentials | M | open |
| Live Checkr HTTP API | Adapter is a stub; CHECKR_API_KEY does not call Checkr; not sandbox-ready | Provider-hosted background invitations | P2 | Checkr sandbox + webhook secret + counsel | L | open |
| Drug-screen vendor adapter | ManualDrugScreenProvider only; no vendor selected | Provider-hosted collection workflow | P3 | Vendor selection + BAA/PHI review | L | open |
| Live calendar OAuth scheduling | getCalendarProvider() always returns mock; liveScheduling is false | Real Microsoft/Google interview events | P2 | Graph/Google OAuth + Integration Hub tokens | L | open |
| Candidate self-scheduling | Recruiters schedule internally only | Candidate picks a slot | P3 | Live calendar adapter | L | open |
| New-hire `/onboarding/access` portal | Public path reserved; tokens not issued; internal `/app/onboarding` is the Phase 10 path | Candidate task completion without `/app` | P3 | Signed tokens + email | L | open |
| Parked AI/research runtime (`1a356d3`) | Migration 0010 created research tables; unfinished provider/research code is on `follow-on/parked-working-tree` | Do not merge for Phase 10. Human review before any later AI module | P3 | Phase 11 / research decision | L | parked |
| Official Sentry SDK | Thin DSN poster only; no source maps or performance | Faster incident response | P2 | Sentry project + `SENTRY_DSN` | S | open |
| Clean Neon production branch | Default Neon `production` branch still has development fixtures | Real internal data isolation | P0 ops | Neon console; Vercel env cutover | S | open |
| Vercel production env cutover | Checklist largely unchecked | Hosted production | P0 ops | Clerk live keys, Neon, domain | M | open |
| Custom domain `app.pieronepartners.com` | Production origin not cut over | Operator bookmark / Clerk domains | P2 | DNS + Clerk production | S | open |
| Talent/jobs list pagination | Unbounded org lists | Survives real volume | P2 | Query audit | M | open |
| Command Center SQL recruiting rewrite | `recruitingAnalytics` still hydrates full graphs | Keep CC fast as data grows | P2 | Reporting contract | M | open |
| Scout approved-send path | `scout.external_actions` unused; send hard-denied | Later human-approved email | P3 | Email/calendar | L | open |
| SkillBridge ETS/EAOS aliases | Only EOS / separation / retirement stored | Navy/USMC language | P3 | Data dictionary | S | open |
| Starting/ending-soon alert rules | 14-day windows are constants, not `skillbridge_alert_rules` | Configurable ops | P3 | Alert rules UI | S | open |
| Email / calendar | Workspace adapters are references only; calendar scheduling is mock | Follow-ups leave the app; live interview OAuth | P2 | Microsoft/Google OAuth | L | open |
| Candidate portal | No self-service SkillBridge/candidate surface | Later product | P3 | Authn model | L | open |
| Client portal | V1 is internal-first | Later product | P3 | DEC-SEC-001 | L | open |
| Recruiting integrations live | SeekOut/LinkedIn/Apollo are mocks or partial | External sourcing after internal search | P2 | Integration Hub + internal-search gate | L | open |
| Live QuickBooks OAuth | Mapping exists; posting not enabled | AR sync | P2 | QB app + idempotency | L | open |
| Live DocuSign envelopes | Manual execution remains when unconfigured | E-sign | P2 | DocuSign + webhook secret | M | open |
| Workforce live BLS/Census | Unconfigured adapters return labeled fixtures | Intelligence provenance | P3 | API keys | M | open |
| Reporting scheduled exports | CSV is on-demand | Operator cadence | P3 | `reports.export` | S | open |
| Mobile UX | Desktop operating UI | Field use | P3 | Design | L | open |
| Scout result pagination beyond 25 | Hard cap for safety | Larger search sets | P3 | Scout DTOs | S | open |
| Invite-only local user pre-provision | Unknown Clerk users auto-create as active with no roles | Defense in depth if Clerk public sign-up is mis-set | P2 | Clerk webhooks | M | open |
| Semantic search dimension | `vector(1536)` is temporary (DEC-SEM-001) | Real embeddings | P3 | Embedding model choice | M | open |
