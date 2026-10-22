# WorkforceOS Military + Workforce Core Audit

Date: 2026-10-21
Status: founder approved 2026-10-21. `DEC-PROD-001` is accepted. M1 is authorized. M2–M10 are not started.
Branch: `audit/military-workforce-core`
Base: `main` at `1450f998e393e7bc4ab56d81d61d7f40c9841934`
Working tree at audit start: clean, tracking `origin/main`
Parked research: `follow-on/parked-working-tree` at `1a356d3` was inspected by diff only and was not merged, checked out, or revived.

This document records a product audit. Founder approval on 2026-10-21 accepts section 18 decisions 1–4 and authorizes M1 only. It does not authorize navigation changes, crawlers, brand renames, Scout command changes, or M2–M10.

Product direction locked for this audit: Pier 24 Partners operates WorkforceOS as its own system. Military Talent and Workforce Development are the two signature pillars. Employer ATS, CRM, HRIS, and SSO connections are optional. SkillBridge is one transition pathway. Pier 24 is generally not the SkillBridge host.

## 1. Executive Summary

WorkforceOS today is an internal operating system for five commercial offers: Professional & Technical Search, Military Talent Opportunity Assessment, TA Performance Assessment, Fractional Talent Partner, and Workforce Pipeline Assessment. The database already treats a transitioning service member as a Talent Network `candidates` row, with military occupation history, a one-to-one SkillBridge-named profile, reviewed occupation-to-civilian mappings, jobs, match scores, submissions that require a human approver, placements, and a large workforce-planning model. Command Center, alerts, tasks-as-activities, Scout's closed command registry, and RBAC are real and should stay.

What it should become is a smaller operating system Pier 24 can run without an employer login: a Military Talent Network, a Transition Talent Profile on the existing candidate, capability translation that goes past a civilian job title, a list of target employers and their public career sources, employer demand records, two-way explainable matches, recruiter-controlled outreach, and workforce plans that count military talent as one supply channel.

Most of the schema can be reused. The estimate from this inspection is that the person, company, occupation, skill, job, match, submission, placement, workforce-assessment, alert, and Scout registries stay. The work is to generalize three overloaded names, add a thin career-source registry, and stop making operators cross a dozen screens to do one workflow.

What is duplicated:

- Three different "opportunities": CRM sales `opportunities`, recruiting `jobs`, and `skillbridge_opportunities` (the screen titled Employer Opportunities).
- Two matchers over one scoring function: internal job-to-candidate scoring in `lib/repositories/recruiting.ts`, and candidate-to-open-job scoring in `lib/skillbridge/matching.ts`. The military path passes an empty skill list into the scorer.
- Two military biographies: `candidate_military_experiences` and `skillbridge_profiles`, both storing rank, years, and occupation.
- A Pathway navigation group of 13 items plus a Military subnav of 14 tabs, beside an 18-item Talent group and a 15-tab Workforce subnav.
- `job_requisitions` repeating title, location, compensation, and workplace fields that already live on `jobs`.

What should leave the daily product surface: separate Silver Medalist, Watchlist, Rediscovery, and Nurture destinations; ATS-shaped pre-hire screens (applications workbench, drug screens, background checks, employee records) as primary navigation; duplicate translator / crosswalk / reverse-search / installation-mapping pages; a public job board posture; and any revival of the parked research runtime. The five commercial offers stay. They should stop defining the information architecture.

Recommended direction: keep one person (`candidates`), one transition overlay (generalize `skillbridge_profiles`), one demand record (`jobs`, expanded), one match row (`candidate_job_matches`), and one workforce-planning stack. Add career sources as a new thin registry because nothing in the current schema monitors a public career site. Do not add an `EmployerOpportunity` table. Do not add a second candidate type. Do not build a client portal. Do not turn embeddings on.

The sentence the product should be able to support, after the milestones below, is: Pier 24 identifies workforce demand, builds talent pipelines, translates military experience into civilian capability, discovers employer opportunities, matches talent to those opportunities, manages engagement, and measures outcomes, without requiring the employer to replace or connect its HR technology.

## 2. Current-State Inventory

Classifications apply to the operator product. Routes stay in the repo until an approved milestone removes or redirects them. This audit deletes nothing.

### People and military

| Surface | Where | Class | Why |
| --- | --- | --- | --- |
| Candidate (Talent Network person) | `candidates` in `db/schema/talent/index.ts`; `/app/talent`, `/app/talent/[id]` | KEEP | One person record. Military status, location, relocation, compensation expectations, career interests, resume file, consent, and privacy class already live here. |
| Candidate experience | `candidate_experiences` | KEEP + EXPAND | Civilian or narrative duty history. `summary` is free text. Actual duties are not structured. |
| Candidate skills | `candidate_skills` | KEEP | Skill, years, proficiency, source, confidence, `human_verified`. Right grain for explicit vs inferred skills if source is used honestly. |
| Talent pools | `talent_pools`, `talent_pool_rules`, `candidate_talent_pools`; `/app/talent/pools` | KEEP | Useful Military Talent Network segmentation. Rules are text pairs, not a query language. |
| Silver medalists | `candidate_designations` type `silver_medalist`; `/app/talent/silver-medalists` | MERGE | Fold into a saved candidate view. The designation row can stay. |
| Watchlists | `/app/talent/watchlists` | MERGE | Same. A pool or saved view covers it. |
| Rediscovery | `/app/talent/rediscovery` | MERGE | Same. Prior match and pipeline status already exist. |
| Nurture | `/app/talent/nurture` | MERGE | Pipeline status already includes `nurture`. |
| Talent search | `/app/talent/search` | KEEP | Internal search before external sourcing is already the rule. |
| Military occupation library | `military_occupations`; `/app/military/occupations` | KEEP | Branch, classification (`mos`, `rating`, `afsc`, `specialty`), code, title, career field, source, version. Unique on branch + code. |
| Occupation skills | `military_occupation_skills` | KEEP + EXPAND | Reusable skill links. Still occupation-level, not duty-level. |
| Candidate military experience | `candidate_military_experiences` | KEEP | Many tours per candidate: occupation, rank, pay grade, years, leadership level, duty stations, platforms, training, certifications, clearance, transition date, notes. |
| SkillBridge profile | `skillbridge_profiles` unique on `candidate_id`; `/app/military/skillbridge/[id]` | RENAME | This is already the Transition Talent Profile. The table name and several columns are pathway-specific. See section 3. |
| Preferred locations and target roles | `skillbridge_preferred_locations`, `skillbridge_target_roles` | KEEP + EXPAND | Right shape. Rename with the profile. |
| SkillBridge documents | `skillbridge_documents` | MERGE | Resume files already attach to `candidates.current_resume_file_id` and `files`. Keep one document list on the person. |
| SkillBridge notes | `skillbridge_notes` | MERGE | `activities` and `candidate_engagements` already store notes and follow-ups. |
| Installations | `military_installations`, `military_occupation_installations`; `/app/military/installations`, `/app/military/installation-mapping` | MERGE | Keep the tables. One screen is enough. Interactive map stays deferred (`DEC-MIL-002`). |
| Civilian crosswalk | `/app/military/crosswalk` | MERGE | Same data as Skills Translator and Mapping Review. |
| Reverse search | `/app/military/reverse` | MERGE | This is opportunity-to-candidate matching. It belongs on the match screen, not a separate product. |
| Skills translator | `/app/military/translator`; `lib/military/translator.ts` | KEEP + EXPAND | Hiring-manager copy already refuses unapproved mappings. Grain is still occupation to title. |
| Mapping review | `/app/military/review`; `lib/military/review.ts` | KEEP | Human review, and the originating agent cannot approve. |
| Bridge training | `bridge_training_recommendations`; `/app/military/bridge-training` | MERGE | A gap on a mapping, not a top-level module. |
| Military analytics | `/app/military/analytics` | MOVE | Outcome counts belong with Reporting, fed by the same rows. |
| Military candidates list | `/app/military/candidates` | KEEP | Filtered view of `candidates`. Copy already says these are not a separate roster. |
| Employer opportunities (military) | `/app/military/opportunities`; `skillbridge_opportunities` | MERGE | Candidate-required routing records. Demand that exists before a person is a `jobs` row. See section 6. |
| Pathway operations and alerts | `/app/military/skillbridge`, `/app/military/skillbridge/alerts`; `skillbridge_alert_rules` | KEEP + EXPAND | The alert engine is the SLA system. Generalize codes beyond SkillBridge windows. |
| Public military intake | `POST /api/public/v1/military-talent`; `lib/military-talent/public-intake.ts`; `sites/pierone` join form | KEEP | Creates a Talent Network candidate. A public job is not required (`DEC-MIL-005`). |

