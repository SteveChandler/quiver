# Quiver vs Surfline Backward Benchmark

Status: **COMPLETE — 36 of 36 observation rows have exact-hour Surfline forecasts**

Generated: 2026-08-03

This is an internal product-improvement benchmark, not a public accuracy claim.

## Decision

Current Quiver does not beat Surfline on this cohort: its point MAE is 1.20 ft versus Surfline's 1.07 ft midpoint MAE.

The existing guarded, upward-only blend does beat Surfline on this cohort:

- Quiver guarded blend: **0.93 ft MAE**
- Surfline midpoint: **1.07 ft MAE**
- Improvement versus current Quiver: **22.4%**
- Improvement versus Surfline midpoint: **12.7%**
- Head-to-head: Quiver 18 wins, Surfline 17 wins, 1 tie

The paired result is promising but not conclusive. The 95% target-cluster bootstrap interval for guarded-Quiver MAE minus Surfline MAE is **-0.40 to +0.13 ft**, crossing zero. This is a 36-label, 33-unique-target retrospective based on weak surfer reports.

Fast recommendation: finish and validate the existing guarded blend for `model_swell` forecasts at **0–24 hours only**, behind its existing flag. Do not spend another cycle tuning spot-specific corrections or allowing downward adjustments yet. The current work-in-progress code permits 0–72 hours, but this benchmark provides no evidence beyond 24 hours.

No production activation was performed.

## Cohort

- Window: 2026-07-04 through 2026-08-02, complete calendar days in `America/Los_Angeles`.
- Candidate source: `session_wave_observation_candidates` joined to its archived `ml_predictions_log` row.
- Included: real, non-system, non-mock users; positive reported face height; linked ML prediction; canonical `face-Hs-transformer-v1` display snapshot.
- Excluded: one positive session label with no linked prediction.
- Final cohort: 36 observations, 18 beaches, 10 users, and 33 unique forecast targets.
- Horizons: all 15–24 hours (`0-24h` bucket).
- Source: all 36 rows used `model_swell`.
- Snapshot completeness: Quiver display, raw Open-Meteo, and v5 shadow are all 36/36.
- Write-time integrity: every linked forecast row was created before the observation.
- Truth caveat: session face-height reports are weak labels, not instrument observations. One Del Mar target has contradictory 1 ft and 3 ft reports. Two other targets have duplicate identical reports. Unique-target weighting prevents those duplicated targets from receiving extra weight.
- Missing competitor cases: none; exact-hour Surfline values were resolved for all 36 observations.

This benchmark does not test NOAA forecasts or matched buoy observations. It answers the narrower product question available from archived data: whether Quiver's issued point surf height can match or beat Surfline's issued surf-height range midpoint against the same surfer-reported target.

## Forecast candidates

Current Quiver is the archived display height.

The existing guarded blend is upward-only and matches `lib/services/forecast/model-swell-height-blend.ts`:

```text
if raw OM > current:
  guarded = current + min(0.4 × (raw OM - current), 1 ft)
else:
  guarded = current
```

A symmetric offline variant allowing a capped 1 ft reduction scores 0.89 ft MAE, only 0.05 ft better than the upward-only version. That incremental result is too small and too label-sensitive to justify expanding behavior now.

## Surfline extraction rules

1. Select the Surfline historical forecast whose `startDate` equals the local calendar date on which Quiver's archived forecast was issued.
2. Use Table view and enable hourly rows.
3. Disable **Show observed surf heights** so Smart Cam hindsight does not replace the issued LOTUS forecast.
4. Select the row at the exact local hour of Quiver's `predicted_at` timestamp.
5. Preserve Surfline's published range and `+` marker verbatim.
6. Point metric: midpoint of the printed numeric bounds. The `+` marker is not assigned an invented numeric value.
7. Range metric: zero error when the observation lies inside the printed numeric bounds; otherwise distance to the nearest printed bound. `+` is retained as metadata and does not silently widen the interval.

## Aggregate score

