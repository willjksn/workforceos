# Service Workflows

Status: Phase 1 version-controlled workflow foundation  
Agents must read approved workflow records from the database. They must not improvise material workflow rules.

## Workflow versioning

Each service has:

- `services` — catalog identity
- `service_versions` — approved definition snapshot
- `service_workflows` — ordered, versioned steps and gates

A solution plan references a specific service version. A delivery project is created from an approved solution plan.

## Launch workflows

### Professional Search

1. Confirm client need and job record.
2. Search internal Talent Network.
3. Score job-specific matches with explanations.
4. Recruiter reviews and advances candidates.
5. Submit, interview, offer, place.
6. Preserve silver medalists and prior applicants for rediscovery.

### Military Talent Opportunity Assessment

1. Capture client civilian roles, locations, and constraints.
2. Translate civilian demand to military occupations.
3. Map skills, certifications, gaps, and bridge training.
4. Identify likely installations/bases.
5. Produce recommendations as drafts.
6. Require human approval before client-facing output.
7. Create a delivery project from the approved solution plan.

Test fixture workflow for Phase 1 uses this service.

### TA Performance Assessment

1. Collect TA operating data and current process.
2. Analyze funnel, sourcing mix, and internal talent reuse.
3. Recommend operating changes.
4. Human review of client-facing findings.
5. Optional implementation project.

### Fractional Talent Partner

1. Scope operating responsibilities and cadence.
2. Approve engagement plan and legal package.
3. Run recurring talent operating work inside WorkforceOS.
4. Review outcomes with the client on a defined cadence.

### Workforce Pipeline Assessment

1. Collect current workforce and demand signals.
2. Map occupations and skills.
3. Forecast gaps.
4. Recommend pipeline actions.
5. Human approval of client-facing recommendations.

## Approval gates

Material AI recommendations require provenance (WFOS-AI-001).  
Material client-facing AI outputs require human approval (WFOS-AI-002).  
Agents cannot approve their own material output.
