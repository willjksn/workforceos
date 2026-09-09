# Military Transition / SkillBridge-eligible operations

Name: **Military Transition / SkillBridge-eligible operations**  
Kind: **internal pathway operations** — not a sixth client offer and not a PierOne-owned SkillBridge program

Cites: DEC-MIL-005, `docs/business/SERVICE_CATALOG.md` (Military Talent operating path), `docs/workflows/SERVICE_WORKFLOWS.md` (Phase 9 overlay), `docs/business/PIERONE_OPERATING_MANUAL.md` (canonical military flow). Do not invent MOS maps or pathway stages.

Client assessment work stays in [Military Talent Opportunity Assessment](military-talent-opportunity-assessment.md). This playbook is how operators run transitioning people and employer/host opportunities **after** (or beside) that practice.

Canonical flow (locked):

Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity Search / Development → Employer Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other Transition Pathway → Placement → Conversion.

SkillBridge people are existing Talent Network candidates. Do not duplicate a candidate per employer. PierOne is the intermediary and is generally **not** the SkillBridge host. Operator access bundle: **Military Talent Partner**.

## Step map

### 1. Transitioning Service Member

| | |
| --- | --- |
| **WorkforceOS screen** | Public join: PierOnePartners.com `/military-talent/join` (canonical). `/skillbridge/join` redirects there — not a second intake. Internal: Transitioning Talent `/app/military/candidates` (list; **no** `/app/military/candidates/[id]`) and Candidates `/app/talent`. |
| **Required data** | One Talent Network candidate. A public job posting is not required before someone can join. |
| **Owner** | Military Talent Partner, Recruiter Standard, Senior Talent Partner |
| **Access / permission** | `military.read`, `candidates.read`; restricted fields need `candidate_pii.read` |
| **Approval** | None to record the person. Never invent a second person. |
| **Scout prompt** | `SEARCH` transitioning talent / candidates. Do not include email, phone, or resume. |
| **Deliverable** | Candidate row (and later a pathway overlay) |
| **Next step** | Military Talent Network |

### 2. Military Talent Network

| | |
| --- | --- |
| **WorkforceOS screen** | Military Talent `/app/military`; Transitioning Talent `/app/military/candidates` |
| **Required data** | These are Talent Network people, not a PierOne SkillBridge roster. |
| **Owner** | Military Talent Partner (primary) |
| **Access / permission** | `military.read`, `skillbridge.read` |
| **Approval** | None to record membership. Do not duplicate per employer. |
| **Scout prompt** | `SEARCH` Military Talent. `SHOW_DASHBOARD` on `/app/military`. |
| **Deliverable** | Network membership on the existing candidate |
| **Next step** | Transition Talent Profile |

### 3. Transition Talent Profile

| | |
| --- | --- |
| **WorkforceOS screen** | Pathway operations `/app/military/skillbridge`; profile `/app/military/skillbridge/[id]` (UI: Transition Talent Profile; physical table `skillbridge_profiles`). Person remains `/app/talent/[id]`. |
| **Required data** | 1:1 overlay on the candidate. Preferred location and pathway fields as stored. |
| **Owner** | Military Talent Partner. Recruiter Standard has `skillbridge.write`; Senior Talent Partner has `skillbridge.manage`. |
| **Access / permission** | `skillbridge.read` / `skillbridge.write` / `skillbridge.manage` |
| **Approval** | Profile completeness is operator work. PII still requires `candidate_pii.read`. |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` / `UPDATE` preferred location (confirm). `CREATE_FOLLOW_UP`. |
| **Deliverable** | Transition Talent Profile |
| **Next step** | Skills Translation |

### 4. Skills Translation

| | |
| --- | --- |
| **WorkforceOS screen** | Skills Translator `/app/military/translator`; Occupation Library `/app/military/occupations`; Civilian Crosswalk `/app/military/crosswalk`; Reverse Search `/app/military/reverse`; Installation Mapping `/app/military/installation-mapping`; Bridge Training `/app/military/bridge-training`; Mapping Review `/app/military/review`. |
| **Required data** | Stored mappings with source / version / confidence. |
| **Owner** | Military Talent Partner (`military.write`, `military.review`). Senior Talent Partner also reviews. Recruiter Standard can read mappings, not approve. |
| **Access / permission** | `military.read` / `military.write` / `military.review` |
| **Approval** | Agent mapping drafts start pending. Originating agent cannot approve. Do not invent mapping rules (DEC-MIL-001). |
| **Scout prompt** | `SEARCH` / `SUMMARIZE`. `DRAFT` explanations for Mapping Review. |
| **Deliverable** | Reviewed translation (or pending draft) |
| **Next step** | Employer Opportunity |

### 5. Employer Opportunity Search / Development

| | |
| --- | --- |
| **WorkforceOS screen** | Employer Opportunities `/app/military/opportunities` (list; **no** `/app/military/opportunities/[id]`). Add/develop from `/app/military/skillbridge/[id]`. Physical table `skillbridge_opportunities`. Employer/host company must be explicit. |
| **Required data** | Host/employer named. A public job is optional. |
| **Owner** | Military Talent Partner, Senior Talent Partner |
| **Access / permission** | `skillbridge.write` |
| **Approval** | Humans create the employer/host record. |
| **Scout prompt** | `SEARCH` employer opportunities. `CREATE` / `UPDATE` (confirm). |
| **Deliverable** | Employer/host opportunity row |
| **Next step** | Match |

### 6. Employer Match

| | |
| --- | --- |
| **WorkforceOS screen** | No `/app/military/match`. Compare profile ↔ employer opportunity on `/app/military/skillbridge/[id]` (stored match scores/explanations). Matching reuses Professional Search job-match architecture. Reverse Search `/app/military/reverse` supports occupation→role exploration. |
| **Required data** | Profile + employer opportunity. Scores do not auto-place. |
| **Owner** | Military Talent Partner |
| **Access / permission** | `skillbridge.read` / `skillbridge.write` |
| **Approval** | Human connect/submit. No auto-reject on score. |
| **Scout prompt** | `FIND_MATCHES`. `SEARCH` profiles and employer opportunities. |
| **Deliverable** | Stored match explanation |
| **Next step** | Employer Engagement |

### 7. Employer Engagement

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/military/skillbridge/[id]` (employer brief and message drafts) and `/app/military/opportunities` |
| **Required data** | PierOne facilitates; the employer owns the opportunity. |
| **Owner** | Military Talent Partner |
| **Access / permission** | `skillbridge.write` |
| **Approval** | Employer briefs and message drafts require human review. Scout cannot send. |
| **Scout prompt** | `DRAFT` (review/copy). `CREATE_FOLLOW_UP`. No external send. |
| **Deliverable** | Reviewable employer brief |
| **Next step** | Interview |

