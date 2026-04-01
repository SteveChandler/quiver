# Team 1: Technical SEO Audit Report

**Site:** https://www.quiversurf.app
**Audit Date:** 2026-03-30
**Audited By:** Team 1 (Crawlability, Indexability, CWV, Schema, Internal Links, Content Quality, OG/Social)

---

## Executive Summary

| Category | Pass | Fail | Warn | Score |
|----------|------|------|------|-------|
| 1A. Crawlability & Indexability | 12 | 2 | 3 | 78/100 |
| 1B. Core Web Vitals | 5 | 3 | 2 | 65/100 |
| 1C. Schema Validation | 10 | 6 | 3 | 62/100 |
| 1D. Internal Link Equity | 5 | 1 | 2 | 80/100 |
| 1E. Content Quality | 10 | 3 | 2 | 75/100 |
| 1F. Social Sharing & OG | 9 | 3 | 2 | 74/100 |
| **Overall** | **51** | **18** | **14** | **72/100** |

**Top Issues:**
- CRITICAL: Forecast hub TTFB is 4.8s (poor server response)
- CRITICAL: Tide city page TTFB is 4.3s
- CRITICAL: Homepage missing H1 tag
- HIGH: Sitemap contains only 1,334 of ~9,100 expected URLs (~85% missing)
- HIGH: Missing Dataset schema on tide/water-temp subpages
- HIGH: Missing HowTo schema on beach detail pages
- HIGH: No Content-Security-Policy header
- HIGH: Guide page meta description is 648 characters (should be <=160)

---

## 1A. Crawlability & Indexability

### robots.txt

**Status: PASS**

- Accessible at `https://www.quiversurf.app/robots.txt` (HTTP 200)
- Correctly blocks private paths: `/_next/`, `/api/`, `/admin/`, `/profile/`, `/inbox/`, `/sessions/`, `/session/`, `/auth/*`, `/embed/`, `/spots/`, `/welcome`
- Correctly allows `/api/og/` (OG image endpoints)
- AI crawler management is comprehensive:
  - GPTBot: allowed with `Crawl-delay: 2`
  - ChatGPT-User: allowed
  - OAI-SearchBot: allowed
  - ClaudeBot: allowed with `Crawl-delay: 2`
  - PerplexityBot: allowed
  - Bytespider: fully blocked (correct for scraper)
- `Host` directive present: `https://www.quiversurf.app`
- `Sitemap` directive present and correct

### llms.txt

**Status: PASS**

- Accessible at `https://www.quiversurf.app/llms.txt` (HTTP 200)
- Well-structured with: About, Features, Coverage Areas, Data Sources, Key Pages, Pricing, Contact
- Contains 16 coverage area links and 4 key page links
- Correctly describes the ML pipeline, data sources (CDIP, NDBC, IOOS), and free pricing

### Sitemap

**Status: FAIL -- Critical URL Coverage Gap**

- Accessible at `https://www.quiversurf.app/sitemap.xml` (HTTP 200)
- Contains **1,334 URLs** -- but the site is reported to have ~9,100 URLs
- This means approximately **85% of URLs are missing from the sitemap**
- URL breakdown by category:
  - Beach water-temp subpages: 406
  - Beach tides subpages: 279
  - Intent pages: 224
  - Beach detail pages: 157
  - Tide city pages: 59
  - Water-temp city pages: 59
  - Best-time-to-surf pages: 40
  - City hub pages: 28
  - Other/static pages: 24
  - Forecast region pages: 16
  - Location hierarchy pages: 11
  - Guide pages: 11
  - Cams subpages: 8
  - Learn articles: 5
  - Landing pages: 2
  - Forecast hub: 2
  - Homepage: 1
  - Comparison: 1
  - Cams hub: 1
- Missing: state-level intent pages, many beach detail pages, forecast sub-region pages
- All URLs use correct `https://www.quiversurf.app` prefix
- `<lastmod>` dates present on all URLs
- `<changefreq>` and `<priority>` present (though Google ignores these)
- Recommendation: Generate a comprehensive sitemap (or sitemap index with sub-sitemaps per category) covering all ~9,100 URLs

### HTTP Status Codes

| URL | Status | TTFB | Size | Cache |
|-----|--------|------|------|-------|
| `/` (homepage) | 200 | 0.32s | 137KB | HIT (prerendered) |
| `/ca/san-diego/blacks` (beach) | 200 | 1.41s | 173KB | MISS (dynamic) |
| `/ca/san-diego/blacks/tides` (tides) | 200 | 1.02s | 158KB | MISS (dynamic) |
| `/ca/san-diego/blacks/water-temp` | 200 | 1.15s | 153KB | MISS (dynamic) |
| `/beginner/san-diego` (intent) | 200 | 0.98s | 208KB | MISS (dynamic) |
| `/learn/how-to-read-a-surf-forecast` | 200 | 0.29s | 122KB | MISS (dynamic) |
| `/vs/surfline` (comparison) | 200 | 0.10s | 186KB | PRERENDER |
| `/forecast-accuracy` | 200 | 0.71s | 108KB | MISS (dynamic) |
| `/beaches/usa/ca/san-diego` (city) | 200 | 0.50s | 228KB | MISS (dynamic) |
| `/beaches/usa/ca` (state) | 200 | 0.72s | 443KB | MISS (dynamic) |
| `/forecast` (hub) | 200 | **4.82s** | 394KB | MISS (dynamic) |
| `/cams` | 200 | 0.50s | 242KB | HIT (prerendered) |
| `/best-time-to-surf` | 200 | 0.41s | 134KB | MISS (dynamic) |
| `/guides/surfing-southern-california` | 200 | 0.53s | 769KB | MISS (dynamic) |
| `/for-surf-schools` | 200 | 0.38s | 113KB | MISS (dynamic) |
| `/tide/san-diego` (tide city) | 200 | 0.93s | 370KB | MISS (dynamic) |
| `/water-temp/san-diego` | 200 | **4.32s** | 328KB | MISS (dynamic) |

