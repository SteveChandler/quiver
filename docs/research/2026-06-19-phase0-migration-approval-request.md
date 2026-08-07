# Phase 0 Migration Approval Request

Date: 2026-06-19

## Decision Needed

Approve or reject applying:

- `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql`

This is a production Supabase write. It must not be applied without explicit human approval.

## Purpose

Phase 0 is the measurement gate for all forecast-coverage changes. It makes short-horizon surf-call accuracy measurable before Phases 1-3 can change coverage.

Canonical approval metric after this lands:

- Truth: `observed_m` face-height observation.
- Metric: MAE and signed bias in meters.
- Splits: `0-24h`, `25-72h`, `73h+`.
- Baselines: current display, raw display, raw OM, v5 shadow, and proposed display in the harness.
- Ship gate for coverage changes: non-regressing combined `0-72h` proposed-vs-current display MAE, plus beach-level slices for scoped writes.

## Required Order

1. Deploy the Phase 0 application code first.
2. Run the read-only snapshot logging health check with the deploy timestamp.
3. Re-run the read-only preflight.
4. If still clean, apply the migration only after explicit human approval.
5. Run schema postflight.
6. Wait for fresh short-horizon snapshot rows and observation backfill.
7. Run data readiness.
8. Re-run scoped Phase 1/2/3 approval harnesses before any coverage write.

The app code must deploy first because the prepared writer falls back to legacy `(beach_id, predicted_at)` while the schema is old, then switches to the horizon-aware conflict target after the migration. Applying the migration before the app code can cause old writer snapshot inserts to miss measurement rows.

## App Deploy Review Checklist

