# SEO Domination Strategy Design

**Date:** 2026-01-15
**Goal:** Become the top-ranking surf forecasting site
**Approach:** Skill-based programmatic SEO + regional hub pages + technical excellence

---

## Strategy Overview

Quiver's path to top rankings centers on one insight: surf forecasting sites treat all surfers the same, but search queries don't. People search "best beginner surf spots San Diego"—and no one owns these queries.

### Core Tactics

1. **Scale existing intent pages** - Extend to all cities and states
2. **Regional hub pages** - Comprehensive guides for major surf regions
3. **Technical SEO excellence** - Speed, structured data, crawlability

### Target Query Categories

| Priority | Query Type | Example | Strategy |
|----------|-----------|---------|----------|
| 1 | Skill + Location | "beginner surf spots orange county" | Intent pages |
| 2 | Spot + Forecast | "trestles surf forecast" | Optimize beach pages |
| 3 | Discovery | "best surf spots california" | Hub pages |
| 4 | Brand | "surfline alternative" | Comparison content |

### Success Metrics (12-month)

- 10x organic traffic growth
- Page 1 rankings for 50+ skill-based queries
- Page 1-2 rankings for 20+ major spot forecasts
- Domain authority 40+

---

## Phase 1: Scale Intent Pages

### Current State

- 4 intents: `beginner`, `least-crowded`, `tide`, `water-temp`
- 2 curated cities: San Diego, Orange County
- ~8 total intent pages

### Expansion Plan

| Phase | Action | New Pages |
|-------|--------|-----------|
| 1a | Extend intent pages to all cities with 3+ beaches | ~150 pages |
| 1b | Add state-level intent pages (`/beginner/california`) | ~60 pages |
| 1c | Add new intents: `longboard`, `shortboard`, `dawn-patrol`, `sunset` | ~100 pages |

### Technical Approach

- Pull from `city_editorial_content` table (already database-driven)
- Auto-generate editorial content for non-curated cities using beach skill scores
- Add state-level routes that aggregate city data
- URL structure: `/{intent}/{city}` (existing), `/{intent}/{state}` (new)

### Quick Win

Extend existing 4 intents to all cities with beaches = 150+ new pages in one sprint.

---

## Phase 2: Technical SEO Foundation

### Already Solid

- Dynamic sitemap with all beach/city/intent pages
- Structured data (BeachPageStructuredData, BreadcrumbStructuredData)
- Hierarchical URLs (`/beaches/usa/ca/san-diego/blacks`)
- generateMetadata on key pages

### Gaps to Address

#### 1. robots.txt (Create)

```txt
User-agent: *
Allow: /
Sitemap: https://www.quiversurf.app/sitemap.xml

# Block non-SEO pages
Disallow: /api/
Disallow: /admin/
Disallow: /profile/
Disallow: /inbox/
```

#### 2. Structured Data Expansion

- **FAQPage** schema on intent pages
- **HowTo** schema on educational content
- **BreadcrumbList** verification on all pages

#### 3. Internal Linking

- Intent pages link to each featured beach
- Beach pages link back to their intent pages
- City pages prominently link to intent pages

#### 4. Core Web Vitals

- Audit LCP, CLS, FID on key landing pages
- Ensure images use next/image with proper sizing
- Lazy load below-fold components

---

## Phase 3: Regional Hub Pages

### Purpose

Capture head terms and build authority through comprehensive "ultimate guide" content.

### Hub Page Structure

**URL Pattern:** `/guides/surfing-[region]`

**Content Sections:**
1. Overview (300-500 words) - Region intro, what makes it unique
2. Interactive Map - All spots plotted, color-coded by skill level
3. Best Spots by Skill Level - Links to intent pages
4. Seasonal Guide - When to surf, swell patterns
5. Top 10 Beaches - Featured spots with links
6. Practical Info - Water temps, wetsuit guide, parking tips
7. FAQ Section - Structured data opportunity

### Map Features

