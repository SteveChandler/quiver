# Swell Outlook — design

**Date:** 2026-10-04 · **Owner:** Steven · **Repos:** `quiver` (API, detector, cron, DB, map embed), `quiver-native` (screens)
**Status:** design approved in conversation 2026-10-04; this spec awaits Steven's review before an implementation plan is written.
**Mockups:** `dev/workspace-notes/Reports/swell-outlook-2026-10-04/mockup-v4.html` (serve over http; v3 is the static fallback).

## Goal

One place in Quiver that lists every swell heading to the user's beaches and tracks each from first sighting to arrival, with a push at first sighting and on meaningful change. The founder's test: he stops opening an external forecaster's report three times a week. All content comes from Quiver's own forecast data; external forecasters are a benchmark only and are never republished.

## Decisions already made (Steven, 2026-10-04)

1. The outlook is its own screen, entered from Home and Week Scout. Week Scout stays a one-screen 7-day map.
2. Swells are shown early and labelled honestly.
3. Home's "How today changes" becomes "How this week plays out".
4. Maps are the app's real map (the `/embed/map` WebView), not a new renderer.
5. The current forecast feed stays primary. NOAA GFS-Wave extends the range, requested through the same Open-Meteo API.
6. No wind-swell event type. The detector's 11 s minimum stays.
7. The outlook LIST picks up swells the way a human forecaster's report does: one entry per swell train on the way, including modest ones, not only swells that stand out from what is already in the water. Pushes keep the stricter "notable swell" rule.
8. Every swell is judged for the person reading it. Waist-high is a good swell for a beginner or on a longboard and a non-event for an advanced surfer on a shortboard; the list says which, using the user's skill level and boards.
9. Built on the user-facing swell-alert path (`lib/alerts/swell-events/`), not the no-send study (`lib/alerts/swell-watch/`). Study PRs #938, #943, #944 stay parked.

## Verified facts this design rests on (measured 2026-10-04)

| Fact | Evidence |
|---|---|
| Real forecast rows end at ~9.2 days (240 h). The default Open-Meteo model for our beaches is Météo-France MFWAM, which stops there. | Live request, Huntington Beach; `api-client.ts` sets no `models`. |
| Rows from ~9 to ~11.7 days are synthetic (`data_source='FALLBACK'`, seasonal curve + `Math.random`). The detector does not filter them; 11 of 311 events on 10-04 peaked on one. | `fallback-generator.ts`; `forecast-rows.ts` has no `data_source` filter. |
| `models=ncep_gfswave016` on the same API returns real primary/secondary/tertiary swell to 384 h (~15.3 days). ECMWF on Open-Meteo has no swell partitions. | Live requests. |
| GFS-Wave carries south swell as often as the current feed but reads its height ~0.67× (0.52 Malibu – 0.85 Pipeline) and its period ~1.8 s longer. At days 9–10 the ratio is ~0.79. | 92 days, 8 CA/HI points, ~8–10 independent swells. |
| The stored swell period is Open-Meteo's mean `swell_wave_period` (the peak-period variable is null for every model with partitions), rounded to whole seconds. | `data-processors.ts:310`; live request. |
| Lowering the minimum period to 10 s adds 3 distinct swells in 92 days at 8 points, loses 3 buoy-confirmed ones, and the added ones are confirmed no more often than a random summer day. | Real detector replay. |
| Against a human forecaster's SoCal report for 10/4–10/12 (6 named swells), today's detector lists 1. The misses are: overlapping swell trains merged into one event (the rise-over-baseline rule), the 3 ft / 11 s floor (a tropical south swell at 9–10 s model period failed at 104 of 106 exposed beaches), and the 9-day horizon (he first mentions a swell a median ~11 days out). | Archived reports 7/2–10/1 (38), prod snapshots, real detector with mutated parameters. |
| A "pulse" rule (below) on the same data lists 8 regional swells and recovers 6 of 6, with 2 extras (both the fading current swell). Over 27 past 9-day windows it lists a mean of 2.8 swells (p90 4, max 5) against 1.5 for today's rule. | Same replay; one season, thin sample. |
| With today's notable-swell rule a beach rarely has many swells: CA median 0, max 3 concurrent; ~62% of CA beach-days have none. A region typically has 1–2 distinct swells. | `swell_event_forecast_snapshots`, 8 runs. |
| Model swell height does not drift low with lead (CA median within ~0.1 ft at 4–7 days; vs buoys 0.98–0.99 at 6–7 days). Face-height bias by lead is unmeasured. | Swell Watch provider archive, `ml_predictions_log`, Open-Meteo previous runs. |
| Events first seen 5–7 days out vanished 56% of the time (10 of 18, ~6–8 independent swells); in all 10 a same-direction swell remained just under the 3 ft / 11 s bar. | Real detector on the provider archive. |
| Daily snapshots exist since 2026-09-27 with no gaps; `/api/swell/<key>` returns per-run history; an event key survives peak shifts of several days. Most events still have only 1–2 runs. | Prod. |
| The map field is built from per-beach points (effectively one offshore value per area, within ~111 km of the 20 nearest beaches). No gridded wave data is ingested anywhere. Particle size saturates at 4.74 ft; colour is fixed. | `components/map/swell-field/*`; live bulk call. |
| Native can host the embed on the swell screen with no new module; the embed accepts `setForecastTime` and `setForecastPlaying` from the native WebView. It has no "highlight one swell" command. | `embed-map-bridge.ts`, `shared-map-webview.tsx`. |

