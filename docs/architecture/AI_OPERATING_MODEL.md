# WorkforceOS AI Operating Model

- Status: **accepted**
- Approval: Managing Partner and Strategy & Technology Administrator signed off 2026-09-09 (DEC-AI-012)
- Date: 2026-09-09
- Owner: Product Build
- Scope: Accepted operating model for Stage 1 Review Queue access / domain decide and Stage 2 Gemini availability fallback. Stage 3 (embeddings/RAG scrape) is not started.
- Related accepted decisions: DEC-AI-001 through DEC-AI-012, DEC-SEM-001, DEC-AUTH-001, DEC-AUTH-002, DEC-RBAC-001, DEC-MIL-005, WFOS-AI-001 through WFOS-AI-006

This document evolves Phase B capability-class routing. It does not replace the provider abstraction, heuristic honesty, Review Queue, Scout closed-command registry, or Phase C access bundles.

Locked operating principle: **humans own process; AI makes operations faster.** AI drafts and recommends. PostgreSQL remains the system of record.

**Launch (2026-09-10):** OpenAI is the production AI provider for launch. Gemini availability fallback remains supported by the architecture but is deferred until post-launch validation. Do not reopen Anthropic.

---

## Current-state findings (audit)

These findings are from the live tree on 2026-09-09. They are the baseline the proposed design must evolve, not throw away.

1. **Architecture is already an operating engine, not a chatbot.** `lib/ai/runner.ts` loads PostgreSQL context, approved workflow, approved knowledge, and the intersection of agent + caller permissions. Outputs land in `agent_outputs` + `approvals`. Agents cannot self-approve (`lib/ai/review.ts`).
2. **Providers today are only `internal_heuristic` and `openai_compatible`.** `lib/ai/provider.ts` calls OpenAI-compatible `/chat/completions`. There is no Gemini SDK, no Anthropic SDK, and no second live provider. Fallback is the same base URL + `AI_FALLBACK_MODEL`, then honest heuristic.
3. **Phase B capability classes already exist and are accepted (DEC-AI-011).** Features select FAST / STANDARD / REASONING / EMBEDDING via `lib/ai/capabilities.ts`. Env names `AI_MODEL_*` already exist, with `OPENAI_*` / `AI_MODEL` aliases. Do not introduce scattered `gpt-*` strings in application code.
4. **Scout does not currently call a model.** `lib/scout/parse-intent.ts` is a deterministic closed-registry parser (SQL rejected). `lib/scout` has no `completePrompt` import. FAST class includes `scout_search` / `scout_summarize`, but those task keys are only used if something goes through the agent runner.
5. **Embeddings are still DEC-SEM-001 development-hash `vector(1536)`.** `AI_MODEL_EMBEDDING` is not treated as live retrieval. `lib/ai/knowledge.ts` keyword-ranks approved `knowledge_records`; the embedding path hashes text. Changing dimension requires a model choice and a rebuild.
6. **Usage and cost already exist.** `ai_usage_events` records provider, model, taskType, tokens, estimated cost, `modelTier` (capability class), latency, fallback. Agent-level daily/monthly caps live on `agents`. Cost admin is `agents.manage`. Estimate in `provider.ts` is a single $3 / $15 per 1M tokens — not per-model or per-provider.
7. **System Health already distinguishes LIVE vs HEURISTIC** (`lib/health/status.ts` via `describeAiRuntime()`). Missing key or `AI_PROVIDER=internal_heuristic` is labeled heuristic, not silent live fallback.
8. **Review Queue is the material-output surface (DEC-AI-008)** at `/app/ai-operations/review`, gated by `agents.read`. Cost/prompts/runs/failures are `agents.manage`. Product copy says recruiters use the Review Queue; **Recruiter / Talent Partner / Military Talent Partner / Workforce Consultant do not have `agents.read`.** That is a real access gap, not a reason to invent `scout.recruiting`.
9. **Phase C bundles already cover Scout work.** Existing slugs: `scout.use`, `scout.search`, `scout.draft`, `scout.internal_actions`, `scout.external_actions`. Domain permissions (`candidates.read`, `jobs.read`, `military.read`, `opportunities.read`, …) already scope what Scout can see. **Do not add `scout.recruiting` / `scout.military` / `scout.finance`.**
10. **Academy is not RAG.** Academy is a code catalog (`lib/academy/catalog.ts`). Scout returns keyword article cards. Phase 7 seeds playbooks into `knowledge_records`. Operating manual / playbooks are not automatically embedded.
11. **PII stripping exists but is key-name based.** `lib/scout/pii.ts` and `lib/ai/context.ts` strip email/phone/compensation/resume-like keys when the caller lacks `candidate_pii.read`. Restricted knowledge is blocked from retrieval. Knowledge records cannot store Restricted PII.
12. **Production live-key honesty is still IN REVIEW** (MASTER_COMPLETION_LEDGER Phase B). Encrypted `AI_API_KEY` / `AI_PROVIDER` may exist on Vercel while decrypt-to-runtime remains unverified. Health labeling is the correct guard until that is proven.
13. **`materialReview()` defaults `humanReviewRequired: true` even when `reviewCategory` is null.** Safe, but noisy. Several FAST internal summaries still enqueue review.
14. **Review decisions are gated by `agents.read`, not domain approve permissions.** Anyone who can open the queue can decide items. Domain approvals (`military.review`, `submissions.approve`, `proposals.approve`, `pricing.approve`) are not required on that path.
15. **Scout send is no longer a hard product deny in code.** `isScoutExternalSendEnabled()` follows transactional email configuration. Runtime still requires `scout.external_actions` + confirmation token + Resend. Recruiters still lack `scout.external_actions`.

