# Phase 18 SEO Rollout Measurement

Owner: Quiver Web
Created: 2026-06-02

## Scope

Phase 18 is an allowlisted SEO-safe Session Intelligence rollout. Local QA can
prove implementation readiness, but it cannot claim SEO lift until Search
Console and product analytics have dated before/after data.

## Sampled Routes

- Generic intent: `/longboard/san-diego`
- Beginner intent: `/beginner/huntington-beach`
- Utility intent: `/tide/san-diego`
- Water temperature: `/water-temp/huntington-beach`, `/water-temp/santa-cruz`
- Sun-time intent: `/dawn-patrol/san-diego`
- Best-time allowlist: `/best-time-to-surf/la-jolla`, `/best-time-to-surf/westport`, `/best-time-to-surf/cocoa-beach`
- Spot allowlist: `/ca/malibu/malibu-surfrider-first-point-malibu-ca`, `/ca/san-diego/blacks`
- Malibu sister page: `/surf-report/malibu-today`

## Before And After Windows

- Before window: 28 full days ending the day before Phase 18 production deploy.
- After window: 28 full days beginning the day after Phase 18 production deploy.
- Exclude deploy day from both windows.
- If Google Search Console data is incomplete, wait until the latest day in the
  after window is finalized before making CTR, position, impression, or click
  claims.
- Record exact dates in every report, for example `2026-06-03 through 2026-06-30`.

## Before Baseline Captured 2026-06-02

Source windows:

- GSC page data: `2026-05-03` through `2026-05-30`. GSC data lags by 2-3 days, so this is the latest complete 28-day window available on `2026-06-02`.
- PostHog web behavior data: `2026-05-03T00:00:00Z` through `2026-05-30T23:59:59Z`.
- PostHog filter: web only, `properties.$app_namespace IS NULL` and `coalesce(properties.$is_emulator, false) = false`.

Baseline caveats:

- GSC page-level rows are the source of truth for sampled route clicks, impressions, CTR, and average position.
- GSC query, device, and country exports are thresholded/anonymized and may not reconcile to page-level totals. Use those splits directionally.
- PostHog page sessions use `$session_id` with `browser_session_id` fallback because custom `page_view` has sparse `$session_id` coverage.
- No SEO lift, CTR lift, or cannibalization outcome is claimed here. This is only the before snapshot.

### GSC Sampled Page Baseline

Aggregate sampled-route baseline: 30 clicks, 9,891 impressions, 0.30% CTR, average position 10.0.

| Route | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| `/longboard/san-diego` | 2 | 43 | 4.65% | 8.6 |
| `/beginner/huntington-beach` | 0 | 42 | 0.00% | 9.7 |
| `/tide/san-diego` | 0 | 319 | 0.00% | 31.3 |
| `/water-temp/huntington-beach` | 13 | 3,872 | 0.34% | 7.4 |
| `/water-temp/santa-cruz` | 4 | 2,110 | 0.19% | 9.6 |
| `/dawn-patrol/san-diego` | 0 | 0 | 0.00% | n/a |
| `/best-time-to-surf/la-jolla` | 0 | 954 | 0.00% | 12.4 |
| `/best-time-to-surf/westport` | 8 | 280 | 2.86% | 16.5 |
| `/best-time-to-surf/cocoa-beach` | 1 | 529 | 0.19% | 7.1 |
| `/ca/malibu/malibu-surfrider-first-point-malibu-ca` | 1 | 1,343 | 0.07% | 9.5 |
| `/ca/san-diego/blacks` | 1 | 183 | 0.55% | 23.4 |
| `/surf-report/malibu-today` | 0 | 216 | 0.00% | 7.9 |

Directional GSC device split for sampled routes:

| Device | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| Mobile | 5 | 1,964 | 0.25% | 8.5 |
| Desktop | 3 | 1,608 | 0.19% | 17.2 |
| Tablet | 0 | 21 | 0.00% | 6.1 |

Directional GSC country split for sampled routes:

| Country | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| USA | 8 | 3,399 | 0.24% | 12.2 |
| GBR | 0 | 18 | 0.00% | 27.4 |
| AUS | 0 | 15 | 0.00% | 19.1 |
| CAN | 0 | 15 | 0.00% | 16.7 |
| BRA | 0 | 13 | 0.00% | 15.8 |

Selected query examples from direct page-filtered GSC exports:

- `/water-temp/huntington-beach`: `ocean temperature huntington beach` had 2 clicks, 53 impressions, 3.77% CTR, position 8.7; `huntington beach water temp` had 1 click, 516 impressions, 0.19% CTR, position 7.7.
- `/water-temp/santa-cruz`: `santa cruz ocean temperature` had 1 click, 40 impressions, 2.50% CTR, position 11.6; `water temp santa cruz ca` had 1 click, 24 impressions, 4.17% CTR, position 8.5.
- `/ca/malibu/malibu-surfrider-first-point-malibu-ca`: `malibu first point surf conditions` had 1 click, 1 impression, 100.00% CTR, position 11.0.
- `/surf-report/malibu-today`: top query examples were all zero-click, led by `malibu first point live wind reading surf report now` with 7 impressions, position 9.3.

