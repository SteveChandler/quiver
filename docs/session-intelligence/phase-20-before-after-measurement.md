# Phase 20 Before/After Measurement

Owner: Quiver Web
Created: 2026-06-02

## Scope

Phase 20 makes Session Intelligence app-link handoff measurable. This document
records the before baseline and the after-check protocol for GSC, PostHog,
Vercel Web Analytics, app CTA clicks, app deep-link conversion, multi-page
behavior, bounce behavior, and route performance.

No SEO lift, conversion lift, engagement lift, or performance improvement is
claimed in this document.

## Source Windows

- GSC baseline: `2026-05-03` through `2026-05-30`.
- GSC capture time: `2026-06-02T16:08Z`.
- GSC lag: Google Search Console data has a 2-3 day lag; `2026-05-30` was the
  latest complete date available on `2026-06-02`.
- PostHog baseline: `2026-05-26T16:08:50Z` through
  `2026-06-02T16:08:50Z`.
- Vercel baseline: production, `2026-05-26T16:08:50Z` through
  `2026-06-02T16:08:50Z`.
- PostHog web filters: `properties.$host = 'www.quiversurf.app'`,
  `properties.$app_namespace IS NULL`, and
  `coalesce(properties.$is_emulator, false) = false`.

## Commands Run

```bash
/tmp/gsc-venv/bin/python3 scripts/gsc-stats.py
yarn seo:export:posthog --output docs/session-intelligence/phase-20-posthog-export.json
yarn seo:export:vercel --output docs/session-intelligence/phase-20-vercel-export.json
node ~/.codex/skills/vercel-web-analytics/scripts/pull-web-analytics.mjs --range 7d --markdown
```

The PostHog and Vercel JSON exports succeeded, but the generated raw files were
not retained because raw route rows included an invite-token URL. Sanitized
values are recorded below.

## GSC Baseline

Google Search Console overview for `2026-05-03` through `2026-05-30`:

| Metric | Value |
|---|---:|
| Clicks | 179 |
| Impressions | 44,028 |
| CTR | 0.41% |
| Average position | 10.0 |

Top GSC pages by clicks:

| Page | Clicks | Impressions | CTR | Average position |
|---|---:|---:|---:|---:|
| `/water-temp/huntington-beach` | 13 | 3,872 | 0.34% | 7.4 |
| `/best-time-to-surf/westport` | 8 | 280 | 2.86% | 16.5 |
| `/` | 6 | 91 | 6.59% | 5.5 |
| `/best-time-to-surf/surfside-beach` | 4 | 97 | 4.12% | 6.3 |
| `/water-temp/santa-cruz` | 4 | 2,110 | 0.19% | 9.6 |

Device split:

| Device | Clicks | Impressions | CTR | Average position |
|---|---:|---:|---:|---:|
| Mobile | 120 | 17,231 | 0.70% | 8.5 |
| Desktop | 58 | 26,650 | 0.22% | 11.1 |
| Tablet | 1 | 147 | 0.68% | 8.4 |

Index coverage context:

| Metric | Value |
|---|---:|
| Sitemap URLs | 2,017 |
| URLs with GSC impressions | 976 |
| URLs without GSC impressions | 1,041 |
| Impression coverage | 48.39% |

GSC blockers: none for the dashboard-level baseline. Route-specific after
claims still require a production deploy timestamp and completed after windows.

## PostHog Baseline

The Phase 20 production-host event baseline for the new measurement events is
zero. One broad, unfiltered `surf_window_impression` count appeared from
non-production-host activity on `2026-06-02`, so it is excluded from the
production before baseline.

| Event | Production-host events | People | Before-state note |
|---|---:|---:|---|
| `surf_window_impression` | 0 | 0 | Not deployed to production. |
| `surf_window_click` | 0 | 0 | Not deployed to production. |
| `why_this_call_opened` | 0 | 0 | Not deployed to production. |
| `app_deeplink_clicked` | 0 | 0 | Not deployed to production. |
| `forecast_accuracy_table_viewed` | 0 | 0 | Not deployed to production. |
| `save_alert_clicked` | 0 | 0 | Not deployed to production. |
| `seo_intent_page_window_clicked` | 0 | 0 | Not deployed to production. |

Existing app CTA and page events in the same PostHog window:

