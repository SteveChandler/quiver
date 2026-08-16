# Track A Session Face-Height Truth

Date: 2026-06-18

## Question

Determine whether `sessions.wave_height_ft` is user-entered perceived face height or a forecast echo, and wire usable session truth into the Phase 0 harness.

## Code Evidence

Native session logging treats wave height as user-confirmed feedback:

- `quiver-native/src/hooks/use-forecast-prefill.ts` returns forecast labels only. It explicitly says saved wave height/quality are feedback, not a copy of the forecast.
- `quiver-native/src/screens/session-form.tsx` passes `waveHeightHint` to `WaveHeightSelector`, but `state.waveHeight` changes only through `onChange={(wh) => dispatchForm(setField('waveHeight', wh))}`.
- `quiver-native/src/lib/session-form-utils.ts` requires `state.touchedFields.has('waveHeight')` before save. A forecast hint alone fails validation.
- `buildSessionInsertPayload()` now also fail-closes at the write boundary: it writes `wave_height_ft` only when `state.touchedFields.has('waveHeight')`; otherwise a forecast-prefilled value serializes as `NULL`.
- Native offline flush posts that payload directly to Supabase REST; it does not replace `wave_height_ft` with forecast data.

Conclusion: native `sessions.wave_height_ft` is user-confirmed perceived face height for the current form path, with both validation and payload serialization guarding against forecast echoes.

## Existing DB Path

Quiver already mirrors session face-height labels into `session_wave_observation_candidates` through `sync_session_wave_observation_candidate(...)`.

Important safety detail: those rows are weak labels and do not update `ml_predictions_log.observed_m`.
Phase 0 matching now restricts candidate predictions to `display_source = 'face-Hs-transformer-v1'`, so session truth cannot bind to a non-display telemetry row when multiple prediction rows exist near the session time.

## Harness Change

`scripts/forecast-accuracy-harness.ts` now accepts:

```bash
--truth-source buoy
--truth-source session
--truth-source both
```

Default remains `buoy`, preserving existing Phase 0 behavior. `session` mode reads positive, non-rejected `session_wave_observation_candidates` rows, joins their matched `ml_predictions_log` rows for forecast inputs, and runs the same horizon-split MAE metric against user-reported face height.

## Live Read-Only Counts

Aggregate rerun:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-face-height-truth-report.ts --days 365 --output-json /tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json --fail-on-not-ready
```

Machine-readable aggregate artifact from the latest real-user rerun:

- `/tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json`

Saved-artifact validation:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-face-height-truth-report.ts --validate-output-json /tmp/quiver-session-face-height-truth-report-20260620-current-refresh.json --max-report-age-hours 24
```

Result: PASS. The JSON artifact carries `reportSchemaVersion: 2`. The validator
rejects stale reports, stale measurement windows, malformed aggregate
counts/rates, UUID leakage, positive-label horizon sections that do not
reconcile to top-level counts, unmatched-positive diagnostics that do not
reconcile to unmatched/non-canonical counts, impossible latest matched-label
timestamps relative to matched counts, and readiness blocks that are not derived
from the report's own counts, criteria, and freshness window.
Current artifact SHA-256: `d53c82072b3b6cce0b1201276ae2de047130a4a31922c68cac57cb8997702fba`.

Focused verification:

- `yarn jest scripts/__tests__/session-face-height-truth-report.test.ts __tests__/scripts/session-truth-relinkability-sql.test.ts --runInBand` passed after schema-v2 horizon/diagnostic reconciliation and latest-label timestamp/count hardening: 2 suites, 29 tests.
- Prior harness and relinkability verification with `yarn jest scripts/__tests__/session-face-height-truth-report.test.ts scripts/__tests__/forecast-accuracy-harness.test.ts __tests__/scripts/session-truth-relinkability-sql.test.ts --runInBand` passed: 3 suites, 71 tests.

