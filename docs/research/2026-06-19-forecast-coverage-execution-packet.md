# Forecast Coverage Execution Packet

Date: 2026-06-19

## Current Position

The coverage roadmap is now executable one approval gate at a time:

1. Phase 0 must land first because it is the measurement gate.
2. Track C is complete as a read-only sanity check; current weights are not validated and reweighting is not ready.
3. Phase 1 is prepared but still gated on a `0-72h` delta; Phase 2 has directional `0-72h` evidence but is still blocked on Phase 0 provenance, and the full 57-beach proposal currently regresses.
4. Phase 3 produced a no-go for the naive 1-D bathymetry approach; the analog fallback now has a read-only candidate export, but it fails approval because no `0-72h` gate is measurable yet.
5. Tracks A and B are wired far enough to prove the main remaining bottleneck: face-height truth and rated-session volume, not another model.

No production write has been applied.

## Execution Order

1. Deploy Phase 0 application code with the legacy logging fallback.
2. Run the read-only deployed snapshot logging health check.
3. Get explicit human approval for the Phase 0 production migration.
4. Create the fresh `pg_dump` backup and run `scripts/phase0-migration-preapply-check.ts` against the post-deploy evidence, backup artifact, and maintainer approval phrase.
5. Apply `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql`.
6. Run `scripts/db/phase0-forecast-accuracy-postflight.sql`.
7. Wait for fresh short-horizon rows and observation backfill, then run `scripts/db/phase0-forecast-accuracy-data-readiness.sql`.
8. Rerun the accuracy harness and verify `0-24h` and `25-72h` rows with stored horizon-bucket and replay provenance.
9. Rerun Phase 1 and Phase 2 harness comparisons through the Phase 0 metric.
10. Apply Phase 1 and Phase 2 only after review of their measured `0-72h` deltas.
11. Do not build the full bathymetry pipeline from the current Phase 3 spike; keep analog transfer as a harness-only fallback candidate until Phase 0 proves a `0-72h` delta.

## Phase 0: Instrument First

Status: ready for app deploy review; production migration pending explicit human approval.

Prepared files:

- `lib/services/forecast/accuracy-metrics.ts`
- `lib/services/forecast/forecast-builder.ts`
- `lib/services/forecast/log-display-prediction.ts`
- `lib/utils/wave-height-source.ts`
- `scripts/forecast-accuracy-harness.ts`
- `scripts/forecast-accuracy-readiness-report.ts`
- `scripts/forecast-accuracy-report-validate.ts`
- `scripts/phase0-app-deploy-gate.ts`
- `scripts/diag-snapshot-writer.ts`
- `scripts/ml-stats.ts`
- `supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql`
- `supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql`
- `scripts/db/phase0-forecast-accuracy-preflight.sql`
- `scripts/db/phase0-snapshot-logging-health.sql`
- `scripts/db/phase0-forecast-accuracy-postflight.sql`
- `scripts/db/phase0-forecast-accuracy-data-readiness.sql`
- `docs/research/2026-06-19-phase0-forecast-accuracy-readiness.md`
- `docs/research/2026-06-19-phase0-migration-approval-request.md`

Phase 0 canonical metric:

- Truth: `observed_m` face height.
- Error: MAE and signed bias in meters.
- Splits: `0-24h`, `25-72h`, `73h+`.
- Baselines: current display, raw display, raw OM, v5 shadow, and proposed display when a factor proposal is supplied.
- Proposed replay: uses logged `display_wave_source` and `display_raw_input_height_m` so CDIP-only `shoaling_factors` do not get applied to model-derived heights.

Latest live read-only structural preflight passed on 2026-06-20. The preflight now reports the pre-migration short-horizon starvation shape without failing, because the legacy `(beach_id, predicted_at)` unique key is the thing Phase 0 replaces:

- `ml_predictions_log.forecast_horizon_bucket`: absent before migration, as expected.
- `ml_predictions_log.display_wave_source`: absent before migration, as expected.
- `ml_predictions_log.display_raw_input_height_m`: absent before migration, as expected.
- `get_forecast_accuracy_horizon_metrics(...)`: absent before migration, as expected.
- Legacy `(beach_id, predicted_at)` unique index: present.
- New horizon-aware unique index: absent before migration, as expected.
- Required source columns: all 18 checked columns are present, including `created_at` and `model_version`.
- Face-Hs display-source contract: preflight now fails closed if current `model_version = 'face-Hs-transformer-v1'` rows are not also tagged with `display_source = 'face-Hs-transformer-v1'`, because the canonical RPC and harness filter on `display_source`.
- The preflight now fails closed if any required source column is missing, so the migration approval path catches incompatible `ml_predictions_log` shape before apply.
- Duplicate risk for the new unique index: `0` duplicate groups, `0` duplicate rows.
- The preflight now fails closed if duplicate risk is non-zero, so the migration approval path catches a would-fail unique-index build before apply.
- The preflight now emits a machine-readable readiness summary and a stable `phase0_preflight_blockers` table. Latest live run: required columns present, duplicate risk clear, 76,228 canonical face-Hs display-source rows with 0 display-source mismatches, pre-migration schema shape clear, `phase0_preflight_blockers` empty, and `can_request_phase0_migration_approval = true`.
- The pre-migration shape check requires the legacy unique index to be present, the horizon-source unique index to be absent, the three new Phase 0 columns to be absent, and `get_forecast_accuracy_horizon_metrics(...)` to be absent. This prevents a partial or already-applied schema from returning an approval-ready flag.
- The preflight now also reports current short-horizon starvation before migration. Latest live evidence: `0` fresh `0-24h`, `0` fresh `25-72h`, and `2,521` fresh `73h+` rows in the last 24h; current `0-72h` slots are represented by `7,632` logged-`73h+` rows, with `0` created in the last 24h.
- The preflight now raises an explicit post-rollback Phase 0 preflight error pointing at `phase0_preflight_blockers` if `can_request_phase0_migration_approval` is false, instead of relying on raw arithmetic-error sentinels.
- The same summary flags `legacy_short_horizon_starvation_detected = true`; this is diagnostic and expected before the horizon-aware unique index lands.

Current 30-day horizon coverage:

| Horizon | Total rows | Observed rows | Last created |
| --- | ---: | ---: | --- |
| `0-24h` | 108 | 63 | `2026-06-14 22:00:47Z` |
| `25-72h` | 192 | 112 | `2026-06-14 22:00:47Z` |
| `73h+` | 75,928 | 44,369 | `2026-06-20 13:01:09Z` |

Proposed-set readiness preflight:

- `scripts/forecast-accuracy-readiness-report.ts` is a read-only check for proposed JSON files before spending a full approval harness run.
- It uses the same proposed JSON scope shapes as the harness: `predictions[].beach_id`, `beaches[].id`, `beaches[].slug`, and top-level beach IDs/slugs.
- It reports aggregate `0-72h` rows, approval-provenanced `0-72h` rows, per-beach `0-72h` rows, fresh scoped `0-24h` / `25-72h` snapshot coverage, missing proposed beach IDs/slugs, and whether the set is ready for the configured sample floors.
- It now supports `--fail-on-not-ready`, exiting `2` when aggregate/per-beach approval-provenanced short-horizon coverage is below the configured approval floors or fresh scoped snapshots are missing.
- The report now includes `summary.readiness_blockers` for human-readable failure reasons and `summary.readiness_blocker_codes` for stable automation. The CLI prints the blocker messages before the first blocked-beaches table, and `approval_readiness` is true only when the structured blocker list is empty.
- Readiness now requires stored `forecast_horizon_bucket` plus `display_wave_source` and `display_raw_input_height_m` provenance on `0-72h` rows, so pre-Phase-0 observations remain visible as total rows but cannot make a proposal approval-ready.
- Readiness also requires each proposed beach to have fresh approval-provenanced scoped snapshots in both `0-24h` and `25-72h` buckets. The global Phase 0 data-readiness SQL is not enough to certify a narrower proposed write set.
- The readiness reporter now uses the same replay-provenance rule as the writer, harness, and SQL gates: `display_wave_source` must be one of the shared runtime tags and `display_raw_input_height_m` must be finite and nonnegative. Non-null malformed replay columns cannot satisfy approval readiness.
- Saved readiness JSON now carries `report_schema_version: 1` plus `proposed_json_sha256`, and validates offline with `yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json <readiness.json> --expect-proposed-json <proposed.json> --max-report-age-hours 24`. Validation fails closed on stale or malformed artifacts, sensitive user/session/profile UUID leakage, count/rate shape drift, mismatched proposed JSON hashes, and summary/readiness blocker fields that do not reconcile with the report's own beach rows.
- When readiness uses session truth, linked session candidates now must carry a canonical `face-Hs-transformer-v1` snapshot display source and resolve to a canonical `face-Hs-transformer-v1` prediction before counting as approval evidence.
- Readiness is not approval. A set still needs the Phase 0 harness plus `forecast-accuracy-report-validate --approval` before any production write.
- Approval validation now requires the harness report to include `gate_slices.group_by: "beach"` so region-level slices cannot hide a regressed beach.
- Approval validation independently checks beach slice `groupKey`s against `scope.beach_ids`, so a report cannot omit a scoped beach while claiming zero unmeasured slices.
- Approval validation now recomputes gate and beach-slice verdicts from the numeric MAE deltas, so a stale or hand-edited report cannot hide a positive delta behind a `non-regressing` label or an empty `regressedSlices` list.
- Approval validation now also fails malformed numeric fields in harness evidence packets: gate sample counts must be non-negative integers, gate MAEs must be finite numbers, row counts must be non-negative integers, and slice counts/deltas must be numeric. JSON strings or nulls cannot satisfy approval gates through JavaScript coercion.
- Approval validation requires `row_counts.matched_0_72h_rows` to be present and requires the `0-72h` proposed gate sample counts to equal it, so a report cannot pass by dropping matched short-horizon rows from the gate delta.
- Approval validation requires beach-slice sample totals to equal the aggregate `0-72h` proposed gate counts, so beach-level proof cannot undercount or double-count rows relative to the approved delta.
- Approval validation also compares the report scope to the proposed JSON in approval mode, so stale or mismatched harness output cannot certify a different write set.
- Approval validation now treats top-level proposed beach configs with write fields as scope-bearing, including slug-keyed configs. Slug-keyed top-level configs must include `id`; otherwise approval fails because the write set cannot be resolved to beach IDs.
- Harness reports now carry `report_schema_version: 1`, and approval validation rejects missing or unsupported schema versions so pre-hardening harness JSON cannot certify a production write.
- Baseline harness reports now validate with `forecast-accuracy-report-validate --phase0-baseline`, which rejects stale/malformed baseline packets, proposed-artifact packets, missing truth/measurement contracts, missing canonical `0-24h` / `25-72h` / `73h+` metric rows, missing canonical `0-72h` gate metrics, and all-beach baselines below the configured short-horizon sample floor. This is separate from `--approval`: baseline validation proves Phase 0 can measure the current system; approval validation proves a proposed write does not regress it.
- The harness report records `proposed_json_sha256`, and approval validation compares it to the current proposed JSON artifact, so same-path or same-scope edits cannot reuse stale MAE evidence.
- Approval mode enforces proposed JSON hash/scope binding inside the validator itself, including programmatic callers; it is not only a CLI default.
- Approval mode now defaults the CLI to `--min-gate-samples 75`, `--min-slice-samples 25`, and `--max-report-age-hours 24`; programmatic approval validation also fails if those sample/freshness constraints are absent or zero.
- Approval validation now rejects stale measured windows: `range.end` must be within the allowed report-age window of `generated_at`, so a freshly regenerated report cannot certify old Phase 0 data.
- Approval validation now also requires the harness report to record that it was generated with `--fail-on-regression`, `--fail-on-slice-regression`, and `--fail-on-unmeasured-slices`; soft harness runs are not approval artifacts.
- Phase 1 proposed exports now record `source_migration_sha256`, `source_validated_json`, and `source_validated_json_sha256`, and approval validation checks those hashes against the current source files when present. A harness report can no longer certify one proposed JSON while a later SQL or validated-factor edit silently changes the write artifact.
- Approval-subset generation preserves `source_migration` / `source_migration_sha256` and `source_validated_json` / `source_validated_json_sha256` metadata on narrowed proposed artifacts and rejects source reports whose proposed artifact has a stale source hash.
- Approval-subset generation rejects source proposed artifacts without an explicit `approval_policy`, and can validate a full source harness generated with a stricter aggregate gate floor than the narrowed subset floor while still enforcing the subset policy minimums.
- Approval-subset generation now selects narrowed beach candidates by numeric `deltaMaeM <= 0`, not by the slice verdict label alone, so a stale `non-regressing` label cannot pull a positive-delta beach into a write candidate.
- Approval-subset generation also requires selected slice sample counts to be real non-negative integers, so direct callers cannot select a slice with string-coerced counts.
- Approval-subset output now treats any top-level object with proposed beach write fields as write-bearing, including slug-keyed configs, and drops it unless it resolves to a selected beach ID. The CLI also fails if the final proposed output is missing a selected ID or retains an unselected ID.
- The harness and shared TS metrics now prefer stored `forecast_horizon_bucket` over recomputing from hours, so approval row counts and exact proposed snapshot matching use the same frozen issue-time bucket as the database.
- The harness report now records matched `0-72h` rows with and without stored horizon-bucket provenance, and approval validation rejects reports that rely on recomputed short-horizon buckets instead of logged `forecast_horizon_bucket`.
- The harness report now records matched `0-72h` rows with and without display-replay provenance, and approval validation rejects reports with any short-horizon row missing `display_wave_source` or `display_raw_input_height_m`.
- Harness reports now include a `truth_contract` declaring that session truth requires canonical `face-Hs-transformer-v1` display-source links, and approval validation rejects session/both truth reports that lack that contract. A pre-hardening session-truth report cannot certify a write.
- The runtime `WaveHeightSourceTag` allowlist is now centralized in `lib/utils/wave-height-source.ts`; the display writer and accuracy harness consume the shared set, and the Phase 0 migration test asserts every runtime tag is accepted by the `ml_predictions_log.display_wave_source` CHECK constraint.
- Phase 0 data-readiness, snapshot-logging health, Phase 1 preflight/write guards, and the Monterey Bay Phase 2 preflight now centralize replay-source checks through local `allowed_wave_sources` CTEs.
- The SQL tests verify every approval-gate CTE against the runtime `WaveHeightSourceTag` tuple while rejecting reintroduced ad hoc `display_wave_source IN/NOT IN (...)` lists in those scripts, so approval SQL cannot drift from the writer/harness source contract unnoticed.
- Harness replay provenance now requires `display_wave_source` to be one of those shared runtime tags and `display_raw_input_height_m` to be finite, so an unknown non-null source string cannot satisfy approval row counts while the replay falls back to a generic model source.
- Phase 0 also requires nonnegative `display_raw_input_height_m`: the writer drops negative raw inputs, the harness excludes them from replay-provenance counts, the readiness SQL treats them as missing replay provenance, and the migration adds a nonnegative CHECK constraint.
- Phase 1 and the Monterey Bay Phase 2 SQL gates now use the same approval-provenance rule: stored short-horizon bucket, allowed runtime wave-source tag, and nonnegative replay raw input. Their preflight/write guards cannot count malformed replay rows toward approval.
- Approval-subset generation validates its source report against the same proposed JSON hash/scope binding, hard harness flags, horizon-bucket provenance, replay provenance, sample floor, and report-age constraints before emitting a narrowed proposed artifact. It also rejects narrowed subsets whose selected beach slices do not meet the configured aggregate gate sample floor. It still allows regressed or unmeasured source slices because those are intentionally excluded from the narrowed write set.
- Phase 0 postflight now verifies the dashboard RPC bodies for `get_ml_weekly_metrics` and `get_ml_health_metrics` are on live display snapshot columns instead of retired error columns.
- Phase 0 postflight now also verifies the deployed `sync_session_wave_observation_candidate(...)` body contains the `display_source = 'face-Hs-transformer-v1'` predicate, so stale session truth matching cannot pass schema postflight.
- Phase 0 postflight now emits `phase0_postflight_blockers` with stable blocker codes and fails with an explicit post-rollback Phase 0 postflight error before running migrated-schema-only metric RPC checks when the migration is not live. Latest pre-apply read-only run refreshed on 2026-06-20 at `2026-06-20T03:21:15Z` exits `3` after printing blockers: `missing_get_forecast_accuracy_horizon_metrics`, `missing_get_forecast_accuracy_horizon_metrics_live_baseline_columns`, `missing_get_ml_health_metrics_live_display_columns`, `missing_get_ml_weekly_metrics_live_display_columns`, `missing_idx_ml_predictions_display_horizon_source_unique`, `missing_ml_predictions_log_display_raw_input_height_m`, `missing_ml_predictions_log_display_raw_input_height_nonnegative_check`, `missing_ml_predictions_log_display_wave_source`, `missing_ml_predictions_log_display_wave_source_check`, `missing_ml_predictions_log_forecast_horizon_bucket`, `missing_sync_session_wave_observation_candidate_face_hs_source_predicate`, and `unexpected_idx_ml_predictions_beach_predicted_at_unique`.

