# Hybrid replay by lead (Nov 6 2026)

Read-only replay. No product code changed. No PR. Scripts are untracked in
`/Users/stevenchandler/Desktop/dev/quiver/.worktrees/hybrid-replay/scripts/`:
`hybrid-replay-collect.ts`, `hybrid-replay-analyze.py`, `hybrid-replay-extra.py`,
`hybrid-replay-archive.ts`, `hybrid-replay-repro.ts`. Cached inputs and raw output
are in `scripts/.hybrid-cache/` (`analysis.txt`, `archive-analysis.txt`).

## Verdict

**Ship with limits.**

- Ship the hybrid for forecast hours 120 h and later (days 6–7), at calibrated beaches. Do not use it at station 215. At days 5–7 it wins at 81 of 94 beaches and in every week, including the Nov 2–6 swell week. Without station 215, the MAE is 0.62 ft against 0.74 ft (prod), and the hybrid wins at 8 of the other 9 stations. This is the clean evidence.
- Station 215: at every lead, a refit k without the 1.6 hold scores better than the hybrid. At 5–7 d the values are 0.83 ft and 0.86 ft. Thus at 215 the hybrid gain comes from the hold, not from ECMWF. Keep 215 on production until the hold is resolved.
- 72–120 h: the direction agrees, but the evidence is thin. Only the archive has this bin. At Blacks and Scripps alone (n = 504) the hybrid wins: 1.24 → 1.14 ft and 0.79 → 0.68 ft. Extend the threshold to 72 h after the archive saves ECMWF at all calibrated beaches and a new replay confirms it.
- Do not ship it for 0–72 h yet. Outside station 215 the gain at 0–24 h is small (0.57 to 0.54 ft). At 1–3 d there is no gain (0.58 to 0.58 ft). At station 215 (Huntington and Newport) the hybrid goes around the 1.6 hold. It over-called the Nov 2–6 west swell by +0.80 ft at 1–3 d.
- The hybrid does not replace the per-beach factor k. With a borrowed k (beach hold-out) its MAE is 1.10 ft, against 0.60 ft with its own k. Use it only at calibrated beaches that have their own hybrid k.
- Use the "RSS basis" variant (section 3). It is better than the Hs-ratio variant from Nov 4 at every lead.

## 1. Face-height MAE by lead

### Method

- **Forecasts.** The forecasts are the real issue-time model_swell rows in `ml_predictions_log`, Oct 7 to Nov 6 2026. Issue time is `created_at`. The log stores three horizon bands: 13–24 h, 55–72 h and 151–168 h. Each row has the MFWAM (best_match) partitions in `display_replay_context` and the MF total Hs in `wave_height_om`.
- **ECMWF.** ECMWF WAM total Hs (`ecmwf_wam025`) comes from `previous-runs-api.open-meteo.com/v1/forecast`, with `cell_selection=sea`. For each row, I use `wave_height_previous_dayN` with N = ceil(lead / 24). That run was available no later than the MF issue time. Thus ECMWF is 0–24 h older than MF, never newer. I compared the API with the archive's real issue-time ECMWF at Scripps for Oct 27 12Z (issued 6.8, 4.2 and 1.2 days before). The `previous_dayN` values agreed within 0.02–0.04 m. The "fresher ECMWF" variant (N = floor(lead / 24)) gives the other limit.
- **Truth.** Truth is the CDIP 30-minute realtime reading within 45 min, through `transformToFaceHeightWithMetadata` (`cdip_sig`, `isCalibrated` only). Truth uses the current `beaches` rows, which include the #1326/#1330/#1331 buckets. Buoys farther than 100 km are excluded. These rules are the same as in `scripts/replay-model-swell-calibration.ts`.
- **prod.** prod is current `origin/main` (58626f9b5) `transformToFaceHeightDecomposed` with `beach.id` forced on every row. It uses the shipped `MODEL_SWELL_CALIBRATION_FACTORS` (fit Nov 6 at f6de16905). It also uses the current beach row and the logged `deepwater_decay_factor`.
- **Replay check.** On 1,195 sampled rows, my prod input agrees with the canonical context replay within 0.05 ft on 98.2% of rows. The maximum difference is 0.90 ft.
- **refit.** refit is the uncalibrated transform × per-beach k. k is fit on the training weeks with the `shippedFactor` rule: median(truth/model), at least 50 rows, clamp 0.8–2.5, station 215 held at 1.6, and k = 1 when |k − 1| < 0.08. k is fit on 0–24 h rows only, the same as production.
- **hybrid.** The partitions are rescaled to the ECMWF total, the transform is applied with no factor, and the result is × its own per-beach k. k uses the same rule and the same training rows.
- **Week blocks.** I used a leave-one-ISO-week-out split by valid time (W41–W45). Every score in the tables comes from a week that k did not see.
- **Beach hold-out.** A per-beach k cannot be tested on a beach that was held out. For this test, a beach gets the median k of the other beaches on the same CDIP station (BH rows).
- **Days ≥ 4 ft.** "≥4 ft" means hours where the truth face height is 4 ft or more. It does not mean calendar days.