### Demand, commercial, and hiring

| Surface | Where | Class | Why |
| --- | --- | --- | --- |
| Company | `companies`; `/app/companies` | KEEP | Target employer. Already has website, industry, military fit score, workforce opportunity score, owner, next action. |
| Company location | `company_locations` | KEEP | Business-unit geography can stay a location until a real business-unit table is justified. |
| Contact | `contacts`, `company_contacts`; `/app/contacts` | KEEP | Hiring managers and buyers. `jobs.hiring_manager_contact_id` already points here. |
| CRM opportunity | `opportunities`, `opportunity_scores`; `/app/opportunities` | RENAME | This is a Pier 24 sales pursuit (stage `identified` through `won` / `lost`). It is not an employer job. Label it Pursuit in the product. |
| Signals | `opportunity_signals`; `/app/signals` | MERGE | A signal can create a pursuit. It does not need its own nav item. |
| Website inquiries | `website_inquiries`; `/app/crm/inquiries` | KEEP | Public employer inbound. Qualify into a pursuit. |
| Discovery, solution plans, proposals | `discoveries`, `solution_plans`, `proposals`; `/app/discovery`, `/app/solutions`, `/app/proposals` | KEEP | How the other three consulting offers and pipeline assessments are sold. Demote in navigation. Do not delete. |
| Service catalog and workflows | `services`, `service_workflows`; `/app/services` | KEEP | Five launch services stay versioned in the database. Operators should not browse the catalog to do daily talent work. |
| Job | `jobs`, `job_skills`; `/app/jobs` | KEEP + EXPAND | Best existing employer-demand record. `company_id` is optional. Status, description, location, compensation, education, certifications, relocation, hiring manager, military compatibility, SkillBridge flag, and `job_context_type` (`internal`, `client`, `skillbridge`) already exist. |
| Job description versions | `job_description_versions` | KEEP | Description versioning already exists, including AI-generated and approver fields. |
| Job requisition | `job_requisitions`; `/app/recruiting/requisitions` redirects to Jobs | MERGE | Optional formal req. `business_unit` and `job_family` are text. Do not make a requisition mandatory for a public posting. |
| Job posting | `job_postings`; public `/careers` and `sites/pierone` careers | DEFER | Pier 24 publishing its own opening is fine for a search it runs. It is not employer-career discovery, and it must not become a public job marketplace. |
| Search project | `search_projects` | KEEP | Professional Search container (`DEC-SVC-002`). Not the military demand object. |
| Application and workbench | `applications` and related tables; `/app/recruiting/workbench`, `/app/recruiting/applications`, `/app/pipeline` | DEFER | Useful when Pier 24 runs the hiring process. Not required for independent military outreach. Keep the schema. Remove from the default nav. |
| Interviews, offers, placements, guarantees | `interviews`, `offers`, `placements`, `placement_guarantees` | KEEP | Placement and interview stay core. Guarantees are a Professional Search commercial term. Show guarantees on the placement, not as a nav peer. |
| Pre-hire stack | background checks, drug screens, references, `employees`, onboarding templates; `/app/onboarding` | DEFER | `DEC-HIRE-001` made WorkforceOS Pier 24's own pre-hire OS. That is compatible with independent mode only if it is Pier 24's record, not an employer HRIS replacement. Daily military work does not need drug screens or an employee record. |
| Public applicant status and self-schedule | `/careers/status/[token]`, `/schedule/[token]`, `public_access_tokens` | KEEP | Smallest external loop already exists. Reuse the token pattern later for a manager review link. Do not build a portal. |

### Workforce development

| Surface | Where | Class | Why |
| --- | --- | --- | --- |
| Workforce planning home | `/app/workforce` | KEEP + EXPAND | Second pillar. The 15-tab subnav is the problem, not the domain. |
| Assessments | `workforce_assessments` and child tables; `/app/workforce/assessments` | KEEP | Workforce Pipeline Assessment delivery object. |
| Roles and job family | `workforce_roles.job_family`, `workforce_role_skills`; `/app/workforce/roles` | KEEP | Employer role demand inside an assessment. Link to `civilian_occupations`. |
| Skills catalog | `skills`, `civilian_occupations`, `occupation_skills`; `/app/workforce/skills` | KEEP | Shared by matching, translation, and workforce gaps. |
| Forecasts, gaps, scenarios | `workforce_forecasts`, `workforce_gaps`, `workforce_scenarios` | KEEP | Demand and gap math. Collapse to one Demand view in navigation. |
| Supply | `workforce_supply_entries.source_type` includes `military`; `/app/workforce/supply`, `/app/workforce/military-supply` | KEEP + EXPAND | Military is already a supply source type. The overlay page reads approved mappings, not live transitioning headcount. |
| Pipelines, career paths, training, apprenticeships, education partners | matching tables in `db/schema/workforce/planning.ts` | KEEP | Pipeline strategy. Education partners are institutions, not a candidate's degree. |
| Labor market metadata | `labor_market_source_metadata`, `labor_market_observations`; BLS and Census adapters | KEEP | Labeled fixtures until keys exist. Do not present fixtures as live BLS or Census. |
| Workforce analytics | `/app/workforce/analytics` | MOVE | Reporting. |

### Delivery, finance, AI, admin

| Surface | Where | Class | Why |
| --- | --- | --- | --- |
| Delivery projects | `projects` and children; `/app/projects` | KEEP | Consulting delivery after a contract (`DEC-SVC-004`). Distinct from search projects. |
| Deliverables | `/app/projects/deliverables` | MERGE | A tab on the project. |
| Contracts and legal templates | `contracts`, `legal_templates`; `/app/contracts`, `/app/legal/templates` | KEEP | Required for sold work. Templates stay labeled draft until counsel approval. Not a daily talent screen. |
| Finance | `db/schema/finance/index.ts`; `/app/finance` | KEEP | Operating invoices and AR. Not a general ledger (`DEC-FIN-002`). Hide from talent operators. |
| Activities and candidate engagements | `activities`, `candidate_engagements` | KEEP + EXPAND | Follow-up, channel, response status, related job. This is the outreach log. |
| In-app notifications | `in_app_notifications` | KEEP | Alert delivery channel already chosen. |
| Automation rules | `automation_rules`, `automation_rule_runs` | KEEP | Do not add a second automation engine. |
| Approvals and audit | `approvals`, `audit_events` | KEEP | Material AI and submission approval. |
| AI operations and review queue | `/app/ai-operations`, `/app/ai-operations/review` | KEEP | Cost admin stays on `agents.manage`. Decide stays on domain approve permissions. |
| Knowledge records and semantic documents | `knowledge_records`, `semantic_documents` | KEEP | Embeddings stay development-hash `vector(1536)`. Do not activate production embeddings. |
| Integrations | `lib/integrations/hub.ts`, `INTEGRATION_CATALOG` | KEEP + EXPAND | Optional by design. No career-site adapter exists. |
| Research tables | `research_sessions`, `external_research_results`, `research_cache` | DEFER | Tables exist on `main`. The runtime that would fill them is parked at `1a356d3` and stays parked. Career discovery should not be implemented by merging that branch. |
| Scout | `lib/scout/commands.ts` and executors | KEEP + EXPAND | Closed registry. No SQL generation. See section 12. |
| Academy | `/app/academy`, `/app/academy/onboarding` | KEEP | Staff help. Not a candidate LMS. |
| Command Center and alerts | `/app`, `/app/alerts`; `lib/reporting/operating-rhythms.ts` | KEEP + EXPAND | Military cadence already exists as a tab, not a new module. |
| Reports | `/app/reports` | KEEP | Question-shaped reports. Extend; do not add a BI product. |
| Team and access | `/app/admin/users` | KEEP | Clerk authenticates. Local roles authorize. |
| Public content | `/app/public-content` | KEEP | Publishing control for the public site. Admin, not a talent workflow. |
| Staff onboarding | `staff_onboarding`; `/app/academy/onboarding` | KEEP | Pier 24 employees. Distinct from hire onboarding. |