**Status: WARN -- Two pages have TTFB >4s**

### Incorrect URL Patterns (404s)

The audit spec requested these URLs which return **404**:
- `https://www.quiversurf.app/ca/san-diego/blacks-beach` --> 404
- `https://www.quiversurf.app/tide/san-diego/blacks-beach` --> 404
- `https://www.quiversurf.app/water-temp/san-diego/blacks-beach` --> 404

The correct patterns are:
- Beach: `/ca/san-diego/blacks` (slug is "blacks" not "blacks-beach")
- Tide subpage: `/ca/san-diego/blacks/tides` (nested under beach, not `/tide/{city}/{beach}`)
- Water temp subpage: `/ca/san-diego/blacks/water-temp` (nested under beach)
- Tide city: `/tide/san-diego` (city-level only)
- Water temp city: `/water-temp/san-diego` (city-level only)

**Status: INFO** -- URL patterns are consistent; the audit spec had incorrect slugs.

### Canonical Tags

| Page | Canonical | Match? |
|------|-----------|--------|
| Homepage | `https://www.quiversurf.app` | PASS |
| Beach detail | `https://www.quiversurf.app/ca/san-diego/blacks` | PASS |
| Tides subpage | `https://www.quiversurf.app/ca/san-diego/blacks/tides` | PASS |
| Water temp | `https://www.quiversurf.app/ca/san-diego/blacks/water-temp` | PASS |
| Intent page | `https://www.quiversurf.app/beginner/san-diego` | PASS |
| Learn article | `https://www.quiversurf.app/learn/how-to-read-a-surf-forecast` | PASS |
| vs/surfline | `https://www.quiversurf.app/vs/surfline` | PASS |
| Forecast accuracy | `https://www.quiversurf.app/forecast-accuracy` | PASS |
| City page | `https://www.quiversurf.app/ca/san-diego` | PASS (Note: canonical uses `/ca/san-diego` not `/beaches/usa/ca/san-diego`) |
| State page | `https://www.quiversurf.app/beaches/usa/ca` | PASS |
| Forecast hub | `https://www.quiversurf.app/forecast` | PASS |
| Cams | `https://www.quiversurf.app/cams` | PASS |
| Best time to surf | `https://www.quiversurf.app/best-time-to-surf` | PASS |
| Guide | `https://www.quiversurf.app/guides/surfing-southern-california` | PASS |
| Surf schools | `https://www.quiversurf.app/for-surf-schools` | PASS |
| Tide city | `https://www.quiversurf.app/tide/san-diego` | PASS |
| Water temp city | `https://www.quiversurf.app/water-temp/san-diego` | PASS |

**Status: PASS** -- All canonicals are absolute, self-referencing, and correct.

**Note on city page canonical:** The `/beaches/usa/ca/san-diego` URL has canonical set to `https://www.quiversurf.app/ca/san-diego`. This is correct behavior (canonicalizing the hierarchy URL to the primary city hub URL), but the sitemap should only include the canonical URL.

### noindex/nofollow Check

**Status: PASS** -- No noindex or nofollow directives found on any public pages. No `x-robots-tag` headers detected in any response.

### Trailing Slash Duplicates

**Status: PASS** -- All trailing-slash URLs return `308 Permanent Redirect` to the non-trailing-slash version. Example:
- `/ca/san-diego/blacks/` --> 308 --> `/ca/san-diego/blacks`
- `/forecast/` --> 308 --> `/forecast`

### Domain Redirects

**Status: PASS** -- `quiversurf.app` (non-www) returns `307 Temporary Redirect` to `https://www.quiversurf.app/`.

**Status: WARN** -- The non-www redirect uses 307 (temporary) instead of 301/308 (permanent). This should be a 301 to pass full link equity.

---

## 1B. Core Web Vitals

### TTFB (Time to First Byte)

| Page Type | TTFB | Rating |
|-----------|------|--------|
| Homepage | 0.32s | Good |
| Beach detail | 1.41s | Needs Improvement |
| Tides subpage | 1.02s | Needs Improvement |
| Water temp subpage | 1.15s | Needs Improvement |
| Intent page | 0.98s | Needs Improvement |
| Learn article | 0.29s | Good |
| vs/surfline | 0.10s | Good (prerendered) |
| Forecast accuracy | 0.71s | Needs Improvement |
| City page | 0.50s | Acceptable |
| State page | 0.72s | Needs Improvement |
| **Forecast hub** | **4.82s** | **Poor** |
| Cams | 0.50s | Acceptable |
| Best time to surf | 0.41s | Good |
| Guide | 0.53s | Acceptable |
| Surf schools | 0.38s | Good |
| Tide city | 0.93s | Needs Improvement |
| **Water temp city** | **4.32s** | **Poor** |

**Status: FAIL (2 pages)** -- Forecast hub and water-temp city pages have TTFB >4s. This is a critical server-side performance issue.

**Findings:**
- Pages marked `x-vercel-cache: MISS` with `cache-control: private, no-cache, no-store` are dynamically rendered on every request. This includes beach detail, tides, water-temp, intent, learn, forecast accuracy, city, state, forecast hub, guide, surf schools, tide city, and water-temp city pages.
- Pages marked `x-vercel-cache: HIT` or `PRERENDER` with `x-nextjs-prerender: 1` are pre-rendered and cached. These include: homepage, vs/surfline, and cams.
- The vast majority of content pages (15 of 17 sampled) are fully dynamic with no caching.

