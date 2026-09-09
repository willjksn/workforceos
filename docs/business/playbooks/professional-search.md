# Professional & Technical Search

Display name: **Professional & Technical Search**  
Code: `professional-search` (slug and workflow keys — DEC-SVC-005)  
Public path: `/services/professional-technical-search`. Same offer — not a sixth service.  
Kind: launch service (one of five)

Cites: `docs/business/SERVICE_CATALOG.md`, `docs/workflows/SERVICE_WORKFLOWS.md` (Professional & Technical Search), approved `service_workflows` for `professional-search`, `docs/business/PIERONE_OPERATING_MANUAL.md`. Do not invent search, scoring, or fee rules in this file.

Commercial close detail: [Client Discovery](client-discovery.md), [Proposal / Contract Handoff](proposal-contract-handoff.md), [Project Delivery / Closeout](project-delivery-closeout.md). Search execution detail: [Recruiting & Hiring](recruiting-and-hiring.md).

Legal package (from the approved workflow): required Direct Hire / search agreement; conditional MSA, NDA, DPA, Retained Search Agreement. Packages stay on the engagement.

Delivery project phases (approved template `professional-search-delivery`): Intake → Search Strategy → Sourcing → Candidate Assessment → Client Submission → Interviews → Offer → Placement → Guarantee.

## Step map

### 1. Capture the inquiry

| | |
| --- | --- |
| **WorkforceOS screen** | Public `/contact` (also `/work-with-us` → `/contact`). Internal: Website inquiries `/app/crm/inquiries` and `/app/crm/inquiries/[id]`. |
| **Required data** | Inquiry row. An inquiry is not an opportunity. |
| **Owner** | Senior Talent Partner, Operations, Workforce Consultant, Strategy & Technology, Administrator / Executive |
| **Access / permission** | `opportunities.read` to open the list. Recruiter Standard cannot. |
| **Approval** | None at intake. Do not auto-create an opportunity. |
| **Scout prompt** | `SEARCH` website inquiries. `SHOW_RECORD` on the inquiry. No PII in the prompt. |
| **Deliverable** | Stored `website_inquiries` row |
| **Next step** | Qualify |

### 2. Qualify and open the opportunity

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/qualification`. Inquiry `/app/crm/inquiries/[id]` (convert) then Opportunity `/app/opportunities/[id]`. Service Catalog `/app/services/professional-search`. |
| **Required data** | Company, contact when known, `serviceCode` = `professional-search` |
| **Owner** | Same commercial owners as step 1 |
| **Access / permission** | `opportunities.write` |
| **Approval** | Human conversion |
| **Scout prompt** | `CREATE` opportunity-from-inquiry (confirm). `SHOW_RECORD` on the opportunity. |
| **Deliverable** | Opportunity on the commercial spine |
| **Next step** | Discovery |

### 3. Discovery

| | |
| --- | --- |
| **WorkforceOS screen** | Discovery `/app/discovery` and `/app/discovery/[id]` |
| **Required data** | Role title, location, compensation range, required skills, hiring manager, fee/guarantee terms (catalog required inputs). Use the approved discovery questions on the `professional-search` workflow record — do not invent a new questionnaire. |
| **Owner** | Senior Talent Partner (primary). Recruiter Standard has `discovery.read` / `discovery.write`. Operations and Administrator / Executive. |
| **Access / permission** | `discovery.read` / `discovery.write` |
| **Approval** | Operator notes. Client-facing findings wait for the solution. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this discovery. `CREATE_TASK` or `CREATE_FOLLOW_UP` (confirm). `DRAFT` internal notes only. |
| **Deliverable** | Discovery record tied to the opportunity |
| **Next step** | Solution plan |

### 4. Solution plan

| | |
| --- | --- |
| **WorkforceOS screen** | Solution Plans `/app/solutions` and `/app/solutions/[id]` |
| **Required data** | Approved `professional-search` service version. Scope is retained or project search — not temp staffing. |
| **Owner** | Senior Talent Partner, Operations, Administrator / Executive. Workforce Consultant may write/approve solutions. |
| **Access / permission** | `solutions.write`; `solutions.approve`; `pricing.approve` if outside configured range |
| **Approval** | Human `solutions.approve` before proposal generation. Pricing outside min/max needs `pricing.approve` (Operations / Administrator / Executive). |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this solution. Material AI language goes to Review Queue `/app/ai-operations/review`. |
| **Deliverable** | Approved solution plan |
| **Next step** | Proposal / contract — see [Proposal / Contract Handoff](proposal-contract-handoff.md) |

### 5. Proposal and contract

| | |
| --- | --- |
| **WorkforceOS screen** | Proposals `/app/proposals` / `/app/proposals/[id]`; Contracts `/app/contracts` / `/app/contracts/[id]`; Legal templates `/app/legal/templates` (list only) |
| **Required data** | Approved plan; legal package linked to this engagement |
| **Owner** | Senior Talent Partner drafts (`proposals.write`). `proposals.approve` and `contracts.approve` are Operations / Administrator / Executive. Senior Talent Partner has `contracts.read` only. |
| **Access / permission** | `proposals.read` / `proposals.write` / `proposals.approve`; `contracts.read` / `contracts.write` / `contracts.approve`; `legal.read` |
| **Approval** | Draft → `internal_review` → human approve → send. Scout cannot send. Live DocuSign is not wired (Phase I). |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` the proposal or contract. `DRAFT` stays internal. |
| **Deliverable** | Approved proposal; executed contract (or audited Managing Partner override) |
| **Next step** | Delivery project, then search execution |

