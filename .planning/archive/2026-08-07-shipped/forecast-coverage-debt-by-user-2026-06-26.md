# Forecast Coverage Debt By User - 2026-06-26

Generated: 2026-06-27T16:02:20.024669+00:00

Read-only production diagnosis. No production mutations, no migrations, no code changes, no raw user IDs, no raw session IDs, no emails, and no credentials are included. Users are anonymized as `user_NNN`; custom spots are anonymized as `custom_NNN`.

## Scope

| Metric | Value |
| --- | --- |
| Non-mock/non-system profiles | 157 |
| Analytics-real profiles | 148 |
| Profiles with home beach | 95 |
| Users with home/favorite/custom/alert targets | 97 |
| Target rows swept | 214 |
| Custom spots swept | 20 |
| Enabled alert rules swept | 55 |
| Sessions with reported wave height | 56 |
| Sessions matched to displayed forecast snapshot | 55 |

## Executive Diagnosis

- Structural coverage debt affects 51 users; 42 have the issue on their home beach.
- The biggest localized user-impact buckets are uncalibrated beaches, inert windows, and custom-spot fingerprint/fallback debt. The 55 mi custom fallback problem is present as three anonymized custom spots on one user, all falling back to Isle of Palms at 55.3-57.6 mi.
- The keystone Monterey/Central Coast beaches are not stale: their future forecast rows were freshly written on June 27, 2026 UTC. Their visible rows are dominated by `model_swell`, have zero calibrated shoaling rows, and under-read OM/v5 side comparators.
- Separately, `ml_predictions_log` sidecar coherence is globally broken for current/future rows: it diverges or lacks replay fields across nearly every user target. I do not count that as a localized structural bucket, but it is the first fix gate because it poisons approval evidence and ML-log diagnostics.
- Session truth prices the lived error at 55 matched sessions: weighted MAE 1.27 ft, signed bias -0.71 ft, and under-read rate 49%. Direct forecast-accuracy feedback is almost absent: 55 `NULL`, 1 `somewhat`, and 0 `forecast_accuracy_votes`.

## Part A - Structural Debt Sweep

These are localized config/coverage buckets, excluding the global ML-log sidecar issue.

| Bucket | Surfers helped | Home surfers | Target rows | Fallback beaches/custom spots | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| uncalibrated | 36 | 33 | 81 | 35 | Fallback beach has no `shoaling_factors`; model path cannot use per-beach calibration. |
| inert-window | 17 | 15 | 30 | 10 | Swell window is missing or effectively too wide (>=140 deg), so geometry is weak. |
| decay-coherence | 10 | 8 | 14 | 4 | Strong decay plus model_swell dominance and low display/raw ratio on calibrated beaches. |
| no-fingerprint | 9 | 0 | 18 | 13 | Custom spot lacks complete fingerprint fields/window/offshore metadata. |
| far-fallback | 3 | 0 | 5 | 3 | Custom spot nearest fallback is >5 mi; >25 mi treated severe. |

### Global Sidecar/Provenance Gate

These signals are real, but they are instrumentation/coherence blockers, not localized coverage buckets.

| Signal | Users touched | Home users touched | Target rows | Fallback beaches | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| source-provenance-gap | 96 | 94 | 211 | 81 | ML log replay fields missing for some current/future rows |
| ml-log-divergence | 97 | 95 | 214 | 83 | enhanced_forecasts display and ml_predictions_log sidecar differ >0.35 ft on matched rows |

### Per-User Structural Priority

Rank order: home structural issue first, then session MAE, then structural score. All users are anonymized.

