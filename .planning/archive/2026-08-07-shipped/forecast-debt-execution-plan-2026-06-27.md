# Forecast Debt — Execution Plan (2026-06-27)

Derived from `forecast-coverage-debt-by-user-2026-06-26.md`. Re-prioritized by **user-facing
impact** (the source report led with the instrumentation gate, which helps eval integrity but
zero surfers). Analysis/planning only — no changes made.

## The headline
- **42 / 51** affected users have the debt on their **home** beach.
- Session truth (55 matched): **bias −0.71 ft, MAE 1.27 ft, 49% under-read.** Directional, not
  gospel — most matched sessions are long-horizon (114–168 h) weak labels; the extreme 6.5 ft is a
  single weak session. The *pattern* (under-read at SD/OC/Central-Coast spots) is solid.
- **Direct feedback is dead:** 0 `forecast_accuracy_votes`, 55/56 sessions `forecast_accuracy = NULL`.
  We can't hear complaints even when we cause them.

## Strategy note (read before deciding scope)
This challenges the "forecast is good-enough, don't compete on accuracy" premise: it is **not**
good-enough at trial users' home spots — display is **0.47–0.80×** of raw input there (surf shown
at roughly half size). That's a **credibility/correctness** failure, not the Surfline fine-accuracy
arms race. Fix the gross under-read at home beaches; do **not** chase per-foot parity fleet-wide.

## Unifying root cause
Nearly every keystone is the same chain: **the calibrated CDIP path doesn't fire at forecast
horizons** (CDIP is nowcast-only) → rows fall to **uncalibrated `model_swell` + deepwater decay**
→ display collapses to ~0.5× raw. 56/56 keystone rows are `model_swell`, 0 calibrated. This is the
[[project-cdip-fallback-calibration-loss-jun2026]] gap, now priced per user.

## Tiered plan

### Tier 0 — cheap, do now (instrumentation + the ability to hear users)
| Fix | Why | Mechanism | Helps |
|---|---|---|---|
| **Wire direct feedback capture** | 0 votes / all-null means we're blind to forecast complaints | code: ensure `sessions.forecast_accuracy` + `forecast_accuracy_votes` are written from the native/web log flow | every future signal |
| **ml-log sidecar coherence** | EF↔ml_log diverge >0.35 ft on 97 users' rows → offline evals can't certify writes | code: write the exact displayed value/provenance into `ml_predictions_log`, or add a version/freshness predicate | eval integrity (not user-facing) |

### Tier 1 — highest user-facing impact, tractable slice (top home beaches)
Fixing the ~8 beaches below covers ~20+ of the 42 home-debt users. Mechanism differs per beach:
| Beach | Home users | Bucket | Mechanism |
|---|---:|---|---|
| tourmaline-surf-park | 5–6 | decay-coherence | calibrated but 98% model_swell + decay 0.40 → source-selection / decay gating, NOT new calibration |
| malibu-third-point-malibu-ca | 4 | uncalibrated | add `shoaling_factors` (calibration pipeline) |
| ponce-inlet-ponce-inlet-fl | 3 | inert-window + uncalibrated | recompute swell window + calibrate |
| crystal-pier | 2 | decay-coherence | same as tourmaline |
| jacksonville-beach-pier-fl | 2 | inert-window + uncalibrated | window + calibrate |
| linda-mar-pacifica-ca | 2 | uncalibrated | calibrate |
| isle-of-palms-sc | 1 home + custom hub | uncalibrated | calibrate (also the 55 mi fallback target) |
| garrapata / steamer / carmel-river | 1 each (Elliott) | uncalibrated | calibrate |

Note: the **decay-off lever we just built does NOT help these** — tourmaline/crystal-pier are decay
0.40 (below the validated 0.5–0.8 band; decay-off would overshoot them). So park decay-off.

### Tier 2 — custom-spot coverage
| Fix | Helps | Mechanism |
|---|---:|---|
| Custom-spot fingerprinting (facing/window/offshore/exposure) | 9 users | fingerprint pipeline for `custom_spots` |
| Nearest-beach resolution / far-fallback | 3 users (one at 55 mi → Isle of Palms) | re-resolve `nearest_beach_id`; warn/disclaim when >25 mi |

### Tier 3 — the deep structural fix (hardest)
Make per-beach calibration apply at **forecast horizons**, not just nowcast — the real root. Caution:
the 2026-06-26 truth replay showed naively applying CDIP buckets to `model_swell` (V2 "decouple")
made MAE *worse*. So this needs a proper model, not a source-tag swap. Treat as research, not a quick fix.

## Recommended first move
Do **Tier 0** now (cheap, unblocks hearing users + trusting evals) and a **Tier 1 slice of the top
3 beaches by user count** (tourmaline, malibu-third-point, ponce-inlet) — note these need *different*
mechanisms (source/decay vs calibration vs window), so they're 3 small workstreams, not one.

## Caveats
- Session truth is long-horizon weak labels — use for lived-error *pricing* and ranking, not as
  short-horizon approval evidence.
- All beach config (shoaling_factors / windows) is shared prod/dev DB — config edits apply to both;
  treat as data changes with a repo-tracked record, not migrations.
