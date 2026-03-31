# Unified SEO Priority Matrix

**Date:** 2026-03-30
**Sources:** Team 1 (Technical Audit), Team 2 (Competitive Analysis), Team 3 (Refinement Strategy)

---

## Critical (Fix This Week)

| # | Issue | Source | Impact | Effort | Details |
|---|-------|--------|--------|--------|---------|
| **C1** | **Sitemap only contains 1,334 of ~9,100 URLs** | T1, T2 | VERY HIGH | Medium | 85% of pages missing from sitemap. Surfline indexes 39K, Swellinfo 34K. This is the single biggest gap. |
| **C2** | **14 of 17 page types are fully dynamic (no caching)** | T1 | HIGH | Medium | Only homepage, /vs/surfline, /cams are cached. All other pages render fresh on every crawl hit. ISR migration was done in March but many pages still show `cache-control: private, no-cache, no-store`. |
| **C3** | **/forecast hub TTFB is 4.82s** | T1 | HIGH | Medium | Unacceptable for Googlebot. Needs ISR or data optimization. |
| **C4** | **/water-temp city pages TTFB is 4.32s** | T1 | HIGH | Medium | Same issue -- 59 city pages all rendering slow. |
| **C5** | **/forecast-accuracy is force-dynamic and NOT indexed by Google** | T3 | HIGH | Trivial | One-line fix: change `force-dynamic` to `revalidate = 21600`. This is Quiver's most linkable asset. |

## High (Fix This Sprint)

| # | Issue | Source | Impact | Effort | Details |
|---|-------|--------|--------|--------|---------|
| **H1** | **279+ beach pages have ZERO share buttons** | T3 | VERY HIGH | Medium | Highest-traffic pages, `/api/og/beach` endpoint exists, ShareSheet component exists. Just need to wire them together. |
| **H2** | **3 OG image endpoints completely orphaned** | T3 | HIGH | Low | wave, progression, streak endpoints built but never imported. URL builders exist in `lib/share/build-share-card-url.ts`. |
| **H3** | **Organization schema missing 7 states** | T3 | MEDIUM | Trivial | ME, NH, MA, RI, SC, GA, TX not in `areaServed`. Hurts GEO/AI citation. |
| **H4** | **Missing 10-12 keywords in SEO_CONFIG** | T3 | MEDIUM | Trivial | No keywords for NY, NC, SC, TX, WA, ME, GA, MA. Missing "tide chart today", "surf conditions near me". |
| **H5** | **Guide page meta description is 648 chars** | T1 | MEDIUM | Trivial | Should be <=160. Truncated to uselessness in SERPs. |
| **H6** | **Homepage meta description is 196 chars** | T1 | MEDIUM | Trivial | Exceeds 160-char limit. |
| **H7** | **Tide/water-temp subpages share parent H1** | T1 | MEDIUM | Low | "Blacks Beach Surf Report" on tides page. Should be "Blacks Beach Tide Chart". ~685 pages affected. |
| **H8** | **State page missing BreadcrumbList/WebPage/ItemList schema** | T1 | MEDIUM | Low | ~11 state pages missing 3 schema types. |
| **H9** | **Missing Dataset schema on tide/water-temp subpages** | T1 | HIGH | Low | ~685 pages. Note: Team 3 found the components exist -- verify they're actually being rendered on production pages. |
| **H10** | **MagicSeaweed broken link opportunity** | T2 | HIGH | Medium | Thousands of sites still link to dead MSW URLs. MSW had DA 60+. Automated backlink scanner agent will find these weekly. |

## Medium (Next Sprint)

| # | Issue | Source | Impact | Effort | Details |
|---|-------|--------|--------|--------|---------|
| **M1** | **4 components use raw navigator.share with no styled UI** | T3 | MEDIUM | Medium | Progression dashboard, best surf window, referral leaderboard, smart checklist. Upgrade to ShareSheet. |
| **M2** | **Missing custom OG image for /vs/surfline** | T3 | MEDIUM | Medium | Uses generic fallback. High-value comparison page frequently shared in forums. |
| **M3** | **Guide page missing og:description** | T1 | MEDIUM | Trivial | No description in social shares. |
| **M4** | **Relative URLs in learn article JSON-LD** | T1 | MEDIUM | Low | Google requires absolute URLs in schema. ~5 learn articles. |
| **M5** | **Non-www redirect uses 307 instead of 301** | T1 | MEDIUM | Trivial | Temporary redirect doesn't pass full link equity. |
| **M6** | **Missing VideoObject on cams hub** | T1 | LOW-MEDIUM | Low | Beach detail pages have it but dedicated /cams page doesn't. |
| **M7** | **Add SoftwareApplication schema to widget pages** | T3 | LOW-MEDIUM | Low | /for-surf-schools and /for-businesses missing schema for "free surf widget" searches. |
| **M8** | **Widget attribution links lack UTM params** | T3 | LOW | Trivial | Add `?utm_source=embed&utm_medium=widget` to "Powered by Quiver" links. |
| **M9** | **4 title tags exceed 60 chars** | T1 | LOW | Trivial | vs/surfline (66), city page (64), best-time-to-surf (66), water-temp city (67). |
| **M10** | **Add TX and MA to META_STATE_EXPANSIONS** | T3 | LOW | Trivial | `lib/seo/meta.ts` -- less recognized abbreviations in surf context. |

