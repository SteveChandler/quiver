# Phase 0 Forecast Accuracy Readiness Packet

Date: 2026-06-19

## Scope

Phase 0 is the measurement gate for the forecast-coverage roadmap. Its job is to make every later coverage change measurable against the canonical metric:

- Truth: `observed_m` face-height observation.
- Metric: MAE and signed bias in meters.
- Required splits: horizon bucket (`0-24h`, `25-72h`, `73h+`) and baseline (`current_display`, `raw_display`, `raw_om`, `v5_shadow`, plus `proposed_display` in the harness).
- Required gate summary: combined `0-72h` proposed vs current display MAE delta for any proposed factor change.
- Ship rule for Phases 1-3: do not apply coverage changes unless they can report a non-regressing `0-72h` face-height MAE delta through this gate.

No production write has been applied.

## Proposed Production Write

Migration for human review:

- `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql`

Rollback:

- `supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql`

Preflight, postflight, and data readiness:

- `scripts/db/phase0-forecast-accuracy-preflight.sql`
- `scripts/db/phase0-snapshot-logging-health.sql`
- `scripts/db/phase0-forecast-accuracy-postflight.sql`
- `scripts/db/phase0-forecast-accuracy-data-readiness.sql`
- `docs/research/2026-06-19-phase0-migration-approval-request.md`

The migration:

- Adds `ml_predictions_log.forecast_horizon_bucket`.
- Adds `ml_predictions_log.display_wave_source` and `ml_predictions_log.display_raw_input_height_m` so proposed-factor replay uses the same source gate and raw transformer input as runtime.
- Backfills the bucket from `forecast_horizon_hours`.
- Replaces the old unique index on `(beach_id, predicted_at)` with a horizon-aware unique index on `(beach_id, predicted_at, forecast_horizon_bucket, display_source)`.
- Adds `get_forecast_accuracy_horizon_metrics(...)`.
- Repoints `get_ml_weekly_metrics()` and `get_ml_health_metrics()` away from retired/null correction columns and onto live display snapshot columns.

Approval status: pending human approval after app deploy review. Do not apply automatically.

## Required Apply / Deploy Order

Deploy the application code with the snapshot-writer fallback before applying the Phase 0 migration.

Reason:

- `logDisplayPredictions(...)` writes the new `forecast_horizon_bucket` column and upserts on `(beach_id, predicted_at, forecast_horizon_bucket, display_source)`.
- `logDisplayPredictions(...)` also writes the wave-height source tag and raw transformer input height needed to replay CDIP-gated shoaling proposals.
- The prepared app code falls back to the legacy `(beach_id, predicted_at)` conflict target only when the new Phase 0 columns/index are not live yet. That keeps current snapshot logging alive if the app deploys before the migration.
- If the migration lands before this app code, the old production writer still targets `(beach_id, predicted_at)` after that unique index has been dropped, so snapshot writes can fail until the app deploy catches up. User-facing forecasts should still load, but measurement rows can be missed.
- After the migration is live, the prepared app code uses the new horizon-aware conflict target and starts capturing short-horizon rows.

Safe order:

1. Deploy the application code that includes the legacy fallback in `logDisplayPredictions(...)`.
2. Run `scripts/db/phase0-snapshot-logging-health.sql`, ideally with `-v phase0_snapshot_min_created_at="<deploy-start-utc>"`, to confirm the deployed logging path is still landing canonical display rows.
3. Human approves the production write.
4. Apply `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql`.
5. Run `scripts/db/phase0-forecast-accuracy-postflight.sql`.
6. Wait for fresh short-horizon snapshots and observation backfill, then run `scripts/db/phase0-forecast-accuracy-data-readiness.sql`.
7. Run the harness and verify `0-72h` rows with replay provenance are available before evaluating Phases 1-3.

Local deploy review before step 1:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json --max-evidence-age-hours 24
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --print-only
```

Post-deploy migration review before step 3:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --skip-preview-build --deploy-start-utc "<deploy-start-utc>"
```

Expected result before migration: Jest, scoped ESLint, typecheck, and preview build pass; after deploy, the read-only snapshot health check confirms recent canonical display logging; the read-only preflight still reports `can_request_phase0_migration_approval = true`; the legacy short-horizon starvation diagnostic can remain present because the schema has not changed yet.