**Important.** prod is in-sample. Its factors were fit on these same 30 days of 12–48 h rows. refit and hybrid are held out. The difference between refit and prod (about 0.03 ft) is the leakage. Thus refit is the fair baseline. prod is a little better than it would be on new data.

### Results: all calibrated beaches with truth (log, 94 beaches)

MAE in ft. The bias (forecast − truth) is in brackets.

| Method | 0–24 h all | 0–24 h ≥4 ft | 1–3 d all | 1–3 d ≥4 ft | 5–7 d all | 5–7 d ≥4 ft |
|---|---|---|---|---|---|---|
| n | 20,591 | 9,285 | 19,331 | 8,443 | 16,773 | 6,555 |
| prod (in-sample) | 0.67 (−0.22) | 0.96 (−0.67) | 0.68 (−0.25) | 0.97 (−0.73) | 0.83 (−0.55) | 1.32 (−1.16) |
| refit-k | 0.70 (−0.21) | 0.98 (−0.69) | 0.70 (−0.24) | 0.99 (−0.74) | 0.85 (−0.54) | 1.35 (−1.17) |
| refit-k, 215 hold removed (bias not printed; W45 at 215: +0.86 at 0–24 h) | 0.65 | 0.87 | 0.65 | 0.87 | 0.77 | 1.16 |
| hybrid, Hs ratio (Nov 4 spec) | 0.63 (−0.12) | 0.82 (−0.50) | 0.66 (−0.14) | 0.89 (−0.56) | 0.73 (−0.32) | 1.08 (−0.84) |
| **hybrid, RSS basis** | **0.60 (−0.06)** | **0.76 (−0.43)** | **0.63 (−0.05)** | **0.83 (−0.45)** | **0.67 (−0.16)** | **0.97 (−0.67)** |
| hybrid, RSS basis, r capped 0.5–2.0 | 0.60 | 0.76 | 0.63 | 0.83 | 0.66 | 0.96 |
| hybrid, fresher ECMWF (N = floor) | 0.63 | 0.83 | 0.65 | 0.88 | 0.71 | 1.07 |
| BH: refit, borrowed k | 1.14 | 1.41 | 1.14 | 1.41 | 1.16 | 1.66 |
| BH: hybrid, borrowed k | 1.10 | 1.33 | 1.10 | 1.37 | 1.11 | 1.51 |
| logged (what users saw then) | 1.16 | 1.75 | 1.41 | 2.25 | 1.54 | 2.62 |

**3–5 d.** The log stores no 73–150 h rows, so the log has no 3–5 d data. Only the daily swell archive (`workspace-notes/Reports/swell-archive/`) has this bin. The archive has real issue-time MF partitions and ECMWF Hs for 8 days. Only 4 calibrated beaches are in it: Blacks, Scripps, HB Pier and OB SF–Sloat. OB SF has no ECMWF value, so only 3 beaches give data. Issue time is the latest run time in the day's manifest.