| Rank | User | Home structural | Targets | Debt targets | Buckets | Home evidence | Session n | Session MAE | Bias | Under-read | Max custom fallback |
| ---: | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | user_126 | yes | 2 | 2 | inert-window, uncalibrated | ponce-inlet-ponce-inlet-fl (inert-window,uncalibrated) | 1 | 6.50 ft | -6.50 ft | 100% |  |
| 2 | user_116 | yes | 3 | 3 | inert-window, uncalibrated | cocoa-beach-pier-cocoa-beach-fl (inert-window,uncalibrated) | 1 | 0.50 ft | -0.50 ft | 100% |  |
| 3 | user_129 | yes | 5 | 2 | decay-coherence, inert-window | tourmaline-surf-park (decay-coherence,inert-window) | 1 | 0.30 ft | 0.30 ft | 0% |  |
| 4 | user_102 | yes | 1 | 1 | uncalibrated | la-ocho (uncalibrated) | 1 | 0.20 ft | 0.20 ft | 0% |  |
| 5 | user_140 | yes | 7 | 7 | far-fallback, no-fingerprint, uncalibrated | isle-of-palms-isle-of-palms-sc (uncalibrated) |  |  |  |  | 57.5 mi |
| 6 | user_152 | yes | 5 | 5 | far-fallback, no-fingerprint, uncalibrated | la-pared (uncalibrated) |  |  |  |  | 26.5 mi |
| 7 | user_095 | yes | 5 | 5 | inert-window, uncalibrated | westport-jetty-westport-wa (inert-window,uncalibrated) |  |  |  |  |  |
| 8 | user_128 | yes | 2 | 2 | decay-coherence, inert-window | tourmaline-surf-park (decay-coherence,inert-window) |  |  |  |  |  |
| 9 | user_124 | yes | 4 | 4 | no-fingerprint, uncalibrated | 36th-42nd-street-sea-isle-city-nj (uncalibrated) |  |  |  |  |  |
| 10 | user_115 | yes | 2 | 2 | decay-coherence | crystal-pier (decay-coherence) |  |  |  |  |  |
| 11 | user_146 | yes | 2 | 2 | decay-coherence | crystal-pier (decay-coherence) |  |  |  |  |  |
| 12 | user_049 | yes | 6 | 5 | uncalibrated | linda-mar-pacifica-ca (uncalibrated) |  |  |  |  |  |
| 13 | user_118 | yes | 3 | 3 | no-fingerprint, uncalibrated | pine-trees-kohanaiki (uncalibrated) |  |  |  |  |  |
| 14 | user_144 | yes | 5 | 5 | uncalibrated | surfside-beach-surfside-beach-tx (uncalibrated) |  |  |  |  |  |
| 15 | user_009 | yes | 1 | 1 | decay-coherence, inert-window | tourmaline-surf-park (decay-coherence,inert-window) |  |  |  |  |  |
| 16 | user_094 | yes | 1 | 1 | decay-coherence, inert-window | tourmaline-surf-park (decay-coherence,inert-window) |  |  |  |  |  |
| 17 | user_096 | yes | 1 | 1 | decay-coherence, inert-window | tourmaline-surf-park (decay-coherence,inert-window) |  |  |  |  |  |
| 18 | user_039 | yes | 2 | 2 | inert-window, uncalibrated | jacksonville-beach-pier-jacksonville-beach-fl (inert-window,uncalibrated) |  |  |  |  |  |
| 19 | user_066 | yes | 2 | 2 | inert-window, uncalibrated | marias (inert-window,uncalibrated) |  |  |  |  |  |
| 20 | user_120 | yes | 2 | 2 | inert-window, uncalibrated | cape-hatteras-lighthouse-buxton-nc (inert-window,uncalibrated) |  |  |  |  |  |
| 21 | user_121 | yes | 2 | 2 | inert-window, uncalibrated | ponce-inlet-ponce-inlet-fl (inert-window,uncalibrated) |  |  |  |  |  |
| 22 | user_033 | yes | 1 | 1 | decay-coherence | swamis (decay-coherence) |  |  |  |  |  |
| 23 | user_040 | yes | 1 | 1 | inert-window, uncalibrated | ponce-inlet-ponce-inlet-fl (inert-window,uncalibrated) |  |  |  |  |  |
| 24 | user_042 | yes | 2 | 2 | uncalibrated | malibu-third-point-malibu-ca (uncalibrated) |  |  |  |  |  |
| 25 | user_053 | yes | 2 | 2 | uncalibrated | ocean-beach-middle-san-francisco-ca (uncalibrated) |  |  |  |  |  |
| 26 | user_058 | yes | 2 | 2 | uncalibrated | malibu-third-point-malibu-ca (uncalibrated) |  |  |  |  |  |
| 27 | user_067 | yes | 2 | 2 | uncalibrated | malibu-third-point-malibu-ca (uncalibrated) |  |  |  |  |  |
| 28 | user_071 | yes | 2 | 2 | uncalibrated | 1st-street-jetty-ocean-city-nj (uncalibrated) |  |  |  |  |  |
| 29 | user_078 | yes | 2 | 2 | uncalibrated | waikiki-beach (uncalibrated) |  |  |  |  |  |
| 30 | user_079 | yes | 2 | 2 | uncalibrated | dockweiler-state-beach-playa-del-rey-ca (uncalibrated) |  |  |  |  |  |
| 31 | user_106 | yes | 1 | 1 | inert-window, uncalibrated | jacksonville-beach-pier-jacksonville-beach-fl (inert-window,uncalibrated) |  |  |  |  |  |
| 32 | user_134 | yes | 2 | 2 | uncalibrated | garrapata-southern-coves-carmel-ca (uncalibrated) |  |  |  |  |  |
| 33 | user_141 | yes | 2 | 2 | uncalibrated | bolinas-bolinas-ca (uncalibrated) |  |  |  |  |  |
| 34 | user_147 | yes | 2 | 2 | uncalibrated | pacific-city-cape-kiwanda (uncalibrated) |  |  |  |  |  |
| 35 | user_148 | yes | 2 | 2 | uncalibrated | isle-of-palms-isle-of-palms-sc (uncalibrated) |  |  |  |  |  |
| 36 | user_059 | yes | 1 | 1 | uncalibrated | steamer-lane-santa-cruz-ca (uncalibrated) |  |  |  |  |  |
| 37 | user_060 | yes | 1 | 1 | uncalibrated | malibu-third-point-malibu-ca (uncalibrated) |  |  |  |  |  |
| 38 | user_069 | yes | 1 | 1 | uncalibrated | satellite-beach-satellite-beach-fl (uncalibrated) |  |  |  |  |  |
| 39 | user_085 | yes | 1 | 1 | inert-window | big-rock-la-jolla-ca (inert-window) |  |  |  |  |  |
| 40 | user_086 | yes | 1 | 1 | uncalibrated | rockaway-beach-98th-st-queens-ny (uncalibrated) |  |  |  |  |  |
| 41 | user_093 | yes | 1 | 1 | uncalibrated | linda-mar-pacifica-ca (uncalibrated) |  |  |  |  |  |
| 42 | user_157 | yes | 1 | 1 | uncalibrated | el-cocal-yabucoa-pr (uncalibrated) |  |  |  |  |  |
| 43 | user_076 | no | 3 | 1 | decay-coherence, inert-window |  | 2 | 1.60 ft | -1.60 ft | 100% |  |
| 44 | user_062 | no | 5 | 1 | inert-window, uncalibrated |  | 5 | 1.06 ft | 1.02 ft | 0% |  |
| 45 | user_020 | no | 5 | 2 | no-fingerprint |  | 9 | 0.83 ft | -0.21 ft | 33% |  |
| 46 | user_007 | no | 14 | 6 | no-fingerprint |  | 7 | 0.57 ft | -0.06 ft | 29% |  |
| 47 | user_063 | no | 5 | 1 | no-fingerprint |  | 1 | 0.20 ft | -0.20 ft | 0% |  |
| 48 | user_149 | no | 1 | 1 | far-fallback, no-fingerprint, uncalibrated |  |  |  |  |  | 8.1 mi |
| 49 | user_064 | no | 1 | 1 | decay-coherence |  |  |  |  |  |  |
| 50 | user_154 | no | 3 | 1 | no-fingerprint |  |  |  |  |  |  |
| 51 | user_098 | no | 2 | 1 | uncalibrated |  |  |  |  |  |  |