After any Phase 1/2/3 proposed SQL changes, regenerate their proposed JSON and harness/readiness artifacts before approval review. Phase 1 artifacts are bound to the current migration through `source_migration_sha256`.

## Application Code Prepared

Files that support Phase 0 measurement:

- `lib/services/forecast/accuracy-metrics.ts`
- `lib/services/forecast/forecast-builder.ts`
- `lib/services/forecast/log-display-prediction.ts`
- `scripts/forecast-accuracy-harness.ts`
- `scripts/forecast-accuracy-report-validate.ts`
- `scripts/phase0-app-deploy-gate.ts`
- `scripts/typecheck-forecast-gate.ts`
- `scripts/diag-snapshot-writer.ts`
- `scripts/ml-stats.ts`

Behavioral changes:

- `phase0-app-deploy-gate.ts` now enforces Node 22 before running deploy-readiness checks, includes its own runner and forecast-script typecheck tests in the focused Phase 0 Jest/ESLint targets, runs a separate forecast-roadmap guard Jest step for Phase 1/2/3 and Track A/B/C proof tests, lints the forecast-roadmap source scripts plus guard tests, and runs `yarn typecheck:forecast-gate` so forecast-roadmap scripts excluded from the app `tsconfig.json` still get TypeScript-checked before deploy review. The script typecheck now fails before invoking TypeScript if any configured target path is missing, so moved/renamed gate files cannot silently drop out of coverage. Use `--output-json` to write a sanitized, schema-v5 run record that contains step IDs, per-step `status: "passed"` results, display commands with `$POSTGRES_URL_NON_POOLING` placeholders, Node version, pass status, a validated current-system `baseline_harness` summary with measured range, and parsed read-only SQL summaries without persisting the production Postgres URL or raw SQL output. Use `--validate-output-json` to fail closed on malformed evidence, missing or stale schema version, missing/mismatched steps or step results, stale top-level evidence, stale or future-dated embedded baseline harness evidence, stale/invalid embedded baseline measured range, failed status, non-Node-22 runs, leaked Postgres URLs, partial gate runs, missing/failed baseline harness summaries, or missing/failed read-only SQL summaries before approval review; validation defaults to requiring preview build + baseline harness + read-only SQL and a 24-hour max age. Local smoke artifacts can only validate with `--allow-partial-gate-evidence`, which is not approval evidence.
- Accuracy math is centralized in `accuracy-metrics.ts`.
- The TS metric layer and harness now prefer the stored `forecast_horizon_bucket` and only recompute from `forecast_horizon_hours` as a fallback, matching the SQL RPC and preserving the frozen issue-time bucket.
- Display prediction logging records horizon buckets so short-horizon and long-horizon snapshots can coexist.
- Display prediction logging records the source tag and raw transformer input height, so the harness can replay proposed `shoaling_factors` only when runtime would allow them to fire.
- Forecast builder/logging tests cover the horizon-aware write shape.
- `forecast-accuracy-harness.ts` can compare current vs proposed display heights and can use buoy truth, session truth, or both.
- The harness replays proposed beach configs through source-aware paths: `model_swell` keeps component decomposition, while CDIP/buoy/nowcast/model-Hs scalar paths use the logged raw transformer input.
- Proposed runs can print `0-72h` gate slices with `--group-by region` or `--group-by beach` to find non-regressing subsets instead of approving a broad regressing write.
- Proposed beach-config JSON auto-scopes the harness to its `beaches` IDs/slugs when no explicit `--beach-ids` or `--beach-slugs` are provided, which prevents accidentally diluting a scoped approval check with unrelated beaches.
- Harness runs can write a machine-readable evidence packet with `--output-json`, including scope, row counts, horizon metrics, gate verdicts, slice verdicts, and measured-scope coverage.
- Saved harness reports can be checked independently with `forecast-accuracy-report-validate.ts`. `--phase0-baseline` validates current-system baseline packets by requiring schema v1, truth/measurement contracts, a fresh measured window, no proposed artifact, the complete canonical `0-24h` / `25-72h` / `73h+` metric grid, the complete canonical `0-72h` gate metric grid, and the configured short-horizon sample floor. `--approval` validates proposed-write packets, including canonical `0-72h` / `proposed_display` gate binding, proposed-JSON path binding, report freshness, measured-window freshness, sample floors, and scope checks, so approval packets fail closed even when reviewed after the live harness run. Approval-mode CLI validation defaults to 75 aggregate samples, 25 per-slice samples, and a 24h report-age limit; programmatic approval validation fails if those constraints are missing or zero. Approval validation also rejects reports whose `range.end` is older than the allowed report-age window at `generated_at`, so a freshly regenerated report cannot certify stale measurement data.
- Approval validation treats top-level proposed beach configs with write fields as scope-bearing, including slug-keyed configs. Slug-keyed top-level configs must include `id`; otherwise approval fails because the write set cannot be resolved to beach IDs.
- Approval validation recomputes aggregate and beach-slice verdicts from the numeric MAE deltas, so a stale or hand-edited report cannot hide a positive delta behind a `non-regressing` label or an empty `regressedSlices` list.
- Approval validation fails malformed numeric fields in harness evidence packets: gate sample counts must be non-negative integers, gate MAEs must be finite numbers, row counts must be non-negative integers, and slice counts/deltas must be numeric. JSON strings or nulls cannot satisfy approval gates through JavaScript coercion.
- Approval validation now requires `row_counts.matched_0_72h_rows` to be present and requires the `0-72h` proposed gate sample counts to equal it, so an approval report cannot silently omit matched short-horizon rows from the MAE delta.
- Approval validation now also requires beach-slice sample totals to equal the aggregate `0-72h` gate sample counts, so per-beach proof cannot undercount or double-count relative to the approved gate.
- Approval-subset generation selects narrowed beach candidates by numeric `deltaMaeM <= 0`, not by the slice verdict label alone, so stale labels cannot pull positive-delta beaches into a write candidate.
- Approval-subset generation also requires selected slice sample counts to be real non-negative integers, so direct callers cannot select a slice with string-coerced counts.
- Approval-subset output treats any top-level object with proposed beach write fields as write-bearing, including slug-keyed configs, and drops it unless it resolves to a selected beach ID. The CLI also fails if the final proposed output is missing a selected ID or retains an unselected ID.
- Saved session/both truth reports must include the harness `truth_contract` proving canonical `face-Hs-transformer-v1` display-source session links are enforced; approval validation rejects older session-truth reports without it.
- Approval runs can add `--fail-on-regression`; the harness exits `2` if no proposed `0-72h` gate delta is available or if the delta regresses.
- Approval runs can add `--fail-on-slice-regression` with `--group-by region` or `--group-by beach`; the harness exits `2` if slice data is missing or any reported slice regresses.
- Approval runs can add `--fail-on-unmeasured-slices` with `--group-by beach`; the harness exits `2` if any scoped proposed beach has no measured `0-72h` gate rows.
- Approval runs can add `--min-gate-samples <n>` and `--min-slice-samples <n>`; the harness exits `2` when aggregate or per-slice `0-72h` evidence is thinner than the required sample floor.
- `ml-stats.ts` reads the new canonical RPC and live display columns instead of retired/null fields.
- `phase0-forecast-accuracy-data-readiness.sql` is the fail-closed post-migration data gate. It requires fresh `0-24h` and `25-72h` rows from the new writer, complete replay provenance on fresh short-horizon rows, at least 75 observed `0-72h` rows with replay provenance in the last 30 days, and finite canonical RPC metrics for every required `0-24h` / `25-72h` baseline. Required MAE values must be nonnegative, and MAE/bias values cannot be `NaN` or infinite.
- `phase0-forecast-accuracy-data-readiness.sql` now schema-checks the migrated columns and canonical metric RPC before running migrated-schema-only data queries. It also emits `phase0_data_readiness_blockers` for stable automation. Pre-apply and partial-schema states fail with an explicit post-rollback Phase 0 data-readiness error, not a raw missing-column or arithmetic error.
- `phase0-forecast-accuracy-postflight.sql` now fails if `get_ml_weekly_metrics`, `get_ml_health_metrics`, or the canonical accuracy RPC are not using the live display snapshot columns. It emits `phase0_postflight_blockers` with stable blocker codes before raising an explicit post-rollback Phase 0 postflight error.
- `forecast-accuracy-readiness-report.ts` now adds a proposed-set freshness gate: each proposed beach needs fresh replayable scoped snapshots in both `0-24h` and `25-72h` buckets before approval readiness can be true. Replayable means the row has an allowed runtime `display_wave_source` tag and a finite nonnegative `display_raw_input_height_m`, not just non-null replay columns.
- `forecast-accuracy-readiness-report.ts` now emits `summary.readiness_blockers` for human-readable approval-readiness failures and `summary.readiness_blocker_codes` for stable automation, prints blocker messages in the CLI output before the first blocked-beaches table, and derives `approval_readiness` from the structured blocker list being empty.
- For session truth, the readiness report now also requires the candidate's snapshot display source and linked prediction display source to both be canonical `face-Hs-transformer-v1`; non-canonical session links cannot contribute approval-ready rows.