### 6. Open the delivery project

| | |
| --- | --- |
| **WorkforceOS screen** | Projects `/app/projects` and `/app/projects/[id]` (consulting delivery). Search still runs on Jobs. |
| **Required data** | Approved plan + executed contract (unless audited override). Template `professional-search-delivery`. |
| **Owner** | Operations, Senior Talent Partner, Administrator / Executive |
| **Access / permission** | `projects.read` / `projects.write` |
| **Approval** | Contract gate |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this project. `CREATE_TASK` (confirm). |
| **Deliverable** | Delivery project with Intake through Guarantee phases |
| **Next step** | Confirm the job record |

### 7. Confirm client need and structured job

| | |
| --- | --- |
| **WorkforceOS screen** | Jobs `/app/jobs` and `/app/jobs/[id]`. Older `/app/search-projects` and `/app/recruiting/requisitions` resolve into Jobs — not a second intake. |
| **Required data** | Structured job (not a single intake blob): title, location, skills, hiring manager. Workflow step: “Confirm client need and job record.” |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `jobs.read` / `jobs.write` / `jobs.create`. Publish uses `jobs.approve` / `jobs.publish`. |
| **Approval** | Public posting is optional and must omit confidential client identity. |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` this job. `CREATE` / `UPDATE` (confirm). |
| **Deliverable** | Job record linked to the search |
| **Next step** | Internal Talent Network search |

### 8. Search the internal Talent Network first

| | |
| --- | --- |
| **WorkforceOS screen** | Job `/app/jobs/[id]` (start / complete internal search). Candidates `/app/talent`, Talent Search `/app/talent/search`. |
| **Required data** | Activated job. Workflow step: “Search internal Talent Network.” |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `candidates.read`; restricted fields need `candidate_pii.read`. External adapters stay behind the Integration Hub. |
| **Approval** | Internal search must be marked complete before any external sourcing hook (WFOS-TAL-002). |
| **Scout prompt** | `SEARCH` candidates for this job. `FIND_MATCHES`. Never paste resume text, email, or phone. |
| **Deliverable** | Internal search project marked started, then complete |
| **Next step** | Job-specific scoring |

### 9. Score job-specific matches

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/matching`. Job `/app/jobs/[id]`, Job pipeline `/app/jobs/[id]/pipeline`, Candidate Pipeline `/app/pipeline`. |
| **Required data** | `candidate_job_matches` unique on `(candidate_id, job_id)`. Component scores, strengths, gaps, provenance. No universal candidate score (WFOS-TAL-003). |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `jobs.read`, `candidates.read` |
| **Approval** | Scores never auto-reject. |
| **Scout prompt** | `FIND_MATCHES`. `SUMMARIZE` this job’s matches. |
| **Deliverable** | Job-specific match rows |
| **Next step** | Recruiter review |

