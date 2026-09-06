# Performance audit

Post-Phase-9 review of Command Center, SkillBridge, Scout, and high-volume lists. Indexes from `docs/database/INDEX_REVIEW.md` (migrations `0007` and `0008`) are present. The local Command Center delay (~20–32s) was a **neon-http query storm**, not missing indexes.

Driver: `drizzle-orm/neon-http`. Each Drizzle statement is a separate HTTPS round-trip to Neon. Local latency multiplies with query count. Do not switch drivers without a documented architecture decision.

## Findings

| Issue | Severity | Fix | Before / after |
| --- | --- | --- | --- |
| Command Center called `financeOverview` → `engagementEconomics` (N×5 sequential queries per project) | P1 | `financeCommandSnapshot` now uses SQL `count`/`sum` only | Dominant CC cost removed from `/app` |
| Duplicate unbounded recruiting lists on `/app` (`listSubmissions` / interviews / offers plus `recruitingAnalytics`) | P1 | Executive snapshot uses SQL counts; analytics lists stay on recruiting reports | Fewer duplicate full-table loads |
| `phase4CommandSnapshot` loaded full proposal/contract/project rows to take `.length` | P1 | SQL `count()` | Same numbers, no row payload |
| `listFailedIntegrationEvents` scanned every integration event | P1 | Filter `dead_letter` / failed status in SQL; count helper for CC | Bounded |
| `usageSummary` loaded every AI usage row for the month | P1 | SQL aggregates; CC skips event list | Costs page still lists 40 events |
| `evaluateOperationalAlerts` ran ~14 sequential selects after the snapshot | P1 | `Promise.all` plus `.limit(50)` | Alerts no longer serialize behind CC |
| `ensureSkillBridgeAlertRules` inserted six rules sequentially on every metrics/list call | P1 | Single multi-row insert | One round-trip |
| `getSkillBridgeDetail` loaded every org SkillBridge card then `.find` | P1 | Optional `profileId` filter | Detail is one profile |
| Scout job/SkillBridge searches returned unbounded cards | P1 | Cap 25 cards; candidate fetch `limit(100)` then slice 25 | Bounded Scout payloads |
| Talent/jobs/opportunities list pages remain unbounded | P2 | Pagination backlog | Documented, not changed in this pass |
| `recruitingAnalytics` still loads full job/match/submission graphs | P2 | Parallelized the seven queries; SQL rewrite later | Faster, still heavy on recruiting reports |

## High-volume paths

| Path | Current bound | Note |
| --- | --- | --- |
| `/app` Command Center | SQL aggregates + limited lists | Finance economics no longer runs here |
| `/app/talent`, `/app/jobs`, opportunities | Unbounded org lists | Acceptable at V1 volume; paginate before large production datasets |
| Scout search | 25 cards | SQL still may scan matching candidates up to 100 |
| SkillBridge queue | Full overlay for owner (or global for `skillbridge.manage`) | V1 SkillBridge population is small |
| Reports | Display slice 100 | Still may hydrate source tables first |

## Indexes

Phase 8/9 indexes remain. Additive candidates after production EXPLAIN, not added now:

- `ai_usage_events (organization_id, created_at)`
- `activities (organization_id, follow_up_at)` / `(organization_id, occurred_at)`
- `candidates (organization_id, last_contacted_at)`

Do not index Restricted PII search columns. Do not index JSONB audit snapshots.

## How to re-measure

1. Sign in locally as Managing Partner.
2. Load `/app` once (cold) and once after a refresh.
3. Compare wall time. Target: seconds, not tens of seconds, on the development Neon branch.
4. Production measurement belongs on the clean production branch after go-live, not on the fixture-filled Neon default branch.