Current readiness checks on 2026-06-20:

| Proposed set | Beaches | Approval `0-72h` rows | Total `0-72h` rows | Ready beaches | Unmeasured beaches | Approval readiness |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Phase 1 validated shoaling gap | 30 | 0 / 75 | 0 | 0 | 30 | not ready |
| Phase 2 Monterey Bay terrain subset | 3 | 0 / 75 | 75 | 0 | 0 | blocked by missing horizon-bucket and replay provenance |
| Phase 3 analog fallback | 47 | 0 / 75 | 0 | 0 | 47 | not ready |

Current Phase 2 readiness artifact:

- `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`
- Refreshed on 2026-06-20 at `2026-06-20T12:44:55.518Z`; `--fail-on-not-ready` exits `2`.
- Saved-artifact validation passes with `yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json --expect-proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json --max-report-age-hours 24`.
- Proposed JSON hash: `338ea539011c5a282dc22b8bdddb962caa2b2f00c9a317542d133959b92c4bdc`.
- Gate `0-72h` rows: 75 total, 0 approval-provenanced, 0 with stored horizon-bucket provenance, 0 replayable, 75 missing horizon-bucket provenance, and 75 missing replay provenance.
- Fresh scoped snapshots: 0 approval-provenanced `0-72h` rows in the last 24h; all 3 Monterey Bay beaches are missing both `0-24h` and `25-72h` fresh snapshot buckets.

Current all-beach harness baseline, truth source `both`, refreshed on 2026-06-20 with `/tmp/quiver-phase0-app-deploy-gate-baseline-harness.json` (`report_schema_version: 1`, generated at `2026-06-20T13:20:00.232Z`, measured `2026-05-21T13:19:49.083Z` to `2026-06-20T13:19:49.083Z`). The saved report validates with `yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase0-app-deploy-gate-baseline-harness.json --phase0-baseline --max-report-age-hours 24`:

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
| `73h+` | Current display | 44,398 | 0.561 | -0.512 |
| `73h+` | Raw display | 44,398 | 0.561 | -0.512 |
| `73h+` | Raw OM | 44,396 | 0.315 | -0.049 |
| `73h+` | v5 shadow | 44,353 | 0.310 | -0.050 |

Important deployment constraint:

- Deploy the app code first. `logDisplayPredictions(...)` now falls back to the legacy `(beach_id, predicted_at)` conflict target while the new Phase 0 columns/index are absent.
- App-deploy review now has a single read-only runner: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn phase0:app-deploy-gate`. It requires Node 22, runs focused Phase 0 Jest, forecast-roadmap guard Jest for Phase 1/2/3 and Track A/B/C proof tests, scoped ESLint over Phase 0 and forecast-roadmap script/test targets, `yarn typecheck`, `yarn typecheck:forecast-gate`, `VERCEL_ENV=preview yarn build`, the read-only Phase 0 baseline harness plus `--phase0-baseline` validation, the read-only Phase 0 preflight, and the read-only snapshot logging health check. The forecast-script typecheck fails if any configured target path is missing, so the runner cannot silently lose script coverage when files move. Use `--print-only` to inspect the exact commands before running them; use `--output-json <path>` to write a sanitized, schema-v5 step-level run record with parsed `baseline_harness`, embedded baseline measured range, and `read_only_sql` summaries and without persisting the production Postgres URL or raw SQL output; use `--validate-output-json <path>` to verify the saved packet's schema version, pass status, per-step `status: "passed"` results, Node 22 version, full-gate shape, validated baseline proof, embedded baseline freshness, embedded baseline measured-range freshness, parsed SQL proof, top-level evidence freshness, and credential sanitization before approval review. Validation defaults to requiring preview build + baseline harness + read-only SQL and a 24-hour max evidence age; partial smoke artifacts require `--allow-partial-gate-evidence` and are not approval evidence. Migration approval must use post-deploy saved evidence that validates with `--require-deploy-start-utc`, so pre-deploy evidence cannot certify the migration apply step; the validator also rejects a deploy timestamp later than the evidence `generated_at` timestamp.
- `scripts/phase0-migration-preapply-check.ts` is the local final check before applying the Phase 0 migration. It requires post-deploy gate evidence that validates with `--require-deploy-start-utc`, a fresh nonempty backup artifact, and the exact maintainer approval phrase. It does not execute SQL or apply the migration.
- Fresh full-preview app-deploy gate evidence on 2026-06-20 at `2026-06-20T13:20:03Z`: `yarn phase0:app-deploy-gate --output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json` passed focused Phase 0 Jest (10 suites, 222 tests), forecast-roadmap guard Jest (14 suites, 220 tests), scoped ESLint over Phase 0 and forecast-roadmap script/test targets, `yarn typecheck`, `yarn typecheck:forecast-gate` (42 forecast-roadmap script/test files), `VERCEL_ENV=preview yarn build`, the live baseline harness, `--phase0-baseline` report validation, the live read-only Phase 0 preflight, and the live read-only snapshot logging health check. The baseline harness generated at `2026-06-20T13:20:00.232Z` and measured `2026-05-21T13:19:49.083Z` to `2026-06-20T13:19:49.083Z`; it covers 44,544 buoy rows, 29 session rows, 44,573 matched prediction rows, and 175 matched `0-72h` rows, with 0/175 carrying stored horizon-bucket provenance and 0/175 carrying replay provenance before the Phase 0 migration. Current-display `0-72h` MAE is `0.256m`. The preflight returned `can_request_phase0_migration_approval = true`, an empty `phase0_preflight_blockers` table, and 76,228 canonical face-Hs display rows in the 30-day window. Snapshot health found 2,521 recent legacy-schema rows across 318 beaches with 0 model-version mismatches, 0 invalid horizon rows, and 0 missing display heights. The schema-v5 evidence JSON was generated at `2026-06-20T13:20:03.612Z`, includes parsed `baseline_harness` and `read_only_sql` summaries, and validates with `yarn phase0:app-deploy-gate --validate-output-json /tmp/quiver-phase0-app-deploy-gate-20260620-current-refresh.json --max-evidence-age-hours 24`. The same pre-deploy artifact intentionally fails `--require-deploy-start-utc` validation with `deploy_start_utc_required`.
- Prior full-preview app-deploy gate evidence passed the same gate before Track C schema-v4 artifact hardening. The latest full-preview evidence above supersedes it.
- Prior `--skip-preview-build` gate evidence on 2026-06-20 at `2026-06-20T01:39:55Z` also passed focused Phase 0 Jest (8 suites, 189 tests), scoped ESLint, `yarn typecheck`, live read-only Phase 0 preflight, and live read-only snapshot logging health. The latest full-preview gate above now supersedes it as both build-inclusive evidence and live-count evidence.
- The pre-migration snapshot logging health check now also fails closed unless recent legacy-schema rows are canonical `face-Hs-transformer-v1` rows with valid 0-168h horizons and complete display heights. Latest default-window refresh found 2,521 rows across 318 beaches with 0 model-version mismatches, 0 invalid horizon rows, 0 missing display heights, and an empty `phase0_snapshot_logging_health_blockers` table.
- The snapshot logging health check now raises an explicit post-rollback Phase 0 health error instead of relying on a raw arithmetic-error sentinel. It also emits `phase0_snapshot_logging_health_blockers` so deploy-health automation can read failed blocker codes directly; a forced empty-window read-only run exited `3` after rollback with `Phase 0 snapshot logging health failed; see phase0_snapshot_logging_health_blockers and phase0_snapshot_logging_health_assertions above.` Blocker codes: `legacy_display_heights_complete`, `legacy_horizon_hours_valid`, `legacy_model_version_contract_complete`, and `legacy_recent_face_hs_rows_present`.
- After the migration, the same snapshot logging health check also requires fresh `0-24h` and `25-72h` rows with Phase 0 provenance, so a migrated writer that only logs `73h+` rows cannot be mistaken for a healthy measurement path.
- The snapshot logging health check now fails closed on partial Phase 0 schema, so columns/indexes from a half-applied migration cannot fall through to the legacy health branch.
- `logDisplayPredictions(...)` now drops rows missing `display_wave_source` or `display_raw_input_height_m` before writing, so one malformed replay-provenance row cannot poison the Phase 0 data-readiness window.
- Rerun the Phase 0 preflight after the app deployment/logging path is healthy. Before the migration, it can still report legacy short-horizon starvation; after migration, the separate data-readiness SQL fails until fresh `0-24h` and `25-72h` face-Hs rows exist with replay provenance.
- Apply the migration second. If the migration lands before the prepared app code, the old writer can miss measurement rows after the legacy unique index is dropped.
- Schema postflight is not enough to unblock Phases 1-3. The data-readiness SQL must also pass after fresh rows land; it fails until short-horizon snapshots have stored horizon buckets and replay provenance, the last 30 days include at least 75 observed `0-72h` rows with both provenance fields, and the canonical RPC returns non-null `0-24h` / `25-72h` metrics for every required baseline.
- The data-readiness SQL computes an effective horizon bucket from stored bucket first, then `forecast_horizon_hours`, so rows missing stored `forecast_horizon_bucket` stay visible and fail the bucket-provenance assertions instead of disappearing from the gate.
- The data-readiness SQL now schema-checks Phase 0 columns and `get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz)` before running migrated-schema-only data checks. It also emits `phase0_data_readiness_blockers` for stable automation. Latest pre-apply read-only run refreshed on 2026-06-20 at `2026-06-20T03:21:15Z` exited `3` after `ROLLBACK`, reporting blocker codes `schema_canonical_accuracy_rpc_missing`, `schema_display_raw_input_height_missing`, `schema_display_wave_source_missing`, and `schema_forecast_horizon_bucket_missing`, then raising `Phase 0 forecast accuracy data readiness failed; see phase0_data_readiness_blockers, phase0_data_readiness_assertions, and phase0_data_readiness_schema_state above.`

## Track C: Match Heuristic Validation

Status: complete as a read-only sanity check; production reweighting is not
ready. The validator defaults to prior-only history, so production-readiness
scoring cannot use sessions that happened after the rated target session. The
same run now also emits an RPC-floor same-user diagnostic that uses one
prior same-break-type sample, plus a broad cohort diagnostic that uses other
users' same-break-type leave-one-out ratings to sanity-check more of the rating
set without weakening the strict prior-history gate.
The JSON artifact now separates the deployed heuristic verdict, broad cohort
sanity check, RPC-floor diagnostics, and reweighting readiness:
`currentHeuristicValidation` asks whether the current weights are supported by
strict prior-history ratings, `rpcFloorDiagnostic` shows how much same-user
signal is scoreable at the RPC's one-positive-sample floor while marking it
`productionEvidence: false`, `cohortSanityCheck` makes the broader
leave-one-out cohort diagnostic machine-readable while marking it
`productionEvidence: false`, and `reweightingReadiness` asks whether the sample
is large enough to nominate a reviewed experiment. The gate blocks emit stable
`findingCodes`, so Track C's gate can be consumed by automation without
scraping human-readable finding text.
The saved JSON now carries `reportSchemaVersion: 4`, `measurementWindow`, a
validated `rpcFloorDiagnostic`, deterministic user-level `reweightingHoldout`,
and a non-production cohort sanity block. `--validate-output-json` fails closed
on stale/missing schema version, missing/malformed RPC-floor evidence,
RPC-floor loaded-sample mismatches, missing/malformed holdout evidence,
malformed counts/correlations, drifted current weights, stale reports,
stale/missing/future/inconsistent measurement windows, UUID-bearing aggregate
output, hand-edited cohort sanity evidence that does not match the cohort
diagnostic, any artifact that marks diagnostic evidence as production evidence,
or any artifact that claims reweighting is production-ready.
The Track C unit test now also parses the latest `compute_user_match_score_core`
migration and fails if the validator's reported current weights drift from the
RPC's base-distance weights.

Prepared files:

- `scripts/validate-match-score-heuristic.ts`
- `scripts/__tests__/validate-match-score-heuristic.test.ts`
- `docs/research/2026-06-18-match-score-heuristic-validation.md`
- `/tmp/quiver-match-score-heuristic-validation-20260620-refresh.json` after rerun and validation
- `/tmp/quiver-match-score-heuristic-validation-20260620-gated-refresh.json` after gated rerun and validation

Findings:

| Rating inventory stage | Sessions | Users |
| --- | ---: | ---: |
| Raw completed rated sessions | 62 | 17 |
| Real-profile rated sessions | 45 | 15 |
| Loaded sessions with forecast snapshots | 45 | 15 |

Attrition: 17 sessions are excluded by the real-profile filter, 0 real-profile
rated sessions are missing forecast snapshots, 1 loaded session is missing a
complete component set, and the prior-history requirement leaves 5 scored
sessions from 1 user.

| Metric | Value |
| --- | ---: |
| Rated sessions loaded | 45 |
| Users loaded | 15 |
| Complete-component sessions | 44 |
| Prior-history scored sessions | 5 |
| Scored users represented | 1 |
| Pearson(score, rating) | -0.891 |
| Spearman(score, rating) | -0.447 |

RPC-floor same-user diagnostic from the same read-only rerun:

| Metric | Value |
| --- | ---: |
| RPC-floor scored sessions | 12 |
| RPC-floor scored users represented | 2 |
| Pearson(score, rating) | -0.408 |
| Spearman(score, rating) | -0.370 |

The RPC-floor diagnostic is marked `productionEvidence: false`; it uses the
RPC's one-positive-sample floor to show near-cold-start same-user signal
coverage, but it does not weaken the strict production-readiness gate.

Broad cohort diagnostic from the same read-only rerun:

| Metric | Value |
| --- | ---: |
| Cohort scored sessions | 36 |
| Cohort scored users represented | 11 |
| Pearson(score, rating) | -0.164 |
| Spearman(score, rating) | -0.159 |

Broad cohort component Pearson: wave `-0.061`, period `-0.024`, wind speed
`-0.203`, tide `0.080`, wind direction `-0.183`. The best diagnostic grid
Pearson is `0.080` with 100% tide weight, which is below the readiness
threshold and is not production evidence.

Cohort sanity check:

| Criterion | Threshold | Observed | Status |
| --- | ---: | ---: | --- |
| Cohort scored sessions | 100 | 36 | fail |
| Cohort scored users represented | 25 | 11 | fail |
| Cohort current-weight Pearson | 0.200 | -0.164 | fail |

Cohort sanity verdict: `insufficient-signal`; `productionEvidence: false`.
Cohort sanity finding codes: `cohort_not_production_evidence`,
`cohort_scored_sessions_floor`, `cohort_scored_users_floor`, and
`cohort_current_weight_pearson_floor`.

Current-heuristic validation gate:

| Criterion | Threshold | Observed | Status |
| --- | ---: | ---: | --- |
| Prior-history scored sessions | 100 | 5 | fail |
| Scored users represented | 25 | 1 | fail |
| Current-weight Pearson | 0.200 | -0.891 | fail |

Current heuristic verdict: `not-validated`. The deployed weights are not
supported by the current prior-history rating sample.
Current heuristic finding codes: `current_scored_sessions_floor`,
`current_scored_users_floor`, and `current_weight_pearson_floor`.

Reweighting readiness gate:

| Criterion | Threshold | Observed | Status |
| --- | ---: | ---: | --- |
| Prior-history scored sessions | 100 | 5 | fail |
| Scored users represented | 25 | 1 | fail |
| Best diagnostic grid Pearson | 0.200 | 0.152 | fail |

Gate verdict: `not-ready`. The validator writes this in
`reweightingReadiness` and exits `2` when run with `--fail-on-not-ready`.
Reweighting finding codes: `scored_sessions_floor`, `scored_users_floor`,
`best_grid_pearson_floor`, and `holdout_grid_pearson_unavailable`.

Conclusion:

- Fresh read-only rerun on 2026-06-20 at `2026-06-20T12:27:42.831Z` refreshed and validated the non-gated schema-v4 JSON artifact with measurement window `2025-06-20T12:27:42.831Z` to `2026-06-20T12:27:42.831Z`. The gated artifact refreshed at `2026-06-20T12:27:49.213Z` with measurement window `2025-06-20T12:27:49.213Z` to `2026-06-20T12:27:49.213Z`, still exits `2` under `--fail-on-not-ready`, validates with the saved-report validator, and records `currentHeuristicValidation.verdict = "not-validated"`, `rpcFloorDiagnostic.productionEvidence = false`, `cohortSanityCheck.verdict = "insufficient-signal"` with `productionEvidence: false`, and `reweightingReadiness.verdict = "not-ready"` with machine-readable current, cohort sanity, and reweighting finding codes. The diagnostic grid has no held-out user signal: 5 train sessions from 1 user, 0 holdout sessions, 0 holdout users, and holdout Pearson `n/a`.
- Current weights are negatively aligned with observed ratings in the tiny prior-history scored sample.
- The RPC-floor same-user diagnostic also has negative current-weight Pearson across 12 scoreable sessions.
- The broader cohort diagnostic also has a weak negative current-weight Pearson across 36 scored sessions.
- After non-real profiles are excluded, no current component has a strong positive signal; tide is weakly positive in the broad cohort diagnostic only.
- Do not ship a learned reweighting from this data; rerun after Track B materially increases rated-session volume.
- Even a reviewed reweighting experiment stays blocked until the readiness gate passes.

## Phase 1: Apply Validated Shoaling Factors

Status: migration prepared; not ready to apply until Phase 0 can prove the `0-72h` delta.

Prepared files:

- `supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql`
- `scripts/phase1-shoaling-proposed-export.ts`
- `scripts/db/phase1-shoaling-apply-gap-preflight.sql`
- `scripts/db/phase1-shoaling-apply-gap-postflight.sql`
- `__tests__/migrations/phase1-shoaling-apply-gap.test.ts`
- `scripts/__tests__/phase1-shoaling-proposed-export.test.ts`
- `docs/research/2026-06-18-shoaling-apply-gap-preflight.md`

Live read-only structural scope check refreshed on 2026-06-20:

- Active beaches: 318
- Active beaches with `shoaling_factors`: 87
- Validated active target rows still missing in prod: 30
- Rows that would update: 30
- Already populated target rows: 0
- Missing/deleted target rows: 0
- Current SQL preflight now fails closed until the same 30-beach target set has at least 75 approval-provenanced `0-72h` rows, every target beach has at least 25 approval-provenanced `0-72h` rows, and no scoped short-horizon observed row is missing stored horizon-bucket or display-replay provenance.
- Fresh live read-only production rerun on 2026-06-20 still exits `3` after `ROLLBACK` with an explicit Phase 1 preflight error because Phase 0 has not added the required schema/RPC objects yet. `phase1_phase0_schema_readiness` reports `forecast_horizon_bucket`, `display_wave_source`, `display_raw_input_height_m`, and `get_forecast_accuracy_horizon_metrics(...)` absent; target scope remains 30 active rows, 30 would update, 0 already populated, 0 missing/deleted. It emits `phase1_preflight_blockers` before raising. Current blocker codes: `all_targets_approval_0_72h_rows_at_least_25`, `approval_0_72h_rows_at_least_75`, and `phase1_phase0_schema_ready`. This is fail-closed; rerun it after Phase 0 schema postflight. The mutating migration also now requires the explicit session token `app.phase1_shoaling_apply_gap_approved = '2026-06-18-phase1-shoaling-apply-gap-approved'` before it prepares target rows.
- Fresh live read-only postflight rerun before applying Phase 1 exits `3` after `ROLLBACK` with an explicit Phase 1 postflight error. It emits `phase1_postflight_blockers` before raising. Current production remains at 87 active beaches with `shoaling_factors`; the 30 target rows are still active but 0/30 are populated and 0/30 have valid `period_lookup` payloads. Blocker codes: `active_shoaling_coverage_at_least_117`, `all_target_rows_populated`, and `all_target_rows_valid_period_lookup`.

Fresh readiness refresh on 2026-06-20 after Phase 1 guard hardening:

- Proposed export regenerated from `supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql`: 30 target beach configs at `2026-06-20T12:37:53.424Z`, with `artifact_schema_version: 1`.
- The proposed export now validates the 30 SQL rows against the 117-row
  `../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json`
  source before writing. It also validates the source migration's semantic
  write guards before accepting the artifact: explicit human approval token,
  Phase 0 schema/RPC requirement, Phase 0 measurement guard, 75 aggregate and
  25-per-beach approval-provenanced `0-72h` sample floors, no missing Phase 0
  provenance, null-only `shoaling_factors` updates, exact 30-row update guard,
  and no destructive/table-shape SQL. Latest `/tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json`
  source bindings:
  - `source_migration_sha256`: `41ba2bfb5b876c442732459bcbffeaa1cd7c86240716b198de2f321ab1769ada`
  - `source_validated_json_sha256`: `e6e90f4de9e27ae64ff327a2135333e0eb7b4413baddcc125f90697638cfb387`
  - `source_validated_count`: `117`
  - `source_validated_rows_matched`: `30`
- Saved proposed artifact validation passes with `yarn tsx scripts/phase1-shoaling-proposed-export.ts --validate-output-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json --max-artifact-age-hours 24`.
- `scripts/forecast-accuracy-readiness-report.ts --fail-on-not-ready` exited `2`, as expected.
- Latest readiness artifact `/tmp/quiver-phase1-shoaling-gap-readiness-20260620-current-refresh.json` validates against the new proposed JSON. Readiness range: `2026-05-21T12:38:14.306Z` to `2026-06-20T12:38:14.306Z`; JSON generated at `2026-06-20T12:38:16.018Z`.
- Proposed JSON hash: `8af1917459207c539763f34b7b67590ad72610c00c60a469f651087c20243cfa`.
- Approval-provenanced `0-72h` rows: `0 / 75`; total scoped `0-72h` rows: `0`.
- Scoped `73h+` evidence: `5,377` rows total, split `5,373` buoy rows and `4` session rows.
- Fresh scoped snapshots: `0` approval-provenanced `0-72h` rows in the last 24h; all 30 targets are missing both `0-24h` and `25-72h` fresh snapshot buckets.
- Beach readiness: `0` ready, `0` insufficient, `30` unmeasured.
- Readiness blocker codes: `gate_sample_floor`, `beach_sample_floor`, `fresh_snapshot_missing_bucket`.
- Readiness blocker messages: approval-provenanced `0-72h` rows `0` below gate floor `75`; ready beaches `0` below resolved beach count `30`; fresh scoped snapshots missing required buckets for `30` beaches.

Current harness evidence for the 30 target beaches:

| Horizon | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| `73h+` | 5,377 | 5,377 | 0.281m | 0.423m | -0.142m |

Gate:

- The Phase 1 scoped data currently has only `73h+` observed rows.
- The Phase 1 SQL preflight is expected to exit non-zero until approval-provenanced short-horizon evidence exists for both the aggregate set and every proposed beach slice.
- Because this migration applies all 30 rows, the SQL preflight now requires at least 25 approval-provenanced `0-72h` rows per target beach before approval. If only a subset reaches that floor, generate a narrowed migration instead of applying all 30.
- The strict approval harness exits `2` because no proposed `0-72h` gate delta is available. The approval validator exits `2` on the matching strict artifact with the Phase 1 policy floors (`75` aggregate, `25` per-beach), reporting missing proposed `0-72h` gate verdict/slices, missing beach slice group keys for all 30 scoped beaches, 30 unmeasured proposed `0-72h` slices, and inability to verify the per-beach slice sample floor.
- This is promising directional evidence, but it does not satisfy the ship gate.
- Apply only after Phase 0 produces a non-regressing `0-72h` face-height MAE delta for the same proposed factors.
- The prepared migration now fails inside the transaction unless the Phase 0 columns and canonical metric RPC exist, the same 30-beach target set clears the approval-provenanced `0-72h` aggregate/per-beach sample floors, every scoped short-horizon row has stored horizon-bucket and display-replay provenance, and exactly 30 rows are updated. These guards now raise explicit measurement or row-count exceptions instead of raw arithmetic errors. Drift after preflight cannot silently produce a partial or unmeasurable 87→117 claim.

## Phase 2: Terrain Gap Fill

Status: dry-run and proposed export complete. The full 57-beach write fails the current `0-72h` gate and must not apply as-is; the 3-beach Monterey Bay subset is directionally non-regressing but not approval-ready until Phase 0 provenance exists.

Prepared files:

- `scripts/terrain-analysis.ts`
- `scripts/forecast-accuracy-approval-subset.ts`
- `scripts/terrain-filter-proposed-export.ts`
- `scripts/terrain/cli.ts`
- `scripts/terrain/database.ts`
- `scripts/terrain/proposed-export.ts`
- `scripts/terrain/types.ts`
- `scripts/terrain/write-guard.ts`
- `scripts/terrain/README.md`
- `scripts/terrain/__tests__/database.test.ts`
- `scripts/terrain/__tests__/proposed-export.test.ts`
- `scripts/terrain/__tests__/write-guard.test.ts`
- `scripts/__tests__/forecast-accuracy-approval-subset.test.ts`
- `scripts/db/phase2-terrain-gap-preflight.sql`
- `scripts/db/phase2-terrain-gap-postflight.sql`
- `scripts/db/phase2-terrain-monterey-bay-preflight.sql`
- `scripts/db/phase2-terrain-monterey-bay-postflight.sql`
- `__tests__/scripts/phase2-terrain-gap-sql.test.ts`
- `docs/research/2026-06-19-terrain-gap-preflight.md`

Live read-only SQL preflight passed on 2026-06-20:

- Active beaches: 318
- Active beaches missing terrain status or factor arrays: 57
- Active beaches with terrain status and factor arrays: 261
- Active beaches with 72-bin wind and swell arrays: 261
- Active invalid factor lengths: 0
- Fresh live read-only global postflight rerun before any Phase 2 write exits `3` after `ROLLBACK` with an explicit Phase 2 terrain postflight error. It prints all 57 remaining gap rows before failing, so the broad postflight remains diagnostic while still fail-closed.

Dry-run evidence:

- `yarn terrain:analyze --missing-only --dry-run --concurrency=4 --output-json=/tmp/quiver-phase2-terrain-proposed-20260620-current-refresh.json`
- Found 57 active terrain gaps.
- Loaded 57 beaches.
- Successful: 57
- Failed: 0
- Skipped: 0
- No Supabase writes performed.
- Proposed artifact generated at `2026-06-20T12:42:23.854Z`.
- Proposed artifact includes `approval_policy.status = "phase0_required"`, `production_write_allowed = false`, `required_gate = "0-72h"`, `required_metric = "face_height_mae"`, `min_gate_samples = 75`, `min_slice_samples = 25`, and `max_report_age_hours = 24`.
- Terrain proposed exports now carry `artifact_schema_version: 1` and validate with `yarn terrain:analyze --validate-output-json <proposed.json> --max-artifact-age-hours 24`; malformed or stale proposed artifacts fail before readiness, harness, subset, or write-guard work proceeds.

Phase 0 harness evidence for the exported 57-beach proposal:

| Horizon | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| `0-24h` | 63 | 63 | 0.202m | 0.271m | -0.069m |
| `25-72h` | 112 | 112 | 0.367m | 0.248m | +0.119m |
| `73h+` | 5,724 | 5,724 | 0.302m | 0.475m | -0.173m |
| `0-72h gate` | 175 | 175 | 0.308m | 0.256m | +0.052m |

Current verdict: regressed. Do not apply the full 57-beach terrain write as-is.

Regional slice verdict:

| Region | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Monterey Bay | 75 | 75 | 0.195m | 0.431m | -0.236m | non-regressing |
| Monterey Peninsula | 100 | 100 | 0.392m | 0.125m | +0.267m | regressed |

Beach-level approval failures:

| Beach | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Lovers Point | 25 | 25 | 0.374m | 0.229m | +0.145m | regressed |
| Spanish Bay / South Moss Beach | 25 | 25 | 0.369m | 0.087m | +0.282m | regressed |
| Asilomar State Beach | 25 | 25 | 0.369m | 0.086m | +0.283m | regressed |
| Carmel Beach | 25 | 25 | 0.457m | 0.100m | +0.357m | regressed |

Beach-slice coverage: 7/57 proposed beaches measured, 50/57 currently unmeasured at `0-72h`.

Machine-readable full-export report:

- `/tmp/quiver-phase2-terrain-full-beach-harness-20260620-current-refresh.json`
- Scope: 57 beaches
- Gate verdict: regressed, delta `+0.052m`
- Regressed beach slices: 4
- Unmeasured beach slices: 50
- Proposed JSON hash: `834c64614870bde1b56e90304746e308581aabc992c089f1818042fbdce0a44e`
- Truth and measurement contracts are present in the report.
- Current Phase 0 provenance state: `175/175` matched `0-72h` rows lack stored `forecast_horizon_bucket`, and `175/175` lack `display_wave_source` + `display_raw_input_height_m` replay provenance.
- Auto approval-subset selector: `scripts/forecast-accuracy-approval-subset.ts` validates this hard-gated beach-level report plus the full proposed JSON before emitting a narrowed artifact. It currently refuses to emit `/tmp/quiver-phase2-terrain-auto-approval-subset-current.json` because the source report lacks Phase 0 horizon-bucket and replay provenance.

Monterey Bay approval candidate:

| Beach | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Del Monte Beach | 25 | 25 | 0.140m | 0.608m | -0.468m | non-regressing |
| Marina State Beach | 25 | 25 | 0.234m | 0.374m | -0.140m | non-regressing |
| Moss Landing | 25 | 25 | 0.210m | 0.311m | -0.101m | non-regressing |

Machine-readable Monterey Bay report:

- `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`
- Scope: 3 beaches
- Gate verdict: non-regressing, delta `-0.236m`
- Regressed beach slices: 0
- Unmeasured beach slices: 0
- Fresh exact-ID proposed export: `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`
- Fresh exact-ID proposed JSON hash: `338ea539011c5a282dc22b8bdddb962caa2b2f00c9a317542d133959b92c4bdc`
- Fresh proposed artifact validation: passes with `yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json --max-artifact-age-hours 24`.
- Fresh readiness artifact: `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`, generated at `2026-06-20T12:44:55.518Z`, validates against the proposed JSON, and still exits `2` under `--fail-on-not-ready`.
- Fresh harness range: `2026-05-21T12:45:09.928Z` to `2026-06-20T12:45:09.928Z`
- Fresh harness row counts: 137 buoy rows, 0 session rows, 137 matched prediction rows, 75 matched `0-72h` rows, 137 proposed rows compared, 0 rows without proposed values.
- Horizon-bucket provenance: 0/75 `0-72h` rows have stored `forecast_horizon_bucket`; 75/75 rely on recomputed buckets because the Phase 0 schema has not landed in production.
- Replay provenance: 0/75 `0-72h` rows have `display_wave_source` + `display_raw_input_height_m`; 75/75 lack replay provenance because the Phase 0 schema has not landed in production.
- Report validator: exits `2` under `--approval --expect-proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 3`.
- Approval blockers: `Matched 0-72h rows without replay provenance 75 exceeds 0`, `0-72h rows with replay provenance 0 is below proposed gate sample count 75`, `Matched 0-72h rows without horizon-bucket provenance 75 exceeds 0`, and `0-72h rows with horizon-bucket provenance 0 is below proposed gate sample count 75`.
- `--approval` now requires proposed JSON scope matching by default; `--expect-proposed-json` still pins the exact file path when reviewing a named candidate artifact.
- The stale auto approval subset at `/tmp/quiver-phase2-terrain-auto-approval-subset.json` is no longer a valid write artifact under the tightened source-report validation, because the current source report cannot prove Phase 0 provenance.
- Sample-floor verdict: aggregate `0-72h` N meets `--min-gate-samples 75`; each beach slice meets `--min-slice-samples 25`

Scoped production preflight passed structurally read-only on 2026-06-19 before the approval-provenance assertion was added:

- Active beaches: 318
- Active with status and factor arrays: 261
- Expected Monterey Bay target rows: 3
- Expected active targets found: 3
- Rows that would update: 3
- Target invalid factor lengths: 0
- Observed 30-day short-horizon rows at that time: `0-24h` 27 observed, `25-72h` 48 observed
- Fresh live read-only production rerun on 2026-06-20 still exits `3` through explicit assertions because `forecast_horizon_bucket`, `display_wave_source`, `display_raw_input_height_m`, and `get_forecast_accuracy_horizon_metrics(...)` are absent in production. Target scope remains 3 active Monterey Bay terrain gaps, 3 would update, 0 already complete, 0 invalid factor lengths.
- Fresh live read-only scoped preflight rerun on 2026-06-20 exits `3` after `ROLLBACK`: the scoped preflight reports 3 active Monterey Bay terrain gaps, all 3 would update, all 4 Phase 0 schema/RPC prerequisites missing, and 0 approval-provenanced rows because the schema branch is skipped. It emits `phase2_monterey_bay_preflight_blockers` before raising. Current blocker codes: `all_targets_approval_0_72h_rows_at_least_25`, `approval_0_72h_rows_at_least_75`, and `phase2_monterey_bay_phase0_schema_ready`.
- Fresh live read-only scoped postflight rerun on 2026-06-20 before any Monterey Bay write exits `3` after `ROLLBACK` with `phase2_monterey_bay_postflight_blockers`. The diagnostic table shows all 3 target beaches active but 0 complete, 0 with 72-bin terrain arrays, and active terrain coverage still 261/318. Current blocker codes: `active_terrain_coverage_at_least_264`, `all_targets_complete`, `all_targets_have_72_bin_wind_and_swell`, and `all_targets_use_dem_horizon_v1`.
- After Phase 0 lands, the same preflight still requires at least 75 approval-provenanced `0-72h` rows across the 3-beach set, at least 25 approval-provenanced `0-72h` rows per target beach, and zero scoped short-horizon observed rows missing stored horizon-bucket or display-replay provenance.

Do not run the write yet. After the Phase 0 schema is applied and fresh `0-72h` rows with stored horizon buckets and replay provenance land, rerun the readiness report, the harness, and `forecast-accuracy-report-validate --approval`. If that approval validation passes and the user explicitly approves the write, run only:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-preflight.sql
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848 --concurrency=3 --human-approval-token=2026-06-19-phase2-terrain-write-approved --approval-report-json=/tmp/<fresh-validator-passing-phase2-monterey-bay-harness>.json --approval-proposed-json=/tmp/<fresh-validator-passing-phase2-monterey-bay-proposed>.json --min-approval-gate-samples=75 --min-approval-slice-samples=25 --max-approval-report-age-hours=24
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-postflight.sql
```