---

## 1. Current AI architecture

WorkforceOS AI is an **internal operating engine** (DEC-AI-001, DEC-AI-002). It is not a client-facing product claim and not a second database.

```
Caller (human / automation / Scout / handoff)
        │
        ▼
Authorization (PostgreSQL RBAC; intersection of agent + caller)
        │
        ▼
Cost limits + circuit breaker
        │
        ▼
Context builder  →  PostgreSQL record
                 →  approved service_workflows (never invented rules)
                 →  approved knowledge_records (ACL-filtered)
                 →  Restricted PII stripped unless candidate_pii.read
        │
        ▼
Approved prompt_versions (immutable; DEC-AI-004)
        │
        ▼
Capability class (FAST / STANDARD / REASONING / EMBEDDING)
        │
        ▼
Provider abstraction
   ├─ openai_compatible  (AI_API_KEY + AI_BASE_URL)
   ├─ same-endpoint model fallback (AI_FALLBACK_MODEL)
   └─ internal_heuristic (no key, forced provider, or both live attempts fail)
        │
        ▼
agent_runs + agent_outputs + ai_usage_events
        │
        ▼
Review Queue (approvals) for material output
        │
        ▼
Optional draft writes (autonomy ≥ 2) or named internal workflow actions (autonomy ≥ 3)
```

**Named agents** (`lib/ai/registry.ts`): Opportunity Scout, Account Intelligence, Sales, Recruiting, Military Talent, Workforce Analyst, Workforce Architect, Proposal, Project, Knowledge, optional Finance / Compliance / Candidate Engagement, and Scout.

**Autonomy 0–4** (DEC-AI-003): 0 read-only; 1 recommend/draft; 2 write internal drafts; 3 execute approved internal workflow actions; 4 queue external actions that still need a human. No agent may mark won, submit candidates, issue offers, approve proposals, execute contracts, or close projects.

**Automation** is a closed named-rule set (DEC-AI-007), not a no-code builder.

**Scout** is a separate UX path: prompt → closed command registry → Zod DTO → existing services → cards. Chat (`scout_sessions` / `scout_messages`) is usability memory, not the system of record (DEC-AI-009, DEC-AI-010).

---

## 2. Current providers

| Provider id | How it is selected | What it does |
|---|---|---|
| `internal_heuristic` | No `AI_API_KEY` / `OPENAI_API_KEY`, or `AI_PROVIDER=internal_heuristic`, or live call + fallback both fail | Deterministic JSON draft from supplied PostgreSQL context. Cost $0. Labeled heuristic. |
| `openai_compatible` | Key present and provider is not heuristic | `POST {AI_BASE_URL}/chat/completions`. Default base `https://api.openai.com/v1`. Neon AI Gateway is allowed only if already pointed at via `AI_BASE_URL`. |

Not present: Gemini, Anthropic, vendor SDKs, per-provider keys beyond the OpenAI-compatible alias.

Fallback today is **same provider, different model name**, then heuristic. It is not a multi-cloud router.

---

## 3. Current model usage

Features do not hard-code model brands. They pick a capability class (`capabilityClassForTask`).

| Class | Task examples (current) | Env resolution (already shipped) |
|---|---|---|
| FAST | `scout_search`, `scout_summarize`, `candidate_summary`, `status_summary`, `invoice_commentary`, `ar_summary`, `stalled_alert`, `overdue_tasks`, `compliance_check` | `AI_MODEL_FAST` → `OPENAI_MODEL_FAST` → `AI_MODEL` → `heuristic-v1` |
| STANDARD | everything else (match scoring, outreach drafts, account briefs, …) | `AI_MODEL_STANDARD` → `OPENAI_MODEL_BALANCED` → `AI_MODEL` → `heuristic-v1` |
| REASONING | `mapping_draft`, `gap_interpretation`, `scenario_analysis`, `workforce_roadmap`, `skills_architecture`, `draft_proposal`, `executive_summary`, `recommend_research`, `solution_recommendation` | `AI_MODEL_REASONING` → `OPENAI_MODEL_PRIMARY` → `AI_MODEL_STANDARD` → `AI_MODEL` → `heuristic-v1` |
| EMBEDDING | `retrieve_knowledge`, `index_lessons` | `AI_MODEL_EMBEDDING` → `OPENAI_EMBEDDING_MODEL` → `development-hash` |

