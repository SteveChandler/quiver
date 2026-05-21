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
yarn seo:store-snapshot
yarn seo:backlink-proxy
yarn seo:gsc-refresh --input path/to/gsc-export.json
yarn seo:technical-audit
yarn seo:enrich --source vercel --input path/to/vercel-export.json
yarn seo:enrich --source posthog --input path/to/posthog-export.json
yarn seo:enrich --source ahrefs --input path/to/ahrefs-export.json
yarn seo:recommend --input ../Brand-Vault/seo-audit/YYYY-MM-DD/GSC-REFRESH.json --input ../Brand-Vault/seo-audit/YYYY-MM-DD/TECHNICAL-AUDIT.json --input ../Brand-Vault/seo-audit/YYYY-MM-DD/VERCEL-ENRICHMENT.json
yarn seo:weekly-report
```

The commands generate dashboard updates or review reports only. They do not publish content, apply migrations, commit, push, or mutate production data. Weekly audit artifacts default to `../Brand-Vault/seo-audit/YYYY-MM-DD/` so generated marketing intelligence stays outside the app repo.

## Optional Enrichment Sources

- Vercel: traffic and Speed Insights. Use it to prioritize pages with real visits plus poor LCP, INP, or CLS.
- PostHog: behavior after landing. Use it to prioritize weak click-around, underused related paths, and high-converting SEO pages that deserve more internal links.
- DataForSEO: paid API source for Google SERP rank tracking, App Store / Google Play ASO rank snapshots, and competitor keyword rows. Backlinks API is intentionally not used.
- Ahrefs: external SEO. Use it for crawl issues, backlink/ranking context, and keyword opportunities that should enter the review queue.
- GSC remains the indexing/query source of truth when available.
- Store snapshots: App Store / Play listing metadata, sampled App Store keyword position checks, competitor version/rating/IAP deltas, and listing drift against Brand Vault copy. Current iOS competitor targets are Lazy Surfer, Swellify, Swell Scope, Duune, and Surf Radar.
- Backlink proxy: Vercel referrers, widget embed referrers, outreach tracker rows, and optional manual Ahrefs Webmaster Tools, Moz Link Explorer, GSC links, or generic backlink CSV/JSON exports.

## Weekly Coverage Notes

The weekly report must explicitly label its coverage boundaries without treating expected coverage limits as failures:

- DataForSEO is the paid SERP/API source when `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` are configured; otherwise no paid SERP API is configured.
- No paid full backlink index is configured unless explicitly enabled. The report uses free/provided backlink sources: referrers, embeds, outreach tracker rows, and manual CSV/JSON imports.
- Manual backlink imports are auto-discovered from the audit folder and `docs/seo/backlink-reports/` when filenames match Ahrefs Webmaster Tools, Moz Link Explorer, GSC links, manual backlinks, backlinks, or referring domains.
- DataForSEO Labs covers only the configured competitor set and provider index.
- No automated Google SERP scraping is performed.

## Draft Queue

Drafts belong under `tools/content-pipeline/output/seo-drafts/` and must stay in `status: review-queue` until manually approved. Use `.claude/product-marketing-context.md` for Quiver voice and positioning, and cite factual surf/ocean claims with trusted sources such as NOAA, NDBC, CDIP, NWS, `.gov`, or `.edu`.