### Caching Analysis

| Cache Status | Count | Pages |
|-------------|-------|-------|
| HIT (pre-rendered, cached) | 2 | Homepage, Cams |
| PRERENDER (ISR, fresh) | 1 | vs/surfline |
| MISS (dynamic, uncached) | 14 | All other pages |

**Status: FAIL** -- Only 3 of 17 sampled pages are cached/pre-rendered. The remaining 14 are dynamic on every request, which means:
1. Every crawl hit triggers a full server render
2. TTFB will vary based on server load and database query time
3. Google's crawl budget is consumed by slow dynamic renders

**Recommendation:** Implement ISR (Incremental Static Regeneration) with `revalidate` for beach detail, tides, water-temp, intent, city, and state pages. A 60-300 second revalidation window would dramatically improve TTFB while keeping data fresh.

### Page Size Analysis

| Page Type | Size | Rating |
|-----------|------|--------|
| Homepage | 137KB | Good |
| Beach detail | 173KB | Good |
| Tides subpage | 158KB | Good |
| Water temp | 153KB | Good |
| Intent page | 208KB | Acceptable |
| Learn article | 122KB | Good |
| vs/surfline | 186KB | Good |
| Forecast accuracy | 108KB | Good |
| City page | 228KB | Acceptable |
| **State page** | **443KB** | **Large** |
| **Forecast hub** | **394KB** | **Large** |
| Cams | 242KB | Acceptable |
| Best time to surf | 134KB | Good |
| **Guide** | **769KB** | **Very Large** |
| Surf schools | 113KB | Good |
| **Tide city** | **370KB** | **Large** |
| **Water temp city** | **328KB** | **Large** |

**Status: WARN** -- Guide page at 769KB is very large. State page (443KB), forecast hub (394KB), tide city (370KB), and water-temp city (328KB) are also large. These likely contain extensive server-rendered HTML with many beach listings.

### Image Format Analysis

| Page | WebP | AVIF | PNG | JPG | Assessment |
|------|------|------|-----|-----|------------|
| Homepage | 4 | 0 | 30 | 36 | FAIL - Heavy PNG/JPG usage |
| Beach detail | 0 | 0 | 26 | 92 | FAIL - No modern formats |
| Intent page | 0 | 0 | 26 | 80 | FAIL - No modern formats |
| Learn article | 16 | 0 | 28 | 16 | PARTIAL - Some WebP |
| vs/surfline | 0 | 0 | 30 | 0 | WARN - Only PNG |
| Guide | 0 | 0 | 28 | 0 | WARN - Only PNG |
| Cams | 0 | 0 | 26 | 16 | FAIL - No modern formats |

**Status: FAIL** -- Most pages serve images exclusively in PNG and JPG format with no AVIF support. Only the learn article uses WebP. The beach detail page references 92 JPG images (likely cam thumbnails and beach photos).

**Recommendation:** Use Next.js `<Image>` component with `format: ['avif', 'webp']` to serve modern image formats. This could reduce image payload by 30-60%.

### Response Headers (Security & Performance)

Present on all pages:
- `strict-transport-security: max-age=31536000; includeSubDomains` -- PASS
- `x-content-type-options: nosniff` -- PASS
- `x-frame-options: DENY` -- PASS
- `x-xss-protection: 1; mode=block` -- PASS (though deprecated)
- `referrer-policy: strict-origin-when-cross-origin` -- PASS
- `permissions-policy: geolocation=(self), camera=(), microphone=()` -- PASS
- `x-dns-prefetch-control: on` -- PASS

Missing:
- `Content-Security-Policy` -- **FAIL** -- No CSP header detected on any page. This is a significant security gap.
- `x-robots-tag` -- Not present (correct; page-level directives via meta tags)

Font preloading observed on dynamic pages via `link` header:
- Font: `5c285b27cdda1fe8-s.p.a62025f2.woff2` (preloaded, good)
- CSS chunks: preloaded via HTTP header (good)

### CLS Risk Indicators

- Viewport meta tag present on all pages: `width=device-width, initial-scale=1, viewport-fit=cover` -- PASS
- Font preloading via HTTP `link` header reduces FOIT risk -- PASS
- No explicit `width`/`height` attributes visible on image tags in source -- WARN (may cause CLS)
- Dynamic content loading (beach data, forecast data) may cause layout shifts if not skeleton-loaded -- WARN

### INP Risk Indicators

- Share sheet uses Framer Motion animations (client-side, potential INP impact)
- Multiple client components detected on beach detail pages (interactive charts, map)
- Recommendation: Audit long tasks with Chrome DevTools Performance panel

---

## 1C. Schema Validation

### Global Schema (All Pages)

All pages include an `@graph` block with:
- `Organization` schema for Quiver -- PASS
- `WebSite` schema with search action -- PASS

### Page-Specific Schema

#### Homepage (`/`)

| Schema | Status | Notes |
|--------|--------|-------|
| Organization (via @graph) | PASS | Present |
| WebSite (via @graph) | PASS | Present |
| SoftwareApplication | **FAIL** | **Missing** -- Homepage should declare the app as SoftwareApplication |
| FAQPage | PASS | 8 questions |

