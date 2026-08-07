# Tourmaline / Crystal Pier Source-Decay Diagnosis - 2026-06-27

Phase B result: **STOP - B depends on Phase D.** No production DB writes, no deploys, and no forecast-generation code changes were made.

## Scope

- Branch: `fix/tourmaline-source-decay`
- Repo: `quiver`
- Beaches: `tourmaline-surf-park`, `crystal-pier`
- Inputs reviewed:
  - `lib/utils/wave-formatters.ts`
  - `lib/services/forecast/forecast-builder.ts`
  - `lib/config/forecast-staleness.ts`
  - `lib/flags/decay-off.ts`
  - `__tests__/lib/services/forecast/forecast-builder-cdip-semantics.test.ts`
  - Primary checkout reports:
    - `.planning/forecast-coverage-debt-by-user-2026-06-26.md`
    - `.planning/forecast-debt-execution-plan-2026-06-27.md`
    - `.planning/forecast-replay-truth-2026-06-26.md`

No new production SELECTs were required for this phase; the diagnosis uses existing read-only reports plus local source inspection.

## Diagnosis

`tourmaline-surf-park` and `crystal-pier` are calibrated beaches, but the calibrated path only fires when the selected height source is `cdip_sig`.

The source path is:

1. `forecast-builder.ts` calls `getCDIPDataForTime(cdipData, forecastTime)` for each 3-hour forecast slot.
2. `getCDIPDataForTime` delegates to `resolveCdipNowcastPoint(...)`.
3. `resolveCdipNowcastPoint` drops any slot whose lead time exceeds `CDIP_NOWCAST_HORIZON_HOURS`.
4. `CDIP_NOWCAST_HORIZON_HOURS` equals `STALENESS_THRESHOLDS.CDIP`, currently 4 hours.
5. Slots inside that near-nowcast window can use CDIP and `selectWaveHeightSource(...)` can choose `cdip_sig`.
6. Most future horizon rows are outside that 4-hour window, so `cdipPoint` is null, `useCDIPData` is false, and `selectWaveHeightSource(...)` falls to `model_swell`.
7. `transformToFaceHeight(...)` only applies per-beach `shoaling_factors` for `source === "cdip_sig"` (or a guarded nowcast anchor). `model_swell` intentionally uses the generic transform.

This matches the source report: `tourmaline-surf-park` has 6 affected users, 5 home users, 98% `model_swell`, `deepwater_decay_factor = 0.40`, and display/raw near 0.48. `crystal-pier` has 2 affected home users, 98% `model_swell`, `deepwater_decay_factor = 0.40`, and display/raw near 0.43.

## Why no clean Phase B fix shipped

The tempting fix is to let calibrated CDIP buckets apply to `model_swell` horizon rows. That is the prohibited "decouple" approach, and the 2026-06-26 truth replay says it regresses:

| Segment | V0 obs MAE | V2 decouple obs MAE | Result |
| --- | ---: | ---: | --- |
| all | 0.4140 | 0.5005 | worse |
| tourmaline-surf-park | 0.0918 | 0.7017 | worse |
| crystal-pier | 0.2576 | 0.5931 | worse |
| `<0.5` decay bucket | 0.2405 | 0.6991 | worse |

The existing default-off `decay-off` flag also does not provide a clean fix for this slice:

- It only allows decay values in the 0.5-0.8 band.
- `tourmaline-surf-park` and `crystal-pier` are both at 0.40, outside that validated band.
- The replay confirms the `<0.5` decay bucket overshoots under V1 decay-off: obs MAE moves from 0.2405 to 0.4001 and bias flips positive.

Widening the CDIP nowcast horizon is not a clean fix either. It would reuse a nowcast observation as a multi-hour or multi-day forecast anchor, contrary to the locked test behavior that drops 5-hour-ahead slots beyond the 4-hour CDIP horizon. Without fresh validation against `observed_m` and session face truth, that would trade a known model-swell under-read for stale-nowcast drift.

Beach-specific decay handling for the 0.40 band also lacks proof. The replay shows `crystal-pier` improves on `observed_m` under decay-off, but `tourmaline-surf-park` regresses sharply on `observed_m`; the v5 comparator improves, but v5 is not face truth and cannot approve a display override by itself.

## Recommendation

Do not ship a Phase B code flag. The only available quick fix is the decouple approach, and it is explicitly disallowed because it regresses truth replay.

Proceed to Phase D and prototype a forecast-horizon-aware calibration model that learns from `model_swell` inputs against `observed_m` plus session face labels. The offline experiment should score:

- Current display (V0)
- Model-swell horizon calibration candidate
- v5 scoped allowlist candidate with overshoot guard
- Any CDIP-shape carry-forward candidate

Approval should require paired improvement on `observed_m` and no overshoot regression on session face truth, with `tourmaline-surf-park` and `crystal-pier` reported separately instead of hidden inside the fleet average.

## Test / validation status

No production code changed in Phase B, so no unit or typecheck gate was required. Validation consisted of source inspection and existing test/report review:

- `resolveCdipNowcastPoint` tests show fresh CDIP is accepted at 3h but dropped at 5h under the widened 4h horizon.
- `wave-height-transformer` tests lock the `shoaling_factors` short-circuit to `cdip_sig` and guarded nowcast anchors, not `model_swell`.
- The truth replay shows both prohibited decoupling and 0.40-band decay-off are not clean fixes for this phase.
