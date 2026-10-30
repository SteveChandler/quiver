# Storm-class backtest on San Diego buoys (2026-10-30)

## Decision

**Keep the starting `STORM_EVENT_THRESHOLDS` (`minPeriodS` 7, `minPeakFaceHeightFt` 5, `minFaceRiseFt` 3, `minEnergyRatio` 2.5).**

| Criterion | Result |
| --- | --- |
| 1. Every stored big event under 11 s inside the window is matched by a storm event within 36 h | **FAIL: 17 of 20.** By any kind of event, 19 of 20. |
| 2. Storm events average 4 or fewer per winter month | **PASS: 46224 1.33 per month, 46266 0.87 per month** |

Changing face or rise, in that order as the plan asks, does not recover any of the three misses. They are lost for two other reasons, covered under "The three misses" below:

- Two buoy readings have a 6.67 s dominant period, which is under the 7 s period floor.
- One is a detector edge case. A track gets no baseline on its first known day after an event.

Lowering face to 4.5 ft adds a net 9 storm events and lowering rise to 2 ft adds 1, and neither adds a match. Criterion 2 has about three times the allowed headroom, so nothing needs raising either.

## Setup

- **Script:** `scripts/backtest-storm-class.ts`, run with `node --import tsx scripts/backtest-storm-class.ts`. It needs `www.ndbc.noaa.gov`. Inside the Claude sandbox, Node's `fetch` ignores the proxy unless you set `NODE_USE_ENV_PROXY=1`. Downloads are cached in `.cache/big-swells/`, the same cache `scripts/big-swells/build-big-swells.ts` uses, and are read with `parseNdbcStdmet` (`lib/climatology/parse-ndbc.ts`). The 2026 yearly archive is not published yet, and its 404 is not cached, so every run makes one request per station.
- **Data:** NDBC stdmet for 46224 (Oceanside Offshore) and 46266 (Del Mar Nearshore). Each station uses the `h2023`, `h2024` and `h2025` yearly archives plus the 2026 Jan, Feb and Mar monthly files. All three winters are fully published: every winter month has data on every day, with 56,554 and 56,542 complete readings.
- **Rows:** each half-hourly reading with WVHT, DPD and MWD present becomes one forecast row with a single partition:
  - `swell_1_height` is Hs in feet;
  - `swell_1_period` is DPD;
  - `swell_1_direction` is MWD;
  - `swell_2_*` is null.
- **Beach:** a test beach with a swell window of 250° ± 90°, terrain off and no decay. Exposure is 1 for 160–340°, so the run tests the class rules, not exposure.
- **Detector:** `detectBeachSwellEvents(..., { stormClass: true, horizonDays: 400 })`, run once per station and winter:
  - `now` is Nov 1 00:00 PDT;
  - rows run from 48 h before `now` up to Apr 1 00:00 PDT;
  - the timezone is `America/Los_Angeles`;
  - events peaking outside Nov 1–Mar 31 are dropped.
- **Ground truth:** the `recent` and `biggest` entries for both stations in `lib/data/big-swells.json` (generated 2026-10-23), duplicates merged, inside Nov 2023–Mar 2024, Nov 2024–Mar 2025 and Nov 2025–Mar 2026. An entry counts as matched when an event of the right kind peaks within 36 h of the entry's `at`.

### Face height for buoy Hs

The detector turns the partition into face height with the shared transformer (`model_swell`, calibration factor 1 for the test beach). From 7 to 10.5 s, face is about 0.81–0.85 × Hs in feet. So 5 ft of face needs Hs of about 1.85 m. The stored "big" cut is about 2.25 m (`bigHsM`), which gives about 6 ft of face.

| Hs m (ft) | 5.9 s | 6.67 s | 7.14 s | 7.69 s | 8.33 s | 9.09 s | 10.53 s | 11.11 s | 14.29 s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.5 (4.9) | 3.8 | 3.9 | 4.0 | 4.2 | 4.1 | 4.2 | 4.5 | 4.7 | 5.8 |
| 1.8 (5.9) | 4.5 | 4.7 | 4.8 | 5.0 | 4.9 | 5.1 | 5.5 | 5.6 | 7.0 |
| 2.0 (6.6) | 5.0 | 5.2 | 5.4 | 5.5 | 5.4 | 5.6 | 6.1 | 6.2 | 7.8 |
| 2.25 (7.4) | 5.6 | 5.9 | 6.0 | 6.2 | 6.1 | 6.3 | 6.8 | 7.0 | 8.8 |
| 2.5 (8.2) | 6.3 | 6.5 | 6.7 | 6.9 | 6.8 | 7.1 | 7.6 | 7.8 | 9.7 |
| 2.8 (9.2) | 7.0 | 7.3 | 7.5 | 7.8 | 7.6 | 7.9 | 8.5 | 8.7 | 10.9 |
| 3.2 (10.5) | 8.0 | 8.4 | 8.6 | 8.9 | 8.7 | 9.0 | 9.7 | 10.0 | 12.4 |