#### Beach Detail (`/ca/san-diego/blacks`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place + SportsActivityLocation | PASS | Name: "Blacks Beach", geo coordinates present (32.887, -117.252) |
| BreadcrumbList | PASS | 4 items: Home > CA > San Diego > Blacks Beach |
| FAQPage | PASS | 5 questions |
| WebPage | PASS | Correct URL |
| VideoObject | PASS | Present (live surf cam) |
| HowTo | **FAIL** | **Missing** -- Beach detail pages should include HowTo schema (e.g., "How to surf Blacks Beach") |

#### Tides Subpage (`/ca/san-diego/blacks/tides`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place + SportsActivityLocation | PASS | Inherited from beach |
| BreadcrumbList | PASS | 4 items: Home > Surf Spots Map > Blacks Beach > Tide Chart |
| FAQPage | PASS | 4 questions |
| Dataset | **FAIL** | **Missing** -- Tide data should use Dataset schema per audit spec |

#### Water Temp Subpage (`/ca/san-diego/blacks/water-temp`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place + SportsActivityLocation | PASS | Inherited from beach |
| BreadcrumbList | PASS | 4 items |
| FAQPage | PASS | 4 questions |
| Dataset | **FAIL** | **Missing** -- Water temperature data should use Dataset schema per audit spec |

#### Intent Page (`/beginner/san-diego`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place | PASS | "San Diego, California" |
| ItemList | PASS | 9 items |
| WebPage | PASS | Correct URL |
| BreadcrumbList | PASS | 3 items: Quiver > San Diego Surf > Beginner Spots |
| FAQPage | PASS | 5 questions |

#### Learn Article (`/learn/how-to-read-a-surf-forecast`)

| Schema | Status | Notes |
|--------|--------|-------|
| BreadcrumbList | **WARN** | Uses relative URLs (`/`, `/learn`, `/learn/how-to-read-a-surf-forecast`) instead of absolute URLs. Google requires absolute URLs in schema. |
| FAQPage | PASS | 5 questions |
| WebPage | **WARN** | URL is relative: `/learn/how-to-read-a-surf-forecast` instead of absolute |
| Article | PASS | Correct absolute URL: `https://www.quiversurf.app/learn/how-to-read-a-surf-forecast` |

#### Comparison (`/vs/surfline`)

| Schema | Status | Notes |
|--------|--------|-------|
| BreadcrumbList | **WARN** | Breadcrumb items 2 and 3 both point to the same URL (`/vs/surfline`). Item 2 is labeled "Compare" and item 3 "Quiver vs Surfline" -- this is a degenerate breadcrumb. |
| SoftwareApplication (x2 via @graph) | PASS | Two SoftwareApplication entries (Quiver and Surfline) |
| FAQPage | PASS | 4 questions |

#### Forecast Accuracy (`/forecast-accuracy`)

| Schema | Status | Notes |
|--------|--------|-------|
| BreadcrumbList | PASS | 2 items |
| WebPage | PASS | Correct URL |
| FAQPage (x2) | **FAIL** | **Duplicate FAQPage schemas** -- Two separate FAQPage blocks with 6 questions each. Google may ignore or show errors for duplicate schema types. |

#### City Page (`/beaches/usa/ca/san-diego`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place | PASS | "San Diego, CA" |
| ItemList | PASS | 29 items |
| BreadcrumbList | PASS | 4 items: Quiver > United States > California > San Diego |
| WebPage | PASS | URL uses canonical `/ca/san-diego` |
| FAQPage | PASS | 4 questions |

#### State Page (`/beaches/usa/ca`)

| Schema | Status | Notes |
|--------|--------|-------|
| FAQPage | PASS | Present |
| BreadcrumbList | **FAIL** | **Missing** -- State page has no BreadcrumbList schema |
| WebPage | **FAIL** | **Missing** -- No WebPage schema |
| ItemList | **FAIL** | **Missing** -- Should have ItemList for cities |

#### Forecast Hub (`/forecast`)

| Schema | Status | Notes |
|--------|--------|-------|
| BreadcrumbList | PASS | 2 items |
| WebPage | PASS | Correct URL |

#### Cams Hub (`/cams`)

| Schema | Status | Notes |
|--------|--------|-------|
| BreadcrumbList | PASS | 2 items |
| WebPage | PASS | Correct URL |
| VideoObject | **FAIL** | **Missing** -- Cams hub should declare VideoObject schema for live camera feeds. The beach detail page has VideoObject but the dedicated cams page does not. |

#### Guide (`/guides/surfing-southern-california`)

| Schema | Status | Notes |
|--------|--------|-------|
| BreadcrumbList | PASS | 3 items |
| FAQPage | PASS | 4 questions |
| WebPage | PASS | Correct URL |
| Article | PASS | Correct URL |

#### Tide City (`/tide/san-diego`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place | PASS | "San Diego, California" |
| ItemList | PASS | 23 items |
| WebPage | PASS | Correct URL |
| BreadcrumbList | PASS | 3 items |
| FAQPage | PASS | 3 questions |

#### Water Temp City (`/water-temp/san-diego`)

| Schema | Status | Notes |
|--------|--------|-------|
| Place | PASS | "San Diego, California" |
| ItemList | PASS | 23 items |
| WebPage | PASS | Correct URL |
| BreadcrumbList | PASS | 3 items |
| FAQPage | PASS | 3 questions |

#### Surf Schools (`/for-surf-schools`)

| Schema | Status | Notes |
|--------|--------|-------|
| Organization (via @graph) | PASS | Global only |
| BreadcrumbList | **FAIL** | **Missing** |
| WebPage | **FAIL** | **Missing** |

### Schema Summary