`ai_model_configs` can override provider/model/temperature/timeout/fallback per `taskType` (org-unique). Seed default is `internal_heuristic` / `heuristic-v1`.

Scout itself currently uses **no live model**. Agent runner is the live-completion path.

---

## 4. Proposed provider architecture

**PRIMARY: OpenAI (OpenAI-compatible).**  
**FALLBACK: Gemini (availability only).**  
**NOT NOW: Anthropic.**

Evolve DEC-AI-005; do not replace it.

```
completePrompt(task, capabilityClass)
  1. If no primary key or AI_PROVIDER=internal_heuristic → heuristic (not a failure)
  2. Call PRIMARY (OpenAI-compatible: AI_API_KEY + AI_BASE_URL + AI_MODEL_{class})
  3. On availability failure only → same-class PRIMARY fallback model (AI_FALLBACK_MODEL) if set and different
  4. On availability failure only → FALLBACK provider Gemini (AI_FALLBACK_PROVIDER=gemini + GEMINI_API_KEY + Gemini OpenAI-compatible base URL + per-class Gemini model env)
  5. If Gemini also fails → internal_heuristic, usedFallback=true, health/usage labeled heuristic
```

**Availability failure** means timeout, HTTP 408/429/500–504, network abort, or empty completion.  
**Not an availability failure:** disliked tone, shorter answer, different structure, “worse” mapping, or human style preference. **Do not fail over on style.**

Implementation constraint when this design is later accepted:

- Keep the existing `openai_compatible` HTTP client.
- Prefer Gemini’s OpenAI-compatible endpoint so **no Gemini SDK is added**.
- Do not add Anthropic packages or env.
- Never present heuristic output as a live model.
- Record `provider`, `model`, `usedFallback`, and capability class on every run.

`AI_PROVIDER` remains the **primary** name (`openai_compatible` | `internal_heuristic`). A new optional `AI_FALLBACK_PROVIDER=gemini` is additive.

---

## 5. Proposed model-role architecture

Keep Phase B class names in code. Intended OpenAI GPT-5.6 family names (Luna / Terra / Sol) are **env values and documentation**, not application string literals (DEC-AI-011). Do not assume those product names are the API model ids until ops sets them.

| Role | Code class | Intended primary (env value) | Intended Gemini fallback (env value) | When used |
|---|---|---|---|---|
| Fast / cheap / short | `FAST` | `AI_MODEL_FAST` — intended OpenAI GPT-5.6 Luna (or the official fast-class id ops confirms) | `AI_MODEL_FAST_FALLBACK` | Scout assist, summaries, alerts, compliance reminders |
| Balanced default | `STANDARD` | `AI_MODEL_STANDARD` — intended OpenAI GPT-5.6 Terra | `AI_MODEL_STANDARD_FALLBACK` | Match commentary, outreach drafts, account briefs, most agent tasks |
| Deep reasoning | `REASONING` | `AI_MODEL_REASONING` — intended OpenAI GPT-5.6 Sol | `AI_MODEL_REASONING_FALLBACK` | Military mapping, workforce gap/roadmap, proposals, solution recommendation |
| Embeddings | `EMBEDDING` | `AI_MODEL_EMBEDDING` — **unset until DEC-SEM-001 is reconsidered** | none in Stage 1–2 | Knowledge index/retrieve only after model + dimension chosen together |

Existing aliases stay: `OPENAI_MODEL_FAST`, `OPENAI_MODEL_BALANCED` / `AI_MODEL`, `OPENAI_MODEL_PRIMARY`, `OPENAI_EMBEDDING_MODEL`, `AI_FALLBACK_MODEL` (primary-provider same-class spare).

If a class env is unset while a live key exists, runtime must not invent a brand. Prefer the next documented alias, then heuristic, and keep System Health honest.

---

## 6. Workload routing table

| Workload | Class | Primary | Fallback | Human review | Notes |
|---|---|---|---|---|---|
| Scout SEARCH / SUMMARIZE / SHOW_* / FIND_MATCHES | FAST (optional assist only) | OpenAI FAST | Gemini FAST, then deterministic parser | No (read) | Closed registry remains source of commands. Model may only emit a Zod DTO. Never SQL. |
| Scout DRAFT | STANDARD | OpenAI STANDARD | Gemini STANDARD | Draft → human before send | `scout.draft`. Domain RBAC still applies. |
| Scout CREATE/UPDATE/ASSIGN/pool/job/task | STANDARD if any model assist; else none | — | — | Confirm required | Prefer no model. Execute existing services only. |
| Candidate / job / status / AR / invoice commentary | FAST | OpenAI FAST | Gemini FAST | Yes if client-facing or amount-affecting | Finance assistant cannot invent fees. |
| Internal talent search, match scoring, rediscovery | STANDARD | OpenAI STANDARD | Gemini STANDARD | Scores are job-specific; no auto-reject | Internal Talent Network before external (workflow rule). |
| Outreach / nurture / follow-up drafts | STANDARD | OpenAI STANDARD | Gemini STANDARD | Never auto-send | |
| Military mapping, skills translation, HM brief | REASONING | OpenAI REASONING | Gemini REASONING **labeled** | Always | Intermediary model (DEC-MIL-005). Originating agent cannot approve. |
| Workforce gap, scenario, roadmap, skills architecture | REASONING | OpenAI REASONING | Gemini REASONING | Always | Must not invent labor-market numbers. |
| Solution recommendation, proposal, exec summary | REASONING | OpenAI REASONING | Gemini REASONING | Always | Five services only. |
| Knowledge retrieve / index | EMBEDDING | unset (hash) until Stage 3 | none | Knowledge approve is human | ACL before return. |
| Meeting extraction → tasks | STANDARD | OpenAI STANDARD | Gemini STANDARD | Always (`client_deliverable`) | |
| Named automations | per task class | same table | same table | Per output category | Closed rule list only. |

