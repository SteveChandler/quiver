# Phase 14: Guardrails, Data Inventory, And Template Safety - Context

**Gathered:** 2026-06-01
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

This phase starts the Quiver Web "Session Intelligence" v1 addendum by proving
where the layer can be added safely. It must not replace, renumber, or rewrite
previous phases.

The product goal is to make the web app consistently answer:

> When should I surf this spot, why, and is it right for me?

The full addendum should eventually work across spot pages, forecast pages,
city/intent pages, longboard pages, beginner pages, dawn patrol pages, sunset
session pages, tide-window pages, less-crowded pages, and selected
water-temp/tide utility pages where it adds surfer decision value. Phase 14 only
does guardrails, inventory, template review, and profiling prep.
</domain>

<guardrails>
## Guardrails

- Use GSD: ship small, safe, measurable slices.
- Do not overhaul the whole site.
- Do not create duplicate thin SEO pages.
- Do not retarget water-temp pages as surf-report pages.
- Do not hide useful answers behind sign-in.
- Do not add unsupported data-source claims.
- Do not introduce a new ML model.
- Do not add fishing-style overlays such as AIS, chlorophyll, SST fronts, or
  current shear unless already used for surf.
- Do not change canonical URLs unless a separate canonical cleanup phase exists.
- Do not mass-change metadata.
- Ahrefs crawl limit is fixed. Do not pay to increase it.
- Treat Ahrefs as a sampled audit, not the source of truth. Confirm findings
  against GSC, Vercel, PostHog, direct template review, or code inspection.
</guardrails>

<requirements>
## Requirements

- **SI-01:** Inventory eligible templates and data availability before adding
  heavier recommendation UI.
- **SI-02:** Create a deterministic `SurfWindowRecommendation` model and helper
  that returns the top 3 surf windows from existing forecast data.
- **SI-03:** Build reusable, accessible UI components for best windows,
  explanations, source confidence, and app deep links.
- **SI-04:** Prove the system on a small pilot: one major spot page, one regional
  forecast page, and a compact homepage module.
- **SI-05:** Roll out only after pilot validation, preserving page intent,
  canonical URLs, schema, app CTAs, and measurement.
- **SI-06:** Upgrade `/forecast-accuracy` so it never appears empty and only
  shows accuracy claims backed by data.
- **SI-07:** Validate universal/app links, analytics, performance, mobile
  layouts, source claims, and fallback states before broad rollout.
</requirements>

<data_model>
## Shared Recommendation Model

Create a shared web type/model called `SurfWindowRecommendation`:

```ts
type SurfWindowRecommendation = {
  id: string;
  beachId: string;
  beachSlug: string;
  beachName: string;
  regionName?: string;

  startTime: string;
  endTime: string;
  localLabel: string;

  score: number;
  verdict: "Worth it" | "Maybe" | "Skip";
  headline: string;

  waveHeightFt?: number;
  waveMinFt?: number;
  waveMaxFt?: number;
  swellDirection?: string;
  swellPeriodSec?: number;

  windMph?: number;
  windDirection?: string;
  windQuality?: "offshore" | "cross-shore" | "onshore" | "variable" | "unknown";

  tideLabel?: string;
  tideTrend?: "rising" | "falling" | "high" | "low" | "unknown";

  bestFor: Array<
    | "beginner"
    | "intermediate"
    | "advanced"
    | "longboard"
    | "shortboard"
    | "fish"
    | "mid-length"
    | "foamie"
    | "dawn-patrol"
    | "sunset-session"
  >;

  reasons: {
    positives: string[];
    watchouts: string[];
    dataNotes: string[];
  };

  confidence: {
    level: "low" | "medium" | "high";
    label: string;
    explanation: string;
    sourceFlags?: {
      hasModel?: boolean;
      hasBuoy?: boolean;
      hasTide?: boolean;
      hasCam?: boolean;
      hasUserReports?: boolean;
      mlSkipped?: boolean;
    };
  };

  appDeepLink: string;
  universalLink: string;
  canonicalWebUrl: string;
};
```

