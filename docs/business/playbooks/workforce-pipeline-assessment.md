# Workforce Pipeline Assessment

Catalog name: **Workforce Pipeline Assessment**  
Code: `workforce-pipeline-assessment`  
Kind: launch service (one of five)

Cites: `docs/business/SERVICE_CATALOG.md`, `docs/workflows/SERVICE_WORKFLOWS.md` (Workforce Pipeline Assessment), approved `service_workflows` for this code, WFOS-WF-001 through WFOS-WF-005, DEC-WF-003, `docs/business/PIERONE_OPERATING_MANUAL.md`.

Forecasts are estimates with provenance. Do not fabricate BLS, Census, or O\*NET values. Planning-level workforce roles are **not** recruiting requisitions. After plan approval, roadmap tasks land on the **existing** delivery project — do not create a second project system.

Legal package: required MSA, Workforce Assessment SOW, NDA; conditional DPA.

Delivery project phases (`workforce-pipeline-assessment-delivery`): Discovery → Workforce Data → Demand Analysis → Supply Analysis → Gap Analysis → Military Overlay → Pipeline Design → Scenario Analysis → Human Review → Executive Presentation.

## Step map

### 1. Qualify a pipeline assessment

| | |
| --- | --- |
| **WorkforceOS screen** | Inquiry `/app/crm/inquiries/[id]` then Opportunity `/app/opportunities/[id]` with `serviceCode` = `workforce-pipeline-assessment`. Catalog `/app/services/workforce-pipeline-assessment`. |
| **Required data** | Headcount, job families, locations, hiring forecast, skills (catalog). |
| **Owner** | Workforce Consultant, Senior Talent Partner, Operations, Administrator / Executive |
| **Access / permission** | `opportunities.read` / `opportunities.write` |
| **Approval** | Human conversion |
| **Scout prompt** | `SEARCH` / `CREATE` opportunity-from-inquiry (confirm). |
| **Deliverable** | Opportunity on this service code |
| **Next step** | Discovery |

### 2. Collect workforce and demand signals

| | |
| --- | --- |
| **WorkforceOS screen** | Discovery `/app/discovery` / `/app/discovery/[id]`. Approved questions include headcount, families, locations, attrition, retirement risk, forecast, growth, skills, compensation, training, mobility, career paths, education partners, military supply, apprenticeship, constraints. CSV/manual baseline — Excel parsing is not configured (`SERVICE_WORKFLOWS.md`). |
| **Required data** | Client-provided workforce data. Do not fabricate headcount. |
| **Owner** | Workforce Consultant |
| **Access / permission** | `discovery.read` / `discovery.write` |
| **Approval** | Operator capture with missing-data notes |
| **Scout prompt** | `SUMMARIZE` this discovery. Never invent headcount or forecasts. |
| **Deliverable** | Discovery record |
| **Next step** | Solution / commercial close, then intelligence on the engagement |

