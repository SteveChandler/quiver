# Team 3: Refinement Strategy & Social Sharing Overhaul

**Audit Date:** 2026-03-30
**Scope:** Existing page optimization, social sharing infrastructure, widget distribution
**Priority Focus:** Social sharing overhaul (highest-impact growth lever)

---

## 1. Executive Summary: Top 5 Highest-Impact Refinements

| # | Refinement | Est. Impact | Effort |
|---|-----------|-------------|--------|
| 1 | Wire ShareSheet to beach detail pages (279+ highest-traffic pages have ZERO share buttons) | Very High -- viral loops from every beach page | Medium |
| 2 | Connect 3 orphaned OG endpoints (progression, streak, wave) to their UI components | High -- enables visual sharing for session milestones | Low |
| 3 | Move /forecast-accuracy from force-dynamic to ISR (currently not indexed by Google) | High -- unlocks most linkable asset for crawling | Low |
| 4 | Add 7 missing states to Organization schema areaServed (ME, NH, MA, RI, SC, GA, TX) | Medium -- schema completeness for GEO/AI search | Low |
| 5 | Create dedicated OG images for /vs/surfline, /learn hub, and tide/water-temp sub-pages | Medium -- improves CTR on social shares of key pages | Medium |

---

## 2. Page Optimization Audit (3A)

### 2.1 Meta Title/Description Analysis (`lib/seo/meta.ts`)

**Title Generation: STRONG**

The 3-tier fallback system in `buildDynamicBeachMetadata` is well-engineered:

- **Tier 1 (with forecast + wave character + break type):** `Pipeline: 6-8ft -- Hollow Reef | Haleiwa, HI` -- keyword-rich, data-forward, differentiated from Surfline's pattern.
- **Tier 2 (with forecast + skill + break type):** `Pipeline: 6-8ft -- Advanced Reef | Haleiwa` -- still compelling.
- **Tier 3 (minimal data):** `Pipeline: 6-8ft Today | Surf Report` -- clean fallback.
- **No-forecast path** has its own 3-tier system with break type, crowd signal, and location suffix.

The `MAX_TITLE_LENGTH = 60` is correctly enforced. The `buildTitleLocationSuffix` function progressively shortens location context (city+expanded state, city+abbrev, city only, state only) to fit within budget. This is best-in-class for programmatic SEO.

**Findings:**

1. **Primary keyword front-loading: GOOD.** Beach name is always first, wave height is second when available. This matches user search patterns (`{beach} surf report`, `{beach} surf forecast`).

2. **Tide page titles: IMPROVED.** The comment history shows a pivot from "Best Tide to Surf {Beach}" (0% CTR on 1,200 impressions) to `{Beach} Tide Chart & Surf Windows | Mar 2026` -- correctly matching query intent. The month+year freshness token is a smart differentiator.

3. **Water temp page titles: IMPROVED.** Same pattern pivot from "What Wetsuit for {Beach}?" (0% CTR on 766 impressions) to `{Beach} Water Temp & Wetsuit Guide | Mar 2026`. Correctly serves informational intent while signaling unique value.

4. **Potential issue: State expansion is limited.** Only PR and HI are expanded in `META_STATE_EXPANSIONS`. This is intentional (CA, OR, WA, FL are widely recognized), but consider expanding TX (Texas) and MA (Massachusetts) since those abbreviations are less universally recognized in a surf context.

**Description Generation: STRONG**

- WITH forecast: `3-5ft at Pipeline, Haleiwa, Hawaii. {wave_tips snippet}. Rated 4.8/5. 7-day surf forecast, crowd intel & optimal windows.` -- uses full 160-char budget effectively.
- WITHOUT forecast: Gracefully degrades with `description_excerpt`, crowd signal, and rating.
- The `extractDescriptionSnippet` function correctly handles sentence boundaries, clause breaks, and weak trailing words. Well-tested edge cases.

**Gap:** No meta descriptions mention "free" despite this being a key differentiator vs Surfline. The title strategy comment explicitly says "No 'Free' in titles or descriptions" which is defensible for CTR (data richness > price signaling), but worth A/B testing on a subset.

### 2.2 Global SEO Config (`lib/constants/seo.ts`)

**Keywords (29 total): INCOMPLETE**

Current keywords cover California, Hawaii, Florida, Puerto Rico, New Jersey, and Oregon. Missing high-volume keywords for coverage areas that have beaches:

| Missing Keyword | Est. Monthly Volume |
|----------------|-------------------|
| `New York surf report` | 1,000-2,500 |
| `North Carolina surf report` | 1,500-3,000 |
| `South Carolina surf report` | 500-1,000 |
| `Texas surf report` | 1,000-2,500 |
| `Washington surf report` | 500-1,000 |
| `Maine surf report` | 200-500 |
| `Georgia surf report` | 200-500 |
| `Massachusetts surf report` | 500-1,000 |
| `water temperature {beach}` | varies |
| `tide chart today` | 5,000-10,000 |
| `surf conditions near me` | 3,000-5,000 |

**Recommendation:** Add 10-12 keywords to cover all 17+ states and high-intent transactional queries.

**Organization Schema: INCOMPLETE**

`areaServed` lists only 10 areas but Quiver covers 17+ states. Missing from schema:

- Maine, New Hampshire, Massachusetts, Rhode Island (New England)
- South Carolina, Georgia (Southeast)
- Texas (Gulf Coast)

This is an E-E-A-T and GEO (Generative Engine Optimization) issue. AI search systems that consume structured data will not associate Quiver with these regions.

**Social Links: SPARSE**

`sameAs` only lists Bluesky and X/Twitter. If Quiver has Instagram, TikTok, YouTube, or Facebook profiles, they should be added. Missing profiles reduce entity confidence in Knowledge Graph.

### 2.3 Content Quality Assessment

**City Content Generator (`lib/seo/city-content-generator.ts`): GOOD**

- Generates 200-400 words of unique content per city page.
- Data-driven: skill counts, break type distribution, water temp ranges, top beach ratings.
- Rich content variant with internal links to beach detail pages (`linkFirstMentions`).
- FAQs are substantive (4-7 per city) with editorial layer for cities with Layer 2 content.
- **No thin content risk** -- every city page has at minimum 4 data-backed paragraphs + 4 FAQs.

**Intent Content Templates (`lib/seo/intent-content-templates.ts`): GOOD**

- 7 intent types, each with unique intro copy, title, heading, and meta description.
- Climate-zone-aware water temp intros (tropical, warm-atlantic, cold-pacific, etc.).
- Dynamic data injection (tide times, water temp) into titles and descriptions.
- `DATA_FRESHNESS_SUFFIX = "Updated hourly with live buoy data."` signals data currency.
- **Minor concern:** The longboard, dawn-patrol, and sunset intents have shorter, less differentiated intros compared to beginner and tide. Consider expanding these with more location-specific data points.

### 2.4 /forecast-accuracy ISR Recommendation

**Current State:** `export const dynamic = "force-dynamic"` (line 32 of `app/forecast-accuracy/page.tsx`).

**Problem:** Google site search for `site:quiversurf.app forecast-accuracy` returns zero results. This page is likely not being indexed because:
1. `force-dynamic` means every request is a fresh server render with no caching headers.
2. Without caching, Googlebot may encounter slow response times or timeouts.
3. The page fetches from `getOverallAccuracyStats()`, `getRegionalAccuracy()`, and `getTopBeaches()` -- three server actions that hit a materialized view.

**Analysis:** The page already has a "data building" fallback state for when `beachCount < 5`. The materialized view data changes at most daily. There is no user-specific content (no auth check, no cookies needed). The page has structured data (`BreadcrumbStructuredData`, `WebPageSchema`), FAQ schema, and a dedicated OG image endpoint.

**Recommendation: Switch to ISR with `revalidate = 21600` (6 hours).**

Change line 32 from:
```ts
export const dynamic = "force-dynamic";
```
to:
```ts
export const revalidate = 21600; // 6 hours -- accuracy data updates daily from materialized view
```

This is a one-line change with high impact. The /forecast-accuracy page is Quiver's most linkable asset (original research with data visualizations). Keeping it out of the index is a significant missed opportunity for earning editorial backlinks.

**Risk:** Near zero. The underlying materialized view (`beach_ml_performance_baseline`) refreshes on a schedule, not per-request. 6-hour staleness is acceptable for daily-updated data.

---

## 3. Social Sharing Overhaul Spec (3B) -- MAIN DELIVERABLE

### 3.1 Current State Inventory

#### OG Image Endpoints (8 confirmed)

