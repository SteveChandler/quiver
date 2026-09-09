# One window authority per beach and day (2026-09-09)

## Problem

Five engines pick a "best window" and three rulers draw it, so Home's Best tab, Explore's
outlook, Beach Detail, the public beach page and the Weekend Scout push can print different
windows for the same beach and day.

Live evidence, San Diego Ocean Beach (`15c7337e-5258-4339-9dc3-c435c666926b`), captured
2026-09-09 ~15:03 PT on dev.quiversurf.app with the maestro-regression account
(raw JSON: `.planning/evidence/2026-09-09-window-authority/`):

| Engine | Same-day window | Note |
|---|---|---|
| `/api/surf/discover` (best-window) | Wed 5:00–7:05 PM, peak 5:00 PM | no `displayWindowStart/End` on `window` |
| `/api/surf/week-scout` today evening | Wed 5:00–7:05 PM, peak 5:00 PM | agrees only because the evening bucket has no cap |
| `/api/surf/week-scout` Thu midday | Thu 11:00 AM–**2:00 PM** | end is the bucket edge (`capWindowEnd`), not the selector's end |
| `/api/surf/week-scout` Fri evening | Fri 5:05–7:02 PM, peak **Wed 3:03 PM** | peak outside the window: `findPeakWithinWindow` returns `now` for a future window with no interior grid point |

Every midday window in the 7-day response ends at exactly 2:00 PM. That is the mechanism
behind the user-reported "surf call 3:30–6:00 PM vs Week Scout 12:45–3:15 PM" mismatch:
the bucket-capped pick (peak pinned at the 2:00 PM edge, native draws a 150-minute band
around it → 12:45–3:15 PM) was the misleading one.

## Rule

One selector run per beach and local day, in the beach timezone, with the user's profile:

- `bestDayWindow` = the top ranked window from that run.
- `dayparts.{morning,midday,evening}` = the highest-ranked window from the **same run** whose
  peak falls in that daypart (beach-local hour <10, 10–14, ≥14). Never re-run the selector on a
  bucket slice and never cap a window at a bucket edge.
- Display bounds = one ruler (`deriveDisplayWindow`: 150-minute band around the peak, clamped
  to 06:00–19:00 daylight, pulled inside the raw window) attached server-side as
  `displayWindowStart/End`; every client prefers those fields and only synthesizes when absent.
- A peak must lie inside its window; a future window with no interior grid point uses the
  window midpoint, never `now`.

Module: `lib/services/discovery/window-authority.ts`.

## Contract changes (all additive)

- `PersonalizedForecastWindow`: `displayWindowStart?`, `displayWindowEnd?` (serialized ISO) on
  `/api/surf/discover` `recommendations[].window` and `includedRecommendations[].window`.
- `/api/surf/call`: `forecastContext.displayWindowStart/End` now read the window's bounds
  (same ruler, same values).
- `/api/surf/week-scout`: `days[].windows[].displayWindowStart/End`; `days[].bestDayWindow`
  (the `bestWindowId` window object after hold sanitisation and compaction, or `null`);
  windows derived from the single run; `scorerVersion` → `week-scout-v2:day-window-authority-v1`.
- Weekend Scout ranking v1: `results[].bestWindow.displayWindowStart/End` (optional).
- Daily intel `bestWindow` string comes from the selector, not `bestWindowHeuristic`.

Native prefers the new fields in `buildDiscoveryForecastContext`, the Week Scout adapter and
the Explore → Beach Detail CTA bounds; `buildLookingAhead` no longer names a best window.

## Packets

- A (web): authority module + discovery/surf-call wiring + peak-finder fix.
- B (web): Week Scout + Weekend Scout on the authority, beach timezone bucketing.
- C (web): daily intel on the selector; retire `bestWindowHeuristic`.
- N (native): consume the fields; retire the client "looks best" claim; beach-timezone "today".

## Done

For any beach and day, Home Best, Explore outlook, Beach Detail, the public beach page and the
Weekend Scout push print the same best window with the same bounds, and server tests pin the
rule. `yarn typecheck` / `yarn test:unit` (web) and `npm run typecheck` / `npm test` (native) pass.
