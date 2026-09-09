# Project Delivery / Closeout

Name: **Project Delivery / Closeout**  
Kind: shared delivery and expansion (not a sixth client offer)

Cites: `docs/business/PIERONE_OPERATING_MANUAL.md` (Project → Delivery → Reporting → Invoice → Expansion), `docs/workflows/SERVICE_WORKFLOWS.md` reusable engine path and approval gates.

This playbook covers **consulting delivery projects** (`/app/projects`). Professional & Technical Search execution still uses Jobs / Talent — see [Recruiting & Hiring](recruiting-and-hiring.md). Workforce intelligence screens are in [Workforce Pipeline Assessment](workforce-pipeline-assessment.md).

Delivery projects require an executed contract unless a Managing Partner override is audited.

## Step map

### 1. Create the delivery project

| | |
| --- | --- |
| **WorkforceOS screen** | Projects `/app/projects` and `/app/projects/[id]` |
| **Required data** | Approved solution plan + approved workflow template + executed contract (or audited override). Template codes: `professional-search-delivery`, `military-talent-assessment-delivery`, `ta-performance-assessment-delivery`, `fractional-talent-partner-delivery`, `workforce-pipeline-assessment-delivery`. |
| **Owner** | Operations, Senior Talent Partner, Workforce Consultant, Administrator / Executive |
| **Access / permission** | `projects.read` / `projects.write` |
| **Approval** | Contract gate |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` this project. `CREATE_TASK` / `ASSIGN` (confirm). |
| **Deliverable** | Project with the approved phases |
| **Next step** | Delivery work |

### 2. Run phases, tasks, and meetings

| | |
| --- | --- |
| **WorkforceOS screen** | Project detail `/app/projects/[id]` (phases, tasks, meetings, billing). There is no separate `/app/meetings` route. |
| **Required data** | Phase list from the approved project template. Recurring fractional cadence uses Weekly Reporting / Monthly Review phases. |
| **Owner** | Same as project write. Recruiter Standard can `projects.read` only. |
| **Access / permission** | `projects.write` |
| **Approval** | Operator work. Capacity breaches on fractional work must be escalated (workflow exception). |
| **Scout prompt** | `SUMMARIZE` this project. `CREATE_TASK` / `CREATE_FOLLOW_UP` (confirm). |
| **Deliverable** | Completed tasks on the same project |
| **Next step** | Client-facing deliverable |

### 3. Produce and approve deliverables

| | |
| --- | --- |
| **WorkforceOS screen** | Deliverables `/app/projects/deliverables` and the project detail. Workforce Pipeline Plan is approved on `/app/workforce/assessments/[assessmentId]` then attached here. |
| **Required data** | Required client-facing deliverables from the catalog (intake summary, opportunity plan, improvement plan, operating plan, pipeline plan, executive presentation, etc.). |
| **Owner** | Authoring bundle per service. `deliverables.approve` is Operations, Workforce Consultant, Administrator / Executive. Senior Talent Partner and Military Talent Partner have deliverable write or read as granted — not approve on those bundles. |
| **Access / permission** | `deliverables.read` / `deliverables.write` / `deliverables.approve` |
| **Approval** | Client-facing deliverables cannot be delivered until approved. Agents cannot approve their own material output. |
| **Scout prompt** | `DRAFT` for review. `SHOW_RECORD` after approval. No send. |
| **Deliverable** | Approved client-facing file/record |
| **Next step** | Reporting |

### 4. Reporting

| | |
| --- | --- |
| **WorkforceOS screen** | Reports `/app/reports` and `/app/reports/[category]`; Command Center `/app`; Alerts `/app/alerts`. Workforce analytics `/app/workforce/analytics`; Military analytics `/app/military/analytics`; Recruiting analytics `/app/recruiting/analytics`. |
| **Required data** | Stored rows only. Reports do not invent metrics. |
| **Owner** | Bundles with `reports.read` (Senior Talent Partner, Recruiter Standard, Workforce Consultant, Military Talent Partner, Operations, Administrator / Executive) |
| **Access / permission** | `reports.read`; PII CSV export is `reports.export_pii` |
| **Approval** | None to read stored reports |
| **Scout prompt** | `SHOW_DASHBOARD`. `SEARCH` / `SUMMARIZE` the module in context. |
| **Deliverable** | Operating view from PostgreSQL |
| **Next step** | Invoice |

### 5. Invoice

| | |
| --- | --- |
| **WorkforceOS screen** | Finance `/app/finance`; Invoices `/app/finance/invoices` (**no** `/app/finance/invoices/[id]`); AR `/app/finance/ar`; Payments `/app/finance/payments`; schedules `/app/finance/schedules`; Company `/app/companies/[id]?tab=finance`. |
| **Required data** | Billing events from contract terms / placement / monthly cadence. Amounts are never invented. |
| **Owner** | Operations, Administrator / Executive, Senior Talent Partner (`finance.read` / `invoices.read`; write is tighter). Recruiter Standard does not own finance. |
| **Access / permission** | `finance.read` / `finance.write` / `finance.approve`; `invoices.read` / `invoices.write`; `billing.read` / `billing.write`; `payments.read` |
| **Approval** | Invoice from stored events. QuickBooks posting is off until Phase I. Scout cannot post AR. |
| **Scout prompt** | `SEARCH` finance. `SHOW_RECORD` links to `/app/finance/invoices`. |
| **Deliverable** | Invoice / AR row |
| **Next step** | Closeout / expansion |

### 6. Closeout

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (completion / close). Completion rules live on the approved workflow (required deliverables complete, billing trigger created, open issues documented). |
| **Required data** | Approved deliverables + billing trigger. Silver medalists for search: `/app/talent/silver-medalists`. |
| **Owner** | Operations, service owner bundle |
| **Access / permission** | `projects.write` |
| **Approval** | Human marks complete against the workflow completion rules |
| **Scout prompt** | `SUMMARIZE` closeout status. `CREATE_FOLLOW_UP` (confirm). |
| **Deliverable** | Closed project |
| **Next step** | Expansion (human-reviewed) |

### 7. Expansion

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/expansion`. Company `/app/companies/[id]?tab=solutions` after closeout. Open or create the next Opportunity `/app/opportunities` / `/app/opportunities/[id]` for a **catalog** service code only. |
| **Required data** | `expansion_recommendations` from the approved workflow’s expansion rules. Suggested ≠ sold. |
| **Owner** | Same commercial owners as [Client Discovery](client-discovery.md) |
| **Access / permission** | `opportunities.write` |
| **Approval** | Human review required. Then a new discovery → solution → proposal → contract. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` the company. `CREATE` a follow-up (confirm). Do not invent a sixth service. |
| **Deliverable** | New opportunity on one of the five offers, or no expansion |
| **Next step** | Return to [Client Discovery](client-discovery.md) (SOLVE again) |

## Allowed expansion targets (from approved workflows)

| From | May expand to |
| --- | --- |
| Professional & Technical Search | Fractional Talent Partner, Military Talent Opportunity Assessment, Workforce Pipeline Assessment |
| Military Talent Opportunity Assessment | Fractional Talent Partner, Workforce Pipeline Assessment |
| Talent Acquisition Performance Assessment | Fractional Talent Partner, Professional & Technical Search |
| Fractional Talent Partner | Professional & Technical Search, Military Talent Opportunity Assessment, Workforce Pipeline Assessment |
| Workforce Pipeline Assessment | Military Talent Opportunity Assessment, Fractional Talent Partner, Professional & Technical Search |
