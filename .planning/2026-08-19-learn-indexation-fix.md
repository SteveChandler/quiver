# /learn indexation + AEO action-item investigation — 2026-08-19

Triggered by the 2026-08-19 AEO citation audit action list. The audit's premise was
that 14 near-exact-match `/learn/` pages "do not rank". Measurement contradicted that
premise in three separate places. This file records what was actually true.

## Method

Google Search Console, property `https://www.quiversurf.app/`, service account already
in the repo root. Two APIs used:

- Search Analytics (28d, 2026-07-20 → 2026-08-16) for impressions/position.
- **URL Inspection** for real index status. This is the check the action item asked
  for ("actually indexed, not just indexable") and it is the one that produced the
  finding. Impressions alone would have been misleading.

## Finding 1 — it was never a titles problem

Titles are already near-verbatim query matches (`Best Beginner Surf Spots in San Diego`
for "beginner surf spots san diego"). On-page targeting was not the defect. Dropped.

## Finding 2 — 11 of 27 learn pages were NOT INDEXED

| Bucket | Count | Meaning |
|---|---:|---|
| Submitted and indexed | 16 | fine |
| **Crawled - currently not indexed** | 8 | Google crawled, declined to index |
| **Discovered - currently not indexed** | 3 | Google never spent crawl budget at all |

Never-crawled: `surf-paddling-for-beginners`, `beginner-breaks-san-diego`,
`beginner-breaks-santa-cruz`. All three had **zero contextual inbound internal links**.

The indexed pages that do rank sit at avg position 9.7–13.6 — i.e. the page-1 boundary.
`best-tide-for-surfing` (10.2, cited) and `best-surf-conditions-for-beginners`
(10.0, not cited) are separated by ~0.3 positions of noise. **The audit's cited/not-cited
split is a threshold effect at the page-1 boundary, not a content-quality signal.**

## Finding 3 — root cause of the beginner-breaks regression

`app/learn/page.tsx` renders the hub from a hardcoded `CATEGORIES` slug list, **not**
from `learnArticles`. `surf-paddling-for-beginners` (published 2026-07-23) was never
added to it, so it was linked from nowhere on the site — a true orphan. Article data
and sitemap were both correct, which is why every existing test stayed green.
Reachability was the untested invariant.

`beginner-breaks-{san-diego,santa-cruz}` were in CATEGORIES but had only that single
hub link and no sibling-article links. Same failure mode, weaker degree.

## Finding 4 — the product-page action item was wrong

`/best-free-surf-forecast-app` and `/best-surf-forecast-app` **already exist, are live,
and are indexed**. Writing new pages for those queries would have deepened an existing
cannibalization problem:

- "best free surf forecast app" → won by `/best-surf-forecast-app` (pos 9.5), while
  `/best-free-surf-forecast-app` — the page built for that exact query — does not
  surface for it at all.
- `/best-free-surf-forecast-app`'s actual query footprint is almost entirely spam
  ("best surf forecast app coastalcarves com", "watersvibe com", "surfstribe com").
- `/vs/surfline` is the healthy page: pos 5.6–7.4 on real queries. Proven pattern.

Genuinely missing: **"best app for surf session logging"** and **"personal surf
forecast app"**. Those two, and only those two, justify new pages.

## Finding 5 — live page made a false entitlement claim

`/best-free-surf-forecast-app` claimed the free tier "covers a personal daily call …
your past sessions tune the next call". `lib/personalization/eligibility.ts:124` returns
locked when `!is_pro && !is_trialing`. Personal match, ranked windows, and personal
alerts are Pro/trial only. Corrected to the real boundary.

## Changes made

| File | Change |
|---|---|
| `app/learn/page.tsx` | reattached orphan `surf-paddling-for-beginners`; added 2 new slugs |
| `lib/data/learn-articles.ts` | 6 contextual inbound links to the never-crawled pages; 2 new articles |
| `__tests__/app/learn-hub-coverage.test.ts` | NEW — fails if any article is orphaned again |
| `app/best-free-surf-forecast-app/page.tsx` | 4 entitlement claims corrected to match code |