## 3. Current Military Talent Architecture

There is no separate Military Talent person table. `DEC-MIL-003` and `DEC-MIL-005` already require one Talent Network candidate. `candidates.military_status` is an enum defaulting to `unknown`. A public intake can create the candidate without a job.

Occupation reference data lives in `military_occupations` (branch, classification type, code, title, career field, rank applicability, source, source version, mapping quality default `development_fixture`). Skills attach through `military_occupation_skills`. Installations attach through `military_occupation_installations` with presence, confidence, review status, and origin.

Per-person military history is `candidate_military_experiences`. One candidate can have many rows. Platforms, training, certifications, clearance, and duty stations are single text columns. There is no structured equipment list, no duty statement table, no supervisory headcount, and no education table on the candidate. `jobs.education` is a requirement on the job, not the person's schooling. `education_partners` are workforce-planning institutions.

The one-to-one overlay is `skillbridge_profiles` (`skillbridge_profiles_candidate_id_uq`). It holds branch, occupation, MOS/Rating/AFSC display, rank code and title, pay grade, installation, duty location, years of service, end of service, ETS, EAOS, separation, retirement, SkillBridge eligibility and window, terminal leave, available date, approval status, location and relocation and remote preference, ideal industry and employer, candidate status, resume status, owner, and next follow-up. Preferred locations and target roles are child tables. The product copy on `/app/military` already calls this a Transition Talent Profile. The schema name still says SkillBridge.

### Field coverage

| Desired field | Present today | Gap |
| --- | --- | --- |
| Military branch | `military_occupations.branch`, `skillbridge_profiles.branch` | Display can disagree across the two rows. |
| MOS / Rating / AFSC | `classification_type` + `code`, plus `mos_rate_afsc_display` | Display text can drift from the library code. |
| Rank | `rank` / `pay_grade` on the experience; `rank_code` / `rank_title` on the profile | Duplicated. |
| Years of service | `years_service`, `years_in_occupation`, `years_of_service` | Duplicated. |
| Separation date | profile date columns and `transition_date` on the experience | Duplicated. ETS/EAOS are correctly aliases, not a second person. |
| SkillBridge eligibility | profile window and `skillbridge_approval_status` | Correct as a pathway attribute. It is not the identity of the profile. |
| Location preferences | `skillbridge_preferred_locations`, candidate city/region | Good. |
| Relocation | text on candidate and profile | Unstructured. |
| Clearance | `candidate_military_experiences.clearance` text | No level enum, no investigation date. Treat as sensitive. |
| Certifications | experience text; some may be skills | Not a certification record. |
| Education | absent on the candidate | Must be added if matching uses it. |
| Leadership | `leadership_level` text | No span of control. |
| Technical systems / equipment | `platforms` text | Not matchable as records. |
| Actual duties | `notes` or `candidate_experiences.summary` | Not matchable as records. |
| Supervisory scope | absent | Leadership level is the only proxy. |
| Job preferences | `skillbridge_target_roles`, `candidates.career_interests` | Good start. |
| Industry preferences | `ideal_industry` text | Not a controlled list. |
| Compensation expectations | `candidates.compensation_expectations` text | Parsed by stripping digits in the matcher. |
| Resume ingestion | `files`, resume text extract for PDF and DOCX in `lib/hiring/resume-text.ts` | Works. |
| AI extraction | `lib/talent/apply-resume.ts` fills empty fields only and does not overwrite | Heuristic. Human values win. |
| Human review | `mapping_review_status`, `last_profile_review_at`, Mapping Review screen | Mappings are reviewed. Profile completeness is a resume status, not a reviewed capability profile. |

### Transition Talent Profile recommendation

Make the Transition Talent Profile a specialized profile layered on `candidates`, implemented by generalizing the existing one-to-one `skillbridge_profiles` row. Do not create a new person entity. Do not fold every tour into that one row: `candidate_military_experiences` stays the occupation history. SkillBridge dates, approval, and host-company pathway status stay columns and statuses on the profile because they describe one pathway, not a second human.

A first-class person table would violate `DEC-MIL-003`. An unstructured JSON extension on `candidates` would violate the relational-column rule for data that is filtered and reported. The layered profile is the schema-compatible model.

### Translation engine today

`military_civilian_mappings` stores one military occupation to one civilian occupation, with compatibility score, skills summary, certifications, gaps, bridge training, explanation, source, source URL, source version, AI model, confidence, review status, reviewer, and origin. Unique on the occupation pair, so mappings are reusable institutional knowledge. `mapping_quality` defaults to `development_fixture`.

Origins are `reference_data`, `human`, `agent`, `import`, and `system`. Agent and untrusted system rows start `pending`. `assertHumanMappingReview` rejects agent self-approval. `hiringManagerTranslation` shows only `approved` roles. Imports are recorded on `occupation_data_imports`. O*NET is an Integration Hub provider and stays a labeled fixture until configured.

The translation is deterministic once a mapping is stored. Drafting a new mapping can be AI-assisted and must be reviewed. There is no capability cluster, no equipment crosswalk, and no job-family translation table. `workforce_roles.job_family` and `job_requisitions.job_family` are free text. A Navy LS therefore becomes whichever civilian occupation titles were mapped, which is exactly the "Supply Chain Specialist" failure mode this audit is meant to correct.

`candidate_military_translations` stores a per-candidate hiring-manager summary, civilian summary, alignment, explanation, model, and review status defaulting to `pending`. That is a reviewed narrative, not a reusable capability library.

`lib/workforce/overlays.ts` joins approved mappings back onto workforce roles that share a civilian occupation. That is the only current bridge from military translation into workforce planning.

## 4. Current Workforce Development Architecture

Workforce Pipeline Assessment is a launch service with database workflows, not a hardcoded prompt. The planning schema in `db/schema/workforce/planning.ts` already implements the consulting model:

- Assessment, locations, data sources, assumptions, imports.
- Role demand: `workforce_roles` (company, optional assessment, civilian occupation, job family, headcount, criticality, scarcity, military compatibility text).
- Skills on the role: `workforce_role_skills`.
- Baseline, forecast, forecast components, overrides, results.
- Supply entries whose `source_type` includes `military`, `talent_network`, education, apprenticeship, labor market, and external recruiting.
- Gap thresholds, gaps, scarcity indicators.
- Education partners, training programs, apprenticeships.
- Talent pipelines and allocations.
- Career paths, levels, skills, edges.
- Skills-gap analyses, including scope `military_transition`.
- Scenarios, recommendations (status includes `pending_approval` and `approved`), roadmap items, KPIs, risks, pipeline plans.
- Labor-market source metadata and observations. BLS and Census adapters are honest fixtures without keys.

The military supply screen (`/app/workforce/military-supply`) loads up to eight workforce roles and calls `roleMilitaryOverlay`. It lists mapped occupations and installations. It does not count transitioning candidates, separation dates, or match readiness. Military talent is a reference overlay on a role, not yet an operating supply channel.

Job family is a text column, not an entity. Capability demand is `skills` linked to roles. Candidate pipelines in recruiting (`candidate_pipeline_status`) and workforce `talent_pipelines` are different objects and should stay different: one is a person moving toward a job, the other is a planned supply program.

## 5. Gap Analysis

