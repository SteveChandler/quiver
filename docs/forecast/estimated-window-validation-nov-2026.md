# Estimated swell window validation, Nov 7 2026

Branch: `ccr-f212ab21-yh3phk` (bea134452) against main 44c7df5. Read-only run. No production writes. The migration is not applied.

**Update:** the drop described below is fixed on branch `fix/la-fonda-estimated-window`. The verdict below is for the first commit only. See the last section for the re-run.

## Verdict

**Do not ship as-is.** The verdict rests on the shift distribution. It does not need the buoy truth.

- The branch has an unintended interaction. The old code falls back to the legacy path when every swell component is zeroed by the strict window. The new taper keeps the sum above zero, so the fallback never runs. The face height then drops.
- This happens in 33% of Baja hours (8,353 of 25,009) and in 6% of US hours. In the Baja hours of this type, the mean change is -2.07 ft, and 79% drop by more than 1 ft.
- The change goes against the stated goal of the commit (raise under-called swell). No truth exists for Baja that says which side is right.
- Do not narrow to "Baja only". Baja has the most drop hours and almost no truth.
- The uplift part (hours that stay on the decomposed path) is plausible. It moves the US buoy score closer, but see the truth limits below. The buoy truth cannot confirm it.
- A replay variant, result = max(old, new), removes every drop. The author must decide on purpose whether the old fallback should survive (see "The fallback question"). Numbers for this variant are below.

## What was run

- Affected-beach gate: the exact `usesEstimatedWindowAccess` predicate from the branch, applied to the prod `beaches` rows and to the `MODEL_SWELL_CALIBRATION_FACTORS` (78 ids) and `ECMWF_HYBRID_K_FACTORS` (56 ids) tables. Public, not deleted: 574 beaches.
- Logged model hours: `ml_predictions_log` rows with `display_replay_context`, source `model_swell` or `model_hs`, horizon 12 to 48 h. 85,224 rows were read (all horizons up to 72 h); 44,008 rows are in the 12 to 48 h scoring set.
- Each row was replayed through `transformToFaceHeightDecomposed` imported from each worktree (base and branch). Same logged components. Beach settings are the current prod settings (window, terrain flag, shoaling factors, id). No row was skipped for parse, support, or hybrid reasons.
- Date range: 2026-10-08 to 2026-11-07. This is 30 days, not 4 to 6 weeks. Replay context does not exist in the log before Oct 8. The replay reproduces the logged height within 0.15 ft for 83.8% of rows. The other 16.2% likely differ because settings changed since logging. I did not check this.
- Scripts (untracked): `scripts/ew/*.ts`, `scripts/ew/analyze*.py` in the branch worktree.

## Affected beaches

The gate passes 234 beaches. 49 of them have no swell window, so the branch changes nothing there (the estimated factor returns null). **185 beaches change.**

| Country | Beaches that change |
|---|---|
| Mexico (Baja California and Baja California Sur) | 105 |
| USA | 80 |
| of which: CA 23, NJ 21, HI 16, TX 7, PR 5, NC 4, NY 2, SC 2 | |

The Nov 5 snapshot said about 188 (105 Mexico, 83 USA). Mexico matches. USA is 80 in prod today (snapshot: CA 26, HI 16, NJ 21, TX 7, PR 5, NC 4, SC 2, NY 2 = 83). CA is 3 lower.

## Truth that exists

Truth is thin. Say this plainly.

1. **User session wave heights.** In the 30 days, only 2 usable reports exist at affected beaches. Both are La Fonda on Nov 7 (4.5 ft at 16:33 UTC and 5.0 ft at 19:07 UTC). The same event also has a feedback report "4-5ft". This is the event that caused the change. It is not independent. Other sessions at no-factor beaches (Blackies, Muir Beach) are at beaches with no window, or are `forecast_prefill` values. They are not used.
2. **Buoy-derived face truth.** The `cdip_station` field is `model_only` for all affected beaches. So no beach has an assigned buoy. Instead, I took the nearest buoy within 25 km from `unified_wave_observations` (CDIP and NDBC, with Hs, Tp, Dp). I made face truth with the transformer's `cdip_sig` path at the beach's current settings, and matched to the nearest reading within 45 min. This gives n=10,413 beach-hours at 44 US beaches (24 stations). **No Baja beach has a buoy within 25 km.** So Baja has no buoy truth.