### Far-Fallback Custom Spots

| User | Custom | Fallback beach | Distance | Buckets |
| --- | --- | --- | ---: | --- |
| user_140 | custom_015 | isle-of-palms-isle-of-palms-sc | 57.55 mi | no-fingerprint, far-fallback, uncalibrated |
| user_140 | custom_012 | isle-of-palms-isle-of-palms-sc | 55.34 mi | no-fingerprint, far-fallback, uncalibrated |
| user_140 | custom_020 | isle-of-palms-isle-of-palms-sc | 55.32 mi | no-fingerprint, far-fallback, uncalibrated |
| user_152 | custom_011 | la-pared | 26.51 mi | no-fingerprint, far-fallback, uncalibrated |
| user_149 | custom_006 | sunset-beach | 8.10 mi | no-fingerprint, far-fallback, uncalibrated |

### Config/Coherence Hotspots

| Beach | Users | Home users | Targets | Decay | Model-swell | Display/raw | Diagnosis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| tourmaline-surf-park | 6 | 5 | 8 | 0.40 | 98% | 0.48 | calibrated beach but model_swell dominates; decay/window coherence should be reviewed |
| crystal-pier | 2 | 2 | 4 | 0.40 | 98% | 0.43 | calibrated beach but model_swell dominates; decay/window coherence should be reviewed |
| pb-point | 1 | 0 | 1 | 0.40 | 98% | 0.52 | calibrated beach but model_swell dominates; decay/window coherence should be reviewed |
| swamis | 1 | 1 | 1 | 0.60 | 98% | 0.56 | calibrated beach but model_swell dominates; decay/window coherence should be reviewed |

## Part B - Keystone Forecast-QA Traces

| Beach | Primary mechanism | Observable | Station | Rows | Model-swell | Calibrated | Avg display | Avg raw | Display/raw | V5 under-read | OM under-read | EF/ML divergent |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| carmel-river-state-beach-carmel-ca | uncalibrated/model_swell + ML-log divergence | no | 46240 | 56 | 56 | 0 | 2.4 ft | 4.4 ft | 0.60 | 100% | 100% | 50 |
| garrapata-southern-coves-carmel-ca | uncalibrated/model_swell + ML-log divergence | yes | edu_ucsd_cdip_157 | 56 | 56 | 0 | 3.2 ft | 4.8 ft | 1.05 | 100% | 100% | 50 |
| ghost-tree-pebble-beach-ca | uncalibrated/model_swell + ML-log divergence | yes | 46092 | 56 | 56 | 0 | 4.2 ft | 4.7 ft | 0.97 | 100% | 100% | 55 |
| steamer-lane-santa-cruz-ca | uncalibrated/model_swell + broad window + ML-log divergence | yes | 46092 | 56 | 56 | 0 | 3.0 ft | 3.3 ft | 1.54 | 99% | 100% | 53 |

