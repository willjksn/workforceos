# Talent Acquisition Performance Assessment

Catalog name: **Talent Acquisition Performance Assessment**  
Catalog short name: TA Performance Assessment  
Code: `ta-performance-assessment`  
Kind: launch service (one of five)

Cites: `docs/business/SERVICE_CATALOG.md`, `docs/workflows/SERVICE_WORKFLOWS.md` (TA Performance Assessment), approved `service_workflows` for `ta-performance-assessment`, `docs/business/PIERONE_OPERATING_MANUAL.md`.

WorkforceOS stores the operating work product. External TA tools stay behind the Integration Hub. Do not invent TTF, funnel, or agency-spend numbers.

Legal package: required MSA, TA Performance Assessment SOW, NDA; conditional DPA.

Delivery project phases (`ta-performance-assessment-delivery`): Discovery → Data Collection → Process Mapping → Maturity Assessment → Root-Cause Analysis → Future State → Roadmap → Executive Presentation.

## Step map

### 1. Qualify an operating assessment (not staffing)

| | |
| --- | --- |
| **WorkforceOS screen** | Inquiry `/app/crm/inquiries/[id]` then Opportunity `/app/opportunities/[id]` with `serviceCode` = `ta-performance-assessment`. Catalog `/app/services/ta-performance-assessment`. No `/app/qualification`. |
| **Required data** | Client wants a TA operating assessment. Workflow qualification trigger: not staffing payroll. |
| **Owner** | Senior Talent Partner, Workforce Consultant, Operations, Administrator / Executive |
| **Access / permission** | `opportunities.read` / `opportunities.write` |
| **Approval** | Human conversion |
| **Scout prompt** | `SEARCH` / `CREATE` opportunity-from-inquiry (confirm). |
| **Deliverable** | Opportunity on this service code |
| **Next step** | Discovery |

### 2. Collect TA operating data

| | |
| --- | --- |
| **WorkforceOS screen** | Discovery `/app/discovery` / `/app/discovery/[id]`. Use the approved workflow questions (TTF, workload, aging, funnel, offer acceptance, agency spend, sourcing, candidate experience, manager satisfaction, process delays, technology, analytics, governance, vendor management). |
| **Required data** | Operating metrics the client actually provided. Missing data is flagged — never fabricated (workflow exception). |
| **Owner** | Workforce Consultant (workflow `responsibleRole`). Senior Talent Partner may capture discovery. |
| **Access / permission** | `discovery.read` / `discovery.write` |
| **Approval** | Operator capture |
| **Scout prompt** | `SUMMARIZE` this discovery. Do not invent KPI values in the prompt or the draft. |
| **Deliverable** | Discovery with missing-data notes |
| **Next step** | Solution plan |

### 3. Approve the assessment solution

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/solutions` / `/app/solutions/[id]` |
| **Required data** | Approved `ta-performance-assessment` version |
| **Owner** | Workforce Consultant, Senior Talent Partner, Operations, Administrator / Executive |
| **Access / permission** | `solutions.write` / `solutions.approve`; `pricing.approve` if outside range |
| **Approval** | Human `solutions.approve` |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this solution. |
| **Deliverable** | Approved plan |
| **Next step** | [Proposal / Contract Handoff](proposal-contract-handoff.md) |

### 4. Contract and delivery project

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/proposals/[id]`; `/app/contracts/[id]`; `/app/legal/templates`; `/app/projects/[id]` |
| **Required data** | Legal package on this engagement. Template `ta-performance-assessment-delivery`. |
| **Owner** | Workforce Consultant / Senior Talent Partner draft. Operations / Administrator / Executive execute the contract. |
| **Access / permission** | `proposals.write` / `proposals.approve`; `contracts.approve`; `projects.write` |
| **Approval** | Contract gate before the project |
| **Scout prompt** | `SHOW_RECORD` project. `CREATE_TASK` (confirm). |
| **Deliverable** | Delivery project |
| **Next step** | Analyze funnel and sourcing mix |

### 5. Analyze funnel, sourcing mix, and internal reuse

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (Data Collection / Process Mapping / Maturity Assessment phases). Recruiting Analytics `/app/recruiting/analytics` is firm operating data — do not treat it as the client’s TA system of record. Reports `/app/reports`. |
| **Required data** | Discovery answers only. Workflow: incomplete data stays listed as missing. |
| **Owner** | Workforce Consultant |
| **Access / permission** | `projects.write`; `reports.read`; `recruiting.analytics.read` |
| **Approval** | Analysis is a draft until human review of client-facing findings. |
| **Scout prompt** | `SUMMARIZE` this project’s collected data. Never invent funnel numbers. |
| **Deliverable** | Current-state findings draft |
| **Next step** | Recommend operating changes |

### 6. Recommend operating changes

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (Future State / Roadmap); Deliverables `/app/projects/deliverables` |
| **Required data** | Current-state analysis. Draft uses the approved service version. Do not invent service policies. |
| **Owner** | Workforce Consultant |
| **Access / permission** | `deliverables.write` |
| **Approval** | Still a draft |
| **Scout prompt** | `DRAFT` improvement-plan language for human review. |
| **Deliverable** | TA Performance Improvement Plan draft (30/60/90 roadmap) |
| **Next step** | Human review |

### 7. Human review of client-facing findings

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/projects/[id]`; `/app/projects/deliverables`; Review Queue `/app/ai-operations/review` |
| **Required data** | Draft plan |
| **Owner** | Workforce Consultant (`deliverables.approve`). Operations and Administrator / Executive also have deliverable approve. |
| **Access / permission** | `deliverables.approve` |
| **Approval** | Required before client delivery. Agents cannot approve their own output. |
| **Scout prompt** | `SHOW_RECORD` the deliverable. Do not send. |
| **Deliverable** | Approved TA Performance Improvement Plan |
| **Next step** | Executive presentation |

### 8. Executive presentation, optional implementation, closeout

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (Executive Presentation phase); Invoices `/app/finance/invoices` (list only); Company `/app/companies/[id]?tab=solutions` for expansion (no `/app/expansion`). |
| **Required data** | Approved executive presentation. Billing trigger from the contract. Optional implementation project only from an approved plan + executed contract (workflow). |
| **Owner** | Workforce Consultant (content). Operations (invoice / closeout). |
| **Access / permission** | `deliverables.approve`; `invoices.read`; `opportunities.write` for a follow-on |
| **Approval** | Suggested expansion ≠ sold. Follow-on offers are Fractional Talent Partner or Professional & Technical Search only (workflow expansion rules). |
| **Scout prompt** | `SUMMARIZE` this project. `CREATE` a follow-up opportunity only with confirmation and commercial access. |
| **Deliverable** | Executive presentation; billing event; optional implementation project |
| **Next step** | Closeout or a new opportunity on one of the five offers |