Limits of the buoy truth. These are large.
- **The truth has no direction term.** It uses `cdip_sig` without a shoaling bucket and without terrain. Without terrain, the generic path ignores the swell window. So truth = buoy Hs x period factor x population base. Proof: eight Monterey Bay beaches with different windows (Asilomar, Carmel, Del Monte, Ghost Tree, Lovers Point, Marina, Moss Landing, Spanish Bay) all have the same truth mean, 5.77 ft.
- **The truth cannot tell "swell arrives" from "swell is blocked".** This is exactly what the branch changes.
- Both old and new read about 2 ft below this truth (bias -2.4 and -1.9 ft). A direction-blind truth that sits above both versions rewards whichever version outputs more. The MAE gain means "new is closer to raw buoy Hs". It does not mean "new is closer to what surfers see".
- The existing `scripts/replay-model-swell-calibration.ts` keeps a truth row only when `isCalibrated` is true. That is false for every beach here (no `shoaling_factors`). This truth is my adaptation. The script would have dropped these rows.
- Some beaches use a buoy 20 to 24 km away. Nearshore effects are not in the buoy.
- Baja has no buoy truth at all (no buoy within 25 km of a Baja beach).

## Headline: US buoy-Hs truth (12 to 48 h). Direction-blind. Read the limits above.

| Group | n | MAE old | MAE new | Bias old | Bias new |
|---|---|---|---|---|---|
| USA all | 10,413 | 2.45 | 1.94 | -2.41 | -1.86 |
| CA | 5,216 | 2.54 | 1.91 | -2.47 | -1.80 |
| HI | 3,798 | 2.49 | 1.97 | -2.48 | -1.92 |
| NC | 710 | 2.18 | 2.03 | -2.17 | -2.02 |
| TX | 689 | 1.86 | 1.86 | -1.86 | -1.86 |
| Mexico / Baja | 0 buoy rows | no buoy truth | | | |
| Mexico / Baja, sessions | 2 (one event) | see La Fonda | | | |

NJ, NY, SC, PR have no buoy within 25 km, so no truth.

Other measures on the same rows:
- Correlation with truth (direction-blind): old 0.632, new 0.675.
- MAE after each beach is rescaled by its own median ratio (in-sample): old 1.60, new 1.04.
- First half of the period: old 2.58, new 2.04. Second half: old 2.32, new 1.83. The gain holds in both halves.
- Rows where the height changed (n=7,599): old 2.59, new 1.88. Rows that moved more than 1 ft (n=2,971): old 3.17, new 2.02.

By height-change class (US buoy truth):

| Class (old path to new path) | n | MAE old | MAE new | Bias old | Bias new |
|---|---|---|---|---|---|
| decomposed to decomposed | 9,410 | 2.52 | 1.87 | -2.50 | -1.79 |
| legacy fallback to decomposed | 773 | 1.61 | **2.67** | -1.36 | -2.60 |
| legacy to legacy | 230 | 2.41 | 2.41 | -2.41 | -2.41 |

The middle row is the drop class. Lower heights lose against a higher, direction-blind truth. This row is the same artifact as the headline. It is not evidence that the drop is wrong.

## Flagged beaches (new worse than old by more than 0.3 ft MAE)

Beach-level scores with n of at least 10: all 44 beaches have n of 228 or more. Two are flagged.

- **Ghost Tree (CA):** MAE 1.48 to 2.81 (+1.33). Window 265 deg plus or minus 20. The buoy swell direction is about 282 deg, outside the window. In 214 of 238 hours, old used the legacy fallback (mean 4.8 ft). New gives a small tapered value (mean 3.1 ft). Truth mean is 5.8 ft.
- **Makapuʻu (HI):** MAE 4.38 to 4.78 (+0.41). Window 82 plus or minus 63. Both old and new are far below truth (mean 6.4 ft). 53 hours are in the drop class.

Both flags are drop-class effects against a direction-blind truth. No flagged beach is a case of the taper over-calling. Ghost Tree's buoy swell is outside its window, so a lower number there may be correct. The truth cannot say.

## Shift where no truth exists (new minus old, 12 to 48 h)

| Group | n | Mean | p5 | p25 | p50 | p75 | p90 | p95 | p99 | Share > +1 ft | Share > +2 ft | Share < -0.5 ft |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mexico | 25,009 | -0.18 | -3.50 | -1.20 | +0.10 | +0.90 | +1.60 | +2.00 | +2.70 | 22.2% | 4.3% | 29.1% |
| USA | 18,999 | +0.36 | 0.00 | 0.00 | 0.00 | +0.70 | +1.30 | +1.70 | +3.30 | 15.9% | 3.3% | 2.8% |
| All | 44,008 | +0.06 | -2.80 | 0.00 | +0.10 | +0.80 | +1.50 | +1.90 | +2.90 | 19.5% | 3.9% | 17.7% |

Largest single shifts: +8.6 ft (Mexico), +7.5 ft (USA), -13.7 ft (Mexico), -6.9 ft (USA). The heights are not clamped here. Largest new height: 13.5 ft (Mexico), 11.2 ft (USA).