| Endpoint | Wired to Meta Tags | Wired to Share UI | Status |
|----------|-------------------|-------------------|--------|
| `/api/og/session` | No | Yes (ShareSheet) | ACTIVE |
| `/api/og/surf-call` | No | Yes (ShareSheet) | ACTIVE |
| `/api/og/beach?slug=` | Yes (beach pages, tide, water-temp sub-pages) | No | META ONLY |
| `/api/og/intent?intent=&city=` | Yes (intent pages) | No | META ONLY |
| `/api/og/guide?title=&region=` | Yes (learn articles) | No | META ONLY |
| `/api/og/forecast-accuracy` | Yes (forecast-accuracy page) | No | META ONLY |
| `/api/og/wave` | No | No | ORPHANED |
| `/api/og/progression` | No | No | ORPHANED |
| `/api/og/streak` | No | No | ORPHANED |

**3 endpoints are fully orphaned** -- built but never used. The URL builder functions exist in `lib/share/build-share-card-url.ts` (lines 66-74 for wave, 246-269 for progression, 278-289 for streak) but are not imported anywhere.

**3 endpoints are "meta-only"** -- they generate OG images that appear when the page URL is shared externally (social previews), but there is no in-app UI to trigger sharing of these pages.

#### Share UI Components

| Component | File | Used By | Mechanism |
|-----------|------|---------|-----------|
| `ShareSheet` | `components/share/share-sheet.tsx` | Post-session modal, journal cards, unified surf card | Copy Link / Save Image / Native Share -- full styled UI with preview |
| `PostSessionShare` | `components/session/post-session-share.tsx` | Post-session flow | Celebration overlay with confetti + Share CTA |
| `CamsShareButton` | `components/cams/cams-share-button.tsx` | Cams page | URL-only share, no image, uses raw `navigator.share` with clipboard fallback |

#### Pages WITH Share Functionality

| Page/Component | Share Type | OG Image | Quality |
|---------------|-----------|----------|---------|
| Post-session modal | ShareSheet (image) | `/api/og/session` | EXCELLENT -- full preview, copy/save/share |
| Journal session cards | ShareSheet (image) | `/api/og/session` | EXCELLENT |
| Unified surf card (forecast) | ShareSheet (image) | `/api/og/surf-call` | EXCELLENT |
| Cams page | CamsShareButton (URL only) | None (generic) | BASIC -- no image, no styled sheet |

#### Pages MISSING Share Functionality

| Page Type | Traffic Level | Page Count | Impact of Adding Share |
|-----------|-------------|-----------|----------------------|
| **Beach detail pages** | HIGHEST | 279+ | **CRITICAL** -- these are the most-visited pages. Every surfer checking conditions should be able to share "3-5ft at Pipeline right now" with their crew. |
| Tide sub-pages | High | 279+ | HIGH -- tide charts are frequently texted to friends before sessions |
| Water-temp sub-pages | Medium | 279+ | MEDIUM -- seasonal relevance ("water is 58F, bring the 4/3") |
| Intent pages (beginner, tide, etc.) | Medium | 1,500+ | MEDIUM -- "Hey I found these beginner spots in Santa Cruz" |
| City/state listing pages | Medium | 200+ | LOW-MEDIUM -- less share-worthy than specific conditions |
| /vs/surfline comparison | Medium | 1 | MEDIUM -- word-of-mouth comparison sharing |
| Learn articles | Low-Medium | 3+ | LOW-MEDIUM -- educational content sharing |
| /forecast-accuracy | Low | 1 | MEDIUM -- but high value for link building |
| User profiles | Low | varies | MEDIUM -- identity/community sharing |

#### Pages with Raw `navigator.share` (No Styled UI)

Based on the task brief, these components use raw `navigator.share` calls without the styled ShareSheet:
- Progression dashboard
- Best surf window
- Referral leaderboard
- Smart checklist

These should be upgraded to use ShareSheet for consistency and to include image previews.

### 3.2 Prioritized Fix List

#### P0: Beach Detail Page Share Button (HIGHEST IMPACT)

**What:** Add a share button to the beach detail page header or hero section that opens ShareSheet with the beach OG image.

**Why:** 279+ beach pages are the highest-traffic pages on the site. Every surfer who checks conditions is a potential sharer. The OG endpoint (`/api/og/beach?slug=`) already exists and generates rich images. The only missing piece is a button.