### Carmel River State Beach (carmel-river-state-beach-carmel-ca)

Verdict: `FAIL` - visible rows are uncalibrated `model_swell` with no calibrated shoaling; the ML sidecar also diverges. Display under-reads v5 by -4.3 ft and OM by -4.3 ft on average.

| Layer | Status | Evidence | Next action |
| --- | --- | --- | --- |
| upstream | PASS | 56 rows; model_swell 56/56, cdip_sig 0/56 | Fix source choice/calibration, not ingestion availability |
| parser | PASS | enhanced_forecasts wave_height_provenance present; 0 calibrated rows | Keep provenance on enhanced_forecasts |
| database | PASS | fresh 56-row future horizon; write-time check refreshed 2026-06-27 UTC | No stale-row regeneration action needed |
| scoring | FAIL | FAIL: uncalibrated model_swell path, no calibrated rows, avg display-v5 -4.3 ft, avg display-OM -4.3 ft | Tune config/calibration/source gates |
| ui | UNKNOWN | UNKNOWN: browser UI not opened; DB display row is populated | Run browser/UI spot check only after scoring/log fix |
| ml_log_sidecar | FAIL | FAIL: 50 EF/ML sidecar divergent rows; max delta 3.2 ft | Make ml_predictions_log replay exactly match displayed forecast rows |
| external_comparison | UNKNOWN | UNKNOWN: no Surfline/CDIP external fetch in this run; OM/v5 side comparators used | Optional Surfline/CDIP manual parity after internal coherence |

| Forecast slot | Source | Path | Display | Raw input | Display/raw | Calibrated |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026-07-04T15:00:00+00:00 | model_swell | scalar_generic | 2.1 ft | 4.5 ft | 0.47 | no |
| 2026-07-04T03:00:00+00:00 | model_swell | scalar_generic | 2.2 ft | 4.7 ft | 0.47 | no |
| 2026-07-03T12:00:00+00:00 | model_swell | scalar_generic | 2.6 ft | 5.4 ft | 0.48 | no |
| 2026-07-03T15:00:00+00:00 | model_swell | scalar_generic | 2.7 ft | 5.6 ft | 0.48 | no |

### Garrapata State Beach (southern coves) (garrapata-southern-coves-carmel-ca)

Verdict: `FAIL` - visible rows are uncalibrated `model_swell` with no calibrated shoaling; the ML sidecar also diverges. Display under-reads v5 by -3.8 ft and OM by -3.9 ft on average.

| Layer | Status | Evidence | Next action |
| --- | --- | --- | --- |
| upstream | PASS | 56 rows; model_swell 56/56, cdip_sig 0/56 | Fix source choice/calibration, not ingestion availability |
| parser | PASS | enhanced_forecasts wave_height_provenance present; 0 calibrated rows | Keep provenance on enhanced_forecasts |
| database | PASS | fresh 56-row future horizon; write-time check refreshed 2026-06-27 UTC | No stale-row regeneration action needed |
| scoring | FAIL | FAIL: uncalibrated model_swell path, no calibrated rows, avg display-v5 -3.8 ft, avg display-OM -3.9 ft | Tune config/calibration/source gates |
| ui | UNKNOWN | UNKNOWN: browser UI not opened; DB display row is populated | Run browser/UI spot check only after scoring/log fix |
| ml_log_sidecar | FAIL | FAIL: 50 EF/ML sidecar divergent rows; max delta 3.7 ft | Make ml_predictions_log replay exactly match displayed forecast rows |
| external_comparison | UNKNOWN | UNKNOWN: no Surfline/CDIP external fetch in this run; OM/v5 side comparators used | Optional Surfline/CDIP manual parity after internal coherence |

| Forecast slot | Source | Path | Display | Raw input | Display/raw | Calibrated |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026-07-03T18:00:00+00:00 | model_swell | scalar_generic | 2.6 ft | 5.5 ft | 0.47 | no |
| 2026-07-04T12:00:00+00:00 | model_swell | scalar_generic | 2.2 ft | 4.7 ft | 0.47 | no |
| 2026-07-04T09:00:00+00:00 | model_swell | scalar_generic | 2.2 ft | 4.7 ft | 0.47 | no |
| 2026-07-04T15:00:00+00:00 | model_swell | scalar_generic | 2.2 ft | 4.6 ft | 0.48 | no |