Expected coverage change if all three writes succeed: 261/318 to 264/318 active beaches with terrain factors.

Gate:

- Terrain coverage can rise from 261/318 to 264/318 with the current directional Monterey Bay candidate only after Phase 0 horizon-bucket/replay-provenance approval passes and the user explicitly approves the write.
- Non-dry-run terrain analysis now refuses to write unless it is exact-ID scoped, `--missing-only`, not `--force`, and backed by matching `--approval-report-json` and `--approval-proposed-json` artifacts. Before any DB update, the recomputed terrain result for each approved beach must match the approved proposed artifact's terrain method, params hash, status, and 72-bin wind/swell factor arrays exactly.
- Keep Monterey Peninsula and the other unvalidated/no-short-horizon terrain gaps out of the first write.

## Phase 3: Bathymetry Spike

Status: complete, no-go for the naive 1-D pipeline. Analog transfer is preflighted as a read-only fallback candidate, not approved for production.

Prepared files in `seaside`:

- `scripts/bathymetry_shoaling_spike.py`
- `tests/test_bathymetry_shoaling_spike.py`
- `docs/bathymetry-shoaling-feasibility-2026-06-19.md`

Prepared files in `quiver`:

- `scripts/analog-shoaling-proposed-export.ts`
- `scripts/__tests__/analog-shoaling-proposed-export.test.ts`
- The analog export now stamps top-level `approval_policy.status = "harness_only"` with the exact Phase 0 approval requirements, and each proposed beach carries `approval_status = "harness_only"` plus `source_quality = "analog_transfer_unvalidated"`.
- Donor calibration source is preserved as `donor_calibration_source`, while the target proposal's `calibration.source` is overwritten to `analog_transfer_unvalidated` so the JSON cannot be mistaken for empirical validation metadata.

