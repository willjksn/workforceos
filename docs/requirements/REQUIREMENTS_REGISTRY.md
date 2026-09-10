# Requirements Registry

Status: Locked requirements through Phase 10 hiring and the public website  
Database mirror: `requirements` table.  
Remaining work: `docs/operations/MASTER_COMPLETION_LEDGER.md`.

## Locked requirements

### WFOS-TAL-001

- Title: Candidates may belong to multiple talent pools
- Module: talent
- Priority: locked
- Status: approved
- Acceptance: a candidate can be a member of four or more pools without duplicating the candidate record.

### WFOS-TAL-002

- Title: Internal Talent Network search before external sourcing
- Module: recruiting
- Priority: locked
- Status: approved
- Acceptance: every new job creates or requires an internal search project before external provider sourcing.

### WFOS-TAL-003

- Title: Job-specific match scores
- Module: recruiting
- Priority: locked
- Status: approved
- Acceptance: one candidate can have independent scores for multiple jobs; there is no universal candidate score used as the match.

### WFOS-TAL-004

- Title: Prior applicants and silver medalists remain rediscoverable
- Module: talent
- Priority: locked
- Status: approved
- Acceptance: archived-from-requisition candidates remain searchable unless privacy/retention rules exclude them.

### WFOS-MIL-001

- Title: Multi-branch military classification support
- Module: military
- Priority: locked
- Status: approved
- Acceptance: schema supports Army MOS, Navy Rating, Air Force AFSC, Marine MOS, Coast Guard Rating, and applicable Space Force classifications.

### WFOS-MIL-002

- Title: Military occupations map to civilian occupations
- Module: military
- Priority: locked
- Status: approved
- Acceptance: a military occupation can have multiple civilian mappings.

### WFOS-MIL-003

- Title: Military occupations map to likely installations/bases
- Module: military
- Priority: locked
- Status: approved
- Acceptance: a military occupation can link to multiple installations with presence level.

### WFOS-MIL-004

- Title: Reverse civilian-to-military search
- Module: military
- Priority: locked
- Status: approved
- Acceptance: mappings are queryable from civilian occupation to military occupations.

### WFOS-MIL-005

- Title: Skills, certifications, gaps, bridge training, and explanations
- Module: military
- Priority: locked
- Status: approved
- Acceptance: mapping records can store skills, certifications, gaps, bridge training, and explanation text.

### WFOS-SVC-001

- Title: Five launch service workflows
- Module: services
- Priority: locked
- Status: approved
- Acceptance: Professional & Technical Search (`professional-search`), Military Talent Opportunity Assessment, TA Performance Assessment, Fractional Talent Partner, and Workforce Pipeline Assessment exist as versioned services.

### WFOS-LEGAL-001

- Title: Legal packages linked to services and engagements
- Module: legal
- Priority: locked
- Status: approved
- Acceptance: legal document records can reference a service and an engagement/project. Phase 1 provides schema foundation only.

### WFOS-AI-001

- Title: Material AI recommendations require provenance
- Module: ai
- Priority: locked
- Status: approved
- Acceptance: agent outputs store agent, model, model version, timestamp, confidence, and source references where applicable.

### WFOS-AI-002

- Title: Material client-facing AI outputs require human approval
- Module: ai
- Priority: locked
- Status: approved
- Acceptance: client-facing material outputs cannot be marked approved by the originating agent. Review Queue decide (DEC-AI-012) also requires the domain approve permission for that output category in addition to `agents.read`.

### WFOS-AUD-001

- Title: Important business changes require audit events
- Module: platform
- Priority: locked
- Status: approved
- Acceptance: material create/update/archive operations write append-only audit events.

### WFOS-SEC-001

- Title: Database authorization is server-side
- Module: security
- Priority: locked
- Status: approved
- Acceptance: mutations check local permissions on the server; UI checks are not sufficient.

### WFOS-SEC-002

