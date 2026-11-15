# Open-ocean swell naming — backtest (Nov 14, 2026)

## Problem

The region build (`loadRegionForecastEvents`) names each swell from its near-beach lead partition. Near the beach a swell reads from the direction it bends to:

| Point, Sat Nov 14 2026 | Direction | Period | Height |
|---|---|---|---|
| 46219 San Nicolas (open ocean) | 306° | 19 s | 24 ft |
| CDIP points, Imperial Beach to Ocean Beach | W | 22 s | 8 ft |
| CDIP points, Oceanside to Trestles | SW / SSW | 16–17 s | 4 ft |
| Open-Meteo coastal cells (Coronado) | W | 11 s | 7 ft |

So one NW groundswell became three or four San Diego events: SSW 15–17 s, W 18–20 s, W 21–23 s and W 11 s. The story led with "a south-southwest long-period groundswell". Wavecast (Nov 12) forecast NW 300°, 20 s, 13–16 ft faces at west-facing breaks.

## Choice of open-ocean point

GFS-Wave primary swell direction (06:00–14:00 PT mean) against buoy 46219 on the same days, Oct 29 – Nov 14 (17 days). OK is 22.5° or less, OFF is 22.5–45°, WRONG is more than 45°.

| GFS point | OK | OFF | WRONG |
|---|---|---|---|
| San Diego, 0.5° along facing (the GFS tail's point, inside the bight) | 10 | 3 | 4 |
| San Diego, 1.5° | 13 | 3 | 1 |
| San Diego, 2.0° | 14 | 1 | 2 |
| At 46219 | 15 | 1 | 1 |
| Tanner Bank (46047) | 14 | 2 | 1 |
| Orange County / Los Angeles / Ventura, 1.5° | 13 / 13 / 13 | 3 / 2 / 2 | 1 / 2 / 2 |

The 0.5° point reads the NW swells of Nov 9–14 as 266–287° (W). 1.5° and 2.0° score alike, so the nearer 1.5° point is used. The remaining misses are Oct 29 – Nov 2, when a south and a NW swell were in the water together and the buoy's dominant direction changed between them.

## Rule

See `lib/alerts/swell-events/open-ocean.ts` and the story contract. In short:
- GFS-Wave's three swell partitions are tracked over time and split at troughs.
- A swell run takes the open-ocean swell that is in the water at its peak and is close enough in period (8 s), bend (105°) and size (at least 1/1.5 of the run's height). Of several, the closest direction wins.
- Runs on the same open-ocean swell with peaks within 36 h join.
- Storm runs keep their near-beach name.
- A matched event takes its direction, period and `offshoreFt` from the open-ocean swell at its peak. The native Swell Watch chart reads "WNW 13 ft" and the days list reads "offshore at 18 s", so all three must come from one source. Beach exposure keeps the near-beach direction (`exposureDirectionDeg`).

## Before and after

### Live replay, Sat Nov 14 ~21:00 PT (current forecast rows, `loadRegionBase` with real GFS)

| Region | Before | After |
|---|---|---|
| San Diego, Saturday | 3 swell events: W 22 s, W 18 s, W 11 s (all labelled W) | 1 event: WNW 298°, 18.2 s, 39 members |
| Orange County, Saturday | SW 17 s (1 member) + W 12 s (22 members) | 1 event: WNW 299°, 17.8 s, 23 members |
| Orange County / Ventura, Monday | W 11 s 3 ft / W 12 s 7 ft | WNW 296° 16.1 s / WNW 300° 16.2 s |
| San Diego / Orange County, Nov 23 | SSW 13 s | SSW 195°, 16.3 s (kept apart from the NW swell) |
| Storm events | W, 6–10 s | unchanged |
| Kauai | N 0° | N 349° (unchanged label) |

Wavecast (Nov 12) for the same days: NW 300° 20 s Saturday, NW 295° 18 s Monday, SW 200° 16 s around Nov 23.

### Naming backtest on the 46 SoCal story covers, Oct 29 – Nov 14

The forecast rows behind those editions are gone (stored history is about a week), so the full build cannot be replayed. This test replays only the naming step. Each past cover event is matched with the same `matchOpenOceanSwell` to GFS history at the region's 1.5° point. Peak time is set to noon on the stored peak date, and the run height to the stored cover face ÷ 1.6.

| | OK | OFF | WRONG |
|---|---|---|---|
| Before (cover direction as published) | 9 | 23 | 14 |
| After (open-ocean name of the same event) | 31 | 5 | 10 |

8 of the 10 left WRONG are covers that named a real but small south swell (180–200°) while the NW swell was bigger. GFS sees the south swell too, so its name is right. The cover was wrong to lead with it. The story now orders events of one day by offshore height, biggest first (`storyEventsFromRegion`), which this naming-only test cannot replay.

## Limits

- The Nov 14 replay is one day. The 46-cover test checks naming only, with estimated peak hours and heights.
- When the GFS fetch fails, the region falls back to near-beach names for that 3 h cache window.
- The beach detail screen still shows each beach's near-beach partition ("W 18 s"), while the Swell Watch card and the story name the swell (WNW). These are different readings, not one value shown twice.