**Files to modify:**
- `components/beach-detail/beach-hero.tsx` or `components/beach-detail/beach-quick-actions.tsx` -- add a share button alongside existing Plan/Log/Favorite actions
- The share button should use `ShareSheet` with:
  - `imageUrl`: `/api/og/beach?slug=${beach.slug}`
  - `type`: `"wave"` (or add a new `"beach"` type)
  - `title`: `${beach.name} Surf Report`
  - `text`: Dynamic text with current conditions if available
  - `shareUrl`: current page URL

**Implementation pattern:**
```tsx
// In beach-quick-actions.tsx or a new BeachShareButton component
const [shareOpen, setShareOpen] = useState(false);
const ogImageUrl = `/api/og/beach?slug=${beach.slug}`;

<ShareSheet
  open={shareOpen}
  onOpenChange={setShareOpen}
  imageUrl={ogImageUrl}
  type="wave"
  filename={`quiver-${beach.slug}`}
  title={`${beach.name} Surf Report`}
  text={`Check out conditions at ${beach.name}`}
/>
```

**Estimated impact:** HIGH. If 5% of beach page visitors share (conservative for a surf audience that group-texts before sessions), this creates significant organic distribution. Each share carries a rich OG preview image.

#### P1: Wire Orphaned OG Endpoints to UI

**3a. Progression share** (`buildProgressionShareUrl` at `lib/share/build-share-card-url.ts:246`)

The `/api/og/progression` endpoint generates monthly recap cards (sessions, hours, avg rating, top skill, streak). This should be wired to:
- The monthly progression summary component (wherever the progression dashboard lives)
- A "Share Your Month" CTA that opens ShareSheet with the progression image

**3b. Streak share** (`buildStreakShareUrl` at `lib/share/build-share-card-url.ts:278`)

The `/api/og/streak` endpoint generates streak milestone cards. This should trigger on streak milestones (3, 5, 7, 10, 14, 21, 30 days) with a celebration modal similar to `PostSessionShare`.

**3c. Wave share** (`buildWaveShareUrl` at `lib/share/build-share-card-url.ts:66`)

The `/api/og/wave` endpoint is the simplest (wave size + description). This could serve as a lightweight share option for the conditions ticker or forecast overview -- "Waves are 3-5ft and clean at Pipeline."

**Estimated impact:** MEDIUM-HIGH. Milestone shares (progression recaps, streak milestones) are the highest-conversion share moments. Users are emotionally engaged and want to show achievement to their crew.

#### P2: CamsShareButton Upgrade

**What:** Replace the basic `CamsShareButton` (66 lines, URL-only) with a proper ShareSheet integration that includes an image preview.

**Current state:** The cam page share copies a URL with UTM params. No OG image is used.

**Recommendation:** Either:
- Create a `/api/og/cam` endpoint that generates a branded "Live Cam at {Beach}" card
- Or use the existing `/api/og/beach?slug=` endpoint as a fallback

**File to modify:** `components/cams/cams-share-button.tsx`

**Estimated impact:** LOW-MEDIUM. Cam pages get traffic but cam sharing is less viral than conditions sharing.

#### P3: Upgrade Raw `navigator.share` Calls

Four components use raw `navigator.share` without styled UI:

| Component | Upgrade Path |
|-----------|-------------|
| Progression dashboard | Wire to ShareSheet + `/api/og/progression` (see P1) |
| Best surf window | Wire to ShareSheet + `/api/og/surf-call` (reuse existing endpoint) |
| Referral leaderboard | Wire to ShareSheet + create simple leaderboard OG or use generic |
| Smart checklist | Wire to ShareSheet + create checklist OG or use generic |

Each needs: (1) a trigger button styled like the ShareSheet action, (2) connection to an appropriate OG image endpoint, and (3) analytics tracking via the existing `track("share_*")` pattern.

**Estimated impact:** MEDIUM. The progression dashboard and best surf window are medium-traffic features with high emotional moments (sharing your surf plan or monthly recap).

#### P4: Add Share Buttons to Content Pages

**What:** Add a "Share this page" button to:
- `/vs/surfline` -- word-of-mouth comparison page, surfers love sending these to friends
- `/learn/{slug}` articles -- educational sharing
- `/forecast-accuracy` -- link-building through academic/data community sharing
- Intent pages (e.g., `/beginner/santa-cruz`) -- "Hey, check out these beginner spots"