Escalation from FAST → STANDARD → REASONING is **task-defined**, not model-decided (see §7).

---

## 7. Escalation logic

Escalation is a **deterministic task-class map**, not a model choosing a smarter model.

1. Start at `capabilityClassForTask(taskKey)` (existing function; extend the sets, do not scatter brands).
2. A human with `agents.manage` may pin a task in `ai_model_configs` to a class or explicit model **without** putting brands in feature code.
3. Escalate FAST → STANDARD only when the task is reclassified (new task key or accepted config), or a documented retry after a **parse/schema failure** of a FAST Scout-assist DTO — one retry at STANDARD, then reject as `unknown_command`.
4. Escalate STANDARD → REASONING only for the existing reasoning task set (mapping, workforce interpretation, proposal/solution). Do not escalate a stalled-job alert to Sol because the draft “feels thin.”
5. Models must not request a different model. No tool that says “use reasoning.”
6. After any escalation, usage records the class actually used.
7. Cost-limit or open circuit breaker **stops the run**. It does not escalate to a cheaper/smarter model to sneak work through.

---

## 8. Gemini fallback logic

Gemini is **availability backup**, not a style tuner.

**May call Gemini when:**

- Primary OpenAI-compatible call failed for availability (timeout, 429, 5xx, abort, empty body), and
- Same-provider `AI_FALLBACK_MODEL` either is unset, matches the failed model, or also failed for availability, and
- `AI_FALLBACK_PROVIDER=gemini`, `GEMINI_API_KEY`, and `AI_FALLBACK_ENABLED=true` are set, and
- The task is not in a “primary-only” deny list (initial deny list: none, but military mapping / legal / pricing outputs must show `usedFallback` + provider on the Review Queue card).

**Must not call Gemini when:**

- A human rejected the OpenAI draft for tone or content,
- The operator wants “more creative” or “more concise,”
- The heuristic path is the configured runtime,
- The circuit breaker is open,
- Cost limits are exhausted,
- Embedding retrieval (Stage 1–2).

**After Gemini:** if it also fails, return `internal_heuristic` and label it. Operators must see HEURISTIC vs LIVE and fallback flags. Reviewers must see which provider wrote a material draft.

Prefer Gemini OpenAI-compatible HTTP so the existing client stays. **Do not add a Gemini SDK in this program of work.**

**Launch deferral:** Gemini hop is off unless `AI_FALLBACK_ENABLED=true`. Leftover Gemini keys do not make fallback a launch dependency or a System Status failure. System Status shows Fallback **DEFERRED**.

---

## 9. Human-review matrix

Never unsupervised: reject, hire, submit, price, send, contract, legal language, adverse action, invoice/amount change, or external send.

| Output | Review category (existing enum) | Required human | Agent cannot |
|---|---|---|---|
| Client submission of a candidate | `candidate_submission` | Talent Partner / recruiter with `submissions.approve` (domain) | Submit |
| AI rejection recommendation | `ai_candidate_rejection` | Human with applications/pipeline reject permission | Permanently reject |
| Military-civilian mapping / HM brief | `military_mapping` | `military.review` | Approve mapping |
| Workforce recommendation / roadmap | `workforce_recommendation` | `workforce.approve` | Approve recommendation |
| Solution plan / service recommendation | `solution_plan` | `solutions.approve` | Approve plan |
| Proposal / exec summary | `proposal` | `proposals.approve` | Approve or send proposal |
| Pricing outside configured range | `pricing` | `pricing.approve` | Set commercial terms |
| Contract / legal language | `contract_legal_language` | `legal.write` / `contracts.approve` | Execute contract |
| Client deliverable / client update / meeting extraction | `client_deliverable` | `deliverables.approve` or project owner | Mark client-approved |
| Invoice / AR commentary that adjusts amounts | `invoice_adjustment` | `finance.approve` | Post to QuickBooks or invent fee |
| Scout external send | (send confirmation, not review enum) | `scout.external_actions` + `transactional_email.send` + token | Auto-send |
| Scout internal write | confirmation dialog | `scout.internal_actions` + domain write | Silent write |
| Knowledge publish | knowledge approval | `knowledge.approve` | Approve knowledge |
| Agent handoff | approval on `agent_handoff` | Human accept | Self-accept |

