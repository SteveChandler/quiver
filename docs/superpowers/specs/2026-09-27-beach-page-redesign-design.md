# Beach page redesign: design

- **Date:** 2026-09-27
- **Status:** Draft, awaiting Steven's review
- **Surface:** public beach page `app/[intent]/[city]/[beachSlug]/page.tsx` (e.g. `/ca/san-diego/tourmaline`)
- **Mockup:** [beach page](2026-09-27-beach-page-redesign/beach-page.jpg). Photos are repo placeholders and numbers are illustrative. The week cards show "Skip" where the build shows the tier word "Meh".
- **Companion spec:** [web planning home](2026-09-27-web-planning-home-design.md). Both pages are built from the same visual parts.

## Why

The beach page is where people meet Quiver. Over 90 days it had 7,336 human visitors, 17 times the signed-in home. Today it reads as a text document:
- a giant title
- a row of numbers
- tabs
- an hourly table
- two app pitches and a signup bar

The beach's own photo, map and cam are in a collapsed section at the very bottom. The page's asks don't work:

| Ask | Saw it | Clicked |
|---|---|---|
| Inline "home break" signup | 6,421 | 0 |
| App handoff above the fold | 2,486 | 0.24% |
| App handoff after the hourly table | 262 | 0.76% |

Signed-out visitors, about 98% of the audience, don't even see the surf call. It sits behind "Sign in to reveal".

## Who it's for

These come from the 2026-09-27 decisions, and memory `project-web-audience-strategy` has them too.

- **The web has no path to a paying user.** Paid plans live in the app, so there's no web signup push.
- **Most visitors aren't surfers.** Search queries confirm it:
  - The main beach page's search audience is 91% surf-intent ("westport surf report", "jobos surf cam").
  - Only 28% of its visitors arrive from search. The rest come through the site, including the water-temp pages, whose searchers are 94% beachgoers.
- **So the main beach page answers both audiences at once.** The surf answer sits on the left, and the beach-day answer next to it.
- **The app ask appears only on surfer intent,** when someone taps **Watch**.

## Decisions

| Topic | Decision |
|---|---|
| Layout | One page for both audiences, direction 2 in the brainstorm, without the audience switch |
| Hero | Cam-first media card with two answers: "Surfing today" and "Beach day today" |
| Surf call | Shown to everyone, not personalized, labelled "for most surfers" |
| Actions | Two: **Watch** (surfers; hands off to the app when signed out) and **Share** (everyone) |
| Web signup | Not pushed. The sticky bar, inline signup and generic app pitches are retired. |
| App Watch | Add a Watch action to the app's selected-window sheet. It's a native change, and the web button's wording depends on it. |
| Subpages | `/water-temp` and `/tides` beach subpages are out of scope. They'll get a beach-day-first follow-up that reuses these parts. |

## Page, top to bottom

On desktop it's a single column, max width about 1240px. On mobile the same order stacks, the hero's two answers stack, and the week scrolls sideways.

