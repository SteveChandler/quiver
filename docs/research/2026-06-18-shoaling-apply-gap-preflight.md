# Phase 1 Shoaling Apply-Gap Preflight

Date: 2026-06-18

## Scope

Prepare Phase 1 only. No production write was applied.

Phase 1 target is the validated shoaling-factor apply gap: production has fewer populated `beaches.shoaling_factors` rows than the validated factor artifact at `seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json`.

## Read-Only Coverage Check

Live production read-only query results:

- Active beaches: 318
- Validated factor rows: 117
- Active prod beaches with `shoaling_factors`: 87
- Validated active beaches still missing in prod: 30
- Prod-calibrated rows outside the validated set: 0
- Existing 87 prod-calibrated rows match the validated buckets at 2 decimal places: yes

The generated migration is a top-up migration, not a rewrite of the already-applied April migration. It updates only the 30 validated active beaches where `shoaling_factors IS NULL`, so it does not rewrite existing calibrated beaches.
The migration also fails inside the transaction unless the explicit approval session token is set, the Phase 0 schema/RPC dependencies exist, the exact 30-beach target set has at least 75 approval-provenanced `0-72h` rows in the last 30 days, every target beach has at least 25 approval-provenanced `0-72h` rows, every scoped short-horizon observed row has stored horizon-bucket and display-replay provenance, and `phase1_expected_rows_updated = 30`. If explicit approval is not present in the database session, Phase 0 is not live, the target set is not measurable, any short-horizon row lacks approval provenance, or any target row is deleted/populated between preflight and apply, the migration fails and rolls back instead of silently applying an unmeasurable or partial top-up.

Migration prepared for review:

- `supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql`
- `scripts/phase1-shoaling-proposed-export.ts`

Preflight and postflight prepared:

- `scripts/db/phase1-shoaling-apply-gap-preflight.sql`
- `scripts/db/phase1-shoaling-apply-gap-postflight.sql`

