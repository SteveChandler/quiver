**The alert-side scorer is wrong for this use: presets and the canonical engine do measure different things, but the alert adapter feeds a preset-relative ranking margin into a 0–100 hero-surface utility bar (including a discontinuity above `1.0`), so the resulting `go`/`maybe`/`no` verdict is not evidence that the matched surf is bad.**

# Alert preset versus canonical calibration — 2026-08-10

Read-only research on commit `8a8ad5d8e`, branch `work/calibration-20260810` off `origin/prod`. No production write, cron trigger, route call, provider call, commit, push, PR, merge, or deploy was performed.

## Executive answer

The disagreement is not mainly evidence that the presets are too loose, and it is not the intended personalized behavior described in candidate explanation 3.

- The preset matcher is a Boolean contract: all configured raw conditions must pass. The evaluator then requires daylight, a viable-duration window, and rideable size.
- `best_score` is a relative margin used to choose the best already-matching hour. It is not the discovery system's calibrated 0–100 session utility.
- The alert adapter nevertheless converts `best_score` to a supposed utility and sends it to the canonical `70`/`40` bars.
- The alert candidate contains no `recommendationLabel` and no `personalMatch`, so every safety-eligible verdict in this sample is `physical_fallback`, not a personalized learned verdict. Skill is used as a safety gate only.
- The same canonical engine is coherent on discovery inputs, where it receives `recommendation.score`, `recommendationLabel`, and optional learned personal-match evidence. The fault is the alert adapter's incompatible input, not the shared engine's discovery contract.

For an opt-in condition alert, canonical safety should remain fail-closed. The user's rule match should govern semantic eligibility unless Quiver adds a separately validated alert-quality measure. Applying the current hero `go` bar to `best_score` should not govern delivery. Whether alerts should additionally require a quality gate is an operator policy choice; this report does not choose it.

## Snapshots and evidence status

The primary finding is the retained production summary from `2026-08-10T17:55:28.139Z`:

- 141 active rules for 94 real users.
- 7,764 `enhanced_forecasts` rows across 76 alert beaches.
- Forecast horizon `2026-08-10T18:00:00Z` through `2026-08-22T12:00:00Z` (11.75 days; final day partial).
- Newest write `2026-08-10T17:31:16.123Z`, 0.40 hours old.
- 1,833 modeled rule-day evaluations and 279 matched actionable windows.
- 104 safety rejections, all `beach_skill_exceeds_user`; 175 windows remained safety-eligible.
- The shortened hold control was `allowed` for 279/279, so major-event hold state did not create the disagreement.

The primary run retained its aggregate summary but not its row-level ledger. Forecast rows are mutable, so it is impossible to reconstruct an exact fine-grained histogram or condition distribution for those same 279 windows after later forecast writes.

I therefore ran the included extended harness at `2026-08-10T18:35:09.068Z`. That validation snapshot had 7,732 rows, 0.05-hour freshness, a slightly shifted 11.85-day horizon, and 288 matches. It is used below only where row-level detail or modeled sensitivity is required. It is not relabeled as the 17:55 measurement.

The data-correctness verifier returns `WATCH`, solely because the forward horizon ends on a partial day. All source counts and reconciliations pass. Machine-readable evidence is in `2026-08-10-alert-preset-canonical-calibration-evidence.json`.

## Where the bars actually sit

The canonical engine defines:

|    Canonical score | Verdict                    |
| -----------------: | -------------------------- |
|            `>= 70` | `go` / `selected_go`       |
| `>= 40` and `< 70` | `maybe` / `selected_maybe` |
|             `< 40` | `no` / `selected_no`       |

Code evidence:

- `lib/recommendations/canonical-decision/engine.ts:27-28` defines `70` and `40`.
- `engine.ts:86-94` first honors an explicit discovery recommendation label, then falls back to those utility bars.
- `lib/recommendations/canonical-decision/alert-adapter.ts:52-55` maps `best_score` in `[0,1]` to `score * 100`, but leaves every other value unchanged.
- `lib/alerts/best-hour.ts:3-44` computes `best_score` as the mean of relative distances from the rule's own thresholds.
- `lib/alerts/push-formatter.ts:17-28` explicitly describes `best_score` as normalized window quality, “NOT the 0-100 composite.”

That last pair is the contract mismatch.

### Exact distribution relative to the bars at 17:55

This is measured from the 279-window primary summary. Safety-rejected windows do not receive a quality verdict, so their underlying score band cannot be recovered from the retained aggregate.

