# Requirements Registry

Status: Phase 3 locked set  
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
