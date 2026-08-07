# Phase 2 Terrain Gap Preflight

Generated: 2026-06-20

## Summary

- Active beaches missing terrain status or factor arrays: 57.
- Existing terrain coverage remains 261/318 active beaches.
- DEM prerequisite check passed: AWS Terrain Tiles loaded without credentials for `12th Street Jetty`.
- New safe selector added: `yarn terrain:analyze --missing-only --dry-run`.
- New proposed-factor export added: `--output-json=<path>` writes successful dry-run factors in the Phase 0 harness `{"beaches":[...]}` input shape.
- Region filtering was fixed to use `beaches.region` only. The previous helper referenced a dead `beaches.location` column and failed against production.
- Full 57-beach dry-run completed successfully: 57 succeeded, 0 failed, 0 skipped, average 699ms per beach.
- Full 57-beach proposed-factor export completed successfully: 57 exported, 0 failed.
- Phase 0 harness comparison for the exported factors currently fails the `0-72h` gate: proposed MAE 0.308m vs current 0.256m, delta +0.052m.
- Regional slicing identified a safe Monterey Bay subset: 3 exported beaches, proposed `0-72h` MAE 0.195m vs current 0.431m, delta -0.236m.
- Approval subset selection is now reproducible from the full beach-level harness report with `scripts/forecast-accuracy-approval-subset.ts`; it selects only non-regressing measured beach slices that meet the configured sample floor.
- Monterey Peninsula is the observed regression source: proposed `0-72h` MAE 0.392m vs current 0.125m, delta +0.267m.
- Beach-level approval slicing found 4 regressing Monterey Peninsula beaches and 50 unmeasured proposed beaches in the full 57-beach export, so the full export fails closed even before any production write.
- Machine-readable harness reports were generated for both the full failing export and the Monterey Bay exact-ID subset; the subset report has gate verdict `non-regressing`, delta `-0.236m`, 3/3 measured beaches, and 0 unmeasured slices.
- Fresh Monterey Bay exact-ID dry-run on 2026-06-20 exported 3 beaches to `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`; the artifact has `artifact_schema_version: 1`, `approval_policy.production_write_allowed=false`, three `dem_horizon_v1` / `ok` beaches with 72-bin wind and swell arrays, and validates with `yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json --max-artifact-age-hours 24`.
- Fresh Monterey Bay exact-ID harness on 2026-06-20 wrote `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`: 137 matched rows, 75 matched `0-72h` rows, proposed MAE 0.195m vs current 0.431m, delta `-0.236m`, and all 3 beach slices non-regressing.
- Fresh approval validation on 2026-06-20 exits `2`: all 75 matched `0-72h` rows still lack both stored horizon-bucket provenance and display-replay provenance. This supersedes earlier structurally passing validator notes; no Phase 2 terrain write is approval-ready before Phase 0 lands and a fresh validator pass exists.
- Monterey Bay production preflight passed structurally read-only before the approval-provenance assertion was added: 3 active targets, all 3 would update, active terrain coverage currently 261/318, and 75 observed `0-72h` rows.
- Monterey Bay readiness rerun on 2026-06-20 exits `2` under the approval gate: 75/75 aggregate `0-72h` rows exist, but 0 are approval-provenanced, 0/3 beaches are ready, all 3 are insufficient, and fresh scoped snapshots are missing both `0-24h` and `25-72h` buckets.
- Monterey Bay production preflight is now fail-fast: it asserts the Phase 0 metric RPC exists, the 3 expected active targets, Monterey Bay region scope, current gap status, no invalid factor lengths, at least 75 approval-provenanced `0-72h` rows, at least 25 approval-provenanced `0-72h` rows per target beach, and zero scoped short-horizon observed rows missing stored horizon-bucket or display-replay provenance.
- The terrain write guard now validates the proposed artifact schema before production writes and has a regression test for proposed-artifact approval policies: if the artifact declares stricter `min_gate_samples`, `min_slice_samples`, or `max_report_age_hours` than the write command, the write is rejected before terrain computation.
- The proposed artifact validator now rejects `terrain_status = 'failed'` in write-bearing `beaches[]` configs. Failed analysis rows remain reportable only through the separate `failures[]` list, and the terrain write guard has a regression test proving a production write is rejected before compute when an approval artifact tries to write a failed terrain status as an approved factor config.
- The Monterey Bay preflight now checks Phase 0 schema/RPC dependencies before referencing Phase 0-only columns. If they are absent, it emits `phase2_monterey_bay_phase0_schema_readiness` and `phase2_monterey_bay_preflight_blockers` tables and exits non-zero through the normal assertion path instead of failing with a raw missing-column error.
- Read-only SQL preflight passed against production: 57 active terrain gaps, 261 active beaches already have status plus 72-bin wind/swell arrays, 0 invalid existing factor lengths.
- No production writes were performed.