## Quick Wins (< 30 min each, ship today)

| # | Action | File | Change |
|---|--------|------|--------|
| Q1 | /forecast-accuracy to ISR | `app/forecast-accuracy/page.tsx:32` | `force-dynamic` -> `revalidate = 21600` |
| Q2 | Add 7 states to areaServed | `lib/constants/seo.ts` | Add ME, NH, MA, RI, SC, GA, TX objects |
| Q3 | Add missing keywords | `lib/constants/seo.ts` | Add 10-12 state + intent keywords |
| Q4 | Fix guide meta description | Guide metadata generation | Cap at 160 chars |
| Q5 | Fix homepage meta description | Homepage metadata | Cap at 160 chars |
| ~~Q6~~ | ~~Add homepage H1~~ | N/A | **NOT AN ISSUE** -- landing page has H1 ("Know what the swell means before you paddle out.") in `hero-section.tsx:50`. The authenticated home screen lacks H1 but bots don't see it. |
| Q7 | Widget UTM params | `embed-conditions-widget.tsx`, `embed-tide-widget.tsx` | Add UTM to attribution links |
| Q8 | Extend ShareSheet type union | `components/share/share-sheet.tsx` | Add "beach", "progression", "streak", "cam" |
| Q9 | TX/MA state expansions | `lib/seo/meta.ts` | Add to META_STATE_EXPANSIONS |

---

## Competitive Advantages to Double Down On

From Team 2's analysis, these are uncontested:

1. **Accuracy transparency** -- Nobody else publishes forecast accuracy data. Lead every outreach with this.
2. **AI citation readiness** -- Only platform with llms.txt + explicit bot rules + 15 schema types. Swellinfo blocks ALL AI crawlers.
3. **Widget embed program** -- 4 types vs Surfline's 0 (discontinued), Swellinfo's 1 (dated jQuery). Every embed = dofollow backlink.
4. **Dynamic OG images** -- 12 endpoints vs 1 for Surfline, 0 for everyone else.
5. **Free model** -- Full access vs Surfline's $120/yr paywall. Captures entire "surfline alternative" search cohort.

## Automated Outreach (Running)

| Agent | Schedule | Status |
|-------|----------|--------|
| SEO Outreach Drafter | Monday 9am PT | Active -- first run April 6 |
| Backlink & Broken Link Scanner | Monday 9am PT | Active -- first run April 6 |
| SEO Setup Bootstrap | One-shot | Running now -- directory drafts, platform registration links, GBP content, Google Alert links in Gmail drafts |

---

## 90-Day Execution Timeline

### Week 1-2 (April 1-14): Critical Fixes
- Ship all 9 Quick Wins (Q1-Q9)
- Fix sitemap to include all ~9,100 URLs (C1)
- Investigate and fix caching gap -- 14 page types showing no-cache (C2)
- Fix /forecast TTFB (C3) and /water-temp city TTFB (C4)
- Add share buttons to beach detail pages (H1)

### Week 3-4 (April 15-30): High Priority
- Wire orphaned OG endpoints (H2)
- Fix tide/water-temp H1 tags (H7)
- Add missing schema to state pages (H8)
- Verify Dataset schema rendering on production (H9)
- Review first automated outreach drafts and backlink scan reports

### Week 5-8 (May): Medium Priority + Outreach Ramp
- Upgrade raw navigator.share calls (M1)
- Create custom OG for /vs/surfline (M2)
- Fix relative URLs in learn article schema (M4)
- Begin MagicSeaweed broken link outreach from scanner reports (H10)
- Review and send accumulated outreach drafts from weekly agent

### Week 9-12 (June): Sustained Execution
- Address remaining medium/low issues
- Measure impact: CTR changes, new referring domains, keyword movements
- Adjust outreach targets based on response rates
- Monthly metrics review against baseline

---

## Baseline Metrics (capture now)

- [ ] Sitemap URL count: 1,334 (target: 9,100+)
- [ ] Referring domains: ~0 (target: 50+ by June)
- [ ] Organic traffic (GSC 28d): capture baseline
- [ ] Widget embed domains (from embed_impressions): capture baseline
- [ ] Social share rate: capture baseline from analytics
- [ ] /forecast-accuracy indexed: NO (target: YES)
- [ ] Average TTFB across page types: varies (target: <1s all pages)
- [ ] Schema validation errors in GSC: capture baseline