| Desired capability | What exists | Gap |
| --- | --- | --- |
| Military Talent Network without an employer ATS | Candidates, public intake, pools | Network is real. Daily IA hides it inside Talent plus Pathway. |
| Transition Talent Profile | `skillbridge_profiles` 1:1 | Named and modeled as SkillBridge. Duties, equipment, education, supervisory scope, and clearance are unstructured or missing. |
| Capability translation | Occupation-to-title mappings, reviewed | No capability, competency cluster, or job-family grain. Fixtures can look like knowledge. |
| Public employer opportunity discovery | Company website field. No crawler on `main`. | No career source, no sync health, no external job identity. |
| Employer demand without a client requisition | `jobs.company_id` nullable; context type has three values | No monitored-public, evergreen, or exploratory context. Military "employer opportunity" cannot exist without a profile id. |
| Match beyond title keywords | Component scores for skills, experience, industry, location, compensation, certification, military, career, prior feedback | Military matcher does not load job skills. Military score is mostly "an occupation title exists." No Strong / Possible / Developmental / None bands. No inferred-vs-explicit flag. |
| Candidate to opportunities | `findSkillBridgeMatches` over open jobs | Skill-blind and SkillBridge-window biased. |
| Opportunity to candidates | `lib/repositories/recruiting.ts` scores a job's candidates with required and preferred skills | Not wired to monitored public jobs or to Scout's military examples. |
| Tracked outreach instead of emailed resumes | Engagements, activities, submission approval, SkillBridge stages | Two status machines. No manager review link. Scout external send stays permission-gated. |
| SLA visibility | `skillbridge_alert_rules`, Command Center military cadence, notifications | Rules are pathway-named. Public posting close dates and "no strong match" are not first-class. |
| Outcome learning | Placements, opportunity outcome text, analytics pages, `ai_usage_events` | No occupation-to-placement fact table. Embeddings are not a learning system and must stay off. |
| Military supply inside workforce plans | Supply source type `military`, overlay page | Live network counts are not the supply number. |
| Independent mode | Adapters are optional and labeled mock until configured | `DEC-HIRE-001` and the Talent nav still present WorkforceOS as an ATS the operator must run. |
| Scout for this model | Closed commands and several military prompts | Many military prompts resolve to the `skillbridge` entity. Example questions about new technician postings cannot be answered because those postings are not ingested. |

Parked commit `1a356d3` adds `lib/research/web.ts`, `lib/research/intelligence.ts`, `lib/research/provenance.ts`, an alternate AI stack, and `lib/scout/source-route.ts`. Those files are not on `main`. Provenance and cache ideas may be reused later under an explicit approval. This modernization does not merge that branch and does not treat it as the career-discovery design.

## 6. Proposed Canonical Data Model

Reuse current tables. Names below are product names. Physical renames wait for an approved migration.

```text
organizations
  └── companies                         target employer (existing)
        ├── company_locations           sites (existing)
        ├── contacts                    hiring managers and buyers (existing)
        ├── opportunities               RENAME in product to Pursuit (sales)
        ├── career_sources              NEW thin registry
        │     └── jobs                  EXPAND as Employer Opportunity
        │           ├── job_skills
        │           ├── job_description_versions
        │           └── job_requisitions     optional connected-mode child
        └── workforce_assessments
              └── workforce_roles       job family text today; later a job_families row if reporting needs it
                    ├── workforce_role_skills
                    ├── workforce_supply_entries   source_type = military | talent_network | ...
                    ├── workforce_gaps
                    └── talent_pipelines

candidates                              the person
  ├── candidate_experiences             duties narrative until structured duty rows exist
  ├── candidate_skills                  explicit skills; source marks inferred vs human
  ├── candidate_military_experiences    tours, occupation, platforms, clearance
  ├── transition profile                existing skillbridge_profiles, 1:1
  │     ├── preferred locations
  │     └── target roles
  └── candidate_job_matches             unique (candidate_id, job_id)
        ├── explanation, component scores, review status
        ├── submissions                 human approval before anything leaves Pier 24
        ├── interviews
        ├── placements
        └── candidate_engagements       outreach and response

military_occupations
  ├── military_occupation_skills
  └── military_civilian_mappings        KEEP occupation → civilian occupation
        └── skills / civilian_occupations
              capability statements stay skills until a cluster is proven necessary

career_sources
  company_id, adapter_key, source_url, source_kind
  (feed | api | manual_url | csv | public_site)
  cadence, robots_respected, last_success_at, last_error, health
  └── jobs.external_key unique per source, content_hash, closed_at, source_url
```

There is no separate Business Unit table today. `job_requisitions.business_unit` and `workforce_roles.business_function` are text. Keep text until an employer has many units that must be filtered independently. Then add `company_business_units` rather than overloading location.

There is no Job Family entity. `workforce_roles.job_family` is the reporting field. Promote it to `job_families` only when matching and outcome reports group on it. Until then, store the family string on the expanded job and on the workforce role, and keep `civilian_occupations` as the occupation code.

Do not create `employer_opportunities`. `skillbridge_opportunities` requires `skillbridge_profile_id` and `candidate_id`, so it cannot represent a posting nobody has been matched to yet. `jobs` can. CRM `opportunities` are pursuits with a fee, a stage, and a close date. Mixing a public requisition into that table would corrupt the commercial pipeline.

`skillbridge_opportunities` remains the pathway routing row until milestone M6 copies its stage, employer interest, and next action onto `candidate_job_matches` plus `candidate_engagements`. After that, new military routing should write the match row. The old table stays readable.

Capability: keep `skills` (families already include technical, leadership, business, digital, safety). Add military-occupation-to-skill mappings that record the duty or equipment evidence, not only the MOS code. A Navy LS then maps to inventory control, procurement, material accountability, and supervisory experience as skills, and those skills map to civilian occupations and job families. The civilian title remains a rollup, not the translation.

Match bands are derived from the stored score and gap counts. They do not need a new table. Suggested labels, applied by a reviewed rule rather than a hidden model: Strong, Possible, Developmental, No current match.

Outcome learning reads placements, submission outcomes, engagement response status, and mapping ids. It does not need a new ML table in the first milestones.

## 7. Proposed Canonical Workflow

```text
Transitioning service member
  → candidates row (Military Talent Network)
  → transition profile (1:1 overlay) + military experience tours
  → resume ingest; empty fields filled; human reviews the profile
  → capability translation
        stored occupation mappings
        + duties, equipment, certifications, leadership
        → skills (explicit or inferred, marked)
        → civilian occupations and job-family labels
        → human approves before hiring-manager copy
  → employer demand
        target company
        → career source or manual job
        → jobs row (public, exploratory, evergreen, client search, or pathway)
  → candidate_job_matches both directions
        Strong / Possible / Developmental / No current match
        explanation: aligned requirements, gaps, inferred vs explicit
  → recruiter review (human)
  → approved outreach (human sends)
  → employer response (interested, future fit, not a fit, refer, interview)
  → interview
  → pathway: SkillBridge, direct hire, or other
  → placement
  → outcome recorded for later reports
```

Workforce planning sits beside this, not after it:

```text
Employer workforce need (assessment + workforce role)
  → job family and skill demand
  → supply entries
        military network counts for that occupation and skill
        plus education, apprenticeship, internal, labor market
  → gap
  → pipeline plan
  → execution uses the same candidates and jobs
  → outcomes update the next assessment
```

SkillBridge window, command approval, and host-company ownership stay inside the pathway step. They are not the start of the flow and not a Pier 24 program roster.

## 8. Opportunity Discovery Architecture

Build a `CareerSourceAdapter` beside the Integration Hub, not inside `PlaceholderAdapter`. The current `IntegrationAdapter` is `connect`, `disconnect`, `healthCheck`, `sync`, `lookup`, `importRecords`, `exportRecords` for a fixed provider list: Apollo, O*NET, BLS, Census, LinkedIn Recruiter, SeekOut, hireEZ, Microsoft, Google, DocuSign, QuickBooks, Checkr, Resend, and a manual drug-screen provider. None of those fetch an employer career site. LinkedIn is already specified as no-scrape.

Adapter contract:

- `sourceKind`: `feed` (XML, RSS, JSON), `employer_api`, `manual_url`, `csv`, or `structured_public_html` only where the page is public and `robots.txt` allows the path.
- `identity`: stable external requisition id when the source provides one; otherwise a hash of employer + canonical URL + title.
- `fetch`: returns normalized postings or a clear health error. No credentials are invented. No session cookies. No CAPTCHA solving. No authenticated ATS tenant. No ignore-robots flag.
- `normalize`: title, description text, location, employment type, posted date, close date if present, apply URL, raw payload pointer.
- `diff`: new, changed (content hash), unchanged, missing (closed after a configured absence).

Registration is a `career_sources` row owned by a `companies` row: adapter key, URL or feed URL, cadence, enabled flag, last success, last error, health. Cadence default should be daily for feeds and weekly for manual URL review. Manual import (paste URL, upload CSV) is a first-class source, not a fallback after a scraper fails.

Job lifecycle uses `jobs`:

- Insert or update on `(career_source_id, external_key)`.
- Write a new `job_description_versions` row when the hash changes.
- Set status `closed` when the source reports closed or the posting is absent for the configured window.
- Keep `source_url` on the job.
- `job_context_type` gains `monitored_public`, `exploratory`, `evergreen`, and `workforce_need` alongside `internal`, `client`, and `skillbridge`.
- `skillbridge_eligible` stays a boolean on the job, set by a human. Discovery must not infer DoD SkillBridge approval from a public posting.

Source health is the adapter health row: last successful sync, last error, consecutive failures, and a Command Center exception when a monitored employer goes stale. That replaces a new alerting product.

Legal and access boundaries, for counsel before M4 is enabled in production:

- Store the source URL, retrieval time, and the employer name with the description.
- Prefer official feeds and APIs over HTML.
- Honor `robots.txt` and published terms. Refuse adapters whose only method is bypassing access controls.
- A public posting is the employer's content. Retention and display need a counsel pass before descriptions are shown to clients or used as training text.
- Do not use the parked research web client as the fetcher.

Workday, iCIMS, Greenhouse, Lever, SuccessFactors, Oracle, and custom sites are adapter keys. Ship manual URL, CSV, and one feed type first. Add a vendor adapter only when that vendor exposes a public feed or API Pier 24 is allowed to call.

## 9. Matching Architecture

One function already exists: `scoreCandidateJobMatch` in `lib/recruiting/matching.ts`. It scores skills, experience, industry (title and description tokens), location, relocation willingness, compensation, certifications, military occupation title plus military skill overlap, career-interest tokens, and silver-medalist or prior-reject feedback. Weights are fixed in code. The result stores overall and component scores, strengths, gaps, and a single explanation sentence on `candidate_job_matches`, unique on `(candidate_id, job_id)`.

Use that row for both directions.

Candidate to opportunities: load the transition profile, approved skills, and military experience; score every open `jobs` row in the organization, including `monitored_public`. Persist the match. This is what `findSkillBridgeMatches` almost does, except it passes `jobSkillNames: []` and boosts `skillbridgeEligible` jobs. Fix the skill load. Keep the pathway boost as a filter the recruiter chooses, not the default rank.

Opportunity to candidates: the recruiting repository already scores candidates for one job using required and preferred `job_skills`, military occupation skills, and designations. Point monitored jobs at that same function. Scout `FIND_MATCHES` on a job should call it. Scout `FIND_MATCHES` on a candidate should call the other direction. Both require `jobs.read` and `candidates.read`, and candidate PII stays stripped from model context.

Bands:

- Strong: high overall, required skills present, no hard gap on clearance, location, or mandatory certification.
- Possible: material overlap with a stated gap a recruiter can discuss.
- Developmental: job-family or capability overlap with missing credentials, experience, or timing. This is a workforce-pipeline candidate, not a submission.
- No current match: below the floor, or hard constraint failed (clearance, location with no relocation, separation far outside the need).

Explainability, stored on the match, not only in a paragraph:

- Requirements that aligned, each marked `explicit` (skill row, certification text, clearance, location) or `inferred` (occupation mapping, token overlap).
- Gaps.
- Mapping ids and skill ids used, so a reviewer can see the provenance.
- Model name only if a narrative was drafted. The numeric score stays deterministic from stored fields.

Human review: `candidate_job_matches.human_review_status` already exists. A material recommendation is not outreach. `submissions` already have `pending_approval`, `submitted_by_user_id`, and `approved_by_user_id`. The approver cannot be the originating agent (`DEC-MIL-001` pattern, already enforced for mappings). AI must not set a disposition of rejected as an employment decision. `rejected` in the pipeline remains a human status. Background-check and drug-screen providers already must not auto-reject.

Do not add a second matching table.

## 10. Routing / Outreach Architecture

Pier 24 staff work inside WorkforceOS. The employer does not need an ATS account.

Reuse `candidate_pipeline_status` on the match as the routing state. Compare the requested list to what is already stored:

| Requested | Use existing | Change |
| --- | --- | --- |
| New | match row created, pipeline `sourced` or `identified` | Keep. |
| Matched | score stored | Add the four bands as labels. |
| Recruiter review | `human_review_status` pending | Keep. |
| Approved for outreach | `submissions.status = pending_approval` then approved | Keep the submission gate for anything sent externally. |
| Outreach sent | `candidate_engagements` outbound | Record channel, subject, related job, user. |
| Viewed / acknowledged | `response_status` text | Constrain the values. |
| Interested | pipeline `interested`; SkillBridge `employer_interest` | One field on the engagement or match. |
| Future fit | pipeline `nurture` is close | Add `future_fit` if nurture is too vague for employers. |
| Referred | no status | Add `referred` plus the contact id. |
| Not a fit | `declined` / `rejected` | Human only. Record reason. |
| Interview | pipeline `interview` and `interviews` | Keep. |
| Opportunity identified | SkillBridge stage `opportunity_identified` | The job existing is the identification. Do not duplicate. |
| Placed | pipeline `placed` and `placements` | Keep. |
| Closed | job `closed` or pipeline terminal | Keep. |

`skillbridge_opportunity_stage` overlaps this list (`employer_submitted`, `hiring_manager_review`, `interview`, `hired`, `employer_declined`, `no_match_yet`). Leave those stages in place for current pathway rows. New work should write the match pipeline and engagements so staff do not update two boards.

Outreach itself: Scout `DRAFT` may prepare a brief. A human with `scout.external_actions` and `transactional_email.send` confirms the send through Resend. Recruiter templates do not hold external send. That gate stays.

The military talent review a manager receives is a document, not a login:

- Candidate name and the background the recruiter chose to include.
- Potential role and job family.
- Why this may fit, from approved mappings and explicit skills only.
- Actions: Interested, Future fit, Not a fit, Refer, Request interview.

Smallest implementation: the recruiter generates the brief from `hiringManagerTranslation` plus the match explanation, sends it with the existing email path, and logs the reply on `candidate_engagements.response_status`. A later optional step is a single-purpose token link, the same pattern as `/schedule/[token]`, that posts one of those five actions. That is not a client portal. Ledger row "Client portal" stays deferred. `DEC-SEC-001` stays in force.

Hiring manager identity is a `contacts` row linked from `jobs.hiring_manager_contact_id`. No employer user account is required.

## 11. Workforce Development Integration

Military talent becomes a supply channel on the assessment the firm already sells.

```text
workforce_roles (demand for a company)
  job_family + workforce_role_skills + civilian_occupation_id
       ↑
military_civilian_mappings and occupation skills (approved only)
       ↑
candidate_military_experiences + candidate_skills + transition profile
       ↓
workforce_supply_entries source_type = military
  estimated_supply = count of reviewed profiles in geography and timing
  readiness = Strong / Possible / Developmental counts
       ↓
workforce_gaps
       ↓
talent_pipelines and workforce_pipeline_plans
       ↓
execution: the same jobs and candidate_job_matches
       ↓
placements and conversion notes update the next baseline
```

`/app/workforce/military-supply` should show those counts. It should keep using `roleMilitaryOverlay` for the mapping proof, and add the candidate count beside it. It should not copy occupations into a workforce-only table.

Other supply types stay: internal mobility, labor market, apprenticeship, community college, university, technical school, training program, talent network, workforce board, external recruiting. Military is one row type among them. A gap that military supply cannot fill is a training or recruiting pipeline, which is the point of the workforce offer.

Professional & Technical Search continues to use `search_projects` and internal talent search first. A search job can also be matched to military profiles when `military_compatibility` or the recruiter says so. That is a filter, not a second network.

TA Performance Assessment and Fractional Talent Partner stay delivery projects. They are not pillars and they are not deleted.

## 12. Scout Changes

Scout commands are a closed registry in `lib/scout/commands.ts`. Families: `SEARCH`, `SUMMARIZE`, `DRAFT`, `CREATE`, `UPDATE`, `ASSIGN`, `ADD_TO_POOL`, `ADD_TO_JOB`, `CREATE_TASK`, `CREATE_FOLLOW_UP`, `SHOW_RECORD`, `SHOW_DASHBOARD`, `FIND_MATCHES`. Each has a permission, a risk class, and a confirm flag for writes. Unknown families are rejected. Scout does not generate SQL. PII strip remains. External send remains off unless the human permission and confirmation token are present.