## SQL Gates

Preflight and postflight prepared:

- `scripts/db/phase2-terrain-gap-preflight.sql`
- `scripts/db/phase2-terrain-gap-postflight.sql`
- `scripts/db/phase2-terrain-monterey-bay-preflight.sql`
- `scripts/db/phase2-terrain-monterey-bay-postflight.sql`

Production preflight command run read-only on 2026-06-20:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-gap-preflight.sql
```

Result: PASS. The script ran inside `BEGIN READ ONLY; ... ROLLBACK;`.

Preflight findings:

- Active beaches: 318
- Active missing terrain status or factor arrays: 57
- Active with terrain status and factor arrays: 261
- Active with 72-bin wind and swell arrays: 261
- Active invalid factor lengths: 0

Postflight command for an approved write:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-gap-postflight.sql
```

Expected postflight after a fully successful approved run: zero remaining active beaches missing `terrain_status`, `swell_access_factors`, or `wind_exposure_factors`; all active beaches have 72-bin wind and swell arrays.

Current pre-apply global postflight behavior on 2026-06-20: expected exit `3` after `ROLLBACK` with `Phase 2 terrain gap postflight assertions failed; see phase2_postflight_assertions and phase2_remaining_gap_rows above.` The script now prints the 57 remaining terrain gap rows before failing explicitly.

The global postflight is not appropriate for the current narrowed candidate because the full 57-beach write fails the accuracy gate. For the Monterey Bay approval candidate, use the scoped gate:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-preflight.sql
```

Result on 2026-06-19 before the approval-provenance assertion was added: PASS. The script ran inside `BEGIN READ ONLY; ... ROLLBACK;`.

Current result after the Phase 0 schema gate was added: expected exit `3`. The script now reports the missing Phase 0 dependencies explicitly and then fails the assertion gate.

Current result after explicit failure-path hardening: still expected exit `3` after `ROLLBACK`, with `Phase 2 Monterey Bay terrain preflight assertions failed; see phase2_monterey_bay_preflight_blockers and phase2_monterey_bay_preflight_assertions above.` Latest 2026-06-20 rerun confirms production still has all 3 Monterey Bay targets active and incomplete, all 4 Phase 0 prerequisites missing, and 0 approval-provenanced rows because the Phase 0 schema branch is skipped. `phase2_monterey_bay_preflight_blockers` reports `all_targets_approval_0_72h_rows_at_least_25`, `approval_0_72h_rows_at_least_75`, and `phase2_monterey_bay_phase0_schema_ready`.

Scoped preflight findings:

- Active beaches: 318
- Active with status and factor arrays: 261
- Expected Monterey Bay target rows: 3
- Expected active targets found: 3
- Target rows in Monterey Bay: 3
- Rows that would update: 3
- Already complete target rows: 0
- Missing/deleted target rows: 0
- Target invalid factor lengths: 0
- Observed 30-day short-horizon rows at that time: `0-24h` 27 observed, `25-72h` 48 observed
- Structural fail-fast assertions passed at that time:
  - all three targets active
  - all targets are still in Monterey Bay
  - all targets are still current terrain gaps
  - no target has invalid factor lengths
- Current live Phase 0 dependency check reports these objects absent:
  - `ml_predictions_log.forecast_horizon_bucket`
  - `ml_predictions_log.display_wave_source`
  - `ml_predictions_log.display_raw_input_height_m`
  - `get_forecast_accuracy_horizon_metrics(...)`
- Current stricter approval assertions fail until Phase 0 lands:
  - Phase 0 schema/RPC dependencies are present
  - Phase 0 metric RPC exists
  - approval-provenanced `0-72h` rows are at least 75
  - every target has at least 25 approval-provenanced `0-72h` rows
  - no scoped short-horizon observed rows are missing approval provenance

After an approved Monterey Bay-only write:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-postflight.sql
```

Expected scoped postflight: the three Monterey Bay targets have `terrain_status`, 72-bin `wind_exposure_factors`, 72-bin `swell_access_factors`, `terrain_method = 'dem_horizon_v1'`, and active terrain coverage is at least 264/318.

