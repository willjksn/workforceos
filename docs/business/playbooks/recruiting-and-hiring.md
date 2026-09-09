# Recruiting & Hiring

Name: **Recruiting & Hiring**  
Kind: shared search execution (not a sixth client offer)

Cites: `docs/business/PIERONE_OPERATING_MANUAL.md` (canonical recruiting flow), `docs/workflows/SERVICE_WORKFLOWS.md` (Professional Search execution steps), WFOS-TAL-002 / WFOS-TAL-003 / WFOS-TAL-004, Phase 10 hiring records.

This is how jobs and people move after a search is sold (usually [Professional Search](professional-search.md), or scoped reqs under [Fractional Talent Partner](fractional-talent-partner.md)). Recruiter Standard owns this path. Recruiter Standard does **not** own Opportunities (DEC-RBAC-001).

Canonical flow:

Job → Candidate → Application → Screening → Matching → Client Submission → Interview → Offer → Hire → Onboarding

Internal Talent Network search must complete before external sourcing.

## Step map

### 1. Job

| | |
| --- | --- |
| **WorkforceOS screen** | Jobs `/app/jobs` and `/app/jobs/[id]`. Jobs is the recruiting entry. `/app/search-projects` and `/app/recruiting/requisitions` still resolve into Jobs — not a second intake. Public careers publishing is a job-posting action, not a marketplace. |
| **Required data** | Structured job. Confidential client identity omitted from public payloads. |
| **Owner** | Recruiter Standard, Senior Talent Partner. Military Talent Partner may write jobs for pathway-related roles. |
| **Access / permission** | `jobs.read` / `jobs.write` / `jobs.create`; `jobs.approve` / `jobs.publish` / `jobs.close` |
| **Approval** | A public posting is not required to start internal matching. |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` jobs. `CREATE` / `UPDATE` (confirm). |
| **Deliverable** | Job record |
| **Next step** | Candidate |

### 2. Candidate

| | |
| --- | --- |
| **WorkforceOS screen** | Candidates `/app/talent` and `/app/talent/[id]`. Supporting: `/app/talent/search`, `/app/talent/pools`, `/app/talent/silver-medalists`, `/app/talent/watchlists`, `/app/talent/rediscovery`, `/app/talent/nurture`. |
| **Required data** | One global candidate. Never duplicate per job or employer. |
| **Owner** | Recruiter Standard, Senior Talent Partner, Military Talent Partner |
| **Access / permission** | `candidates.read` / `candidates.write`; `candidate_pii.read` for email/phone/compensation/resume |
| **Approval** | None to view an authorized candidate. Privacy deletion is a separate process (`privacy.delete`). |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` / `SHOW_RECORD` (PII stripped from model context). `ADD_TO_POOL` / `ADD_TO_JOB` (confirm). Never paste resume or phone into the prompt. |
| **Deliverable** | Talent Network person |
| **Next step** | Application or Matching |

### 3. Application

| | |
| --- | --- |
| **WorkforceOS screen** | Applications `/app/recruiting/applications` and `/app/recruiting/applications/[applicationId]`. Public apply: PierOnePartners.com `/careers` and `/jobs/[slug]`. |
| **Required data** | Application is Candidate↔Job. Do not create a second person. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `applications.read` / `applications.review` / `applications.advance` |
| **Approval** | None to record the apply |
| **Scout prompt** | `SEARCH` hiring queues / applications. `SHOW_RECORD`. |
| **Deliverable** | Application row |
| **Next step** | Screening |

### 4. Screening

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/screening`. Application `/app/recruiting/applications/[applicationId]` and Recruiting Workbench `/app/recruiting/workbench` (needs-review, scorecards, checks). |
| **Required data** | Scorecards / check rows when used. Background and drug results are human-reviewed. Checkr HTTP and live drug screening are not wired. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `applications.review` / `applications.advance` / `applications.reject`; `background_checks.read` / `background_checks.review`; `drug_screens.read` / `drug_screens.review` |
| **Approval** | Material rejection is a human decision. Scores never auto-reject. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE`. Scout cannot independently reject. |
| **Deliverable** | Screened application |
| **Next step** | Matching (or Client Submission if already matched) |