Spike result:

| Metric | Value |
| --- | ---: |
| Overall median absolute factor delta | 0.200 |
| Target median absolute factor delta | 0.150 |
| Overall mean absolute factor delta | 0.231 |
| CUDEM transect samples | 0 |
| Global fallback transect samples | 60 |

Fresh live read-only schema-v1 rerun on 2026-06-20 wrote `/tmp/quiver-bathymetry-shoaling-feasibility-20260620-current-refresh.md` and `/tmp/quiver-bathymetry-shoaling-feasibility-20260620-current-refresh.json`; the result is unchanged: generated at `2026-06-20T12:53:33.748548+00:00`, 5 beaches, overall median absolute factor delta `0.200` vs target `0.150`, overall mean absolute factor delta `0.231`, 0 CUDEM transect samples, 60 global fallback samples, and verdict `no-go`. The saved JSON validates with `python3.11 scripts/bathymetry_shoaling_spike.py --validate-output-json /tmp/quiver-bathymetry-shoaling-feasibility-20260620-current-refresh.json --max-report-age-hours 24`; SHA-256 is `0245c205bb31f8b6474247d26cbda348b8cff9b6d862a71dd41299bc937f213b`.

Focused Phase 3 pytest coverage now explicitly locks two roadmap requirements:

- `depth_limited_factor(...)` changes under different tide heights, so tide is a first-class depth input.
- `closeout_proxy(...)` flags steep, depth-capped inner profiles as elevated close-out risk.
- Newly generated bathymetry JSON artifacts carry `report_schema_version: 1` and validate offline with `python3.11 scripts/bathymetry_shoaling_spike.py --validate-output-json <report.json> --max-report-age-hours 24`.
- Saved-artifact validation rejects stale or malformed reports, summary delta drift, bathymetry source-count drift, and hand-edited `go` verdicts that are not supported by the recomputed delta/source gates.
- Fresh focused pytest rerun on 2026-06-20 passed `12` tests in `tests/test_bathymetry_shoaling_spike.py`.

Decision:

- Do not build the full bathymetry-generated `shoaling_factors` pipeline from this version.
- The next best off-CDIP fallback is analog transfer from nearby calibrated beaches with similar break type and exposure, but only through the Phase 0 harness until it has short-horizon proof.
- If bathymetry continues, it needs better nearshore DEM coverage, beach geometry, directional refraction, and break-type handling.

Analog fallback preflight:

| Metric | Value |
| --- | ---: |
| Active beaches loaded | 318 |
| Calibrated donors | 87 |
| Uncalibrated targets | 231 |
| Medium-or-better proposed analogs | 47 |
| High-confidence analogs | 13 |
| Medium-confidence analogs | 34 |
| Skipped targets | 184 |

Candidate distribution:

| Region | Proposed analogs |
| --- | ---: |
| Orange County | 21 |
| Los Angeles | 19 |
| Santa Barbara | 4 |
| Central Coast | 2 |
| San Diego | 1 |

Fresh analog export generated at `2026-06-20T10:23:39.971Z` to `/tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json`; it carries `artifact_schema_version: 1`, validates with `yarn tsx scripts/analog-shoaling-proposed-export.ts --validate-output-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json --max-artifact-age-hours 24`, and now rejects overlapping or out-of-order period buckets before readiness or harness runs. Focused Jest coverage now passes `15` tests in `scripts/__tests__/analog-shoaling-proposed-export.test.ts`.

Fresh 30-day hard-gated harness result for the same 47-candidate proposed set (`/tmp/quiver-analog-shoaling-harness-20260620-phase3-refresh.json`):

| Horizon | Proposed N | Current MAE | Proposed MAE | Delta MAE |
| --- | ---: | ---: | ---: | ---: |
| `73h+` | 8,247 | 0.499m | 0.317m | -0.182m |

Approval result:

- `forecast-accuracy-report-validate --approval` exits `2`.
- Missing proposed `0-72h` gate verdict.
- Missing proposed `0-72h` gate slices.
- Beach slice group keys do not match report scope because every proposed beach is missing measurable `0-72h` slices.
- All 47 proposed analog beaches are unmeasured at `0-72h`.
- Readiness artifact `/tmp/quiver-analog-shoaling-readiness-20260620-phase3-refresh.json` generated at `2026-06-20T10:23:56.844Z`: `0 / 75` approval-provenanced `0-72h` rows, 0 ready beaches, and 47 unmeasured beaches. Saved-artifact validation passes against `/tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json`.
- Harness artifact `/tmp/quiver-analog-shoaling-harness-20260620-phase3-refresh.json` generated at `2026-06-20T10:24:12.169Z`: 8,239 buoy rows, 8 session rows, 8,247 matched prediction rows, 8,247 proposed rows compared, and 0 rows without proposed values. The hard-gated harness exits `2` because no proposed `0-72h` gate delta is available; non-approval report validation passes.
- Current phase3-refresh proposed JSON hash: `e2aca3100fa5e0d134435697d7590995130d0805089b2b57318d418a69103ec7`.
- Do not convert the analog export into a write migration until fresh Phase 0 rows prove a non-regressing `0-72h` delta.
- If analog factors ever become production candidates, preserve the separate confidence/source semantics instead of representing analog transfer as calibrated truth.

## Track A: Face-Height Truth Stream

Status: session truth verified, harness-wired, and saved-artifact validated; opt-in Surfline parity benchmark now registers and passes; continuous Surfline benchmark cadence remains a human policy decision.

Prepared files:

- `scripts/forecast-accuracy-harness.ts`
- `scripts/session-face-height-truth-report.ts`
- `scripts/__tests__/session-face-height-truth-report.test.ts`
- `scripts/db/track-a-session-truth-relinkability.sql`
- `__tests__/scripts/session-truth-relinkability-sql.test.ts`
- `e2e/api/surfline-parity.spec.ts`
- `package.json`
- `docs/research/2026-06-18-session-face-height-truth-stream.md`
- `/tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json` after rerun

Findings:

- Fresh read-only schema-v2 rerun on 2026-06-20 at `2026-06-20T12:59:52.249Z` still exits `2` under `--fail-on-not-ready`.
- The saved JSON artifact validates with `yarn tsx scripts/session-face-height-truth-report.ts --validate-output-json /tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json --max-report-age-hours 24`; validation fails closed on stale artifacts, stale measurement windows, missing schema version, malformed counts/rates, UUID leakage, positive-label horizon sections that do not reconcile to top-level counts, unmatched-positive diagnostics that do not reconcile to unmatched/non-canonical counts, and readiness blocks that are not derived from the report's own counts, criteria, and freshness window. Current artifact SHA-256: `d53c82072b3b6cce0b1201276ae2de047130a4a31922c68cac57cb8997702fba`.
- Native `sessions.wave_height_ft` is user-confirmed perceived face height, not a forecast echo. Native validation and the session insert payload builder now both fail closed unless the surfer touched the wave-height field.
- Session weak labels are mirrored through `session_wave_observation_candidates`.
- Session weak-label matching now only considers `display_source = 'face-Hs-transformer-v1'` prediction rows, then tie-breaks same-slot snapshots toward the shortest forecast horizon.
- The session-truth harness and Track A report now also require linked candidate rows to resolve to the same canonical `face-Hs-transformer-v1` display source before they count as matched truth; legacy or unknown display-source links remain visible but cannot satisfy readiness.
- The harness supports `--truth-source buoy`, `--truth-source session`, and `--truth-source both`.
- `yarn jest scripts/__tests__/session-face-height-truth-report.test.ts --runInBand` passed after schema-v2 horizon/diagnostic reconciliation hardening: 1 suite, 24 tests.
- Prior harness and relinkability verification with `yarn jest scripts/__tests__/session-face-height-truth-report.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts __tests__/scripts/session-truth-relinkability-sql.test.ts --runInBand` passed: 3 suites, 71 tests.
- Last 365-day Track A report found 53 accepted positive weak labels and 29 matched positive labels.
- Track A now reports positive label coverage by horizon, separating unlinked labels and non-canonical linked labels from canonical matches. Schema-v2 saved-artifact validation requires those horizon rows to reconcile to the top-level positive/linked/non-canonical/matched/unmatched counts and `matchedPositiveByHorizon`.
- Track A now also reports unmatched-positive diagnostics by reason, horizon, and source. Schema-v2 saved-artifact validation requires those diagnostics to reconcile to unmatched and non-canonical counts. Current real-user read-only output shows all 24 unmatched positives are `unlinked_prediction` cases, split 22 `73h+`, 1 `unknown`, and 1 `0-24h`; source split is 21 `backfill` and 3 `trigger`, with 0 non-canonical linked positives.
- Latest read-only relinkability SQL refreshed on 2026-06-20 at `2026-06-20T12:59:52Z` after the Track A rerun confirms 0/24 unmatched positives have a canonical `face-Hs-transformer-v1` prediction within +/-6h, including 0 relinkable `0-72h` labels. Source split is 21 `backfill` and 3 `trigger`; a no-op rematch will not recover them until canonical prediction rows exist near those sessions.
- Matched positive labels currently span 18 beaches and 14 users.
- Matched positive labels are still all `73h+`, with complete display/raw OM/v5 snapshots.
- Matched positive labels currently have 100% reported-height consistency: 29/29 rows have `observed_m` matching `reported_wave_height_ft` within `0.010 m`.
- Track A now emits a `readiness` block and supports `--fail-on-not-ready`.
- Track A readiness now emits `readiness.findingCodes` alongside human-readable `readiness.findings`, so automation can distinguish total weak-label volume, short-horizon truth volume, snapshot completeness, consistency, echo-risk, and freshness blockers without parsing prose.
- Track A readiness now requires matched positive beach/user diversity: default floors are 10 matched beaches and 10 matched users.
- Track A readiness now requires reported-height consistency, so corrupt or manually patched `observed_m` values cannot satisfy the truth gate unless they still match the user-reported face-height label.
- Track A readiness now includes a forecast-echo risk guard: matched weak labels that exactly match the display-height snapshot within `0.05 ft` cannot exceed 25%, so forecast-prefilled values cannot quietly satisfy the truth gate.
- Track A readiness now also requires a fresh matched `0-72h` weak label: default latest-label age must be `<=30` days, so old or long-horizon-only session truth cannot certify the face-height truth stream.
- Current Track A readiness is `not-ready`: 29 matched labels vs 100 required, 0 matched `0-72h` labels vs 75 required, 18 matched beaches vs 10 required, 14 matched users vs 10 required, snapshot completeness 100%, reported-height consistency 100%, display-height echo risk 6.9% vs the 25% ceiling, latest matched positive observed at `2026-06-19T16:40:00.000Z`, and no matched `0-72h` label for freshness proof. Current finding codes are `matched_positive_candidates_floor`, `short_horizon_matched_candidates_floor`, and `short_horizon_freshness_missing`.
- The opt-in Surfline parity command now uses the correct Playwright path (`api/surfline-parity.spec.ts`) and an explicit empty Surfline browser storage state, so it runs without requiring `e2e/.auth/state.json`.
- Latest Surfline parity run passed 7/7 checks against six fixed Quiver/Surfline beach mappings. Observed midpoint deltas were 0.30ft Blacks, 0.60ft Windansea-vs-Blacks, 3.40ft Huntington Southside, 2.40ft Huntington Pier-vs-Northside, 2.70ft Huntington Northside, and 3.10ft The Wedge, all within the spec's loose external sanity thresholds.

Current positive label coverage by horizon:

| Horizon | Positive labels | Linked | Unlinked | Non-canonical linked | Canonical matched | Unmatched |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `0-24h` | 1 | 0 | 1 | 0 | 0 | 1 |
| `25-72h` | 0 | 0 | 0 | 0 | 0 | 0 |
| `73h+` | 51 | 29 | 22 | 0 | 29 | 22 |
| `unknown` | 1 | 0 | 1 | 0 | 0 | 1 |

Current 30-day session-truth harness, generated at `2026-06-20T12:59:52.599Z` with `/tmp/quiver-track-a-session-truth-harness-20260620-current-refresh.json` and validated with `forecast-accuracy-report-validate --max-report-age-hours 24`:

| Horizon | Baseline | N | MAE (m) | Bias (m) |
| --- | --- | ---: | ---: | ---: |
| `73h+` | Current display | 29 | 0.389 | -0.237 |
| `73h+` | Raw OM | 29 | 0.355 | 0.126 |
| `73h+` | v5 shadow | 29 | 0.366 | 0.072 |

Remaining gap:

- Session truth exists but volume is too low.
- Current production still lacks enough `0-72h` session/buoy rows for scoped coverage claims before Phase 0 lands.
- The immediate Track A shape is now explicit: `0-24h` has one positive weak label but no canonical prediction within the current +/-6h matching window, `25-72h` has no positive weak labels, canonical matched session truth remains entirely `73h+`, and the freshness guard has no matched `0-72h` label to evaluate.

## Track B: Session-Acquisition Instrumentation

Status: funnel report complete and saved-artifact validated; native instrumentation prepared but not deployed.

Prepared files:

- `lib/analytics/event-taxonomy.ts`
- `types/implicit-preferences.ts`
- `scripts/session-acquisition-funnel-report.ts`
- `scripts/__tests__/session-acquisition-funnel-report.test.ts`
- `__tests__/api/events-taxonomy-characterization.test.ts`
- `supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql`
- `scripts/db/track-b-session-acquisition-event-preflight.sql`
- `scripts/db/track-b-session-acquisition-event-postflight.sql`
- `__tests__/migrations/track-b-session-acquisition-event.test.ts`
- `docs/research/2026-06-19-session-acquisition-funnel.md`
- `docs/research/2026-06-20-track-b-session-acquisition-event-approval-request.md`
- `/tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json` after rerun

Native instrumentation files:

- `quiver-native/src/lib/analytics.ts`
- `quiver-native/src/__tests__/analytics.test.ts`
- `quiver-native/src/lib/session-form-utils.ts`
- `quiver-native/src/__tests__/session-form-utils.test.ts`
- `quiver-native/src/screens/session-form.tsx`
- `quiver-native/src/__tests__/session-form-screen.test.tsx`
- `quiver-native/src/__tests__/native-first-open.test.ts`

Native verification:

- `session_log_beach_selected` is allowlisted and lifted to `user_events.beach_id`.
- `session_log_conditions_set` is allowlisted in web/native analytics and added to the web implicit-preference weight table with a zero weight.
- `quiver-native/src/screens/session-form.tsx` now emits `session_log_conditions_set` once per form after explicit wave height, wave quality, and crowd-level feedback.
- Signed-in native analytics now stamps stored events with `app_version` and `app_build`, preferring `expo-application` standalone runtime metadata before Expo constants, so Track B can verify build adoption before diagnosing client-specific drop-off.
- Route-prefilled and manually selected beaches are covered by native session-form tests.
- Conditions completion tracking is covered by native session-form tests.
- The Track B event CHECK migration now has read-only preflight/postflight scripts with machine-readable blocker tables and a hash-bound approval request. Latest production preflight refreshed by `2026-06-20T12:55:32Z` exited `0`: `public.user_events` exists, `user_events_event_type_check` exists, `session_log_conditions_set` is not yet allowed, `migration_needed=true`, `can_request_track_b_event_migration_approval=true`, and `track_b_event_preflight_blockers` is empty. The pre-apply postflight refreshed in the same pass still exits `3` with `session_log_conditions_set_not_allowed` and 0 stored `session_log_conditions_set` rows, confirming the migration has not been applied.
- The Track B event CHECK migration now also fails before mutating `public.user_events` unless the same database session sets `app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved'` after explicit human approval.
- Running the postflight before apply exits `3`, as expected, because `session_log_conditions_set` is not accepted by the live CHECK constraint yet and no `session_log_conditions_set` rows exist. It now emits `track_b_event_postflight_blockers` with `session_log_conditions_set_not_allowed` before raising.
- `yarn test:unit --runTestsByPath __tests__/migrations/track-b-session-acquisition-event.test.ts` passed after approval-token hardening: 1 suite, 4 tests.
- The refreshed Phase 0 app-deploy gate above passed the forecast-roadmap guard Jest set, including the Track A truth report test, Track B migration test, session-acquisition funnel report test, Track C heuristic validation test, and Phase 2 terrain write-guard human-token test: 14 suites, 220 tests.
- `npm test -- --runInBand src/__tests__/analytics.test.ts src/__tests__/session-form-utils.test.ts src/__tests__/session-form-screen.test.tsx` passed in `quiver-native`: 3 suites, 107 tests.
- `npm test -- --runInBand src/__tests__/native-first-open.test.ts` passed in `quiver-native`: 1 suite, 3 tests.
- `npm test -- --runInBand` passed in `quiver-native`: 338 suites passed, 4 skipped; 2871 tests passed, 21 skipped.
- `npx eslint --no-warn-ignored --max-warnings=0 lib/analytics/event-taxonomy.ts types/implicit-preferences.ts scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts` passed.
- `yarn typecheck` passed in `quiver`.
- `npm run typecheck` passed in `quiver-native`.
- Apply `supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql` before deploying a native build that emits `session_log_conditions_set`; otherwise stored analytics inserts can be rejected by `user_events_event_type_check`. The guarded apply command is:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved';" -f supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-postflight.sql
```

30-day funnel findings:

| Metric | Count |
| --- | ---: |
| Stored session-log event rows | 274 |
| Saved completed sessions | 31 |
| Rated completed sessions | 31 |
| Face-height truth sessions | 31 |
| Rated face-height truth sessions | 31 |
| Users with 5+ rated sessions in lifetime scope | 4 |

Conclusion:

- The real bottleneck remains session acquisition.
- The last 30 days produced 70 new real profiles but only 14 users with a rated session.
- Only 4 scoped users have reached the 5-rated-session threshold needed for stronger personalization and held-out session-fit evaluation.
- Track B now emits a `readiness` block and supports `--fail-on-not-ready`.
- Track B readiness now emits `readiness.findingCodes` alongside human-readable `readiness.findings`, so automation can distinguish volume floors, telemetry coverage gaps, recent-window gaps, build-metadata gaps, and expected-build adoption gaps without parsing prose.
- The Track B saved JSON now carries `reportSchemaVersion: 2` and validates with `yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --max-report-age-hours 24`; validation fails closed on stale artifacts, stale measured or recent-telemetry windows, missing schema version, malformed counts/rates, UUID leakage, non-canonical validation-failure code evidence, validation-failure actor counts above event counts, validation-failure platform totals that do not reconcile to event counts, and readiness blocks that are not derived from the report's own counts, criteria, telemetry coverage, expected build list, and recent telemetry window. Current artifact SHA-256: `91b61351d5f130d17286f838879fb1f6418e32e6ccd484f5461652c339fa6292`.
- The readiness gate now also requires submit-event coverage, so durable saved sessions remain the conversion source but missing `session_log_submit` / `first_session_logged` telemetry cannot be mistaken for a complete funnel.
- The readiness gate now also requires conditions-set coverage, so a user reaching explicit surf-condition feedback is measured separately from merely starting the form or setting a rating.
- The readiness gate now also requires recent app version/build metadata coverage, so a native beach-selected gap cannot be treated as client-specific behavior until current instrumented builds are visible in telemetry.
- When the recent telemetry window is narrower than the report window, the readiness gate now also requires recent beach-selected, conditions-set, and submit-event coverage to clear the same floors, so stale broader-window telemetry cannot mask a newly broken instrumented build.
- The readiness gate now accepts optional `--expect-recent-client-build platform,version,build` checks. Current native config is app version `1.0.1`, iOS build `11`, and Android versionCode `11`; the latest read-only expected-build run at `2026-06-20T12:55:32.462Z` found 0 recent starts for `native-ios / 1.0.1 / 11` and 0 recent starts for `native-android / 1.0.1 / 11`, while recent starts remain `unknown-version / unknown-build`.
- The readiness gate counts face-height truth for personalization only when the same saved session has both `rating` and `wave_height_ft`, so disjoint rating-only and height-only rows cannot satisfy the floor.
- The funnel report now includes `Telemetry Coverage By Platform`, which separates native/web client instrumentation from the aggregate actor funnel. Current read-only output shows `native-ios` at 0.0% beach-selected coverage across 34 start actors and `native-android` at 0.0% across 1 start actor.
- The funnel report now also includes a configurable recent telemetry window. Latest 7-day read-only output generated at `2026-06-20T12:55:32.462Z` shows 125 event rows, 24 unique start actors, 24 unique start actors without version/build metadata, 0.0% beach-selected coverage, 0.0% conditions-set coverage, and 37.5% submit-event-of-start coverage. Recent platform split: `native-ios` 24 starts at 0.0% beach-selected / 0.0% conditions-set / 33.3% submit-of-start, and `native-android` 1 start at 0.0% beach-selected / 0.0% conditions-set / 100.0% submit-of-start. Recent client-build split shows `native-ios / unknown-version / unknown-build` with 24 starts and `native-android / unknown-version / unknown-build` with 1 start, so the current traffic still predates signed-in build metadata. This keeps the beach-selected and conditions-set gaps classified as instrumentation/deploy-adoption, not product abandonment.
- The funnel report now also includes aggregate `Validation Failure Codes`, sanitized to the native `SessionFormErrorCode` allowlist. Drifted stable-looking codes are grouped as `unknown_code:*`, raw prose is grouped as `unrecognized`, schema-v2 saved-artifact validation requires those sanitized codes plus internally consistent event/actor/platform counts, and current read-only output shows `wave_quality_required` (9 actors), `crowd_level_required` (8 actors), and `rating_required` (7 actors) as the top validation blockers.
- Current Track B readiness is `not-ready`: 31 rated sessions vs 100 required, 14 rated users vs 25 required, 4 users with 5+ rated sessions vs 25 required, 31 rated face-height truth sessions vs 75 required, 0.0% beach-selected coverage vs 80% required, 0.0% conditions-set coverage vs 80% required, 0.0% recent beach-selected coverage vs 80% required, 0.0% recent conditions-set coverage vs 80% required, 37.5% recent submit-event coverage vs 80% required, and 0.0% recent build metadata coverage vs 80% required. Broad-window submit-event coverage still clears the gate at 100.0%, but no longer hides the recent-window submit gap. Fresh schema-v2 read-only rerun on 2026-06-20 at `2026-06-20T12:55:32.462Z` still exits `2` under `--fail-on-not-ready`; current finding codes are `rated_sessions_floor`, `rated_session_users_floor`, `five_rated_session_users_floor`, `rated_face_height_truth_sessions_floor`, `beach_selected_coverage_floor`, `conditions_set_coverage_floor`, `recent_beach_selected_coverage_floor`, `recent_conditions_set_coverage_floor`, `recent_submit_event_coverage_floor`, `recent_build_metadata_coverage_floor`, and `expected_recent_client_build_missing`.

## Approval Gates Remaining

Phase 0:

- Approve app deployment with logging fallback.
- Approve production migration.
- Run schema postflight after migration.
- Run data-readiness after fresh short-horizon rows and observation backfill land.
- Run the harness after data-readiness passes.

Phase 1:

- Re-run proposed-factor harness after Phase 0 has enough short-horizon rows.
- Approve production migration only if `0-72h` face-height MAE is non-regressing.
- The migration also self-guards on Phase 0 column/RPC presence plus 30-day approval-provenanced `0-72h` sample floors, so applying it before measurement is live should fail and roll back.

Phase 2:

- Re-run proposed terrain comparison scoped to the exported beach IDs.
- Do not approve the current full 57-beach write: it regresses the `0-72h` gate by +0.052m MAE.
- Do not approve the full 57-beach write by beach slice: Lovers Point, Spanish Bay / South Moss Beach, Asilomar State Beach, and Carmel Beach regress, and 50 proposed beaches are unmeasured at `0-72h`.
- Monterey Bay is the current measured, non-regressing narrowed candidate: 3 beaches, delta -0.236m MAE, 75 total short-horizon rows, and 0 approval-provenanced short-horizon rows. Rerun readiness after Phase 0 logging before treating it as approval-ready.
- `forecast-accuracy-report-validate --approval` requires `gate_slices.group_by: "beach"`; region-only reports are not approval evidence.
- `forecast-accuracy-report-validate --approval` requires beach slice `groupKey`s to cover exactly the report scope beach IDs.
- `forecast-accuracy-report-validate --approval` also requires report scope to match the proposed JSON write set.
- `forecast-accuracy-report-validate --approval` also requires the report's `proposed_json_sha256` to match the proposed JSON artifact under review.
- `forecast-accuracy-report-validate --approval` also requires `report_schema_version: 1`, so stale pre-hardening harness reports are not approval evidence.
- `forecast-accuracy-report-validate --approval` also requires the report's `approval_gates` metadata to prove the harness was run with the hard fail flags.
- `forecast-accuracy-report-validate --approval` also requires `row_counts.matched_0_72h_rows` and every matched `0-72h` row in the report to include stored horizon-bucket provenance and display-replay provenance, so pre-Phase-0 rows cannot certify a write.
- `forecast-accuracy-report-validate --approval` also requires positive aggregate/per-beach sample floors and a positive report-age limit; the CLI defaults are `75`, `25`, and `24h`.
- Approve only a narrowed terrain write that is non-regressing, or an explicitly accepted measured tradeoff.

Phase 3:

- No production gate. The current spike says do not proceed with the naive bathymetry pipeline.
- Analog transfer has a candidate export, but the current approval validator blocks it because there is no `0-72h` evidence.

Track B:

- Apply `supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql` only after explicit approval with the hash-bound phrase in `docs/research/2026-06-20-track-b-session-acquisition-event-approval-request.md`.
- Run `scripts/db/track-b-session-acquisition-event-postflight.sql` after the approved apply.
- Deploy or verify the instrumented native build, then rerun the Track B funnel report with expected-build checks.

## Commands To Run At Each Gate

Phase 0 pre-apply:

```bash
source ~/.nvm/nvm.sh && nvm use 22
yarn test:unit --runTestsByPath lib/services/forecast/__tests__/accuracy-metrics.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts lib/services/forecast/__tests__/log-display-prediction.test.ts lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts __tests__/migrations/phase0-forecast-accuracy-metrics.test.ts
yarn typecheck
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-preflight.sql
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --output-json /tmp/quiver-phase0-baseline-harness.json
yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase0-baseline-harness.json --phase0-baseline --max-report-age-hours 24
```

Phase 0 post-apply:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql
yarn tsx scripts/session-face-height-truth-report.ts --days 365 --output-json /tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both
```

The data-readiness command is expected to fail before the Phase 0 migration because the required columns/RPC are absent. Its current pre-apply blocker codes are `schema_canonical_accuracy_rpc_missing`, `schema_display_raw_input_height_missing`, `schema_display_wave_source_missing`, and `schema_forecast_horizon_bucket_missing`. After the migration, it is expected to keep failing until the new writer has produced fresh `0-24h` and `25-72h` rows, every short-horizon candidate has stored horizon-bucket and replay provenance, and the 30-day window has at least 75 observed `0-72h` rows with both provenance fields.

Phase 1 pre-apply:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase1-shoaling-apply-gap-preflight.sql
yarn test:unit --runTestsByPath __tests__/migrations/phase1-shoaling-apply-gap.test.ts scripts/__tests__/phase1-shoaling-proposed-export.test.ts
yarn tsx scripts/phase1-shoaling-proposed-export.ts --output-json /tmp/quiver-phase1-shoaling-gap-proposed.json
yarn tsx scripts/phase1-shoaling-proposed-export.ts --validate-output-json /tmp/quiver-phase1-shoaling-gap-proposed.json --max-artifact-age-hours 24
yarn tsx scripts/forecast-accuracy-readiness-report.ts --proposed-json /tmp/quiver-phase1-shoaling-gap-proposed.json --output-json /tmp/quiver-phase1-shoaling-gap-readiness-report.json --truth-source both --min-gate-samples 75 --min-beach-samples 25 --fresh-snapshot-hours 24 --fail-on-not-ready
yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/quiver-phase1-shoaling-gap-readiness-report.json --expect-proposed-json /tmp/quiver-phase1-shoaling-gap-proposed.json --max-report-age-hours 24
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --beach-ids <30-gap-beach-ids> --proposed-json /tmp/quiver-phase1-shoaling-gap-proposed.json --truth-source both --group-by beach --output-json /tmp/quiver-phase1-shoaling-gap-harness-report.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase1-shoaling-gap-harness-report.json --approval --expect-proposed-json /tmp/quiver-phase1-shoaling-gap-proposed.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 30 --max-report-age-hours 24
```

Phase 1 post-apply:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase1-shoaling-apply-gap-postflight.sql
```