- Title: Candidate data is Restricted PII
- Module: security
- Priority: locked
- Status: approved
- Acceptance: candidate access uses `candidate_pii.read` and privacy helpers; ordinary archive is distinct from privacy deletion.

### WFOS-INT-001

- Title: External providers connect through the Integration Hub
- Module: integrations
- Priority: locked
- Status: approved
- Acceptance: provider adapters implement a shared interface; core modules do not call provider SDKs directly.

### WFOS-CRM-001

- Title: Command Center uses live aggregates
- Module: crm
- Priority: locked
- Status: approved
- Acceptance: Command Center cards query PostgreSQL; they do not hardcode pipeline or talent counts.

### WFOS-CRM-002

- Title: Opportunity scores are stored 100-point records
- Module: crm
- Priority: locked
- Status: approved
- Acceptance: scores persist component values and total; a human override requires a reason and is audited.

### WFOS-REC-001

- Title: Internal Talent Network before external sourcing
- Module: recruiting
- Priority: locked
- Status: approved
- Acceptance: `search_active` records internal search start/completion; external sourcing hooks remain blocked until completion.

### WFOS-REC-002

- Title: Job-specific explainable match components
- Module: recruiting
- Priority: locked
- Status: approved
- Acceptance: matches store overall plus skills, experience, industry, location, compensation, certification, military, career alignment, and prior-feedback scores with strengths, gaps, and provenance. No universal candidate quality score. Scores do not auto-reject.

### WFOS-REC-003

- Title: Human-controlled pipeline, submission, and placement terms
- Module: recruiting
- Priority: locked
- Status: approved
- Acceptance: pipeline movement is audited; submissions start pending human action; guarantee days and fees come from the search agreement.

### WFOS-MIL-006

- Title: Military mapping provenance and human review
- Module: military
- Priority: locked
- Status: approved
- Acceptance: mappings store source, version, confidence, origin, and review status. Agent drafts start pending. The originating agent cannot approve them.

### WFOS-MIL-007

- Title: Military candidates reuse Talent Network records
- Module: military
- Priority: locked
- Status: approved
- Acceptance: military views filter existing candidates; they do not create a parallel military candidate database.

### WFOS-SVC-002

- Title: Approved service versions are immutable
- Module: services
- Priority: locked
- Status: approved
- Acceptance: changing an approved service definition creates a new `service_versions` row; the previous approved row is not overwritten.

### WFOS-SVC-003

- Title: Human approval for client-facing commercial artifacts
- Module: services
- Priority: locked
- Status: approved
- Acceptance: proposals cannot be sent, client-facing deliverables cannot be delivered, and pricing outside range cannot be stored without a human approver.

### WFOS-SVC-004

- Title: Contract execution gate for delivery projects
- Module: projects
- Priority: locked
- Status: approved
- Acceptance: project creation requires an executed contract unless a Managing Partner override with reason is audited.

### WFOS-FIN-001

- Title: Billing events are operational triggers
- Module: finance
- Priority: locked
- Status: approved
- Acceptance: project and contract events create `billing_events` without creating QuickBooks invoices unless that integration is configured.

### WFOS-FIN-002

- Title: Operational finance stays distinct from the accounting ledger
- Module: finance
- Priority: locked
- Status: approved
- Acceptance: invoices, payments, AR, and revenue events are WorkforceOS operating records. QuickBooks IDs map through `external_records`. Placement fees and milestone amounts come from stored contracts. Overrides require `finance.approve` and an audit event.

### WFOS-INT-002

- Title: Unconfigured providers never appear as live production connections
- Module: integrations
- Priority: locked
- Status: approved
- Acceptance: missing credentials yield adapters, labeled mocks, and setup instructions. Unsigned webhooks are rejected. Apollo does not overwrite approved CRM fields without review. DocuSign does not mark executed without provider or manual confirmation.

### WFOS-WF-001

- Title: Workforce roles are planning-level
- Module: workforce
- Priority: locked
- Status: approved
- Acceptance: `workforce_roles` do not duplicate recruiting `jobs`. Activating search still uses `jobs` and `search_projects`.

