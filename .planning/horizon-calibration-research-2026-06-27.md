# Horizon Calibration Research - 2026-06-27

Read-only research. No code change, no production DB write, no migration, no deploy, no push.

## Decision

Prototype option A: a forecast-horizon-aware calibration model trained on the same `model_swell` / OM forecast inputs that produce the under-read, scored against both offshore `observed_m` and session face-height truth.

Do not prototype V2-style CDIP bucket decoupling again. The 2026-06-26 replay already showed that source-tag swap regressed overall observed MAE from `0.4140m` to `0.5005m`, and the `model_swell` slice from `0.4251m` to `0.5177m`. It also made the `<0.5` display/raw bucket much worse (`0.2405m` to `0.6991m`).

The smallest safe experiment is a read-only replay over recent `model_swell` rows:

1. Reproduce V0 exactly from stored display provenance.
2. Train a simple guarded horizon-aware candidate on earlier rows.
3. Validate on the most recent holdout rows.
4. Score V0, candidate, v5 scoped override, and CDIP-shape carry-forward against `observed_m`.
5. Separately score all rows with an anonymized session face-height anchor; absence of session rows is a blocker for shipping, not for research.

## Current Evidence

- Root cause: calibrated `shoaling_factors` only fire for `source === 'cdip_sig'` or guarded `nowcast_anchor`. Forecast-horizon rows fall back to `model_swell`, so per-beach CDIP calibration is bypassed.
- Keystone rows are fresh, not stale. The coverage report shows 56/56 rows for Carmel River, Garrapata, and Steamer Lane as `model_swell`, 0 calibrated.
- Current observed replay: V0 under-reads (`obs bias -0.2962m` overall); V1 decay-off helps modestly; V2 decoupling regresses.
- Raw OM and v5 shadows indicate the display is too low, but `observed_m` is offshore Hs, not surf face. Raw OM is useful as a lower-bound reference, not as a direct display target.
- v5 C had a real but small April walk-forward lift: raw OM MAE `0.3151m`, v5 C MAE `0.3067m`, P90 improved `0.048m`, NW improved `0.0530m`; W x `0.5-1.0m` regressed and needed a guardrail.
- Session face truth is sparse. The 2026-06-26 replay read 3 anonymized session rows and had 0 forecast rows with a +/-3h session face anchor.

## Option A - Forecast-Horizon-Aware Calibration Model

Mechanism:

- Train only on rows where the displayed path is forecast-horizon `model_swell` / OM, not CDIP nowcast rows.
- Predict a corrected display height or residual from features already logged: raw displayed height, raw OM height, model source, forecast horizon bucket, swell period, swell direction, terrain access, deepwater decay, beach id, region, break type, and current window config.
- Keep the first version deliberately simple: monotone or piecewise residual calibration with per-beach or per-region terms only when sample floors are met.
- Apply hard guardrails: non-negative output, max multiplier by input band, no correction when provenance is incomplete, and beach allowlist until enough holdout/session evidence exists.

Data needed:

- Fresh Phase A-coherent `ml_predictions_log` rows with exact displayed value and provenance.
- `enhanced_forecasts` / `ml_predictions_log` rows joined to `observed_m`.
- Session face-height rows joined by beach and forecast time, anonymized and binned by horizon.
- Beach config snapshot: windows, access arrays, decay, calibration presence, region, break type.
- Direct feedback from newly wired `forecast_accuracy_votes` and `sessions.forecast_accuracy` as a later qualitative check.

Why it beats V0:

- It trains on the actual failing path: `model_swell` forecast horizons after source selection and terrain/decay.
- It can learn horizon-specific and beach-specific bias instead of assuming nowcast CDIP ratios still apply.
- It can keep raw OM/v5 as features or baselines while still respecting the display transform and guardrails.

Why it avoids the V2 regression:

- It does not pretend `model_swell` is `cdip_sig`.
- It does not reuse empirical CDIP face/Hs factors on a different physical input.
- It can learn de-amplifier beaches instead of forcing every calibrated beach through the same bucket short-circuit.

Risk:

- `observed_m` is offshore Hs, so it can pull the model toward an Hs target instead of reported face height.
- Session face truth is sparse and often weak/long-horizon.
- Per-beach terms can overfit unless the first prototype uses sample floors and holdout scoring.

Offline experiment:

