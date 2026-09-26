# Regional surf seasons from buoy records: Newport, Cocoa, Honolulu

Date: 2026-09-25
Status: design approved in chat, awaiting spec review
Scope owner: Steven

## Goal

Replace the hand-written seasonal numbers on three `/best-time-to-surf/[city]` pages with statistics computed from NOAA buoy archives, and rebuild the Newport Beach and Cocoa Beach pages around that evidence with licensed photos and plain, surfer-voiced copy.

Success is measured as: page visit → live forecast opened → beach saved or alert created → return visit. Merge and deploy are implementation evidence only; the work stays `shipped_unvalidated` until the +4 and +8 week readings.

## What we verified before designing

- Every city page in a state shows the same monthly grid. Wave ranges, water temps, crowd labels, "best for" text and Peak badges come from state-level profiles in `lib/data/monthly-surf-data.ts`. Those values are hand-written; the "NOAA climatological averages" line is a comment, not a source.
- The monthly score is `0.6 × beach best_months peak + 0.25 × state overallScore + 0.1 × water comfort + 0.05 × crowd` (`computeCompositeScore`, `lib/utils/surf-score-utils.ts`).
- The live Cocoa page server-renders `0` for every month score beside "September rates 86/100". Cause: `AnimatedScoreGauge` initialises `displayScore` to 0 and counts up only after an IntersectionObserver fires (`components/forecast/animated-score-gauge.tsx:135`, rendered at :291).
- The hero sentence mixes timestamps: "falling tide … incoming tide". `buildBestTimeTodayAnswerCopy` (`app/best-time-to-surf/[city]/page.tsx:333`) combines `forecastSummary.conditions.tide` (now) with `forecastSummary.bestWindow.reason` (the window, hours later).
- Honolulu lists only south-shore spots (Waikīkī, Ala Moana, Diamond Head, Kewalo, Kaisers), but its grid uses the Hawaiʻi state profile: "8-15 ft … Peak north shore, Pipe Masters" in December, with Peak badges on Nov–Feb.
- The "Dawn Patrol vs Afternoon Sessions" block is generic text built from state temps. On Cocoa it says "exposed reef setups in Cocoa Beach".
- Cocoa's current scene image (`public/images/seo-scenes/cocoa-beach-pier.webp`) is an AI-generated tilt-shift diorama that does not match the real pier.
- NOAA NDBC publishes hourly standard-meteorological archives for the buoys we need. Measured coverage of distinct hours with wave height:
  - 41113 Cape Canaveral Nearshore: 2007–2025, 88–98% per year except 2010 (70%) and 2011 (74%). 2006 is partial (26%).
  - 46253 San Pedro South: 2015–2025, 98–100%. 2014 is partial (20%).
  - 46222 San Pedro: 2006–2025, 94–100%.
  - Waverider buoys report no wind (WSPD coverage 0% on all three).
- Nearshore buoys closer to Dana Point (46285, 46277, 46275) only start in 2022–2025. Oceanside Offshore (46224) runs 2004–2025.
- Trident Pier (NDBC `trdf1`, CO-OPS 8721604) has archives for 2005–2025, 5 km from Cocoa Beach Pier.
- John Wayne Airport (KSNA) hourly wind is available from the Iowa Environmental Mesonet ASOS archive.

## Decisions

| Question | Decision |
|---|---|
| First build | Two regions with computed statistics (Orange County via Newport, Space Coast via Cocoa), plus the zero-score fix and Honolulu repair |
| Where content lives | Upgrade the existing pages in place. No new URLs |
| Monthly score on data-backed cities | Recompute from buoy data with a published formula (Buoy score v1) |
| Newport wind | John Wayne Airport, labelled as inland, behind a quality gate |
| Photos | Licensed (PD, CC0, CC BY, CC BY-SA), low-reuse, credited on the page. No AI-generated images on these pages |

## Scope

In scope:

1. An offline climatology build script and its committed output for `newport-beach`, `cocoa-beach`, `honolulu`.
2. A data-backed mode on `/best-time-to-surf/[city]` used by any city that has a climatology file.
3. New buoy-record sections, photos and copy on `newport-beach` and `cocoa-beach`.
4. Two fixes on every city page: server-rendered gauge numbers, and the tide contradiction.

Out of scope, recorded as follow-ups:

- Los Angeles/Ventura, New Jersey/New York, Pacifica/Santa Cruz, Oʻahu shore-by-shore pages.
- A standalone Orange County comparison page.
- Swell-exposure diagrams.
- Public API or raw data redistribution beyond per-city CSV.
- Crowd statistics.
- Removing the state-profile grid and "Dawn Patrol vs Afternoon" block from cities without climatology data.
- Title, meta description or URL changes.

## 1. Climatology pipeline

### Shape

- Script: `scripts/climatology/build-surf-climatology.ts`, run with `tsx`. Pure statistics live in `lib/climatology/` so they can be unit tested without network access.
- Downloads are cached under `.cache/climatology/` (gitignored). The script never writes to the database and needs no credentials.
- Output, committed:
  - `lib/data/surf-climatology/<city-slug>.json`: the dataset the page reads.
  - `public/data/surf-climatology/<city-slug>.csv`: the monthly table readers can download.
- Rerun once a year after NDBC publishes the previous year's archive. No cron.

### Sources

Configured in `lib/climatology/sources.ts`:

| City slug | Role | Station | Years used | Distance | Notes |
|---|---|---|---|---|---|
| cocoa-beach | waves, water temp | NDBC 41113 / CDIP 143 Cape Canaveral Nearshore | 2007–2025 | 8 km from Cocoa Beach Pier | 25 km from Satellite Beach |
| cocoa-beach | wind | NDBC trdf1 / CO-OPS 8721604 Trident Pier | 2007–2025 | 5 km | Port Canaveral; gate below |
| newport-beach | waves, water temp | NDBC 46253 / CDIP 213 San Pedro South | 2015–2025 | 24 km from Newport Pier | Reference for Huntington and Newport |
| newport-beach | comparison waves | NDBC 46224 / CDIP 045 Oceanside Offshore | 2004–2025 | 32 km south of Dana Point | Reference for Dana Point and San Clemente |
| newport-beach | wind | ASOS KSNA John Wayne Airport | 2015–2025 | about 10 km inland | Gate below |
| honolulu | waves, water temp | NDBC 51211 / CDIP 233 Pearl Harbor Entrance | 2017–2025 | 14 km from Waikīkī | No wind in v1 |

Station distances are computed from coordinates in the config and printed on the page, not hand-typed.

### Parsing rules

- NDBC stdmet files are UTC. Handle both header formats (older 2-digit or 4-digit year without minutes, newer `#YY MM DD hh mm`).
- Missing sentinels: `WVHT` 99.00, `DPD` 99.00, `MWD` 999, `WTMP` 999.0, `WSPD` 99.0, `WDIR` 999. Treat `MM` as missing.
- Collapse to one record per station-hour (first valid value) so sub-hourly files do not weight some hours more than others.
- Convert with `toZonedTime` into the city's zone (`America/New_York`, `America/Los_Angeles`, `Pacific/Honolulu`) before assigning month, day or hour of day.
- Units: metres → feet (× 3.28084), °C → °F, m/s → knots (× 1.94384). ASOS `sknt` is already knots.

### Coverage rules

- A station-month (e.g. 41113, Sept 2010) is used only if at least 70% of its hours have a valid value for that variable. Excluded station-months are listed in the dataset and on the page.
- A monthly statistic is published only if at least 5 station-months qualify. Otherwise the cell shows "not enough data".
- Quality gates, applied per wind source (trdf1, KSNA), 51211 and 46224 before their numbers are used:
  - at least 90% of all hours in the chosen years have valid values, and
  - for wind, the hour-of-day median direction shows an afternoon onshore shift in June–August (the sea breeze). If a wind source fails, the page ships without that wind section and says so in the method block.

### Statistics per station per local calendar month

Waves:

- Significant wave height (Hs): median, 25th–75th percentile, 90th percentile. Nearest-rank percentiles on hourly values.
- Small days: share of days where the daytime (06:00–18:59 local) median Hs was under 2 ft.
- Big days: share of days where Hs reached 6 ft or more in at least 3 hours.
- Period mix: share of hours with dominant period (DPD) under 8 s, 8–9.99 s, and 10 s and up.
- Direction mix: share of hours by mean wave direction (MWD) in 8 sectors of 45° centred on N, NE, E, SE, S, SW, W, NW. Sector assignment wraps at 360°.
- Year-by-year: median Hs for each station-year-month that passed coverage.

Water:

- Water temperature: median, 10th and 90th percentile, in °F.

Wind (where a source passes its gate):