### Ghost Tree (ghost-tree-pebble-beach-ca)

Verdict: `FAIL` - visible rows are uncalibrated `model_swell` with no calibrated shoaling; the ML sidecar also diverges. Display under-reads v5 by -2.6 ft and OM by -2.7 ft on average.

| Layer | Status | Evidence | Next action |
| --- | --- | --- | --- |
| upstream | PASS | 56 rows; model_swell 56/56, cdip_sig 0/56 | Fix source choice/calibration, not ingestion availability |
| parser | PASS | enhanced_forecasts wave_height_provenance present; 0 calibrated rows | Keep provenance on enhanced_forecasts |
| database | PASS | fresh 56-row future horizon; write-time check refreshed 2026-06-27 UTC | No stale-row regeneration action needed |
| scoring | FAIL | FAIL: uncalibrated model_swell path, no calibrated rows, avg display-v5 -2.6 ft, avg display-OM -2.7 ft | Tune config/calibration/source gates |
| ui | UNKNOWN | UNKNOWN: browser UI not opened; DB display row is populated | Run browser/UI spot check only after scoring/log fix |
| ml_log_sidecar | FAIL | FAIL: 55 EF/ML sidecar divergent rows; max delta 5.1 ft | Make ml_predictions_log replay exactly match displayed forecast rows |
| external_comparison | UNKNOWN | UNKNOWN: no Surfline/CDIP external fetch in this run; OM/v5 side comparators used | Optional Surfline/CDIP manual parity after internal coherence |

| Forecast slot | Source | Path | Display | Raw input | Display/raw | Calibrated |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026-07-04T03:00:00+00:00 | model_swell | scalar_generic | 3.8 ft | 4.8 ft | 0.79 | no |
| 2026-07-04T00:00:00+00:00 | model_swell | scalar_generic | 3.8 ft | 4.8 ft | 0.79 | no |
| 2026-07-04T12:00:00+00:00 | model_swell | scalar_generic | 4.1 ft | 5.1 ft | 0.80 | no |
| 2026-07-03T21:00:00+00:00 | model_swell | scalar_generic | 4.1 ft | 5.1 ft | 0.80 | no |

### Steamer Lane (steamer-lane-santa-cruz-ca)

Verdict: `FAIL` - visible rows are uncalibrated `model_swell` with no calibrated shoaling and a very broad 138 deg swell window; the ML sidecar also diverges. Display under-reads v5 by -2.5 ft and OM by -2.6 ft on average.

| Layer | Status | Evidence | Next action |
| --- | --- | --- | --- |
| upstream | PASS | 56 rows; model_swell 56/56, cdip_sig 0/56 | Fix source choice/calibration, not ingestion availability |
| parser | PASS | enhanced_forecasts wave_height_provenance present; 0 calibrated rows | Keep provenance on enhanced_forecasts |
| database | PASS | fresh 56-row future horizon; write-time check refreshed 2026-06-27 UTC | No stale-row regeneration action needed |
| scoring | FAIL | FAIL: uncalibrated model_swell path, no calibrated rows, broad swell window, avg display-v5 -2.5 ft, avg display-OM -2.6 ft | Tune config/calibration/source gates |
| ui | UNKNOWN | UNKNOWN: browser UI not opened; DB display row is populated | Run browser/UI spot check only after scoring/log fix |
| ml_log_sidecar | FAIL | FAIL: 53 EF/ML sidecar divergent rows; max delta 2.0 ft | Make ml_predictions_log replay exactly match displayed forecast rows |
| external_comparison | UNKNOWN | UNKNOWN: no Surfline/CDIP external fetch in this run; OM/v5 side comparators used | Optional Surfline/CDIP manual parity after internal coherence |

| Forecast slot | Source | Path | Display | Raw input | Display/raw | Calibrated |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026-07-03T21:00:00+00:00 | model_swell | scalar_generic | 1.6 ft | 3.3 ft | 0.49 | no |
| 2026-07-04T12:00:00+00:00 | model_swell | scalar_generic | 1.7 ft | 3.5 ft | 0.49 | no |
| 2026-07-04T00:00:00+00:00 | model_swell | scalar_generic | 1.6 ft | 3.2 ft | 0.50 | no |
| 2026-07-04T15:00:00+00:00 | model_swell | scalar_generic | 1.7 ft | 3.4 ft | 0.50 | no |

## Part C - Session Ground Truth

Matched session truth summary: 55 sessions, weighted MAE 1.27 ft, signed bias -0.71 ft where negative means forecast under-read the surfer, and under-read rate 49%.

Direct feedback cross-check: `sessions.forecast_accuracy` is `NULL` on 55 of 56 reported-height sessions and `somewhat` on 1. `forecast_accuracy_votes` has 0 non-mock/non-system rows, so direct feedback currently cannot corroborate or refute the wave-height truth stream.