| Archive (3 effective beaches) | 0–24 h | 1–3 d | **3–5 d** | 5–7 d |
|---|---|---|---|---|
| n (≥4 ft) | 679 (451) | 1,300 (842) | 1,226 (755) | 1,452 (877) |
| prod | 0.93 / 1.09 | 0.92 / 1.09 | **0.97 / 1.20** | 1.16 / 1.51 |
| refit-k | 1.02 / 1.12 | 1.01 / 1.12 | 1.04 / 1.23 | 1.21 / 1.54 |
| hybrid, Hs ratio | 0.87 / 0.97 | 0.87 / 0.98 | 0.87 / 1.01 | 1.00 / 1.23 |
| hybrid, RSS basis | 0.84 / 0.89 | 0.85 / 0.92 | **0.84 / 0.93** | 1.00 / 1.20 |

The archive cells give all / ≥4 ft. In the archive, I did not compute the "fresher ECMWF" and "logged" rows. The archive k uses at least 20 training rows, not 50. The archive result agrees in direction with the log, but n is small. HB Pier (station 215) gives most of the archive gain.

Archive 3–5 d by beach (prod / refit / RSS hybrid; ≥4 ft prod / RSS hybrid):

| Beach | n | All | ≥4 ft |
|---|---|---|---|
| Blacks (201) | 252 | 1.24 / 1.38 / 1.14 | 1.87 / 1.37 |
| Scripps (201) | 252 | 0.79 / 0.94 / 0.68 | 2.06 / 1.31 |
| HB Pier (215) | 362 | 1.12 / 1.12 / 0.78 | 1.26 / 0.80 |
| OB SF–Sloat (142, no ECMWF) | 360 | 0.78 / 0.81 / 0.81 | 0.82 / 0.85 |

### Wins by beach (RSS-basis hybrid, beaches with ≥ 30 rows)

| Lead | Beaches | Hybrid < prod | Hybrid < refit | Stations (of 10) where hybrid < prod |
|---|---|---|---|---|
| 0–24 h | 94 | 72 | 77 | 9 |
| 1–3 d | 94 | 57 | 65 | 8 |
| 5–7 d | 94 | 81 | 84 | 9 |

For the Hs-ratio hybrid, the beach wins against prod are 60, 39 and 77, and the station wins are 7, 3 and 8.

### Robustness

The headline gain at 0–72 h comes mostly from station 215. Its 18 beaches have k held at 1.6. The hybrid's r of about 1.2 lifts them past the hold. At 215 alone (n = 4,234 / 3,946 / 3,370), the MAE is:

| Station 215 | 0–24 h | 1–3 d | 5–7 d |
|---|---|---|---|
| prod (held 1.6) | 0.95 | 0.93 | 1.22 |
| refit, hold removed | **0.75** | **0.71** | **0.83** |
| hybrid, Hs ratio | 0.77 | 0.80 | 0.88 |
| hybrid, RSS basis | 0.78 | 0.81 | 0.86 |

At 215, removing the hold gives all of the hybrid gain and more. In W45, removing the hold and using the hybrid both over-call. Thus the 215 question is about the hold, not about ECMWF.

| Cut (RSS-basis hybrid vs prod) | 0–24 h | 1–3 d | 5–7 d |
|---|---|---|---|
| All 94 beaches | 0.60 vs 0.67 | 0.63 vs 0.68 | 0.67 vs 0.83 |
| Without station 215 | 0.55 vs 0.60 | 0.58 vs 0.61 | 0.62 vs 0.74 |
| Without the 20 beaches whose k is on a bound | 0.54 vs 0.57 | 0.58 vs 0.58 | 0.62 vs 0.70 |
| Same, ≥4 ft | 0.70 vs 0.79 | 0.78 vs 0.81 | 0.91 vs 1.11 |