- For each time block (dawn 06:00–08:59, midday 11:00–13:59, afternoon 15:00–17:59 local): share of hours that were offshore, cross-shore, onshore, or light (under 6 kt), and the median speed.
- Direction class relative to the configured shore normal: onshore within ±67.5° of the normal, offshore within ±67.5° of the opposite bearing, cross-shore otherwise. Shore normals: Cocoa Beach 75°, Newport Beach 210°. The implementation checks both against the coastline bearing at each pier and records the source in `sources.ts`.

Coverage (always published): years used, qualifying station-months per calendar month, total valid hours, excluded station-months.

### Buoy score v1

Locked before any numbers are computed. A change to weights, thresholds or inputs is a new version shown on the page.

```
score = round(100 × (0.45 × surfDays + 0.25 × groundswell + 0.20 × cleanMornings + 0.10 × waterComfort))
```

- `surfDays`: share of days where the daytime median Hs was 2 ft or more (the complement of "small days").
- `groundswell`: share of hours with DPD of 10 s or more.
- `cleanMornings`: share of days where the mean 06:00–08:59 local wind was offshore or under 6 kt.
- `waterComfort`: `waterTempComfortScore(median °F) / 100`, reusing `lib/utils/surf-score-utils.ts`.
- When a city has no wind that passed its gate, `cleanMornings` is dropped and the remaining weights are divided by 0.80. The page says so.
- The score is absolute. Cities with v1 scores can be compared; they are not comparable with the legacy composite score on other city pages, and the page explains that.

The following all derive from the same v1 scores so they cannot disagree:

- Peak month: the highest-scoring month. Ties go to the earlier month.
- Peak badges: months within 10 points of the peak month.
- Hero line "`<Month>` rates `<score>`/100", the gauge, the monthly chart, the heatmap and its tooltip.

### Dataset contract

`lib/climatology/types.ts`:

```ts
export interface SurfClimatologyDataset {
  schemaVersion: 1;
  scoreVersion: "buoy-v1";
  citySlug: string;
  generatedAt: string; // ISO date the script ran
  timezone: string;
  stations: ClimatologyStation[];
  months: ClimatologyMonth[]; // 12 entries, month 1-12
  coverage: ClimatologyCoverage;
}

export interface ClimatologyStation {
  id: string; // "41113"
  alias: string | null; // "CDIP 143"
  name: string;
  role: "waves" | "comparison-waves" | "wind";
  lat: number;
  lon: number;
  distanceKm: number; // to the city's reference point
  referenceLabel: string; // "Cocoa Beach Pier"
  yearsUsed: [number, number];
  gate: "passed" | "failed" | "not-applicable";
}

export interface ClimatologyMonth {
  month: number;
  waves: WaveMonthStats | null; // null when coverage rule fails
  comparisonWaves: WaveMonthStats | null;
  waterTempF: { median: number; p10: number; p90: number } | null;
  wind: WindMonthStats | null;
  score: number | null;
}
```

`WaveMonthStats`, `WindMonthStats` and `ClimatologyCoverage` hold the fields listed under Statistics. All heights are feet, rounded to 0.1 ft; shares are 0–1 rounded to 0.01.

The CSV has one row per month per station with the same fields and a header comment naming the source stations, years and method version.

## 2. Page changes

### Every city

- **Gauge numbers in HTML.** `AnimatedScoreGauge` renders the real score as text on first render. Only the arc animates, and only after hydration when reduced motion is off. The quality label is no longer `opacity-0` before animation. This follows the existing rule of not rendering attributes from `useReducedMotion()` during SSR.
- **Tide sentence.** The best-window sentence describes the window with the window's own conditions. If `bestWindow` does not carry a tide state, the sentence omits tide rather than borrowing the current one. The live-cue sentence below it keeps describing current conditions and says "now".

### Data-backed mode

Enabled when `getSurfClimatology(citySlug)` returns a dataset (`lib/climatology/get-surf-climatology.ts`, a static import map keyed by slug). No feature flag.

For those cities the page:

- Takes the score, peak month, Peak badges, month wave text and water temps from the dataset. The state profile and `best_months` no longer feed these on this page.
- Words wave figures as buoy readings with the station named, e.g. "Buoy median 2.4 ft (typical 1.8–3.3 ft) at Cape Canaveral Nearshore". It never says "waves" or "surf" for a buoy number alone.
- Drops crowd labels.
- Derives wetsuit advice from the dataset's median water temp using the existing wetsuit rules.
- Replaces "`N` of `N` local beaches are in peak season" with a sentence built from the v1 score, e.g. "September is inside the peak band (within 10 points of the best month)".
- Uses dataset temps in the FAQ water-temperature answer and FAQ schema.
- Removes the "Dawn Patrol vs Afternoon Sessions" block. Cities with wind data get the wind section in its place.
- Draws charts as server-rendered SVG. The Recharts monthly chart is not used in this mode because it renders empty on the server.

Honolulu gets only this data swap: no new copy sections, no photos, no wind.

### New sections on Newport Beach and Cocoa Beach

Order, top to bottom after the existing hero and live cues:

1. **Short answer.** Two or three sentences written from the computed numbers after the script runs.
2. **Month table.** One row per month: buoy median and typical range, big days, small days, period mix, water temp, v1 score.
3. **Charts** (server SVG, following the dataviz skill for colours and marks):
   - Monthly Hs range: median dot, 25–75 bar, 90th tick.
   - Swell direction by season: stacked bars for Dec–Feb, Mar–May, Jun–Aug, Sep–Nov using the 8 sectors. Newport shows 46253 and 46224 side by side.
   - Wind by time of day: dawn, midday, afternoon stacked shares per month (Cocoa; Newport only if KSNA passes).
4. **Where the numbers come from.** A small locator map showing the beaches and each station with its distance. Mapbox Static Images with markers and the required Mapbox attribution. The plan confirms the token and `remotePatterns` setup.
5. **What the buoy can't tell you.** Short, specific: buoy Hs is measured offshore and is not face height at the pier; sandbars shift; jetties and piers change the wave locally; one buoy stands in for several beaches.
6. **Local comparison.**
   - Newport: Huntington/Newport (46253) against Dana Point/San Clemente (46224), using direction and period mix. It states plainly that a shared buoy does not show different surf between Huntington and Newport.
   - Cocoa: Satellite Beach, 25 km south of the same buoy, with the same caveat.
7. **How the score works.** The formula in words, the version, and a link to the CSV.
8. **Source line** under every chart and the table: "Analysis by Quiver of NOAA NDBC station 41113 (CDIP 143) hourly observations, 2007–2025, `<n>` hours. Method buoy-v1." Wording uses "analysis by Quiver", never "Quiver measured".
9. **Next step.** Links to the live forecast for the pier spot, then save beach / create alert using existing components. One primary CTA, consistent with the existing CTA invariants.

### Components

- `components/best-time-to-surf/buoy-record/`: `month-table.tsx`, `wave-range-chart.tsx`, `direction-mix-chart.tsx`, `wind-by-hour-chart.tsx`, `station-map.tsx`, `source-line.tsx`, `season-photo.tsx`. Server components unless interaction requires otherwise.
- Copy: `lib/data/surf-climatology/copy/<city-slug>.ts` with typed fields (`answer`, `buoyLimits`, `comparison`, photo captions). Copy is written after the dataset exists and every figure it mentions is read from the dataset at render time, not typed into the string.

## 3. Writing rules

- Every sentence either states a figure from the dataset, cites a named source, or explains what a figure cannot show. No unsourced local lore.
- Plain surfer vocabulary where it fits: buoy reading, groundswell, windswell, onshore by lunch, glassy. No meteorology jargon without a short gloss.
- Banned in page copy, enforced by `__tests__/data/surf-climatology-copy-voice.test.ts`:
  - "not just", "not merely", "it's not X, it's Y" style reversals (regex on `not (just|merely|only) .*[,;—] (it'?s|but)`)
  - "whether you're", "stunning", "nestled", "hidden gem", "breathtaking", "in this guide", "comprehensive", "unlock", "elevate", "dive into", "magic"
  - bolded whole sentences (no `<strong>` or `**` spanning a full sentence)
- Titles and headings are specific and do not reuse one template across cities.
- Steven reviews all copy before the PR is marked ready.

## 4. Photos

Stored as processed WebP (max 2400 px wide, watermarks cropped) in `public/images/seasons/<city-slug>/`. Provenance ledger: `scripts/data/season-approved-photos.json`, following `learn-approved-photos.json` (`creator`, `licenseCode`, `licenseUrl`, `sourceUrl`, `runtimeAssetPath`, plus `modified: "cropped" | null`).