New articles: `how-does-water-temperature-affect-surfing`,
`beginner-breaks-orange-county` (both prerender, correct H1, canonical, index/follow).

## Verification

- `yarn typecheck` clean; `yarn lint --max-warnings=0` clean.
- `yarn test:unit` — 17,091 passed, 0 failed.
- `yarn build` — both new pages prerender; H1s match target queries.
- Regression test proven to FAIL with the orphan reintroduced, PASS with it fixed.
- Rendered HTML confirms hub + `best-surf-conditions-for-beginners` now link all three
  previously-unlinked pages.

## NOT done / open

- The 8 "Crawled - currently not indexed" pages are untouched. Internal linking may not
  be enough for them; that bucket is a quality/duplication signal and needs its own pass.
- Cannibalization between `/best-surf-forecast-app` and `/best-free-surf-forecast-app`
  is diagnosed but NOT fixed. Needs a product call: consolidate to one page + redirect,
  or differentiate intent. Do not add a third page until this is resolved.
- The two genuinely-missing product pages were not built.
- Nothing committed, nothing deployed. Indexation changes only take effect after deploy
  and re-crawl; expect weeks, not days. Re-check with URL Inspection, not the audit rate.

---

# Round 2 — quality pass + cannibalization consolidation

## Quality pass on "Crawled - currently not indexed"

Ruled out first, with measurement: these pages are in the sitemap, internally linked,
titled to their target query, and their **word counts match the indexed pages**
(declined median 332 words vs indexed median 328). Depth alone was not the
discriminator. What they shared was being thin, templated and interchangeable —
six sat on an identical 3-sections / 4-FAQs / 3-takeaways skeleton.

| slug | before | after | sections | FAQs |
|---|---:|---:|---:|---:|
| how-accurate-are-surf-forecasts | 287 | 946 | 8 | 6 |
| beach-break-vs-reef-break-vs-point-break | 356 | 820 | 7 | 6 |
| what-equipment-to-start-surfing | 306 | 797 | 7 | 6 |
| what-size-surfboard-should-i-get | 296 | 793 | 7 | 6 |
| surf-etiquette-rules | 357 | 790 | 7 | 6 |
| best-time-of-day-to-surf (merge target) | 302 | 826 | 7 | 6 |

All carry `dateModified: "2026-08-19"` — honest, the content genuinely changed. Depth
was added as decision rules, thresholds and numeric ranges, not adjectives.

**Not touched:** `swell-period-explained` (643 words) and `how-swell-wraps-around-points`
(935 words) were already deep. Their non-indexing is unlikely to be a content problem;
do not pad them. They need authority/links, and are the honest test of whether this
whole theory is right — if the five rewritten pages get indexed and these two do not,
content depth was the lever.

## Consolidation 1 — product pages

`/best-free-surf-forecast-app` → `/best-surf-forecast-app`, **308 permanent**.

Direction was set by evidence, not by page size: the free page was actually the bigger
one (595 vs 412 lines) but `/best-surf-forecast-app` already outranked it for
"best free surf forecast app" (pos 9.5 vs not present at all), and the free page's real
query footprint was scraper spam. Google had already picked the winner.

**Trap caught:** `/best-free-surf-forecast-app` was the site's ONLY rich-result-eligible
app page — the sole holder of `SoftwareApplication` + `aggregateRating` + `Offer`, with
`__tests__/app/ahrefs-structured-data-regressions.test.ts` deliberately asserting no
other landing page emits it. Deleting it naively would have destroyed that asset. The
eligible-app-page role was transferred to the surviving page instead, and the schema's
`description` — which repeated the false free-tier personalization claim — was corrected
on the way across.

## Consolidation 2 — duplicate learn pages