1. **Breadcrumb:** California / San Diego / Tourmaline. The same links and `BreadcrumbStructuredData` as today.
2. **Safety strip:** the existing NWS rip-current and hazard banner (`RipCurrentWarning`), full width, attached to the top of the hero. Nothing shows for low risk, as today.
3. **Hero media card.**
   - **The media:** `HomeHeroMedia` with Swell, Sat, Photo and Cam, extended as described under [Data](#data).
   - **Title:** the beach name large, with "surf, water temp & tides · San Diego" small.
   - **Two answer panels** along the bottom:
     - **Surfing today · for most surfers:** the call word and phrase ("Fair · Worth a look"), size, primary swell, wind, and the best window.
     - **Beach day today:** water temperature and wetsuit, next low tide, sunset, plus an advisory only when one exists.
   - **A strip of three windows** (morning, midday, afternoon), each with its surf tier and tide phase.
4. **Actions:** Watch and Share, each with a one-line subtitle (see [Actions](#actions)).
5. **Two columns.**
   - **Surf, hour by hour:** a chart of surf-height bars with the tide curve and wind arrows, and the best window shaded.
   - **Beach day:** water temperature, next low tide, today's tide curve, daylight, and a water-quality advisory only when one exists.
6. **The week at this beach:** 7 cards.
   - **Top half:** the day's tier stamp, the size, and a small swell glyph drawn from the day's primary swell (spacing is the period, angle is the direction, weight is the size).
   - **Bottom half:** that day's low tide.
   - **Days 4 or more out** (the 5th card onward) are faded and tagged *Early*, the same rule as the home spec.
7. **Better nearby today?** Photo tiles of nearby spots, from the existing nearby enrichment, with the call, size, window and drive time.
8. **From the lineup:** the existing Reviews, Local intel and Sessions tabs, unchanged. The Overview and Forecast tabs go away because the sections above replace them. The spec didn't list the tabs, and the plan keeps the community content rather than dropping it.
9. **About this beach:** the existing editorial text, amenities, and related-guide links, plus the FAQ with the same questions and `FAQSchema`.
10. **Full hourly table:** the existing `PublicForecastHourly`, still rendered on the server, placed under a "Full hourly table" disclosure below the chart.

**Retired from the page:**
- `StickySignupBar`
- the desktop inline "home break" signup
- `ContentPageAppHandoffCta` (after the hourly table)
- `BeachDetailInstallCta` (the QR and email panel; its QR moves into Watch)
- the collapsed "Spot photo, map & camera" section, now the hero
- the zine title block that restates the beach name

The global header's "Get the app" button stays.

## Data

### Surf call for everyone

`app/[intent]/[city]/[beachSlug]/page.tsx:225-228` passes the report through `selectPublicForecastReportFacts` (`lib/utils/public-forecast-facts.ts:4-14`), which strips `verdict`, `score` and `tiers`. `PublicForecastAnswer` then shows a verdict only when signed in (`public-forecast-answer.tsx:113`).

**The change:**
- **Pass the verdict and score through to everyone.** Add `verdict` and `score` to the public facts. Adding them is additive; the removal of any field is not part of this change.
- **The label:** built through `getCanonicalVerdictCall` (`components/forecast/score-band-call.ts:55`), the same vocabulary as home. Map `YES → go`, `MAYBE → maybe`, `NO → no`.
- **Which call:** the report's general verdict and score, computed without personalization, labelled "for most surfers". The public path runs the hold check with `authorizedTier: null`, which removes the per-skill tiers (`lib/recommendations/major-event-hold/adapters/surf-call.ts:123-129`), so no intermediate tier is available. Verified 2026-09-27.
- **Signed-in users** keep their personalized call, as today.
- **Safety:** verified 2026-09-27. `getSpotSurfReportPublic` already runs `applySurfCallMajorEventHold` (`lib/services/spot-surf-report-service.ts:216-230`), and a held or unbound window comes back with `recommendationAvailability.state = "none"` and verdict `NO`. When the state is `none`, the hero shows "No call right now" and the reason, never a positive word.

### Hero media

`HomeHeroMedia` (`components/oracle/zine/home-hero-media.tsx`) is a client component with no auth dependency. Three changes:
- **A default viewpoint per surface.** Add a prop, since the beach page defaults to Cam when `sources.camera_url` exists. Otherwise the order is Photo (a real photo of this beach), then Swell.
- **A storage key per surface.** The key is `quiver:home-hero-viewpoint` today; the beach page gets `quiver:beach-hero-viewpoint`.
- **The full-size photo for the hero.** The page currently passes `thumbUrl ?? imageUrl` (`page.tsx:204`).

The camera URL and photo are already fetched on the server (`page.tsx:200-213`). The Swell view takes `rowToSwellPartition` of today's selected row.

### Beach-day facts

| Fact | Source today | Change |
|---|---|---|
| Water temp and wetsuit | client `currentForecast.water_temp`; server `getWaterTempMetaData` used only to gate a link | Read on the server and pass it down for the hero |
| Next low and high tide | client `useDynamicTide`; server `getTideMetaData` used only for link gating | Read on the server (next 24h) for the hero; the client keeps the curve |
| Sunset and daylight | client `useSunTimes` | Unchanged (client) |
| Water quality | server `currentWaterQuality`, shown only for advisories | Unchanged. Show it only for an advisory or closure. Never show "Clean": `projectCurrentWaterQuality` deliberately never equates "no notice" with safe water (`current-status.ts:48`, `:79-80`). Verified 2026-09-27. |
| Rip risk | client `RipCurrentWarning` (`rip_current_risks`) | Unchanged |

### The week

The public page can't use `/api/surf/week-scout`, which requires sign-in. It uses the 10 days of `enhanced_forecasts` rows the page already loads on the client (`useBeachDetailData({ forecastDays: 10 })`) and aggregates them with `aggregateDayForecasts` (`lib/utils/horizon-strip-utils.ts`):
- **Tier and size:** `DaySummary.tier` and `minHeight`/`maxHeight`, the same numbers today's outlook strip shows.
- **Swell glyph:** the day's best row through `rowToSwellPartition` (`lib/domains/conditions/map-forecast.ts:182`). That gives height, period and direction for the primary swell.
- **Low tide:** each day's first-row `raw_forecast.tide_schedule`, merged by `extractMergedTideSchedule`, taking the day's first low in beach-local time.
- **No per-day water temperature.** Future rows carry the current reading or a latitude estimate (`forecast-builder.ts:2053-2079`), so the week shows none.
- **No end-to-end window for days 2 and later.** Only `DaySummary.bestTime` exists, so those cards show "best ~7am", not a range.

### Nearby spots

Uses the existing `DeferredZineNearbySpots` data, restyled as photo tiles with the same photo rule.

## Actions

**Watch today 11–1:30**, with the subtitle "For surfers: a heads-up on your phone if it changes. Opens in the Quiver app."
- **Signed in on the web:** creates the same `watched_call` alert rule the app creates, through `POST /api/alerts/rules`, with `sourceSurface: "beach_detail"` and `mode: "beach-detail"`. Both are allowed today (`lib/alerts/condition-validation.ts`), so the validator needs no change. It shows up on the home page's "Watching" row.
- **Signed out on a phone:** opens the tracked app handoff for `/app/spot/<slug>?window=<forecastAt>`. That's a universal link, so the app opens at that window with the window sheet open. With the native change below, the sheet offers Watch.
- **Signed out on desktop:** a small sheet with a QR code for the same link: "Scan to watch this window in the Quiver app."
- **Until the native change ships,** the web label reads **"Open in the app"**, not "Watch", so the button never promises something the app can't do.

**Share Tourmaline today**, with the subtitle "The cam still, the water temp and the surf call."
- Uses `components/share/share-sheet.tsx` with the page URL: the native share sheet on mobile, copy-link on desktop.
- No account needed.

## Native change (quiver-native)

- **The gap:** a deep link opens `BeachDetail` with the selected-window sheet (`looking-ahead-slot-sheet.tsx`). That sheet has no Watch. `WatchSpotButton` lives only on the best-window card, and that card is hidden when the linked window is the best window (`src/lib/plan-my-next-session/beach-detail-best-window.ts:160-165`).
- **The change:** add a Watch action to the selected-window sheet that creates a `watched_call` rule for that window. Reuse `WatchSpotButton` and its payload builder (`alert-rule-seed.ts`), with `sourceSurface` taken from the deep-link entry.
- **Shipping:** it's JavaScript only, so it can ship as an EAS update. It gets its own plan in the native repo.

## Search safety

- **Metadata:** the title, description, canonical URL and all structured data stay unchanged (`BeachPageStructuredData`, `BreadcrumbStructuredData`, `FAQSchema`, `WebPageSchema`, `LiveCamSchema`).
- **H1:** keeps its words ("Tourmaline Surf Forecast for Sunday, September 27, 2026", or the dateless version with `?window`). It's restyled as the hero title: the beach name large, the rest small. `ZineHero`'s duplicate h2 title goes away.
- **Content:** every piece of indexable text stays on the page and in the server HTML: the answer facts, editorial text, FAQ, the hourly table, and nearby and guide links. It moves below the visuals and is never removed.
- **Pace:** one deploy for this template, then a 4-week hold before the next SEO-affecting template (memory: SEO stability windows).
- **Guardrail:** compare beach-page Search Console clicks and impressions for the 4 weeks before and after. A drop of more than 20% not explained by seasonality triggers a review and possibly a rollback.

## Analytics

- **Reused:** `watched_call_created` (signed in), plus `app_handoff_view` and `app_handoff_link_opened` with `placement: "beach_watch"` (signed out). `scroll_depth` and `time_on_page` already exist.
- **New, client, consent-gated:** `beach_hero_viewpoint_changed`, `beach_week_day_selected`, `beach_share_opened`.
- **Alignment:** keep emitters, allowlists, unions and constraints aligned, per `soul.md`.

## Success measure

The status stays shipped but unvalidated until these move. Compare 4 weeks before with 4 weeks after, reading monthly numbers because the sample is small.

1. **Usefulness:**
   - share of visitors who scroll past the hero
   - share who interact with the hero, week or hourly chart
   - share opens
2. **Surfer path:** Watch taps, then handoff opens, then installs (`native_install_attribution_joined`). Today the equivalent is about 8 handoff clicks in 90 days, so any credible rise is a win.
3. **Guardrail:** the Search Console numbers above.

## Tests

**Mocked unit tests:**
- the public call mapping, including holds and the "for most surfers" label
- hero viewpoint defaults (cam, then photo, then swell) and the per-surface storage key
- week aggregation: tier, size, glyph input and low tide per local day, with no water temperature
- Watch behavior by state: signed in, signed out on mobile, signed out on desktop, and the pre-native-release label

**`e2e/guest-anonymous-cta-reduction.spec.ts`** has to be rewritten to the new contract. Tests at `:233` and `:263` assert the retired sticky bar, inline signup and after-hourly handoff. The new tests check:
- a signed-out visitor sees the surf call
- exactly one primary action (Watch or "Open in the app") and Share
- no signup bar or inline signup
- the "Today's Surf Call" test (`:181`, already skipped) is replaced by the public-call test

**Other specs to update:**
- `e2e/usage-critical.spec.ts:212-232` needs a signup or sticky element that won't exist.
- `e2e/prod-readonly/guest-ui.spec.ts:120-130` should be checked.

**Documentation:** update `components/beach-detail/ARCHITECTURE.md` in the same change. It's already stale (it describes a hero with a hardcoded "128 reviews").

## Out of scope

- beach-day-first redesigns of `/…/water-temp` and `/…/tides`
- `/water-temp/[city]`, city pages and regional forecasts
- a spots × days comparison grid
- web signup or paywall work
- photo curation (a prerequisite, tracked in `.planning/2026-09-27-broken-beach-photos/curation.md`)

## Check before the implementation plan

1. **Done (2026-09-27):** the public call is hold-safe, and tiers are unavailable publicly (see [Surf call for everyone](#surf-call-for-everyone)).
2. **Done:** "Clean" is dropped (see [Beach-day facts](#beach-day-facts)).
3. **Done:** all 497 beaches have 11 local days of `enhanced_forecasts` rows, and each day's first row carries `tide_schedule`.
4. The native sheet: confirm `WatchSpotButton` can take a selected window (not only the best window) without breaking its dedupe rules.
5. Build order with the planning home: the shared parts (hero media, action row, spot tiles, share) should be built once, then used on both pages.