### 8. Interview

| | |
| --- | --- |
| **WorkforceOS screen** | Interviews `/app/interviews` (list only) plus pathway stage history on `/app/military/skillbridge/[id]` |
| **Required data** | Interview row when it is a hiring interview; pathway stage when it is pathway progress. |
| **Owner** | Military Talent Partner (read). Recruiter Standard / Senior Talent Partner schedule hiring interviews. |
| **Access / permission** | `interviews.read`; `interviews.schedule` when scheduling |
| **Approval** | Service/command or host approvals are never assumed. Live calendar send is not wired. |
| **Scout prompt** | `SEARCH` / `CREATE_FOLLOW_UP`. |
| **Deliverable** | Interview history and/or pathway stage |
| **Next step** | Pathway decision |

### 9. SkillBridge / Direct Hire / Other

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/military/skillbridge` and `/app/military/skillbridge/[id]` (stages through SkillBridge approval/active, or hired/nurture/closed). This is not a PierOne SkillBridge program dashboard. |
| **Required data** | Host employer, timing, and service/command approval when SkillBridge applies. |
| **Owner** | Military Talent Partner (`skillbridge.manage` for queue-wide views) |
| **Access / permission** | `skillbridge.write` / `skillbridge.manage` |
| **Approval** | PierOne does not guarantee approvals, placements, or conversions. |
| **Scout prompt** | `SEARCH` / `UPDATE` stage (confirm). `DRAFT` stays internal. |
| **Deliverable** | Pathway stage on the overlay |
| **Next step** | Placement |

### 10. Placement

| | |
| --- | --- |
| **WorkforceOS screen** | Placements `/app/placements` (list only) and pathway stage on `/app/military/skillbridge/[id]`. Host/employer must be explicit. |
| **Required data** | Placement start. The person stays one Talent Network candidate. |
| **Owner** | Military Talent Partner (placements read). Recruiter Standard / Senior Talent Partner write when recording the hire. |
| **Access / permission** | `placements.read` / `placements.write` |
| **Approval** | Human records placement start. |
| **Scout prompt** | `SEARCH` / `SHOW_RECORD` (placements list). `UPDATE` (confirm). |
| **Deliverable** | Placement row + pathway stage |
| **Next step** | Conversion |

### 11. Conversion

| | |
| --- | --- |
| **WorkforceOS screen** | `/app/military/skillbridge/[id]` (`conversion_review` → `hired`); Analytics `/app/military/analytics`; person `/app/talent/[id]`. |
| **Required data** | Employer decision. Do not drop the Talent Network candidate. |
| **Owner** | Military Talent Partner |
| **Access / permission** | `skillbridge.write`; `candidates.read` |
| **Approval** | Humans record conversion. Conversion to full-time employment is an employer decision PierOne supports, not a PierOne hire by default. |
| **Scout prompt** | `SEARCH` / `SUMMARIZE` / `CREATE_FOLLOW_UP`. |
| **Deliverable** | Conversion stage; candidate remains rediscoverable |
| **Next step** | Remain on the Talent Network. If the employer buys another of the five offers, use the commercial spine — do not invent a sixth service. |