Phase 2 pre-apply:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-gap-preflight.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-preflight.sql
yarn test:unit --runTestsByPath __tests__/scripts/phase2-terrain-gap-sql.test.ts scripts/terrain/__tests__/database.test.ts scripts/terrain/__tests__/proposed-export.test.ts
yarn terrain:analyze --missing-only --dry-run --concurrency=4 --output-json=/tmp/quiver-phase2-terrain-proposed.json
yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-proposed.json --max-artifact-age-hours 24
yarn tsx scripts/forecast-accuracy-readiness-report.ts --proposed-json /tmp/quiver-phase2-terrain-proposed.json --output-json /tmp/quiver-phase2-terrain-readiness-report.json --truth-source both --min-gate-samples 175 --min-beach-samples 25 --fresh-snapshot-hours 24 --fail-on-not-ready
yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/quiver-phase2-terrain-readiness-report.json --expect-proposed-json /tmp/quiver-phase2-terrain-proposed.json --max-report-age-hours 24
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-proposed.json --group-by region --output-json /tmp/quiver-phase2-terrain-full-region-harness-report.json --fail-on-regression --fail-on-slice-regression --min-gate-samples 175 --min-slice-samples 75
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-proposed.json --group-by beach --output-json /tmp/quiver-phase2-terrain-full-beach-harness-report.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 175 --min-slice-samples 25
yarn tsx scripts/forecast-accuracy-approval-subset.ts --report-json /tmp/quiver-phase2-terrain-full-beach-harness-report.json --proposed-json /tmp/quiver-phase2-terrain-proposed.json --output-json /tmp/quiver-phase2-terrain-auto-approval-subset.json --min-gate-samples 75 --min-slice-samples 25 --max-report-age-hours 24
yarn tsx scripts/terrain-filter-proposed-export.ts --input-json /tmp/quiver-phase2-terrain-proposed.json --output-json /tmp/quiver-phase2-terrain-monterey-bay-approved-subset.json --beach-ids a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848
yarn terrain:analyze --missing-only --beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848 --dry-run --concurrency=3 --output-json=/tmp/quiver-phase2-terrain-monterey-bay-proposed.json
yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-proposed.json --max-artifact-age-hours 24
yarn tsx scripts/forecast-accuracy-readiness-report.ts --proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed.json --output-json /tmp/quiver-phase2-terrain-monterey-bay-readiness-report.json --truth-source both --min-gate-samples 75 --min-beach-samples 25 --fresh-snapshot-hours 24 --fail-on-not-ready
yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-readiness-report.json --expect-proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed.json --max-report-age-hours 24
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed.json --group-by beach --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-monterey-bay-approved-subset.json --group-by beach --output-json /tmp/quiver-phase2-terrain-monterey-bay-harness-report.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase2-terrain-monterey-bay-harness-report.json --approval --expect-proposed-json /tmp/quiver-phase2-terrain-monterey-bay-approved-subset.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 3 --max-report-age-hours 24
```

Current Monterey Bay rerun on 2026-06-20:

- Full 57-beach dry-run export: `/tmp/quiver-phase2-terrain-proposed-20260620-current-refresh.json`
- Full 57-beach hard-gated harness report: `/tmp/quiver-phase2-terrain-full-beach-harness-20260620-current-refresh.json`
- Dry-run export: `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`
- Exact-ID dry-run export: `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`
- Auto approval subset export: `/tmp/quiver-phase2-terrain-auto-approval-subset-current.json` was not written because the current full source report lacks Phase 0 horizon-bucket and replay provenance.
- Existing stale auto approval subset export: `/tmp/quiver-phase2-terrain-auto-approval-subset.json` is invalid under the tightened approval-policy/provenance gate.
- Readiness report: `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`
- Readiness report validation: passed with `--validate-output-json --expect-proposed-json` for `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`; current blocker codes are `gate_sample_floor`, `beach_sample_floor`, `fresh_snapshot_missing_bucket`, `observed_horizon_bucket_provenance_missing`, and `observed_replay_provenance_missing`.
- Exact-ID readiness report: `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`
- Auto approval readiness report was not regenerated; use the exact-ID readiness report above for the current blocker state.
- Harness report: `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`
- Exact-ID harness report: `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`
- Auto approval harness report: `/tmp/quiver-phase2-terrain-auto-approval-harness-current.json`
- Readiness: current sample gate reports 75 total aggregate `0-72h` rows but 0/75 approval-provenanced rows, 0 ready beaches, and 3 insufficient beaches; rerun after Phase 0 logging with the scoped fresh-snapshot gate before approval.
- Harness/validator: `0-72h` gate non-regressing, proposed N 75, current N 75, delta `-0.236m`.
- Scoped SQL preflight: 3 active targets found, 3 would update, 0 already complete, active terrain coverage currently 261/318.
- Scoped SQL preflight now fails fast unless those 3 targets are active Monterey Bay terrain gaps with valid factor lengths, the Phase 0 metric RPC exists, the set has at least 75 approval-provenanced `0-72h` rows, each target has at least 25 approval-provenanced `0-72h` rows, and no scoped short-horizon observed rows are missing stored horizon-bucket or display-replay provenance.
- Auto approval-subset selector validates `approval_policy`, `proposed_json_sha256`, truth contract, measurement contract, hard gate flags, and Phase 0 provenance fields before it can emit the 3 Monterey Bay beach IDs from the full 57-beach report.
- When Phase 0 provenance exists, the auto approval-subset export will include `approval_subset` provenance: source report/proposed paths and SHA-256 hashes, selection criteria, selected beach IDs, selected proposed/current row counts, selected slice details, and excluded measured/unmeasured counts.
- Terrain proposed exports now stamp top-level `approval_policy` with the Phase 0-required `0-72h` face-height MAE contract, and approval validation requires that policy. The approval validator rejects missing policy plus weaker sample/freshness/gate invocations before any terrain write can use the artifact.
- Approval-subset generation now also requires the source proposed artifact to include `approval_policy`; stale pre-policy `/tmp` artifacts fail before writing a narrowed subset.
- The terrain write guard now has a focused regression test proving stricter proposed-artifact `approval_policy` values override weaker write-command flags. A write cannot lower the artifact's declared minimum gate samples, minimum beach-slice samples, or freshness window.
- The terrain proposed artifact validator now rejects `terrain_status = 'failed'` in write-bearing `beaches[]` configs, while preserving failed analyses in `failures[]`; the terrain write guard has a matching regression test so approved writes cannot turn a failed analysis into a factor write.
- Auto approval-subset harness passes with the same `0-72h` delta `-0.236m`, 3/3 measured beach slices, and 0 rows without proposed values; the hardened approval validator now correctly exits `2` until the report has stored horizon-bucket and replay provenance.
- Approved production write command is exact-ID scoped with `--beach-ids`, includes the explicit `--human-approval-token` after human approval, and requires matching approval artifacts plus exact computed-factor equality to the approved proposed artifact, not region-scoped, so future Monterey Bay gaps or recomputation drift cannot be swept into this measured candidate.

The full 57-beach Phase 2 approval harness command is expected to exit `2` until its aggregate, beach-slice, and unmeasured-beach `0-72h` risks are narrowed or fixed.

Phase 2 post-apply:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-gap-postflight.sql
```

Phase 3 analog fallback preflight:

```bash
yarn test:unit --runTestsByPath scripts/__tests__/analog-shoaling-proposed-export.test.ts
yarn tsx scripts/analog-shoaling-proposed-export.ts --output-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json
yarn tsx scripts/analog-shoaling-proposed-export.ts --validate-output-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json --max-artifact-age-hours 24
yarn tsx scripts/forecast-accuracy-readiness-report.ts --proposed-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json --output-json /tmp/quiver-analog-shoaling-readiness-20260620-phase3-refresh.json --truth-source both --min-gate-samples 75 --min-beach-samples 25 --fresh-snapshot-hours 24 --fail-on-not-ready
yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/quiver-analog-shoaling-readiness-20260620-phase3-refresh.json --expect-proposed-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json --max-report-age-hours 24
yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json --group-by beach --output-json /tmp/quiver-analog-shoaling-harness-20260620-phase3-refresh.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-analog-shoaling-harness-20260620-phase3-refresh.json --approval --expect-proposed-json /tmp/quiver-analog-shoaling-proposed-20260620-phase3-refresh.json --require-scope-matches-proposed-json --expect-scope-beach-count 47 --max-report-age-hours 24
```

The final validation command is expected to exit `2` until the candidate has measurable `0-72h` rows.
The proposed JSON is harness-only by construction: top-level `approval_policy.production_write_allowed` is `false`, and proposed factor metadata is marked `analog_transfer_unvalidated` until a fresh Phase 0 approval report proves the `0-72h` face-height MAE gate.
`forecast-accuracy-report-validate --approval` now requires a proposed artifact `approval_policy` and enforces its Phase 0 contract, so Phase 1/analog artifacts cannot be approved under weaker sample floors, freshness windows, metric names, or horizon gates than the artifact declares. The analog export also has its own saved-artifact validator, so stale or malformed proposed JSON fails before readiness or harness commands run.

Track C rerun:

```bash
yarn tsx scripts/validate-match-score-heuristic.ts --output-json /tmp/quiver-match-score-heuristic-validation-20260620-refresh.json
yarn tsx scripts/validate-match-score-heuristic.ts --validate-output-json /tmp/quiver-match-score-heuristic-validation-20260620-refresh.json --max-report-age-hours 24
yarn tsx scripts/validate-match-score-heuristic.ts --output-json /tmp/quiver-match-score-heuristic-validation-20260620-gated-refresh.json --fail-on-not-ready
yarn tsx scripts/validate-match-score-heuristic.ts --validate-output-json /tmp/quiver-match-score-heuristic-validation-20260620-gated-refresh.json --max-report-age-hours 24
```

The ungated command now writes `rpcFloorDiagnostic`, `cohortDiagnostic`,
deterministic user-level `reweightingHoldout`, and `cohortSanityCheck`
evidence in the JSON artifact. Both artifacts validate their schema/version,
aggregate counts, RPC-floor loaded-sample consistency, cohort sanity
counts/correlations, holdout counts/correlations, freshness, current-weight
contract, and non-production readiness/evidence claims. Latest schema-v4 gated
rerun generated at `2026-06-20T12:27:49.213Z` still exits `2`: 45 real-profile
rated sessions, 44 complete-component sessions, 5 strict prior-history scored
sessions, 1 strict scored user, current Pearson `-0.891`, best grid Pearson
`0.152`, and holdout Pearson `n/a` because no held-out user exists. The
RPC-floor same-user diagnostic is `productionEvidence: false`: 12 prior-only
scoreable sessions, 2 scoreable users, and current Pearson `-0.408`. The broad
cohort sanity check is also `insufficient-signal` with production evidence
false: 36 cohort scored sessions, 11 cohort scored users, and cohort current
Pearson `-0.164`. Reweighting finding codes are `scored_sessions_floor`,
`scored_users_floor`, `best_grid_pearson_floor`, and
`holdout_grid_pearson_unavailable`; cohort sanity finding codes are
`cohort_not_production_evidence`, `cohort_scored_sessions_floor`,
`cohort_scored_users_floor`, and `cohort_current_weight_pearson_floor`.

Track A readiness rerun:

```bash
yarn tsx scripts/session-face-height-truth-report.ts --days 365 --output-json /tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json --fail-on-not-ready
yarn tsx scripts/session-face-height-truth-report.ts --validate-output-json /tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json --max-report-age-hours 24
```

The readiness rerun is expected to exit `2` until enough matched short-horizon face-height truth exists. The saved-artifact validation should pass for the freshly written JSON.

Track B readiness rerun:

```bash
yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --recent-telemetry-days 7 --expect-recent-client-build native-ios,1.0.1,11 --expect-recent-client-build native-android,1.0.1,11 --output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --fail-on-not-ready
yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --max-report-age-hours 24
```

The readiness rerun is expected to exit `2` until rated-session volume, repeat-rater depth, rated face-height truth volume, broad and recent beach-selected telemetry coverage, broad and recent conditions-set telemetry coverage, broad and recent submit-event telemetry coverage, and expected-build adoption clear the configured floors. The saved-artifact validation should pass for the freshly written JSON.

## Remaining Risks

- Phase 0 is still not live, so short-horizon measurement is not yet durable enough to approve Phases 1 and 2.
- Phase 1 only has `73h+` scoped evidence today.
- Phase 2 has one non-regressing 3-beach candidate, but the full 57-beach proposal regresses and most remaining terrain gaps still lack short-horizon proof.
- Track A session truth is valid but sparse.
- Track B confirms the bottleneck but does not itself increase session volume; the new conditions-set event also remains blocked on database allowlist migration plus native build adoption before it can produce production telemetry.
- Phase 3 bathymetry used global fallback data for all sampled transects; CUDEM did not produce usable samples in the automatic run.
- Analog transfer looks promising at `73h+`, but it has no short-horizon approval evidence and would need explicit analog confidence/source semantics before any production write.
- Current Phase 1 and analog proposed sets both have zero `0-72h` rows in the readiness report; do not rerun approval commands as evidence until Phase 0 logging produces fresh short-horizon rows.