| Issue | Severity | Pages Affected |
|-------|----------|---------------|
| Missing Dataset schema on tide/water-temp subpages | HIGH | ~685 pages (406 water-temp + 279 tides) |
| Missing HowTo schema on beach detail pages | HIGH | ~157 pages |
| Missing SoftwareApplication on homepage | MEDIUM | 1 page |
| Missing VideoObject on cams hub | MEDIUM | 1 page |
| Duplicate FAQPage on forecast-accuracy | MEDIUM | 1 page |
| Relative URLs in learn article BreadcrumbList/WebPage | MEDIUM | ~5 pages (all learn articles) |
| Missing BreadcrumbList/WebPage on state page | MEDIUM | ~11 pages |
| Missing BreadcrumbList/WebPage on surf schools | LOW | 1 page |
| Degenerate breadcrumb on vs/surfline | LOW | 1 page |

---

## 1D. Internal Link Equity

### Footer Links

**Source:** `components/shared/site-footer.tsx` using `lib/constants/footer-links.ts`

The footer renders on all public content pages as a server component (zero JS impact). It contains **21 internal links** across 5 columns:

| Column | Links | Targets |
|--------|-------|---------|
| About | 5 | `/about`, `/features`, `/vs/surfline`, `/for-businesses`, `/for-surf-schools` |
| Browse Beaches | 3 | `/beaches/usa`, `/beaches/mexico`, `/forecast/puerto-rico` |
| Forecasts | 5 | `/forecast`, `/cams`, `/best-time-to-surf`, `/forecast-accuracy`, `/water-temp/san-diego` |
| Explore | 6 | `/beginner/ca`, `/tide/san-diego`, `/dawn-patrol/ca`, `/sunset/ca`, `/least-crowded/ca`, `/longboard/ca` |
| Legal | 2 | `/privacy`, `/terms` |

**Status: PASS** -- Good breadth of links. The footer covers most major page types.

**Status: WARN** -- The "Browse Beaches" column only has 3 links. Consider adding links to top states (California, Hawaii, Florida) or the `/beaches` index page.

### Cross-Navigation (Continue Exploring)

**Source:** `components/shared/continue-exploring.tsx`

This server component renders on intent pages and provides:
- Link back to city hub
- Link to state-level intent page for current intent
- Links to all 6 other intents for the current city
- Optional "Best Time to Surf" link
- Link to forecast hub

**Status: PASS** -- Creates strong cross-linking between related pages at the city level.

### Sibling Cities Section

**Source:** `components/shared/sibling-cities-section.tsx`

Renders up to 8 sibling city links on city hub pages, linking to `/{stateSlug}/{citySlug}`.

**Status: PASS** -- Server-rendered for crawler visibility.

### PopularCitiesForIntent

**Source:** `components/intent/popular-cities-for-intent.tsx`

Renders on state-level intent pages with a two-tier display:
- Top 8 cities: prominent grid
- Remaining cities (9+): compact grid, **always server-rendered**

**Status: PASS** -- All qualifying cities are rendered server-side for crawler discovery. This creates the crawl loop: state intent --> city intent --> city hub --> state intent.

### Potential Orphan Pages

The sitemap contains 1,334 URLs. Internal linking coverage analysis:

| Page Type | In Sitemap | Linked From Footer | Linked From Cross-Nav | Orphan Risk |
|-----------|-----------|-------------------|----------------------|-------------|
| Beach detail pages | 157 | No (too many) | Yes (from city hub) | Low |
| Intent pages | 224 | Yes (6 state links) | Yes (Continue Exploring) | Low |
| Tide city pages | 59 | Yes (1 link) | Yes (Continue Exploring) | Low |
| Water-temp city pages | 59 | Yes (1 link) | Yes (Continue Exploring) | Low |
| Best-time-to-surf pages | 40 | Yes (1 link) | Partial | Medium |
| Guide pages | 11 | No | Unclear | **High** |
| Forecast region pages | 16 | No | Linked from forecast hub | Low |
| Learn articles | 5 | No | Linked from learn hub | Medium |

**Status: WARN** -- Guide pages (11) have no footer links and unclear internal linking. They may be orphaned if not linked from a guides index page or content pages. Learn articles (5) also have limited entry points.

---

## 1E. Content Quality

### Title Tag Analysis

| Page | Title | Length | Status |
|------|-------|--------|--------|
| Homepage | Quiver \| Surf Reports, Forecasts & Conditions | 49 | PASS |
| Beach detail | Blacks Beach: 0.8 ft -- Clean Beach \| San Diego, CA \| Quiver | 59 | PASS |
| Tides subpage | Blacks Beach Tide Chart & Surf Windows \| Mar 2026 | 53 | PASS |
| Water temp | Blacks Beach Water Temp & Wetsuit Guide \| Mar 2026 | 54 | PASS |
| Intent page | 9 Best Beginner Surf Spots in San Diego (2026) \| Quiver | 55 | PASS |
| Learn article | How to Read a Surf Forecast \| Quiver | 36 | PASS |
| vs/surfline | Quiver vs Surfline (2026): Free Surf Forecast Alternative \| Quiver | 66 | **WARN (>60)** |
| Forecast accuracy | Surf Forecast Accuracy -- ML vs NOAA Baseline \| Quiver | 53 | PASS |
| City page | 29 San Diego Surf Spots: Jetty, Beach, Reef & Point \| Quiver | 64 | **WARN (>60)** |
| State page | Surf Beaches in California -- Every City & Break \| Quiver | 60 | PASS |
| Forecast hub | Surf Forecast - 7 Day Regional Surf Conditions \| Quiver | 55 | PASS |
| Cams | Live Surf Cams -- 76+ Cameras Across 10 States \| Quiver | 54 | PASS |
| Best time to surf | Best Time to Surf in the US (2026) \| Month-by-Month Guide \| Quiver | 66 | **WARN (>60)** |
| Guide | Complete Guide to Surfing Southern California \| Quiver | 54 | PASS |
| Surf schools | Free Surf Conditions Widget for Surf Schools \| Quiver | 53 | PASS |
| Tide city | San Diego Tide Chart Today: Next Low 03:00 PM \| Quiver | 54 | PASS |
| Water temp city | San Diego Water Temp: 69F Today \| Wetsuit Guide for March \| Quiver | 67 | **WARN (>60)** |