Not established: whether `WEEK_SCOUT_SWELLS_ENABLED` is on in prod (both variables exist, values encrypted); the false-alarm rate beyond 5 days on the production feed (re-measure from snapshots after ~2026-10-10).

## Phase 0 — foundations (ship with or before Phase 1)

- **F1. No synthetic rows in detection.** The detector's row loader excludes `data_source='FALLBACK'`; an event can neither be created from, nor have its arrival/peak/fade placed on, a synthetic row. (Raised separately as its own task.)
- **F2. Live-detector scorecard.** A nightly read-only check scoring `swell_event_forecast_snapshots` against buoys by lead (hit / mistimed / miss), modelled on `workspace-notes/scripts/swell-watch-accuracy.sql`. It reports per lead bucket and feeds the copy in "Honest labels".
- **F3. Face height per issuance.** Record the displayed face height for each beach and valid time per forecast issue, so face-height bias by lead becomes measurable against `sessions.wave_height_ft` in 4–6 weeks. Check `ml_predictions_log.display_raw_input_height_m` first; add a column only if it is not already populated.
- **F4. Snapshot outcome fields.** Snapshots gain the lead (days from run to peak) and, once the peak has passed, whether the event was still present on the last run before it. This makes false-alarm rates a query.

## Phase 1 — outlook on current data (0–9 days)

### Backend

**Endpoint.** `GET /api/swell/outlook` (signed-in). Flag-gated and allowlisted with the existing swell-alert pattern (`lib/flags/`), allowlist defaulting to nobody.

Response:

```ts
interface SwellOutlookResponse {
  generatedAt: string;          // ISO
  runDate: string;              // snapshot run the list is built from
  horizonDays: number;          // 9 in Phase 1
  homeBeach: { id: string; name: string } | null;
  swells: OutlookSwell[];       // sorted by peak time
}

interface OutlookSwell {
  id: string;                   // stable group id (see Grouping)
  eventKey: string;             // the representative beach event, opens the detail page
  tier: 'locked' | 'likely' | 'on_the_radar' | 'early_signal';   // early_signal only from Phase 2
  status: 'forecast' | 'shrinking' | 'arrived' | 'faded';
  change: 'new' | 'upgraded' | 'downgraded' | 'earlier' | 'later' | 'steady';
  arrivalAt: string | null;
  peakAt: string;
  peakWindow: { from: string; to: string } | null;  // set when timing is a window, not a point
  faceHeightFt: { min: number; max: number };       // at `beach`
  periodS: number | null;       // null for early_signal
  directionDeg: number;
  directionLabel: string;       // 'S', 'SSW', 'NW' …
  beach: { id: string; name: string };   // the user's beach it is sized for
  beachCount: number;           // how many of the user's beaches see it
  notable: boolean;             // true when it matches a notable-swell event
  fit: {
    status: 'in_range' | 'rideable' | 'below_range' | 'above_range' | 'unknown';
    boards: BoardClass[];       // the user's board classes whose IDEAL band contains this size; empty unless in_range
  };
  source: 'southern_hemisphere' | 'tropical' | 'north_pacific' | 'local' | 'unknown';
  stormName: string | null;     // active named tropical system, when one matches
  sizeByOrientation: {          // face height range, ft; null when no pool beach faces that way
    southFacing: { min: number; max: number } | null;
    westFacing: { min: number; max: number } | null;
  };
  history: Array<{ runDate: string; peakAt: string; faceHeightFt: number; periodS: number | null }>;
}
```