Current pre-apply scoped postflight behavior on 2026-06-20: expected exit `3` after `ROLLBACK` with `Phase 2 Monterey Bay terrain postflight assertions failed; see phase2_monterey_bay_postflight_blockers, phase2_monterey_bay_postflight_assertions, and target rows above.` The diagnostic output shows the three targets are active but 0 complete, 0 have 72-bin terrain arrays, and active terrain coverage remains 261/318. `phase2_monterey_bay_postflight_blockers` reports `active_terrain_coverage_at_least_264`, `all_targets_complete`, `all_targets_have_72_bin_wind_and_swell`, and `all_targets_use_dem_horizon_v1`.

## Live Dry-Run Evidence

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --dry-run --limit=1 --concurrency=1
```

Result:

- Found 57 active terrain gaps.
- Analyzed `12th Street Jetty` in dry-run mode.
- Wind factors: 72 values computed.
- Swell factors: 72 values computed.
- Result was not written.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --dry-run --concurrency=4
```

Result:

- Found 57 active terrain gaps.
- Loaded 57 beaches.
- Successful: 57.
- Failed: 0.
- Skipped: 0.
- Result was not written.

Phase 0 harness export command for the same dry-run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --dry-run --concurrency=4 --output-json=/tmp/quiver-phase2-terrain-proposed.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-proposed.json --max-artifact-age-hours 24
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-proposed.json --group-by region --output-json /tmp/quiver-phase2-terrain-full-region-harness-report.json --fail-on-regression --fail-on-slice-regression --min-gate-samples 175 --min-slice-samples 75
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-proposed.json --group-by beach --output-json /tmp/quiver-phase2-terrain-full-beach-harness-report.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 175 --min-slice-samples 25
```

The output file is local harness input only. It does not write Supabase. The harness auto-scopes to proposed beach IDs when `--proposed-json` contains `beaches`.
The full 57-beach approval command is expected to exit `2` while the current aggregate, beach-slice, or unmeasured-beach regression risk remains.

Result from 2026-06-20:

- Exported beaches: 57
- Export failures: 0
- Harness rows compared: 5,899
- Rows without proposed value: 0

| Horizon | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| `0-24h` | 63 | 63 | 0.202m | 0.271m | -0.069m |
| `25-72h` | 112 | 112 | 0.367m | 0.248m | +0.119m |
| `73h+` | 5,724 | 5,724 | 0.302m | 0.475m | -0.173m |
| `0-72h gate` | 175 | 175 | 0.308m | 0.256m | +0.052m |

Gate verdict: regressed. Do not apply the full 57-beach terrain write as-is.

Regional gate slices:

| Region | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Monterey Bay | 75 | 75 | 0.195m | 0.431m | -0.236m | non-regressing |
| Monterey Peninsula | 100 | 100 | 0.392m | 0.125m | +0.267m | regressed |

Beach-level approval gate failures:

| Beach | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Lovers Point | 25 | 25 | 0.374m | 0.229m | +0.145m | regressed |
| Spanish Bay / South Moss Beach | 25 | 25 | 0.369m | 0.087m | +0.282m | regressed |
| Asilomar State Beach | 25 | 25 | 0.369m | 0.086m | +0.283m | regressed |
| Carmel Beach | 25 | 25 | 0.457m | 0.100m | +0.357m | regressed |

Measured beach-slice coverage: 7/57 proposed beaches. The remaining 50 proposed beaches have no measured `0-72h` gate rows in the current 30-day window, so they cannot be approved under the no-regression rule yet.

Full export machine-readable report:

- `/tmp/quiver-phase2-terrain-full-beach-harness-20260620-current-refresh.json`
- Scope: 57 beaches
- Gate verdict: regressed, delta `+0.052m`
- Regressed beach slices: 4
- Unmeasured beach slices: 50

Monterey Bay safe candidate command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-approval-subset.ts --report-json /tmp/quiver-phase2-terrain-full-beach-harness-report.json --proposed-json /tmp/quiver-phase2-terrain-proposed.json --output-json /tmp/quiver-phase2-terrain-auto-approval-subset.json --min-slice-samples 25
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/terrain-filter-proposed-export.ts --input-json /tmp/quiver-phase2-terrain-proposed.json --output-json /tmp/quiver-phase2-terrain-monterey-bay-approved-subset.json --beach-ids a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848 --dry-run --concurrency=3 --output-json=/tmp/quiver-phase2-terrain-monterey-bay-proposed.json
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-proposed.json --max-artifact-age-hours 24
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed.json --group-by beach --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --proposed-json /tmp/quiver-phase2-terrain-monterey-bay-approved-subset.json --group-by beach --output-json /tmp/quiver-phase2-terrain-monterey-bay-harness-report.json --fail-on-regression --fail-on-slice-regression --fail-on-unmeasured-slices --min-gate-samples 75 --min-slice-samples 25
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-phase2-terrain-monterey-bay-harness-report.json --approval --expect-proposed-json /tmp/quiver-phase2-terrain-monterey-bay-approved-subset.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 3 --max-report-age-hours 24
```

