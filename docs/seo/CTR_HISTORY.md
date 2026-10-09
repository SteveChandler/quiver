# SEO CTR History

This log records CTR work that needs continuity across weekly reports, dashboard proposals, and runtime SEO surfaces.

## Sources Reviewed

- `Brand-Vault/seo-audit/2026-05-25/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-08/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-15/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-20/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-28/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-28/GSC-EXPORT.json`
- `Brand-Vault/seo-audit/2026-06-28/GSC-REFRESH.json`
- `docs/seo/seo-dashboard.json`

## 2026-06-29 Batch

Baseline window from the 2026-06-28 report: 2026-05-29 through 2026-06-25.

| Page | 28d clicks | 28d impressions | CTR | Avg position | Prior work reviewed | Runtime action |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `/best-time-to-surf/la-jolla` | 2 | 5,857 | 0.03% | 9.2 | Flagged repeatedly from 2026-05-25 through 2026-06-28; Phase 18 live handoff existed but copy stayed generic. | Added scoped metadata, answer copy, and a first-step handoff to `/surf-report/scripps-pier-today`. |
| `/best-time-to-surf/newport-beach` | 6 | 3,033 | 0.20% | 10.0 | 2026-06-15 and 2026-06-20 reports flagged weak CTR. Dashboard accepted `newport beach surf report` by assigning `/surf-report/newport-beach-today`, but runtime code did not include that page. | Added `/surf-report/newport-beach-today` and changed the best-time page to hand today's surf-report intent to that owner. |
| `/best-time-to-surf/malibu` | 1 | 1,252 | 0.08% | 8.3 | 2026-06-15, 2026-06-20, and 2026-06-28 reports flagged weak CTR. `/surf-report/malibu-today` already existed as the live owner. | Added scoped metadata, answer copy, and a first-step handoff to `/surf-report/malibu-today`. |

## Reconciliation Rule

Do not treat a dashboard proposal as covered until all four checks pass:

1. Runtime route exists in `lib/seo/funnel-pages.ts` or the relevant app route.
2. Unit tests name the route, title, metadata, and internal-link behavior.
3. Existing E2E coverage includes the route when it is part of a public SEO surface family.
4. The weekly report records the before/after GSC baseline and the intended rerun window.

For this batch, rerun against the same baseline at end of week and compare CTR and query ownership for La Jolla, Newport Beach, and Malibu before making broader template changes.

## Monitoring Cohort

The weekly GSC refresh reads `docs/seo/ctr-watchlist.json` and renders this cohort under `CTR Cohort Monitoring` as monitor-only evidence. It must not trigger another metadata or copy rewrite before the first fully post-change 28-day window ends on 2026-07-26. The hold is evaluated against the export's `dateRanges.last28d.end`, not the report generation timestamp, so GSC's three-day reporting lag cannot release a page early.

- `/best-time-to-surf/la-jolla`
- `/best-time-to-surf/newport-beach`
- `/best-time-to-surf/malibu`
- `/surf-report/newport-beach-today` (9 impressions in the latest mixed window)
- `/surf-report/malibu-today` (4 impressions in the latest mixed window)

## 2026-08-23 La Jolla Checkpoint

The mixed 28-day window initially obscured the result of the 2026-08-05
decision-first snippet change. An isolated 15-day comparison shows the
post-change window (2026-08-06 through 2026-08-20) at 4 clicks, 17,068
impressions, 0.0234% CTR, and average position 7.87. The equal-length
pre-change window (2026-07-22 through 2026-08-05) produced 5 clicks, 8,224
impressions, 0.0608% CTR, and average position 8.23.

CTR fell 61.5% even as average position improved. GSC query rows are dominated
by `la jolla surf report today`, `la jolla shores surf report today`, and close
variants, so the generic `surf window` title did not match the visible demand.
The next scoped test uses `La Jolla Surf Report Today: Tide, Wind & Swell` while
preserving the seasonal H1 and content contract. Measure the first complete
post-deployment 15-day window against this 0.0234% baseline before another edit.

## 2026-09-02 `/learn` Batch