Split by path class:

| Region | Class | Share of hours | Mean shift | Share > +1 ft | Share < -1 ft |
|---|---|---|---|---|---|
| Mexico | decomposed to decomposed (pure uplift) | 60.8% | +0.85 | 36.4% | 0% |
| Mexico | legacy fallback to decomposed (drop) | 33.4% | -2.07 | 0.1% | 78.8% |
| Mexico | legacy to legacy | 5.8% | 0.00 | 0% | 0% |
| USA | decomposed to decomposed | 92.4% | +0.46 | 17.2% | 0% |
| USA | legacy fallback to decomposed (drop) | 6.2% | -0.94 | 0.2% | 37.0% |
| USA | legacy to legacy | 1.3% | 0.00 | 0% | 0% |

Why the drop happens. Old code: when every swell component is zeroed by the strict window, the transform falls back to the legacy path (full Hs with the legacy direction factor). Example, Cabo San Quintin, window 270 plus or minus 22: components 201 deg (3.0 ft, 13.6 s) and 292 deg (1.5 ft, 9.9 s). Both are outside the window. Old shows 3.9 ft (legacy). New gives the 292 deg component a taper factor and shows about 1 ft. The taper makes the sum positive, so the fallback never runs. Narrow Baja windows (plus or minus 22 deg is common) make this frequent. 54 beaches (50 Mexico, 4 USA) are in the drop class for more than 30% of hours.

## The fallback question

The old fallback is also direction-blind. In the Cabo San Quintin example, old shows 3.9 ft for a 3 ft swell that is 47 deg outside the window. That is raw Hs x period, with no window applied. So the old value may be an over-call, and the new value may be nearer the truth. No data here decides it. The facts are:
- The drop is an unintended interaction: the taper keeps `sumOfSquares > 0`, so the fallback never fires.
- It changes 33% of Baja hours by a mean of -2.07 ft.
- The author must decide on purpose whether the fallback should survive.

Over-call risk from the uplift. Hours where old is below 1 ft and new is 3 ft or more: 0.34% of hours (149 beach-hours, 45 beaches). Most common: Asilomar, Velzyland, La Fonda, Rocky Point, Spanish Bay. The uplift in pure-uplift hours is moderate: p90 +1.9 ft in Mexico, +1.4 ft in the USA.

One replay variant (not code): result = max(old, new). It bounds the downside of the branch and locks in the old fallback. US buoy MAE 1.86 ft, bias -1.77 ft (direction-blind truth, so this is weak evidence). No beach is worse than old by more than 0.001 ft MAE. Shift in Mexico: mean +0.52, p90 +1.6, share > +1 ft 22.2%, share > +2 ft 4.3%. No drops. Not a recommended fix; it is one data point.

## La Fonda (803f0345)

Current prod window: 180 to 285 (center 232, half-width 52). The migration sets 180 to 330 (center 255, half-width 75). The migration was applied in memory only.

Nov 7 (UTC), the trigger event. User reports: 4.5 ft (16:33), 5.0 ft (19:07).

| Valid time | Horizon | Raw (ft) | Logged | Old | New | New + window |
|---|---|---|---|---|---|---|
| 15:00 | 20 h | 5.0 | 0.8 | 0.8 | 3.6 | 5.2 |
| 18:00 | 23 h | 4.9 | 0.8 | 0.8 | 3.6 | 5.1 |
| 15:00 | 70 h | 4.7 | 0.8 | 0.8 | 3.3 | 4.8 |
| 18:00 | 63 h | 4.7 | 0.8 | 0.8 | 3.3 | 4.8 |

Against the two reports (4.5 and 5.0 ft): old error is about -3.7 to -4.2 ft. New error is about -0.9 to -1.7 ft. New plus window error is about -0.2 to +0.7 ft. The truth is two numbers from one event. It cannot show the window is right in general.

Last 30 days (hours at 12 to 48 h horizon, n=239; last 3 weeks n=175):

| Version | Mean (30 d) | Median | p90 | Max | Share >= 3 ft | Mean (3 wk) |
|---|---|---|---|---|---|---|
| Logged | 2.14 | 1.8 | 3.82 | 8.6 | 24.7% | 2.15 |
| Old (current settings) | 2.32 | 2.0 | 4.0 | 10.8 | 29.7% | 2.29 |
| New | 3.46 | 3.4 | 4.52 | 11.2 | 72.4% | 3.33 |
| New + window | 3.74 | 3.5 | 5.0 | 11.1 | 79.1% | 3.64 |

La Fonda is a high-uplift beach: +1.15 ft mean (new minus old), in the top 12 of 185. 19 of its 239 hours are in the drop class. About 72% of hours at 3 ft or more is a large share. With no other truth for La Fonda, treat the window widening as unvalidated apart from one event.