### PostHog Sampled Route Baseline

Aggregate sampled-route baseline: 304 page events, 253 people, 258 sessions, 14 multi-page sessions. No `cta_click`, `ios_app_cta_view`, or `ios_app_cta_click` events were recorded on the sampled routes during this before window.

| Route | Page events | People | Sessions | Multi-page sessions | Signup CTA views |
|---|---:|---:|---:|---:|---:|
| `/ca/san-diego/blacks` | 169 | 161 | 161 | 1 | 1 |
| `/water-temp/huntington-beach` | 45 | 32 | 34 | 2 | 7 |
| `/best-time-to-surf/westport` | 26 | 21 | 21 | 2 | 13 |
| `/longboard/san-diego` | 12 | 8 | 11 | 1 | 4 |
| `/water-temp/santa-cruz` | 12 | 5 | 5 | 1 | 4 |
| `/best-time-to-surf/cocoa-beach` | 11 | 11 | 11 | 1 | 2 |
| `/tide/san-diego` | 7 | 5 | 5 | 2 | 1 |
| `/best-time-to-surf/la-jolla` | 7 | 5 | 5 | 2 | 0 |
| `/ca/malibu/malibu-surfrider-first-point-malibu-ca` | 6 | 1 | 1 | 1 | 2 |
| `/beginner/huntington-beach` | 5 | 3 | 3 | 1 | 3 |
| `/surf-report/malibu-today` | 4 | 2 | 2 | 1 | 2 |
| `/dawn-patrol/san-diego` | 0 | 0 | 0 | 0 | 0 |

PostHog event coverage for the before window:

| Event | First event | Last event | Events | People |
|---|---|---|---:|---:|
| `signup_cta_view` | 2026-05-03 | 2026-05-30 | 3,158 | 1,607 |
| `page_view` | 2026-05-03 | 2026-05-30 | 2,955 | 1,852 |
| `auth_modal_opened` | 2026-05-03 | 2026-05-30 | 90 | 63 |
| `signup_cta_click` | 2026-05-03 | 2026-05-30 | 22 | 19 |
| `signup_success` | 2026-05-03 | 2026-05-30 | 21 | 20 |
| `cta_click` | 2026-05-10 | 2026-05-27 | 6 | 4 |
| `$pageview` | 2026-05-16 | 2026-05-22 | 928 | 283 |
| `public_page_view` | 2026-05-18 | 2026-05-30 | 251 | 160 |
| `ios_app_cta_view` | 2026-05-25 | 2026-05-30 | 96 | 39 |
| `ios_app_cta_click` | 2026-05-25 | 2026-05-26 | 2 | 2 |

## GSC Metrics

For each sampled route, export:

- CTR
- average position
- impressions
- clicks
- query
- page
- country
- device
- date

Required comparisons:

- Page-level before vs after CTR, average position, impressions, and clicks.
- Query-level changes for the highest-impression queries per page.
- Device split for mobile vs desktop movement.
- Country split, with United States called out separately.

## PostHog And Product Analytics

Use existing page and CTA events. Compare:

- `page_view` count by `pathname`.
- Multi-page behavior: same anonymous or authenticated visitor viewing a sampled
  route and then another internal surf-planning route in the same session.
- Internal-link clicks where available through existing `cta_click` or link
  tracking metadata.
- App CTA clicks from Session Intelligence window cards where rendered.
- Signup or auth-modal events only as downstream context, not as the primary SEO
  metric.

Multi-page behavior fields to preserve in exports:

- `distinct_id`
- `session_id` or equivalent session key when available
- `pathname`
- `referrer`
- `event`
- `timestamp`
- CTA `source` or `surface` metadata when present

## Cannibalization Checks

Malibu enrichment must not steal the surf-report intent from
`/surf-report/malibu-today`.

For `/ca/malibu/malibu-surfrider-first-point-malibu-ca` and
`/surf-report/malibu-today`, compare:

- GSC impressions before and after.
- GSC clicks before and after.
- CTR before and after.
- average position before and after.
- Top queries containing `malibu surf report`, `malibu today`, `surfrider surf report`, or close variants.

Do not call Phase 18 successful if the Malibu spot page gains impressions while
`/surf-report/malibu-today` loses material surf-report impressions or clicks
without an offsetting product reason.

## Readiness Versus Outcome

Release-ready means local checks pass for:

- Public basic answers.
- Canonical links.
- JSON-LD script presence.
- Crawlable internal links.
- No unsupported source claims.
- Water-temp pages staying water-temperature and wetsuit focused.
- Malibu spot links avoiding `/surf-report/malibu-today` as the window URL.

SEO outcome means dated GSC and PostHog evidence shows improvement or neutrality
after rollout. Do not merge those claims into release notes until the after
window is complete.