`/learn/why-waves-better-in-morning` → `/learn/best-time-of-day-to-surf`, **308**.
Same thermal-wind topic, same three section headings, overlapping keywords; the
surviving page was the indexed one. Unique material (land-sea thermal circulation, the
still-choppy-morning / fog / does-this-hold-worldwide FAQs) and the keywords were merged
in first, so the intent is retained rather than dropped.

## Verification

- `yarn typecheck` clean · `yarn lint --max-warnings=0` clean.
- `yarn test:unit` — **17,097 passed, 0 failed**.
- `yarn build` — retired routes absent from output, survivors prerender, both redirects
  registered as **308** in `routes-manifest.json`, and the survivor's rendered HTML
  carries `SoftwareApplication` + `aggregateRating` + `FAQPage`.
- `__tests__/app/seo-consolidation.test.ts` NEW — proven to FAIL when the redirect is
  removed. It guards the specific regression of a retired URL being re-added to the
  sitemap, which would silently undo the consolidation.

## Open

- Pre-existing claim, NOT introduced here and NOT changed: `how-surf-forecasts-work`
  states Quiver's correction layer is "more accurate than raw WaveWatch III". That is a
  claim about improving on a raw model rather than beating a competitor, so it is
  probably defensible — but given the `/forecast-accuracy` history it deserves a
  deliberate decision rather than inheritance.
- The two genuinely-missing product pages ("best app for surf session logging",
  "personal surf forecast app") are still unbuilt. Now safe to build: the
  cannibalization that made adding pages harmful is resolved.
- Nothing committed, nothing deployed.

---

# Round 3 — the two genuinely-missing product pages

Built the only two targets that had no page. Deliberately did NOT add a third page for
"best free surf forecast app": that query already has an owner after Round 2.

| Route | Target query | H1 |
|---|---|---|
| `/surf-session-log` | best app for surf session logging | Best App for Surf Session Logging |
| `/personal-surf-forecast` | personal surf forecast app | Personal Surf Forecast App |

Both follow the `/vs/surfline` species (the proven ranker): ISR 86400, `buildPageMetadata`,
Breadcrumb + WebPage schema, ZineSurface/QuiverSticker vocabulary, quick-take answer,
decision cards, capability table, mechanism section, visible `<details>` FAQ, CTA cluster,
publisher disclosure. Added to `staticRoutes`, cross-linked to each other and from
`/best-surf-forecast-app`.

## Claim discipline

Every capability claim was taken from an evidence table built against the code, not from
marketing instinct. Specifically excluded because the code does not support them:

- **Wave-height trends in feet** — `lib/analytics/session-analytics.ts:115-121` derives
  these from `wave_quality`, not measured height. Implementation defect; not advertised.
- **A measured wind score** — `lib/analytics/session-analytics.ts:213` hardcodes `3.5`.
- **Board performance comparison** — a DB RPC exists with no runtime consumer. The page
  says "Board-use frequency shows which boards you logged most often; it is not a
  board-performance report."
- **Personalization improving the forecast** — the similarity layer keeps physical
  conditions separate. Page states: "Personalization never rewrites wave height, period,
  wind, or tide predictions."
- **"Learns your spot"** — banned as phrasing; it reads as per-user physical model
  calibration, which is not what happens.
- The five-eligible-session threshold and the Pro gate appear next to every learning claim.

Neither page emits `SoftwareApplication` — that role belongs solely to
`/best-surf-forecast-app` since Round 2.

## H1 convention (fixed after review)

Both pages first shipped with clever H1s ("Log the surf you actually had.") that omitted
the target query. Every Quiver page that currently ranks carries its query in the H1
near-verbatim. H1s were rewritten to match and the old lines demoted to the deck; the
duplicated eyebrow labels were replaced. Both test files now assert the H1 convention so
it cannot silently regress.

## Verification

`yarn typecheck` clean · `yarn lint --max-warnings=0` clean · `yarn test:unit`
**17,108 passed, 0 failed** · `yarn build` renders both as static with 1d ISR, correct
canonical, `index, follow`, and no SoftwareApplication leak.

Still nothing committed or deployed.