**Mechanism:** These pages don't need full ShareSheet with image download. A simpler `CopyLinkButton` component (like CamsShareButton but styled consistently) that copies the URL with UTM params and uses `navigator.share` as the primary action.

**Estimated impact:** LOW-MEDIUM per page, but cumulatively meaningful across 1,500+ intent pages.

### 3.3 OG Image Coverage Gaps

#### Pages Using Generic Fallback OG Image

These pages use `buildPageMetadata` without an `image` parameter, so they fall back to the generic `/og-image.png`:

| Page | Should Have Custom OG |
|------|---------------------|
| `/vs/surfline` | YES -- a branded comparison graphic would dramatically improve social CTR |
| `/learn` hub | NICE TO HAVE -- branded "Learn to Surf Smarter" image |
| `/for-surf-schools` | YES -- shows a widget preview, would encourage sharing by surf schools |
| `/for-businesses` | YES -- same as above for coastal businesses |
| `/map` | NICE TO HAVE |
| `/about` | NICE TO HAVE |
| `/beaches` | NICE TO HAVE |

**Highest priority:** `/vs/surfline` custom OG image. This page targets "surfline alternative" keywords and is frequently shared in surf forums and social media. A compelling comparison graphic increases click-through from every share.

#### Tide/Water-Temp Sub-Pages Reuse Beach OG

Both `tides/` and `water-temp/` sub-pages use `image: /api/og/beach?slug=${beachSlug}` -- the same OG image as the parent beach page. This means when someone shares a tide chart URL, the social preview shows the generic beach card rather than tide-specific data.

**Recommendation:** Create dedicated OG endpoints:
- `/api/og/tide?slug={slug}` -- shows beach name + next high/low + tide curve mini-graphic
- `/api/og/water-temp?slug={slug}` -- shows beach name + current temp + wetsuit rec

**Estimated impact:** MEDIUM. Tide chart URLs are commonly texted between surfers. A preview showing "High 5.2ft at 2:15 PM" is much more useful than a generic beach card.

### 3.4 ShareSheet Component Assessment

The existing `ShareSheet` component (`components/share/share-sheet.tsx`, 371 lines) is well-built:

**Strengths:**
- Three clear actions: Copy Link, Save Image, More (native share)
- Pre-fetches image blob when sheet opens for instant Save
- UTM parameter injection via `URL` constructor (safe, not string concatenation)
- Analytics tracking on every action (`share_link_copied`, `share_image_saved`, `share_started`, `share_completed`)
- Server-side event logging via `/api/events` with `keepalive: true`
- Proper timer cleanup on close/unmount (avoids stale state)
- Accessibility: screen reader status announcements, aria-labels
- Framer Motion animations respecting `prefers-reduced-motion`
- Styled with the brand design system (Deep Twilight gradients, Charming Orange accents, sticker-style border radius)

**One concern:** The `type` prop is currently `"wave" | "session"`. Adding beach, tide, progression, streak types would require extending this union. Consider making it a string type or adding the new variants.

---

## 4. Widget Distribution Assessment (3C)

### 4.1 /for-surf-schools Page

**SEO Meta: GOOD**
- Title: "Free Surf Conditions Widget for Surf Schools" (49 chars -- within 60-char limit)
- Description: "Embed real-time wave, wind, and tide data on your surf school website. Always current, no code needed, free forever. Powered by Quiver." (136 chars -- uses budget well)
- Keywords: 5 relevant terms including "surf school widget" and "free surf forecast widget"
- ISR: `revalidate = 86400` (24 hours) -- appropriate for static content

**Gaps:**
1. **No schema markup.** Should have `SoftwareApplication` or `WebApplication` schema with `offers.price: 0`. This would help surface in "free surf widget" searches.
2. **No OG image.** Falls back to generic `/og-image.png`. Should have a custom image showing the widget in action.
3. **Missing keywords:** "surf school website conditions", "surf lesson weather widget", "beach conditions widget free"

### 4.2 /for-businesses Page

**SEO Meta: GOOD**
- Title: "Free Surf Conditions Widget for Coastal Businesses" (52 chars)
- Description: "Add live wave, wind, and tide data to your business website. Perfect for hotels, restaurants, and vacation rentals. Free forever, no code needed." (144 chars)
- Keywords: 5 relevant terms

**Gaps:**
1. **Same as surf-schools:** No schema markup, no custom OG image.
2. **Missing keywords:** "beach hotel weather widget", "vacation rental surf widget", "restaurant beach conditions"