| Event | Events | People |
|---|---:|---:|
| `ios_app_cta_view` | 91 | 39 |
| `ios_app_cta_click` | 3 | 3 |
| `iphone_app_banner_view` | 15 | 13 |
| `iphone_app_banner_click` | 0 | 0 |
| `page_view` | 563 | 330 |
| `public_page_view` | 94 | 66 |

Derived app CTA baseline:

- Event-level iOS CTA click rate: `3 / 91 = 3.30%`.
- Phase 20 app deep-link conversion: `0`, because `app_deeplink_clicked` is not
  deployed on production yet.
- Native app-installed universal-link opens were not measured in this slice.

PostHog session behavior baseline:

| Metric | Value |
|---|---:|
| Sessions | 394 |
| People | 330 |
| Multi-page sessions | 61 |
| Multi-page rate | 15.48% |

PostHog bounce caveat: the `sessions.$is_bounce` query returned `0` bounce
sessions and `0.0` average pageviews per session for this window, which conflicts
with Vercel Web Analytics. Use Vercel as the bounce source until PostHog session
field coverage is reconciled.

## Vercel And Performance Baseline

Vercel Web Analytics production baseline:

| Metric | Value |
|---|---:|
| Online users at pull time | 1 |
| Visitors | 667 |
| Page views | 959 |
| Adjusted page views | 820 |
| Bot page views | 139 |
| Bounce rate | 81% |

Top Vercel pages by views:

| Page | Views |
|---|---:|
| `/` | 87 |
| `/map` | 45 |
| `/privacy` | 39 |
| `/ca/san-diego/torrey-pines-state-beach/water-temp` | 18 |
| `/auth/sign-up` | 16 |
| `/beginner/long-island` | 12 |
| `/forecast/santa-cruz` | 7 |
| `/forecast` | 6 |

Device traffic:

| Device | Views |
|---|---:|
| Desktop | 635 |
| Mobile | 278 |
| Unknown | 42 |
| Tablet | 4 |

Route-performance baseline from PostHog `$web_vitals`, same production-host
window:

| Route | Samples | p75 LCP | p75 INP | p75 CLS |
|---|---:|---:|---:|---:|
| `/` | 53 | 2,877 ms | 280 ms | 0.056 |
| `/forecast/santa-cruz` | 5 | 2,652 ms | n/a | n/a |

Route-performance blockers:

- Vercel Web Analytics does not provide route-level LCP, INP, or CLS in the
  local export script.
- The Vercel MCP tools available in this session expose project/deployment/docs
  reads, not Speed Insights metric export.
- `/forecast`, `/ca/san-diego/blacks`, and `/forecast-accuracy` had no
  production-host `$web_vitals` samples in the fixed PostHog baseline window.

## After-Check Protocol

Use the exact production deploy timestamp as `D`. Exclude deploy day from before
and after comparisons. Do not include Preview, localhost, emulator, or native
simulator traffic in production web baselines.

3-day check:

- Window: `D+1` through `D+3`.
- Sources: PostHog and Vercel can be checked immediately after the window ends.
- GSC should be treated as pending until the 2-3 day lag clears.
- Required metrics: Phase 20 event existence, app CTA clicks, app deep-link
  clicks, multi-page rate, Vercel bounce rate, page views, and any available
  `$web_vitals` samples.

7-day check:

- Window: `D+1` through `D+7`.
- Sources: PostHog, Vercel, and GSC once lagged data is finalized.
- Required metrics: GSC CTR, average position, impressions, clicks, PostHog
  multi-page rate, app CTA click rate, app deep-link conversion, Vercel bounce
  rate, Vercel page views, and route-performance p75 LCP/INP/CLS.

28-day check:

- Window: `D+1` through `D+28`.
- Sources: GSC, PostHog, Vercel, and native universal-link evidence if available.
- Required metrics: same as the 7-day check, plus page/query/device splits and
  any sibling-page cannibalization checks for SEO routes touched by the rollout.

## Claim Rules

- Do not claim GSC CTR, average position, impression, or click lift until the
  after window is complete and GSC lag has cleared.
- Do not claim app deep-link conversion until `app_deeplink_clicked` is observed
  on production host traffic and native app-open evidence is checked separately.
- Do not claim bounce improvement from PostHog until its session bounce fields
  reconcile with Vercel.
- Do not claim route performance improvement for routes without before and after
  `$web_vitals` samples.
