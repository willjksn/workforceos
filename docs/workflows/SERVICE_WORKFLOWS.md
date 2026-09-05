# Service Workflows

Status: Phase 4 service engines, proposals, contracts, and delivery  
Agents must read approved workflow records from the database. They must not improvise material workflow rules.

## Workflow versioning

Each service has:

- `services` — catalog identity
- `service_versions` — approved definition snapshot
- `service_workflows` — ordered, versioned steps and gates

A solution plan references a specific service version. A proposal is generated from an approved solution plan. A delivery project is created from an approved solution plan plus the approved workflow template, normally after contract execution.

Reusable engine path:

Service → Active Version → Active Workflow → Opportunity → Discovery → Solution Plan → Proposal → Contract → Project → Deliverables → Billing Events → Closeout → Expansion

## Launch workflows

### Professional Search

1. Confirm client need and capture a structured job record (not a single intake blob).
2. Activate search. WorkforceOS must run Internal Talent Network review before any external sourcing hook.
3. Score job-specific matches with component scores, strengths, gaps, and provenance. Do not create a universal candidate score. Do not auto-reject on score.
4. Recruiter screens and advances the pipeline (`identified` → `contacted` → `screening` → `qualified` → `submitted` → `interview` → `finalist` → `offer` → `placed`). Movements are audited. Material rejection is a human decision.
5. Human recruiter prepares and approves the client submission packet.
6. Interviews accumulate as history. Stalled client feedback is flagged in-app.
7. Offers are recorded, not sent. Placement copies fee and guarantee days from the search agreement.
8. Preserve silver medalists and prior applicants for rediscovery.

Delivery project phases: Intake, Search Strategy, Sourcing, Candidate Assessment, Client Submission, Interviews, Offer, Placement, Guarantee.

### Military Talent Opportunity Assessment

1. Capture client civilian roles, locations, and constraints.
2. Translate civilian demand to military occupations using stored, reviewed mappings.
3. Map skills, certifications, gaps, and bridge training with source/version/confidence.
4. Identify likely installations/bases from occupation–installation links, not unsupported guesses.
5. Produce recommendations as drafts. Agent mappings start pending.
6. Require a human military reviewer. The originating agent cannot approve its own mapping.
7. Create a delivery project from the approved solution plan.

Delivery project phases: Discovery, Job Inventory, Military Crosswalk, Installation Analysis, Workforce Opportunity Analysis, Recommendations, Human Review, Client Presentation, Final Report.

Test fixture workflow for Phase 1 uses this service.

### TA Performance Assessment

1. Collect TA operating data and current process.
2. Analyze funnel, sourcing mix, and internal talent reuse.
3. Recommend operating changes.
4. Human review of client-facing findings.
5. Optional implementation project.

Delivery project phases: Discovery, Data Collection, Process Mapping, Maturity Assessment, Root-Cause Analysis, Future State, Roadmap, Executive Presentation.

### Fractional Talent Partner

1. Scope operating responsibilities and cadence.
2. Approve engagement plan and legal package.
3. Run recurring talent operating work inside WorkforceOS.
4. Review outcomes with the client on a defined cadence.

Delivery project phases: Onboarding, Capacity Setup, Requisition Intake, Recruiting Operations, Weekly Reporting, Monthly Review, Capacity Review, Renewal/Expansion.

### Workforce Pipeline Assessment

1. Collect current workforce and demand signals.
2. Map occupations and skills.
3. Forecast gaps.
4. Recommend pipeline actions.
5. Human approval of client-facing recommendations.

Delivery project phases: Discovery, Workforce Data, Demand Analysis, Supply Analysis, Gap Analysis, Military Overlay, Pipeline Design, Scenario Analysis, Human Review, Executive Presentation.

## Approval gates

Material AI recommendations require provenance (WFOS-AI-001).  
Material client-facing AI outputs require human approval (WFOS-AI-002).  
Agents cannot approve their own material output.  
Proposals cannot be sent until approved.  
Client-facing deliverables cannot be delivered until approved.  
Pricing outside the configured range requires `pricing.approve`.  
Delivery projects require an executed contract unless a Managing Partner override is audited.
