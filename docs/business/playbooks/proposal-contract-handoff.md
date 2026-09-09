# Proposal / Contract Handoff

Name: **Proposal / Contract Handoff**  
Kind: shared commercial close (not a sixth client offer)

Cites: `docs/business/PIERONE_OPERATING_MANUAL.md` (Proposal → Contract → Project), `docs/workflows/SERVICE_WORKFLOWS.md` approval gates, Phase 4 commercial model in `docs/business/SERVICE_CATALOG.md`.

A proposal is generated from an **approved** solution plan. A delivery project is created from that plan plus the approved workflow template, normally after contract execution. Legal packages belong **inside** this workflow and must link to the service/engagement.

Scout cannot send. Live DocuSign envelopes are Phase I — record execution in WorkforceOS until then.

## Step map

### 1. Confirm the approved solution

| | |
| --- | --- |
| **WorkforceOS screen** | Solution Plans `/app/solutions` / `/app/solutions/[id]`; Service Catalog `/app/services/[code]` |
| **Required data** | `solutions.approve` already recorded. Service version and pricing model (percentage fee, fixed project, or monthly recurring) from the catalog record. |
| **Owner** | Senior Talent Partner, Workforce Consultant, Military Talent Partner (solutions), Operations, Administrator / Executive |
| **Access / permission** | `solutions.read`; `pricing.approve` if the quoted fee is outside configured min/max |
| **Approval** | Do not generate a sendable proposal from an unapproved plan |
| **Scout prompt** | `SHOW_RECORD` / `SUMMARIZE` this solution. |
| **Deliverable** | Approved plan ready for proposal |
| **Next step** | Draft proposal |

### 2. Draft the proposal

| | |
| --- | --- |
| **WorkforceOS screen** | Proposals `/app/proposals` and `/app/proposals/[id]` |
| **Required data** | Plan, fee, scope, and legal package types from the approved workflow (do not invent fee language). |
| **Owner** | Senior Talent Partner and Workforce Consultant have `proposals.write`. Military Talent Partner has `proposals.read` only. Recruiter Standard can read, not own. |
| **Access / permission** | `proposals.read` / `proposals.write` |
| **Approval** | Draft is internal |
| **Scout prompt** | `DRAFT` proposal language for human review. Never treat the draft as approved or sent. |
| **Deliverable** | Proposal in draft |
| **Next step** | Internal review |

### 3. Internal review and human approve

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/proposals/[id]`; Review Queue `/app/ai-operations/review` when AI drafted material language; Approvals `/app/admin/approvals` (platform admin) |
| **Required data** | Status path Draft → `internal_review` → approved |
| **Owner** | `proposals.approve` is Operations and Administrator / Executive (not Senior Talent Partner / Workforce Consultant in the live bundles) |
| **Access / permission** | `proposals.approve` |
| **Approval** | Required. Proposals cannot be sent until approved. Agents cannot approve their own output. |
| **Scout prompt** | `SHOW_RECORD` the proposal. Do not send. |
| **Deliverable** | Approved proposal |
| **Next step** | Human send (not Scout) |

### 4. Send the proposal (human)

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/proposals/[id]` |
| **Required data** | Approved proposal |
| **Owner** | Operator with proposal write/approve as granted |
| **Access / permission** | `proposals.write` after approve |
| **Approval** | Human sends. **Scout external send is denied** (`scout.external_actions` is not enabled). |
| **Scout prompt** | None for send. `CREATE_FOLLOW_UP` (confirm) after a human sent. |
| **Deliverable** | Sent proposal (human-recorded) |
| **Next step** | Contract |

### 5. Attach the legal package and draft the contract

| | |
| --- | --- |
| **WorkforceOS screen** | Contracts `/app/contracts` / `/app/contracts/[id]`. Legal templates `/app/legal/templates` (list; **no** template detail route). `/app/legal` redirects to `/app/contracts`. |
| **Required data** | Required/conditional templates from that service’s approved workflow (see each service playbook). “Attorney-approved” only if `attorney_approved` is recorded. |
| **Owner** | Operations and Administrator / Executive (`contracts.write`). Senior Talent Partner has `contracts.read` only. |
| **Access / permission** | `contracts.read` / `contracts.write`; `legal.read` / `legal.write` |
| **Approval** | Package stays on this engagement |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` the contract. Scout cannot execute or send contracts. |
| **Deliverable** | Contract + linked legal package |
| **Next step** | Execute |

### 6. Execute the contract

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/contracts/[id]` (manual execute). Live DocuSign is not configured (Phase I). |
| **Required data** | Human execution (or audited Managing Partner override recorded in audit) |
| **Owner** | Operations, Administrator / Executive |
| **Access / permission** | `contracts.approve` |
| **Approval** | Required before a normal delivery project |
| **Scout prompt** | `SHOW_RECORD` only. |
| **Deliverable** | Executed contract |
| **Next step** | [Project Delivery / Closeout](project-delivery-closeout.md) |

## Per-service legal pointers (from approved workflows)

| Service | Required package types (workflow) |
| --- | --- |
| Professional & Technical Search | `direct_hire_search_agreement` (conditional MSA, NDA, DPA, retained search) |
| Military Talent Opportunity Assessment | MSA, `military_talent_assessment_sow`, NDA (conditional DPA) |
| Talent Acquisition Performance Assessment | MSA, `ta_performance_assessment_sow`, NDA (conditional DPA) |
| Fractional Talent Partner | MSA, `fractional_ta_sow`, NDA, DPA, confidentiality/IP |
| Workforce Pipeline Assessment | MSA, `workforce_assessment_sow`, NDA (conditional DPA) |