Every photo shows a visible credit under it: "Photo: `<creator>`, `<license>`" linking to the source page and the license. Cropped CC BY-SA images say "cropped" and stay under the same license. Captions describe what is in the frame and do not claim more than the metadata supports.

| Page | Slot | File (Wikimedia Commons) | Creator | License | Notes |
|---|---|---|---|---|---|
| cocoa-beach | hero | `File:Surf_heaven_today_at_cocoa_beach_fl_-_Flickr_-_Rusty_Clark.jpg` | Rusty Clark | CC BY 2.0 | Surfer at Cocoa Beach after Hurricane Sandy, 2012-10-29 (replaced the Falcon 9 launch photo on 2026-09-26: the hero should show surf) |
| cocoa-beach | big swell | `File:Pier at Cocoa Beach (3879447583).jpg` | Mangrove Mike | CC BY 2.0 | Hurricane Bill surf, 2009-08-21 |
| cocoa-beach | typical day | `File:Surfing at the Cocoa Beach Pier (Cocoa Beach, Florida) 005.jpg` | Leonard J. DeFrancisci | CC BY-SA 3.0 | Looking south from the pier, 2014-01-18 |
| cocoa-beach | buoy limits | `File:Satellite Beach from the air (35539816191).jpg` | Michael Seeley | CC BY 2.0 | Sandbar and trough from above, 2017-07-02; crop signature |
| newport-beach | hero | `File:Newport Pier 2 copy by Don Ramey Logan.jpg` | Don Ramey Logan | CC BY 4.0 | Do not caption as Blackies |
| newport-beach | south swell | `File:The Wedge.jpg` | SkiEngineer | CC BY-SA 4.0 | 2016-08-04 |
| newport-beach | Huntington comparison | `File:HB Pier by Don Ramey Logan.jpg` | Artist field "WPPilot" | CC BY-SA 4.0 | Confirm the credit line from the Commons user page before publishing |
| newport-beach | Dana Point comparison | `File:Orange County (26007449440).jpg` | Sergei Gussev | CC BY 2.0 | Strands from the Dana Point Headlands, 2016-04-02 |

- On `cocoa-beach` in data-backed mode, the AI diorama scene panel is replaced by the hero photo. The diorama stays wherever else `CITY_SCENES["cocoa-beach"]` is used.
- Before publishing, confirm none of these files are already used on Quiver. The check needs a read-only production query that Steven runs or allows:

```sql
select b.city, b.name, p.image_url
from beach_photos p join beaches b on b.id = p.beach_id
where p.deleted_at is null
  and (p.image_url ilike '%190221-F-DJ189-1003%'
    or p.image_url ilike '%3879447583%'
    or p.image_url ilike '%Surfing_at_the_Cocoa_Beach_Pier%'
    or p.image_url ilike '%35539816191%'
    or p.image_url ilike '%Newport_Pier_2_copy%'
    or p.image_url ilike '%The_Wedge.jpg%'
    or p.image_url ilike '%HB_Pier_by_Don_Ramey_Logan%'
    or p.image_url ilike '%26007449440%');
```

The other 40 candidates for the remaining regions are kept in the photo research notes for the follow-up packages.

## 5. SEO

- No URL, title, meta description or canonical changes, so the content change can be read on its own.
- `Dataset` JSON-LD on Newport and Cocoa describing the CSV (name, description, creator Quiver, `isBasedOn` the NDBC station pages, temporal coverage, `distribution` with the CSV URL and `encodingFormat: text/csv`). Honolulu gets none because it has no visible download.
- Sitemap `lastModified` for data-backed cities comes from `dataset.generatedAt`.
- Both pages ship in one production deploy. No other SEO changes ride along, and the next SEO change waits for the stability window.

## 6. Measurement

- Baseline: the 30 days before deploy for both pages. Use PostHog pageviews with referrer Google or Bing, excluding the North Charleston single-pageview cluster and the existing bot filter.
- Funnel: page view → live forecast opened from the page → beach saved or alert created → return visit within 14 days. The plan confirms the exact event names that exist today and adds none unless a step is missing.
- Readings at +4 and +8 weeks after the production deploy. Counts are small (roughly 13–17 referred visitors per page per month, unverified), so the readout reports raw counts and does not claim significance.

## 7. Testing

Unit (Jest, mocked, no network):

