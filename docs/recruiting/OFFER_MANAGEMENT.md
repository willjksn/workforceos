# Offer management

Offers reuse the existing `offers` table. Phase 10 adds `application_id` and `version`. Never overwrite historical terms — insert a new version.

Statuses include draft, pending_approval, approved, sent/extended, accepted, declined, expired, rescinded, withdrawn.

When approval is configured (default), `requestApproval` creates an `approvals` row. Sending requires `offers.send` after approval.

Compensation is Restricted. `offers.read` is not a substitute for `candidate_pii.read` on candidate contact fields.

Acceptance moves the application to `pre_hire` and can create `prehire_records`.