By valid week, RSS basis vs prod:

| Week | 0–24 h | 1–3 d | 5–7 d |
|---|---|---|---|
| W41 | 0.71 vs 0.88 | 0.73 vs 0.82 | – |
| W42 | 0.49 vs 0.60 | 0.52 vs 0.63 | 0.51 vs 0.57 |
| W43 | 0.63 vs 0.71 | 0.67 vs 0.73 | 0.78 vs 0.95 |
| W44 | 0.43 vs 0.48 | 0.43 vs 0.48 | 0.45 vs 0.60 |
| W45 (swell week) | **0.86 vs 0.86** | **0.97 vs 0.91** | 0.99 vs 1.26 |

W45 has 5 valid days and one swell event, which is a small sample. It is also the only week with a real west swell, and the hybrid does not gain at 0–72 h in that week. At station 215 in W45, the 1–3 d bias was: prod −0.15 ft, refit without the hold +0.65 ft, hybrid +0.50 ft, RSS hybrid +0.80 ft. The 1.6 hold did its job. The hybrid goes around it.

## 2. Period MAE

The truth is the CDIP peak period Tp. The log rows are the rows that have all values.

| Lead | n | Production period (MF dominant partition) | ECMWF WAM peak period |
|---|---|---|---|
| 0–24 h | 20,358 | 3.79 s | 1.79 s |
| 1–3 d | 19,113 | 3.78 s | 1.71 s |
| 5–7 d | 16,587 | 3.60 s | 1.62 s |

The archive (3 beaches) gives 3.8–4.0 s for the MF partition period and 2.8–3.0 s for the ECMWF peak period.

- The two periods are different quantities. The MF value is the period of one partition. CDIP Tp and ECMWF `wave_peak_period` are spectral peaks. Thus the comparison favors ECMWF.
- The hybrid as specified does not change the period. The partition periods stay MFWAM.
- A change to the period source would also change the shoaling bucket lookup in the transform. Treat it as a separate decision with its own replay.
- `wave_peak_period_om` is null on every logged row. Thus the log cannot give the MF peak period.

## 3. Spec of the hybrid that won (RSS basis)

1. **Inputs.** Use the MFWAM components as `forecast-builder.ts` builds them today: swell_1, swell_2, wind_wave. Heights are in ft, with the period and direction of each component.
2. **ECMWF Hs.** Use Open-Meteo `ecmwf_wam025` `wave_height` at the beach lat/lon with `cell_selection=sea`. Use the newest run that is available at the issue time. Do not use a run that is newer than the MF run.
3. **Ratio.** r = ECMWF Hs (ft) / sqrt(sum of the squared heights of the 3 components). Do not use `wave_height` (MF total) as the denominator. The MF total is about 10% larger than the 3-component energy (median 1.10, 5–95%: 1.00–1.43). It includes energy that the transform never sees. The RSS denominator puts the full ECMWF energy into the partitions that the transform uses. It scored 0.02–0.06 ft better at every lead.
4. **Rescale.** Multiply every component height and `rawHeightFt` by r. Do not change periods or directions.
5. **Cap.** Clamp r to 0.5–2.0. The r distribution: p5 0.93, median 1.20, p95 1.63, maximum 4.06. The cap changes MAE by 0.01 ft or less. It only guards against a bad ECMWF cell.
6. **Null or zero ECMWF, or empty components.** Set r = 1 and use the production path with the production factor. This occurred at OB SF–Sloat on 100% of rows, because the coastal cell has no ECMWF value. It occurred on 1.1% of all rows. No other beach had nulls once the day-7 index was corrected.
7. **Transform.** Use `transformToFaceHeightDecomposed` with the beach config, which includes `deepwater_decay_factor`, and with no beach id. Then multiply by the per-beach hybrid k.
8. **k fit.** k = median(CDIP-path face / hybrid face) over 0–24 h rows, with at least 100 rows (50 per half in this replay). Clamp k to 0.8–2.5. If |k − 1| < 0.08, set k = 1. Keep this k table separate from `MODEL_SWELL_CALIBRATION_FACTORS`, because it is a different ruler.
9. **Held stations.** A station hold (`MODEL_SWELL_STATION_FACTOR_HOLDS`) limits k but not r. Thus at 215 the effective multiplier becomes about 1.6 × 1.2. Rule: do not apply the hybrid at a station that has a hold. Use production there until the hold is removed.
10. **Scope.** Apply only at forecast hours ≥ 120 h, and only at beaches with a hybrid k. After a replay with the wider archive confirms it, extend the scope to ≥ 72 h.