## Current Verification

Commands run on 2026-06-19 from `/Users/stevenchandler/Desktop/dev/quiver`:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit --runTestsByPath lib/services/forecast/__tests__/accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts
```

Result: PASS. 5 suites, 100 tests.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck
```

Result: PASS.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && NODE_OPTIONS="--max-old-space-size=8192" npx eslint --no-warn-ignored --max-warnings=0 lib/services/forecast/accuracy-metrics.ts lib/services/forecast/forecast-builder.ts lib/services/forecast/log-display-prediction.ts scripts/forecast-accuracy-harness.ts scripts/diag-snapshot-writer.ts scripts/ml-stats.ts lib/services/forecast/__tests__/accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts
```

Result: PASS.

Additional verification after the proposed-set readiness replay-provenance rule was aligned with the writer, harness, and SQL gates:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-readiness-report.test.ts scripts/__tests__/forecast-accuracy-report-validate.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts lib/services/forecast/__tests__/accuracy-metrics.test.ts --runInBand
```

Result: PASS. 7 suites, 129 tests.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck
```

Result: PASS.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && VERCEL_ENV=preview yarn build
```

Result: PASS.

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-snapshot-logging-health.sql
```

Result: PASS. The script ran in `BEGIN READ ONLY; ... ROLLBACK;` using the default latest-24h window. Latest refresh found 2,516 canonical display rows across 318 beaches, with 0 model-version mismatches, 0 invalid horizon-hour rows, 0 rows missing display heights, and an empty `phase0_snapshot_logging_health_blockers` table.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && NODE_OPTIONS="--max-old-space-size=8192" npx eslint --no-warn-ignored --max-warnings=0 scripts/forecast-accuracy-readiness-report.ts scripts/__tests__/forecast-accuracy-readiness-report.test.ts
```