| Spot | Region | Matched sessions | MAE | Bias | Under-read | Custom fallback |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ponce-inlet-ponce-inlet-fl | Central Florida | 1 | 6.50 ft | -6.50 ft | 100% |  |
| ocean-beach | San Diego | 1 | 2.80 ft | -2.80 ft | 100% |  |
| church | Orange County | 1 | 2.60 ft | -2.60 ft | 100% |  |
| avalanche | San Diego | 4 | 2.50 ft | -2.50 ft | 100% |  |
| ocean-beach-pier | San Diego | 4 | 2.03 ft | -2.03 ft | 100% |  |
| del-mar | San Diego | 3 | 1.83 ft | -1.83 ft | 67% | 0.38 mi |
| oceanside-harbor | San Diego | 1 | 1.80 ft | -1.80 ft | 100% |  |
| tourmaline | San Diego | 1 | 1.70 ft | -1.70 ft | 100% |  |
| blackies | Orange County | 3 | 1.43 ft | 1.37 ft | 0% |  |
| huntington-beach-pier-southside | Orange County | 1 | 1.40 ft | -1.40 ft | 100% |  |
| la-jolla-shores | San Diego | 5 | 1.32 ft | -0.76 ft | 60% |  |
| the-rock-oceanside | San Diego | 1 | 1.20 ft | -1.20 ft | 100% |  |
| huntington-state-beach | Orange County | 1 | 1.10 ft | 1.10 ft | 0% |  |
| newport-lower-jetties | Orange County | 1 | 1.00 ft | 1.00 ft | 0% |  |
| san-clemente-state-beach | Orange County | 1 | 1.00 ft | -1.00 ft | 100% | 0.42 mi |
| hb-cliffs | Orange County | 6 | 0.82 ft | -0.28 ft | 33% | 0.67 mi |
| waikiki-queens | Oahu | 3 | 0.80 ft | 0.80 ft | 0% |  |
| waikiki-canoes | Oahu | 1 | 0.60 ft | 0.60 ft | 0% |  |
| seaside-reef | San Diego | 1 | 0.60 ft | -0.60 ft | 100% |  |
| ponto | San Diego | 7 | 0.56 ft | -0.04 ft | 29% | 2.09 mi |
| cocoa-beach-pier-cocoa-beach-fl | Space Coast | 1 | 0.50 ft | -0.50 ft | 100% |  |
| tourmaline-surf-park | San Diego | 1 | 0.30 ft | 0.30 ft | 0% |  |
| la-ocho | San Juan Metro | 1 | 0.20 ft | 0.20 ft | 0% |  |
| scripps | San Diego | 3 | 0.20 ft | 0.13 ft | 0% |  |
| river-jetties | Orange County | 1 | 0.10 ft | 0.10 ft | 0% |  |
| newport-upper-jetties | Orange County | 1 | 0.00 ft | -0.00 ft | 0% |  |

### Per-User Session Error

| User | Sessions | Matched | MAE | Bias | Under-read | Custom sessions | Max custom fallback | Forecast accuracy counts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| user_126 | 1 | 1 | 6.50 ft | -6.50 ft | 100% | 0 |  | {"null": 1} |
| user_087 | 1 | 1 | 2.80 ft | -2.80 ft | 100% | 0 |  | {"null": 1} |
| user_022 | 14 | 14 | 1.94 ft | -1.69 ft | 79% | 1 | 0.38 mi | {"null": 14} |
| user_127 | 1 | 1 | 1.70 ft | -1.70 ft | 100% | 0 |  | {"null": 1} |
| user_076 | 2 | 2 | 1.60 ft | -1.60 ft | 100% | 0 |  | {"null": 2} |
| user_046 | 2 | 2 | 1.50 ft | -1.50 ft | 100% | 0 |  | {"null": 2} |
| user_062 | 5 | 5 | 1.06 ft | 1.02 ft | 0% | 0 |  | {"null": 5} |
| user_065 | 6 | 6 | 1.03 ft | -0.03 ft | 33% | 0 |  | {"null": 6} |
| user_075 | 1 | 1 | 0.90 ft | -0.90 ft | 100% | 0 |  | {"null": 1} |
| user_020 | 9 | 9 | 0.83 ft | -0.21 ft | 33% | 5 | 0.67 mi | {"null": 9} |
| user_007 | 7 | 7 | 0.57 ft | -0.06 ft | 29% | 7 | 2.09 mi | {"null": 7} |
| user_116 | 1 | 1 | 0.50 ft | -0.50 ft | 100% | 0 |  | {"null": 1} |
| user_129 | 1 | 1 | 0.30 ft | 0.30 ft | 0% | 0 |  | {"null": 1} |
| user_063 | 1 | 1 | 0.20 ft | -0.20 ft | 0% | 0 |  | {"null": 1} |
| user_102 | 1 | 1 | 0.20 ft | 0.20 ft | 0% | 0 |  | {"null": 1} |
| user_017 | 2 | 2 | 0.10 ft | 0.00 ft | 0% | 0 |  | {"null": 2} |
| user_031 | 1 | 0 |  |  |  | 0 |  | {"somewhat": 1} |

