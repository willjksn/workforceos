# PierOne service delivery playbooks

Status: Phase G (2026-09-09)  
Short index: [`docs/business/SERVICE_PLAYBOOKS.md`](../SERVICE_PLAYBOOKS.md)

Company operating model (SOLVE → BUILD → OPERATE): [`docs/business/PIERONE_OPERATING_MANUAL.md`](../PIERONE_OPERATING_MANUAL.md).  
Catalog and locked rules: [`docs/business/SERVICE_CATALOG.md`](../SERVICE_CATALOG.md).  
Versioned steps agents must load: [`docs/workflows/SERVICE_WORKFLOWS.md`](../../workflows/SERVICE_WORKFLOWS.md) and the `service_workflows` table.  
Engineering deploy / recover / PITR: [`docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md`](../../operations/WORKFORCEOS_OPERATING_PLAYBOOK.md) — do not use this folder for that.

## Five launch services only

Playbooks 1–5 are the sellable offers. Playbook 6 is **Military Talent pathway operations** (SkillBridge-eligible work on existing Talent Network people). It is not a sixth client offer and not a PierOne-owned SkillBridge program (DEC-MIL-005).

Public site may label Professional Search as **Professional & Technical Search**. Same offer.

## How to read each playbook

Every business step uses this map:

| Field | Meaning |
| --- | --- |
| **Business step** | Named step from the approved workflow / operating manual. |
| **WorkforceOS screen** | Live route from nav / `app/`. Same honesty as the company manual: no invented detail URLs. |
| **Required data** | What must already exist in PostgreSQL. |
| **Owner** | Access-bundle language (`lib/rbac/role-guide.ts`). Title ≠ Access (DEC-AUTH-002). |
| **Access / permission** | Existing slugs (`candidates.read`, not `candidate.read`). |
| **Approval** | Human gate when required. Agents cannot approve their own material output. |
| **Scout prompt** | Closed command family only. Never SQL. Never put email, phone, compensation, or resume text in the prompt. |
| **Deliverable** | Stored work product. |
| **Next step** | The following live step. |

Human approval stays required for: client submissions, pricing outside range, proposals, contracts, consequential AI, military mapping, invoices, and any external send. **Scout external send is still denied.**

Legal packages belong on the engagement (solution / contract / project), not as a free-standing legal product. New jobs search the **internal Talent Network before external sourcing** (WFOS-TAL-002).

## Access bundles (not job titles)

| Access bundle | Slug |
| --- | --- |
| Administrator / Executive | `managing-partner` |
| Operations | `operations-administrator` |
| Strategy & Technology | `strategy-technology-administrator` |
| Senior Talent Partner | `talent-partner` |
| Recruiter Standard | `recruiter` |
| Workforce Consultant | `workforce-consultant` |
| Military Talent Partner | `military-talent-partner` |
| Read only | `read-only` |

Do not write **Military Talent Specialist** in operator copy. `military-talent-specialist` is a one-release alias only.

Recruiter Standard does **not** own commercial opportunities (DEC-RBAC-001): no `opportunities.read`. Military Talent Partner does **not** own the commercial spine (`opportunities.read` is not on that bundle).

## Scout

Closed families: `SEARCH` · `SUMMARIZE` · `DRAFT` · `CREATE` · `UPDATE` · `ASSIGN` · `ADD_TO_POOL` · `ADD_TO_JOB` · `CREATE_TASK` · `CREATE_FOLLOW_UP` · `SHOW_RECORD` · `SHOW_DASHBOARD` · `FIND_MATCHES`.

Read commands may run immediately. Material writes require confirmation. Drafts stay Draft → Human Review → Send/Copy. Scout cannot send externally. Chat is not the system of record.

Approved knowledge slugs for these playbooks live in `db/seed/phase7.ts` and appear under Admin → Knowledge Sources (`/app/ai-operations/knowledge`) after re-seed.

## Screens that have no dedicated route

Do not document these as live URLs. Work the listed screen instead.

| Missing route (not live) | Live screen |
| --- | --- |
| No `/app/qualification` | Website inquiry `/app/crm/inquiries/[id]` then Opportunity `/app/opportunities/[id]` |
| No `/app/expansion` | Company `/app/companies/[id]?tab=solutions` then a new Opportunity |
| No `/app/screening` | Application `/app/recruiting/applications/[applicationId]` and Workbench `/app/recruiting/workbench` |
| No `/app/matching` | Job `/app/jobs/[id]`, Job pipeline `/app/jobs/[id]/pipeline`, Candidate Pipeline `/app/pipeline` |
| No `/app/submissions/[id]` | Submissions list `/app/submissions` |
| No `/app/interviews/[id]` | Interviews list `/app/interviews` |
| No `/app/offers/[id]` | Offers list `/app/offers` |
| No `/app/placements/[id]` | Placements list `/app/placements` |
| No `/app/finance/invoices/[id]` | Invoices list `/app/finance/invoices` |
| No `/app/military/opportunities/[id]` | Employer Opportunities list `/app/military/opportunities` |
| No `/app/military/candidates/[id]` | Transitioning Talent list `/app/military/candidates` (person is `/app/talent/[id]`) |
| No `/app/military/match` | Transition Talent Profile `/app/military/skillbridge/[id]` |
| `/app/legal` index redirects | Redirects to `/app/contracts`. Templates: `/app/legal/templates` (list; no template detail route) |

Not live in this phase: calendar OAuth, DocuSign envelopes, QuickBooks AR post, Checkr HTTP, Scout send, in-app Academy.

## The ten playbooks

1. [Professional Search](professional-search.md)
2. [Military Talent Opportunity Assessment](military-talent-opportunity-assessment.md)
3. [Talent Acquisition Performance Assessment](talent-acquisition-performance-assessment.md)
4. [Fractional Talent Partner](fractional-talent-partner.md)
5. [Workforce Pipeline Assessment](workforce-pipeline-assessment.md)
6. [Military Transition / SkillBridge-eligible operations](military-transition-pathway.md)
7. [Recruiting & Hiring](recruiting-and-hiring.md)
8. [Client Discovery](client-discovery.md)
9. [Proposal / Contract Handoff](proposal-contract-handoff.md)
10. [Project Delivery / Closeout](project-delivery-closeout.md)