| Metric                                 |     Current Quiver | Raw Open-Meteo | Guarded Quiver |                               Surfline |
| -------------------------------------- | -----------------: | -------------: | -------------: | -------------------------------------: |
| Observation-weighted point MAE, n=36   |            1.20 ft |        1.06 ft |    **0.93 ft** |                       1.07 ft midpoint |
| Unique-target-weighted point MAE, n=33 |            1.22 ft |        1.09 ft |    **0.94 ft** |                       1.08 ft midpoint |
| Point bias, forecast minus observed    |           -0.61 ft |              — |       -0.12 ft |                      -0.04 ft midpoint |
| Head-to-head point wins, n=36          |                 15 |              — |         **18** | 17 against guarded; 18 against current |
| Head-to-head ties, n=36                | 3 against Surfline |              — |              1 |   1 against guarded; 3 against current |
| Printed-range coverage                 |                n/a |            n/a |            n/a |                          21/36 (58.3%) |
| Printed-range distance MAE             |                n/a |            n/a |            n/a |                                0.58 ft |

At the unique-target level, guarded Quiver wins 16 targets, Surfline wins 15, and 2 tie. The result is not created by duplicated observations.

## Horizon score

| Horizon bucket                 |   n | Current Quiver | Guarded Quiver | Surfline midpoint |
| ------------------------------ | --: | -------------: | -------------: | ----------------: |
| 0–24h (observed range: 15–24h) |  36 |        1.20 ft |    **0.93 ft** |           1.07 ft |

There are no longer-horizon cases in the verified cohort, so this benchmark supports no claim for 25–72 hours.

## Chronological stability

| Slice              |   n | Current Quiver | Guarded Quiver | Surfline midpoint |
| ------------------ | --: | -------------: | -------------: | ----------------: |
| Earlier cases 1–24 |  24 |        1.33 ft |    **1.04 ft** |           1.10 ft |
| Latest cases 25–36 |  12 |        0.95 ft |    **0.72 ft** |           1.00 ft |

The guarded blend beats Surfline in both chronological slices. The early advantage is small; the latest slice is stronger.

## Spot-level score

These spot rows are diagnostic only. Del Mar has nine labels; every other spot has three or fewer.

| Spot               |   n | Current MAE | Guarded MAE | Surfline midpoint MAE | Lower MAE |
| ------------------ | --: | ----------: | ----------: | --------------------: | --------- |
| HB Cliffs          |   3 |        0.67 |        0.77 |                  1.17 | Quiver    |
| Crystal Pier       |   1 |        1.90 |        0.90 |                  0.50 | Surfline  |
| La Jolla Shores    |   1 |        0.40 |        0.84 |                  0.50 | Surfline  |
| Ponto              |   1 |        0.60 |        0.12 |                  2.00 | Quiver    |
| C Street           |   3 |        0.77 |        0.95 |                  0.83 | Surfline  |
| Ocean Beach Pier   |   2 |        1.05 |        0.13 |                  1.00 | Quiver    |
| Del Mar            |   9 |        0.98 |        0.80 |                  0.83 | Quiver    |
| Laniakea           |   2 |        1.45 |        0.47 |                  0.50 | Quiver    |
| Seal Beach Pier    |   1 |        0.20 |        0.52 |                  0.50 | Surfline  |
| Ala Moana Bowls    |   3 |        0.67 |        0.47 |                  0.17 | Surfline  |
| Pleasure Point     |   2 |        3.85 |        2.91 |                  2.50 | Surfline  |
| Pipes              |   1 |        0.20 |        0.28 |                  1.50 | Quiver    |
| The Hook           |   1 |        3.80 |        2.88 |                  2.50 | Surfline  |
| HB Pier Northside  |   1 |        0.90 |        1.46 |                  2.50 | Quiver    |
| Seaside Reef       |   1 |        2.70 |        2.18 |                  2.50 | Quiver    |
| Capitola           |   2 |        1.50 |        1.00 |                  1.50 | Quiver    |
| Terramar Point     |   1 |        1.30 |        1.30 |                  0.50 | Surfline  |
| Malibu First Point |   1 |        0.50 |        0.30 |                  0.50 | Quiver    |

Quiver has lower guarded MAE at 10 of 18 spots. Surfline has lower MAE at 8. These are not stable spot-specific calibration estimates because most cells contain one observation.

## Where guarded Quiver loses

The largest gaps versus Surfline are:

|  Case | Spot            | Observed | Guarded | Surfline | Guarded error | Surfline midpoint error |   Gap |
| ----: | --------------- | -------: | ------: | -------: | ------------: | ----------------------: | ----: |
|    24 | Pleasure Point  |      7.0 |    2.20 |     3–4+ |          4.80 |                    3.50 | +1.30 |
|    16 | Ala Moana Bowls |      5.0 |    3.88 |      4–6 |          1.12 |                    0.00 | +1.12 |
| 34–35 | Del Mar         |      3.0 |    4.50 |      3–4 |          1.50 |                    0.50 | +1.00 |
|    31 | Terramar Point  |      3.0 |    4.30 |     3–4+ |          1.30 |                    0.50 | +0.80 |
|     5 | C Street        |      3.0 |    4.18 |     2–3+ |          1.18 |                    0.50 | +0.68 |
|    28 | Del Mar         |      5.0 |    4.02 |      4–5 |          0.98 |                    0.50 | +0.48 |

Cases 31 and 34–35 expose the upward-only tradeoff: raw Open-Meteo was below current Quiver, but the guarded candidate intentionally refused to lower the forecast. The symmetric offline variant improves those rows, but the total gain is only 0.05 ft MAE and it worsens some already-correct cases. Keep downward corrections out of the fast release.

Pleasure Point and The Hook remain major under-calls for both products. That is the next model-error investigation after the guarded blend, not a reason to block the general uplift.

## Raw scored results

All heights and absolute errors are feet. `Guarded` is the existing upward-only candidate. `Winner` compares guarded Quiver with Surfline's numeric midpoint.