### 5. Matching

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/matching`. Job `/app/jobs/[id]` (run / complete internal search); Job pipeline `/app/jobs/[id]/pipeline`; Candidate Pipeline `/app/pipeline`. Talent Search finds people; it does not replace job-specific scores. |
| **Required data** | `candidate_job_matches` unique on `(candidate_id, job_id)`. Internal search complete before external adapters. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `jobs.read`, `candidates.read` |
| **Approval** | Humans advance stages. Scores have provenance and never auto-reject. |
| **Scout prompt** | `FIND_MATCHES`. `ADD_TO_JOB` (confirm). |
| **Deliverable** | Job-specific match |
| **Next step** | Client Submission |

### 6. Client Submission

| | |
| --- | --- |
| **WorkforceOS screen** | Submissions `/app/submissions` (list; **no** `/app/submissions/[id]`). Job workspace also tracks submitted status. |
| **Required data** | Packet prepared by a human |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `submissions.read` / `submissions.write` / `submissions.approve` |
| **Approval** | Human `submissions.approve` before send. Scout cannot send. |
| **Scout prompt** | `DRAFT` a packet summary without PII. |
| **Deliverable** | Approved submission |
| **Next step** | Interview |

### 7. Interview

| | |
| --- | --- |
| **WorkforceOS screen** | Interviews `/app/interviews` (list; **no** interview detail route). Workbench links here. |
| **Required data** | Interview row. Live calendar OAuth is Phase I (mock scheduling only). Candidate self-scheduling is not in V1. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `interviews.read` / `interviews.write` / `interviews.schedule` / `interviews.score` |
| **Approval** | Scout cannot send calendar invites as a live provider action. |
| **Scout prompt** | `SEARCH` / `CREATE_FOLLOW_UP`. |
| **Deliverable** | Interview history |
| **Next step** | Offer |

### 8. Offer

| | |
| --- | --- |
| **WorkforceOS screen** | Offers `/app/offers` (list; **no** `/app/offers/[id]`) |
| **Required data** | Versioned offer |
| **Owner** | Recruiter Standard (`offers.create` / `offers.send`). Senior Talent Partner includes `offers.approve`. |
| **Access / permission** | `offers.read` / `offers.write` / `offers.approve` / `offers.send` |
| **Approval** | Approve before send. Scout cannot send offers. |
| **Scout prompt** | `SEARCH` offers. `DRAFT` stays internal. |
| **Deliverable** | Approved offer version |
| **Next step** | Hire |

### 9. Hire

| | |
| --- | --- |
| **WorkforceOS screen** | Placements `/app/placements` (list; **no** placement detail). Guarantees `/app/guarantees` when the search agreement requires it. |
| **Required data** | Placement copies fee and guarantee days from the search agreement. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `placements.read` / `placements.write` |
| **Approval** | Humans record the hire. |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` (placements list). `UPDATE` (confirm). |
| **Deliverable** | Placement (and guarantee window) |
| **Next step** | Onboarding |

### 10. Onboarding

| | |
| --- | --- |
| **WorkforceOS screen** | Onboarding `/app/onboarding`. This is candidate / new-hire onboarding (Phase 10). It is **not** PierOne employee Day 1–Week 4 (Phase H) and not `/onboarding/access` (deferred portal). |
| **Required data** | Onboarding tasks. `employees` may link to `candidate_id`; the Talent Network record remains. |
| **Owner** | Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `onboarding.read` / `onboarding.manage` / `onboarding.complete`; `employees.read` / `employees.manage` |
| **Approval** | Tasks complete in-app without a candidate portal. Transactional email uses the email provider when configured; Scout cannot send it. |
| **Scout prompt** | `SEARCH` / `CREATE_TASK` (confirm). |
| **Deliverable** | Completed onboarding tasks |
| **Next step** | Silver-medalist / rediscovery for people not hired; guarantee window for placed search |