## What is not known

- No Baja truth besides one event. The 105 Baja beaches (57% of the changed beaches) are validated only by the shift distribution.
- The US buoy truth shares the transformer's ruler. It supports direction of change, not absolute size.
- 30 days only. This window is mostly fall swell. Winter NW swell (the case the taper targets) is under-represented. The window includes the Nov 7 event.
- No session reports exist at the 24 non-La-Fonda affected beaches with a window.
- The migration was tested at one beach only. Other windows (49 beaches with none, and others that are narrow) were not tested.

## Recommendation

1. Do not merge the transformer change as written.
2. Decide on purpose what happens when all components sit outside the strict window: keep the legacy fallback, or accept the lower tapered value. Document the decision. Then re-run this replay (`scripts/ew`) on the real code.
3. Get a truth that has direction in it before the next decision. Options: session reports at affected beaches (only 2 exist, from one event), or a nearshore sensor or CDIP MOP point with direction for the US beaches. The Baja case has none.
4. Treat the La Fonda migration as a separate decision. It matches one event. It raises the 3 ft or more share to 79%. Hold it for more truth.

**Verdict: do not ship as-is.** Evidence: 8,353 Baja hours (33%) change by a mean of -2.07 ft through an unintended loss of the fallback; 54 beaches are in that class for more than 30% of hours; Baja has no independent truth. The US buoy score improves (MAE 2.45 to 1.94 ft, n=10,413, 44 beaches), but the truth is direction-blind, so it does not confirm the change.

## Re-run with the fallback kept (branch `fix/la-fonda-estimated-window`)

The fix: on the estimated-window path, `transformToFaceHeightDecomposed` also checks each component against the strict window. When the strict window zeroes every component (the base fallback condition), the transform uses the legacy fallback as before. In all other hours the taper applies. CDIP, terrain and calibrated beaches do not change.

Same logged rows (85,224; 44,008 at 12 to 48 h), same beach settings, same buoy truth. Old = main 44c7df5. New = this branch. Read-only. No production writes.

Drops:
- Hours that drop by more than 0.5 ft against old: **0** (0.00%). Hours that drop by any amount, all horizons: 0.
- Every hour that took the fallback in old takes it in new (Mexico 39.2%, USA 7.6% of hours).
- The fix changes 19.6% of 12 to 48 h hours against the first branch commit. These are the former drop hours.

US buoy-Hs truth (12 to 48 h, n=10,413, 44 beaches). Direction-blind. The limits above still apply.

| Group | MAE old | MAE new | Bias old | Bias new |
|---|---|---|---|---|
| USA all | 2.45 | 1.86 | -2.41 | -1.77 |
| CA | 2.54 | 1.79 | -2.47 | -1.65 |
| HI | 2.49 | 1.92 | -2.48 | -1.87 |
| NC | 2.18 | 2.03 | -2.17 | -2.02 |
| TX | 1.86 | 1.86 | -1.86 | -1.86 |

These numbers are the same as the max(old, new) variant above, because new is now never below old.

Shift (new minus old, 12 to 48 h):

| Group | n | Mean | p90 | p95 | Share > +1 ft | Share > +2 ft | Share < -0.5 ft |
|---|---|---|---|---|---|---|---|
| Mexico | 25,009 | +0.52 | +1.60 | +2.00 | 22.2% | 4.3% | 0% |
| USA | 18,999 | +0.42 | +1.30 | +1.70 | 15.9% | 3.3% | 0% |

Flagged beaches (new worse than old by more than 0.3 ft MAE): none.
- Ghost Tree: MAE 1.48 to 1.39. 219 of 238 hours keep the legacy fallback.
- Makapuʻu: MAE 4.38 to 4.27. Both versions stay far below the truth (mean 6.4 ft).

La Fonda (239 hours at 12 to 48 h):

| Version | Mean (30 d) | p90 | Share >= 3 ft | Mean (3 wk) |
|---|---|---|---|---|
| Old | 2.32 | 4.0 | 29.7% | 2.29 |
| New | 3.52 | 4.6 | 74.5% | 3.41 |
| New + window | 3.74 | 5.0 | 79.1% | 3.64 |

Nov 7, 15:00 and 18:00 UTC (20 h and 23 h): old 0.8 ft, new 3.6 ft, new + window 5.2 and 5.1 ft. The surfer reports were 4.5 and 5.0 ft. These values are the same as in the first branch commit.

What stays open:
- The uplift hours have no truth with a direction term. Baja has no truth apart from one event.
- The La Fonda window migration is in the PR but is not applied. It still rests on one event.