## Runs

The `--face`, `--rise`, `--ratio` and `--period` flags change a threshold for that run only. The shipped values live in `lib/alerts/swell-events/exposure.ts`. The "Matched" column counts stored events under 11 s that are matched by a storm event.

| Run | Thresholds (period / face / rise / ratio) | Matched | Storm events 46224 / 46266 | Per winter month 46224 / 46266 | Outcome |
| --- | --- | ---: | ---: | ---: | --- |
| 1: start | 7 / 5 / 3 / 2.5 | 17 of 20 | 20 / 13 | 1.33 / 0.87 | C1 FAIL, C2 PASS |
| 2: `--face=4.5` | 7 / **4.5** / 3 / 2.5 | 17 of 20 (same misses) | 24 / 18 | 1.60 / 1.20 | C1 FAIL, C2 PASS |
| 3: `--rise=2` | 7 / 5 / **2** / 2.5 | 17 of 20 (same misses) | 21 / 13 | 1.40 / 0.87 | C1 FAIL, C2 PASS |
| 4: `--period=6.5` (diagnostic only) | **6.5** / 5 / 3 / 2.5 | 18 of 20 (recovers 46266 2025-03-13) | 20 / 14 | 1.33 / 0.93 | C1 FAIL, C2 PASS |

- **Run 2** adds ten storm events between 4.5 and 4.9 ft and drops one, a net gain of nine. The dropped event is 46224 2024-02-05 at 10.5 s and 7.5 ft. A lower face threshold changes where earlier events end, which moves the baselines that later days are measured against.
- **Run 3** adds one event, 46224 2026-02-20 at 7.7 s and 5.5 ft, a rise of 2.2 ft over 3.3 ft.
- **Run 4** moves the period floor of the storm class itself. That is outside the plan's list of thresholds to tune (face, then rise), so the value was not adopted. See "Options not taken".

### Rise and ratio rarely decide anything on buoy rows

29 of 33 storm events in run 1 have a baseline face of 0 ft. On those, rise equals face and the energy ratio is capped at 99.

This happens because the buoy's dominant period jumps between swell trains, for example 7.7 s and then 15 s. The tracker splits on a jump of more than 3 s, so the 7–11 s track usually starts on the day of the storm. Every earlier day outside a track's life counts as zero energy.

On these rows, then, the storm class works out to "face ≥ 5 ft and 7 ≤ period < 11 s". Only 4 of the 33 events had a real baseline for rise and ratio to test against. Forecast partitions are steadier, so on live forecasts rise and ratio should matter more than they do here.

## Matches (run 1)

All times are Pacific. "Max daylight face" is the largest face height in daylight rows (06:00–19:00) within 36 h of the stored peak. The second face column counts only rows with a 7–11 s period.

