# Requirements Registry

Status: Phase 5 locked set  
Database mirror: `requirements` table.

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
- Acceptance: Professional Search, Military Talent Opportunity Assessment, TA Performance Assessment, Fractional Talent Partner, and Workforce Pipeline Assessment exist as versioned services.

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
- Acceptance: client-facing material outputs cannot be marked approved by the originating agent.

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