### WFOS-WF-002

- Title: Forecasts, gaps, and scenarios are estimates with provenance
- Module: workforce
- Priority: locked
- Status: approved
- Acceptance: each intelligence result stores source, assumptions, confidence, version, and reviewer and is never presented as certain. Delivered assessments are not overwritten.

### WFOS-WF-003

- Title: Human approval for client-facing workforce recommendations
- Module: workforce
- Priority: locked
- Status: approved
- Acceptance: AI drafts start pending. A human with `workforce.approve` records approval. Agents cannot approve their own material output.

### WFOS-WF-004

- Title: One canonical skills and occupation taxonomy
- Module: workforce
- Priority: locked
- Status: approved
- Acceptance: Phase 5 joins `skills` and `civilian_occupations`. Skill families are a column on `skills`.

### WFOS-WF-005

- Title: Labor-market sources are adapters and labeled fixtures
- Module: workforce
- Priority: locked
- Status: approved
- Acceptance: unconfigured BLS/Census/O\*NET lookups return labeled fixtures with null values. The application does not invent provider statistics.

### WFOS-AI-003

- Title: Agents operate within RBAC, workflows, and provenance
- Module: ai
- Priority: locked
- Status: approved
- Acceptance: agent runs load approved workflow context when a service is in scope. Effective permissions are the intersection of agent and caller permissions. Draft outputs store agent, model, sources, and review state. Originating agents cannot approve their own material output. Recruiter / Talent Partner / Military Talent Partner have `agents.read` and never `agents.manage`. Workforce Consultant has `agents.read` + `scout.draft`.

### WFOS-AI-004

- Title: Closed automation and no unsupervised commitments
- Module: ai
- Priority: locked
- Status: approved
- Acceptance: named automation rules may trigger internal Talent Network search, draft opportunities, project creation after contract execution, and billing events from stored terms. No agent can execute a contract, send a proposal, or submit a candidate.

### WFOS-RPT-001

- Title: Executive reporting uses live aggregates
- Module: reports
- Priority: locked
- Status: approved
- Acceptance: Command Center and Reports module metrics are PostgreSQL aggregates. Missing values stay empty. There is no dashboard builder.

### WFOS-SEC-003

- Title: Elevated PII export and distinct privacy deletion
- Module: security
- Priority: locked
- Status: approved
- Acceptance: Candidate PII exports require `reports.export_pii` and an audit event. Privacy deletion anonymizes Restricted PII and is not ordinary archive.

### WFOS-AI-005

- Title: Scout uses a closed command registry
- Module: ai
- Priority: locked
- Status: approved
- Acceptance: Natural-language prompts parse to SEARCH, SUMMARIZE, DRAFT, CREATE, UPDATE, ASSIGN, ADD_TO_POOL, ADD_TO_JOB, CREATE_TASK, CREATE_FOLLOW_UP, SHOW_RECORD, SHOW_DASHBOARD, or FIND_MATCHES. Unknown commands and SQL are rejected. Execution uses Zod DTOs and existing services, never model-generated SQL.

### WFOS-AI-006

- Title: Scout RBAC, page context, and confirmation
- Module: ai
- Priority: locked
- Status: approved
- Acceptance: Page context comes from the route. Authorization and Restricted PII stripping happen before model context. Material internal writes confirm. Drafts never auto-send. Scout cannot self-approve, send contracts, execute offers, or reject candidates solely via AI.

### WFOS-MIL-008

- Title: SkillBridge people are Talent Network candidates
- Module: military
- Priority: locked
- Status: approved
- Acceptance: `skillbridge_profiles` link 1:1 to existing `candidates` as a Transition Talent Profile overlay. Creating a profile does not duplicate a person. Employer/host-company opportunities are many-to-many with stage history. A public job posting is not required to join the Military Talent Network.

### WFOS-MIL-009