Source: the 2026-09-02 AEO citation audit's capture points, reconciled live
against GSC (page totals match `Brand-Vault/seo-audit/2026-08-31/GSC-EXPORT.json`
exactly; the page×query view is much smaller because Google anonymizes long-tail
queries, not because the totals are wrong). Baseline window: 2026-08-01 through
2026-08-28. Daily series for the two high-volume pages is flat (~20 and ~11
impressions/day across 45 days), so these are steady demand, not a spike.

The 2026-05-31 click-oriented pass rewrote three of these pages and had a full
three-month window; they stayed at 0–0.34% CTR. This batch is the second attempt
on those, and it changes the approach: match the phrasing GSC actually shows
rather than the phrasing we chose.

| Page | 28d imp | 28d clicks | CTR | Pos | What changed | Why |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `/learn/is-it-safe-to-surf-after-rain` | 592 | 2 | 0.34% | 9.7 | Title now covers "in the rain" and "after it rains"; description ≤155; new `surfing-while-raining` section. | 16-month named queries: "in the rain" 114 imp vs "after rain" 49 imp. Page had no during-rain content, so the title could not honestly cover the larger phrasing without it. Google was already rewriting our title to "After It Rains". |
| `/learn/how-are-waves-measured` | 311 | 0 | 0.00% | 7.5 | Title leads with "How Big Is 3 ft Surf?"; description cut from 306 to 150 chars. | Description was truncated mid-sentence in every SERP. Only 1.3% of impressions come from named queries; the named ones are all Hawaiian-scale-vs-face-height. |
| `/learn/how-are-ocean-waves-formed` | 625 | 0 | 0.00% | 41.0 | Title leads with "What Causes Ocean Waves?"; description cut from 366 to 154 chars. | Named queries are "what causes/creates waves in the ocean" (~120 imp) over "how are waves formed" (~48). **Position 41 is a ranking problem; the title alone will not move it to page one.** Measure position, not CTR. |
| `/learn/best-time-of-day-to-surf` | 97 | 0 | 0.00% | 10.0 | "Dawn Patrol vs Glass-Off" → "Why Morning Usually Wins". | Second attempt. Zero named queries; SERP winners answer in the title in plain language, ours used jargon. |
| `/learn/groundswell-vs-wind-swell` | 30 | 0 | 0.00% | 9.4 | Query wording first ("Wind Swell vs Groundswell"), period hook. | Second attempt. Only named query is `wind swell vs ground swell` at 15.8. |
| `/learn/beginner-breaks-santa-cruz` | 26 | 1 | 3.85% | 8.5 | Names the spots in the title; description cut from 303 to 151 chars. | Impressions jumped to 113 in the window ending 08-30. Named queries already matched the old title, so the change is the truncated description and the spot names. |
| `/learn/how-long-to-learn-to-surf` | 16 | 0 | 0.00% | 9.8 | "By Milestone" hook; description cut from 283 to 148 chars. | Old description gave the entire timeline in the snippet — nothing left to click for. |

Left alone, deliberately:

- `/learn/how-does-water-temperature-affect-surfing` — 40 imp, 1 click, 6.8 (58/1 in the newer window). 1.7–2.5% is normal for that position; rewriting a working page with no evidence of a problem is how the La Jolla test lost 61.5%.
- `/learn/how-quiver-calibrates-your-beach` — 6 impressions; nothing to measure. Its `machine learning surf forecast` keyword was removed because Quiver ships no live ML forecast.

### Measurement

- Measurable: `is-it-safe-to-surf-after-rain` (CTR), `how-are-waves-measured` (CTR), `how-are-ocean-waves-formed` (position). The other four are under 100 impressions/28d and cannot show a significant move; do not read a change on them as a result.
- Hold: first complete 28-day GSC window after the deploy, evaluated against `dateRanges.last28d.end`. Watchlist entries set `monitorUntil` 2026-10-10; extend it if the deploy lands after 2026-09-08.
- Compare against the 08-01→08-28 baselines above, not against the export current at the time of reading.
- A CTR gain on `is-it-safe` with a position loss on the old "after rain" queries is a mixed result, not a win; check query ownership, not just the page total.

## 2026-09-09 Water-temp, La Jolla, and Cam Corrections

Source: `docs/seo/reports/aeo-citation-tracking/2026-09-09.md`, plus a
read-only SERP inspection on 2026-09-09. The 2026-09-02 water-temp benchmark
was not a reusable entity-matching effect.