Before deploying the Phase 0 application code:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json --max-evidence-age-hours 24
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --print-only
```

Expected deploy-review result before migration:

- Focused Jest, scoped ESLint, typecheck, preview build, read-only preflight, and read-only snapshot logging health pass.
- The preflight remains read-only and returns `can_request_phase0_migration_approval = true`.
- The snapshot logging health check proves recent legacy-schema rows are canonical `face-Hs-transformer-v1` rows with valid 0-168h horizons and complete display heights.
- The saved evidence JSON validates with `--validate-output-json --max-evidence-age-hours 24`, proving its schema version, pass status, Node 22 version, full-gate step list, explicit per-step pass results, validated baseline harness summary, embedded baseline harness freshness, embedded baseline measured-range freshness, parsed read-only SQL summaries, top-level evidence freshness, and credential sanitization before review. Partial smoke evidence generated with `--skip-preview-build`, `--skip-baseline-harness`, or `--skip-read-only-sql` is rejected unless validation explicitly uses `--allow-partial-gate-evidence`, and that opt-out is not approval evidence.
- The legacy short-horizon starvation diagnostic can still be present before migration.
- No production data mutation has happened yet.

After the app deploy and before applying the migration:

1. Run the read-only deployed logging check with the deploy timestamp and save evidence:

   ```bash
   source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --deploy-start-utc "<deploy-start-utc>" --output-json /tmp/quiver-phase0-app-deploy-gate-post-deploy.json
   source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate-post-deploy.json --require-deploy-start-utc --max-evidence-age-hours 24
   ```

2. Confirm the read-only preflight still passes in that gate output and the saved evidence validates with `--require-deploy-start-utc`. The saved evidence must include a deploy timestamp that is not later than the evidence `generated_at` timestamp.
3. Create a fresh local backup artifact with `pg_dump "$POSTGRES_URL_NON_POOLING" --format=custom --file /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump`.
4. After the maintainer replies with the approval phrase, run the local pre-apply packet check:

   ```bash
   source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/phase0-migration-preapply-check.ts --post-deploy-evidence-json /tmp/quiver-phase0-app-deploy-gate-post-deploy.json --backup-path /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump --approval-phrase "<maintainer approval phrase>"
   ```

5. Reconfirm explicit human approval for `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql`.

Downstream approval artifacts must be regenerated after any Phase 1/2/3 proposed SQL changes. Phase 1 proposed JSON now includes `source_migration_sha256`; stale harness or readiness artifacts generated against an older Phase 1 migration hash are not approval evidence.

## Approval Plan

Approval phrase for this Phase 0 migration plan only:

```text
APPROVE: 98d05d761d24573cb5fe04777de4967927d34784ae4c184d670df89fba85882d
```

This approval phrase does not authorize Phase 1, Phase 2, Phase 3, Track B, rollback, or any other production mutation.

The SHA-256 above is computed over this exact plan text:

```text
PHASE0_FORECAST_ACCURACY_MIGRATION_PLAN_V1
migration: supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
rollback: supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql
target: production Supabase quiverDB via POSTGRES_URL_NON_POOLING owner connection
backup_artifact: /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump, fresh pg_dump within 24 hours required before apply
preconditions:
- Phase 0 application code has deployed before the migration.
- Fresh post-deploy read-only Phase 0 app-deploy gate passes and its saved evidence validates with --require-deploy-start-utc.
- Fresh local pg_dump backup artifact exists at backup_artifact and is less than 24 hours old.
- Phase 0 migration pre-apply check passes against post-deploy evidence, backup artifact, and maintainer approval phrase.
- Maintainer explicitly replies with the approval phrase for this plan hash.
pre_apply_command:
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/phase0-migration-preapply-check.ts --post-deploy-evidence-json /tmp/quiver-phase0-app-deploy-gate-post-deploy.json --backup-path /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump --approval-phrase "<maintainer approval phrase>"
command:
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.phase0_forecast_accuracy_migration_approved = '2026-06-19-phase0-forecast-accuracy-metrics-approved';" -f supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
objects_affected:
- public.ml_predictions_log columns forecast_horizon_bucket, display_wave_source, display_raw_input_height_m
- public.ml_predictions_log CHECK constraints for horizon bucket, display wave source, and nonnegative raw input
- indexes idx_ml_predictions_display_horizon_source_unique, idx_ml_predictions_horizon_bucket_observed, and legacy idx_ml_predictions_beach_predicted_at_unique removal
- functions public.get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz), public.get_ml_weekly_metrics(), public.get_ml_health_metrics(), public.sync_session_wave_observation_candidate(...)
post_apply:
- psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql
- wait for fresh 0-24h and 25-72h rows plus observation backfill
- psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql
- rerun Phase 0 harness and all scoped Phase 1/2/3 approval harnesses before any coverage write
not_authorized_by_this_plan:
- Phase 1 shoaling factor production write
- Phase 2 terrain production write
- Phase 3 analog or bathymetry production write
- Track B event allowlist migration
```

## Migration Summary

The migration:

- Adds `ml_predictions_log.forecast_horizon_bucket`.
- Adds `ml_predictions_log.display_wave_source`.
- Adds `ml_predictions_log.display_raw_input_height_m`.
- Adds CHECK constraints for canonical horizon buckets, runtime wave-source tags, and nonnegative raw replay input.
- Backfills `forecast_horizon_bucket` from `forecast_horizon_hours`.
- Creates `idx_ml_predictions_display_horizon_source_unique` on `(beach_id, predicted_at, forecast_horizon_bucket, display_source)` with `NULLS NOT DISTINCT`.
- Drops legacy `idx_ml_predictions_beach_predicted_at_unique`.
- Adds `idx_ml_predictions_horizon_bucket_observed`.
- Creates `get_forecast_accuracy_horizon_metrics(...)`.
- Repoints `get_ml_weekly_metrics()` and `get_ml_health_metrics()` to live display snapshot columns instead of retired/null error columns.
- Updates `sync_session_wave_observation_candidate(...)` to match only canonical `face-Hs-transformer-v1` display snapshots and prefer shorter horizon buckets.
- Sends `NOTIFY pgrst, 'reload schema'`.

Rollback:

- `supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql`
- Restores the legacy unique index only if no duplicate `(beach_id, predicted_at)` groups exist.
- Leaves additive columns and metric RPCs in place to avoid data loss.
- Fails before mutating schema unless `app.phase0_forecast_accuracy_rollback_approved` is set to the exact rollback approval token in the same database session after separate rollback approval.

## Latest Read-Only Evidence

Commands:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json --max-evidence-age-hours 24
```