- Title: PierOne is the military-talent intermediary, not a generic SkillBridge host program
- Module: military
- Priority: locked
- Status: approved
- Acceptance: Public and internal language treats PierOne as the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is a pathway/opportunity type, not a sixth launch service. Copy must not imply a PierOne-owned SkillBridge program, automatic host status, guaranteed placement, or that every military-talent profile is an application to PierOne. Operator-facing access copy uses Military Talent Partner, not Military Talent Specialist. Canonical flow is Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity Search / Development → Employer Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other Transition Pathway → Placement → Conversion.

### WFOS-HIRE-001

- Title: A global Candidate may have multiple Applications
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Applications are Candidate↔Job rows. Multiple applications never require multiple candidate identities.

### WFOS-HIRE-002

- Title: Applications must never create unnecessary duplicate candidate identities
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Dedupe uses normalized email/phone. Name-only matches never auto-merge. Ambiguous matches are flagged for recruiter review.

### WFOS-HIRE-003

- Title: Jobs may be Internal, Client, or SkillBridge
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: `jobs.job_context_type` is `internal | client | skillbridge` with matching default pipelines.

### WFOS-HIRE-004

- Title: Approved jobs may be published to the PierOne public careers site
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Publishing requires `jobs.publish`. AI job descriptions require human approval first. Confidential client fields stay off the public payload.

### WFOS-HIRE-005

- Title: Public applications flow directly into WorkforceOS
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: `POST /api/public/v1/applications` creates/links a Candidate and Application. Multipart resume (PDF/DOC/DOCX) is stored via StorageProvider. No public database access.

### WFOS-HIRE-006

- Title: SkillBridge applications use existing SkillBridge candidate architecture
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Applying to a SkillBridge job updates/creates `skillbridge_profiles` on the same candidate and may link an opportunity. No second person record.

### WFOS-HIRE-007

- Title: Interview scheduling uses CalendarProvider adapters
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Events store provider, external id, times, timezone, and meeting URL. Microsoft/Google stay adapters. Phase 10 uses MockCalendarProvider only (`liveScheduling` false). Candidate self-scheduling is follow-on.

### WFOS-HIRE-008

- Title: Transactional recruiting email uses EmailProvider
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: UI and workflows call EmailProvider, not Resend APIs directly. Events are stored on `transactional_email_events`.

### WFOS-HIRE-009

- Title: Resend is the approved transactional email implementation
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: `ResendEmailProvider` is used when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set. Tests and unconfigured development use the mock provider. Unconfigured production fails clearly.

### WFOS-HIRE-010

- Title: Background screening uses a provider adapter with human review
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Checkr is preferred when configured; otherwise manual/mock. Results cannot auto-reject a candidate.
- Implementation note (Phase 10 complete): Checkr HTTP API is not wired. `getBackgroundCheckProvider()` returns `ManualBackgroundCheckProvider`. Not sandbox-ready. See `docs/integrations/CHECKR.md`.

### WFOS-HIRE-011

- Title: Drug screening uses a provider adapter with restricted access
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: `drug_screens.read` is required for status. Detailed medical/lab data is not stored for general candidate access. Vendor is NOT CONFIGURED until selected.

### WFOS-HIRE-012

- Title: AI may not independently make final hiring/rejection decisions
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Scout may summarize and draft. Material rejection requires an authorized human and an allowed disposition reason.

### WFOS-HIRE-013

- Title: Accepted candidates may become Employees without losing Candidate history
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: `employees.candidate_id` is required. The original candidate row remains in the Talent Network.

### WFOS-HIRE-014

- Title: Onboarding uses reusable templates and assigned tasks
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Templates generate instance tasks with owners, due dates, and phases. Inngest handles reminders. Internal `/app/onboarding` completes tasks. `/onboarding/access` is a reserved follow-on portal.

### WFOS-HIRE-015

- Title: Public job/application endpoints must be secure, validated, and rate-limited
- Module: hiring
- Priority: locked
- Status: approved
- Acceptance: Rate limits, honeypot, resume MIME/size/extension checks, closed-job rejection, and no direct ORM from the browser.