### Highest Lived Errors

| User | Spot | Custom | Reported | Displayed | Error | Bias | Under-read | Raw OM | V5 | Horizon | Quality |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| user_126 | ponce-inlet-ponce-inlet-fl |  | 7.0 ft | 0.5 ft | 6.5 ft | -6.5 ft | yes | 1.2 ft | 2.5 ft | 159h | weak |
| user_022 | avalanche |  | 5.0 ft | 1.2 ft | 3.8 ft | -3.8 ft | yes | 3.5 ft | 4.2 ft | 165h | weak |
| user_062 | blackies |  | 1.0 ft | 4.7 ft | 3.7 ft | 3.7 ft | no | 4.7 ft | 4.4 ft | 162h | weak |
| user_022 | avalanche |  | 5.0 ft | 1.9 ft | 3.1 ft | -3.1 ft | yes | 4.6 ft | 4.1 ft | 168h | weak |
| user_022 | la-jolla-shores |  | 5.0 ft | 2.1 ft | 2.9 ft | -2.9 ft | yes | 3.6 ft | 3.6 ft | 165h | weak |
| user_087 | ocean-beach |  | 5.0 ft | 2.2 ft | 2.8 ft | -2.8 ft | yes | 3.9 ft | 3.5 ft | 165h | weak |
| user_065 | church |  | 5.0 ft | 2.4 ft | 2.6 ft | -2.6 ft | yes | 3.3 ft | 3.0 ft | 168h | weak |
| user_076 | del-mar |  | 5.0 ft | 2.4 ft | 2.6 ft | -2.6 ft | yes | 3.3 ft | 3.0 ft | 168h | weak |
| user_022 | ocean-beach-pier |  | 5.0 ft | 2.5 ft | 2.5 ft | -2.5 ft | yes | 4.5 ft | 4.3 ft | 168h | weak |
| user_022 | del-mar |  | 5.0 ft | 2.5 ft | 2.5 ft | -2.5 ft | yes | 3.3 ft | 3.0 ft | 168h | weak |
| user_022 | ocean-beach-pier |  | 5.0 ft | 2.7 ft | 2.3 ft | -2.3 ft | yes | 4.1 ft | 3.8 ft | 168h | weak |
| user_022 | ocean-beach-pier |  | 5.0 ft | 3.2 ft | 1.8 ft | -1.8 ft | yes | 5.1 ft | 4.8 ft | 168h | weak |
| user_046 | oceanside-harbor |  | 3.0 ft | 1.2 ft | 1.8 ft | -1.8 ft | yes | 3.1 ft | 2.8 ft | 138h | weak |
| user_127 | tourmaline |  | 3.0 ft | 1.3 ft | 1.7 ft | -1.7 ft | yes | 4.4 ft | 4.1 ft | 168h | weak |
| user_020 | hb-cliffs | custom_001 | 3.0 ft | 1.4 ft | 1.6 ft | -1.6 ft | yes | 3.0 ft | 3.0 ft | 165h | weak |
| user_022 | avalanche |  | 3.0 ft | 1.4 ft | 1.6 ft | -1.6 ft | yes | 2.8 ft | 2.6 ft | 165h | weak |
| user_020 | hb-cliffs |  | 3.0 ft | 1.4 ft | 1.6 ft | -1.6 ft | yes | 3.0 ft | 2.7 ft | 168h | weak |
| user_022 | ocean-beach-pier |  | 3.0 ft | 1.5 ft | 1.5 ft | -1.5 ft | yes | 3.1 ft | 2.8 ft | 168h | weak |
| user_022 | avalanche |  | 3.0 ft | 1.5 ft | 1.5 ft | -1.5 ft | yes | 3.9 ft | 4.5 ft | 168h | weak |
| user_022 | la-jolla-shores |  | 5.0 ft | 3.5 ft | 1.5 ft | -1.5 ft | yes | 3.9 ft | 3.5 ft | 168h | weak |
| user_022 | la-jolla-shores |  | 1.0 ft | 2.4 ft | 1.4 ft | 1.4 ft | no | 3.4 ft | 3.1 ft | 168h | weak |
| user_065 | waikiki-queens |  | 1.0 ft | 2.4 ft | 1.4 ft | 1.4 ft | no |  |  | 150h | weak |
| user_020 | huntington-beach-pier-southside |  | 3.0 ft | 1.6 ft | 1.4 ft | -1.4 ft | yes | 2.6 ft | 2.4 ft | 165h | weak |
| user_046 | the-rock-oceanside |  | 3.0 ft | 1.8 ft | 1.2 ft | -1.2 ft | yes | 2.9 ft | 2.6 ft | 168h | weak |
| user_020 | huntington-state-beach |  | 1.0 ft | 2.1 ft | 1.1 ft | 1.1 ft | no | 3.2 ft | 3.2 ft | 114h | weak |

