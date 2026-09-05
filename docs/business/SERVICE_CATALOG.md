# Service Catalog

Status: Phase 4 launch service engines  
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
Primary records: occupations, skills, forecasts, solution plans, projects.

## Delivery commercial model (Phase 4)

Each service has a versioned pricing model (percentage fee, fixed project, or monthly recurring), configured min/max guidance, a legal package, a project template, and expansion services. Pricing outside the configured range requires `pricing.approve`. Client-facing proposals, contracts, and deliverables require human approval.

## Out of scope for V1

- Temp staffing
- Payroll
- Public job marketplace
- Ownership/cap-table administration