### 4.3 Widget Attribution Audit

Both embed widget types (conditions and tides) have consistent "Powered by Quiver" attribution:
- **Conditions widget** (`app/embed/conditions/[slug]/embed-conditions-widget.tsx` line 123): "Powered by Quiver" link pointing to the beach page URL
- **Tides widget** (`app/embed/tides/[slug]/embed-tide-widget.tsx` line 73): Same pattern

**Attribution quality: GOOD**
- Links use `target="_blank"` with `rel="noopener"` (noreferrer intentionally omitted to preserve Referer for analytics)
- Links point to the specific beach page, not the homepage (better for SEO)
- Styled subtly (small text, muted colors) but visible

**Gap:** The `nofollow` attribute is NOT present on attribution links. This is actually beneficial -- every embed creates a followed backlink to the beach page. However, there is no `title` attribute on the links to provide additional context for screen readers and search engines.

### 4.4 Widget SEO Recommendations

1. **Add SoftwareApplication schema** to both `/for-surf-schools` and `/for-businesses`:
```json
{
  "@type": "SoftwareApplication",
  "name": "Quiver Surf Conditions Widget",
  "applicationCategory": "WebApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "featureList": ["Real-time surf conditions", "Tide charts", "Wave height", "Wind data"]
}
```

2. **Create shareable widget preview URLs.** Currently, the embed promo pages render a `MockBrowserWindow` with a live iframe preview. Make these previews directly linkable (e.g., `/for-surf-schools?beach=ocean-beach&preview=1`) so outreach emails can include a live preview link.

3. **Add embed tracking landing page.** When someone clicks "Powered by Quiver" from an embed, they arrive at the beach page with no context. Consider adding a UTM parameter to attribution links (`?utm_source=embed&utm_medium=widget`) to track widget-driven traffic.

---

## 5. Prioritized Action Items

Ranked by (SEO/viral impact) x (1 / implementation effort):

| Priority | Action | Impact | Effort | Files |
|----------|--------|--------|--------|-------|
| **P0-A** | Add ShareSheet to beach detail pages | Very High | Medium | `components/beach-detail/beach-quick-actions.tsx` or new `BeachShareButton` component |
| **P0-B** | Move /forecast-accuracy to ISR (revalidate=21600) | High | Trivial | `app/forecast-accuracy/page.tsx` line 32: change `force-dynamic` to `revalidate = 21600` |
| **P0-C** | Add 7 missing states to Organization schema areaServed | Medium | Trivial | `lib/constants/seo.ts` -- add ME, NH, MA, RI, SC, GA, TX objects |
| **P1-A** | Wire `buildProgressionShareUrl` to progression UI with ShareSheet | High | Medium | Progression dashboard component + ShareSheet integration |
| **P1-B** | Wire `buildStreakShareUrl` to streak milestone celebration | High | Medium | Streak milestone component + celebration modal |
| **P1-C** | Add 10-12 missing keywords to SEO_CONFIG | Medium | Trivial | `lib/constants/seo.ts` keywords array |
| **P1-D** | Create custom OG image for /vs/surfline | Medium | Medium | New `/api/og/vs-surfline/route.tsx` + update `app/vs/surfline/page.tsx` metadata |
| **P2-A** | Upgrade CamsShareButton to use ShareSheet | Low-Medium | Low | `components/cams/cams-share-button.tsx` |
| **P2-B** | Wire `buildWaveShareUrl` to conditions ticker share | Medium | Low | Conditions ticker component |
| **P2-C** | Upgrade 4 raw `navigator.share` calls to styled ShareSheet | Medium | Medium | Progression dashboard, best surf window, referral leaderboard, smart checklist |
| **P2-D** | Add SoftwareApplication schema to widget pages | Low-Medium | Low | `app/for-surf-schools/page.tsx`, `app/for-businesses/page.tsx` |
| **P2-E** | Create dedicated OG endpoints for tide and water-temp sub-pages | Medium | Medium | New `/api/og/tide/route.tsx` and `/api/og/water-temp/route.tsx` |
| **P3-A** | Add share buttons to /vs/surfline, /learn articles, /forecast-accuracy | Low-Medium | Low | Simple CopyLinkButton component, add to 3+ pages |
| **P3-B** | Add UTM params to widget attribution links | Low | Trivial | `embed-conditions-widget.tsx`, `embed-tide-widget.tsx` |
| **P3-C** | Create custom OG images for /for-surf-schools and /for-businesses | Low | Medium | New OG route or static images |
| **P3-D** | Expand TX and MA in META_STATE_EXPANSIONS | Low | Trivial | `lib/seo/meta.ts` line 98 |
| **P3-E** | Extend ShareSheet `type` union to support new share types | Low | Trivial | `components/share/share-sheet.tsx` -- extend `"wave" \| "session"` union |