**Source label.** Derived from direction, period and season: 180–230° at ≥ 14 s is `southern_hemisphere`; 150–190° during the East Pacific hurricane season with an active system is `tropical`; 280–320° at ≥ 13 s is `north_pacific`; under 11 s is `local`; anything else `unknown`. `stormName` comes from the National Hurricane Center's public active-storms feed (`CurrentStorms.json`) when a system lies on the swell's bearing; West Pacific names are out of scope until a source is verified.

**Size by orientation.** Computed from the pool beaches' own swell windows (`swell_window_center_deg` / `halfwidth_deg`), split into south-facing and west-facing groups.

**Fit for the user.** Reuse the existing rideability bands: `getRideabilityBand(skill, boardClass)` and `weekScoutRideableBands` / `sizeFitFor` in `week-scout-swells.ts`. For each swell, the face height at the user's beach is compared with the band for the user's skill level and each board class they own.
- Each band has an `ideal` and a wider `acceptable` range. Week Scout's `rideable` flag uses `acceptable`; that is too loose here (an advanced surfer's acceptable shortboard band starts at 2.3 ft, so waist-high would count). The outlook uses both:
  - `in_range`: inside the IDEAL band of at least one of the user's boards. The row reads as a swell for them and names the board when not every board fits ("longboard size").
  - `rideable`: outside every ideal band but inside an acceptable one. Shown normally, no label, no push.
  - `below_range`: under every acceptable band. Shown, dimmed (Steven, 2026-10-04: dimmed, not hidden), labelled small for them.
  - `above_range`: over every acceptable band. Shown, labelled above their range. Never dimmed or hidden; it is safety-relevant.
- Worked example, advanced surfer, 2.5 ft swell: shortboard ideal is 3.5–8.4 ft, longboard ideal 1.5–5.6 ft. With only a shortboard it is `rideable`; with a longboard it is `in_range` on the longboard.
- Worked example, Steven's profile (intermediate; shortboard, fish, longboard): ideal bands 2.3–5.3, 1.7–4.8 and 1.0–3.5 ft, so `in_range` is 1.0–5.3 ft, with 1.0–1.7 ft longboard only.
- No boards recorded: the skill level's default band. No skill level: `unknown`, sizes shown without a fit label.
- All three overlapping swells in a run always appear as separate entries; fit changes emphasis and wording, never whether a swell is listed.
- List order stays chronological. The Home graphic draws out-of-range swells at lower contrast.

**Whose beaches.** The same pool the alert runner uses (`lib/alerts/user-pool.ts`: home, favourites, custom spots, nearby within drive range). Sizes are quoted for the home beach when it sees the swell, otherwise for the pool beach with the largest face height.

