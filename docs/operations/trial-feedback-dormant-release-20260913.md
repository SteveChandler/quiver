# Dormant trial-feedback backend release — September 13, 2026

Steven approved “ok let’s ship the backend” after reviewing the dormant release boundary.

## Release plan and review

1. Refresh against main; run full unit, typecheck, lint, SQL contracts and browser checks. Review the complete feature diff and compare the replaced lifecycle function with production.
2. Back up production schema and email/billing state using pg_dump. Apply only the two migrations below, in order, through production owner postgres on project vawdnbbgawichorsjiwe, with canonical Supabase migration tracking. No bulk db push or unrelated drift repair.
3. Keep TRIAL_FEEDBACK_ENABLED, TRIAL_FEEDBACK_REDEMPTION_ENABLED, TRIAL_FEEDBACK_WEB_ENABLED and TRIAL_FEEDBACK_WORKER_ENABLED explicitly false. Database controls remain false and the offer policy table empty.
4. Squash feature into main after CI, then selectively promote this change onto current prod so unrelated main changes do not ride along. Require Prod Gate and verify the exact Vercel production commit/domain.
5. Verify private schema permissions, empty queues, dormant API responses and unchanged existing campaign/program configuration. Do not trigger a sending cron manually.

Objects: add four provenance columns to revenuecat_provider_events; create trial_feedback_controls, trial_feedback_offer_policy, trial_feedback_submissions and trial_feedback_web_recoveries; add service-only RPCs and a security-invoker outcome view; extend the existing lifecycle evaluator and admin dashboard behind disabled controls. No existing customer, entitlement, consent, campaign or gift data is backfilled.

Backups: private schema-before.dump and email-billing-data-before.dump in the workspace Brand-Vault/marketing/email-audit-2026-09-11/trial-feedback-20260913/backend-release evidence directory. The data backup covers email tables, offer tables, provider ledger, entitlements, earned grants and migration history. This is a scoped billing/email backup plus full schema, not a full forecast-data backup.

## Reviewed migration identities

- `20260913150000_trial_cancellation_feedback.sql`: `2993d39a4f6fd3c8853572f502e44ce707e0dc5bbbd5ed719e9efaa9a88c7fbd`
- `20260913230000_trial_feedback_web_recovery.sql`: `8f640813b964b85b40271cd422b7507af5aa304b61158b365bfe882193ea6b24`

## Validation and limits

- Full unit: 1,442 suites passed, 18,475 tests passed; 16 suites/195 tests skipped and one existing todo. Initial incorrect local SITE_URL caused six unrelated assertions; corrected to the suite contract localhost:3000. No unrelated product code changed.
- Disposable PostgreSQL: both migrations, lifecycle rules/concurrency and two connected feedback/fulfillment contract scenarios passed. The SQL integration file is now excluded from ordinary Jest discovery unless the dedicated runner supplies its disposable socket; the runner still validates the socket before any SQL.
- TypeScript and repository production lint passed.
- Browser and build evidence, CI and deployment receipt are recorded with the release evidence.
- Provider transport is synthetic in contract tests. Actual iOS original-trial stacking remains blocked by Apple case 102962226020. RevenueCat Web Billing sandbox extension, portal renewal and paid renewal remain activation gates. Android and native releases are out of scope.

## Rollback

With zero reservations/handoffs, revert this application release or restore the preceding verified production deployment while retaining the additive schema. Keep all four new flags false. Existing lifecycle v1 and gift programs keep their pre-release settings. Do not drop ledger columns/state or reset campaign history. If any handoff later exists, do not remove its reconciler: pause new acceptance and keep recovery operational under a separately reviewed rollback.

Activation is not included. Enabling feedback changes the campaign ID/content hash to v2 and requires a reviewed campaign transition. Enabling recovery also requires verified provider behavior and approved offer policy; shipping this release proves neither.