Result: PASS.

Verification refresh after hardening the data-readiness canonical metric checks:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-readiness-report.test.ts scripts/__tests__/forecast-accuracy-report-validate.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts lib/services/forecast/__tests__/accuracy-metrics.test.ts --runInBand
```

Result: PASS. 7 suites, 170 tests.

Verification refresh after hardening the data-readiness schema/failure path:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts --runInBand
```

Result: PASS. 1 suite, 13 tests.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck
```

Result: PASS.

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && VERCEL_ENV=preview yarn build
```

Result: PASS.

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-preflight.sql
```

Result: PASS. The script ran in `BEGIN READ ONLY; ... ROLLBACK;`.

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-snapshot-logging-health.sql
```

Result: PASS. The script ran in `BEGIN READ ONLY; ... ROLLBACK;` using the default latest-24h window. That refresh found 2,527 canonical display rows across 318 beaches, with 0 model-version mismatches, 0 invalid horizon-hour rows, and 0 rows missing display heights.

Failure-path refresh:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -v phase0_snapshot_min_created_at='2099-01-01T00:00:00Z' -f scripts/db/phase0-snapshot-logging-health.sql
```

Result: expected exit `3`. The script printed the failed legacy assertions, emitted `phase0_snapshot_logging_health_blockers`, rolled back, then raised `Phase 0 snapshot logging health failed; see phase0_snapshot_logging_health_blockers and phase0_snapshot_logging_health_assertions above.`

Blocker codes from the forced empty-window run: `legacy_display_heights_complete`, `legacy_horizon_hours_valid`, `legacy_model_version_contract_complete`, and `legacy_recent_face_hs_rows_present`.

Postflight pre-apply failure-path refresh:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql
```