- NDBC parser: both header formats, sentinels, `MM`, duplicate sub-hourly rows.
- UTC → local assignment across DST boundaries and month edges.
- Percentiles, day classification, sector wrap at 360°, wind classes relative to shore normal.
- Coverage rule and gate outcomes, including the "not enough data" path.
- Buoy score v1 against a hand-computed fixture, including the no-wind renormalisation.
- Peak month, Peak badges and hero sentence derived from the same scores.
- `AnimatedScoreGauge` server render contains the real score text.
- Best-window sentence never combines current tide with window reason.
- Copy voice test.
- Page wiring: a data-backed city renders dataset values and no state-profile text. A non-data city renders as before.

Checks: `yarn typecheck`, scoped ESLint on changed files, `yarn deadcode`, `VERCEL_ENV=preview yarn build`, and a targeted Playwright check that `/best-time-to-surf/cocoa-beach` returns 200 with non-zero month scores and the photo credits present.

## 8. Risks

- **Cocoa's score will fall.** Florida swell is mostly short period, so v1 may put Cocoa's best months in the 40s–50s where it shows 86 today. That is the honest reading. The page explains the scale.
- **Buoy is not the beach.** Every figure names its station and distance, and the limits section says what the buoy misses.
- **KSNA may not represent Newport's beach wind.** The gate decides. If it fails, Newport ships without a wind section.
- **Share-alike photos.** Three images are CC BY-SA. Crops are credited as modified and stay under the same license.
- **Honolulu stays noindex** unless it already has approved editorial content. The repair still matters for anyone who reaches the page.

## 9. Follow-ups (not in this build)

- Apply the pipeline to Los Angeles/Ventura, New Jersey/Long Island, Pacifica/Santa Cruz and Oʻahu by shore.
- Remove state-profile text and the "Dawn Patrol vs Afternoon" block from cities without climatology data.
- Confirm or rule out the North Charleston traffic as Google Cloud us-east1 bots in PostHog.
- Decide whether to build a standalone Orange County comparison page after the +8 week reading.

## Amendment 1 (2026-09-25): reading Newport's season

Decided after the first build, when Newport's buoy score came out flat.

### What the build showed

- Buoy score v1 by month: Cocoa 59 57 61 56 52 42 37 44 61 61 66 61; Newport 84 81 81 84 86 88 91 88 87 88 84 83; Honolulu 60 61 69 78 87 87 82 85 84 81 68 64.
- Surfline's guides agree with the buoy peak band for Cocoa Beach Pier (best season fall to spring) and Waikīkī/Queen's (summer, about April to October).
- Newport's score stays within 10 points all year, so the Peak rule marks every month. San Pedro South sits outside the winter shadow: 77% of January hours carry west swell, which Surfline's Orange County guide says the county's south-facing breaks largely miss from November to April.
- At San Pedro South, days with a 3 ft+ daytime median mostly from the south or southwest: 18–26% of days May–October, 3–5% December–February. Mostly from the west or northwest: 38–46% December–February, 4–8% July–September.
- Score v2 (3 ft surf days) and a swell-window filter using Quiver's seeded beach windows were both tried and rejected: v2 moved Newport's peak to January, and the seeded 54th Street window (200–310°) excludes the south swell that makes up 78% of the buoy's July hours.

### Decisions

1. Keep buoy score v1 for all three cities.
2. **No clear season rule:** when every scored month sits within 10 points of the top month, show no Peak badges, name the top month as "highest" rather than "peak", and say plainly that the buoy doesn't single out a season. Applies to any city; today only Newport.
3. **New figure, all cities:** for each month, the share of observed days with a daytime median of 3 ft or more, grouped by the day's most common swell direction (8 sectors). Stored in the dataset and the CSV.
4. **Newport season note:** after showing what the buoy says, a section titled "Why Newport's best days still come in summer" with a chart of 3 ft+ south/southwest days against 3 ft+ west/northwest days by month, and copy built from those figures. The page cites no competitor: the argument rests on Quiver's own buoy figures and the beaches' southwest facing, with Wikipedia's article on the Wedge for the south-swell mechanism (Surfline's research above informed the decision but is not a published source, per Steven, 2026-09-26). Newport's best-month FAQ answer says summer into fall and gives the numbers.
5. Cocoa and Honolulu keep their buoy peak bands; both match Surfline.

### Follow-up

- Quiver's seeded swell windows for Newport (54th Street 200–310°) exclude south swell. The live forecast's "good swell angle" check reads these windows. Check the production values separately.