| Case | Spot               | Observed | Current | Raw OM | Guarded | Surfline range | Current error | Guarded error | Surfline error | Winner   |
| ---: | ------------------ | -------: | ------: | -----: | ------: | -------------: | ------------: | ------------: | -------------: | -------- |
|    1 | HB Cliffs          |      1.0 |     1.4 |    2.6 |    1.88 |            1–2 |          0.40 |          0.88 |           0.50 | Surfline |
|    2 | Crystal Pier       |      3.0 |     1.1 |    3.7 |    2.10 |            2–3 |          1.90 |          0.90 |           0.50 | Surfline |
|    3 | La Jolla Shores    |      3.0 |     3.4 |    4.5 |    3.84 |           2–3+ |          0.40 |          0.84 |           0.50 | Surfline |
|    4 | Ponto              |      3.0 |     2.4 |    4.2 |    3.12 |            4–6 |          0.60 |          0.12 |           2.00 | Quiver   |
|    5 | C Street           |      3.0 |     4.1 |    4.3 |    4.18 |           2–3+ |          1.10 |          1.18 |           0.50 | Surfline |
|    6 | Ocean Beach Pier   |      3.0 |     1.8 |    4.9 |    2.80 |           3–4+ |          1.20 |          0.20 |           0.50 | Quiver   |
|    7 | Del Mar            |      3.0 |     4.2 |    3.2 |    4.20 |           2–3+ |          1.20 |          1.20 |           0.50 | Surfline |
|    8 | Del Mar            |      3.0 |     2.9 |    2.8 |    2.90 |           2–3+ |          0.10 |          0.10 |           0.50 | Quiver   |
|    9 | HB Cliffs          |      3.0 |     2.3 |    2.4 |    2.34 |            1–2 |          0.70 |          0.66 |           1.50 | Quiver   |
|   10 | Del Mar            |      1.0 |     2.9 |    2.8 |    2.90 |           2–3+ |          1.90 |          1.90 |           1.50 | Surfline |
|   11 | HB Cliffs          |      3.0 |     2.1 |    2.4 |    2.22 |            1–2 |          0.90 |          0.78 |           1.50 | Quiver   |
|   12 | Laniakea           |      3.0 |     1.3 |    3.8 |    2.30 |            2–3 |          1.70 |          0.70 |           0.50 | Surfline |
|   13 | Laniakea           |      3.0 |     1.8 |    4.2 |    2.76 |            2–3 |          1.20 |          0.24 |           0.50 | Quiver   |
|   14 | Seal Beach Pier    |      1.0 |     0.8 |    2.6 |    1.52 |            0–1 |          0.20 |          0.52 |           0.50 | Surfline |
|   15 | Ala Moana Bowls    |      5.0 |     5.0 |    4.6 |    5.00 |            4–5 |          0.00 |          0.00 |           0.50 | Quiver   |
|   16 | Ala Moana Bowls    |      5.0 |     3.2 |    4.9 |    3.88 |            4–6 |          1.80 |          1.12 |           0.00 | Surfline |
|   17 | Ala Moana Bowls    |      5.0 |     5.2 |    5.4 |    5.28 |           4–6+ |          0.20 |          0.28 |           0.00 | Surfline |
|   18 | Pleasure Point     |      3.0 |     1.1 |    3.3 |    1.98 |            4–5 |          1.90 |          1.02 |           1.50 | Quiver   |
|   19 | C Street           |      3.0 |     1.9 |    2.7 |    2.22 |            2–3 |          1.10 |          0.78 |           0.50 | Surfline |
|   20 | Pipes              |      3.0 |     3.2 |    3.4 |    3.28 |            4–5 |          0.20 |          0.28 |           1.50 | Quiver   |
|   21 | The Hook           |      5.0 |     1.2 |    3.5 |    2.12 |            2–3 |          3.80 |          2.88 |           2.50 | Surfline |
|   22 | HB Pier Northside  |      1.0 |     1.9 |    3.3 |    2.46 |           3–4+ |          0.90 |          1.46 |           2.50 | Quiver   |
|   23 | Seaside Reef       |      5.0 |     2.3 |    3.6 |    2.82 |           2–3+ |          2.70 |          2.18 |           2.50 | Quiver   |
|   24 | Pleasure Point     |      7.0 |     1.2 |    3.8 |    2.20 |           3–4+ |          5.80 |          4.80 |           3.50 | Surfline |
|   25 | Ocean Beach Pier   |      3.0 |     2.1 |    4.2 |    2.94 |            4–5 |          0.90 |          0.06 |           1.50 | Quiver   |
|   26 | Capitola           |      3.0 |     0.5 |    4.1 |    1.50 |            0–1 |          2.50 |          1.50 |           2.50 | Quiver   |
|   27 | Capitola           |      1.0 |     0.5 |    3.8 |    1.50 |            1–2 |          0.50 |          0.50 |           0.50 | Tie      |
|   28 | Del Mar            |      5.0 |     3.9 |    4.2 |    4.02 |            4–5 |          1.10 |          0.98 |           0.50 | Surfline |
|   29 | Del Mar            |      3.0 |     2.3 |    4.1 |    3.02 |            4–5 |          0.70 |          0.02 |           1.50 | Quiver   |
|   30 | Del Mar            |      3.0 |     2.3 |    4.1 |    3.02 |            4–5 |          0.70 |          0.02 |           1.50 | Quiver   |
|   31 | Terramar Point     |      3.0 |     4.3 |    3.8 |    4.30 |           3–4+ |          1.30 |          1.30 |           0.50 | Surfline |
|   32 | Del Mar            |      3.0 |     2.9 |    3.2 |    3.02 |           2–3+ |          0.10 |          0.02 |           0.50 | Quiver   |
|   33 | C Street           |      1.0 |     1.1 |    3.1 |    1.90 |            2–3 |          0.10 |          0.90 |           1.50 | Quiver   |
|   34 | Del Mar            |      3.0 |     4.5 |    3.0 |    4.50 |            3–4 |          1.50 |          1.50 |           0.50 | Surfline |
|   35 | Del Mar            |      3.0 |     4.5 |    3.0 |    4.50 |            3–4 |          1.50 |          1.50 |           0.50 | Surfline |
|   36 | Malibu First Point |      1.0 |     0.5 |    2.5 |    1.30 |            1–2 |          0.50 |          0.30 |           0.50 | Quiver   |

## Exact issue-date and target-hour matches