## 4. Where the hybrid loses, and why

**La Jolla reefs and Ventura no longer lose.** With RSS basis and the current buckets, all 9 beaches win at all three leads, except Big Rock and Birdrock at 1–3 d (+0.04 and +0.02 ft):

- La Jolla Shores: 0.67 → 0.53 (0–24 h), 0.71 → 0.58 (1–3 d), 0.85 → 0.58 (5–7 d)
- Scripps: 0.77 → 0.65, 0.78 → 0.69, 0.89 → 0.65
- C Street: 0.49 → 0.42, 0.53 → 0.49, 0.97 → 0.67
- Emma Wood: 0.44 → 0.36, 0.48 → 0.40, 0.79 → 0.43

The Nov 4 losses at La Jolla and Ventura did not repeat. Probable causes: the Ventura buoy reassignment to 203 and the bucket changes since Nov 4. I did not prove the cause.

**Beaches where the RSS hybrid loses to prod by more than 0.03 ft:**

| Group | Beaches | Loss | Cause (measured) |
|---|---|---|---|
| Station 215 inside the harbor and cove | Rockpile, Crystal Cove, HB Cliffs, Newport 56th, The Wedge, Corona del Mar, Newport Point | +0.05 to +0.28 ft at 0–72 h | MF was already right. Raw truth/hybrid is 0.89–0.94. The ECMWF cell is 6–22 km offshore at 33.5 N, −118.0 or −117.75, and r is 1.10–1.43. The k rule cannot correct this. Crystal Cove falls inside the ±0.08 "no effect" band, so k = 1 and the 6% over-call stays. At Rockpile k corrects the bias (0.91), but r adds hour-to-hour noise that the beach does not have. |
| North County San Diego, station 153 | San Elijo, Ponto | +0.05 to +0.13 ft at 0–72 h | The ECMWF cell (33.0 N, −117.5) is 20–24 km offshore, so r ≈ 1.28–1.41. San Elijo wants k = 0.69 but the floor is 0.8. |
| Malibu, station 103 | Latigo Point, Point Dume | +0.06 to +0.18 ft | r ≈ 1.03, so the hybrid adds little signal. Latigo k goes from 1.11 to 1.00 (min-effect rule), and the over-call rises. |
| Station 215 in the swell week | All 18 beaches | W45 1–3 d bias +0.80 ft | The hybrid goes around the 1.6 hold that protects the west-swell over-call (see the factors file note). |
| OB SF–Sloat | 1 beach | +0.04 ft at 0–24 h | No ECMWF cell. The beach falls back to production with a refit k. |

The common cause is the coarse ECMWF grid (0.25°). In a bight or behind a headland, the nearest sea cell is 15–24 km offshore and sees more energy than the beach. Where the beach-level partitions were already right, r adds energy that the beach does not get. The k floor (0.8) and the min-effect band (0.08) then stop the per-beach k from removing it. At 5–7 d the MF forecast itself drifts more, so this cost is smaller than the gain.

## 5. Data gaps and limits

