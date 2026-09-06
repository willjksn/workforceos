# Index review (Phase 8)

New indexes are additive. Existing foreign-key indexes remain. Do not index every filter column.

Migration: `drizzle/0007_chemical_quasar.sql`.

## Added indexes

| Index | Table | Justification |
| --- | --- | --- |
| `approvals_org_status_idx` | `approvals` | Review queue and Command Center pending-review counts filter by organization + status. |
| `agent_runs_org_status_idx` | `agent_runs` | Failed-run alerts and AI report filter by organization + status. |
| `contacts_org_last_contacted_idx` | `contacts` | Data quality stale-contact scan by organization and `last_contacted_at`. |
| `opportunities_org_stage_idx` | `opportunities` | Pipeline, win-rate, and stale-opportunity queries filter by organization + stage. |
| `opportunities_org_updated_at_idx` | `opportunities` | Stale-opportunity alerts order/filter by `updated_at`. |
| `candidates_org_availability_idx` | `candidates` | Talent Network available-now counts and search filters. |
| `candidates_org_military_status_idx` | `candidates` | Military candidate counts and reports. |
| `jobs_org_status_idx` | `jobs` | Active-search counts and recruiting alerts. |
| `invoices_org_status_due_idx` | `invoices` | AR and overdue-invoice alerts filter status + due date. |
| `integration_events_org_status_idx` | `integration_events` | Failed sync / billing-sync alerts. |
| `rate_limit_buckets_bucket_key_idx` | `rate_limit_buckets` | Lookup by bucket key (unique also covers key + window). |
| `in_app_notifications_user_kind_record_uq` | `in_app_notifications` | Unique `(user_id, kind, record_id)` so SkillBridge follow-up scans do not insert duplicate rows. Migration `0009_swift_saracen.sql`. |

## Not indexed

- Report date filters on wide fact tables remain sequential scans at V1 volume; add BRIN/time indexes only after slow-query evidence.
- Candidate `email` is Restricted PII and already unique per operating practice; no extra search index.
- JSONB audit snapshots are not indexed.

## Query hygiene (Phase 8)

- Command Center and reports aggregate on the server (`Promise.all` of counted queries). Client pages do not recompute metrics.
- Report row lists are capped at 100 rows. CSV uses the same server query, not a second client fetch.
- Access review loads users + roles in one join (`listOrganizationUsers`) instead of per-user role queries.
- Do not cache Restricted PII or rapidly changing AR/alert lists in a shared CDN cache.