- Build a read-only replay dataset for recent rows with exact V0 reproduction.
- Train on weeks N-3/N-2 and validate on week N-1, or use rolling folds if enough rows exist.
- Score by horizon bucket (`0-6`, `6-24`, `24-72`), source, beach, decay band, display/raw bucket, and top affected beaches.
- Promotion gate for prototype: observed MAE improves by at least `0.05m` on model_swell holdout, improves or is neutral on top affected beaches, overshoot watch is not worse than V0, and every session-face joinable row is non-worse or reviewed individually.

## Option B - Carry CDIP-Calibrated Shape Into The Horizon

Mechanism:

- Treat a recent CDIP nowcast/calibrated observation as a beach-specific shape anchor.
- Learn a transfer function from nowcast CDIP-calibrated face to future OM/model swell by horizon, period, and direction.
- Output horizon display from model input plus a learned carry-forward ratio, not by changing the row source to `cdip_sig`.

Data needed:

- Paired nowcast CDIP, model/OM forecast, future observed_m, and session face truth.
- Beach-level `shoaling_factors` and station mapping quality.
- Horizon deltas between CDIP nowcast and model forecast components.

Why it beats V0:

- Preserves beach-specific calibration where measured data exists.
- Uses horizon transfer rather than generic deepwater decay.

Why it avoids V2:

- The model learns how CDIP shape decays or persists into the horizon. It does not directly apply CDIP buckets to `model_swell`.

Risk:

- Limited to CDIP-covered beaches, so it does not help East Coast, Hawaii, Puerto Rico, or most uncalibrated coverage.
- Nowcast-to-horizon carry can be wrong when swell systems change.
- Still depends on station quality and sparse face truth.

Offline experiment:

- For calibrated CDIP beaches only, compare V0 against a learned carry-forward ratio by horizon.
- Require holdout improvement vs observed_m and no session-face regression.
- Reject if improvement is isolated to one station group or one swell event.

## Option C - v5 Override Scoped To A Validated Allowlist

Mechanism:

- Use existing v5.1 formula (`f(OM) + g(direction)`) as a display override only for beach/horizon cells that pass offline gates.
- Keep the current env/feature flag approach, but add a beach allowlist, horizon gates, and overshoot constraints.
- Continue logging v5 shadow for all rows, but serve only allowlisted cells.

Data needed:

- Active v5 calibration version and recent v5 shadow rows.
- A per-beach/per-horizon replay showing v5 beats V0 against `observed_m`.
- Session face-height joins for every proposed allowlist beach where available.

Why it beats V0:

- It is already implemented as a shadow path and directly targets the OM under-read signal.
- It can be shipped behind a narrow allowlist faster than a new model.

Why it avoids V2:

- It uses OM calibration, not CDIP bucket reuse.
- It can remain scoped to cells where the replay proves it beats V0.

Risk:

- v5 is global and direction-bucketed, not beach-specific.
- April evidence was positive but small and had a failed W x `0.5-1.0m` cell.
- It may chase offshore Hs rather than surf face unless session anchors are present.

Offline experiment:

- Replay V0 vs v5.1 for the top affected beaches and horizon buckets.
- Allowlist only cells with observed MAE improvement, no overshoot watch, stable sample count, and no session-face regression.
- If session rows are absent, keep result as shadow/preview only.

## Recommendation

Prototype option A first. It is the only path that directly learns the broken forecast-horizon path, scales beyond CDIP beaches, and avoids replaying the V2 mistake.

Use option C as a narrow fallback if option A cannot assemble enough training data quickly. Option B is worth researching after A because it may improve CDIP-rich beaches, but it is too coverage-limited to be the first structural fix.

## Smallest De-Risking Experiment

One read-only notebook or script:

- Input: last 30-90 days of replayable `model_swell` rows with V0-exact provenance, `observed_m`, v5 shadow fields, beach config, and anonymized session face anchors.
- Candidate A0: guarded residual calibrator using `wave_height_om`, raw display height, horizon bucket, direction bucket, period bucket, decay band, and beach/region terms only above sample floors.
- Baselines: V0 current, V1 decay-off where applicable, V3 raw OM diagnostic, v5.1 shadow, and a CDIP carry-forward toy for calibrated beaches only.
- Output: a markdown report with all score tables, top-beach deltas, overshoot guard, and session-face rows printed as anonymized beach/time aggregates only.
- Exit criteria: recommend a code prototype only if A0 beats V0 on observed_m holdout, does not worsen any joinable session-face row, and produces a small allowlist with clear sample counts.

If the experiment cannot find session-face joins, keep all candidates in shadow and use Phase A's newly wired feedback capture to build the missing truth stream before display changes.