| Group | Pages | Impressions | Clicks | CTR | Avg position |
| --- | ---: | ---: | ---: | ---: | ---: |
| Page names the same place the query names | 22 | 17,898 | 275 | 1.54% | 6.5 |
| Page names a different beach than the query | 112 | 25,076 | 186 | 0.74% | 7.9 |
| Entity-matched, excluding Kill Devil Hills | 21 | 15,372 | 90 | 0.59% | — |

The page-level gap is 2.1x, not 8.1x. Removing Kill Devil Hills reverses the
result: entity-matched pages convert worse than mismatched pages. The 12.78%
benchmark was Kill Devil Hills alone, so the 2026-09-02 action to add
entity-matched titles on Santa Monica, Santa Cruz, Encinitas, Ogunquit, and
Ocean City NJ is **withdrawn**. Do not spend a title rewrite on this mechanism.

### Kill Devil Hills investigation

Among water-temp pages at position ≤ 6.0 with ≥ 300 impressions:

| Page | Impressions | Clicks | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `/nc/kill-devil-hills/…/water-temp` | 2,526 | 185 | 7.32% | 4.8 |
| `/water-temp/sea-isle-city` | 2,727 | 63 | 2.31% | 4.7 |
| `/ny/shirley/smith-point-county-park…/water-temp` | 529 | 9 | 1.70% | 4.8 |
| `/water-temp/santa-cruz` | 6,395 | 80 | 1.25% | 5.0 |
| `/me/ogunquit/ogunquit-beach-ogunquit-me/water-temp` | 4,264 | 39 | 0.91% | 5.5 |

The read-only SERP check found no obvious naming mechanism to transfer:
Kill Devil Hills and Ogunquit both return beach-level water-temperature
results with the city and state in the rendered page, while Sea Isle City also
has a city-level water-temperature result covering its two beach pages. The
next useful investigation is query-level GSC comparison and SERP intent, not a
bulk title edit.

### La Jolla report owner

`/surf-report/la-jolla-today` already exists in `lib/seo/funnel-pages.ts` as
the indexable owner for the `la jolla surf report today` demand. Keep this as a
one-page test: size expectations against `/surf-report/malibu-today` at 0.34%
(630 impressions across the comparison family), not a broader family norm.
The 2026-08-05 La Jolla title test lost 61.5% CTR. Measure the first complete
28-day post-deployment window and do not scale to Santa Cruz, Cocoa Beach, or
Pacifica before that read.

**2026-09-16 URL Inspection (read-only):** the owner route is
`Discovered - currently not indexed` with no last-crawl time, and the only
discovery source Google reports is the sitemap. The live page returns 200 with
`index, follow` and a self-canonical, and `/best-time-to-surf/la-jolla` links
to it with two server-rendered anchors. Google crawled that page on
2026-09-16 but has not followed the links. GSC has no performance row for the
owner route for 2026-08-19 to 2026-09-15. The best-time page had 7 clicks on
32,457 impressions (0.02%, position 7.3) in the same window. Both pages use a
"La Jolla Surf Report Today" title, so Google may be treating the new route as
a duplicate of the indexed page and deprioritizing its crawl. That is a
hypothesis, not a confirmed cause. The owner route is now in
`gsc-indexing-watchlist.json`. Its measurement window has not started because
Google has not indexed it. Leave both titles unchanged, and do not scale the
pattern until the route is indexed and has one complete window.

### Cam route consolidation

Regional cam pages now use `/surf-cams/*` as the canonical family. `/cams/*`
is a permanent legacy redirect to the matching `/surf-cams/*` route; `/cams`
remains the hub. This is route consolidation only and adds no regional content.

## 2026-09-27 Tide Sub-page Next High/Low Fix

Not a CTR test. This is a data-correctness fix on the `/{state}/{city}/{beach}/tides`
family and the legacy `/beach/{slug}/tides` pages. Log it here so the next
tide-page change respects the stability window.

**Bug.** `findNextTideExtremes` (`lib/seo/tide-meta-data.ts`) took the first
row of the next-24h series as the next high if the tide was falling, or the
next low if it was rising. It then stopped looking for a real turn of that
kind. On 2026-09-27 Tourmaline showed "next high 3:00 PM, next low 4:00 PM"
and Seaside Park NJ showed high 6 PM, low 7 PM.