**Status: WARN** -- 4 titles exceed 60 characters. They will be truncated in SERPs. The water temp city title at 67 chars is the worst offender.

### Meta Description Analysis

| Page | Length | Status |
|------|--------|--------|
| Homepage | 196 | **FAIL (>160)** |
| Beach detail | 146 | PASS |
| Tides subpage | 136 | PASS |
| Water temp subpage | 152 | PASS |
| Intent page | 162 | **WARN (>160)** |
| Learn article | 137 | PASS |
| vs/surfline | 154 | PASS |
| Forecast accuracy | 156 | PASS |
| City page | 155 | PASS |
| State page | 200 | **FAIL (>160)** |
| Forecast hub | 145 | PASS |
| Cams | 124 | PASS |
| Best time to surf | 157 | PASS |
| **Guide** | **648** | **FAIL (>160, severely over)** |
| Surf schools | 135 | PASS |
| Tide city | 158 | PASS |
| Water temp city | 162 | **WARN (>160)** |

**Status: FAIL** -- 3 pages have meta descriptions over 160 characters. The guide page at 648 characters is severely over and will be heavily truncated. The homepage at 196 and state page at 200 will also lose content in SERPs.

### H1 Tag Analysis

| Page | H1 Count | H1 Content | Status |
|------|----------|------------|--------|
| **Homepage** | **0** | **None** | **FAIL** |
| Beach detail | 1 | "Blacks Beach Surf Report" | PASS |
| Tides subpage | 1 | "Blacks Beach Surf Report" | **WARN** (same as parent beach page) |
| Water temp subpage | 1 | "Blacks Beach Surf Report" | **WARN** (same as parent beach page) |
| Intent page | 1 | "Beginner Surf Spots in San Diego" | PASS |
| Learn article | 1 | "How to Read a Surf Forecast" | PASS |
| vs/surfline | 1 | "Quiver vs Surfline" | PASS |
| Forecast accuracy | 1 | "How Accurate Is Quiver's Surf Forecast?" | PASS |
| City page | 1 | "Best Surf Beaches in San Diego" | PASS |
| State page | 1 | "Best surf beaches in California" | PASS |
| Forecast hub | 1 | "Surf Forecast" | PASS |
| Cams | 1 | "Live Surf Cams" | PASS |
| Best time to surf | 1 | "Best Time to Surf in the US (2026)" | PASS |
| Guide | 1 | "Complete Guide to Surfing Southern California" | PASS |
| Surf schools | 1 | "Free Surf Conditions Widget for Your Website" | PASS |
| Tide city | 1 | "Tide conditions for San Diego surf spots" | PASS |
| Water temp city | 1 | "Water temperature in San Diego" | PASS |

**Status: FAIL** -- Homepage has no H1 tag. This is a critical on-page SEO issue.

**Status: WARN** -- Tides and water-temp subpages share the same H1 ("Blacks Beach Surf Report") as the parent beach page. Each subpage should have a unique, descriptive H1 (e.g., "Blacks Beach Tide Chart" and "Blacks Beach Water Temperature").

### Image Alt Text Coverage

| Page | Total Images | With Alt | Empty Alt | Missing Alt | Status |
|------|-------------|----------|-----------|-------------|--------|
| Homepage | 8 | 8 | 0 | 0 | PASS |
| Beach detail | 9 | 9 | 0 | 0 | PASS |
| Intent page | 8 | 8 | 0 | 0 | PASS |
| Learn article | 7 | 7 | 0 | 0 | PASS |
| vs/surfline | 0 | 0 | 0 | 0 | N/A |
| Guide | 0 | 0 | 0 | 0 | N/A |
| Cams | 16 | 16 | 0 | 0 | PASS |

**Status: PASS** -- 100% alt text coverage on all pages with images.

---

## 1F. Social Sharing & OG Audit

### OG Tag Coverage

| Page | og:title | og:desc | og:image | og:url | og:type | twitter:card |
|------|----------|---------|----------|--------|---------|-------------|
| Homepage | PASS | PASS | Static (`/og-image.png`) | PASS | website | summary_large_image |
| Beach detail | PASS | PASS | Dynamic (`/api/og/beach?slug=blacks`) | PASS | website | summary_large_image |
| Tides subpage | PASS | PASS | Dynamic (reuses beach OG) | PASS | website | summary_large_image |
| Water temp | PASS | PASS | Dynamic (reuses beach OG) | PASS | website | summary_large_image |
| Intent page | PASS | PASS | Dynamic (`/api/og/intent?intent=beginner&city=San%20Diego`) | PASS | website | summary_large_image |
| Learn article | PASS | PASS | Dynamic (`/api/og/guide?title=...`) | PASS | website | summary_large_image |
| vs/surfline | PASS | PASS | Static (`/og-image.png`) | PASS | website | summary_large_image |
| Forecast accuracy | PASS | PASS | Dynamic (`/api/og/forecast-accuracy`) | PASS | website | summary_large_image |
| City page | PASS | PASS | Static (`/images/og-location-default.jpg`) | PASS | website | summary_large_image |
| State page | PASS | PASS | Static (`/og-image.png`) | PASS | website | summary_large_image |
| Forecast hub | PASS | PASS | Static (`/og-image.png`) | PASS | website | summary_large_image |
| Cams | PASS | PASS | Dynamic (`/api/og/cams`) | PASS | website | summary_large_image |
| Best time to surf | PASS | PASS | Static (`/og-image.png`) | PASS | website | summary_large_image |
| Guide | PASS | **FAIL** (missing) | Dynamic (`/api/og/guide?title=...`) | PASS | website | summary_large_image |
| Surf schools | PASS | PASS | Static (`/og-image.png`) | PASS | website | summary_large_image |
| Tide city | PASS | PASS | Dynamic (`/api/og/intent?intent=tide&city=San%20Diego`) | PASS | website | summary_large_image |
| Water temp city | PASS | PASS | Dynamic (`/api/og/intent?intent=water-temp&city=San%20Diego`) | PASS | website | summary_large_image |