Result: PASS. The full gate ran focused Phase 0 Jest, forecast-roadmap guard Jest, scoped ESLint, `yarn typecheck`, `yarn typecheck:forecast-gate`, preview build, read-only Phase 0 baseline harness, `--phase0-baseline` report validation, read-only Phase 0 preflight, and read-only snapshot logging health. Both SQL scripts ran in `BEGIN READ ONLY; ... ROLLBACK;`. The sanitized evidence JSON was generated at `2026-06-20T13:20:03.612Z` on Node `22.22.0`, carries `evidence_schema_version: 5`, records each gate step in `step_results` with `status: "passed"`, includes parsed `baseline_harness` and `read_only_sql` summaries, and validated successfully, including the embedded baseline harness freshness and measured-range freshness checks. The embedded baseline harness generated at `2026-06-20T13:20:00.232Z` and measured `2026-05-21T13:19:49.083Z` to `2026-06-20T13:19:49.083Z`; it covers 44,544 buoy rows, 29 session rows, 44,573 matched prediction rows, and 175 matched `0-72h` rows with current-display MAE `0.256m`. Those 175 short-horizon rows are visible as current baseline evidence, but 0/175 have stored horizon-bucket provenance and 0/175 have replay provenance before the Phase 0 migration.

Validated after the `2026-06-20T13:20:03.612Z` full-gate run with `yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json --max-evidence-age-hours 24`: PASS. Verified steps remained `focused-jest`, `forecast-roadmap-guard-jest`, `focused-eslint`, `typecheck`, `forecast-scripts-typecheck`, `preview-build`, `phase0-baseline-harness`, `phase0-baseline-validate`, `phase0-preflight`, and `snapshot-logging-health`. The same pre-deploy artifact intentionally fails the post-deploy validator with `deploy_start_utc_required` when run with `--require-deploy-start-utc`.

Key findings:

- Required source columns present.
- Existing legacy unique index present.
- New horizon-aware unique index absent, as expected before migration.
- Phase 0 columns absent, as expected before migration.
- Canonical accuracy RPC absent, as expected before migration.
- New unique-index duplicate risk: `0` duplicate groups, `0` duplicate rows.
- Face-Hs display-source contract clear: 76,228 candidate rows, 76,228 canonical `display_source` rows, 0 model-version/display-source mismatches.
- `can_request_phase0_migration_approval = true`.
- `phase0_preflight_blockers` is empty.
- Current short-horizon starvation is confirmed and expected pre-migration: 0 fresh `0-24h`, 0 fresh `25-72h`, 2,521 fresh `73h+` rows in the latest 24h.
- The preflight now prints `phase0_preflight_assertions_passed` and raises an explicit post-rollback Phase 0 preflight error pointing at `phase0_preflight_blockers` if its approval summary is false, instead of relying on raw arithmetic-error sentinels.

Current 30-day coverage from preflight:

| Horizon | Total rows | Observed rows | Last created |
| --- | ---: | ---: | --- |
| `0-24h` | 108 | 63 | `2026-06-14 22:00:47Z` |
| `25-72h` | 192 | 112 | `2026-06-14 22:00:47Z` |
| `73h+` | 75,928 | 44,369 | `2026-06-20 13:01:09Z` |

## Verification

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-readiness-report.test.ts scripts/__tests__/forecast-accuracy-report-validate.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts lib/services/forecast/__tests__/accuracy-metrics.test.ts --runInBand
```

Result: PASS. 7 suites, 129 tests.

Refresh after tightening the post-migration data-readiness canonical metric checks:

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-readiness-report.test.ts scripts/__tests__/forecast-accuracy-report-validate.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts lib/services/forecast/__tests__/accuracy-metrics.test.ts --runInBand
```