|  Case | Beach                     | Surfline issue date | Target local time  | Surfline range |
| ----: | ------------------------- | ------------------- | ------------------ | -------------- |
|     1 | HB Cliffs                 | 2026-07-04          | Sun 7/5 11:00      | 1–2 ft         |
|     2 | Crystal Pier              | 2026-07-05          | Mon 7/6 11:00      | 2–3 ft         |
|     3 | La Jolla Shores           | 2026-07-07          | Wed 7/8 11:00      | 2–3+ ft        |
|     4 | Ponto                     | 2026-07-07          | Wed 7/8 11:00      | 4–6 ft         |
|     5 | C Street                  | 2026-07-07          | Wed 7/8 20:00      | 2–3+ ft        |
|     6 | Ocean Beach Pier          | 2026-07-08          | Thu 7/9 08:00      | 3–4+ ft        |
|     7 | Del Mar                   | 2026-07-09          | Fri 7/10 11:00     | 2–3+ ft        |
|     8 | Del Mar                   | 2026-07-10          | Sat 7/11 08:00     | 2–3+ ft        |
|     9 | HB Cliffs                 | 2026-07-10          | Sat 7/11 08:00     | 1–2 ft         |
|    10 | Del Mar                   | 2026-07-10          | Sat 7/11 08:00     | 2–3+ ft        |
|    11 | HB Cliffs                 | 2026-07-10          | Sat 7/11 11:00     | 1–2 ft         |
|    12 | Laniakea                  | 2026-07-15          | Wed 7/15 23:00 HST | 2–3 ft         |
|    13 | Laniakea                  | 2026-07-16          | Fri 7/17 14:00 HST | 2–3 ft         |
|    14 | Seal Beach Pier Northside | 2026-07-17          | Sat 7/18 11:00     | 0–1 ft         |
|    15 | Ala Moana Bowls           | 2026-07-19          | Mon 7/20 11:00 HST | 4–5 ft         |
|    16 | Ala Moana Bowls           | 2026-07-21          | Wed 7/22 08:00 HST | 4–6 ft         |
|    17 | Ala Moana Bowls           | 2026-07-22          | Thu 7/23 08:00 HST | 4–6+ ft        |
|    18 | Pleasure Point            | 2026-07-24          | Sat 7/25 05:00     | 4–5 ft         |
|    19 | C Street                  | 2026-07-24          | Sat 7/25 14:00     | 2–3 ft         |
|    20 | Pipes                     | 2026-07-24          | Sat 7/25 14:00     | 4–5 ft         |
|    21 | The Hook                  | 2026-07-25          | Sun 7/26 08:00     | 2–3 ft         |
|    22 | HB Pier Northside         | 2026-07-25          | Sun 7/26 08:00     | 3–4+ ft        |
|    23 | Seaside Reef              | 2026-07-25          | Sun 7/26 17:00     | 2–3+ ft        |
|    24 | Pleasure Point            | 2026-07-25          | Sun 7/26 20:00     | 3–4+ ft        |
|    25 | Ocean Beach Pier          | 2026-07-26          | Mon 7/27 14:00     | 4–5 ft         |
|    26 | Capitola                  | 2026-07-26          | Mon 7/27 20:00     | 0–1 ft         |
|    27 | Capitola                  | 2026-07-27          | Tue 7/28 11:00     | 1–2 ft         |
|    28 | Del Mar                   | 2026-07-28          | Wed 7/29 08:00     | 4–5 ft         |
| 29–30 | Del Mar                   | 2026-07-29          | Thu 7/30 08:00     | 4–5 ft         |
|    31 | Terramar Point            | 2026-07-30          | Fri 7/31 11:00     | 3–4+ ft        |
|    32 | Del Mar                   | 2026-07-31          | Sat 8/1 08:00      | 2–3+ ft        |
|    33 | C Street                  | 2026-07-31          | Sat 8/1 17:00      | 2–3 ft         |
| 34–35 | Del Mar                   | 2026-08-01          | Sun 8/2 08:00      | 3–4 ft         |
|    36 | Malibu First Point        | 2026-08-01          | Sun 8/2 17:00      | 1–2 ft         |

## Spot mapping