Result: expected exit `3`. Refreshed on 2026-06-20 at `2026-06-20T03:21:15Z`: since Phase 0 is not applied yet, the script printed the failed expected-object table, emitted `phase0_postflight_blockers`, rolled back, then raised `Phase 0 forecast accuracy postflight failed; see phase0_postflight_blockers and phase0_expected_objects above.`

Blocker codes from the latest pre-apply run: `missing_get_forecast_accuracy_horizon_metrics`, `missing_get_forecast_accuracy_horizon_metrics_live_baseline_columns`, `missing_get_ml_health_metrics_live_display_columns`, `missing_get_ml_weekly_metrics_live_display_columns`, `missing_idx_ml_predictions_display_horizon_source_unique`, `missing_ml_predictions_log_display_raw_input_height_m`, `missing_ml_predictions_log_display_raw_input_height_nonnegative_check`, `missing_ml_predictions_log_display_wave_source`, `missing_ml_predictions_log_display_wave_source_check`, `missing_ml_predictions_log_forecast_horizon_bucket`, `missing_sync_session_wave_observation_candidate_face_hs_source_predicate`, and `unexpected_idx_ml_predictions_beach_predicted_at_unique`.

Data-readiness pre-apply failure-path refresh:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql
```

Result: expected exit `3`. Refreshed on 2026-06-20 at `2026-06-20T03:21:15Z`: since Phase 0 is not applied yet, the script printed `phase0_data_readiness_schema_state`, reported 4 missing prerequisites (`forecast_horizon_bucket`, `display_wave_source`, `display_raw_input_height_m`, and `get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz)`), emitted blocker codes `schema_canonical_accuracy_rpc_missing`, `schema_display_raw_input_height_missing`, `schema_display_wave_source_missing`, and `schema_forecast_horizon_bucket_missing`, rolled back, then raised `Phase 0 forecast accuracy data readiness failed; see phase0_data_readiness_blockers, phase0_data_readiness_assertions, and phase0_data_readiness_schema_state above.`

Verification refresh through the app-deploy gate runner:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json
```

Result: PASS. Latest full-gate refresh on 2026-06-20 at `2026-06-20T12:32:18Z` completed focused Phase 0 Jest (9 suites, 218 tests), forecast-roadmap guard Jest (14 suites, 220 tests, including the Track C heuristic validation test), scoped ESLint over Phase 0 and forecast-roadmap script/test targets, `yarn typecheck`, `yarn typecheck:forecast-gate` (40 forecast-roadmap script/test files), `VERCEL_ENV=preview yarn build`, the read-only Phase 0 baseline harness, `--phase0-baseline` report validation, the read-only Phase 0 preflight, and the read-only snapshot logging health check. The baseline harness generated at `2026-06-20T12:32:15.395Z` and measured `2026-05-21T12:32:06.692Z` to `2026-06-20T12:32:06.692Z`; it covers 44,544 buoy rows, 29 session rows, 44,573 matched prediction rows, and 175 matched `0-72h` rows with current-display `0-72h` MAE `0.256m`. Expected pre-migration limitation remains that all 175 short-horizon rows lack stored horizon-bucket and display-replay provenance. The preflight found 76,168 canonical face-Hs display rows in the 30-day window and `can_request_phase0_migration_approval = true`; snapshot health found 2,516 recent legacy-schema rows across 318 beaches with 0 model-version mismatches, 0 invalid horizon rows, and 0 missing display heights. The runner wrote sanitized schema-v5 evidence JSON to `/tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json` with `generated_at = "2026-06-20T12:32:18.315Z"`, explicit passed `step_results`, parsed `baseline_harness`, and parsed `read_only_sql` summaries; the artifact validates with `--validate-output-json --max-evidence-age-hours 24`.