| Preset              | Safety-eligible | `<40` (`no`) | `40–69.999` (`maybe`) | `>=70` (`go`) |
| ------------------- | --------------: | -----------: | --------------------: | ------------: |
| `weekend_warrior`   |              26 |            8 |                    18 |             0 |
| `clean_groundswell` |              86 |           72 |                    13 |             1 |
| `mellow_session`    |              62 |           11 |                    40 |            11 |
| Custom              |               1 |            0 |                     1 |             0 |
| **Total**           |         **175** |       **91** |                **72** |        **12** |

The other 104 of 279 windows were safety-rejected before quality could govern: 88 mellow, 13 weekend, and 3 custom.

### Fine-grained validation histogram at 18:35

These are measured safety-eligible preset windows from the later 288-window validation snapshot.

| Canonicalized score | `weekend_warrior` | `clean_groundswell` | `mellow_session` | Total |
| ------------------- | ----------------: | ------------------: | ---------------: | ----: |
| `0–9.999`           |                 0 |                   4 |                1 |     5 |
| `10–19.999`         |                 1 |                  21 |                2 |    24 |
| `20–29.999`         |                 2 |                  21 |                7 |    30 |
| `30–39.999`         |                 6 |                  29 |                1 |    36 |
| `40–49.999`         |                 7 |                   8 |               10 |    25 |
| `50–59.999`         |                 8 |                   5 |               12 |    25 |
| `60–69.999`         |                 4 |                   1 |               13 |    18 |
| `70–79.999`         |                 0 |                   0 |                7 |     7 |
| `80–89.999`         |                 0 |                   1 |                2 |     3 |
| `90–100`            |                 1 |                   0 |                2 |     3 |

The scorer-component replay reconciled to production `best_score` with maximum absolute delta `0`.

### The `>1.0` discontinuity

`best_score` is not actually bounded to `1.0`. Three validation matches exceeded it. Because the adapter multiplies only values `<=1`, these strong rows became canonical scores near `1`, not scores near or above `100`:

| Preset / session                 | Conditions at best hour         |       `best_score` |    Adapter utility | Verdict       |
| -------------------------------- | ------------------------------- | -----------------: | -----------------: | ------------- |
| Clean groundswell, Pine Trees    | 6.4 ft, 17 s, 1.74 kt wind      |             1.1476 |             1.1476 | `selected_no` |
| Mellow, Oceanside Harbor         | 2.2 ft, 13 s, 0 kt wind         | 1.0000000000000002 | 1.0000000000000002 | safety `no`   |
| Mellow beginner, La Jolla Shores | 2.1 ft, 13 s, 0 kt, rising tide |             1.0550 |             1.0550 | `selected_no` |

The Pine Trees row is decisive: it passed skill safety and the clean-groundswell rule, yet a mathematically stronger-than-maximum rank was converted into an almost-zero canonical utility. Moving the `go` threshold alone does not repair this discontinuity.

## Why `weekend_warrior` is the sharpest test

The live rule is identical for all 35 active weekend rules:

```json
{
  "swell_height_min": 2,
  "wind_speed_max_kt": 12,
  "days_of_week": [0, 6]
}
```

It intentionally means “rideable weekend opportunity,” not “epic surf.” It does not constrain period, swell direction, wind direction, or tide. That makes it broad, but broad is not the same as wrong for a work-schedule preset.

Its score has only two components; weekend membership is a pass/fail filter and contributes no score:

```text
best_score = average((wave_ft - 2) / 2, (12 - wind_kt) / 12)
canonical  = 100 * best_score, while best_score remains in [0,1]
```

At 8 kt wind, the wave height must be about 4.13 ft to reach `70`. At zero wind it still needs about 2.8 ft. Period, swell direction, wind direction, and tide cannot lift the score at all, even if they are excellent.

In the 18:35 validation, the nine safety-eligible weekend `selected_no` windows were:

- Wave height: 2.1–2.9 ft; median 2.5 ft.
- Period: 5–17 s; median 12 s; 75% at least 12 s.
- Wind: 4.35–8.69 kt; median 7.82 kt.
- Tide: 0.9–3.7 ft; eight rising, one falling.

An experienced surfer would not call that set categorically bad. A 2.5 ft, 12–17 s window with sub-9-kt wind can be a worthwhile small session at the right break. Conversely, this preset can admit a poor session because it ignores wind alignment, swell alignment, and tide. The records do not establish either universally: they contain degrees and tide state, but judging them requires each beach's orientation and tide behavior. What they do establish is that `selected_no` was caused by low distance from the 2-ft/12-kt boundaries, not by a comprehensive “bad surf” assessment.

