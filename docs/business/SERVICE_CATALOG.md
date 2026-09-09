# Service Catalog

Status: Phase 6 operational finance on the five launch services  
These are the five launch service engines WorkforceOS supports. Definitions are stored as approved `service_versions`. Application code loads those records; it does not invent material service rules.

## 1. Professional Search

Code: `professional-search`  
Purpose: retained or project search against the internal Talent Network first, then approved external sources.  
Primary records: jobs, candidates, matches, submissions, interviews, offers, placements.  
Locked rules:

- Search internal talent before external sourcing (WFOS-TAL-002).
- Candidate-job scores are job-specific (WFOS-TAL-003).
- Humans control advancement.

Operating path: opportunity → discovery → solution plan → proposal → contract (Direct Hire or Retained Search Agreement) → delivery project (Intake through Guarantee). Search execution still uses `search_projects`; delivery uses `projects`.

## 2. Military Talent Opportunity Assessment

Code: `military-talent-opportunity-assessment`  
Purpose: assess whether a client workforce need can be served through military talent translation.  
Primary records: military occupations, civilian mappings, installations, solution plans.  
Locked rules:

- Support Army MOS, Navy Rating, Air Force AFSC, Marine MOS, Coast Guard Rating, and applicable Space Force classifications (WFOS-MIL-001).
- Map occupations to civilian roles, skills, gaps, bridge training, explanations, and likely installations (WFOS-MIL-002 through WFOS-MIL-005).
- Do not invent mapping rules (DEC-MIL-001). SkillBridge is a pathway/opportunity type inside this practice, not a sixth launch service and not a PierOne-owned program.

Military Talent operating path (DEC-MIL-005), used across assessments, pathway operations, public intake, and Scout:

Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity Search / Development → Employer Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other Transition Pathway → Placement → Conversion.

A transitioning service member may join the Military Talent Network without a current opening. Transition Talent Profile is a military-transition overlay on the existing Talent Network candidate. Employer Opportunity names the host/employer. Operator access bundle: Military Talent Partner.

## 3. TA Performance Assessment

Code: `ta-performance-assessment`  
Purpose: evaluate a client's talent acquisition operating performance and recommend improvements.  
Primary records: companies, opportunities, discovery, solution plans, proposals, contracts, projects, assessments.  
WorkforceOS stores the operating work product. External TA tools remain integrations.

## 4. Fractional Talent Partner

Code: `fractional-talent-partner`  
Purpose: ongoing fractional talent leadership and operating support for a client.  
Primary records: companies, solution plans, projects, tasks, legal packages, monthly billing events.  
This is an engagement model, not temp staffing or payroll. Scope is never unlimited recruiting.

## 5. Workforce Pipeline Assessment

Code: `workforce-pipeline-assessment`  
Purpose: assess current and future workforce supply against demand and recommend pipeline actions.  
Primary records: `workforce_assessments`, `workforce_roles`, baselines, forecasts, supply, gaps, talent pipelines, education partners, career paths, scenarios, `workforce_pipeline_plans`, delivery `projects`.

Operating path: opportunity → discovery → solution plan → proposal/contract → delivery project, then Phase 5 intelligence on that engagement:

1. Capture planning-level workforce roles (not recruiting requisitions) and baseline headcount/assumptions.
2. Generate versioned 12/24/36-month demand forecasts from configurable components.
3. Model supply (internal mobility, military overlay, Talent Network aggregates, education, apprenticeships, external recruiting).
4. Calculate structured gaps and allocate pipeline capacity. Warn when planned capacity does not cover the gap.
5. Draft a PierOne Workforce Pipeline Plan. Human approval is required before client delivery. Approved roadmaps create `project_tasks` on the existing delivery project.

Locked rules: WFOS-WF-001 through WFOS-WF-005. Forecasts are estimates with provenance. BLS/Census/O\*NET values are never invented.

## Delivery commercial model (Phase 4)

Each service has a versioned pricing model (percentage fee, fixed project, or monthly recurring), configured min/max guidance, a legal package, a project template, and expansion services. Pricing outside the configured range requires `pricing.approve`. Client-facing proposals, contracts, and deliverables require human approval.

## Out of scope for V1

- Temp staffing
- Payroll
- Public job marketplace
- Ownership/cap-table administration
- Dual careers as a sixth launch service
- A PierOne-owned SkillBridge program or SkillBridge-as-a-service
- In-app Academy / LMS (Phase E; not yet built)

Repeatable delivery steps mapped to live WorkforceOS screens: `docs/business/SERVICE_PLAYBOOKS.md`.