Recommendation logic:

1. Take existing forecast rows for a beach or region and return the top 3
   recommended surf windows.
2. Prefer 14 days if the data exists; use 7 days when only 7 days exists.
3. Use deterministic scoring for v1. Do not introduce a new ML model.
4. Score only surf-relevant inputs: wave height range, swell period, swell
   direction fit if available, wind direction/strength, tide phase/trend, skill
   fit, board fit, known spot behavior/local intel if available, and confidence
   or buoy alignment if available.
5. Do not overclaim sources. If buoy, cam, tide, or user report data is missing,
   the UI must omit that source or label the recommendation as model-only.
</data_model>

<subphases>
## Addendum Phase Set

### 14-A: Guardrails, data inventory, and template safety

Goal: Make sure Session Intelligence can be added safely without hurting
existing SEO pages, app CTAs, or page performance.

Work:

1. Add implementation notes that Ahrefs is sampled, the crawl cap is fixed, and
   findings must be confirmed against GSC, Vercel, PostHog, template review, or
   code inspection.
2. Inventory eligible templates: spot page, regional forecast page, homepage,
   city/region pages, best-time pages, beginner pages, longboard pages, dawn
   patrol pages, sunset session pages, tide-window pages, less-crowded pages,
   water-temp pages, tide pages, and forecast-accuracy page.
3. For each eligible template, document forecast horizon, tide data, water-temp
   data, buoy data, cam data, user reports, local spot intel, and existing app
   CTA/deep-link support.
4. Profile or avoid blockers before adding heavier UI: `/for-surf-schools`, tide
   page fetches, water-temp page fetches, render time, forecast fetch, tide
   fetch, water-temp fetch, cache hit/miss, and recommendation runtime.
5. Validate structured data on one tide page, one water-temp page, one US spot
   page, and one non-US/Baja spot page. Fix shared helpers, not one URL at a
   time.

Exit criteria:

- Guardrail note exists.
- Eligible templates are documented.
- Data availability is clear by template.
- Slow template risks are profiled or mitigated.
- Structured-data issues are not made worse.
- Existing canonical URLs are unchanged.

### 14-B: Shared recommendation primitive

Goal: Create the reusable data model and deterministic recommendation helper.

Exit criteria:

- The helper returns top 3 windows for a beach with forecast rows.
- Each recommendation includes score, verdict, headline, wave/wind/tide summary,
  best-for tags, reasons, confidence, app deep link, universal link, and
  canonical web URL.
- Missing tide, buoy, cam, or report data is handled gracefully.
- Unit tests cover normal scoring, no tide data, no buoy data, sparse forecast
  rows, only 7-day horizon, low-confidence output, and no recommendation
  available.

### 14-C: Reusable UI components

Goal: Build reusable UI once, then drop it into existing surfaces.

Components:

- `BestSurfWindows`: top 3 windows with local time, score, verdict,
  wave/wind/tide summary, best-for tags, confidence badge, "Open this window in
  Quiver", and "Why this call?"
- `WhyThisCall`: accessible drawer/modal/accordion with positives, watchouts,
  confidence, and source chips. Must support keyboard focus, aria labels,
  escape-to-close if modal, and screen-reader-readable labels.
- `SourceConfidenceBadge`: examples include "High - buoy + model",
  "Medium - model + tide", "Low - sparse data", and "Model only". Never invent
  unavailable sources.
- `AppDeepLinkCTA`: generate exact beach/window deep links and universal links.
  Use existing app-link config if available; otherwise fall back safely to the
  App Store without breaking web rendering.

Exit criteria:

- Components render at 360px, 390px, 412px, tablet, and desktop.
- Components work with 1, 2, or 3 recommendations.
- Components work with missing tide, buoy, cam, or user-report data.
- Component tests exist for `BestSurfWindows` and `WhyThisCall`.
- `SourceConfidenceBadge` never displays sources that are not present.