Relinkability diagnostic:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-a-session-truth-relinkability.sql
```

Result: PASS, read-only transaction rolled back.

The Track A report, harness session-truth path, and relinkability diagnostic now
exclude mock, system, deleted, analytics-excluded, and missing-profile users
before counting weak labels as truth evidence.

Last 365 days:

- Latest read-only schema-v2 real-user rerun generated at `2026-06-20T12:59:52.249Z`; `--fail-on-not-ready` exited `2`, as expected.
- Session wave observation candidate rows: 55
- Accepted positive weak-label rows: 53
- Matched positive weak-label rows: 29
- Matched positive beach coverage: 18 beaches
- Matched positive user coverage: 14 users
- Latest matched positive observed at: `2026-06-19T16:40:00.000Z`
- Latest matched `0-72h` positive observed at: none
- Unmatched positive weak-label rows: 24
- Matched positive horizon coverage: `73h+` only
- Positive label coverage by horizon:

| Horizon | Positive labels | Linked | Unlinked | Non-canonical linked | Canonical matched | Unmatched |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `0-24h` | 1 | 0 | 1 | 0 | 0 | 1 |
| `25-72h` | 0 | 0 | 0 | 0 | 0 | 0 |
| `73h+` | 51 | 29 | 22 | 0 | 29 | 22 |
| `unknown` | 1 | 0 | 1 | 0 | 0 | 1 |

- Unmatched positive diagnostics now separate unlinked predictions from non-canonical links. Latest read-only schema-v2 real-user rerun found all 24 unmatched positive labels are `unlinked_prediction` cases: 22 at `73h+`, 1 `unknown`, and 1 at `0-24h`. Source split: 21 `backfill`, 3 `trigger`. There are currently 0 non-canonical linked positive labels.
- Latest relinkability diagnostic refreshed on 2026-06-20 at `2026-06-20T12:59:52Z` after the report rerun for those 24 unlinked positive labels found 0 canonical `face-Hs-transformer-v1` predictions within the same +/-6h matching window, including 0 relinkable `0-72h` labels. This means the current blocker is missing canonical prediction rows near those sessions, not stale candidate links that can be fixed by a no-op rematch.
- Matched snapshot completeness: 29/29 display height, 29/29 raw OM height, 29/29 v5 shadow height.
- Reported-height consistency: 29/29 matched positive rows have `observed_m` matching `reported_wave_height_ft` within `0.010 m`.

Readiness gate added:

- Default criteria: matched positive weak labels `>=100`, matched `0-72h` weak labels `>=75`, matched positive beaches `>=10`, matched positive users `>=10`, display/raw OM/v5 snapshot completeness `>=95%`, reported-height consistency `>=100%`, and latest matched `0-72h` weak label age `<=30` days.
- Default echo-risk guard: matched weak labels that exactly match the display-height snapshot within `0.05 ft` must stay `<=25%`. This is a heuristic guard against forecast-prefilled values being mistaken for independent face-height truth.
- Matched weak-label counts now require a canonical `face-Hs-transformer-v1` display-source link. Non-canonical or unknown linked predictions are reported separately and cannot satisfy the truth-readiness floors.
- The readiness JSON now also emits `readiness.findingCodes`, a stable machine-readable companion to the human-readable `readiness.findings`.
- Current verdict: `not-ready`.
- Current observed values: 29 matched positive weak labels, 0 matched `0-72h` weak labels, 18 matched beaches, 14 matched users, 100% display/raw OM/v5 snapshot completeness, 100% reported-height consistency, 6.9% display-height echo risk, and no matched `0-72h` label for freshness proof.
- Current readiness finding codes: `matched_positive_candidates_floor`, `short_horizon_matched_candidates_floor`, `short_horizon_freshness_missing`.
- `--fail-on-not-ready` exits `2` for automation while still printing the aggregate report.

Last 30 days via harness:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source session --output-json /tmp/quiver-track-a-session-truth-harness-20260620-current-refresh.json
```

Result: PASS. Latest rerun wrote `/tmp/quiver-track-a-session-truth-harness-20260620-current-refresh.json`.

Latest harness JSON was generated at `2026-06-20T12:59:52.599Z`; row counts remained 0 buoy rows, 29 session rows, 29 matched prediction rows, and 0 matched `0-72h` rows. The saved harness validates with `yarn tsx scripts/forecast-accuracy-report-validate.ts --report-json /tmp/quiver-track-a-session-truth-harness-20260620-current-refresh.json --max-report-age-hours 24`. Harness artifact SHA-256: `a3c40a12189e2a56a7c58a42a4583bd18aee156eb3cb1f0b3247c405f0c1820b`.

| Horizon | Baseline | N | MAE | Bias |
| --- | --- | ---: | ---: | ---: |
| 73h+ | Current display | 29 | 0.389m | -0.237m |
| 73h+ | Raw display | 29 | 0.389m | -0.237m |
| 73h+ | Raw OM | 29 | 0.355m | 0.126m |
| 73h+ | v5 shadow | 29 | 0.366m | 0.072m |

Tourmaline combined truth smoke:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/forecast-accuracy-harness.ts --days 30 --truth-source both --beach-slugs tourmaline
```

Result: 191 buoy rows + 1 session row, all `73h+`.

## Surfline Parity External Check

Track A also has an opt-in Surfline LOTUS comparison through Playwright:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:e2e:surfline-parity
```

Harness fixes applied:

- The package script now passes `api/surfline-parity.spec.ts`, which matches the repo's Playwright `testDir` configuration.
- The Surfline browser context now uses an explicit empty storage state, so the unauthenticated external check does not require `e2e/.auth/state.json` from the auth project.

Latest result: PASS, 7/7 tests.

Comparison set:

| Quiver beach | Surfline spot | Relation | Quiver | Surfline | Midpoint delta | Time delta |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Blacks Beach | Blacks Beach | exact | 4.2-4.2ft | 4.0-5.0ft | 0.30ft | 1.00h |
| Windansea | Blacks Beach | similar-beach | 3.9-3.9ft | 4.0-5.0ft | 0.60ft | 1.00h |
| Huntington Beach Pier Southside | Huntington Beach Pier Southside | exact | 1.1-1.1ft | 4.0-5.0ft | 3.40ft | 1.00h |
| Huntington Beach Pier | Huntington Beach Pier Northside | similar-beach | 1.1-1.1ft | 3.0-4.0ft | 2.40ft | 1.00h |
| Huntington Beach Pier Northside | Huntington Beach Pier Northside | exact | 0.8-0.8ft | 3.0-4.0ft | 2.70ft | 1.00h |
| The Wedge | The Wedge | exact | 1.4-1.4ft | 4.0-5.0ft | 3.10ft | 1.00h |

This is not the Phase 0 approval metric and should not be used to claim model lift. It is a third-party external face-height sanity check that verifies Quiver's public display remains within intentionally loose Surfline tolerances for a small fixed target set.

## Remaining Gap

This wires session face-height truth into the metric path, but current production data still lacks 0-72h session/buoy rows for these harness checks. The current Track A bottleneck is split: `0-24h` has a single positive weak label but no linked canonical prediction, `25-72h` has no positive weak labels at all, and the remaining unmatched positive labels have no canonical prediction within the current matching window. The readiness gate also now requires matched positive beach/user diversity, reported-height consistency, and fresh matched `0-72h` weak-label evidence so stale or long-horizon-only session truth cannot satisfy Track A. Phase 0 application remains the gate before any coverage change can satisfy the required 0-72h proof.