| Station | Stored peak | List | Hs m | DPD s | MWD | Storm match | Nearest storm event | Nearest event of any kind | Max daylight face ±36 h | Same, 7–11 s rows only |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 46224 | 2024-01-03 23:56 | recent | 2.30 | 8.33 | 277 | yes | 2024-01-03 7.1 s 5.7 ft (−5 h) | same | 7.2 ft @ 12.5 s | 5.7 ft |
| 46224 | 2024-01-07 06:56 | recent | 2.81 | 7.69 | 278 | **NO** | 2024-01-04 10.5 s 5.5 ft (−63 h) | swell 2024-01-06 20 s 4.2 ft (−22 h) | 8.9 ft @ 16.7 s | 7.8 ft |
| 46224 | 2024-01-11 07:56 | recent | 3.19 | 8.33 | 280 | yes | 2024-01-11 8.3 s 7.3 ft (+0 h) | same | 8.3 ft @ 7.7 s | 8.3 ft |
| 46224 | 2024-02-01 14:26 | recent | 2.65 | 7.69 | 190 | yes | 2024-02-01 7.7 s 7.3 ft (+0 h) | same | 9.3 ft @ 14.3 s | 7.3 ft |
| 46224 | 2024-02-08 07:26 | recent | 2.55 | 7.69 | 284 | yes | 2024-02-08 7.7 s 7.1 ft (+0 h) | same | 7.1 ft @ 7.7 s | 7.1 ft |
| 46224 | 2024-03-24 05:56 | recent | 2.76 | 7.14 | 281 | yes | 2024-03-24 7.7 s 7.5 ft (+1 h) | same | 7.5 ft @ 7.7 s | 7.5 ft |
| 46224 | 2024-11-15 14:26 | recent | 2.39 | 6.67 | 278 | yes | 2024-11-15 7.7 s 6.6 ft (+3 h) | same | 6.6 ft @ 7.7 s | 6.6 ft |
| 46224 | 2025-03-03 07:56 | recent | 3.19 | 9.09 | 271 | yes | 2025-03-03 9.1 s 8.9 ft (+0 h) | same | 8.9 ft @ 9.1 s | 8.9 ft |
| 46224 | 2025-03-13 22:26 | recent | 2.48 | 7.14 | 264 | **NO** | 2025-03-11 7.1 s 5.8 ft (−55 h) | swell 2025-03-14 11.1 s 5.0 ft (+13 h) | 5.7 ft @ 6.7 s | 5.0 ft |
| 46224 | 2025-03-18 07:26 | recent | 2.70 | 7.69 | 282 | yes | 2025-03-18 7.7 s 7.5 ft (+0 h) | same | 7.5 ft @ 7.7 s | 7.5 ft |
| 46224 | 2025-12-24 16:56 | recent | 2.40 | 7.14 | 201 | yes | 2025-12-24 7.1 s 6.4 ft (+0 h) | same | 6.4 ft @ 7.1 s | 6.4 ft |
| 46266 | 2024-01-07 08:56 | recent + biggest | 2.98 | 7.69 | 284 | yes | 2024-01-07 7.7 s 8.3 ft (+0 h) | same | 9.7 ft @ 15.4 s | 8.3 ft |
| 46266 | 2024-01-11 04:26 | recent | 2.84 | 7.69 | 285 | yes | 2024-01-11 8.3 s 6.4 ft (+4 h) | same | 7.6 ft @ 7.7 s | 7.6 ft |
| 46266 | 2024-02-01 14:26 | recent | 2.36 | 7.69 | 256 | yes | 2024-02-01 10.5 s 6.8 ft (−1 h) | swell 16.7 s 8.4 ft (+1 h) | 9.3 ft @ 14.3 s | 6.8 ft |
| 46266 | 2024-02-08 06:56 | recent | 2.26 | 5.88 | 274 | yes | 2024-02-08 7.7 s 5.9 ft (+3 h) | same | 8.1 ft @ 15.4 s | 6.0 ft |
| 46266 | 2024-03-24 19:56 | recent | 2.53 | 7.14 | 271 | yes | 2024-03-24 7.7 s 7.0 ft (−13 h) | same | 7.0 ft @ 7.7 s | 7.0 ft |
| 46266 | 2024-11-15 12:26 | recent | 2.49 | 8.33 | 274 | yes | 2024-11-15 8.3 s 6.4 ft (+0 h) | same | 9.7 ft @ 14.3 s | 6.5 ft |
| 46266 | 2025-03-03 07:26 | recent + biggest | 3.16 | 9.09 | 273 | yes | 2025-03-03 9.1 s 8.6 ft (+0 h) | same | 10.9 ft @ 15.4 s | 8.6 ft |
| 46266 | 2025-03-13 21:26 | recent | 2.55 | 7.14 | 264 | **NO** | 2025-03-18 8.3 s 5.7 ft (+106 h) | swell 2025-03-11 14.3 s 7.4 ft (−55 h) | 7.8 ft @ 15.4 s | 5.2 ft |
| 46266 | 2025-03-18 05:56 | recent | 2.34 | 7.14 | 288 | yes | 2025-03-18 8.3 s 5.7 ft (+2 h) | same | 7.5 ft @ 13.3 s | 6.1 ft |

The two stored events with a dominant period under 7 s were both matched: 46224 2024-11-15 at 6.67 s and 46266 2024-02-08 at 5.88 s. A daylight hour within 36 h of each read 7.7 s.

Eleven stored entries in the winters were 11 s or longer, so the storm criterion leaves them out:

| Station | Entries |
| --- | --- |
| 46224 | 2023-12-28, 2024-02-05, 2024-02-20 |
| 46266 | 2023-12-28, 2024-01-04, 2024-02-05, 2024-02-20, 2024-12-24, 2025-02-14, 2025-03-28, 2025-11-14 |

All eleven are matched by an event within 36 h. Ten are swell events. 46266 2024-01-04 (13.3 s) is matched by a 9.9 s storm event 4 h later.

By the any-kind wording, 19 of 20 events under 11 s are matched. That count flatters the 46224 2024-01-07 match, though. The event that matches it is an unrelated 20 s groundswell, 22 h earlier.

### The three misses

Each table below lists the daylight peak of each day for the 7–11 s track around the stored peak. A dash means the track had no daylight reading that day.

**46224 2024-01-07 (Hs 2.81 m, 7.69 s, 278°): the empty-baseline edge.**