### WFOS-WEB-001

- Title: PierOne public website must remain separately deployable from WorkforceOS
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: `sites/pierone` has its own package.json and Vercel project. Marketing deploys do not require a WorkforceOS release unless API contracts change.

### WFOS-WEB-002

- Title: Public website may not access WorkforceOS database directly
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: No Drizzle, DATABASE_URL, or Neon client in `sites/pierone`.

### WFOS-WEB-003

- Title: Public operational data exchange must occur through approved public gateway APIs
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Jobs, applications, inquiries, military talent intake, and public content use `/api/public/v1/*`.

### WFOS-WEB-004

- Title: WorkforceOS remains source of truth for published jobs
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Closing a job in WorkforceOS stops public applications without a website deploy.

### WFOS-WEB-005

- Title: Employer website inquiries must enter WorkforceOS CRM/intake workflow
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: POST `/api/public/v1/inquiries` creates `website_inquiries` and links Company/Contact when safe. Opportunities are not automatic.

### WFOS-WEB-006

- Title: Public applications must create/reuse the global Candidate architecture
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Email/phone dedupe; no per-requisition candidate clone.

### WFOS-WEB-007

- Title: SkillBridge applications must reuse the global Candidate and SkillBridge architecture
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: SkillBridge job applications attach `skillbridge_profiles` to the existing Candidate.

### WFOS-WEB-008

- Title: Transitioning service members may join PierOne's Military Talent Network without applying to a specific job
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: POST `/api/public/v1/military-talent` creates/reuses Candidate + SkillBridge profile.

### WFOS-WEB-009

- Title: Public write endpoints must be validated, rate-limited, and abuse-resistant
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Zod, rate limits, honeypot, sanitization, production HMAC (required), file validation.

### WFOS-WEB-010

- Title: Confidential client information may not leak to public job surfaces
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: `toPublicJob` redacts confidential client identity and compensation internals.

### WFOS-WEB-011

- Title: Resume storage must use production private object storage
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: S3-compatible StorageProvider implemented; no public resume URLs; metadata in `files` only.

### WFOS-WEB-012

- Title: Public transactional email must use WorkforceOS EmailProvider
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Inquiry, application, and military-talent acknowledgements go through EmailProvider/Resend.

### WFOS-WEB-013

- Title: Website submissions must retain source and attribution data
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: `source`, subsource, landing URL, referrer, and UTM fields stored on inquiries.

### WFOS-WEB-014

- Title: Public marketing content and WorkforceOS operational data must have separate sources of truth
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Marketing copy in `sites/pierone`; jobs/applications/inquiries in WorkforceOS.

### WFOS-WEB-015

- Title: The public website must remain usable if WorkforceOS dynamic services are temporarily unavailable
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Marketing pages render without the API. Careers shows a safe unavailable state. Forms do not fake success.

### WFOS-WEB-016

- Title: Frequently changing operational public content must be controllable from WorkforceOS
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: `public_content_items` plus `/app/public-content` can feature jobs, SkillBridge roles, banners, notices, announcements, and industry campaigns without editing website code.

### WFOS-WEB-017

- Title: Public website must consume versioned public content APIs and omit empty sections
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: `GET /api/public/v1/content` returns public-safe DTOs. Homepage, Careers, and SkillBridge omit sections when no active content exists and do not error.

### WFOS-WEB-018

- Title: Public content changes must appear without a website redeploy
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: Gateway cache ≤ 120s; public site `revalidate` 60s; optional `/api/revalidate`. Closed jobs drop from featured payloads at query time.

### WFOS-WEB-019

- Title: Public content publishing is permissioned and audited
- Module: public-site
- Priority: locked
- Status: approved
- Acceptance: `public_content.read|manage|publish`. Recruiters do not receive publish by default. Scout material publishing requires confirmation. Create/edit/activate/archive/linked-job changes are audited.