**Status: FAIL (1 page)** -- Guide page is missing `og:description`. This means social shares will show no description text.

### OG Image Endpoint Verification

| Endpoint | Status | Content-Type | Cache |
|----------|--------|-------------|-------|
| `/api/og/beach?slug=blacks` | 200 | image/png | max-age=86400 (1 day) |
| `/og-image.png` (static fallback) | 200 | image/png | public |

**Status: PASS** -- OG image endpoints return valid images.

### Dynamic vs Static OG Images

| OG Image Type | Pages Using |
|--------------|-------------|
| Dynamic `/api/og/beach` | Beach detail, tides, water-temp subpages |
| Dynamic `/api/og/intent` | Intent pages, tide city, water-temp city |
| Dynamic `/api/og/guide` | Learn articles, guide pages |
| Dynamic `/api/og/forecast-accuracy` | Forecast accuracy |
| Dynamic `/api/og/cams` | Cams hub |
| Static `/og-image.png` | Homepage, vs/surfline, forecast hub, best-time-to-surf, surf schools, state page |
| Static `/images/og-location-default.jpg` | City pages |

**Status: WARN** -- 6 pages use the generic `/og-image.png` fallback. Consider creating dynamic OG images for:
- vs/surfline (high-value comparison page)
- best-time-to-surf
- surf schools

### OG Image Encoding Issue

The guide page's `og:image` URL contains `&amp;` instead of `&`:
```
https://www.quiversurf.app/api/og/guide?title=Complete%20Guide%20to%20Surfing%20Southern%20California&amp;region=Southern...
```

**Status: WARN** -- The `&amp;` is correct HTML encoding within a meta tag, but some social media crawlers may not decode this properly. Verify with Facebook Sharing Debugger and Twitter Card Validator.

### OG Image Endpoints (Codebase)

12 OG image endpoints exist at `app/api/og/`:
1. `/api/og/beach` -- Beach-specific share cards
2. `/api/og/cams` -- Cams page share card
3. `/api/og/forecast-accuracy` -- Accuracy page share card
4. `/api/og/guide` -- Guide/learn page share cards
5. `/api/og/intent` -- Intent page share cards
6. `/api/og/progression` -- Monthly progression recap (user-generated)
7. `/api/og/session` -- Session share cards (user-generated)
8. `/api/og/streak` -- Streak milestone share cards (user-generated)
9. `/api/og/surf-call` -- Surf call share cards (user-generated)
10. `/api/og/water-quality` -- Water quality share cards
11. `/api/og/wave` -- Wave share cards
12. `/api/og/weekend-wave-check` -- Weekend wave check share cards

### Share Sheet Usage

`components/share/share-sheet.tsx` is used by:
- `components/beach-detail/unified-surf-card.tsx` -- Beach surf conditions
- `components/oracle/oracle-home-screen.tsx` -- Oracle home screen
- `components/journal/journal-view.tsx` -- Session journal
- `components/home-screen/primary-actions.tsx` -- Home screen actions
- `app/sessions/new/page.tsx` -- New session page
- `components/oracle/invite-sheet.tsx` -- Oracle invite

The ShareSheet supports "wave" and "session" content types. It provides Copy Link, Save Image, and native share (via `navigator.share`).

### navigator.share Usage

Found in 9 files across the codebase:
- `lib/share/share-image.ts` -- Core share utility
- `components/beach-detail/best-surf-window.tsx` -- Best surf window sharing
- `components/profile/referral-leaderboard.tsx` -- Referral sharing
- `components/cams/cams-share-button.tsx` -- Cam sharing
- `components/intent/smart-checklist.tsx` -- Checklist sharing
- `components/journal/progression-dashboard.tsx` -- Progression sharing

**Status: PASS** -- Good coverage of sharing functionality across key user touchpoints.

### Unused URL Builders

In `lib/share/build-share-card-url.ts`:
- `buildWaveShareUrl` -- Only referenced in the definition file itself, not imported elsewhere. **Potentially unused.**
- `buildSessionShareUrl` -- Used in session components
- `buildSurfCallShareUrl` -- Used in surf call components
- `buildProgressionShareUrl` -- Used in progression dashboard
- `buildStreakShareUrl` -- Used in streak components

**Status: INFO** -- `buildWaveShareUrl` appears unused. Consider cleaning up or documenting its intended use.

---

## 1G. IndexNow Protocol

**Status: NOT IMPLEMENTED**

No IndexNow implementation found in the codebase. No files reference "IndexNow" or "indexnow".

IndexNow enables instant URL submission to Bing, Yandex, and Naver when content changes. For a site with ~9,100 URLs and dynamic forecast data, IndexNow would ensure search engines discover content updates faster than waiting for crawl.