Verification refresh through the app-deploy gate runner after explicit snapshot-health failure-path hardening:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate --skip-preview-build
```

Result: PASS. Prior skip-preview refresh on 2026-06-20 at `2026-06-20T01:39:55Z` completed focused Phase 0 Jest (8 suites, 189 tests), scoped ESLint, `yarn typecheck`, the read-only Phase 0 preflight, and the read-only snapshot logging health check. The full-gate run above supersedes this as both the latest build-inclusive evidence and the latest live-count evidence.

## Production Read-Only Preflight

Latest command run on 2026-06-20 from `/Users/stevenchandler/Desktop/dev/quiver`:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-preflight.sql
```

Result: PASS after replacing the pre-migration short-horizon freshness assertion with a legacy-starvation diagnostic. The script ran inside `BEGIN READ ONLY; ... ROLLBACK;`.

Latest preflight findings:

- `ml_predictions_log.forecast_horizon_bucket`: absent, as expected before migration.
- `ml_predictions_log.display_wave_source`: absent, as expected before migration.
- `ml_predictions_log.display_raw_input_height_m`: absent, as expected before migration.
- `get_forecast_accuracy_horizon_metrics(...)`: absent, as expected before migration.
- Existing legacy unique index `idx_ml_predictions_beach_predicted_at_unique`: present.
- New horizon-aware unique index `idx_ml_predictions_display_horizon_source_unique`: absent, as expected before migration.
- Required source columns for Phase 0 metrics: all 18 checked columns are present, including `created_at` and `model_version`.
- Face-Hs display-source contract: the preflight now fails closed if current `model_version = 'face-Hs-transformer-v1'` rows are not also tagged with `display_source = 'face-Hs-transformer-v1'`, because the canonical RPC and harness intentionally filter on `display_source`. Latest refresh: 76,168 candidate rows, 76,168 canonical display-source rows, 0 mismatches.
- Duplicate risk for the new `(beach_id, predicted_at, horizon, display_source)` unique index: `0` duplicate groups, `0` duplicate rows.
- Preflight readiness summary: required columns present, new unique-index duplicate risk clear, face-Hs display-source contract clear, pre-migration schema shape clear, `phase0_preflight_blockers` empty, and `can_request_phase0_migration_approval = true`.
- The pre-migration shape check requires the legacy unique index to be present, the horizon-source unique index to be absent, the three new Phase 0 columns to be absent, and `get_forecast_accuracy_horizon_metrics(...)` to be absent. This prevents a partial or already-applied schema from returning an approval-ready flag.
- Current short-horizon logging freshness: the latest 24h has `2,516` fresh `73h+` rows but `0` fresh `0-24h` rows and `0` fresh `25-72h` rows.
- The preflight now prints `phase0_preflight_assertions_passed` and raises an explicit post-rollback Phase 0 preflight error pointing at `phase0_preflight_blockers` if `can_request_phase0_migration_approval` is false, instead of relying on raw arithmetic-error sentinels.
- The snapshot logging health check now prints `phase0_snapshot_logging_health_blockers`; latest read-only output has no blocker rows.
- Legacy uniqueness starvation: current `0-72h` forecast slots are represented by `7,632` rows that were logged as `73h+`, with `0` created in the last 24h. This is the expected limitation of the legacy `(beach_id, predicted_at)` unique key and is the reason the Phase 0 migration must replace it with horizon-aware uniqueness before data-readiness can pass.
- The machine-readable summary also flags `legacy_short_horizon_starvation_detected = true`; this is diagnostic, not an approval blocker.

Current 30-day production horizon coverage from preflight:

| Horizon | Total rows | Observed rows | Last created |
| --- | ---: | ---: | --- |
| `0-24h` | 108 | 63 | `2026-06-14 22:00:47Z` |
| `25-72h` | 192 | 112 | `2026-06-14 22:00:47Z` |
| `73h+` | 75,868 | 44,369 | `2026-06-20 12:30:30Z` |

## Current All-Beach Harness Baseline