Production preflight command rerun read-only on 2026-06-20:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase1-shoaling-apply-gap-preflight.sql
```

Result: expected exit `3`. The script ran inside `BEGIN READ ONLY; ... ROLLBACK;`, confirmed the structural target scope, emitted `phase1_preflight_blockers`, then failed because Phase 0 schema/RPC prerequisites are not live.

Preflight findings:

- Active beaches: 318
- Active beaches with `shoaling_factors`: 87
- Expected Phase 1 target rows: 30
- Expected active rows found: 30
- Rows that would update: 30
- Already populated target rows: 0
- Missing/deleted target rows: 0
- Phase 0 schema/RPC prerequisites: `forecast_horizon_bucket`, `display_wave_source`, `display_raw_input_height_m`, and `get_forecast_accuracy_horizon_metrics(...)` all absent before the Phase 0 migration, as expected.

Current preflight behavior:

- `scripts/db/phase1-shoaling-apply-gap-preflight.sql` now fails closed unless the exact 30 active targets are still missing `shoaling_factors`, the target set has at least 75 approval-provenanced `0-72h` rows in the last 30 days, every target beach has at least 25 approval-provenanced `0-72h` rows, and no scoped short-horizon observed row is missing stored horizon-bucket or display-replay provenance.
- `supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql` now checks the Phase 0 columns and canonical metric RPC before its measurement CTE, then repeats the approval-provenance and short-horizon sample-floor guard inside the mutating transaction with explicit `RAISE EXCEPTION` failures. The production write cannot land before the target set is measurable through Phase 0, and target drift produces a readable row-count error instead of a raw arithmetic failure.
- The target-row section reports `observed_0_24h_rows`, `observed_25_72h_rows`, `observed_0_72h_rows`, `approval_0_72h_rows`, `observed_0_72h_rows_without_approval_provenance`, and `has_slice_sample_floor` for each beach, so missing slice proof and stale pre-Phase-0 rows are visible before approval.
- The preflight now checks Phase 0 schema/RPC dependencies before referencing Phase 0-only columns. If they are absent, it emits `phase1_phase0_schema_readiness` and `phase1_preflight_blockers` tables and exits non-zero through the explicit post-rollback assertion path instead of failing with a raw missing-column error.
- Live rerun result on 2026-06-20: expected exit `3`; target scope assertions still passed, but observation checks were skipped because Phase 0 schema is not live. Current blocker codes are `all_targets_approval_0_72h_rows_at_least_25`, `approval_0_72h_rows_at_least_75`, and `phase1_phase0_schema_ready`.
- Do not treat the migration as approvable until this preflight, the readiness report, the harness, and `forecast-accuracy-report-validate --approval` all pass for the same proposed JSON.

2026-06-20 readiness refresh after Phase 1 guard hardening:

- Proposed export regenerated from the migration: 30 Phase 1 beach configs.
- The proposed export now validates those 30 SQL rows against
  `../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json`
  before writing. It fails if a row is absent from the 117-row validated source,
  if any rounded period-bucket factor differs, or if method/samples/date
  range/reference-buoy metadata drift from the source.
- The proposed export validator also inspects the source migration semantics.
  It fails if the migration no longer requires the explicit approval token,
  Phase 0 schema/RPC, the Phase 0 measurement guard, the `75` aggregate and
  `25` per-beach approval-provenanced `0-72h` sample floors, complete Phase 0
  provenance, null-only `shoaling_factors` writes, exact 30-row update count,
  or if destructive/table-shape SQL appears.
- Latest proposed export artifact:
  `/tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json`,
  generated `2026-06-20T12:37:53.424Z`, with
  `artifact_schema_version: 1`.
- Saved proposed artifact validation passes with:
  `yarn tsx scripts/phase1-shoaling-proposed-export.ts --validate-output-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json --max-artifact-age-hours 24`.
- Source binding hashes:
  - `source_migration_sha256`: `41ba2bfb5b876c442732459bcbffeaa1cd7c86240716b198de2f321ab1769ada`
  - `source_validated_json_sha256`: `e6e90f4de9e27ae64ff327a2135333e0eb7b4413baddcc125f90697638cfb387`
- Source rows matched: `30 / 30` proposed top-up rows; validated source rows:
  `117`.
- The proposed export now includes an explicit approval policy:
  `phase0_required`, `production_write_allowed=false`, required gate `0-72h`,
  required metric `face_height_mae`, validator
  `forecast-accuracy-report-validate --approval`, minimum gate samples `75`,
  minimum beach-slice samples `25`, and maximum report age `24h`.
- The proposed export also records the expected coverage movement:
  `117` validated rows, `87` currently calibrated rows, `30` proposed top-up
  rows, and `117` expected active calibrated beaches after an approved apply.
- `scripts/forecast-accuracy-readiness-report.ts` exited `2` with `--fail-on-not-ready`, as expected.
- Readiness artifact:
  `/tmp/quiver-phase1-shoaling-gap-readiness-20260620-current-refresh.json`.
- Saved readiness validation passes with:
  `yarn tsx scripts/forecast-accuracy-readiness-report.ts --validate-output-json /tmp/quiver-phase1-shoaling-gap-readiness-20260620-current-refresh.json --expect-proposed-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json --max-report-age-hours 24`.
- Readiness range: `2026-05-21T12:38:14.306Z` to `2026-06-20T12:38:14.306Z`; JSON generated at `2026-06-20T12:38:16.018Z`.
- Proposed JSON hash: `8af1917459207c539763f34b7b67590ad72610c00c60a469f651087c20243cfa`.
- Gate approval-provenanced `0-72h` rows: `0 / 75`.
- Total scoped `0-72h` rows: `0`.
- Scoped `73h+` evidence: `5,377` rows total, split `5,373` buoy rows and `4` session rows.
- Fresh scoped snapshots: `0` approval-provenanced `0-72h` rows in the last 24h; all 30 target beaches are missing both `0-24h` and `25-72h` fresh snapshot buckets.
- Beach readiness: `0` ready, `0` insufficient, `30` unmeasured.
- Current production SQL preflight exits `3` after `ROLLBACK` with an explicit Phase 1 preflight error because Phase 0 has not added the required schema/RPC objects yet. The `phase1_phase0_schema_readiness` table reports all four dependencies absent: `ml_predictions_log.forecast_horizon_bucket`, `ml_predictions_log.display_wave_source`, `ml_predictions_log.display_raw_input_height_m`, and `get_forecast_accuracy_horizon_metrics(...)`. The structural rows still pass before that assertion: 318 active beaches, 87 active with `shoaling_factors`, 30 expected gap rows, 30 would update, 0 already populated, and 0 missing/deleted. `phase1_preflight_blockers` reports `all_targets_approval_0_72h_rows_at_least_25`, `approval_0_72h_rows_at_least_75`, and `phase1_phase0_schema_ready`.
- This is the expected pre-Phase-0 fail-closed shape. After the Phase 0 schema lands, rerun the same SQL preflight; it should then reach the approval-provenance/sample-floor assertions and remain non-zero until fresh short-horizon evidence exists.

## Missing Validated Beaches

| Region | Beaches |
| --- | --- |
| Los Angeles | County Line, El Porto (Manhattan), El Segundo Beach Jetty, Hermosa Pier, Malibu First Point (Surfrider), Manhattan Beach Pier, Redondo Breakwall, Topanga, Venice Breakwater, Zuma Beach |
| Orange County | 52nd Street, 54th Street, Corona del Mar, Crystal Cove, Goldenwest, HB Cliffs, Huntington Beach Pier, Huntington Beach Pier Northside, Huntington Beach Pier Southside, Huntington St., Huntington State Beach, Newport 56th St, Newport Lower Jetties, Newport Point, Newport Upper Jetties, River Jetties, Rockpile, The Wedge |
| San Diego | Tourmaline Beach |
| San Francisco | Ocean Beach SF - Sloat |

## Harness Check

Command used a proposed-factor JSON built from the 30 missing validated rows:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/phase1-shoaling-proposed-export.ts --output-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json --group-by beach --output-json /tmp/quiver-phase1-shoaling-gap-harness-20260620-current-refresh.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
```