**Fix.**

- Only interior turning points count: a reading strictly higher or lower than
  the readings on both sides.
- Equal consecutive readings at slack count as one turn, timed at the first of
  them. Production heights are rounded to the millimetre, so a turn often
  reads the same two hours running.
- The window starts one reading before now. That reading is only a neighbour,
  so a turn in the first hour ahead can still be found.
- The window still ends 24 hours ahead, because the times are shown without a
  date. The sitemap and the sub-page read this window from one helper,
  `tideExtremesWindow`.

**What changes on the page:**

- `TideDatasetSchema` JSON-LD (`variableMeasured` values and "Next high/low
  tide at …" descriptions).
- The visible tide summary hero.
- The install-CTA proof chip.
- The hero's Rising/Falling badge. Correct pairs often straddle midnight
  (high 11 PM, low 5 AM), and the badge compared clock times, so it read
  "Falling" on a rising tide. It now compares the dated `nextHighAt` /
  `nextLowAt` fields added to `TideMetaData`. Visible text only; ship it in the
  same deploy as this fix.

**What does not change:**

- Titles and meta descriptions: `buildDynamicTideMetadata` does not read tide
  times.
- URLs and canonicals.
- The coverage rule (a beach is covered when a high or low is found). Sitemap
  membership and `index` still use that one rule.

**Measured against production (read-only, 2026-09-27).** 447 beaches, hourly
rows, replayed from every hour of the next 7 days (75,096 beach-hours).

| | Old rule | New rule |
| --- | ---: | ---: |
| Beach-hours with no high or low (not covered) | 8 (2 beaches) | 0 |
| High and low reported within 1 hour of each other | 11,457 | 462 |
| Beach-hours whose next high or low changes | — | 84.8% |
| Reported extremes more than 24h ahead | 0 | 0 |

A strictly literal neighbour test without plateau handling would have dropped
110 beach-hours (19 beaches) of coverage at 24h. Widening the window would have
hidden that by reporting the following turn instead of the real one. At 26h,
507 reported times would fall more than 24h ahead with no date shown. So the
window stays at 24h.

**Mixed sources, fixed in the same deploy.**

- 88 of the 462 remaining 1-hour pairs were Shipwrecks, Coronado CA. After
  its coordinates changed, its nearest station changed from
  `noaa_hilo_interpolated` TWC0405 to `noaa` 9410170. Rows from both
  sources overlap at the same timestamps until the old ones expire.
- Both readers (`getTideMetaData` and the sitemap coverage check) now pass
  each beach's rows through `selectTideSeries`. It keeps the latest-ingested
  station and one row per hour, applied the same way in both places.
- Replayed on 2026-09-29, the new rule plus source selection leaves 0
  uncovered beach-hours (the old rule left 8). High and low within an hour
  drop to 358 (from 11,247 under the old rule). Shipwrecks has none, and no
  extreme is in the past or more than 24h ahead.
- Cleaning the overlapping rows in the database is a separate, approval-gated
  production write (`docs/operations/tide-station-supersede-20260929.*`).

**Remaining upstream issue (not fixed here):** the other 358 pairs are real
2–14 mm wiggles where piecewise-linear `noaa_hilo_interpolated` segments meet.

**Deploy and hold.**

- Ships as one production deploy, and no other SEO change rides along.
  Deploy date and prod SHA: pending, so record them here when it ships.
- Do not change tide sub-page metadata, schema or coverage rules for four weeks
  after that deploy.
- Measurement is monitor-only: the count of indexed `/tides` pages in GSC and
  any structured-data warnings on the Dataset schema. There is no CTR
  expectation.

## 2026-09-29 Water-temp CO-OPS Station Distance Cap

Not a CTR test. This is a data-correctness fix to the reading shown on the
`/{state}/{city}/{beach}/water-temp`, Mexico and legacy `/beach/{slug}/water-temp`
pages, and on the `/water-temp/{city}` pages. Log it here so a CTR read on
these pages is not attributed to a title change.

**Bug.** `EnhancedForecastService.fetchCOOPSWaterTemp` took its station from
`getStationForLocation`, which tries partial name matches before coordinates
and otherwise falls back to the nearest region at any range. CO-OPS water temp
is used whenever IOOS has no fresh reading, so name collisions reached the
page. "Scorpion Bay (San Juanico)" showed San Juan, Puerto Rico (87°F).
Ocean Beach SF showed San Diego Bay (76°F against a 58°F buoy). Seabrook WA
showed La Jolla, and Sunset Bay OR showed Honolulu.

**Fix.** A resolved station more than 200 km from the beach gives no reading.
The page then falls back to IOOS if fresh, otherwise the latitude estimate
(the NDBC step is dead code). The cap is wider than the tide rule's 120 km
because, against the nearest buoy, stations 120–200 km away read within 1.3°F
(median, n=19) and all 19 beat the estimate. Past 400 km they were 16.9°F off.
A 120 km cap would have moved 34 more beaches (Maui/Kauai, Florida east
coast, Texas Coastal Bend, Pensacola, the Carolinas) from a 1.3°F to a 6.1°F
median error.

**What changes on the page:** only the temperature value and what is derived
from it:

- The `{temp}°F` in the title and meta description (`buildDynamicWaterTempMetadata`,
  and the city page's meta description).
- The "Water temp now" hero, the wetsuit advice and the `WaterTempDatasetSchema`
  values.

**What does not change:**

- Templates, title and description wording, URLs and canonicals.
- Coverage. The sitemap and the sub-page count a beach as covered when its
  newest row has a readable `water_temp`, and the city rule
  (`has_water_temp_data`) wants any non-empty `water_temp` in 7 days. The
  latitude estimate always produces one, so sitemap membership and `index`
  decisions are unchanged.

**Measured against production (read-only, 2026-09-29).** 558 beaches. Today's
sources were IOOS 25, CO-OPS 408 and estimate 125.

| | Beaches |
| --- | ---: |
| CO-OPS → latitude estimate | 90 (18 outside Mexico, 72 Mexico) |
| With a buoy within 50 km | 11: median error 16.9°F → 10.7°F, 8 improve |
| Baja below 30°N (San Diego 76°F → estimate 75°F) | 57, effectively unchanged |

GSC-protected pages whose number changes (snapshot
`gsc-performance-protection.v1.json`):

| Page | Before → after | Buoy | Clicks / impressions |
| --- | --- | ---: | ---: |
| `/ca/san-francisco/ocean-beach-middle-san-francisco-ca/water-temp` | 76 → 62°F | 58°F | 0 / 120 |
| `/wa/pacific-beach/seabrook-pacific-beach-area/water-temp` | 71 → 54°F | 58°F | 1 / 86 |
| `/water-temp/kailua-kona` | 83 → 80°F | — | 16 / 1,776 |
| `/water-temp/long-beach-ny` | 60 → 54°F | 65°F | 30 / 2,205 |

Long Beach NY gets less accurate. Its old reading came from Toke Point, WA,
and the estimate is further off than that.

**Remaining upstream issues (not fixed here):**

- The resolver's name matching was not gated by distance. Fixed in the same
  deploy; see "Resolver name-match gate" below.
- The latitude estimate peaks in June rather than Aug–Sep and uses coarse
  latitude bands. It is 8–11°F off (median) against buoys in late September
  and is shown as "Water temp now".

### Resolver name-match gate (same deploy)

`getStationForLocation` now accepts a name match only when its station is
within 200 km of the beach, and otherwise tries the next match and then the
geographic lookup. A blank name skips name matching; it used to return La Jolla
for any coordinates. Station coordinates come from a static table of the 64
stations the resolver can return.

26 beaches resolve to a different station. The reading changes on 11 pages
(same prod read, 2026-09-29):

| Page | Before → after | Buoy |
| --- | --- | ---: |
| Long Beach NY (Sandy Hook, 32 km); city page `/water-temp/long-beach-ny` | 54 → 62–63°F | 65°F |
| Seabrook WA (Westport, 34 km), GSC-protected | 54 → 57°F | 58°F |
| 1st Street Jetty, Ocean City NJ (Atlantic City, 15 km), GSC-protected; city page `/water-temp/ocean-city` | 62 → 65°F | — |
| Westport WA | 54 → 57°F | 58°F |
| Seaside Reef, Solana Beach (San Diego Broadway) | 62 → 76°F | 72°F |
| Baja Malibu (San Diego Broadway) | 62 → 76°F | 73°F |
| Dunes, La Misión (San Diego Broadway) | 62 → 76°F | — |
| Pohaku Park, Maui (Honolulu, 128 km) | 75 → 82–83°F | 80°F |
| Sandy Beach, Rincón PR (Mayagüez, 20 km) | 80 → 84–85°F | — |
| Rockaway Beach NY, 90th and 98th St (Sandy Hook, 21 km); 98th St GSC-protected | 54 → 62–63°F | 65°F |

All eight with a nearby buoy get closer to it. Long Beach NY ends above its
pre-fix 60°F, so the "less accurate" note above no longer holds. Rockaway Beach
NY is net unchanged from prod: the new `rockaway-beach` key (Garibaldi, OR)
would have moved it 4,040 km away and onto the estimate, and the gate keeps it
on Sandy Hook. Newport Beach CA and T-Street move to Newport Bay Entrance,
which has no temperature sensor, so they stay on the estimate. Ocean Beach SF
and Sunset Bay OR move to Golden Gate and Charleston, which had no reading in
the last 24 hours, so they stay on the estimate for now.

**Deploy and hold.**

- Ship it apart from the 2026-09-27 tide sub-page fix, which ships with no
  other SEO change riding along. Record the deploy date and prod SHA here when
  it ships.
- No four-week hold. No template, schema or coverage rule changes, and the
  value already changes on every refresh.
- Monitor only: position and CTR on the four pages above in the first full
  28-day window after deploy. Don't read a change on Long Beach NY or
  Kailua-Kona as a title effect.

## 2026-10-04 Baja Model Tides (FES2022)

Not a CTR test. This adds coverage, not copy: 50 Baja California and Baja
California Sur beaches have no NOAA tide station within 120 km, so their
`/mexico/{region}/{city}/{beach}/tides` pages have had no tide data and answered
`noindex`. The tide cron now writes FES2022 model tides for them (source
`fes2022`, station `FES2022`, 30 days per run). Validated against five NOAA
stations: median timing error 1.6–15.4 min, range ratio 0.913–1.123.

**What changes on those 50 pages.**

- They gain next high/low times, so they pass `isBeachSubPageIndexable` and
  enter the sitemap through the existing tide coverage rule. Their beach and
  water-temp pages were already listed on 2026-10-04, so the forecast gate is
  already met. No coverage rule changed.
- The visible note under the tide summary says the tide is modelled for the
  spot, not measured at a station, and not for navigation, and carries the
  FES2022 citation.
- The `Dataset` JSON-LD on model-tide pages adds `creditText` (the FES2022
  citation), `measurementTechnique` and `isBasedOn` (the AVISO FES2022 product),
  and the description says the predictions are modelled. NOAA pages emit the
  same JSON as before.

**Exception to the 2026-09-27 hold.** That fix shipped to prod on 2026-09-29,
and its four-week hold on tide sub-page metadata, schema and coverage rules
runs to 2026-10-27. Steven chose on 2026-10-04 to ship the Baja pages now. The
exception covers only pages that had no tide data and were `noindex`. The US
and other NOAA tide pages have no metadata, schema or rule change, so their
measurement window is undisturbed.

**Deploy and hold.**

- Deployed 2026-10-05 02:53 UTC (2026-10-04 19:53 PDT): prod `a2778c8b7`
  via #953, which also carried #945 (cron :00 spread).
- The 2026-10-07 04:00 UTC run wrote no FES2022 rows: prod's
  `tide_forecasts_source_check` did not allow `fes2022`. The fix was #982, applied
  to prod 2026-10-07 ~05:25 UTC (`docs/operations/tide-source-fes2022-20261007.md`).
- Live 2026-10-07: a manual tide cron at 13:03 UTC wrote 36,000 `fes2022` rows for
  all 50 beaches. At 14:17 UTC all 50 tide pages served `index, follow` with the
  modelled note and `creditText`, and all 50 were in the sitemap. The four-week
  hold on these pages runs to 2026-11-04.
- Hold these 50 pages for four weeks after the first run that writes their
  rows: no metadata, schema or copy changes.
- Monitor only: indexed `/mexico/.../tides` count in GSC, Dataset
  structured-data warnings, and impressions on the 50 pages. There is no CTR
  baseline because the pages were `noindex`.
