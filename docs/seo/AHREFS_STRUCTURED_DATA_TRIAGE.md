# Ahrefs Structured Data Triage

Last updated: 2026-06-22

## Latest Ahrefs Crawl

Source: Ahrefs Site Audit for Quiversurf, crawl selector `current=22-06-2026T201033`.

| Metric | Value |
| --- | ---: |
| Health Score | 99 |
| Crawled URLs | 355 |
| Internal pages crawled | 306 |
| External URLs crawled | 2 |
| Resources crawled | 47 |
| Links found | 9,132 |
| Links crawled | 3,367 |
| Links uncrawled | 5,765 |
| Total issue instances | 1,121 |
| Errors | 2 |
| Warnings | 90 |
| Notices | 1,029 |
| Actual issue types | 16 |
| New issue types | 3 |

Ahrefs still warns that the crawl reached the maximum internal page cap, so counts should be treated as sampled crawl evidence, not full-site totals.

## Status

- Template-level water-temperature coverage was updated to emit `Dataset` JSON-LD on dedicated city water-temp pages, matching the existing beach water-temp subpage pattern.
- Beach water-temp pages already emit `Dataset`, breadcrumb, WebPage, and FAQ structured data through the shared crawlable subpage renderer.
- The latest Ahrefs crawl provides exact structured-data issue names and sample URLs. The unresolved rows are no longer blocked on an Ahrefs export.
- 2026-06-22 implementation pass removes app-only properties from Organization schema, splits beach `Place` and `SportsActivityLocation` JSON-LD, removes the App Store `mt=8` redirect parameter, shortens the two long meta descriptions, adds Mexico hub sitemap/IndexNow coverage, and keeps SoftwareApplication rating/review warnings deferred until source-backed data exists.

## Structured Data Findings

| Ahrefs issue | Current count | Crawl movement | Sample URLs | Likely owner |
| --- | ---: | --- | --- | --- |
| `Structured data has schema.org validation error` | 304 | 34 lost from filter results | `/`, `/features`, `/forecast-accuracy`, `/beaches/usa`, `/about`, `/map`, `/vs/surfline`, sampled beach pages | `lib/constants/seo.ts`, `components/seo/structured-data.tsx` |
| `Structured data has Google rich results validation error` | 3 | unchanged | `/vs/surfline`, `/for-businesses`, `/for-surf-schools` | `app/vs/surfline/page.tsx`, `app/for-businesses/page.tsx`, `app/for-surf-schools/page.tsx`, `lib/constants/seo.ts` |

### Schema.org Validation Errors

Ahrefs shows the shared `Organization` JSON-LD with 2 schema.org errors on high-level pages:

- `applicationCategory`: unexpected property for `Organization`
- `operatingSystem`: unexpected property for `Organization`

The fields are currently defined on `SEO_CONFIG.structuredData.organization` in `lib/constants/seo.ts`. They should stay on `SoftwareApplication` schema only, not on `Organization`.

Ahrefs also shows beach pages with a combined `Place` and `SportsActivityLocation` item that reports:

- `address`: unexpected property for `Place, SportsActivityLocation`

The combined beach item is emitted by `BeachPageStructuredData` in `components/seo/structured-data.tsx`. Sample affected URLs include:

- `/nj/belmar/3rd-avenue-jetty-belmar-nj`
- `/nj/belmar/8th-avenue-jetty-belmar-nj`
- `/hi/kailua-kona/banyans`
- `/ca/carlsbad/carlsbad-state-beach`
- `/ca/huntington-beach/hb-cliffs`
- `/sc/folly-beach/folly-beach-folly-beach-sc`

Sampled beach pages with `VideoObject` did not show a separate `VideoObject` validation error in Ahrefs; they showed the same shared `Organization` error and the beach `Place, SportsActivityLocation` address error.

### Google Rich Results Validation Errors

Ahrefs shows `SoftwareApplication` rich-results errors on 3 pages:

- `/for-businesses`: `SoftwareApplication` is missing required `aggregateRating` or `review` for the Software App Google Search feature.
- `/for-surf-schools`: same as `/for-businesses`.
- `/vs/surfline`: Quiver and Surfline `SoftwareApplication` items are missing required `aggregateRating` or `review`; the Surfline `AggregateOffer` also lacks the required `price` field.

For Quiver-owned app schema, do not fabricate ratings or reviews. Either add truthful rating/review data only when source-backed, or accept/defer this as an unsupported rich-result opportunity. For the competitor `Surfline` schema, prefer removing rich-result eligibility fields over inventing unsupported price/rating detail.

## Other Crawl Findings To Track

These are not structured-data issues, but they appeared in the same crawl and should be routed to the broader SEO backlog:

| Ahrefs issue | Current count | Note |
| --- | ---: | --- |
| `Page has links to redirect` | 1 | New. `/features` links to `https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320?ct=app_first_v1&mt=8`, which redirects to the same App Store URL without `mt=8`. |
| `External 3XX redirect` | 1 | New. Same App Store canonicalization redirect as above. |
| `Slow page` | 85 | Existing performance issue family; 80 changed, 27 added, 94 removed, 13 missing in Ahrefs crawl history. |
| `Pages to submit to IndexNow` | 231 | Sample rows include `/`, `/forecast-accuracy`, and many dynamic beach pages. `app/api/cron/indexnow-submit/route.ts` now uses the shared collector in `lib/seo/indexnow-url-collectors.ts`, which covers static pages, beach detail pages, tide/water-temp subpages, location hubs, forecast/cam regions, guide pages, and SEO funnel pages. |
| `Page has only one dofollow incoming internal link` | 196 | Sample rows are mostly tide and water-temp subpages. Treat this as a template-level internal-linking backlog, not one-off page edits. |
| `Orphan page (has no incoming internal links)` | 2 | Exact rows: `/mexico/baja-california/rosarito/alfonsos` and `/mexico/baja-california/rosarito/el-morro-point-k375`. Mexico state hubs now link to the canonical short city route so crawlers can reach city hubs and their beach cards. |
| `Meta description too long` | 2 | Exact rows: `/beaches/usa` at 171 chars and `/about` at 195 chars. Both descriptions were shortened below 160 chars. |

## Resolution Policy

Fix immediately when Ahrefs reports:

- invalid JSON-LD syntax
- missing required schema fields on a supported schema type
- relative URLs where absolute URLs are required
- invalid dates or impossible `dateModified` / coverage windows
- broken breadcrumb chains
- template-level server-rendering gaps on utility pages

Defer and document when Ahrefs reports:

- unsupported rich-result opportunities
- deprecated FAQ or HowTo expansion requests
- "add more schema" recommendations without a truthful supported entity
- warnings that do not affect crawlability, indexability, or structured-data validity

## Next Audit Step

1. Rerun Ahrefs Site Audit after deployment and compare counts against the `22-06-2026T201033` crawl.
2. Confirm the `Organization` and beach schema.org validation families clear; keep the 3 SoftwareApplication rich-result warnings deferred unless source-backed rating/review data is added.
3. After raising the Ahrefs crawl limit, sample at least:

- one city water-temp page
- one beach water-temp page
- `/best-time-to-surf/la-jolla`
- one tide page

Compare issue counts only after the crawl completes; uncrawled-link and issue-count movement before that is not reliable.