### 10. Recruiter review and pipeline

| | |
| --- | --- |
| **WorkforceOS screen** | Job pipeline `/app/jobs/[id]/pipeline`; Applications `/app/recruiting/applications` / `/app/recruiting/applications/[applicationId]`; Workbench `/app/recruiting/workbench`. No `/app/screening`. |
| **Required data** | Pipeline stages from the approved workflow: `identified` → `contacted` → `screening` → `qualified` → `submitted` → `interview` → `finalist` → `offer` → `placed`. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `applications.read` / `applications.review` / `applications.advance` / `applications.reject` |
| **Approval** | Material rejection is a human decision. Movements are audited. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this pipeline. Scout cannot independently reject. |
| **Deliverable** | Audited pipeline movement |
| **Next step** | Client submission |

### 11. Client submission

| | |
| --- | --- |
| **WorkforceOS screen** | Submissions `/app/submissions` (list; **no** `/app/submissions/[id]`) |
| **Required data** | Qualified match; packet prepared by a human recruiter. Workflow requires human-approved submission. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `submissions.read` / `submissions.write` / `submissions.approve` |
| **Approval** | Human `submissions.approve` before anything leaves the firm. Scout cannot send. |
| **Scout prompt** | `DRAFT` a packet summary for human review. Do not include email, phone, compensation, or resume. |
| **Deliverable** | Approved client submission |
| **Next step** | Interviews |

### 12. Interviews, offer, placement, guarantee

| | |
| --- | --- |
| **WorkforceOS screen** | Interviews `/app/interviews` (list only); Offers `/app/offers` (list only); Placements `/app/placements` (list only); Guarantees `/app/guarantees`. |
| **Required data** | Interview history; versioned offer; placement copies fee and guarantee days from the search agreement. |
| **Owner** | Recruiter Standard (create/send offer). Senior Talent Partner includes `offers.approve`. |
| **Access / permission** | `interviews.read` / `interviews.write` / `interviews.schedule` / `interviews.score`; `offers.read` / `offers.write` / `offers.approve` / `offers.send`; `placements.read` / `placements.write` |
| **Approval** | Approve offer before send. Live calendar OAuth is Phase I (mock only). Offers are recorded in WorkforceOS; Scout cannot send them. |
| **Scout prompt** | `SEARCH` interviews / offers / placements. `CREATE_FOLLOW_UP` (confirm). |
| **Deliverable** | Placement record; guarantee window when the agreement requires it |
| **Next step** | Silver medalists, then closeout |

### 13. Preserve silver medalists and close out

| | |
| --- | --- |
| **WorkforceOS screen** | Silver Medalists `/app/talent/silver-medalists`; Rediscovery `/app/talent/rediscovery`; Onboarding `/app/onboarding` (candidate/new-hire — not Phase H employee training). Invoice list `/app/finance/invoices` (**no** invoice detail route). Expansion: Company `/app/companies/[id]?tab=solutions` (no `/app/expansion`). |
| **Required data** | Finalists not placed remain Talent Network people. Billing event from the search agreement. |
| **Owner** | Recruiter Standard / Senior Talent Partner for talent. Operations / Administrator / Executive for invoices (`invoices.read` / `invoices.write`; `finance.approve`). |
| **Access / permission** | `candidates.read`; `onboarding.read` / `onboarding.manage`; `finance.read` / `invoices.read` |
| **Approval** | Invoice amounts come from stored billing events — never invented. QuickBooks post is off until Phase I. Expansion suggestions need human review. |
| **Scout prompt** | `ADD_TO_POOL` (confirm). `SEARCH` finance. `SHOW_RECORD` links to `/app/finance/invoices`. |
| **Deliverable** | Silver-medalist membership; billing event; optional expansion opportunity (one of the five offers only) |
| **Next step** | Guarantee follow-through or a new opportunity on the same company |

## Locked rules (do not restate as new policy)

- Internal Talent Network before external sourcing (WFOS-TAL-002).
- Job-specific scores only (WFOS-TAL-003). Never auto-reject on score.
- One candidate record — never duplicate per job.
- Humans control advancement and client submissions.
- Material AI needs provenance and human approval.