Monterey Bay result:

- Exported beaches: 3 (`Del Monte Beach`, `Marina State Beach`, `Moss Landing`)
- Auto approval subset from the full beach-level report selects the same 3 beach IDs and excludes the 4 regressed plus 50 unmeasured slices.
- Previous auto approval subset export: `/tmp/quiver-phase2-terrain-auto-approval-subset.json`
- Previous auto approval subset export includes `approval_subset` provenance with source report/proposed paths, selection criteria, selected beach IDs, selected slice details, 4 measured exclusions, and 50 unmeasured exclusions, but it is not a valid write artifact under the current Phase 0 provenance gate.
- Terrain proposed exports now include `artifact_schema_version: 1` and a top-level Phase 0 approval policy: required gate `0-72h`, required metric `face_height_mae`, required validator `forecast-accuracy-report-validate --approval`, minimum aggregate gate samples `75`, minimum per-beach slice samples `25`, maximum report age `24h`, and `production_write_allowed=false` until an explicit approved write command is run. `yarn terrain:analyze --validate-output-json <path> --max-artifact-age-hours 24` validates the saved artifact, and the terrain write guard runs the same artifact validation before any production update.
- Previous auto approval readiness report: `/tmp/quiver-phase2-terrain-auto-approval-readiness.json`
- Previous auto approval harness report: `/tmp/quiver-phase2-terrain-auto-approval-harness.json`
- Harness rows compared: 137
- Rows without proposed value: 0
- Machine-readable report: `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`
- Current exact-ID proposed export: `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`
- Current exact-ID harness report: `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`
- Current exact-ID proposed JSON hash: `338ea539011c5a282dc22b8bdddb962caa2b2f00c9a317542d133959b92c4bdc`
- Current readiness report: `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`
- Exact-ID dry-run export: `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`
- Exact-ID readiness report: `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`
- Exact-ID harness report: `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`
- Readiness result: not approval-ready, 75/75 aggregate `0-72h` rows but 0 approval-provenanced rows, 0/3 ready beaches, 3/3 insufficient beaches, and fresh scoped snapshots missing both `0-24h` and `25-72h` buckets for all 3 beaches.
- Report verdict: non-regressing, 0 regressed beach slices, 0 unmeasured beach slices
- Current proposed artifact: `/tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json`, generated at `2026-06-20T12:43:02.477Z`, SHA-256 `338ea539011c5a282dc22b8bdddb962caa2b2f00c9a317542d133959b92c4bdc`.
- Current readiness artifact: `/tmp/quiver-phase2-terrain-monterey-bay-readiness-20260620-current-refresh.json`, generated at `2026-06-20T12:44:55.518Z`, validates against the proposed JSON, and still exits `2` under `--fail-on-not-ready`.
- Current harness artifact: `/tmp/quiver-phase2-terrain-monterey-bay-harness-20260620-current-refresh.json`, generated at `2026-06-20T12:45:10.337Z`.
- Current harness row counts: 137 buoy rows, 0 session rows, 137 matched prediction rows, 75 matched `0-72h` rows, 137 proposed rows compared, and 0 rows without proposed values.
- Current proposed artifact validation: passes with `yarn terrain:analyze --validate-output-json /tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json --max-artifact-age-hours 24`.
- Current proposed artifact validation includes the tightened write-bearing status guard; all 3 Monterey Bay configs remain valid with `terrain_status = 'ok'`.
- Current report validator: exits `2` under `--approval --expect-proposed-json /tmp/quiver-phase2-terrain-monterey-bay-proposed-20260620-current-refresh.json --require-scope-matches-proposed-json --min-gate-samples 75 --min-slice-samples 25 --expect-scope-beach-count 3 --max-report-age-hours 24`.
- Current approval blockers: `Matched 0-72h rows without replay provenance 75 exceeds 0`, `0-72h rows with replay provenance 0 is below proposed gate sample count 75`, `Matched 0-72h rows without horizon-bucket provenance 75 exceeds 0`, and `0-72h rows with horizon-bucket provenance 0 is below proposed gate sample count 75`.
- Previous auto-approval subset artifacts are not valid write artifacts under the tightened provenance gate. Regenerate the proposed artifact and harness after Phase 0 lands, then require a fresh `forecast-accuracy-report-validate --approval` pass before requesting production write approval.
- Sample-floor verdict: aggregate `0-72h` N meets `--min-gate-samples 75`; each beach slice meets `--min-slice-samples 25`.

