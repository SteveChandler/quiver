# Storm-class backtest on San Diego buoys (2026-10-30)

## Decision

> **Superseded for the period floor (Oct 30):** the shipped `minPeriodS` is now **5**, not 6.5. The detector runs on stored Open-Meteo partitions, whose periods read well under buoy peak period, and the 6.5 s floor hid the Nov 2026 San Diego storm. See [Stored-forecast replay (Oct 30)](#stored-forecast-replay-oct-30). The buoy runs below were made at 6.5 s; reproduce them with `--period=6.5`.

**Buoy-tuned `STORM_EVENT_THRESHOLDS`: `minPeriodS` 6.5 (was 7), `minPeakFaceHeightFt` 5, `minFaceRiseFt` 3, `minEnergyRatio` 2.5.**

| Criterion | Result |
| --- | --- |
| 1. Every stored big event under 11 s inside the window is matched by a storm event within 36 h | **FAIL: 18 of 19.** Misses caused by the known detector gap are left out of the count. Raw, it is 18 of 20. |
| 2. Storm events average 4 or fewer per winter month | **PASS: 46224 1.33 per month, 46266 0.93 per month** |

The first run used the starting values (period floor 7 s) and matched 17 of 20. The plan's tuning order is face first, then rise. Neither recovered a miss, and both added events. On review, the controller made three rulings:

- **R7:** lower the period floor to 6.5 s. NDBC reports dominant period in fixed bins, and the bin below 7.14 s is 6.67 s. A 7 s floor drops storms whose day peak reads in that bin. This recovers 46266 2025-03-13 for one extra storm event.
- **R8:** leave misses caused by the detector's shared baseline gap out of criterion 1. That is 46224 2024-01-07. The gap is documented below as a known detector gap. Follow-up: separate task.
- **R9:** try an 8 ft "always a storm" override. It changed nothing and was removed (see below).

**One miss remains: 46224 2025-03-13.** It is the second peak of a double-peaked storm. The sea never dropped below 4.1 ft between the two peaks, so the second peak rises only 1.6 ft over that lull. The detector still flagged the storm twice:

- a storm event on Mar 11, 55 h before the stored peak;
- a swell event on Mar 14, 13 h after it.

## Setup

- **Script:** `scripts/backtest-storm-class.ts`, run with `node --import tsx scripts/backtest-storm-class.ts`.
  - It needs `www.ndbc.noaa.gov`. Inside the Claude sandbox, Node's `fetch` ignores the proxy unless you set `NODE_USE_ENV_PROXY=1`.
  - Downloads are cached in `.cache/big-swells/`, the same cache `scripts/big-swells/build-big-swells.ts` uses. They are read with `parseNdbcStdmet` (`lib/climatology/parse-ndbc.ts`).
  - The 2026 yearly archive is not published yet, and its 404 is not cached, so every run makes one request per station.
- **Data:** NDBC stdmet for 46224 (Oceanside Offshore) and 46266 (Del Mar Nearshore). Each station uses:
  - the `h2023`, `h2024` and `h2025` yearly archives;
  - the 2026 Jan, Feb and Mar monthly files.

  All three winters are fully published, with every winter month covered on every day. That is 56,554 complete readings at 46224 and 56,542 at 46266.
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
- **Ground truth:** the `recent` and `biggest` entries for both stations in `lib/data/big-swells.json` (generated 2026-10-23), with duplicates merged. Only entries inside Nov 2023–Mar 2024, Nov 2024–Mar 2025 and Nov 2025–Mar 2026 count. An entry is matched when an event of the right kind peaks within 36 h of the entry's `at`.
- **The script's criterion 1 line** leaves out the entries listed in `DETECTOR_GAP_MISSES` (R8), but only while they stay unmatched. It also prints the raw count.

### Face height for buoy Hs

The detector turns the partition into face height with the shared transformer (`model_swell`, calibration factor 1 for the test beach). From 6.5 to 10.5 s, face is about 0.8–0.85 × Hs in feet. So 5 ft of face needs Hs of about 1.85 m. The stored "big" cut is about 2.25 m (`bigHsM`), which gives about 6 ft of face.

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

The `--face`, `--rise`, `--ratio` and `--period` flags change a threshold for that run only. The shipped values live in `lib/alerts/swell-events/exposure.ts`.

- **Raw matched:** stored events under 11 s matched by a storm event, out of 20.
- **Matched (R8):** the same count with the detector-gap miss left out, out of 19.

| Run | Thresholds (period / face / rise / ratio) | Raw matched | Matched (R8) | Storm events 46224 / 46266 | Per winter month 46224 / 46266 | C1 (R8) | C2 |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| 1: start | 7 / 5 / 3 / 2.5 | 17 of 20 | 17 of 19 | 20 / 13 | 1.33 / 0.87 | FAIL | PASS |
| 2: `--face=4.5` | 7 / **4.5** / 3 / 2.5 | 17 of 20 | 17 of 19 | 24 / 18 | 1.60 / 1.20 | FAIL | PASS |
| 3: `--rise=2` | 7 / 5 / **2** / 2.5 | 17 of 20 | 17 of 19 | 21 / 13 | 1.40 / 0.87 | FAIL | PASS |
| 4: `--period=6.5` (trial) | **6.5** / 5 / 3 / 2.5 | 18 of 20 | 18 of 19 | 20 / 14 | 1.33 / 0.93 | FAIL | PASS |
| 5: 6.5 shipped in `exposure.ts` (R7) | 6.5 / 5 / 3 / 2.5 | 18 of 20 | 18 of 19 | 20 / 14 | 1.33 / 0.93 | FAIL | PASS |
| 6: R7 + `alwaysStormFaceFt` 8 (R9, removed) | 6.5 / 5 / 3 / 2.5, face ≥ 8 always a storm | 18 of 20 | 18 of 19 | 20 / 14 | 1.33 / 0.93 | FAIL | PASS |
| Final (after removing R9) | 6.5 / 5 / 3 / 2.5 | 18 of 20 | 18 of 19 | 20 / 14 | 1.33 / 0.93 | FAIL | PASS |

What each run changed:

- **Run 2** adds ten storm events between 4.5 and 4.9 ft and drops one, a net gain of nine. The dropped event is 46224 2024-02-05 at 10.5 s and 7.5 ft. A lower face threshold changes where earlier events end, which moves the baselines that later days are measured against.
- **Run 3** adds one event: 46224 2026-02-20 at 7.7 s and 5.5 ft, a rise of 2.2 ft over 3.3 ft.
- **Runs 4 and 5** each add one event, 46266 2025-03-13 at 6.67 s and 5.8 ft. It matches the stored event 2 h later. No other event changes.
- **The final run** produces the same storm events as run 5.

### R9: an 8 ft "always a storm" override (tried and removed)

The trial added `alwaysStormFaceFt: 8` to `STORM_EVENT_THRESHOLDS`. It made `qualifiesAsStorm` accept any day with face ≥ 8 ft and a period from 6.5 up to 11 s, whatever its rise or ratio.

The keep rule was: recover 46224 2025-03-13, and stay at or under 4 storm events a month at both stations. The override failed the first part.

- **It changed nothing.** Run 6 produced exactly the same events as run 5.
- **It could not have recovered the remaining miss.** That day's peak is 5.7 ft, well under 8 ft.
- **It had nothing else to catch.** It created no new event anywhere in these six station-winters. A storm-band day of 8 ft or more is almost always far above its baseline, so rise or ratio already passes it.

The constant and the code were removed, and no test was added for it.

### Rise and ratio rarely decide anything on buoy rows

30 of 34 storm events in the final run have a baseline face of 0 ft. On those, rise equals face and the energy ratio is capped at 99.

This happens because the buoy's dominant period jumps between swell trains, for example 7.7 s and then 15 s. The tracker splits a track on a jump of more than 3 s, so the storm-band track usually starts on the day of the storm. Every earlier day outside a track's life counts as zero energy.

On these rows, then, the storm class works out to "face ≥ 5 ft and 6.5 ≤ period < 11 s". Rise and ratio had a real baseline to test against on only 4 events. Forecast partitions are steadier, so on live forecasts rise and ratio should matter more than they do here.

## Matches (final run)

All times are Pacific. "Max daylight face" is the largest face height in daylight rows (06:00–19:00) within 36 h of the stored peak. The second face column counts only rows with a period from 6.5 up to 11 s.

| Station | Stored peak | List | Hs m | DPD s | MWD | Storm match | Nearest storm event | Nearest event of any kind | Max daylight face ±36 h | Same, 6.5–11 s rows only |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 46224 | 2024-01-03 23:56 | recent | 2.30 | 8.33 | 277 | yes | 2024-01-03 7.1 s 5.7 ft (−5 h) | same | 7.2 ft @ 12.5 s | 5.7 ft |
| 46224 | 2024-01-07 06:56 | recent | 2.81 | 7.69 | 278 | no, detector gap (excluded, R8) | 2024-01-04 10.5 s 5.5 ft (−63 h) | swell 2024-01-06 20 s 4.2 ft (−22 h) | 8.9 ft @ 16.7 s | 7.8 ft |
| 46224 | 2024-01-11 07:56 | recent | 3.19 | 8.33 | 280 | yes | 2024-01-11 8.3 s 7.3 ft (+0 h) | same | 8.3 ft @ 7.7 s | 8.3 ft |
| 46224 | 2024-02-01 14:26 | recent | 2.65 | 7.69 | 190 | yes | 2024-02-01 7.7 s 7.3 ft (+0 h) | same | 9.3 ft @ 14.3 s | 7.3 ft |
| 46224 | 2024-02-08 07:26 | recent | 2.55 | 7.69 | 284 | yes | 2024-02-08 7.7 s 7.1 ft (+0 h) | same | 7.1 ft @ 7.7 s | 7.1 ft |
| 46224 | 2024-03-24 05:56 | recent | 2.76 | 7.14 | 281 | yes | 2024-03-24 7.7 s 7.5 ft (+1 h) | same | 7.5 ft @ 7.7 s | 7.5 ft |
| 46224 | 2024-11-15 14:26 | recent | 2.39 | 6.67 | 278 | yes | 2024-11-15 7.7 s 6.6 ft (+3 h) | same | 6.6 ft @ 7.7 s | 6.6 ft |
| 46224 | 2025-03-03 07:56 | recent | 3.19 | 9.09 | 271 | yes | 2025-03-03 9.1 s 8.9 ft (+0 h) | same | 8.9 ft @ 9.1 s | 8.9 ft |
| 46224 | 2025-03-13 22:26 | recent | 2.48 | 7.14 | 264 | **NO** | 2025-03-11 7.1 s 5.8 ft (−55 h) | swell 2025-03-14 11.1 s 5.0 ft (+13 h) | 5.7 ft @ 6.7 s | 5.7 ft |
| 46224 | 2025-03-18 07:26 | recent | 2.70 | 7.69 | 282 | yes | 2025-03-18 7.7 s 7.5 ft (+0 h) | same | 7.5 ft @ 7.7 s | 7.5 ft |
| 46224 | 2025-12-24 16:56 | recent | 2.40 | 7.14 | 201 | yes | 2025-12-24 7.1 s 6.4 ft (+0 h) | same | 6.4 ft @ 7.1 s | 6.4 ft |
| 46266 | 2024-01-07 08:56 | recent + biggest | 2.98 | 7.69 | 284 | yes | 2024-01-07 7.7 s 8.3 ft (+0 h) | same | 9.7 ft @ 15.4 s | 8.3 ft |
| 46266 | 2024-01-11 04:26 | recent | 2.84 | 7.69 | 285 | yes | 2024-01-11 8.3 s 6.4 ft (+4 h) | same | 7.6 ft @ 7.7 s | 7.6 ft |
| 46266 | 2024-02-01 14:26 | recent | 2.36 | 7.69 | 256 | yes | 2024-02-01 10.5 s 6.8 ft (−1 h) | swell 16.7 s 8.4 ft (+1 h) | 9.3 ft @ 14.3 s | 6.8 ft |
| 46266 | 2024-02-08 06:56 | recent | 2.26 | 5.88 | 274 | yes | 2024-02-08 7.7 s 5.9 ft (+3 h) | same | 8.1 ft @ 15.4 s | 6.0 ft |
| 46266 | 2024-03-24 19:56 | recent | 2.53 | 7.14 | 271 | yes | 2024-03-24 7.7 s 7.0 ft (−13 h) | same | 7.0 ft @ 7.7 s | 7.0 ft |
| 46266 | 2024-11-15 12:26 | recent | 2.49 | 8.33 | 274 | yes | 2024-11-15 8.3 s 6.4 ft (+0 h) | same | 9.7 ft @ 14.3 s | 6.5 ft |
| 46266 | 2025-03-03 07:26 | recent + biggest | 3.16 | 9.09 | 273 | yes | 2025-03-03 9.1 s 8.6 ft (+0 h) | same | 10.9 ft @ 15.4 s | 8.6 ft |
| 46266 | 2025-03-13 21:26 | recent | 2.55 | 7.14 | 264 | yes (from run 4 on) | 2025-03-13 6.7 s 5.8 ft (−2 h) | same | 7.8 ft @ 15.4 s | 5.8 ft |
| 46266 | 2025-03-18 05:56 | recent | 2.34 | 7.14 | 288 | yes | 2025-03-18 8.3 s 5.7 ft (+2 h) | same | 7.5 ft @ 13.3 s | 6.1 ft |

The two stored events with a dominant period under 6.5 s were both matched: 46224 2024-11-15 at 6.67 s and 46266 2024-02-08 at 5.88 s. A daylight hour within 36 h of each read 7.7 s.

Eleven stored entries in the winters were 11 s or longer, so the storm criterion leaves them out:

| Station | Entries |
| --- | --- |
| 46224 | 2023-12-28, 2024-02-05, 2024-02-20 |
| 46266 | 2023-12-28, 2024-01-04, 2024-02-05, 2024-02-20, 2024-12-24, 2025-02-14, 2025-03-28, 2025-11-14 |

All eleven are matched by an event within 36 h. Ten are swell events. 46266 2024-01-04 (13.3 s) is matched by a 9.9 s storm event 4 h later.

### The remaining miss: 46224 2025-03-13 (Hs 2.48 m, 7.14 s, 264°)

This is the daily daylight peak of the storm-band track. A double peak meets the restart baseline.

| Day | Face ft | Period s | Note |
| --- | ---: | ---: | --- |
| Mar 11 | 5.8 | 7.14 | storm event (baseline 0) |
| Mar 12 | 4.1 | 9.09 | lull; ends the event and becomes the next baseline |
| Mar 13 | 5.7 | 6.67 | rises 1.6 ft at a ratio of 1.3 over Mar 12, so **not an event** |
| Mar 14 | 4.4 | 6.67 | |

With the 7 s floor, the 6.67 s period stopped Mar 13 first. With 6.5 s, the rise rule stops it. Recovering it would take a storm-only rise rule of about 1.5 ft or less, or a ratio rule of about 1.3 or less. The rulings did not ask for that, so it was not tried. The storm was flagged by the Mar 11 storm event and the Mar 14 swell event, so the class did not miss the storm itself, only its second peak.

## Known detector gap: no baseline on the first day with data after an event

**Follow-up: separate task.** This is not fixed here, because fixing it would change swell-alert output. Criterion 1 leaves out misses it causes (R8).

`componentEvents` (`lib/alerts/swell-events/detector.ts`) starts a fresh baseline on the day after an event ends. The baseline covers `days[baselineStart, index)`. Days inside a track's life that have no reading are left out. So if the days right after an event are unknown, the first known day has an empty baseline range. `baselineOf` returns null, and the day is skipped, however big it is.

The swell pass and the storm pass share this code, so the gap affects both.

**Example: 46224 2024-01-07 (Hs 2.81 m, 7.69 s, 278°).** These are the daily daylight peaks of the storm-band track:

| Day | Face ft | Period s | Note |
| --- | ---: | ---: | --- |
| Jan 3 | 5.7 | 7.14 | storm event (baseline 0) |
| Jan 4 | 5.4 | 7.69 | continues the Jan 3 event |
| Jan 5, Jan 6 | — | — | the track has no daylight reading; DPD sat on the 11–20 s trains |
| Jan 7 | 6.8 | 8.33 | first known day after the event: empty baseline, **skipped** |

46266, about 30 km to the south-east, caught the same storm on Jan 7: 8.3 ft over a baseline of 3.6 ft.

A possible fix is to carry the previous event's lull forward as the baseline when the restart range is empty. Because the swell pass shares this code, that change needs its own backtest of swell-event output.

## Storm events per month (final run)

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
| 2025-03 | 3 / 3 | 13 | 3 / 3 | 8 |
| 2025-11 | 1 / 1 | 4 | 0 / 0 | 7 |
| 2025-12 | 1 / 1 | 3 | 0 / 0 | 5 |
| 2026-01 | 1 / 1 | 7 | 1 / 1 | 7 |
| 2026-02 | 2 / 2 | 4 | 2 / 2 | 5 |
| 2026-03 | 0 / 0 | 1 | 0 / 0 | 6 |
| **Total (15 months)** | **20 / 19** (1.33 per month) | 99 | **14 / 14** (0.93 per month) | 111 |

The busiest month is 4 storm events: 46224 in Jan 2024 and Feb 2024, during the El Niño winter. The swell column is the existing swell class on the same buoy rows, included for reference only. It is not a criterion here.

## Stored-forecast replay (Oct 30)

The buoy backtest tuned the class on NDBC dominant period (DPD), a peak period. In production the detector reads the stored `enhanced_forecasts` swell partitions (Open-Meteo), and their periods run much shorter. The storm Steven named, Nov 5-6 in San Diego, is 4-6.5 ft at 6-7 s on the stored partitions at San Diego beaches, so the 6.5 s floor rejected it at nearly every beach (ruling R23).

**Shipped `STORM_EVENT_THRESHOLDS`: `minPeriodS` 5, `minPeakFaceHeightFt` 5, `minFaceRiseFt` 3, `minEnergyRatio` 2.5.** Only the period floor changed. WAM early looks keep their own 6.5 s floor (`early-look.ts`), because WAM reports peak period, the same scale as buoy DPD.

### Setup

- **Script:** `scripts/replay-storm-class.ts`. Read-only: it SELECTs `beaches` and `enhanced_forecasts` with the service-role key and writes nothing.
- **Run:** `node --env-file=<path to .env.local> --import tsx scripts/replay-storm-class.ts --now=2026-10-30T16:30:00.000Z`. Inside the Claude Code sandbox, add `NODE_USE_ENV_PROXY=1` so Node's fetch uses the sandbox proxy.
- **What it runs:** what `buildRegionEvents` runs. It calls `detectBeachSwellEvents(..., { stormClass: true, horizonDays: 12 })` for every beach in the region, keeps events where `isSwellEventCurrent`, then groups swells and storms apart with `groupEvents`.
- **Regions:** San Diego (57 beaches), Orange County (37), Los Angeles (28).
- **Snapshot:** forecast rows as stored at 2026-10-30 16:30 UTC. The rows change with every ingest, so a rerun on another day gives other events.
- **Overrides:** `--period`, `--face`, `--rise` and `--ratio` override the thresholds. `--diagnose=YYYY-MM-DD` prints each beach's biggest storm-band partition on that date.

### Results (12-day horizon)

| Region | Beaches (with window) | Swell events | Storm events, 6.5 s floor | Storm events, 5 s floor (shipped) |
| --- | ---: | ---: | ---: | ---: |
| San Diego | 57 (56) | 8 | 1 (4 beaches) | **1 (13 beaches)** |
| Orange County | 37 (35) | 6 | 0 | **1 (1 beach)** |
| Los Angeles | 28 (26) | 1 | 0 | **0** |

- **San Diego storm:** peak Nov 6, W, 7 s, 6.5 ft offshore. It is one regional storm event, so it shows on all 57 San Diego beaches. The region has no per-beach gate.
  - Beaches whose own forecast clears the class: 13 of 56 at the 5 s floor, 4 at 6.5 s. The 13: Blacks Beach, Horseshoe, Marine Street Beach, Ocean Beach Pier, Pacific Beach, Ponto, Seaside Reef, Silver Strand State Beach, Sunset Cliffs North (Garbage), The Rock (Oceanside), Tijuana Sloughs, Torrey Pines State Beach and Windansea.
- **Orange County storm:** peak Nov 6, W, 6 s, 4 ft offshore, at Church only. It is the same storm's edge.
- **Noise:** at most 1 storm event per region in 12 days, well inside the ≤ 4 limit. The 5 s floor is not noisy, so face stays at 5 ft. Raising face to 6 ft would cut San Diego back to 4 beaches.

### Face is now the limit, not period

On Nov 6, 48 of the 56 San Diego beaches with a window are fully open to the 270° storm partition (exposure 1). Their projected faces still run 2.2-6.7 ft, because the face transform scales short-period model swell down. So most open beaches fall under the 5 ft face floor. This sweep keeps the 5 s floor and changes only face:

| Face floor | San Diego beaches with the storm | OC storm events | LA storm events |
| --- | ---: | ---: | ---: |
| 6 ft | 4 | 0 | 0 |
| **5 ft (shipped)** | **13** | **1** | **0** |
| 4.5 ft | 26 | 2 | 1 |
| 4 ft | 35 | 2 | 1 |

A lower face floor reaches most exposed San Diego beaches. It also admits marginal events: in OC, a 10 s, 2.9 ft offshore "storm" on Nov 5; in LA, a 9 s, 4.9 ft one. The ruling kept face at 5 ft, so it stays. Whether to lower it is a controller call.

### Ocean Beach (San Diego) itself

The beach row named "Ocean Beach" has a swell window of 325° ± 40°. That puts the 270° storm 15° past the window edge, at exposure 0.15. Its own detection misses the storm at a 5 ft face floor and catches it at 4.5 ft. It still shows the regional storm, like every San Diego beach. Whether a 325° window is right for Ocean Beach is a beach-data question, separate from the class.