The primary zero-of-26 result moved to one-of-29 at 18:35 after forecast refreshes. That instability is consistent with a hard boundary on a moving rank, not a stable expert judgment about weekend quality.

## Per-preset condition versus verdict

### `clean_groundswell`

The intended rule is at least 2 ft, at least 12 s, no more than 10 kt wind, and a beach-specific swell-direction window. Swell direction must pass the matcher but contributes nothing to `best_score`.

Among the 75 safety-eligible validation `selected_no` windows:

| Condition        | Min |  P25 | Median |  P75 |  Max |
| ---------------- | --: | ---: | -----: | ---: | ---: |
| Wave height (ft) | 2.0 |  2.2 |    2.6 |  2.8 |  6.4 |
| Period (s)       |  12 |   12 |     12 |   13 |   17 |
| Wind (kt)        |   0 | 4.35 |   4.35 | 8.69 | 8.69 |
| Tide height (ft) | 1.3 | 2.45 |    3.0 | 3.25 |  6.0 |

Sixty-four were on a rising tide and 11 falling; tide is not part of this preset. The median row is modest but plausible clean groundswell, not self-evidently bad. Some near-10-kt onshore rows could be poor because the preset caps wind speed but not wind direction; the aggregate cannot classify wind alignment without per-beach geometry. The 6.4-ft/17-s/1.74-kt Pine Trees `no` is plainly a score-conversion failure, independent of that ambiguity.

There is limited live-row drift: one in-scope clean rule lacks both the 2-ft minimum and direction bounds and produced four validation matches. Across all enabled clean rules, two lack the height minimum. That can make those rules too loose, but four rows cannot explain 85 of 86 primary disagreements. The cause of the non-parity rows was not determined.

### `mellow_session`

Mellow is different in purpose and in scoring math:

- It is the only free preset (`lib/alerts/entitlements.ts:18`). That is an entitlement decision, not a scoring input.
- Standard live rules cap size at 4 ft and wind at 8 kt, usually with a beach tide range.
- Sandy-beginner variants further narrow size, use a morning window, and avoid high tide.
- The score counts wave height twice: once as distance above the minimum and again as distance from the range center. If a tide range exists, tide-center fit adds another positive component. Weekend has only wave-minimum and wind-maximum margins.

That extra center-fit structure explains why mellow has a meaningful `go` tail while weekend and clean groundswell do not. It does not show that the free tier was deliberately scored more generously.

Among the 11 safety-eligible validation mellow `selected_no` windows:

- Wave height: 1.5–2.1 ft; median 1.6 ft.
- Period: 5–13 s; median 8 s.
- Wind: 0–7.82 kt; median 6.08 kt.
- Tide: 0.7–3.7 ft; seven rising, four falling.

Those are genuinely mellow conditions: potentially weak for a shortboard or advanced surfer, but aligned with “small, clean, and fun” for longboards and learners. The alert adapter does not supply board preference or learned match evidence, so its `no` cannot mean “bad for this user.”

Live-row drift is also present here: six enabled mellow rules use a legacy 1-ft minimum rather than the current 1.5-ft default; they produced 14 validation matches. Another 26 matches came from sandy-beginner variants. This heterogeneity changes score distributions because each rule defines its own denominator and center.

### `epic_conditions` and custom

One epic rule existed and matched zero windows. No conclusion about its strictness or scorer agreement is possible. Custom had four primary matches and only one safety-eligible window, so it is too thin for inference.

## Sensitivity: candidate alert bars

This table is modeled on the 18:35 validation snapshot, not measured delivery and not the unrecoverable row-level 17:55 ledger. Safety stays fail-closed. The table applies a candidate qualification bar to the current adapter utility, then deduplicates to one modeled alert per user, beach, and local date. It does not model hourly cross-beach selection, cooldowns, weekly caps, channel settings, revalidation, or provider/device receipt.

|    Candidate bar | Eligible preset rule-windows | Change vs bar 70 | Modeled user×beach×day alerts | Users reached |
| ---------------: | ---------------------------: | ---------------: | ----------------------------: | ------------: |
|                0 |                          176 |             +163 |                           154 |            33 |
|               10 |                          171 |             +158 |                           149 |            33 |
|               20 |                          147 |             +134 |                           128 |            33 |
|               30 |                          117 |             +104 |                           104 |            31 |
|               40 |                           81 |              +68 |                            74 |            27 |
|               50 |                           56 |              +43 |                            53 |            21 |
|               60 |                           31 |              +18 |                            31 |            15 |
| **70 (current)** |                       **13** |            **0** |                        **13** |         **5** |
|               80 |                            6 |               −7 |                             6 |             4 |
|               90 |                            3 |              −10 |                             3 |             2 |

