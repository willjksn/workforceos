# Client Discovery

Name: **Client Discovery**  
Kind: shared commercial intake (not a sixth client offer)

Cites: `docs/business/PIERONE_OPERATING_MANUAL.md` (Website Inquiry → CRM → Qualification → Discovery → Solution), `docs/workflows/SERVICE_WORKFLOWS.md` reusable engine path, approved discovery questions on each `service_workflows` record.

Use this playbook whenever an employer inquiry might become one of the **five** launch services. Recruiter Standard does **not** own this spine (DEC-RBAC-001). Military Talent Partner does **not** own opportunities.

Do not invent a sixth service. Do not treat Signals `/app/signals` as a required step.

## Step map

### 1. Website Inquiry

| | |
| --- | --- |
| **WorkforceOS screen** | Public `/contact` (also `/work-with-us` → `/contact`). Service pages and `/what-we-do` use the same form. Internal: Website inquiries `/app/crm/inquiries` and `/app/crm/inquiries/[id]`. |
| **Required data** | Inquiry row. Opportunities are not auto-created. |
| **Owner** | Senior Talent Partner, Operations, Strategy & Technology, Administrator / Executive, Workforce Consultant |
| **Access / permission** | `opportunities.read` to open the list. Recruiter Standard cannot. |
| **Approval** | None at intake |
| **Scout prompt** | `SEARCH` website inquiries. `SHOW_RECORD` on the inquiry. |
| **Deliverable** | `website_inquiries` row |
| **Next step** | CRM / qualify |

### 2. CRM

| | |
| --- | --- |
| **WorkforceOS screen** | Companies `/app/companies` / `/app/companies/[id]`; Contacts `/app/contacts` / `/app/contacts/[id]`; Opportunities `/app/opportunities` / `/app/opportunities/[id]`. Command Center `/app` shows pipeline counts. Signals `/app/signals` is supporting context only. |
| **Required data** | Company and contact when known. Opportunity `serviceCode` must be one of the five catalog codes. |
| **Owner** | Company/contact read is broader (Recruiter Standard can read companies/contacts). Opportunity **ownership** stays on Senior Talent Partner, Operations, Workforce Consultant, Strategy & Technology, Administrator / Executive. |
| **Access / permission** | `companies.read` / `companies.write`; `contacts.read` / `contacts.write`; `opportunities.read` / `opportunities.write` |
| **Approval** | Creating or advancing an opportunity is a human write |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` companies, contacts, opportunities. `CREATE` / `UPDATE` / `ASSIGN` (confirm) when the operator has commercial write. |
| **Deliverable** | Company, contact, opportunity |
| **Next step** | Qualification |

### 3. Qualification

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/qualification`. Inquiry `/app/crm/inquiries/[id]` (status + convert to opportunity) then Opportunity `/app/opportunities/[id]`. Service Catalog `/app/services` / `/app/services/[code]`. |
| **Required data** | Fit to one catalog offer. Company/contact matching reviewed on the inquiry first. |
| **Owner** | Same commercial owners as Website Inquiry. Recruiter Standard cannot convert inquiries. |
| **Access / permission** | `opportunities.write` |
| **Approval** | Human conversion |
| **Scout prompt** | `CREATE` opportunity-from-inquiry (confirm). `SHOW_RECORD` on the new opportunity. |
| **Deliverable** | Qualified opportunity |
| **Next step** | Discovery |

### 4. Discovery

| | |
| --- | --- |
| **WorkforceOS screen** | Discovery `/app/discovery` and `/app/discovery/[id]` |
| **Required data** | Answers to the **approved** discovery questions on that service’s workflow record. Do not invent a new questionnaire in chat. |
| **Owner** | Senior Talent Partner, Workforce Consultant, Recruiter Standard (discovery read/write), Military Talent Partner, Operations, Administrator / Executive |
| **Access / permission** | `discovery.read` / `discovery.write` |
| **Approval** | Discovery notes are operator work. Client-facing findings later require solution or deliverable approval. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` the opportunity or discovery. `CREATE_TASK` / `CREATE_FOLLOW_UP` (confirm). `DRAFT` internal notes only. |
| **Deliverable** | Discovery record |
| **Next step** | Solution |

### 5. Solution

| | |
| --- | --- |
| **WorkforceOS screen** | Solution Plans `/app/solutions` and `/app/solutions/[id]`. Service definition `/app/services` / `/app/services/[code]`. |
| **Required data** | Specific approved `service_version`. Legal package requirements come from that workflow — attach them on the engagement, not as a free-standing legal product. |
| **Owner** | Senior Talent Partner, Workforce Consultant, Military Talent Partner (write/approve on solutions), Operations, Administrator / Executive |
| **Access / permission** | `solutions.read` / `solutions.write` / `solutions.approve`; `pricing.approve` if outside configured range |
| **Approval** | `solutions.approve` before a proposal is generated |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` solutions. Material AI goes to `/app/ai-operations/review`. |
| **Deliverable** | Approved solution plan |
| **Next step** | [Proposal / Contract Handoff](proposal-contract-handoff.md) |

## Service-specific discovery sources

Load questions from the approved workflow — this table is a pointer, not a replacement.

| Service code | Playbook |
| --- | --- |
| `professional-search` | [Professional & Technical Search](professional-search.md) |
| `military-talent-opportunity-assessment` | [Military Talent Opportunity Assessment](military-talent-opportunity-assessment.md) |
| `ta-performance-assessment` | [Talent Acquisition Performance Assessment](talent-acquisition-performance-assessment.md) |
| `fractional-talent-partner` | [Fractional Talent Partner](fractional-talent-partner.md) |
| `workforce-pipeline-assessment` | [Workforce Pipeline Assessment](workforce-pipeline-assessment.md) |