Command run on 2026-06-20 from `/Users/stevenchandler/Desktop/dev/quiver`:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --output-json /tmp/quiver-phase0-app-deploy-gate-baseline-harness.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase0-app-deploy-gate-baseline-harness.json --phase0-baseline --max-report-age-hours 24
```

Result: PASS. Latest rerun wrote `/tmp/quiver-phase0-app-deploy-gate-baseline-harness.json` with `report_schema_version: 1` and `generated_at = "2026-06-20T12:32:15.395Z"`, then validated it with `--phase0-baseline --max-report-age-hours 24`. The refreshed report covers 44,544 buoy rows, 29 session rows, 44,573 matched prediction rows, and 175 matched `0-72h` rows; as expected before the Phase 0 migration, all 175 short-horizon rows still lack stored horizon-bucket and display-replay provenance.

Rows:

- Buoy observation rows: 44,544
- Session observation rows: 29
- Matched prediction rows: 44,573
- Matched `0-72h` rows: 175 total, 0 with stored horizon-bucket provenance, 0 with display-replay provenance.

Baseline MAE and signed bias:

| Horizon | Baseline | N | MAE (m) | Bias (m) |
| --- | --- | ---: | ---: | ---: |
| `0-24h` | Current display | 63 | 0.271 | -0.228 |
| `0-24h` | Raw display | 63 | 0.271 | -0.228 |
| `0-24h` | Raw OM | 63 | 0.339 | 0.339 |
| `0-24h` | v5 shadow | 63 | 0.260 | 0.259 |
| `25-72h` | Current display | 112 | 0.248 | -0.207 |
| `25-72h` | Raw display | 112 | 0.248 | -0.207 |
| `25-72h` | Raw OM | 112 | 0.447 | 0.447 |
| `25-72h` | v5 shadow | 112 | 0.359 | 0.359 |
| `73h+` | Current display | 44,170 | 0.562 | -0.512 |
| `73h+` | Raw display | 44,170 | 0.562 | -0.512 |
| `73h+` | Raw OM | 44,168 | 0.315 | -0.048 |
| `73h+` | v5 shadow | 44,125 | 0.310 | -0.050 |

## Known Production-State Gap

Current production logging is still dominated by `73h+` rows, though there is now a small all-beach `0-72h` baseline. Phase 1 preflight could only report a `73h+` improvement because the scoped 30 apply-gap beaches had no current `0-72h` observed rows in production:

- Phase 1 scoped result: `73h+` proposed MAE `0.287m` vs current `0.438m`, delta `-0.151m`.
- This is directional evidence only. It does not satisfy the ship gate for Phase 1 because the required `0-72h` proof depends on Phase 0 being applied and fresh short-horizon rows landing.

## Approval Checklist

Before approval:

- Rerun the read-only preflight and confirm the structural checks pass. The legacy-starvation diagnostic can still show stale current `0-72h` rows before the migration; the post-migration data-readiness gate is where fresh `0-24h` and `25-72h` rows become required.
- Review the migration and rollback.

If approved:

1. Apply `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql` through the production migration process.
2. Run `scripts/db/phase0-forecast-accuracy-postflight.sql`.
3. Run `yarn tsx scripts/forecast-accuracy-harness.ts --days 7 --truth-source both`.
4. Wait for fresh short-horizon display snapshots and observation backfill to land.
5. Run `psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql`. This is expected to fail until fresh short-horizon rows, at least 75 observed `0-72h` rows with replay provenance, and non-null canonical RPC metrics for every required `0-24h` / `25-72h` baseline exist.
6. Re-run the harness and confirm `0-24h` and `25-72h` rows appear with source-aware proposed replay available.
7. Only then re-evaluate Phase 1 and Phase 2 proposed writes through the scoped readiness report and `0-72h` metric, using `--fresh-snapshot-hours`, `--fail-on-regression`, `--fail-on-slice-regression`, `--fail-on-unmeasured-slices`, `--min-gate-samples`, and `--min-slice-samples` for approval reruns.

## Decision

Phase 0 is ready for human review as the first production gate. Phases 1-3 remain blocked from production application until Phase 0 is approved, applied, schema postflight passes, data readiness passes, and the harness can report the required `0-72h` deltas.