For the exact primary snapshot, only bars aligned with retained verdict bands can be recovered: bar 70 admitted 12 of 174 safety-eligible preset windows; bar 40 would admit 83; bar 0 would admit all 174 because every matched score component is nonnegative. Intermediate exact counts and deduplicated volumes cannot be recovered without the missing row ledger.

This sensitivity should inform policy, not select it. It also demonstrates why simply choosing a lower number is incomplete: preset scores are not comparable across rule shapes, and scores just above `1.0` still collapse below every practical bar.

## Forecast-source and calibration confounders

The 288 matched validation windows used mixed wave sources:

| `data_source` | Matches |
| ------------- | ------: |
| `OPEN_METEO`  |     187 |
| `NOAA_NWS`    |      72 |
| `FALLBACK`    |      16 |
| `CDIP`        |      13 |

Wind source was NWS for 272 and HRRR for 16. Weekend's 29 safety-eligible matches were 27 Open-Meteo and 2 fallback; clean groundswell was more mixed (48 Open-Meteo, 36 NOAA, 3 CDIP, 3 fallback).

A read-only join across the 76 alert beaches' validation horizon found 4,160 beach-hour pairs with `ml_predictions_log.display_source = face-Hs-transformer-v1`, model `face-Hs-transformer-v1`, V5 shadow version `v5_1_nw_ge1_raw_om.20260622_0630`, and no feedback-height calibration applied. Another 2,964 pairs had no matching ML log row. Absence of a log does not prove absence of a display transform, so exact per-window calibration state could not be established from this snapshot.

Source mix can move individual heights and therefore threshold margins, but it does not explain the structural result: the replay reproduced `best_score` exactly from the checked-in formula for every matched row.

## What each component is for

| Component                    | What it answers                                                                                                             | Appropriate alert role                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Preset condition matcher     | “Do the raw conditions the user subscribed to exist?”                                                                       | Semantic eligibility                               |
| Daylight/viability checks    | “Is there a usable, rideable window?”                                                                                       | Safety/operability gate                            |
| `best_score`                 | “Which already-matching hour is furthest inside this rule's thresholds?”                                                    | Rank matching hours; descriptive copy              |
| Canonical discovery decision | “Which safe candidate is most worth recommending, using comparable utility, labels, and learned preference when available?” | Hero/discovery selection; reusable safety contract |
| Current alert adapter        | “Treat preset-relative margin as canonical utility”                                                                         | Not calibrated for a delivery quality gate         |

`selectedAlertMatch` only maps the canonical candidate ID back to the matching alert row (`app/api/cron/condition-alert-deliver/route.ts:315-325`). It does not reconcile the two score meanings.

## Recommendations for the operator decision

No threshold or preset change is recommended here.

Before choosing a gating policy:

1. Decide the product contract: “notify when my explicit rule matches” versus “notify only when Quiver independently says go.” Both are defensible, but they are different promises.
2. Preserve canonical skill/closure/major-event safety regardless of that choice.
3. Do not use the current alert-adapter utility for quality gating until its input scale and semantics are defined across every preset, including values above `1.0`.
4. If an independent quality gate is desired, replay a comparable discovery/native condition score and validate it against observed sessions or expert-labeled beach-hours. Do not tune against forecast-only agreement with the presets.
5. Audit and classify non-parity live rule rows before attributing misses to current preset definitions.

## What could not be determined

- The exact fine-grained histogram, sensitivity curve, or condition distribution of the original 279 windows; only its aggregate verdict bands were retained.
- Whether an experienced surfer would approve each future session. These are forecasts without camera, buoy-at-session, or surfer-rating truth.
- Per-window wind quality for presets that do not require wind alignment, without joining and evaluating each beach's geometry in the retained 17:55 ledger.
- Exact per-window display-transform/calibration provenance for beach-hours without a matching ML log.
- Why the two clean rules lack a height minimum or why six mellow rules retain a 1-ft legacy minimum.
- Long-run alert volume. The sensitivity model covers one 11.85-day moving forecast snapshot and omits live delivery caps and revalidation.
- Epic and custom calibration because their samples are zero and one safety-eligible window, respectively.

## Reproduction

```bash
NODE_PATH="$PWD/scripts/research/stubs" \
ALERTS_DELIVERY_ENABLED=true \
node --import tsx scripts/research/analyze-alert-preset-canonical-disagreement.ts
```

Set `ALERT_CALIBRATION_INCLUDE_RECORDS=true` to emit the rule-day ledger. User IDs are emitted only as stable 12-character SHA-256 keys; emails are never emitted.