- **Skipped beaches.** 21 calibrated beaches have no truth. CDIP 198 (Santa Monica Bay: 9 beaches), CDIP 155 (Imperial Beach nearshore and Baja: 11 beaches) and CDIP 157 (1 beach) return HTTP 404 for the realtime file. The production fit script falls back to stored observations. This replay did not do that. County Line was skipped because its buoy is 3,839 km away (station 217). Four `model_only` beaches have no buoy.
- **Station 201 coverage.** The La Jolla beaches on 201 have about 60% truth coverage (378 of 641 rows).
- **The 3–5 d bin.** This bin comes only from the archive: 3 beaches and 1,226 rows.
- **ECMWF age.** The ECMWF run age is known only to within 24 h. The two N rules give the range. I measured this range only for the Hs-ratio hybrid: at 5–7 d it is 0.71–0.73 ft. I did not compute a "fresher ECMWF" RSS variant.
- **Production fit.** The production factors are in-sample (section 1). Their 0–24 h MAE (0.67 ft) is better than any held-out factor would give.
- **Comparison with Nov 4.** The Nov 4 replay gave prod 0.83 ft, refit 0.69 ft and hybrid 0.63 ft. Since then, #1317 raised the factor cap. Production at 0–24 h is now 0.67 ft, so most of the old gap is closed.

## 6. Recommendation

1. Build the RSS-basis hybrid with r capped at 0.5–2.0 and a separate per-beach hybrid k table. Use it for forecast hours ≥ 120 h at calibrated beaches only. Do not use it at station 215, or at any other station with a hold.
2. Keep production for 0–120 h. Run this replay again after the next buoy-confirmed west swell. At station 215, compare the hold with a refit k that has no hold. That decision is separate from the hybrid.
3. Do not use the hybrid at beaches without a hybrid k. A borrowed k gives 1.10 ft MAE.
4. Before the archive is used again, add `ecmwf_wam025` to every calibrated beach in `swell-forecast-archive.py`. Today it saves ECMWF only at 9 points. With that change, the 3–5 d bin can be measured at all beaches in one month.

## 7. Follow-up: RSS hybrid against refit (both held out)

Both methods are held out by week. Refit is the fair baseline, because prod is in-sample. Script: `scripts/hybrid-replay-vs-refit.py`. Raw output: `scripts/.hybrid-cache/vs-refit.txt`. The 3–5 d bin comes from the archive. A "clamped" beach has its refit k or its RSS-hybrid k on a bound (0.8, 1.6 or 2.5). This gives 29 beaches.

Face MAE in ft: refit → RSS hybrid. Beach wins count the beaches with ≥ 30 rows.

| Cut | Lead | n | All | ≥4 ft | Beach wins |
|---|---|---|---|---|---|
| All beaches | 0–24 h | 20,591 | 0.70 → 0.60 | 0.98 → 0.76 | 77/94 |
| | 1–3 d | 19,331 | 0.70 → 0.63 | 0.99 → 0.83 | 65/94 |
| | 3–5 d (archive) | 1,226 | 1.04 → 0.84 | 1.23 → 0.93 | 3/4 |
| | 5–7 d | 16,773 | 0.85 → 0.67 | 1.35 → 0.97 | 84/94 |
| Without 215 | 0–24 h | 16,357 | 0.63 → 0.55 | 0.87 → 0.72 | 66/76 |
| | 1–3 d | 15,385 | 0.64 → 0.58 | 0.89 → 0.79 | 57/76 |
| | 3–5 d (archive) | 864 | 1.01 → 0.87 | 1.21 → 1.01 | 2/3 |
| | 5–7 d | 13,403 | 0.76 → 0.62 | 1.19 → 0.92 | 72/76 |
| Without clamped k | 0–24 h | 14,105 | 0.61 → 0.56 | 0.80 → 0.70 | 53/65 |
| | 1–3 d | 13,258 | 0.61 → 0.59 | 0.82 → 0.77 | 43/65 |
| | 3–5 d (archive) | 612 | 1.04 → 0.95 | 1.12 → 0.98 | 1/2 |
| | 5–7 d | 11,532 | 0.73 → 0.63 | 1.12 → 0.91 | 57/65 |
| **Without both** | 0–24 h | 12,223 | 0.62 → 0.55 | 0.82 → 0.70 | 50/57 |
| | 1–3 d | 11,504 | 0.63 → 0.59 | 0.84 → 0.77 | 42/57 |
| | 3–5 d (archive) | 612 | 1.04 → 0.95 | 1.12 → 0.98 | 1/2 |
| | 5–7 d | 10,034 | 0.75 → 0.63 | 1.13 → 0.90 | 54/57 |