- Mapbox GL integration
- Color-coded markers: green=beginner, blue=intermediate, black=advanced
- Click-through to beach pages
- Cluster markers when zoomed out

### Priority Hubs

| Hub | Target Query | Priority |
|-----|--------------|----------|
| Southern California | "best surf spots southern california" | 1 |
| San Diego | "surfing san diego guide" | 1 |
| Orange County | "best surf spots orange county" | 1 |
| Northern California | "surfing northern california" | 2 |
| Hawaii | "best surf spots hawaii" | 2 |
| Florida | "surfing florida guide" | 3 |

### Content Depth

2,000-3,000 words each, professionally written editorial content.

---

## Phase 4: Content Calendar

### Weekly (Automated/Low-effort)

- "This Week's Surf Outlook" for each major region
- Dynamic updates to "surf today" pages

### Monthly (Editorial)

- 1 new hub page or major hub update
- 2-4 blog posts:
  - "Best time of year to surf [location]"
  - "[Beach] vs [Beach]: Which is better for beginners?"
  - Evergreen educational content

### Quarterly

- Seasonal guide updates
- New intent rollouts (`longboard`, `dawn-patrol`, etc.)

### Content Prioritization

| Priority | Criteria |
|----------|----------|
| 1 | High search volume + low competition |
| 2 | Builds on existing rankings |
| 3 | Supports AI personalization positioning |
| 4 | Linkable assets |

---

## Measurement

### Tracking Requirements

1. **Google Search Console**
   - All sitemaps submitted
   - Core Web Vitals monitored
   - Query performance tracked

2. **Analytics Events**
   - Intent page → beach detail conversions
   - "Surf today" engagement
   - Bounce rate by page type

### KPIs by Phase

| Timeframe | Metric | Target |
|-----------|--------|--------|
| Month 1-3 | Indexed pages | 500+ new pages |
| Month 1-3 | Impressions | 2x current |
| Month 3-6 | Clicks | 3x organic clicks |
| Month 3-6 | Rankings | 20+ intent queries page 1-2 |
| Month 6-12 | Traffic | 10x organic sessions |
| Month 6-12 | Authority | Domain rating 35+ |

### Competitive Tracking

Monitor rankings vs Surfline for:
- 10 spot-specific queries
- 10 skill-based queries
- 5 discovery queries

### Monthly Review

- Search Console: new ranking opportunities
- High impressions/low CTR pages: optimize titles/meta
- Position 11-20 queries: push to page 1

---

## Implementation Phases

### Phase 1: Quick Wins (Week 1-2)
- [ ] Add robots.txt
- [ ] Extend intent pages to all cities with beaches
- [ ] Verify structured data coverage
- [ ] Update sitemap to include new pages

### Phase 2: State-Level Expansion (Week 3-4)
- [ ] Create state-level intent page routes
- [ ] Auto-generate state editorial content
- [ ] Internal linking improvements

### Phase 3: Hub Pages (Month 2)
- [ ] Build hub page template with map component
- [ ] Create Southern California hub (pilot)
- [ ] Create San Diego hub
- [ ] Create Orange County hub

### Phase 4: New Intents (Month 2-3)
- [ ] Add `longboard` intent
- [ ] Add `dawn-patrol` intent
- [ ] Add `sunset` intent
- [ ] Backfill to existing cities

### Phase 5: Ongoing Content (Month 3+)
- [ ] Establish editorial calendar
- [ ] Set up content workflow
- [ ] Begin monthly hub expansion

---

## Technical Notes

### Existing Infrastructure to Leverage

- `SURF_INTENTS` definitions in `lib/data/surf-spots.ts`
- `city_editorial_content` table for database-driven content
- `buildPageMetadata` utility for SEO metadata
- Mapbox GL for interactive maps
- BeachPageStructuredData component

### New Components Needed

- State-level intent page route
- Hub page template with map
- FAQPage structured data component
- robots.txt static file

### Database Considerations

- May need skill scores on beaches for auto-classification
- State-level aggregation queries
- Hub page content storage (or markdown files)
