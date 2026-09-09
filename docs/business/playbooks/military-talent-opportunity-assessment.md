# Military Talent Opportunity Assessment

Catalog name: **Military Talent Opportunity Assessment**  
Code: `military-talent-opportunity-assessment`  
Kind: launch service (one of five)

Cites: `docs/business/SERVICE_CATALOG.md`, `docs/workflows/SERVICE_WORKFLOWS.md` (Military Talent Opportunity Assessment), approved `service_workflows` for this code, DEC-MIL-001, DEC-MIL-005, `docs/business/PIERONE_OPERATING_MANUAL.md`.

This playbook is the **client assessment engagement**. Pathway operations for transitioning people are [Military Transition / SkillBridge-eligible operations](military-transition-pathway.md) — not a sixth sellable service. Do not invent MOS maps, installations, or mapping rules. Load stored, reviewed mappings.

SkillBridge is a pathway/opportunity type inside this practice, not a PierOne-owned program.

Legal package (approved workflow): required MSA, Military Talent Assessment SOW, NDA; conditional DPA.

Delivery project phases (`military-talent-assessment-delivery`): Discovery → Job Inventory → Military Crosswalk → Installation Analysis → Workforce Opportunity Analysis → Recommendations → Human Review → Client Presentation → Final Report.

## Step map

### 1. Qualify the civilian workforce need

| | |
| --- | --- |
| **WorkforceOS screen** | Website inquiries `/app/crm/inquiries/[id]` (no `/app/qualification`) then Opportunity `/app/opportunities/[id]` with `serviceCode` = `military-talent-opportunity-assessment`. Catalog `/app/services/military-talent-opportunity-assessment`. |
| **Required data** | Civilian roles, locations, hiring volume, constraints (catalog). Qualification trigger from the workflow record. |
| **Owner** | Senior Talent Partner, Operations, Workforce Consultant, Administrator / Executive. **Military Talent Partner does not have `opportunities.read`** — they join at discovery / mapping, not opportunity ownership. |
| **Access / permission** | `opportunities.read` / `opportunities.write` |
| **Approval** | Human conversion from inquiry. Do not auto-create. |
| **Scout prompt** | `SEARCH` inquiries / opportunities. `CREATE` opportunity-from-inquiry (confirm) only if the operator owns commercial write. |
| **Deliverable** | Opportunity on this service code |
| **Next step** | Discovery |

### 2. Capture civilian roles and constraints

| | |
| --- | --- |
| **WorkforceOS screen** | Discovery `/app/discovery` / `/app/discovery/[id]`. Approved discovery questions live on the workflow record (roles, locations, SkillBridge interest, shortages, nearby military ecosystems). |
| **Required data** | Role inventory and locations. Pause if missing (workflow exception). |
| **Owner** | Military Talent Partner (workflow `responsibleRole`), Senior Talent Partner, Workforce Consultant |
| **Access / permission** | `discovery.read` / `discovery.write` |
| **Approval** | Operator capture. Do not invent a role inventory. |
| **Scout prompt** | `SUMMARIZE` this discovery. `CREATE_FOLLOW_UP` (confirm). |
| **Deliverable** | Discovery record |
| **Next step** | Solution plan, then translation |

### 3. Approve the assessment solution

| | |
| --- | --- |
| **WorkforceOS screen** | Solution Plans `/app/solutions` / `/app/solutions/[id]` |
| **Required data** | Approved service version. Scope is assessment — not a promise of SkillBridge seats or employment. |
| **Owner** | Military Talent Partner (`solutions.write` / `solutions.approve`), Senior Talent Partner, Operations, Administrator / Executive |
| **Access / permission** | `solutions.read` / `solutions.write` / `solutions.approve`; `pricing.approve` if outside range |
| **Approval** | Human `solutions.approve`. Agent drafts start pending. Originating agent cannot approve. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` this solution. Review Queue `/app/ai-operations/review` for material AI. |
| **Deliverable** | Approved assessment plan |
| **Next step** | [Proposal / Contract Handoff](proposal-contract-handoff.md) |

### 4. Proposal, contract, delivery project

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/proposals/[id]`; `/app/contracts/[id]`; `/app/legal/templates`; `/app/projects/[id]` |
| **Required data** | Legal package on this engagement. Template `military-talent-assessment-delivery`. |
| **Owner** | Senior Talent Partner / Workforce Consultant draft commercial docs they can write. Contract execute: Operations / Administrator / Executive. Military Talent Partner has `proposals.read` and `contracts.read` only. |
| **Access / permission** | `proposals.*` as granted; `contracts.approve`; `projects.write` |
| **Approval** | Proposal and contract human gates. Project requires executed contract unless audited override. |
| **Scout prompt** | `SHOW_RECORD` proposal / contract / project. No send. |
| **Deliverable** | Executed SOW; delivery project |
| **Next step** | Translate using stored mappings |