Result: PASS. 7 suites, 170 tests.

Refresh after hardening the post-migration data-readiness failure path:

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts --runInBand
```

Result: PASS. 1 suite, 13 tests.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck
```

Result: PASS.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && VERCEL_ENV=preview yarn build
```

Result: PASS.

Command:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-snapshot-logging-health.sql
```

Result: PASS. The script ran in `BEGIN READ ONLY; ... ROLLBACK;` using the default latest-24h window. Latest refresh found 2,521 canonical display rows across 318 beaches, with 0 model-version mismatches, 0 invalid horizon-hour rows, 0 rows missing display heights, and an empty `phase0_snapshot_logging_health_blockers` table.

Failure-path check:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -v phase0_snapshot_min_created_at='2099-01-01T00:00:00Z' -f scripts/db/phase0-snapshot-logging-health.sql
```

Result: expected exit `3`. The script printed the failed assertions, emitted `phase0_snapshot_logging_health_blockers`, rolled back, then raised `Phase 0 snapshot logging health failed; see phase0_snapshot_logging_health_blockers and phase0_snapshot_logging_health_assertions above.` This replaces the old raw arithmetic-error sentinel with an explicit gate failure.

Blocker codes from the forced empty-window run: `legacy_display_heights_complete`, `legacy_horizon_hours_valid`, `legacy_model_version_contract_complete`, and `legacy_recent_face_hs_rows_present`.

Postflight pre-apply check:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql
```

Result: expected exit `3`. Refreshed on 2026-06-20 at `2026-06-20T03:21:15Z`: because the Phase 0 migration is not applied yet, the postflight printed the missing expected objects, emitted `phase0_postflight_blockers`, rolled back, then raised `Phase 0 forecast accuracy postflight failed; see phase0_postflight_blockers and phase0_expected_objects above.` This confirms the postflight fails cleanly before attempting migrated-schema-only metric RPC calls.

Blocker codes from the latest pre-apply run: `missing_get_forecast_accuracy_horizon_metrics`, `missing_get_forecast_accuracy_horizon_metrics_live_baseline_columns`, `missing_get_ml_health_metrics_live_display_columns`, `missing_get_ml_weekly_metrics_live_display_columns`, `missing_idx_ml_predictions_display_horizon_source_unique`, `missing_ml_predictions_log_display_raw_input_height_m`, `missing_ml_predictions_log_display_raw_input_height_nonnegative_check`, `missing_ml_predictions_log_display_wave_source`, `missing_ml_predictions_log_display_wave_source_check`, `missing_ml_predictions_log_forecast_horizon_bucket`, `missing_sync_session_wave_observation_candidate_face_hs_source_predicate`, and `unexpected_idx_ml_predictions_beach_predicted_at_unique`.

Data-readiness pre-apply check:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql
```

Result: expected exit `3`. Refreshed on 2026-06-20 at `2026-06-20T03:21:15Z`: because the Phase 0 migration is not applied yet, the data-readiness gate printed `phase0_data_readiness_schema_state`, reported 4 missing prerequisites (`forecast_horizon_bucket`, `display_wave_source`, `display_raw_input_height_m`, and `get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz)`), emitted blocker codes `schema_canonical_accuracy_rpc_missing`, `schema_display_raw_input_height_missing`, `schema_display_wave_source_missing`, and `schema_forecast_horizon_bucket_missing`, rolled back, then raised `Phase 0 forecast accuracy data readiness failed; see phase0_data_readiness_blockers, phase0_data_readiness_assertions, and phase0_data_readiness_schema_state above.`

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json
```