Result:

| Horizon | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| `73h+` | 5,377 | 5,377 | 0.281m | 0.423m | -0.142m |

Strict gate confirmation:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json --group-by beach --output-json /tmp/quiver-phase1-shoaling-gap-harness-20260620-current-refresh.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase1-shoaling-gap-harness-20260620-current-refresh.json --approval --expect-proposed-json /tmp/quiver-phase1-shoaling-gap-proposed-20260620-current-refresh.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 30 --max-report-age-hours 24
```

Result: expected exit `2`; no proposed `0-72h` gate delta was available. The approval validator now fails on missing proposed `0-72h` gate verdict/slices, missing beach slice group keys for all 30 scoped beaches, 30 unmeasured proposed `0-72h` slices, and inability to verify the `25` per-beach slice sample floor.

This is useful directional evidence, but it does not satisfy the Phase 1 ship gate by itself because current production logging still has no approval-provenanced 0-72h rows for this scoped comparison. The 0-72h proof remains gated on applying Phase 0 instrumentation.

## Review Position

Ready for human review as a prepared write artifact, but not ready to apply. Do not apply until Phase 0 is approved/applied and the same migration can report the required approval-provenanced 0-72h face-height MAE delta. The Phase 1 SQL preflight is now expected to exit non-zero until that evidence exists.

After explicit approval and a passing Phase 0 approval report for this same proposed artifact, run the apply with the approval token in the same database session, then run postflight:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.phase1_shoaling_apply_gap_approved = '2026-06-18-phase1-shoaling-apply-gap-approved';" -f supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase1-shoaling-apply-gap-postflight.sql
```

The migration itself fails before preparing target rows unless `app.phase1_shoaling_apply_gap_approved` is set to the exact approval token above.

Expected postflight: all 30 target beaches have valid `period_lookup` shoaling factors and active `shoaling_factors` coverage is at least 117.

Current pre-apply postflight behavior on 2026-06-20: expected exit `3` after `ROLLBACK` with `Phase 1 shoaling apply-gap postflight assertions failed; see phase1_postflight_blockers and phase1_postflight_coverage above.` The postflight now emits `phase1_postflight_blockers` before raising. Current production remains at 87 active beaches with `shoaling_factors`; the 30 target rows are active but 0/30 are populated. Blocker codes: `active_shoaling_coverage_at_least_117`, `all_target_rows_populated`, and `all_target_rows_valid_period_lookup`.