### 5. Translate civilian demand to military occupations

| | |
| --- | --- |
| **WorkforceOS screen** | Skills Translator `/app/military/translator`; Occupation Library `/app/military/occupations`; Civilian Crosswalk `/app/military/crosswalk`; Reverse Search `/app/military/reverse`. |
| **Required data** | Stored, reviewed mappings with source / version / confidence. Workflow: “Translate to military occupations.” |
| **Owner** | Military Talent Partner |
| **Access / permission** | `military.read` / `military.write` |
| **Approval** | Do not invent occupations (DEC-MIL-001). Unreviewed mappings cannot be used in hiring-manager copy. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` occupations and crosswalks. `DRAFT` explanations for review. Never invent a map. |
| **Deliverable** | Crosswalk referenced with provenance |
| **Next step** | Skills, gaps, training |

### 6. Map skills, gaps, and bridge training

| | |
| --- | --- |
| **WorkforceOS screen** | Bridge Training `/app/military/bridge-training` plus translator/crosswalk screens above |
| **Required data** | Crosswalk. Workflow: “Map skills, certifications, gaps, and bridge training.” |
| **Owner** | Military Talent Partner |
| **Access / permission** | `military.read` / `military.write` |
| **Approval** | Do not promise employment. |
| **Scout prompt** | `SUMMARIZE` stored gaps and training. No fabricated certifications. |
| **Deliverable** | Gaps and training with provenance |
| **Next step** | Installations |

### 7. Identify likely installations

| | |
| --- | --- |
| **WorkforceOS screen** | Installation Mapping `/app/military/installation-mapping`; Installations `/app/military/installations` |
| **Required data** | Occupation–installation links. Workflow: not unsupported guesses. Coordinates are never fabricated. |
| **Owner** | Military Talent Partner |
| **Access / permission** | `military.read` / `military.write` |
| **Approval** | Installations come from stored links only. |
| **Scout prompt** | `SEARCH` installations linked to the stored occupations. |
| **Deliverable** | Installation list from stored links |
| **Next step** | Draft recommendations |

### 8. Draft recommendations and human military review

| | |
| --- | --- |
| **WorkforceOS screen** | Mapping Review `/app/military/review`; Review Queue `/app/ai-operations/review`; Solution `/app/solutions/[id]`; Deliverables `/app/projects/deliverables` and project `/app/projects/[id]`. |
| **Required data** | Draft Military Talent Opportunity Plan. Workflow: human military reviewer; originating agent cannot approve. |
| **Owner** | Military Talent Partner (`military.review`). Senior Talent Partner also reviews. Recruiter Standard can read mappings, not approve them. |
| **Access / permission** | `military.review`; `deliverables.approve` for client-facing files (Operations / Workforce Consultant / Administrator / Executive — Military Talent Partner has `deliverables.read` only) |
| **Approval** | Required before client-facing plan, proposal language, and final report. |
| **Scout prompt** | `DRAFT` for review. Do not treat a draft as approved. |
| **Deliverable** | Approved Military Talent Opportunity Plan |
| **Next step** | Client presentation / final report |

### 9. Client presentation, final report, closeout

| | |
| --- | --- |
| **WorkforceOS screen** | Project `/app/projects/[id]`; Deliverables `/app/projects/deliverables`; Reports `/app/reports`; Invoices `/app/finance/invoices` (list only). Analytics `/app/military/analytics`. |
| **Required data** | Human-approved Final Report. Milestone billing from the contract. Completion rule: approved final report delivered; billing trigger created. |
| **Owner** | Military Talent Partner (content). Operations for invoice / closeout. |
| **Access / permission** | `deliverables.read` / `deliverables.approve`; `invoices.read`; `reports.read` |
| **Approval** | Client-facing deliverables need `deliverables.approve`. Invoices from stored events. |
| **Scout prompt** | `SUMMARIZE` this project. `CREATE_FOLLOW_UP` (confirm). |
| **Deliverable** | Final report; billing event; expansion suggestions only for Fractional Talent Partner or Workforce Pipeline Assessment (workflow expansion rules) |
| **Next step** | If the employer wants pathway support, use [Military Transition / SkillBridge-eligible operations](military-transition-pathway.md) on Talent Network people — do not sell a sixth service. |

## Locked rules

- PierOne is the intermediary, generally not the SkillBridge host (DEC-MIL-005).
- Do not invent mapping rules (DEC-MIL-001).
- Do not duplicate a candidate per employer.
- Operator bundle for mapping/pathway work: **Military Talent Partner**, not Specialist.