| Action | Command | Recommendation |
| --- | --- | --- |
| KEEP | All 13 families | Do not add a SQL, crawl, or freeform agent command. |
| KEEP | `SEARCH` on candidates, jobs, companies, military profiles | Permission checks in `lib/scout/search.ts` stay. |
| KEEP | `FIND_MATCHES` | Split behavior by page context: candidate yields jobs; job yields candidates. |
| KEEP | `DRAFT`, `CREATE_TASK`, `CREATE_FOLLOW_UP` | Outreach and SLA. Confirm writes. |
| KEEP | `SHOW_DASHBOARD` cadences including military and GTM | Extend the military cadence; do not add a new family. |
| CHANGE | Intent parser in `lib/scout/parse-intent.ts` | Military questions currently collapse to entity `skillbridge`. Route "transitioning service member", "no strong match", and "separating within 90 days" to candidates plus transition profiles. Route "technician opportunities this week" to jobs with a monitored source and a posted-date filter, once M4 exists. |
| CHANGE | `findSkillBridgeMatches` call from Scout | Pass real job skills. Do not hide non-SkillBridge jobs unless the user asked for that pathway. |
| CHANGE | Suggested prompts in `lib/scout/prompts.ts` | Keep the military examples. Add the founder examples only after the underlying query exists, so Scout does not invent an answer. |
| ADD | No new family | New questions are filters on `SEARCH`, `FIND_MATCHES`, and `SHOW_DASHBOARD`: strong matches, no strong match, outreach unanswered past a threshold, separating within N days, jobs discovered since a date, match explanation for one pair. |
| REMOVE | Nothing from the registry | Do not remove families that Professional Search and delivery still use. |
| DO NOT ADD | Unrestricted SQL, web browse, or "figure out the query" | Closed registry stays the security boundary. |

Example coverage after M5, M6, and M8, still inside current families:

- Strong matches to electrical maintenance openings: `FIND_MATCHES` or `SEARCH` with skill and band filters.
- Roles for a Navy LS outside logistics: `FIND_MATCHES` on that profile using capability skills, not only the mapped title.
- Employers with new technician postings this week: `SEARCH` jobs by source sync time. Blocked until career sources exist.
- Military candidates with no strong match: `SEARCH` candidates where the best match band is below Strong.
- Outreach unanswered more than seven days: `SEARCH` engagements. `skillbridge_alert_rules.employer_feedback_overdue` is the pattern to generalize.
- Why this candidate matches this opportunity: `SHOW_RECORD` on the match, returning stored strengths, gaps, and inferred flags.
- Separating within 90 days with no active opportunity: `SEARCH` on separation or window dates. Alert code `window_approaching` is the existing cousin.

## 13. Navigation Redesign

Current sidebar (`components/navigation/nav-config.ts`) is six groups and about fifty links: Command Center, Reports, Alerts, Help, Staff onboarding, then Commercial (9), Delivery (6), Talent (18), Pathway (13), Admin (6). Military and Workforce each add a second tab bar of 14 and 15 items. That is the bolt-on the product should stop growing.

Proposed primary navigation:

| Group | Items | Notes |
| --- | --- | --- |
| Home | Command Center, Alerts | Reports can sit here or under Reporting. One of the two, not both as equal pillars. |
| Talent | Candidates, Search | Pools, silver medalists, watchlists, rediscovery, and nurture become views on Candidates. |
| Military Talent | Network, Profiles, Translation, Matches, Pathway | Network is the military filter of Candidates. Translation includes library, crosswalk, and review. Pathway includes SkillBridge windows, alerts, placements. |
| Employers | Companies, Contacts, Opportunities, Pursuits | Opportunities means `jobs`. Pursuits means CRM `opportunities` plus inquiries. |
| Workforce | Assessments, Demand, Supply | Demand folds roles, forecasts, gaps, and scenarios. Supply folds military supply, pipelines, training, and partners. |
| Delivery | Projects, Proposals and contracts | Discoveries and solution plans open from the pursuit. Finance opens for finance permissions from the project or a single Finance item. |
| Admin | Team and access, Review Queue, Connected tools, Help | AI cost, prompts, public content, and legal templates stay behind these, as they mostly do today. |

Move, do not delete:

| Current | Proposed |
| --- | --- |
| `/app/talent/silver-medalists`, `watchlists`, `rediscovery`, `nurture` | Candidate views |
| `/app/military/translator`, `occupations`, `crosswalk`, `review`, `bridge-training` | Translation |
| `/app/military/installations`, `installation-mapping` | One installations tab under Translation or Network |
| `/app/military/reverse` | Matches, opportunity-to-candidate |
| `/app/military/opportunities` | Employers → Opportunities, once jobs are the demand record |
| `/app/military/analytics`, `/app/workforce/analytics`, `/app/recruiting/analytics` | Reporting |
| `/app/jobs`, requisitions, search projects | Employers → Opportunities, with a Professional Search filter |
| `/app/pipeline`, submissions, interviews, offers, placements | Match and pathway workspace |
| `/app/signals`, `/app/discovery`, `/app/solutions`, `/app/services` | Inside a pursuit |
| Workforce 15 tabs | Three tabs plus in-page sections |
| `/app/onboarding`, guarantees, applications workbench | Delivery or search workspace, hidden from the military default |

Permission gates stay. Recruiters still do not receive `opportunities.read` for sales pursuits (`DEC-RBAC-001`). They do need to see employer demand. That is an argument for keeping demand on `jobs` (`jobs.read`), which recruiters already have, and leaving CRM pursuits on `opportunities.read`.

## 14. Features to Remove / Merge

Aggressive on the operator surface. Schema drops wait for a later approved migration after reads are moved.

| Item | Class | Reason |
| --- | --- | --- |
| Second military person or SkillBridge roster | REMOVE as a concept | Already forbidden. Keep enforcing it. |
| `skillbridge_*` as the product name for all military work | RENAME | Pathway only. |
| Occupation-title translation as the whole engine | KEEP + EXPAND | Necessary rollup. Insufficient alone. |
| Crosswalk, reverse search, installation mapping, bridge training as peer modules | MERGE | Duplicate doors onto the same tables. |
| Silver medalist, watchlist, rediscovery, nurture modules | MERGE | Views and designations. |
| CRM opportunity used as a job | REMOVE that usage | Pursuits stay commercial. |
| New `EmployerOpportunity` table | REMOVE from the design | `jobs` can carry demand. |
| Mandatory client requisition before matching | REMOVE that assumption | `jobs.company_id` is already nullable. Public and exploratory context types make it explicit. |
| Requisition as a required parent of a job | MERGE | Optional child for connected mode. |
| Applications, employees, drug screens, background checks as the front door | DEFER | Connected or Pier 24-run search only. |
| Public careers as a job marketplace | DEFER | Out of policy. Pier 24 may still publish a search it owns. |
| Client portal | DEFER | Already deferred. Token review link is the smaller step. |
| Parked research runtime `1a356d3` | DEFER | Do not merge. |
| Production embeddings and RAG over the docs | DEFER | `DEC-SEM-001`. Ledger AI stage 3 is not started. |
| Interactive installation map | DEFER | `DEC-MIL-002`. |
| Gemini fallback activation | DEFER | Already deferred at launch. |
| Full LMS | DEFER | Academy stays lightweight. |
| Finance general ledger, payroll, benefits, temp staffing, cap table | REMOVE from any future scope | Existing decisions. This audit does not reopen them. |
| Signals, service catalog, legal templates, AI cost screens in the talent sidebar | MOVE | Still exist for the people who need them. |
| Development fixture mappings presented as official crosswalks | REMOVE that presentation | `mapping_quality = development_fixture` must stay visible. Hiring-manager copy already excludes unapproved rows. |
| Duplicate follow-up systems | REMOVE from the design | Alerts, activities, engagements, notifications, and Inngest scans stay. No new reminder product. |
| Scout SQL or open web browsing | REMOVE from the design | Closed commands only. |

Commercial offers that stay, smaller in the IA: Professional & Technical Search, TA Performance Assessment, Fractional Talent Partner, Workforce Pipeline Assessment, Military Talent Opportunity Assessment. SkillBridge is not a sixth offer.

## 15. Brand Migration Inventory