| Day | Face ft | Period s | Note |
| --- | ---: | ---: | --- |
| Jan 3 | 5.7 | 7.14 | storm event (baseline 0) |
| Jan 4 | 5.4 | 7.69 | continues the Jan 3 event |
| Jan 5, Jan 6 | — | — | the track has no daylight reading; DPD sat on the 11–20 s trains |
| Jan 7 | 6.8 | 8.33 | **not an event** |

`componentEvents` starts a fresh baseline on the day after an event ends. The baseline covers `days[baselineStart, index)`. Days inside a track's life with no reading are left out, so the first known day after the Jan 3–4 event is Jan 7. Its baseline range is empty, `baselineOf` returns null, and the day is skipped.

The rule is general: the first known day after any event in a track can never start a new event. When the days between are unknown, that first known day is the next big day.

This rule is in the code the swell pass shares, so it is a detector edge case, not a storm-class threshold. This task only tunes thresholds, so it was not changed. 46266 caught the same storm: Jan 7, 8.3 ft, baseline 3.6 ft.

**46224 2025-03-13 (Hs 2.48 m, 7.14 s, 264°): period floor, then a double peak.**

| Day | Face ft | Period s | Note |
| --- | ---: | ---: | --- |
| Mar 11 | 5.8 | 7.14 | storm event (baseline 0) |
| Mar 12 | 4.1 | 9.09 | lull; becomes the baseline |
| Mar 13 | 5.7 | **6.67** | **not an event** |
| Mar 14 | 4.4 | 6.67 | |

The day's daylight peak, chosen by energy, has a 6.67 s period. 6.67 s is an NDBC period bin, and it is below the 7 s floor. With `--period=6.5` the day is still measured against the Mar 12 lull of 4.1 ft: rise 1.6 ft, ratio 1.3. The detector still flags the storm twice:

- a storm event on Mar 11, 55 h before the stored peak;
- a swell event on Mar 14 at 11.1 s, 13 h after it.

**46266 2025-03-13 (Hs 2.55 m, 7.14 s, 264°): period floor.**

| Day | Face ft | Period s | Note |
| --- | ---: | ---: | --- |
| Mar 13 | 5.8 | **6.67** | track starts here, baseline 0; **not an event** |
| Mar 15 | 4.4 | 8.33 | |

Only the period stops it. `--period=6.5` turns it into a storm event at 6.67 s and 5.8 ft, 2 h before the stored peak (run 4).

## Storm events per month (run 1)

"Storm" is the raw storm-event count, which is what criterion 2 measures. "Episodes" merges storm events that peak within 36 h of each other into one weather episode.

| Month | 46224 storm / episodes | 46224 swell | 46266 storm / episodes | 46266 swell |
| --- | ---: | ---: | ---: | ---: |
| 2023-11 | 0 / 0 | 5 | 0 / 0 | 7 |
| 2023-12 | 0 / 0 | 9 | 0 / 0 | 9 |
| 2024-01 | 4 / 3 | 8 | 3 / 3 | 9 |
| 2024-02 | 4 / 4 | 9 | 2 / 2 | 11 |
| 2024-03 | 3 / 3 | 10 | 2 / 2 | 8 |
| 2024-11 | 1 / 1 | 4 | 1 / 1 | 6 |
| 2024-12 | 0 / 0 | 11 | 0 / 0 | 10 |
| 2025-01 | 0 / 0 | 6 | 0 / 0 | 7 |
| 2025-02 | 0 / 0 | 5 | 0 / 0 | 6 |
| 2025-03 | 3 / 3 | 13 | 2 / 2 | 8 |
| 2025-11 | 1 / 1 | 4 | 0 / 0 | 7 |
| 2025-12 | 1 / 1 | 3 | 0 / 0 | 5 |
| 2026-01 | 1 / 1 | 7 | 1 / 1 | 7 |
| 2026-02 | 2 / 2 | 4 | 2 / 2 | 5 |
| 2026-03 | 0 / 0 | 1 | 0 / 0 | 6 |
| **Total (15 months)** | **20 / 19** (1.33 per month) | 99 | **13 / 13** (0.87 per month) | 111 |

The busiest month is 4 storm events: 46224 in Jan 2024 and Feb 2024, during the El Niño winter. The swell column is the existing swell class on the same buoy rows, included for reference only. It is not a criterion here.

## Options not taken

These are open choices for whoever owns the storm class. They are not recommendations.

- **`minPeriodS` 6.5.** Recovers 46266 2025-03-13 and adds one storm event there. It changes the Task 1 class definition (period from 7 up to, but not including, 11 s) and the tests that pin the 7 s boundary. It does not recover 46224 2025-03-13, because rise blocks it after the period does not.
- **The empty-baseline edge in `componentEvents`.** For example, carry the previous event's lull forward as the baseline when the restart range is empty. This would recover 46224 2024-01-07. It is shared detector logic, so it would also change swell-event output.