## Prioritized Fix Plan

1. Config/coherence gate: fix the global `enhanced_forecasts` <-> `ml_predictions_log` sidecar mismatch before using ML-log evidence for approvals. Current display rows have provenance, but sidecar replay/matching diverges on most targets. Add a freshness/version predicate or write the exact displayed value/provenance into the sidecar for every forecast row.
2. Config/coherence for decay/window hotspots: review Tourmaline Surf Park, Crystal Pier, PB Point, and Swamis first. They help 10 surfers, 8 home surfers; Tourmaline alone has 6 affected surfers and 5 home surfers. The repeated pattern is calibrated beach + model_swell dominance + strong decay or inert/wide window + display/raw collapse.
3. Fingerprinting and fallback: repair custom-spot fingerprinting and nearest-beach resolution next. Nine users have incomplete custom fingerprints; three users have far fallbacks; one anonymized user has three custom spots falling back 55.3-57.6 mi to Isle of Palms.
4. Calibration pipeline: prioritize uncalibrated home beaches by user impact: Ponce Inlet, Cocoa Beach Pier, Isle of Palms, Westport Jetty, La Pared, Linda Mar, Surfside TX, Sea Isle/Ocean City NJ, Jacksonville Beach Pier, Cape Hatteras Lighthouse, and Steamer Lane/Garrapata/Carmel River. This bucket helps 36 users, 33 home surfers.
5. Inert-window cleanup: narrow or recompute windows for the 17-user bucket, especially home beaches with inert windows and session truth: Ponce Inlet and Cocoa Beach Pier. Tourmaline is a special case because inert-window and decay-coherence stack.
6. Product/data bug: direct user forecast feedback is effectively empty. Wire `sessions.forecast_accuracy`/`forecast_accuracy_votes` into the accuracy workflow or stop relying on it as a cross-check until it has non-null coverage.

## Commands Run

- `sed -n '1,220p' /Users/stevenchandler/.codex/skills/hermes-agent/SKILL.md`
- `sed -n '1,280p' /Users/stevenchandler/.agents/skills/forecast-qa/SKILL.md`
- `sed -n '1,260p' /Users/stevenchandler/.codex/skills/forecast-layer-status-table/SKILL.md`
- `sed -n '1,260p' /Users/stevenchandler/.codex/skills/noaa-gridpoint-resolver/SKILL.md`
- `sed -n '1,260p' /Users/stevenchandler/.codex/skills/forecast-write-time-gotcha/SKILL.md`
- `/Users/stevenchandler/.local/bin/hermes --version && /Users/stevenchandler/.local/bin/hermes doctor && /Users/stevenchandler/.local/bin/hermes status`
- `sed -n '1,260p' CLAUDE.md`
- `sed -n '1,260p' docs/ARCHITECTURE.md`
- `sed -n '1,220p' package.json`
- `sed -n '1,260p' .planning/forecast-replay-truth-2026-06-26.md`
- `sed -n '1,260p' .planning/forecast-replay-2026-06-25.md`
- `sed -n '1,260p' .planning/forecast-quality-report-2026-06-25.md`
- `sed -n '1,260p' scripts/forecast-accuracy-harness.ts`
- `sed -n '1,260p' scripts/forecast-accuracy-readiness-report.ts`
- `multiple rg/sed schema inspections for sessions, custom_spots, favorite_beaches, alert_rules, beaches, enhanced_forecasts, ml_predictions_log`
- `psql read-only production count query for non-mock users/spots/sessions`
- `psql read-only beach resolution query for Garrapata, Ghost Tree, Steamer Lane, Carmel River`
- `psql read-only JSON extraction to /tmp/quiver_forecast_coverage_debt_data.json`
- `psql read-only direct forecast_accuracy feedback distribution query`
- `psql read-only write-time check for keystone enhanced_forecasts rows`
- `python3 report generation script writing .planning/forecast-coverage-debt-by-user-2026-06-26.md`

## Residual Risks

- No browser/UI validation was run; this is DB/reporting evidence only.
- No external Surfline/CDIP fetch was run in this pass. OM/v5 are internal side comparators, useful for relative under-read, not independent market parity.
- Session candidates are mostly weak labels with long forecast horizons (commonly 114-168h). They price user-lived error, but they should not be used as short-horizon approval evidence without the Phase 0 provenance gates.
- `ml_predictions_log` sidecar divergence means ML-log-derived metrics need a coherence fix before they can certify production writes.