**Closed in Stage 1:** Review Queue decide requires the domain approve permission for that category in addition to `agents.read`. `agents.read` sees the queue; domain permission decides.

**FAST internal-only summaries** (status, overdue tasks) may stay `humanReviewRequired: false` only if they write nothing and are not client-facing. Default remains review-on for anything that writes a draft record.

Originating agent never approves its own output (DEC-AI-008, WFOS-AI-002).

---

## 10. Permission matrix (map onto Phase C — do not add Scout domain slugs)

Do **not** add `scout.recruiting`, `scout.military`, `scout.finance`, or similar. Phase C already separates **assistant verbs** from **domain nouns**.

### Assistant verbs (keep)

| Permission | Meaning | Typical commands |
|---|---|---|
| `scout.use` | Open Scout; summarize; show record/dashboard | SUMMARIZE, SHOW_RECORD, SHOW_DASHBOARD |
| `scout.search` | Search / find matches | SEARCH, FIND_MATCHES |
| `scout.draft` | Create a draft artifact | DRAFT |
| `scout.internal_actions` | Confirmed internal writes | CREATE, UPDATE, ASSIGN, ADD_TO_POOL, ADD_TO_JOB, CREATE_TASK, CREATE_FOLLOW_UP |
| `scout.external_actions` | Confirmed external send | Send path only |
| `agents.read` | See Review Queue / agent outputs | Not a Scout verb |
| `agents.manage` | Costs, prompts, runs, provider, breakers | Never on Recruiter |

Domain permissions already bound the noun: `candidates.read`, `candidate_pii.read`, `jobs.read`, `military.read`, `skillbridge.read`, `opportunities.read`, `finance.read`, `knowledge.read`, etc. Scout search already returns empty when the caller lacks the domain permission (and Recruiter still cannot see commercial opportunities — DEC-RBAC-001).

### Phase C bundle mapping (current + proposed delta)

| Bundle | scout.use | scout.search | scout.draft | scout.internal_actions | scout.external_actions | agents.read (today) | agents.manage | Proposed delta |
|---|---|---|---|---|---|---|---|---|
| Managing Partner | all | all | all | all | all | yes | yes | none |
| Strategy & Technology Administrator | yes | yes | no | no | yes | yes | yes | Keep cost admin here. Optional later: `scout.draft` if they need prompt trials — not required. |
| Operations Administrator | yes | yes | no | no | yes | yes | **no** | Keep. Ops can send and review; not cost admin. |
| Talent Partner (Senior) | yes | yes | yes | yes | no | **no** | no | **Grant `agents.read` only** so they can work the Review Queue. Do not grant `agents.manage`. |
| Recruiter Standard | yes | yes | yes | yes | no | **no** | no | **Grant `agents.read` only.** Still no `opportunities.read`, no cost admin, no external send. |
| Military Talent Partner | yes | yes | yes | yes | no | **no** | no | **Grant `agents.read` only** for mapping / brief review. |
| Workforce Consultant | yes | yes | no | no | no | **no** | no | **Grant `agents.read` + `scout.draft`** so they can draft workforce recs and review them. Still no commercial send. |
| Read-only | yes | yes | no | no | no | no | no | none |

Academy training already matches this split: Scout modules require `scout.use`; review/draft training uses `scout.draft` / `agents.read`; cost admin training requires `agents.manage` and completion does not grant it.

---

## 11. Cost-control design

Keep current agent-level caps (`agents.daily_cost_limit_usd` / `monthly_cost_limit_usd`) and `assertCostLimits` before run.

Add (when implementing, not now):

| Control | Owner | Behavior |
|---|---|---|
| Org daily / monthly cap | `agents.manage` | Soft alert at 80%; hard stop at 100% (new `system_settings` or org AI settings row). |
| Per-class cap (optional) | `agents.manage` | REASONING can have a tighter monthly cap than FAST. |
| Per-provider cap | `agents.manage` | Gemini spend cannot silently exceed a small backup budget. |
| Circuit breaker | existing | 5 consecutive failures → 15 minutes open. Do not use fallback to bypass an open breaker. |
| Rate limits | DEC-SEC-003 | Keep modest per-principal limits on AI runs. |
| Honest heuristic | existing | $0; does not consume live budget. |
| Review-queue visibility | `agents.manage` for $; `agents.read` for volume | Recruiters never see provider invoices or keys. |

Replace the single $3/$15 estimator with a **small server-side rate table keyed by provider + model id** (config, not UI brands). Until a row exists, estimate $0 and flag `cost_unknown` rather than pretending OpenAI list prices.

---

## 12. Usage-logging design

Keep `ai_usage_events` as the ledger. Every `completePrompt` (including Scout-assist and heuristic) should record:

- organization, agent, run, invoked user
- provider, model, capability class (`modelTier`)
- taskType
- input/output tokens
- estimated cost + `cost_unknown` if unrated
- latency
- `usedFallback`
- trigger (`manual` / `automation` / `handoff` / `retry` / `scout`) — add column only if needed; until then `agent_runs.triggeredBy` is enough
- no prompt body, no candidate email/phone/resume, no API keys (DEC-OBS-001)