**Recommendation:** Implement IndexNow API key at `/.well-known/indexnow` and trigger submissions when:
- New beach pages are created
- Forecast data updates (every 3 hours)
- New guide/learn articles are published

---

## Prioritized Fix List

### Critical (Fix Immediately)

| # | Issue | Impact | Pages Affected |
|---|-------|--------|---------------|
| C1 | Forecast hub TTFB is 4.82s | Poor CWV, crawl budget waste | `/forecast` + all forecast region pages |
| C2 | Water-temp city TTFB is 4.32s | Poor CWV, crawl budget waste | `/water-temp/{city}` (~59 pages) |
| C3 | Homepage missing H1 tag | Critical on-page SEO signal missing | Homepage |
| C4 | Sitemap only contains 1,334 of ~9,100 URLs | ~85% of pages may not be discovered via sitemap | Site-wide |

### High (Fix This Sprint)

| # | Issue | Impact | Pages Affected |
|---|-------|--------|---------------|
| H1 | No caching on 14 of 17 page types | Every request triggers full SSR, slow TTFB, crawl budget waste | ~9,000+ pages |
| H2 | Missing Dataset schema on tide/water-temp subpages | Missing rich result eligibility for data-rich pages | ~685 pages |
| H3 | Missing HowTo schema on beach detail pages | Missing rich result eligibility | ~157 pages |
| H4 | No Content-Security-Policy header | Security vulnerability | All pages |
| H5 | Guide page meta description is 648 chars | Truncated to uselessness in SERPs | Guide pages (~11) |
| H6 | Homepage meta description is 196 chars | Truncated in SERPs | Homepage |
| H7 | No modern image formats (WebP/AVIF) on most pages | Larger payloads, slower LCP | All pages with images |
| H8 | Tides/water-temp subpages share parent H1 | Duplicate H1 signals, confuses topic targeting | ~685 pages |

### Medium (Fix Next Sprint)

| # | Issue | Impact | Pages Affected |
|---|-------|--------|---------------|
| M1 | Missing SoftwareApplication schema on homepage | Missing app-specific rich results | Homepage |
| M2 | Missing VideoObject schema on cams hub | Missing video rich results on dedicated cams page | `/cams` |
| M3 | Duplicate FAQPage schema on forecast-accuracy | Schema validation warning | `/forecast-accuracy` |
| M4 | Relative URLs in learn article JSON-LD | Schema validation warning, Google requires absolute URLs | ~5 learn articles |
| M5 | State page missing BreadcrumbList/WebPage/ItemList schema | Reduced structured data signals | ~11 state pages |
| M6 | Guide page missing og:description | No description text in social shares | ~11 guide pages |
| M7 | 4 title tags exceed 60 characters | Truncation in SERPs | 4 pages |
| M8 | State page meta description is 200 chars | Truncation in SERPs | ~11 state pages |
| M9 | Non-www redirect uses 307 instead of 301 | Temporary redirect does not pass full link equity | Domain redirect |
| M10 | 6 pages use generic fallback OG image | Lower click-through on social shares | 6 pages |

### Low (Backlog)

| # | Issue | Impact | Pages Affected |
|---|-------|--------|---------------|
| L1 | No IndexNow implementation | Slower indexing of content updates | Site-wide |
| L2 | Degenerate breadcrumb on vs/surfline | Minor schema quality issue | 1 page |
| L3 | Surf schools page missing BreadcrumbList/WebPage schema | Minor structured data gap | 1 page |
| L4 | `buildWaveShareUrl` appears unused | Dead code | Codebase cleanup |
| L5 | Guide pages may be orphaned (limited internal linking) | Discovery issues for 11 pages | ~11 guide pages |
| L6 | "Browse Beaches" footer column only has 3 links | Missed internal linking opportunity | All pages |
| L7 | Large page sizes (guide 769KB, state 443KB, forecast 394KB) | Slow download, potential LCP impact | 5 pages |

---

## Appendix: Raw Data

### Sitemap URL Count by Pattern

```
beach/water-temp subpage: 406
beach/tides subpage:      279
intent page:              224
beach detail:             157
tide city:                 59
water-temp city:           59
best-time-to-surf:         40
city hub:                  28
other/static:              24
forecast region:           16
location hierarchy:        11
guide:                     11
cams subpage:               8
learn article:              5
landing:                    2
forecast hub:               2
home:                       1
comparison:                 1
cams hub:                   1
TOTAL:                  1,334
```

### Security Headers Summary

| Header | Present | Value |
|--------|---------|-------|
| Strict-Transport-Security | Yes | max-age=31536000; includeSubDomains |
| X-Content-Type-Options | Yes | nosniff |
| X-Frame-Options | Yes | DENY |
| X-XSS-Protection | Yes | 1; mode=block |
| Referrer-Policy | Yes | strict-origin-when-cross-origin |
| Permissions-Policy | Yes | geolocation=(self), camera=(), microphone=() |
| X-DNS-Prefetch-Control | Yes | on |
| Content-Security-Policy | **No** | Missing |
| X-Robots-Tag | No | Not needed (using meta tags) |

### Cache Status by Page Type

| Page | x-vercel-cache | x-nextjs-prerender | cache-control |
|------|---------------|-------------------|---------------|
| Homepage | HIT | 1 | public, max-age=0, must-revalidate |
| vs/surfline | PRERENDER | 1 | public, max-age=0, must-revalidate |
| Cams | HIT | 1 | public, max-age=0, must-revalidate |
| All other pages | MISS | absent | private, no-cache, no-store, max-age=0, must-revalidate |