### 3. Solution, proposal, contract, delivery project

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/solutions/[id]`; `/app/proposals/[id]`; `/app/contracts/[id]`; `/app/legal/templates`; `/app/projects/[id]` |
| **Required data** | Approved service version. Template `workforce-pipeline-assessment-delivery`. |
| **Owner** | Workforce Consultant (plan). Operations / Administrator / Executive for `proposals.approve` / `contracts.approve` / `pricing.approve`. |
| **Access / permission** | `solutions.approve`; `proposals.write`; `contracts.approve`; `projects.write` |
| **Approval** | Same commercial gates as [Proposal / Contract Handoff](proposal-contract-handoff.md) |
| **Scout prompt** | `SHOW_RECORD` solution / project. No send. |
| **Deliverable** | Executed SOW; delivery project |
| **Next step** | Workforce planning intelligence |

### 4. Capture planning roles and baseline

| | |
| --- | --- |
| **WorkforceOS screen** | Workforce planning `/app/workforce`; Assessments `/app/workforce/assessments`; Assessment detail `/app/workforce/assessments/[assessmentId]`; Roles `/app/workforce/roles`; Skills `/app/workforce/skills`. |
| **Required data** | Planning-level roles (not jobs). Baseline headcount/assumptions on the assessment. |
| **Owner** | Workforce Consultant |
| **Access / permission** | `workforce.read` / `workforce.write` |
| **Approval** | Operator entry. Do not duplicate recruiting jobs. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this workforce assessment. |
| **Deliverable** | Assessment + role baseline |
| **Next step** | Demand forecast |

### 5. Demand, supply, and gaps

| | |
| --- | --- |
| **WorkforceOS screen** | Forecasts `/app/workforce/forecasts`; Supply `/app/workforce/supply`; Gaps `/app/workforce/gaps`; Assessment `/app/workforce/assessments/[assessmentId]`. Catalog operating path: versioned 12/24/36-month forecasts from configurable components. |
| **Required data** | Assumptions, method, confidence, version, reviewer. Supply from internal mobility, military overlay, Talent Network **aggregates**, education, apprenticeships, recruiting pipelines. |
| **Owner** | Workforce Consultant |
| **Access / permission** | `workforce.write` / `workforce.analyze`; `forecasts.read` / `forecasts.write` |
| **Approval** | Forecasts are estimates with provenance. Do not invent labor-market values. Warn when planned capacity does not cover the gap (catalog). |
| **Scout prompt** | `SUMMARIZE` stored forecasts and gaps. Never fabricate BLS/Census/O\*NET. |
| **Deliverable** | Versioned forecast; structured gaps |
| **Next step** | Overlays and pipeline design |

### 6. Military overlay, pipelines, pathways, scenarios

| | |
| --- | --- |
| **WorkforceOS screen** | Military supply `/app/workforce/military-supply`; Pipelines `/app/workforce/pipelines` and `/app/workforce/pipelines/[pipelineId]`; Career pathways `/app/workforce/career-pathways` and `/app/workforce/career-pathways/[pathId]`; Education partners `/app/workforce/education-partners`; Training `/app/workforce/training-programs`; Apprenticeships `/app/workforce/apprenticeships`; Scenarios `/app/workforce/scenarios`. Occupation/installation libraries under `/app/military/*` are the mapping source — do not invent maps. |
| **Required data** | Phase 3 mappings for military overlay. Talent Network coverage as aggregates (no unnecessary PII). |
| **Owner** | Workforce Consultant. Military Talent Partner may support mapping review (`military.review`) but does not own this commercial project. |
| **Access / permission** | `workforce.write`; `pipelines.write`; `career_paths.write`; `education_partners.write`; `training_programs.write`; `scenario_models.write`; `military.read` |
| **Approval** | Overlays use stored mappings only (DEC-MIL-001). |
| **Scout prompt** | `SEARCH` pipelines / scenarios for this assessment. No candidate email or resume in the prompt. |
| **Deliverable** | Pipeline allocations; scenario comparisons as planning estimates |
| **Next step** | Workforce Pipeline Plan |

### 7. Draft and approve the Workforce Pipeline Plan

| | |
| --- | --- |
| **WorkforceOS screen** | Assessment `/app/workforce/assessments/[assessmentId]` (generate / submit / approve plan); Deliverables `/app/projects/deliverables`; Review Queue `/app/ai-operations/review`. |
| **Required data** | Draft PierOne Workforce Pipeline Plan. Workflow: human approval before client delivery. |
| **Owner** | Workforce Consultant (`workforce.approve`) |
| **Access / permission** | `workforce.approve`; `deliverables.approve` |
| **Approval** | Required. Agents cannot approve their own material output. |
| **Scout prompt** | `DRAFT` plan narrative for review. Treat as unapproved until a human approves. |
| **Deliverable** | Approved Workforce Pipeline Plan |
| **Next step** | Roadmap tasks on the same project |

### 8. Create roadmap tasks, present, close out

| | |
| --- | --- |
| **WorkforceOS screen** | Assessment `/app/workforce/assessments/[assessmentId]` (create roadmap tasks); Project `/app/projects/[id]`; Analytics `/app/workforce/analytics`; Invoices `/app/finance/invoices` (list only); Company `/app/companies/[id]?tab=solutions`. |
| **Required data** | Approved plan. Roadmap `project_tasks` on the existing delivery project (0–90 days through 12–24 months per catalog). |
| **Owner** | Workforce Consultant (tasks / presentation). Operations (invoice). |
| **Access / permission** | `projects.write`; `invoices.read`; `opportunities.write` for follow-on |
| **Approval** | Executive presentation is client-facing (`deliverables.approve`). Expansion suggestions: Military Talent Opportunity Assessment, Fractional Talent Partner, or Professional Search only. |
| **Scout prompt** | `CREATE_TASK` (confirm) only after the plan is approved. `SUMMARIZE` the project. |
| **Deliverable** | Roadmap tasks; executive presentation; billing event |
| **Next step** | [Project Delivery / Closeout](project-delivery-closeout.md) |