Health already shows last successful **non-heuristic** completion timestamp. Costs page (`/app/ai-operations/costs`) stays `agents.manage`.

Do not log Scout chat verbatim into usage events. Sessions remain usability memory.

---

## 13. RAG / knowledge design

Three knowledge planes exist. Do not merge them into an unconstrained corpus.

| Plane | Today | Proposed |
|---|---|---|
| Approved `knowledge_records` | Phase 7 seed playbooks; ACL; keyword retrieve; hash embed | Remains the **only** model-retrievable institutional store (DEC-AI-006). |
| In-app Academy | Code catalog; Scout keyword cards; training by effective permissions | Stay code-authored. Optional Stage 3: publish **approved excerpts** into `knowledge_records` with `source` = Academy slug. Completing a module still does not grant permissions. |
| Canonical markdown (operating manual, playbooks, workflows) | Human SoT | Humans (or a managed import) create versioned `knowledge_records` citing the markdown path. Agents must not scrape `docs/` at runtime. |

Rules that stay locked:

- Retrieve only `status=approved`.
- Filter by org, privacy class, `requiredPermission`.
- Restricted candidate PII is never stored and never retrieved (`canAccessKnowledge` already returns false for `restricted_pii`).
- Every knowledge-backed output keeps citations (`lib/ai/citations.ts`).
- Live embeddings wait for DEC-SEM-001: choose `AI_MODEL_EMBEDDING` **and** dimension together; rebuild `semantic_documents`; until then hash/`vector(1536)` is honest.
- Material process rules still come from approved `service_workflows`, not from RAG (workflow.mdc).

---

## 14. Scout operating model

Scout remains the official persistent assistant (tooltip: **Open Scout**). Not Copilot, Navigator, or a generic Assistant.

**Keep:**

- Closed command registry (DEC-AI-009). Unknown → reject.
- Never generate SQL. Existing SQL/unsafe prompt rejection stays.
- Page context from the route, not chat history (DEC-AI-010).
- RBAC + PII strip **before** any model context.
- Read now; material writes confirm; external send = permission + token + provider.
- Draft → Human Review → Send/Copy. Never auto-send.
- Chat is not the system of record.
- Recruiter Scout cannot surface commercial opportunities (`opportunities.read` absent).
- Military copy stays intermediary (DEC-MIL-005). SkillBridge people are existing candidates.

**Evolve (later stages):**

- Optional FAST (or STANDARD for DRAFT) **assist**: model receives stripped page context + user text and may return **only** a closed-family Zod DTO. If parse fails, fall back to the current deterministic parser. Two failures → `unknown_command`.
- Do not let the model invent a 14th command family without a new accepted decision.
- Academy answers: prefer linking `/app/academy/[slug]` and approved knowledge citations over free-form policy.

---

## 15. Business-workflow AI opportunities

Only inside the **five launch services** and existing spines. AI accelerates drafts; humans own the step.

**Client / commercial spine** (not Recruiter-owned): inquiry qualification notes, account briefs, discovery prep, meeting extraction, solution-plan draft, proposal draft, client-update draft. Always review before client-facing use. Website inquiries stay intake — not auto-opportunities.

**Recruiting / search execution:** internal Talent Network search commentary, job-specific match notes, outreach drafts, stalled-search alerts, candidate summaries (PII-stripped unless permitted), interview-feedback reminders. No auto-reject, no auto-submit, no offer issue.

**Military Talent (intermediary):** mapping drafts, skills translation, employer-opportunity match notes, hiring-manager briefs, SkillBridge-window follow-up drafts. Humans connect, submit, and approve mappings. Do not present PierOne as the SkillBridge host.

**Workforce / Fractional / TA Performance / Pipeline Assessment:** gap interpretation and roadmap drafts from **stored** assessment data only. No invented BLS/Census/O\*NET statistics.

**Finance (optional assistant):** commentary on stored invoices/AR. No posting, no invented amounts.

---

## 16. Areas where AI should NOT be added

- Temp staffing, payroll, GL, tax, AP, benefits, cap-table / ownership (forbidden product)
- Public job marketplace or unsupervised public candidate chat
- SQL, schema migration, or “ask the database”
- Unsupervised reject / hire / submit / price / send / contract / legal / adverse action / invoice
- Auto-won opportunities, auto-executed contracts, auto-closed projects
- Fabricated labor-market or commercial terms
- A sixth launch service or SkillBridge-as-PierOne-program
- Recruiter access to the commercial GTM pipeline via Scout
- Background-check or drug-screen auto-adjudication
- Privacy deletion or PII export by an agent
- Client-facing marketing copy that claims AI as the product
- Arbitrary no-code automation
- Anthropic (this program)
- Runtime scraping of private `docs/` or candidate resumes into prompts
- Letting Academy completion grant `agents.manage` or any permission

---

## 17. Stage 1

**Goal:** Production AI is intentional OpenAI-primary, capability-class routed, honestly labeled.

