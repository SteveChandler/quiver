# Quiver SEO Agent Workflow

This workflow is Quiver-first and review-gated. It reuses the current Next.js SEO surfaces, `learnArticles`, curated SEO funnel pages, the existing Python content-pipeline staging area, the current GSC script, Vercel analytics exports, PostHog behavior exports, and Ahrefs audit/keyword exports instead of creating a parallel CMS.

## Embedded Skill Map

- `seo-plan`: sequencing, keyword queue shape, and dashboard status discipline.
- `seo-technical`: robots, sitemap, canonicals, metadata, broken links, and Vercel performance signals.
- `seo-content`: E-E-A-T, answer-first structure, citation readiness, and thin-content review.
- `seo-audit`: report priority labels and the Critical / High / Medium / Low action list.

## Commands

```bash
yarn seo:keyword-bank
yarn seo:export:vercel
yarn seo:export:posthog
yarn seo:export:dataforseo
yarn seo:export:competitors
yarn seo:export:aeo
yarn seo:store-snapshot
yarn seo:backlink-proxy
yarn seo:gsc-refresh --input path/to/gsc-export.json
yarn seo:technical-audit
yarn seo:enrich --source vercel --input path/to/vercel-export.json
yarn seo:enrich --source posthog --input path/to/posthog-export.json
yarn seo:enrich --source ahrefs --input ../Brand-Vault/seo-audit/YYYY-MM-DD/AHREFS-SCREENSHOT-INPUT.json --output ../Brand-Vault/seo-audit/YYYY-MM-DD/AHREFS-ENRICHMENT.json
yarn seo:recommend --input ../Brand-Vault/seo-audit/YYYY-MM-DD/GSC-REFRESH.json --input ../Brand-Vault/seo-audit/YYYY-MM-DD/TECHNICAL-AUDIT.json --input ../Brand-Vault/seo-audit/YYYY-MM-DD/VERCEL-ENRICHMENT.json
yarn seo:weekly-report
```

The commands generate dashboard updates or review reports only. They do not publish content, apply migrations, commit, push, or mutate production data. Weekly audit artifacts default to `../Brand-Vault/seo-audit/YYYY-MM-DD/` so generated marketing intelligence stays outside the app repo.

## Optional Enrichment Sources

- Vercel: traffic and Speed Insights. Use it to prioritize pages with real visits plus poor LCP, INP, or CLS.
- PostHog: behavior after landing. Use it to prioritize weak click-around, underused related paths, and high-converting SEO pages that deserve more internal links.
- DataForSEO: paid API source for Google SERP rank tracking, App Store ASO rank snapshots, and competitor keyword rows. Google Play ASO checks are disabled until the Android store listing is live. Backlinks API is intentionally not used.
- Competitor export: structured weekly competitor technical-surface and comparison-page inputs sourced from the latest archived competitor deep-dive run.
- AEO export: structured llms inventory, AI referrer traffic, and Ahrefs AI citation snapshot inputs for weekly citation-readiness reporting.
- Ahrefs: external SEO. Use it for crawl issues, backlink/ranking context, and keyword opportunities that should enter the review queue. The manual snapshot file is `AHREFS-SCREENSHOT-INPUT.json`; do not use the same path for `--input` and `--output`, because that overwrites the source export and can silently produce an empty enrichment. Ahrefs keyword priorities are cross-checked against same-folder `GSC-EXPORT.json`, `VERCEL-EXPORT.json`, and `POSTHOG-EXPORT.json`; Ahrefs-only keyword rows stay low priority until one of those sources corroborates demand.
- GSC remains the indexing/query source of truth when available.
- Store snapshots: App Store / Play listing metadata, sampled App Store keyword position checks, competitor version/rating/IAP deltas, and listing drift against Brand Vault copy. Current iOS competitor targets are Lazy Surfer, Swellify, Swell Scope, Duune, and Surf Radar.
- Backlink proxy: Vercel referrers, widget embed referrers, outreach tracker rows, and optional manual Ahrefs Webmaster Tools, Moz Link Explorer, GSC links, or generic backlink CSV/JSON exports.

## Weekly Coverage Notes

The weekly report must explicitly label its coverage boundaries without treating expected coverage limits as failures:

- DataForSEO is the paid SERP/API source when `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` are configured; otherwise no paid SERP API is configured.
- No paid full backlink index is configured unless explicitly enabled. The report uses free/provided backlink sources: referrers, embeds, outreach tracker rows, and manual CSV/JSON imports.
- Manual backlink imports are auto-discovered from the audit folder and `docs/seo/backlink-reports/` when filenames match Ahrefs Webmaster Tools, Moz Link Explorer, GSC links, manual backlinks, backlinks, or referring domains.
- Manual Ahrefs screenshot inputs should include `issues` and `keywordOpportunities` arrays. Utility tide/water-temp keyword opportunities stay dismissed by strategy unless the work is technical crawl hygiene; non-utility surf-report, forecast, best-time, beginner, learn, longboard, and local-spot opportunities should remain open for review.
- DataForSEO Labs covers only the configured competitor set and provider index.
- DataForSEO ASO currently tracks iOS only. Re-add `android` to `docs/seo/dataforseo-watchlist.json` `aso.platforms` and restore `aso.quiver.androidAppId` once the Google Play listing is live.
- Competitor technical-page reporting should cover robots/sitemap availability, sitemap count, raw-HTML schema visibility, and direct comparison-page signals when the latest competitor report is present.
- For active, smaller competitors such as Lazy Surfer, do not default to direct branded `/vs/<competitor>` pages or named rebuttal pages. Prefer capability-led or job-to-be-done pages that capture the same intent without expanding the competitor's branded footprint.
- AEO reporting should cover `llms.txt` / `llms-full.txt`, AI referrer traffic, Ahrefs AI citation snapshots, and notable citation domains from manual Ahrefs inputs when available.
- No automated Google SERP scraping is performed.
- Competitor export coverage comes from store snapshots and explicitly configured comparison pages only. If a competitor claim is not visible at the checked live URL, document it as monitor-only until the exact live URL or captured HTML is available.
- AEO export coverage is a citation-tracking input, not proof that a page won organic clicks. Pair it with GSC page/query data before prioritizing content changes.

## Dashboard Runtime Reconciliation

Before marking an SEO dashboard proposal as covered, verify the runtime surface exists in code, not only in `docs/seo/seo-dashboard.json`.

Required checks:

1. The canonical route is present in the relevant runtime source, such as `lib/seo/funnel-pages.ts` or an app route.
2. Unit tests name the route and assert the metadata, title, and internal-link behavior that make it the owner.
3. E2E coverage includes the route when the page belongs to an existing public SEO surface family.
4. The weekly report records the GSC baseline and the intended rerun window.

Track repeated low-CTR work in `docs/seo/CTR_HISTORY.md` so refreshes do not repeat old assumptions.

## Image Asset Guardrails

Do not use the following generated or geographically-mismatched SEO assets in active funnel pages, hero images, Open Graph images, or nearby-spot cards:

- `public/images/seo-dioramas/longboard/la-jolla/la-jolla-cove-cliffs-diorama.webp`
- `public/images/seo-dioramas/longboard/la-jolla/tourmaline-lineup-diorama.webp`
- `public/images/seo-dioramas/longboard/la-jolla/windansea-mellow-reef-diorama.webp`
- `public/images/seo-dioramas/surf-cams/orange-county/orange-county-aerial-shore-photo.webp`
- `public/images/seo-dioramas/surf-cams/orange-county/orange-county-open-wave-photo.webp`
- `public/images/seo-dioramas/surf-cams/orange-county/orange-county-sunset-beach-photo.webp`
- `public/images/seo-dioramas/surf-report/scripps-pier-today/scripps-board-choice-diorama.webp`
- `public/images/seo-dioramas/surf-report/scripps-pier-today/scripps-pier-surf-check-diorama.webp`

`__tests__/lib/seo/funnel-pages.test.ts` enforces this list against active page images and nearby-spot card backgrounds. The approved Blackies/Newport runtime photo is documented in `docs/seo/photo-candidates/` and `scripts/data/socal-beginner-approved-photos.json`; add future source and license records there before wiring new runtime SEO images.

## Draft Queue

Drafts belong under `tools/content-pipeline/output/seo-drafts/` and must stay in `status: review-queue` until manually approved. Use `.claude/product-marketing-context.md` for Quiver voice and positioning, and cite factual surf/ocean claims with trusted sources such as NOAA, NDBC, CDIP, NWS, `.gov`, or `.edu`.