**Answer: yes.** In the "without both" cut, the hybrid beats refit at every lead, for all hours and for hours ≥4 ft. By week, it also beats refit in the W45 swell week at every lead (0.94 → 0.83, 1.00 → 0.95, 1.32 → 1.03). It loses in only two week-lead cells: W41 at 1–3 d (0.72 → 0.75) and W42 at 5–7 d (0.43 → 0.45).

**Limit.** In this cut, the 3–5 d bin has only one beach with ECMWF data: Blacks. OB SF has no ECMWF value and equals refit. Thus 3–5 d is supported, but not proved. Against refit, there is no evidence for a gate at 120 h. One continuous hybrid at all leads avoids a visible height step.

**Changes to the verdict.** Against refit, not against in-sample prod:
- Use the RSS hybrid at all leads on the eligible beaches.
- Do not use the 120 h gate.
- Keep station 215 and beaches with a clamped k on production.

Note: against in-sample prod, the result at 1–3 d is a tie. The difference comes from the prod leakage (section 1).

**Eligible beaches.** The eligible beaches are calibrated, have live CDIP truth and an ECMWF cell, are not on station 215, and have a refit k and an RSS-hybrid k that are not clamped. There are 56. For 19 of them, k = 1, which means no factor. The ids and k values are in `quiver/.worktrees/hybrid-replay/scripts/hybrid-k-eligible.json`. Each k was fit on all weeks of 0–24 h rows.

**Update, Nov 9 2026.** 10 of the 56 were removed (Ocean Beach, Ocean Beach Pier, Avalanche, Mission Beach x2, Sunset Cliffs x3, Osprey Point, New Break). The replay truth at these beaches still carried `direction_shadow`, which prod dropped later on Nov 6. Their truth is 0.63–0.74 × the current buoy ruler, so their k and their scores in this report are not valid for today's prod. 46 beaches stay.

**Refit, Nov 9 2026.** A fresh replay (predicted_at Oct 10–Nov 9, 30 days, cache cleared) refit every k on clamped r (0.5–2.0). Rows with no ECMWF value are now left out of the k fit and scored with the production factor.

- Ruler: the median of truth / (buoy Hs × current bucket) is 0.999–1.002 at all 97 beaches with truth (buoy Tp over 8 s).
- Same rows: all 21,335 hybrid 0–24 h rows are in the production fit, with the same truth and the same uncalibrated face. This held only after the production fit was changed to replay the current `shoaling_factors`. Before that, 596 rows at Point Dume, Latigo Point and Leo Carrillo differed.
- Held out by week, refit → hybrid (no station 215, no clamped k): 0–24 h 0.68 → 0.57, 1–3 d 0.70 → 0.62, 5–7 d 0.92 → 0.74 ft.
- A beach that enters the table must pass the entry gate: held out by week, the 0–24 h hybrid MAE is at or below the production-factor MAE, and the bias is within ±0.2 ft. Of the 10 removed beaches, 6 passed and came back. Avalanche, Sunset Cliffs – Garbage, Osprey Point and New Break failed.
- The table has 52 beaches. Leo Carrillo joined. Swami's left, because its refit k is on the 2.5 bound.
- Refit both tables with `scripts/refit-model-swell-tables.sh .env.local 30 --write`.