- Confirm decryptable `AI_API_KEY` (or `OPENAI_API_KEY`) on production; System Health shows LIVE.
- Set `AI_MODEL_FAST` / `STANDARD` / `REASONING` to the ops-confirmed OpenAI ids (intended Luna / Terra / Sol). Leave `AI_MODEL_EMBEDDING` unset.
- Keep heuristic path for preview/dev without keys.
- Keep Review Queue, cost page, usage events, circuit breaker.
- Documentation + tests only for class mapping; no Gemini.
- Optionally grant `agents.read` to Talent Partner, Recruiter, Military Talent Partner, Workforce Consultant (permission delta in §10) so the Review Queue matches the operating model.
- Tighten decide-review to domain approve permissions if a small RBAC change is accepted with Stage 1.

**Out of Stage 1:** Gemini, live embeddings, Scout-as-LLM, Anthropic, new Scout permission slugs.

---

## 18. Stage 2

**Goal:** Availability fallback + tighter cost honesty.

- Add `AI_FALLBACK_PROVIDER`, `GEMINI_API_KEY`, `AI_FALLBACK_BASE_URL`, per-class `AI_MODEL_*_FALLBACK`.
- Gemini via OpenAI-compatible HTTP only. No Gemini SDK.
- Fail over on availability only; record `usedFallback`.
- Per-provider rate table + org/Gemini backup cap.
- Optional Scout FAST assist that can only emit closed-registry DTOs; deterministic parser remains fallback.
- Health: show primary LIVE, fallback configured/not, last fallback timestamp — no secrets.

**Out of Stage 2:** dimension migration, Anthropic, style-based routing.

---

## 19. Stage 3

**Goal:** Real retrieval, still human-owned.

- Reconsider DEC-SEM-001: choose embedding model + dimension; migrate/rebuild `semantic_documents`.
- Publish approved Academy / playbook / operating-manual excerpts into `knowledge_records` with citations.
- Optional REASONING-class evaluation only for already-material tasks (mapping, proposal, workforce) — not a general “think harder” button.
- Reassess Anthropic only if OpenAI+Gemini availability is insufficient; requires a new DEC-AI.
- Still no unsupervised commitments, no SQL, no sixth service.

---

## 20. Risks

| Risk | Decision / control |
|---|---|
| Restricted PII in model context | Strip before prompt (`context.ts`, `pii.ts`). No resume/email/phone/compensation without `candidate_pii.read`. Knowledge cannot store Restricted PII. Logs omit those fields (DEC-OBS-001). |
| Unsupervised commitments | DEC-AI-003 autonomy + Review Queue + forbidden task list. Never unsupervised reject/hire/submit/price/send/contract/legal/adverse-action/invoice. |
| Embedding dimension drift | DEC-SEM-001: do not set live `AI_MODEL_EMBEDDING` or change 1536 until model and dimension are chosen together. |
| Style failover | Gemini is availability-only. A “worse” mapping is a human review problem, not a provider hop. |
| Silent heuristic in production | LIVE vs HEURISTIC health; usage `provider=internal_heuristic`. Ledger B1 decrypt gap must be closed in Stage 1. |
| Recruiter cost / commercial leak | Never grant `agents.manage` or `opportunities.read` to Recruiter. Scout respects domain RBAC. |
| Review Queue vs domain approve | Today `agents.read` can decide. Tighten to domain permissions to avoid ops approving mappings they should not. |
| Scout LLM jailbreak | Assist may only return closed Zod families; SQL patterns stay rejected; two parse failures → reject. |
| Military language | DEC-MIL-005 intermediary model. Do not let prompts say PierOne hosts SkillBridge. |
| Five-service drift | Workflows from approved DB records; RAG cannot invent a sixth offer. |
| Cost estimate fiction | Current $3/$15 is misleading. Prefer `cost_unknown` until a rate table exists. |
| Provider key in client | Server-only `lib/env.ts`. No `NEXT_PUBLIC_` AI keys. |

---

## 21. Required environment variables

**Already exist (keep):**

| Variable | Role |
|---|---|
| `AI_PROVIDER` | `openai_compatible` or `internal_heuristic` (primary) |
| `AI_API_KEY` | Primary live key |
| `OPENAI_API_KEY` | Alias for `AI_API_KEY` |
| `AI_BASE_URL` | Default `https://api.openai.com/v1` |
| `AI_MODEL` | Legacy single-model alias |
| `AI_MODEL_FAST` / `STANDARD` / `REASONING` / `EMBEDDING` | Capability-class ids |
| `AI_FALLBACK_MODEL` | Same-provider spare model |
| `OPENAI_MODEL_FAST` / `BALANCED` / `PRIMARY` / `OPENAI_EMBEDDING_MODEL` | Aliases |

**Proposed additive (Stage 2 — do not add to `lib/env.ts` until this design is accepted):**

