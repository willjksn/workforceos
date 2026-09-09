# Fractional Talent Partner

Catalog name: **Fractional Talent Partner**  
Code: `fractional-talent-partner`  
Kind: launch service (one of five)

Cites: `docs/business/SERVICE_CATALOG.md`, `docs/workflows/SERVICE_WORKFLOWS.md` (Fractional Talent Partner), approved `service_workflows` for this code, `docs/business/PIERONE_OPERATING_MANUAL.md`.

This is an engagement model — **not** temp staffing or payroll. Scope is never unlimited recruiting. Demand above capacity is an exception, not silent over-commitment.

Legal package: required MSA, Fractional TA SOW, NDA, DPA, confidentiality/IP agreement.

Delivery project phases (`fractional-talent-partner-delivery`): Onboarding → Capacity Setup → Requisition Intake → Recruiting Operations → Weekly Reporting → Monthly Review → Capacity Review → Renewal/Expansion.

Search work opened under this engagement still follows [Recruiting & Hiring](recruiting-and-hiring.md) and Talent Network first.

## Step map

### 1. Qualify fractional leadership (not a payroll engine)

| | |
| --- | --- |
| **WorkforceOS screen** | Inquiry `/app/crm/inquiries/[id]` then Opportunity `/app/opportunities/[id]` with `serviceCode` = `fractional-talent-partner`. Catalog `/app/services/fractional-talent-partner`. |
| **Required data** | Open reqs, hiring forecast, recruiter capacity, SLA expectations, excluded work (catalog). |
| **Owner** | Senior Talent Partner, Operations, Workforce Consultant, Administrator / Executive |
| **Access / permission** | `opportunities.read` / `opportunities.write` |
| **Approval** | Human conversion. Reject unlimited-recruiting framing (workflow exception). |
| **Scout prompt** | `SEARCH` / `CREATE` opportunity-from-inquiry (confirm). |
| **Deliverable** | Opportunity on this service code |
| **Next step** | Scope discovery |

### 2. Scope operating responsibilities and cadence

| | |
| --- | --- |
| **WorkforceOS screen** | Discovery `/app/discovery` / `/app/discovery/[id]`. Approved questions: open reqs, forecast, capacity, business units, role types, hiring managers, urgency, technologies, reporting, SLAs, excluded work, cadence, client access. |
| **Required data** | Covered and excluded work must be explicit. |
| **Owner** | Senior Talent Partner (workflow `responsibleRole`) |
| **Access / permission** | `discovery.read` / `discovery.write` |
| **Approval** | Operator capture |
| **Scout prompt** | `SUMMARIZE` this discovery. Never describe unlimited recruiting. |
| **Deliverable** | Discovery with capacity and exclusions |
| **Next step** | Engagement plan |

### 3. Approve the engagement plan and legal package

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/solutions/[id]`; `/app/proposals/[id]`; `/app/contracts/[id]`; `/app/legal/templates` |
| **Required data** | Fractional TA Operating Plan; legal package linked to this engagement. Monthly recurring pricing inside configured range unless `pricing.approve`. |
| **Owner** | Senior Talent Partner drafts the plan (`solutions.approve`). Contract execute: Operations / Administrator / Executive. |
| **Access / permission** | `solutions.approve`; `proposals.write` / `proposals.approve`; `contracts.approve`; `legal.read`; `pricing.approve` |
| **Approval** | Human-approved plan and legal package before delivery. Do not start without contract or audited override. |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` solution / proposal / contract. `DRAFT` stays internal. Scout cannot send or execute. |
| **Deliverable** | Approved operating plan; executed SOW |
| **Next step** | Delivery project |

### 4. Open the delivery project

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/projects` / `/app/projects/[id]` |
| **Required data** | Template `fractional-talent-partner-delivery`. Monthly billing events from contract value / cadence. |
| **Owner** | Operations, Senior Talent Partner, Administrator / Executive |
| **Access / permission** | `projects.read` / `projects.write`; `billing.read` / `billing.write` |
| **Approval** | Contract gate |
| **Scout prompt** | `CREATE_TASK` (confirm) for weekly reporting and monthly review. |
| **Deliverable** | Active delivery project |
| **Next step** | Recurring operations |

### 5. Run recurring talent operations

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (Requisition Intake / Recruiting Operations / Weekly Reporting). Jobs `/app/jobs` for covered reqs. Candidates `/app/talent`. Recruiting Workbench `/app/recruiting/workbench`. |
| **Required data** | Scoped capacity. New jobs still complete internal Talent Network search before external sourcing. |
| **Owner** | Senior Talent Partner; Recruiter Standard executes authorized job work |
| **Access / permission** | `projects.write`; `jobs.write`; `candidates.read`; Recruiter Standard has no `opportunities.read` |
| **Approval** | Escalate capacity breaches — do not silently over-commit. Client submissions still need `submissions.approve`. |
| **Scout prompt** | `SEARCH` this project and its jobs. `CREATE_TASK` / `CREATE_FOLLOW_UP` (confirm). `FIND_MATCHES` on a covered job. |
| **Deliverable** | Weekly reporting tasks; in-scope recruiting work |
| **Next step** | Monthly review |

### 6. Review outcomes with the client

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (Monthly Review / Capacity Review); Deliverables `/app/projects/deliverables`; Reports `/app/reports` |
| **Required data** | KPI snapshot from stored work (active reqs, intake SLA, shortlist SLA, fill rate, capacity, stakeholder satisfaction). Do not invent KPIs. |
| **Owner** | Senior Talent Partner |
| **Access / permission** | `deliverables.write`; client-facing approve is `deliverables.approve` (Operations / Workforce Consultant / Administrator / Executive — Senior Talent Partner has deliverable write, not approve) |
| **Approval** | Client-facing monthly review needs `deliverables.approve`. Document unresolved issues. |
| **Scout prompt** | `SUMMARIZE` this month’s project. `DRAFT` a review outline for human approval. |
| **Deliverable** | Monthly Review |
| **Next step** | Renewal / expansion or closeout |

### 7. Renewal, expansion, or closeout

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]` (Renewal/Expansion); Finance `/app/finance` and Invoices `/app/finance/invoices` (list only); Company `/app/companies/[id]?tab=solutions`. |
| **Required data** | Monthly billing events. Completion rule: renewal/expansion review completed; open issues documented. |
| **Owner** | Operations (billing/invoice). Senior Talent Partner (commercial next step). |
| **Access / permission** | `invoices.read` / `invoices.write`; `finance.approve`; `opportunities.write` |
| **Approval** | Invoice from stored events. QuickBooks post is off until Phase I. Expansion only to Professional & Technical Search, Military Talent Opportunity Assessment, or Workforce Pipeline Assessment (workflow expansion rules). |
| **Scout prompt** | `SEARCH` finance. `CREATE` a follow-on opportunity (confirm) only with commercial access. |
| **Deliverable** | Billing events; renewal decision; optional new opportunity |
| **Next step** | Continue the cadence or SOLVE again on a new offer |