| Quiver spot                     | Surfline spot                   | Surfline ID                | Status                                                         |
| ------------------------------- | ------------------------------- | -------------------------- | -------------------------------------------------------------- |
| HB Cliffs                       | HB Cliffs                       | `640a3f7c606c45fdf1b09880` | verified in Surfline search                                    |
| Crystal Pier                    | Crystal Pier (San Diego)        | `5842041f4e65fad6a7708841` | verified in Surfline search                                    |
| La Jolla Shores                 | La Jolla Shores                 | `5842041f4e65fad6a77088cc` | verified in Surfline UI                                        |
| Ponto                           | Ponto                           | `5842041f4e65fad6a77088a5` | verified in Surfline UI                                        |
| C Street / Ventura Point        | C Street                        | `5842041f4e65fad6a7708828` | verified in Surfline search                                    |
| Ocean Beach Pier                | Ocean Beach Pier                | `5842041f4e65fad6a770883f` | verified in Surfline UI                                        |
| Del Mar                         | Del Mar                         | `5842041f4e65fad6a77088af` | verified in Surfline UI                                        |
| Laniakea                        | Laniakea                        | `5842041f4e65fad6a7708898` | verified in Surfline search                                    |
| Seal Beach Pier                 | Seal Beach Pier, Northside      | `5b71b95fc27dc6001ab8becf` | provisional; Southside alternate is `5842041f4e65fad6a77088e4` |
| Ala Moana Bowls                 | Ala Moana Bowls                 | `5842041f4e65fad6a7708b42` | verified in Surfline UI                                        |
| Pleasure Point                  | Pleasure Point                  | `5842041f4e65fad6a7708807` | verified in Surfline search                                    |
| Pipes                           | Pipes (San Diego)               | `5c008f5313603c0001df5318` | verified in Surfline search                                    |
| The Hook                        | The Hook (Santa Cruz County)    | `584204204e65fad6a7709996` | verified in Surfline search                                    |
| Huntington Beach Pier Northside | Huntington Beach Pier Northside | `5842041f4e65fad6a7708827` | verified in Surfline search                                    |
| Seaside Reef                    | Seaside Reef                    | `5842041f4e65fad6a77088b3` | verified in Surfline search                                    |
| Capitola Beach                  | Capitola                        | `5842041f4e65fad6a7708ddf` | verified in Surfline search                                    |
| Terramar Point                  | Terramar Point                  | `5842041f4e65fad6a77088a6` | verified in Surfline UI                                        |
| Malibu Surfrider (First Point)  | Malibu First Point              | `584204214e65fad6a7709b9f` | verified in Surfline search                                    |

## Forecast layer status

Verdict: **PASS for the completed retrospective; NOT PRODUCTION-PROVEN.**

| Layer               | Status | Evidence                                                                   | Next action                        |
| ------------------- | ------ | -------------------------------------------------------------------------- | ---------------------------------- |
| upstream source     | PASS   | 36/36 rows have model-swell display, raw OM, and v5 snapshots              | none for this benchmark            |
| parser/normalizer   | PASS   | 36/36 canonical display snapshots; reported-height consistency 100%        | none                               |
| database row        | PASS   | 36 linked archived predictions; all issued before observation              | preserve exact timestamps          |
| transform/scoring   | PASS   | Existing upward-only blend scored exactly as implemented                   | restrict first validation to 0–24h |
| UI/display          | PASS   | Surfline hourly table verified; observed-height hindsight overlay disabled | preserve overlay rule              |
| external comparison | PASS   | 36/36 exact-hour Surfline values retrieved                                 | keep result internal               |

## Implementation recommendation

1. Keep the existing upward-only 40% blend and 1 ft cap. It improves current Quiver materially and already matches/beats Surfline on this complete backward cohort.
2. Change the initial eligibility ceiling from 72 hours to 24 hours. That is the only horizon supported by this evidence.
3. Keep the existing environment flag and current-height fallback. Log original height, raw OM, adjusted height, source, horizon, and model version for every eligible row.
4. Validate the exact output path in preview, then use a reversible limited rollout. Do not block on a new model or spot-specific rules.
5. Investigate Pleasure Point and The Hook under-calls separately. Do not tune global behavior to two weak-label outliers.

The practical conclusion is not that Quiver has universally beaten Surfline. It is that the small guarded change already in progress is the fastest evidence-backed route from **behind Surfline** to **slightly ahead on the available historical cohort**.