| Variable | Role |
|---|---|
| `AI_FALLBACK_PROVIDER` | `gemini` or unset |
| `GEMINI_API_KEY` | Fallback key (server-only) |
| `AI_FALLBACK_BASE_URL` | Gemini OpenAI-compatible base |
| `AI_MODEL_FAST_FALLBACK` | Gemini FAST id |
| `AI_MODEL_STANDARD_FALLBACK` | Gemini STANDARD id |
| `AI_MODEL_REASONING_FALLBACK` | Gemini REASONING id |

**Do not add:** `ANTHROPIC_*`, `NEXT_PUBLIC_AI_*`, Gemini SDK-specific env beyond the above.

---

## 22. Required migrations / config

**Stage 1:** no schema migration required. Optional: `sync-role-permissions` after granting `agents.read` (and Workforce Consultant `scout.draft`) on Phase C bundles. No rewrite of applied Drizzle files.

**Stage 2 (if accepted):**

- Env only if Gemini uses the existing client and `ai_usage_events` already has provider/model/fallback.
- Optional columns only if product wants them: `ai_usage_events.cost_unknown`, `agent_runs.fallback_provider`. Prefer reuse first.
- `ai_model_configs.fallback_provider` already exists — seed per-task Gemini fallbacks after acceptance, do not hardcode in agents.

**Stage 3:** DEC-SEM-001 migration (new vector dimension or rebuild). Knowledge import is data + approval, not a platform rewrite.

No Anthropic tables. No second AI database.

---

## 23. Test plan

Extend existing suites; do not replace them.

| Suite | Must keep passing | Add when implementing |
|---|---|---|
| `tests/phase-b-ai.test.ts` | Class mapping, aliases, heuristic honesty, recruiter `agents.manage === false` | Gemini not called on style; fallback flag; no Anthropic |
| `tests/env.test.ts` | AI env optional; no client leak | New optional Gemini vars |
| `tests/phase9-scout.test.ts` / `phase-c-access.test.ts` | Closed commands, no SQL, PII strip, Recruiter no opportunities, send gates | Scout assist DTO-only; reject unknown families |
| `tests/phase7-ai.test.ts` | Forbidden tasks, review categories, self-approve deny | Domain permission on decide |
| `tests/phase-e-academy.test.ts` | Cost training = `agents.manage`; completion ≠ grant | Unchanged |
| Health | LIVE vs HEURISTIC copy | Fallback configured row, no secrets |

Manual: Review Queue with a mapping draft shows provider/model/fallback; recruiter cannot open Costs; heuristic environment never claims LIVE.

---

## 24. Documentation updates (SoT chain)

After **acceptance only**, update in this order:

1. This file → status `accepted` + decision id (new DEC-AI-012 for OpenAI-primary / Gemini-availability-fallback / no Anthropic now).
2. `docs/decisions/DECISION_LOG.md` — DEC-AI-012; reconsider DEC-AI-005 and DEC-AI-011 (additive, not reversal); DEC-SEM-001 stays temporary until Stage 3.
3. `docs/requirements/REQUIREMENTS_REGISTRY.md` — acceptance notes on WFOS-AI-001–006 if review/domain-permission tightening is accepted.
4. `docs/architecture/WORKFORCEOS_MASTER_SPEC.md` — provider sentence + Scout assist rule.
5. `docs/architecture/DEPLOYMENT.md` + `docs/operations/PRODUCTION_API_KEYS.md` — new env table.
6. `docs/operations/MASTER_COMPLETION_LEDGER.md` — Stage 1–3 rows.
7. `docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md` + Academy catalog — Review Queue vs cost admin; no new Scout slugs.
8. `docs/CHANGELOG.md` — after implementation, not at proposal.

This file is accepted SoT as of 2026-09-09 (DEC-AI-012). Stage 1 + Stage 2 availability fallback may ship. Stage 3 is not started.

---

## 25. Recommended implementation sequence

1. **Sign-off** on this document (especially §8 style-failover rule, §10 `agents.read` grants, and §9 domain decide).
2. **Stage 1 ops:** prove production key decrypt; set `AI_MODEL_FAST/STANDARD/REASONING`; leave embedding unset; verify Health LIVE.
3. **Stage 1 product (small):** Phase C bundle grants for Review Queue; optional decide-review domain check; tests.
4. **Stage 2:** Gemini availability fallback on the existing HTTP client; rate table; fallback budget; Health/usage flags.
5. **Stage 2 optional:** Scout FAST assist behind the closed registry.
6. **Stage 3:** DEC-SEM-001 + approved knowledge import from Academy/manual/playbooks.
7. **Never in this sequence:** Anthropic, Gemini SDK, new Scout domain permissions, unsupervised commitments, SQL, sixth service.

---

## Sign-off

| Role | Decision | Date |
|---|---|---|
| Managing Partner | accepted 2026-09-09 | Gemini availability-only; agents.read grants; domain decide |
| Strategy & Technology Administrator | accepted 2026-09-09 | Gemini availability-only; agents.read grants; domain decide |

Accepted 2026-09-09. Stage 1 + Stage 2 availability fallback may ship. Stage 3 is not started. Do not add Anthropic. Do not add scout.recruiting / scout.finance. Do not hard-code GPT-5.6 Luna/Terra/Sol in app code.
