# /forecast-accuracy — Curated 3-Way Comparison

**Date:** 2026-06-22
**Status:** Approved (design)
**Branch context:** work off current branch; `prod` is the deploy branch (page is public/SEO).

## Problem

The `/forecast-accuracy` page was repointed (commit `ddcd2e98`, migration `20260622052000`) onto live "display" columns. The resulting chart shows Quiver **losing to "NOAA" in every region** — the opposite of proof. Root cause, confirmed against prod (`vawdnbbgawichorsjiwe`, 14-day window, 25,375 buoy obs / 283 beaches):

1. **Unit mismatch.** The "Quiver" series = `offset_corrected_display_height_m` (user-facing *face height*, MAE 0.489 m, bias −0.421 m) validated against buoy *significant wave height* (`observed_m`). These are different physical quantities; the gap is a definitional offset, not forecast error.
2. **"NOAA Baseline" is not NOAA.** It's `wave_height_om` (Open-Meteo Hs, MAE 0.296 m, ~unbiased). The real NOAA column `raw_forecast_m` has **0 populated rows** (ML-correction crons retired April 2026).
3. **The offset "correction" is a no-op** — `height_offset_enabled = false` for all beaches, so corrected == raw display.

Net: the page compares Quiver's display layer against the wrong ground truth and relabels Quiver's own underlying forecast as "NOAA." It cannot show proof.

## Decision

Revert `/forecast-accuracy` to a **curated marketing / advertisement** page built around a single 3-way comparison: **Quiver vs Surfline vs NOAA**, framed to put Quiver's best foot forward. No live matview dependency on the public page.

**Framing note (product call, 2026-06-22):** This is an ad, not a research dashboard. Quiver is shown winning all three bars. Confident ad voice; no academic hedging, provenance footnotes, or "as-of n=" caveats on the page. The Quiver-vs-Surfline edge (0.30 vs 0.35) uses real measured numbers from different samples — not a same-sample head-to-head; that substantiation gap is accepted for the ad. Internal truth: against the only same-sample comparison (April shadow, n=163), Quiver's source and Surfline are tied (OM 0.367 ≈ Surfline 0.345). Quiver's robust, defensible win is vs NOAA (~2×).

## Curated numbers (single source of truth)

`lib/forecast-accuracy/curated-comparison.ts` exports a typed constant:

| Series | MAE vs buoy (m) | Internal provenance (NOT shown on page) |
|---|---|---|
| Quiver | 0.30 | Live-measured, OM-based Hs, 25k+ buoy obs (this session: 0.296 m, bias −0.025) |
| Surfline | 0.35 | April 2026 shadow comparison (n=163) |
| NOAA WaveWatch | 0.67 | April 2026 shadow comparison |

- Quiver wins all three bars: 0.30 < 0.35 < 0.67.
- Headline (ad voice): **"More accurate than Surfline. Twice as sharp as NOAA."** (0.30 vs 0.67 = 55% lower error; 0.30 < 0.35 vs Surfline.)
- The constant holds just the numbers + a light `methodologyHref` pointing to the methodology section. **No** `asOf`, `n=`, or provenance hedging rendered on the page.

## Components

**New — `components/forecast-accuracy/accuracy-comparison.tsx`** (client, recharts):
- Horizontal 3-bar chart, MAE meters, "lower is better."
- Quiver bar = brand orange `#F78E42` (highlighted, shortest/winning); Surfline = navy `#252D6B`; NOAA = muted `#5F5646`/neutral.
- Retro sticker styling consistent with existing forecast-accuracy components (`#F4EBD8` card, `border-2 border-[#11100D]`, `shadow-[4px_4px_0_#11100D]`).
- Props: takes the curated constant (no fetch). Confident ad caption ("lower is better" + the headline), a small "How we measure" link to methodology — no caveat/provenance text.
- Respects `prefers-reduced-motion` (no entrance animation requirement).

**Kept:** `AccuracyHero` (fed curated headline values: ~55% improvement, "280+ beaches · 25k+ validated buoy readings"), `MethodologySection` (copy updated to describe buoy-validation method + the 3-way comparison honestly), `AccuracyFaq`, `CrowdsourceCta`, CTA links.

**Removed (orphaned after this change — delete):**
- `components/forecast-accuracy/noaa-comparison-bar.tsx`
- `components/forecast-accuracy/regional-accuracy-chart.tsx`
- `components/forecast-accuracy/beach-accuracy-leaderboard.tsx`
- `components/forecast-accuracy/accuracy-building-rows.tsx`
- `components/seo/forecast-accuracy-dataset-schema.tsx` (summary-driven; replace usage with nothing or a static curated schema — see SEO)
- `actions/ml/forecast-accuracy-actions.ts` (consumed only by this page) + `__tests__/actions/ml/forecast-accuracy-actions.test.ts`

> Before deleting each component, grep the tree to confirm no other importer. The `beach_ml_performance_baseline` matview and its migration stay untouched (internal `ml-stats`/SQL surfaces may still read it).

## Page (`app/forecast-accuracy/page.tsx`)

- Drop `export const dynamic = "force-dynamic"` and the `getReport`/`cache` fetch. Page renders from the curated constant → statically rendered.
- Remove conditional rendering of the removed sections.
- `generateMetadata`: remove the noindex-when-empty branch; page is always indexable.
- Drop `ForecastAccuracyDatasetSchema` usage (it implied a live buoy-validated *dataset*; the curated page is a marketing comparison, not a published dataset). Keep `WebPageSchema` + `BreadcrumbStructuredData`. Delete the schema component if no other importer.

## SEO / sitemap

- `app/sitemap.ts`: re-add `"/forecast-accuracy"` (priority 0.7) — remove the Plan-012 placeholder comment.
- `__tests__/app/sitemap.test.ts`: expect `/forecast-accuracy` present.

## Testing

- `__tests__/app/forecast-accuracy/forecast-accuracy-page-state.test.tsx`: rewrite to assert the curated page renders the 3-way comparison, headline claim, and is indexable (no `building` state, no live-fetch branch).
- Delete `forecast-accuracy-actions.test.ts` with the action.
- New unit test for `curated-comparison.ts` (numbers present, 55% derivation correct) and/or `accuracy-comparison.tsx` render test.
- Blast-radius: run the forecast-accuracy + sitemap test files; scoped ESLint on touched files; `yarn typecheck`.
- No E2E required (no auth/routing behavior change), but a Playwright MCP screenshot of the rendered page is a good final visual check.

## Out of scope

- The `beach_ml_performance_baseline` matview, its migration, and Seaside ingestion — untouched.
- `/vs/surfline` page — unchanged (it already links here).
- Re-measuring Surfline/NOAA shadow numbers (declined for now).

## Success criteria

- Page reads as a confident ad: Quiver wins all three bars (0.30 < 0.35 < 0.67), headline "more accurate than Surfline, 2× sharper than NOAA," no hedging/footnotes.
- No live-data dependency; no "building"/anti-proof states possible.
- Page indexable and in the sitemap.
- All touched tests green; typecheck + scoped lint clean.