### 14-D: Pilot on limited surfaces

Goal: Prove Session Intelligence on a small surface before rollout.

Pilot surfaces:

- One major spot page such as `/ca/san-diego/blacks`.
- One regional forecast page such as `/forecast` or `/forecast/santa-cruz`.
- Homepage compact module: "Find your next best surf window."

Exit criteria:

- A user visiting the pilot spot page immediately sees top 3 upcoming surf
  windows.
- Each window explains why.
- Regional forecast page shows "Best windows this week."
- Homepage module renders safely without user location.
- Existing spot/forecast content is not removed.
- App CTA still works.
- No route becomes noticeably slower.

### 14-E: SEO-safe rollout to intent pages

Goal: Improve SEO and click-around by adding surfer decision value, not by
chasing keywords blindly.

Rollout surfaces:

- Longboard, beginner, dawn patrol, sunset session, tide-window, less-crowded,
  city best-time, selected water-temp, selected tide, and selected
  high-impression spot pages.

Rules:

- Use `BestSurfWindows` only where it directly satisfies page intent.
- Do not hide all useful info behind sign-in.
- Gate alerts/personalization if needed, not the basic answer.
- Preserve each page's primary intent.
- Do not create duplicate thin pages.
- Enrich templated pages with actual local conditions, spot behavior, best
  windows, and contextual internal links.

Water-temp allowlist:

- `/water-temp/huntington-beach`
- `/water-temp/santa-cruz`
- `/water-temp/santa-monica`
- `/water-temp/kailua-kona`
- `/ca/del-mar/del-mar/water-temp`
- `/nj/long-branch/long-branch-long-branch-nj/water-temp`

Water-temp pages should add surfer decision value: wetsuit guidance, comfort
rating, warmer/colder than recent average if available, nearby water temps, tide
link, spot link, forecast link, "save/open in Quiver" CTA, and optional best
surf window module when it fits. Do not stuff surf-report keywords into
water-temp titles.

Spot enrichment starter:

- `/ca/malibu/malibu-surfrider-first-point-malibu-ca`

Add best windows, tide window, wind/swell note, water-temp link,
board/skill fit, crowd/behavior note if available, nearby Malibu spots, and a
link to `/surf-report/malibu-today` if that page owns the "should you surf
Malibu today?" intent. Do not cannibalize `/surf-report/malibu-today`.

Best-time intent split starter:

- `/best-time-to-surf/la-jolla`
- `/best-time-to-surf/westport`
- `/best-time-to-surf/cocoa-beach`

Keep best-time pages focused on seasonal/time-of-day guidance. Add a "Looking
for today's surf report?" module linking to the best live-condition page or spot
page. Create a new surf-report page only if it is meaningfully distinct and not
thin.

Internal links:

- Spot page -> tide page.
- Spot page -> water-temp page.
- Spot page -> dawn patrol page.
- Spot page -> longboard/beginner page where relevant.
- Intent page -> exact spot pages.
- Water-temp page -> tide, spot, forecast, nearby water temps.
- Tide page -> spot, water temp, best time.
- Forecast page -> best spot/window.

Exit criteria:

- Rollout happens only after pilot validation.
- Page intent remains clean.
- No canonical changes.
- No unsupported data-source claims.
- CTR and multi-page behavior are measured before/after.
- Sister pages do not lose impressions because of cannibalization.

### 14-F: Forecast Accuracy / trust page

Goal: Upgrade `/forecast-accuracy` into a visible proof/trust page.

Work:

1. If live metrics exist, render beach, Quiver MAE, NOAA baseline MAE,
   improvement percentage, validated-pair count, last updated, and confidence.
2. If metrics are not ready, render graceful "building" rows and do not claim
   accuracy improvements.
3. Add sections for how the score works, data sources used, when Quiver trusts
   buoy/observed data, known limits, and last updated.
4. Reuse the same confidence language as `BestSurfWindows`.

Exit criteria:

- `/forecast-accuracy` never looks empty.
- Accuracy claims are backed by data.
- Missing metrics are labeled as building/in-progress.
- Confidence/source language matches recommendation UI.

### 14-G: Domain, app links, analytics, and QA

Goal: Make web-to-native handoff measurable and reliable.

Domain/app links:

- Verify canonical web domain: `www.quiversurf.app`.
- Add or validate `apple-app-site-association`, `assetlinks.json`, universal
  links for `/app/spot/:slug?window=:id`, and App Store fallback.
- Do not ship placeholder team IDs or certificate fingerprints.

Analytics events:

- `surf_window_impression`
- `surf_window_click`
- `why_this_call_opened`
- `app_deeplink_clicked`
- `forecast_accuracy_table_viewed`
- `save_alert_clicked`
- `seo_intent_page_window_clicked`

Also measure GSC CTR, GSC average position, GSC impressions, multi-page rate,
app CTA clicks, app deep-link conversion, bounce rate, and route performance
before/after.

QA matrix:

- Mobile 360px, 390px, 412px, tablet, and desktop.
- No forecast data, 7-day only, 14-day available.
- No buoy, no tide, no cam, no user reports.
- Model only and low confidence.
- App not installed, app link fallback.
- Canonical tags intact.
- Schema still valid.
- Slow route regression check.
</subphases>

<acceptance>
## Phase Acceptance Criteria

1. A user visiting a major spot page can immediately see the top 3 upcoming surf
   windows.
2. Each recommended window has score, verdict, wave/wind/tide summary, best-for
   tags, and confidence.
3. Each score can expand into "Why this call?" with positives, watchouts,
   confidence, and source chips.
4. The same recommendation module works on spot, forecast, longboard, beginner,
   dawn patrol, sunset, tide, and city/intent pages.
5. The forecast-accuracy page never looks empty.
6. App deep links are generated for exact spot/window context.
7. Mobile layouts work at 360px, 390px, 412px, tablet, and desktop.
8. Unsupported source claims are not displayed.
9. Existing routes, SEO pages, canonicals, schema, and app CTAs continue to work.
10. Unit tests and component tests are added.
11. No paid Ahrefs crawl expansion is required.
12. Rollout is measurable and reversible.
</acceptance>

<suggested_order>
## Suggested Implementation Order

1. Guardrail note plus template/data inventory.
2. Profile slow templates and avoid adding recommendation UI to routes that are
   still too slow.
3. Add `SurfWindowRecommendation` type and deterministic helper.
4. Build `BestSurfWindows`, `WhyThisCall`, `SourceConfidenceBadge`, and
   `AppDeepLinkCTA`.
5. Add to one spot page and one regional forecast page.
6. Add homepage compact module.
7. Roll into selected intent SEO pages.
8. Run the water-temp zero-click allowlist test.
9. Enrich Malibu spot page without cannibalizing Malibu surf-report intent.
10. Fix La Jolla/Westport/Cocoa Beach best-time intent split.
11. Upgrade forecast-accuracy page.
12. Add analytics and tests.
13. Validate mobile, route performance, schema, canonical tags, and app-link
    files.
</suggested_order>

<validation>
## Default Validation For Future Implementation

- Focused unit tests for helper scoring and edge cases.
- Component tests for `BestSurfWindows` and `WhyThisCall`.
- Scoped ESLint for touched files.
- `yarn typecheck`.
- Targeted Playwright for pilot surfaces and mobile breakpoints.
- Schema/canonical checks on sampled tide, water-temp, US spot, and non-US/Baja
  spot pages.
- Route performance comparison before/after for any touched slow template.
</validation>

<rollback>
## Rollback

Keep each slice independently reversible. The pilot should be behind a narrow
surface allowlist so `BestSurfWindows` can be removed from pilot routes without
reverting shared helper work. Do not change canonical URLs as part of rollback.
</rollback>

---

*Phase: 14-Guardrails Data Inventory And Template Safety*
*Context gathered: 2026-06-01*