Intended brand, not applied by this audit: Pier 24 Partners. Tagline: Talent. Workforce. Opportunity. Colors from the founder logo: deep navy `#0E2D4A`, teal `#4E7B8C`, slate `#6B7280`.

Do not rename piecemeal. A later milestone changes code, domains, Clerk, Resend DNS, OAuth consent, HMAC header names, and the public site together. Historical decision-log entries and migration snapshots keep the old name as history.

| Surface | What uses PierOne today | Migration note |
| --- | --- | --- |
| Public site | `sites/pierone/` application, `SITE_NAME` in `sites/pierone/lib/content.ts`, pages for home, what we do, about, industries, military talent, SkillBridge, careers, contact, privacy | Whole site is the brand. Vercel project and root directory assumptions live in `docs/public-site/`. |
| Domains | `pieronepartners.com`, `www.pieronepartners.com`, `app.pieronepartners.com` in `docs/public-site/DOMAIN_SETUP.md`, deployment checklists, backlog | DNS, Clerk production domains, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`. |
| In-app chrome | `app/layout.tsx` title "WorkforceOS · PierOne Partners"; sign-in page; proposal eyebrow; military and inquiry copy; nav title "PierOne employee onboarding" | Product name WorkforceOS can remain the system name. Company name changes. |
| Logos | `public/brand/` (`pierone-icon.svg`, primary, stacked, monochrome, brand sheet) and `sites/pierone/public/brand/`, `components/branding/brand-mark.tsx`, `sites/pierone/components/brand/logo.tsx` | Replace assets in one pass. `docs/public-site/IMAGE_PLAN.md` references `PierOneMark`. |
| Email | `RESEND_FROM_EMAIL`; docs cite `careers@` / `noreply@pieronepartners.com` in `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md` and `docs/integrations/RESEND.md` | New verified domain before the from-address changes. |
| HMAC | `x-pierone-site-timestamp`, `x-pierone-site-signature`, `x-pierone-request-id` in `sites/pierone/lib/contracts.ts` and WorkforceOS verifier | Header rename is a coordinated public-site and app deploy. Old headers need a short dual-accept window. |
| Package | `@pierone/public-api-contracts` | Package rename touches both apps. |
| Public intake source | `website_inquiries.source` default `pierone_public_website`; military intake source string | New source value; do not rewrite historical rows in place without a decision. |
| Clerk | Production instance documented as invite-controlled; domains on `app.pieronepartners.com` | Consent screen and allowed origins. No metadata-as-permission change. |
| OAuth | Google and Microsoft calendar apps, DocuSign, QuickBooks | Consent display name and redirect URLs. |
| PDFs and contracts | Proposal page "PierOne Partners" and "PierOne responsibilities"; legal templates; seed and smoke file names in the ledger | Template body is counsel-owned. Do not auto-edit attorney-approved text. |
| Scout knowledge and Academy | `lib/academy/catalog.ts`, knowledge slugs such as `pierone-operating-manual` and `pierone-90-day-gtm-plan` in `db/seed/phase7.ts` | Re-seed after copy changes or Scout cites the old name. |
| Operating manuals | `docs/business/PIERONE_OPERATING_MANUAL.md`, `PIERONE_90_DAY_GTM_PLAN.md`, service catalog, playbooks, master spec, AGENTS.md | Documentation set moves with the milestone, including filenames if search depends on them. |
| Env and Vercel docs | `docs/operations/PRODUCTION_API_KEYS.md`, `DEPLOYMENT.md`, `ENVIRONMENT_MATRIX.md` | Names of projects and URLs. Secret values stay out of git. |
| Tests | `sites/pierone/tests/site.test.ts`, `tests/public-gateway.test.ts`, phase tests asserting hostnames | Update with the rename so CI matches production. |
| Drizzle snapshots | default `'pierone_public_website'` in historical snapshots | Leave snapshots. A forward migration may change the column default. |

WorkforceOS as the software name is not the company name. This inventory does not require renaming the repository, the Neon project, or the `workforceos` organization slug.

## 16. Security / Privacy / Compliance Review

Preserve these controls. They already exist in decisions and code:

- Human approval before a candidate is submitted (`submissions.approved_by_user_id`, status `pending_approval`).
- Human approval of material AI output; originating agent cannot approve a military mapping (`lib/military/review.ts`, `DEC-MIL-001`, `DEC-AI-012`).
- Hiring-manager translation uses approved mappings only.
- No automated employment rejection from match scores, background checks, or drug screens.
- Candidate data is restricted PII. `candidate_pii.read` gates email, phone, compensation, and resume. Scout strips those before model context.
- Server-side RBAC. Clerk is authentication. Disabled local users stay rejected.
- Tenant boundary is `organization_id` on candidates, jobs, companies, and profiles.
- Audit events for material changes. Do not log tokens or secrets.
- Public writes require HMAC (`DEC-WEB-011`). Origin is not authentication.
- Talent Network search before external sourcing.
- Embeddings stay non-production until a model and dimension are chosen together.

New issues to flag for counsel and for the security review of each milestone. This audit does not state legal conclusions.

| Topic | Risk to examine |
| --- | --- |
| Public job ingestion | Copyright, site terms, and database rights in stored descriptions. Attribute source URL and retrieval time. Prefer feeds the employer publishes for syndication. |
| Description retention | How long unchanged and closed postings are kept, and whether full text is shown outside Pier 24. |
| Crawling | `robots.txt`, rate limits, and a hard ban on authentication bypass, CAPTCHA bypass, and access-control evasion. An adapter that needs those techniques is out of scope. |
| Automated matching | Scores and bands are recommendations. They must not be the decision to reject a person or to contact an employer. Store inferred vs explicit so a reviewer can see guesses. |
| Employer outreach | Commercial email rules, do-not-contact on `contacts` and `candidates`, and human send confirmation. |
| Manager review link | Token scope should be one brief and five actions, expiring, unguessable, rate-limited, and free of extra PII. No account creation. |
| Outcome learning | Historical placement patterns can repeat biased employer behavior. Reports can show associations. They must not auto-change a person's eligibility or auto-suppress a protected class. No autonomous hiring model. |
| Clearance | Free-text clearance is sensitive. Limit it to military permissions. Do not put it in Scout model context or in a manager brief unless the recruiter includes it. |
| Shared career-source data | A public posting is not candidate PII, but it is still tenant-scoped if Pier 24's target list is confidential. Do not build a cross-tenant job pool. |
| Candidate fees | This audit did not find a code invariant that blocks charging candidates. Product policy should stay that candidates are not charged. Counsel should confirm public-site and contract language when the brand milestone runs. |
| SkillBridge representation | Do not state that Pier 24 is the host or that command approval is guaranteed. Current copy matches `DEC-MIL-005`. Discovery must not mark a public job SkillBridge-eligible without a human. |
| Fixture mappings | Development mappings must not be exported as official military crosswalks. |

## 17. Implementation Roadmap

Name: Military + Workforce Core Modernization.

These milestones are not Build Phases 1–10 and they are not Phase 11. Phase 11 research runtime stays parked. Nothing here starts until the founder accepts a decision that supersedes the conflicting bits of `DEC-HIRE-001` (WorkforceOS as the employer's ATS) and the concept note that an employer opportunity is not a job. Until that acceptance, this roadmap is a proposal.

Each milestone should land as its own reviewed change, with migrations only when that milestone needs them, and with tests that exist in this repo's Vitest style.

### M1 — Canonical data model

- Objective: Make `jobs` the employer-demand record and `skillbridge_profiles` the transition profile in the schema, without a new person table and without a new opportunity table.
- Code: `db/schema/recruiting/index.ts`, `db/schema/enums.ts` (`job_context_type`), `db/schema/skillbridge/index.ts` only if a view or comment is required. Add `career_sources` empty of adapters. Point nothing at a crawler yet.
- Migrations: new context values; `career_sources`; job columns for `career_source_id`, `external_key`, `source_url`, `content_hash`, `closed_at`. Unique `(career_source_id, external_key)`.
- Risk: CRM reports and recruiter permissions break if pursuits and jobs are merged. Do not merge them.
- Dependencies: founder acceptance of section 6.
- Acceptance: a job can be saved with a company and no candidate, no requisition, and context `monitored_public` or `exploratory`. A transition profile still requires a candidate and remains unique per candidate. SkillBridge rows still read.
- Tests: schema and repository tests for the unique keys and for recruiter access to jobs without `opportunities.read`.

### M2 — Transition Talent Profile

- Objective: One operator screen for the overlay plus tours, with structured clearance level, education, equipment, duties, and supervisory scope as relational columns or child tables.
- Code: military profile pages, `lib/military-talent/public-intake.ts`, resume apply.
- Migrations: child tables or columns. Backfill from existing text only where the parse is obvious; otherwise leave text in place and show both.
- Risk: duplicate rank and dates if experience and profile are both edited. One field wins; document which.
- Dependencies: M1.
- Acceptance: a recruiter can see branch, code, rank, years, separation, location, relocation, clearance, certifications, education, leadership, equipment, duties, preferences, compensation, and resume on one profile. Empty resume fields still do not overwrite human values.
- Tests: profile load, unique candidate, PII permission, resume fill-empty.

### M3 — Capability translation

- Objective: Map occupation plus evidence to skills, then to civilian occupations and job-family labels. Titles remain a rollup.
- Code: `military_occupation_skills`, mapping review, translator, workforce overlay.
- Migrations: evidence text and source on occupation-skill links; optional job-family label table only if M1 did not keep the string.
- Risk: fixture mappings shipped as truth. Default new agent rows to pending.
- Dependencies: M2 for duties and equipment evidence. Library mappings can start earlier.
- Acceptance: a reviewed Navy LS-style occupation can show multiple capabilities and more than one civilian role. Hiring-manager copy still excludes pending rows. The originating agent cannot approve.
- Tests: review state machine, translator filter, overlay uses approved rows only.

### M4 — Opportunity discovery

- Objective: Manual URL, CSV, and one public feed adapter writing `jobs` through `career_sources`.
- Code: new adapter module beside `lib/integrations`. No change that merges `1a356d3`.
- Migrations: none beyond M1 if columns exist. Store raw payload in `files` or a text column with source URL.
- Risk: terms of use and robots. Ship an allowlist of source kinds. No authenticated scrape.
- Dependencies: M1. Counsel note from section 16 before production enablement.
- Acceptance: a target company can have a source, a successful sync timestamp, a health error, deduplicated jobs, a new description version on change, and closed status when the source drops the job. Re-running sync does not duplicate candidates or jobs.
- Tests: fixture feed, duplicate external key, hash change, robots refusal, health row.

### M5 — Matching

- Objective: Both directions persist `candidate_job_matches` with bands and inferred-vs-explicit lines. Military matching loads job skills.
- Code: `lib/recruiting/matching.ts`, `lib/skillbridge/matching.ts`, `lib/repositories/recruiting.ts`.
- Migrations: optional columns for band and structured explanation. Scores already exist.
- Risk: a band treated as a rejection. Bands are labels. Submission still needs a human.
- Dependencies: M1 jobs. M3 skills make military score meaningful. M5 can ship against current skills before M3 if labeled as skill-and-title only.
- Acceptance: candidate page lists matched jobs; job page lists matched candidates; explanation shows aligned items, gaps, and inferred flags; unapproved mappings do not count as explicit skills.
- Tests: component scores, empty skills no longer forced on the military path, unique match row, human review required to submit.

### M6 — Routing and outreach

- Objective: One board from match to placement using pipeline status, engagements, and alert rules.
- Code: military opportunities UI, alert rule codes, engagement response values, brief draft.
- Migrations: pipeline values `future_fit` and `referred` if the current enum cannot express them. Generalize alert codes for no strong match, outreach age, separation window, and job close date.
- Risk: dual writes to `skillbridge_opportunities` and matches. Read old rows; write new pathway work to the match once the screen is switched.
- Dependencies: M5.
- Acceptance: a recruiter can move a match through review, approved outreach, sent, response, interview, and placement without a client ATS. External send still requires confirmation. Manager brief uses approved translation only.
- Tests: status transitions, alert thresholds, send gate, do-not-contact.

### M7 — Workforce pipeline integration

- Objective: Military supply counts come from reviewed profiles and match bands for the role's skills and geography.
- Code: `lib/workforce/overlays.ts`, military supply page, supply entries.
- Migrations: none if counts are computed. Persist a supply entry only when a human saves an assessment.
- Risk: showing unreviewed mappings or PII inside a client-ready assessment. Counts and occupation codes only, until the deliverable is approved.
- Dependencies: M3 and M5.
- Acceptance: an assessment role shows military supply beside other source types, the gap, and a link to the people only for users with `candidates.read`.
- Tests: overlay ignores unapproved mappings; count matches fixture profiles; workforce approve permission unchanged.

### M8 — Scout and Command Center

- Objective: The example questions that have data answer through existing command families. Navigation collapses to the section 13 groups.
- Code: `lib/scout/parse-intent.ts`, `lib/scout/search.ts`, `lib/scout/prompts.ts`, `components/navigation/nav-config.ts`, military and workforce subnavs. Redirect old routes.
- Migrations: none.
- Risk: recruiters lose a screen they still need, or gain `opportunities.read`. Redirects and permission tests prevent both.
- Dependencies: M5 for match questions. M4 for "posted this week." M6 for unanswered outreach. Navigation can ship after M1 if the founder wants the smaller IA before discovery.
- Acceptance: listed Scout prompts return stored rows or an honest empty state. No new command family. No SQL. PII stripped. Sidebar matches section 13 for a military talent user and still shows pursuits only with `opportunities.read`.
- Tests: existing `tests/phase9-scout.test.ts`, `tests/nav.test.ts`, plus cases for the new filters.

### M9 — Analytics and outcome learning

- Objective: Reports on occupation to job family, employer interest, interview, placement, repeated gaps, and companies that hire a profile. Human-read reports only.
- Code: report queries over matches, engagements, placements, mappings.
- Migrations: none required if the facts are already on those rows. Add a reporting view, not a model-training table.
- Risk: automated suppression of candidates. Do not feed scores back into eligibility.
- Dependencies: M6 producing consistent outcomes.
- Acceptance: each report cites stored rows, shows counts, and does not call an embedding model. `AI_MODEL_EMBEDDING` stays unset. `semantic_documents` stay hash vectors.
- Tests: report authorization, fixture counts, embedding config unchanged.

### M10 — Brand migration

- Objective: Pier 24 Partners across product, public site, email, OAuth, HMAC, and docs in one controlled release.
- Code: inventory in section 15.
- Migrations: public-source default only, if counsel and the domain cutover are ready.
- Risk: broken HMAC, Clerk hosts, and Resend DNS if renamed one file at a time.
- Dependencies: explicit brand approval. Independent of M1–M9 and should not block them. Do not start it inside a talent milestone.
- Acceptance: section 15 checklist is done in one release; old HMAC accepted for a documented window; attorney-approved templates were edited only by counsel.
- Tests: public site suite, HMAC suite, sign-in metadata.

## 18. Recommended First Implementation Milestone

Build M1 only.

M1 is the fork the rest of the product is waiting on. Today a public or exploratory employer need cannot be stored without either pretending it is a sales pursuit or attaching it to a SkillBridge profile that requires a person. Matching, discovery, routing, and Scout all inherit that fork. Expanding `jobs`, adding an empty `career_sources` registry, and keeping the transition profile as the existing one-to-one candidate overlay removes the fork without a new person, without a new opportunity object, and without a crawler.

Do not start with discovery, brand, or a navigation rewrite. Discovery without the demand record will invent a fourth opportunity. A navigation rewrite before the record exists will relabel the same confusion. Brand is a separate release.

After M1 is accepted and in production, the next build is M2 (the profile operators actually fill) and then M3 (capability translation). M4 waits on counsel for public-source retention. M5 can follow M2 if the founder wants matching improved before new sources exist, using jobs staff enter by hand.

Founder decisions, accepted 2026-10-21 (`DEC-PROD-001`):

1. `jobs` is the employer-demand record, including public and exploratory demand. CRM `opportunities` stay sales pursuits.
2. `skillbridge_profiles` is the Transition Talent Profile. SkillBridge fields stay a pathway. The physical table is not renamed in M1.
3. `follow-on/parked-working-tree` at `1a356d3` stays unmerged.
4. The PierOne to Pier 24 Partners rename waits for M10.

M1 is the only milestone authorized by that acceptance.