### Quick Wins (< 30 minutes each, ship today)

1. **P0-B:** One-line change to `/forecast-accuracy` -- `force-dynamic` to `revalidate = 21600`
2. **P0-C:** Add 7 missing states to `areaServed` in `lib/constants/seo.ts`
3. **P1-C:** Add missing state keywords to `SEO_CONFIG.keywords`
4. **P3-B:** Add `?utm_source=embed&utm_medium=widget` to attribution links
5. **P3-D:** Add `TX: "Texas"` and `MA: "Massachusetts"` to `META_STATE_EXPANSIONS`
6. **P3-E:** Extend ShareSheet type union to `"wave" | "session" | "beach" | "progression" | "streak" | "cam"`

### Medium Efforts (1-3 hours each)

1. **P0-A:** Beach detail share button (the single highest-impact change in this audit)
2. **P1-A + P1-B:** Progression and streak share wiring
3. **P1-D:** Custom OG image for /vs/surfline
4. **P2-E:** Dedicated tide and water-temp OG endpoints

---

## Appendix A: OG Endpoint Full Inventory

```
app/api/og/
  session/route.tsx     -- Session share card (1080x1920, 9:16 portrait)
  surf-call/route.tsx   -- Surf call share card (verdict, window, conditions)
  beach/route.tsx       -- Beach page meta OG (1200x630, landscape)
  intent/route.tsx      -- Intent page meta OG (city + intent label)
  guide/route.tsx       -- Learn article meta OG (title + region)
  forecast-accuracy/route.tsx -- Forecast accuracy page meta OG
  wave/route.tsx        -- ORPHANED: wave size + description card
  progression/route.tsx -- ORPHANED: monthly recap card
  streak/route.tsx      -- ORPHANED: streak milestone card
```

Total: 9 endpoints. 3 wired to share UI, 3 meta-only, 3 orphaned.

## Appendix B: Share URL Builder Functions

```
lib/share/build-share-card-url.ts:
  buildSurfCallShareUrl()     -- USED (unified surf card)
  buildSessionShareUrl()      -- USED (post-session, journal)
  buildWaveShareUrl()         -- NOT USED (orphaned, line 66)
  buildProgressionShareUrl()  -- NOT USED (orphaned, line 246)
  buildStreakShareUrl()       -- NOT USED (orphaned, line 278)
```

## Appendix C: Schema Completeness Matrix

| Schema Type | Present | Location |
|-------------|---------|----------|
| Organization | Yes | `lib/constants/seo.ts` -- missing 7 states in areaServed |
| SoftwareApplication | Yes | `lib/constants/seo.ts` -- complete |
| WebSite + SearchAction | Yes | `lib/constants/seo.ts` -- complete |
| Beach/Place | Yes | `components/seo/structured-data.tsx` -- per beach page |
| Breadcrumb | Yes | `components/seo/breadcrumb-schema.tsx` -- all pages |
| FAQ | Yes | `components/seo/faq-schema.tsx` -- beach, intent, accuracy pages |
| Review/AggregateRating | Yes | `components/seo/review-schema.tsx` -- beach pages |
| Article | Yes | `components/seo/article-schema.tsx` -- learn articles |
| WebPage | Yes | `components/seo/web-page-schema.tsx` -- multiple pages |
| HowTo | Yes (new) | `components/seo/how-to-surf-schema.tsx` -- beach pages |
| Dataset (Tide) | Yes (new) | `components/seo/tide-dataset-schema.tsx` -- tide pages |
| Dataset (Water Temp) | Yes (new) | `components/seo/water-temp-dataset-schema.tsx` -- water-temp pages |
| LiveCam/BroadcastEvent | Yes | `components/seo/live-cam-schema.tsx` -- beach pages with cameras |
| ItemList | Yes | `components/seo/item-list-schema.tsx` -- intent/city listing pages |
| SoftwareApplication (widget) | **MISSING** | Should be on /for-surf-schools, /for-businesses |