**Listing rule (pulses).** The outlook list does not use the notable-swell detector's events. It uses a second, more inclusive rule over the same forecast rows:
- Track each swell component through time by direction and period (the detector's existing tracking, `buildTracks` / `componentDays`, exported for reuse).
- A pulse is a local maximum in a tracked component's daily energy whose prominence is at least 25% of its peak energy. Two swell trains that overlap without the surf going flat are two pulses.
- Skip pulses whose peak is today or already past.
- Floor: face ≥ 1.5 ft and model period ≥ 9 s at the beach, and at least 3 beaches in the region agreeing.
- The rule lives in its own module (`lib/alerts/swell-events/outlook.ts`) with its own thresholds object and its own snapshot `detector_version`. It never touches `SWELL_EVENT_THRESHOLDS`, event keys, rarity or the push callers.
- Expected volume: about 3 swells per 9 days in Southern California (max 5 in the replay).

Pushes, follow-ups, Week Scout and the share page keep using the existing notable-swell events. An outlook entry links to a notable event when one matches it (direction within 45°, peak within 36 h); otherwise its detail page is built from the pulse's own snapshots.

**Grouping.** One physical swell seen at many beaches is one entry. Reuse Week Scout's grouping (`groupEvents`: peaks within 36 h, period within 3 s, direction within 45°), without the `maxSwells: 3` cap. `id` is derived from the earliest event key in the group so it is stable across runs.

**Tiers and change labels.** Reuse `confidenceFor` and the change derivation in `lib/services/discovery/week-scout-swells.ts` unchanged. Extract them to a shared module if importing from the Week Scout builder would create a cycle; do not fork the logic.

**Sticky tracking.** Once a swell has been listed for a user's pool, it keeps being followed after it drops below the detection bar:
- On each run, for every group present in the previous run and absent today, look in today's forecast rows for a partition at the representative beach within 45° and 36 h of the last predicted peak.
- If one exists with face ≥ 2 ft, the swell stays listed with `status: 'shrinking'`, its current size, and `change: 'downgraded'`.
- If none exists, it is listed once with `status: 'faded'` and then removed.
- Sticky entries never trigger a first-sighting push and never raise tier.
This applies to the outlook list only; detection thresholds, snapshots and event identity are unchanged.

**History.** From `swell_event_forecast_snapshots` for the representative event key, as `/api/swell/[eventKey]` already does (`lib/share/swell-share.ts`).

**Empty result.** `swells: []` is the common case and is a valid, cacheable response.

### Native screens

**Home — "How this week plays out".** Replaces the "How today changes" section. A 7-day graphic: a height axis, each swell as its own band coloured by direction family (south / northwest), a marker at each peak with size and period, band solidity by tier (solid = locked, dashed = on the radar). A footer row ("2 swells on the way · Swell Outlook ›") opens the outlook. With no swells it shows the flat week and one line saying nothing notable is forecast.

**Swell Outlook (new root-stack screen).**
- Header: beach, horizon, when it was last updated.
- Strip graphic: the Home graphic at the outlook's full horizon.
- List grouped by tier. Row = peak day, size range, tier chip, one change note, direction glyph, history sparkline. No repeated sentences; one glyph key at the top.
- Starts from the removed list section as reference (`git show 3ada9f9a^:src/features/week-scout-swells/week-scout-swells-section.tsx`), restyled to current tokens.
- Empty state is a designed state, not an error: what the next 9 days look like in one line, when the list was last checked, and a link to the 7-day Week Scout.

**Week Scout.** Unchanged except one entry row to the outlook.

**Swell detail (existing `SwellLanding`).**
- Hero: the real map via `SharedMapWebView`/`DetailMap`, centred on the beach, `layer` set to the swell's partition, with a day scrubber that sends `setForecastTime` (smooth) and a play control using `setForecastPlaying`. One map on screen at a time.
- "How the forecast moved": forecast run date on the x-axis; a stepped size track with the value written at each run; a peak-day chip per run, highlighted on the run where it changed. One caption line. With a single run it shows that run and says tracking has just started.
- Tier track, share action and the existing card stay; the text table of runs is removed.

### Honest labels

- Tier names stay as shipped (`locked`, `likely`, `on the radar`). "On the radar" carries a plain line that swells this far out often change or fade. A number is added only once F2/F4 produce one for the production feed.
- Hedging follows lead, as a forecaster's wording does: firm inside 3 days, "so far" from about 5 days, "needs watching" beyond 7.
- Sizes are ranges. Beyond 5 days the peak is shown as a window (`peakWindow`), not a point.
- No copy claims AI or machine-learning forecasting.

### Pushes

- **First sighting.** One push per user per swell the first time it is listed with `fit.status === 'in_range'` (Steven, 2026-10-04: any in-range swell pushes; no extra notability test). A waist-high swell therefore pushes a beginner or a longboarder and does not push an advanced shortboarder. A swell that enters the user's range on a later run pushes then. Expected volume at about 3 listed swells per 9 days is up to roughly 10 a month for a user whose range covers most of them; this is above the earlier "a few per month" guardrail and is a number to watch in the trial. Sent at any lead inside the horizon, within the existing local send hours.
- **Follow-ups.** The existing follow-up kinds (moved, bigger, smaller, dropped, arrived) and their limits (`lib/alerts/swell-followup/`), unchanged.
- **Limits.** At most one first-sighting push per user per 72 h; free users for the home beach only, as today.
- **Destination.** Pushes open the swell detail; its back action goes to the outlook.
- All sends stay behind `SWELL_ALERT_ENABLED` / `SWELL_FOLLOWUP_ENABLED` and the allowlist. The current evening-before alert is replaced by the first-sighting push for allowlisted users only; everyone else keeps today's behaviour until rollout.

## Phase 2 — long range (days 9–15)

**Data.** A second Open-Meteo marine request per beach with `models=ncep_gfswave016`, `forecast_days=16`, primary, secondary and tertiary swell height/period/direction (the third partition carries long-period forerunners the production feed never shows). Stored in a new table (`long_range_swell_forecasts`: beach, valid time, issue time, the six swell fields, model). `enhanced_forecasts` and every forecast page are untouched; the two models are never merged into one row series.

**Detection.** The pulse rule runs on the GFS-Wave series for lead 9–15 days with model-specific parameters (in a 4-point trial it recovered 4 of a forecaster's 7 swells at 15 days with no extras; northwest swells are the weak spot):
- height multiplied by a per-region factor before thresholds (start at 1.3; calibrate from the 92-day comparison; stored as config, not hard-coded per beach);
- period minimum 11 s (GFS reads ~1.8 s longer than the production feed, so 11 s ≈ the list rule's 9 s);
- its own snapshot rows, marked by a distinct detector version so the two histories never mix.

**Presentation.** A fourth tier, `early_signal`: a 2–3 day `peakWindow`, a wide size range (scaled height ± 1 ft, minimum width 2 ft), direction label only, `periodS: null`. Copy states that it is an early signal and likely to change. No pushes from this tier.

**Handover.** When a production-feed event appears inside 9 days with direction within 45° and peak within 48 h of an early signal's window, the early signal's `id` and first-seen date carry over to it and the early signal disappears. Matching is on direction and timing only; size is never carried across.

**Horizon.** `horizonDays` becomes 15. Week Scout stays at 7.

## Phase 3 — map

On data we already have:
- particle strength no longer saturates at 4.74 ft (a mapping that still distinguishes 5 ft from 8 ft);
- a height colour layer under the particles, reusing `buildLegendRampCss`;
- a bridge command to highlight one swell (by partition and direction band) and to stop forcing the whole field to the selected beach's direction in that mode;
- a query parameter to hide the embed's own chips and forecast bar outside the native WebView.

A field that shows a swell crossing open ocean needs gridded NOAA GFS-Wave files (West Coast 0.16° grid for California; East Pacific 0.16° for Hawaii; both to 384 h, public domain). That is a separate project and is not part of this spec.

## Measurement

- **Founder test:** he no longer opens the external report.
- **Product:** outlook opens per weekly active user; first-sighting push open rate; follow-up push open rate; downgrade/drop rate after a first-sighting push.
- **Accuracy:** hit / mistimed / miss by lead from F2; vanish rate by first-seen lead from F4; face-height bias by lead from F3.
- Outcomes stay `shipped_unvalidated` until these move at their measurement points.

## Rollout

1. Phase 0 and Phase 1 backend to `main` behind flags; allowlist = Steven.
2. Native screens behind the same allowlist response (no data, no entry points).
3. Steven's device trial; push tap verified on a real phone.
4. Widen the allowlist; then default on.
5. Phase 2 after Phase 1 is in Steven's hands, or in parallel if he asks for it.

Production promotion, migrations, OTA publishes and flag changes each need Steven's approval at the time.

## Out of scope

- Storm-derived attributes that need fetch and distance data (waves per set, lulls, forerunner timing).
- Wind-swell / short-period events as a separate type, any change to the notable-swell detector's thresholds, and East Coast short-period surf (the face-height transform drops periods ≤ 8 s).
- A written regional report.
- Ensemble-based confidence (GEFS-Wave).
- The gridded offshore field.
- Any change to the no-send Swell Watch study.

## Risks

- **Thin history.** Until snapshots accumulate, most history charts show one or two runs. The single-run state is designed for.
- **Early signals fade.** Mitigated by sticky tracking, window-and-range presentation, and no pushes from the far tier.
- **GFS scaling is calibrated on ~8–10 swells in one season.** Revisit the factor after a winter month; keep it in config.
- **Mean period.** The production period under-reads buoy peak period by ~4 s; period shown to users is the model's, and the detail page should not present it as a buoy-equivalent value.
- **List floor vs noise.** The 1.5 ft / 9 s floor was tuned on one week and checked on 27 past windows in one season; northwest swells only qualify at that floor. Re-check in winter.
- **Under-read of tropical swell.** The model reads hurricane swell well below a forecaster's sizes; the list will show these smaller than they arrive until face-height bias (F3) is measured.
- **Malibu.** GFS-Wave produced no detectable south swell there in 92 days against two on the production feed; early signals will under-serve it.