Result: PASS. Latest full-gate refresh on 2026-06-20 at `2026-06-20T13:20:03Z` completed focused Phase 0 Jest (10 suites, 222 tests), forecast-roadmap guard Jest (14 suites, 220 tests), scoped ESLint over Phase 0 and forecast-roadmap script/test targets, `yarn typecheck`, `yarn typecheck:forecast-gate` (42 forecast-roadmap script/test files), `VERCEL_ENV=preview yarn build`, the read-only Phase 0 baseline harness, `--phase0-baseline` report validation, the read-only Phase 0 preflight, and the read-only snapshot logging health check. The embedded baseline harness generated at `2026-06-20T13:20:00.232Z` measured `2026-05-21T13:19:49.083Z` to `2026-06-20T13:19:49.083Z`, covering 44,544 buoy rows, 29 session rows, 44,573 matched prediction rows, and 175 matched `0-72h` rows with current-display MAE `0.256m`. The preflight found 76,228 canonical face-Hs display rows in the 30-day window and `can_request_phase0_migration_approval = true`; snapshot health found 2,521 recent legacy-schema rows across 318 beaches with 0 model-version mismatches, 0 invalid horizon rows, and 0 missing display heights. The runner wrote sanitized schema-v5 evidence JSON to `/tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json` with `generated_at = "2026-06-20T13:20:03.612Z"`, explicit passed `step_results`, parsed `baseline_harness`, and parsed `read_only_sql` summaries for preflight approval readiness plus snapshot logging health.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --skip-preview-build
```

Result: PASS. Prior skip-preview refresh on 2026-06-20 at `2026-06-20T01:39:55Z` completed focused Phase 0 Jest (8 suites, 189 tests), including the app-deploy gate runner test itself, scoped ESLint, `yarn typecheck`, the read-only Phase 0 preflight, and the read-only snapshot logging health check. The runner also now fails before deploy-readiness checks unless it is run on Node 22. The full-gate run above supersedes this as both the latest build-inclusive evidence and the latest live-count evidence.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && NODE_OPTIONS="--max-old-space-size=8192" npx eslint --no-warn-ignored --max-warnings=0 scripts/forecast-accuracy-readiness-report.ts scripts/__tests__/forecast-accuracy-readiness-report.test.ts
```

Result: PASS.

## Post-Approval Commands

Run only after explicit approval:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.phase0_forecast_accuracy_migration_approved = '2026-06-19-phase0-forecast-accuracy-metrics-approved';" -f supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql
```

The migration itself fails before mutating schema unless `app.phase0_forecast_accuracy_migration_approved` is set to the exact approval token above in the same database session.

Rollback, only after separate explicit rollback approval:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.phase0_forecast_accuracy_rollback_approved = '2026-06-19-phase0-forecast-accuracy-rollback-approved';" -f supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql
```

The rollback itself fails before mutating schema unless `app.phase0_forecast_accuracy_rollback_approved` is set to the exact approval token above in the same database session.

Then, after fresh rows and observation backfill:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both
```

`phase0-snapshot-logging-health.sql` is expected to fail in the migrated-schema branch until the new writer has produced at least one fresh `0-24h` row and one fresh `25-72h` row with complete horizon-bucket and replay provenance.

It also fails closed if only some Phase 0 schema objects are present, because partial schema is neither a healthy legacy state nor a healthy migrated measurement state.

`phase0-forecast-accuracy-data-readiness.sql` is expected to fail until the new writer has produced fresh `0-24h` and `25-72h` rows with stored horizon-bucket and replay provenance, the 30-day window has at least 75 observed `0-72h` rows with that provenance, and the canonical metric RPC returns finite required short-horizon baseline metrics. Required MAE values must be nonnegative, and MAE/bias values cannot be `NaN` or infinite.

Before the migration is applied, the same data-readiness script fails at the explicit schema gate instead of attempting migrated-schema-only queries. It prints `phase0_data_readiness_blockers` so automation can consume the missing schema/RPC codes directly.

## Approval Boundary

Approval for this migration would only authorize Phase 0 measurement infrastructure. It would not authorize:

- Phase 1 shoaling factor apply-gap.
- Phase 2 terrain writes.
- Phase 3 analog-factor writes.
- Any other production data mutation.

Those remain gated on fresh Phase 0 `0-72h` proof and separate explicit approval.