| Scope | Proposed N | Current N | Proposed MAE | Current MAE | Delta MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Monterey Bay `0-72h gate` | 75 | 75 | 0.195m | 0.431m | -0.236m | non-regressing |
| Del Monte Beach | 25 | 25 | 0.140m | 0.608m | -0.468m | non-regressing |
| Marina State Beach | 25 | 25 | 0.234m | 0.374m | -0.140m | non-regressing |
| Moss Landing | 25 | 25 | 0.210m | 0.311m | -0.101m | non-regressing |

After Phase 0 lands, if fresh approval validation passes and the user explicitly approves the Monterey Bay-only write, use a fresh exact-ID command shaped like:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848 --concurrency=3 --human-approval-token=2026-06-19-phase2-terrain-write-approved --approval-report-json=/tmp/<fresh-validator-passing-phase2-monterey-bay-harness>.json --approval-proposed-json=/tmp/<fresh-validator-passing-phase2-monterey-bay-proposed>.json --min-approval-gate-samples=75 --min-approval-slice-samples=25 --max-approval-report-age-hours=24
```

This would target exactly the 3 measured terrain gaps and should raise active terrain coverage from 261/318 to 264/318 if all three writes succeed. Do not run it without explicit human approval. The script now rejects non-dry-run writes unless the command is exact-ID scoped, includes `--missing-only`, does not use `--force`, includes the documented `--human-approval-token`, the exact requested beach IDs match the approval proposed JSON, and the harness report passes `--approval`-equivalent checks. Do not use stale `/tmp` artifacts or the broader region-scoped write command for this approval candidate; future Monterey Bay gaps or recomputation drift would not be covered by the current harness proof.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --region="Jersey Shore" --dry-run --limit=1 --concurrency=1
```

Result:

- Found 21 Jersey Shore terrain gaps.
- Analyzed `12th Street Jetty` in dry-run mode.
- Result was not written.

## Gap Regions

| Region | Gap beaches |
| --- | ---: |
| Jersey Shore | 21 |
| Los Angeles | 16 |
| Monterey Peninsula | 6 |
| Monterey Bay | 3 |
| Orange County | 3 |
| Cape Fear | 2 |
| Long Island | 2 |
| San Juan Metro | 2 |
| Outer Banks | 1 |
| Topsail Island | 1 |

## Gap Beach List

### Cape Fear

- Carolina Beach
- Kure Beach

### Jersey Shore

- 12th Street Jetty
- 1st Street Jetty
- 36th-42nd Street
- 3rd Avenue Beach
- 3rd Avenue Jetty
- 7th Street Beach
- 8th Avenue Jetty
- Bay Head Beach
- Belmar Fishing Pier
- Brinley Avenue
- Broadway Beach
- Kook Bay (Spring Lake)
- Mambo Beach
- Ortley Beach
- Poverty Beach
- Seaside Park
- Seven Presidents Oceanfront Park
- South End Jetty
- The Cove (Cape May)
- Washington Beach
- Waverly Beach

### Long Island

- Robert Moses State Park
- Smith Point County Park

### Los Angeles

- 72nd Place
- Bay Street
- Dockweiler State Beach
- Hermosa Beach Pier
- Hermosa Beach South
- Latigo Point
- Leo Carrillo State Beach
- Malibu Second Point
- Malibu Surfrider (First Point)
- Malibu Third Point
- Palos Verdes Cove
- Point Dume
- Santa Monica Beach
- Torrance Beach (RAT Beach)
- Venice Beach
- Will Rogers State Beach

### Monterey Bay

- Del Monte Beach
- Marina State Beach
- Moss Landing

### Monterey Peninsula

- Asilomar State Beach
- Carmel Beach
- Ghost Tree
- Lovers Point
- Monastery Beach / San Jose Creek Beach
- Spanish Bay / South Moss Beach

### Orange County

- Blackies
- Riviera
- Seal Beach Pier

### Outer Banks

- Corolla

### San Juan Metro

- La Ocho
- Pine Grove

### Topsail Island

- Surf City

## Next Gate

Full dry-run has been run for all gaps. Rerun it before any write if production beach state or terrain code changes:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:analyze --missing-only --dry-run --concurrency=4
```

Then run golden validation:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn terrain:validate
```

Current validator status: passes structurally but reports that it is using mock DEM/landmask data, with expected warnings for sheltered/bay golden beaches. Treat this as a no-regression smoke check, not proof of real terrain shape quality.

Only after Phase 0 is approved/applied and the harness can report 0-72h deltas should the non-dry-run terrain write be presented for human approval.
