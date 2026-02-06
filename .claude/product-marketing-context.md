# Quiver Product Marketing Context

> Use this context when writing SEO content, marketing copy, or product descriptions. This file is referenced by the `product-marketing` skill.

---

## Business Overview

**Quiver** is a free surf forecast and beach discovery platform that helps surfers find the best waves, track conditions, and plan sessions. Unlike paid services, Quiver provides ML-powered forecasts and community features at no cost.

### Value Proposition

| Feature | Description |
|---------|-------------|
| **ML-Powered Forecasts** | Real-time wave predictions using machine learning trained on local conditions |
| **5,000+ Beach Pages** | Comprehensive coverage of US coastal surf spots with detailed conditions |
| **Cross-Platform** | Available as PWA, native iOS, and Android apps |
| **Community Intelligence** | Crowd reports and session logs from local surfers |
| **Free Forever** | Core features remain free; no premium paywall for forecasts |

---

## Target Audience

### Primary Segments

1. **Weekend Warriors** (40%)
   - Age: 25-45
   - Surfs 1-3x per week
   - Needs: Quick forecast checks, session planning, reliable conditions
   - Pain point: Limited time, needs efficient swell/tide window matching

2. **Beginner Surfers** (35%)
   - Age: 18-35
   - Learning to surf, needs gentle waves
   - Needs: Safe spots, crowd-free breaks, skill-appropriate recommendations
   - Pain point: Intimidated by locals, unsure where to start

3. **Local Groms** (25%)
   - Age: 16-30
   - Surfs daily, deep local knowledge
   - Needs: Session logging, community engagement, spot discovery
   - Pain point: Wants to track progress and find new spots

### User Intent Patterns

| Intent Type | Example Queries | Content Response |
|-------------|-----------------|------------------|
| **Forecast** | "surf report malibu", "waves today" | Real-time conditions pages |
| **Discovery** | "best surf spots near me", "beginner beaches california" | Intent pages, location pages |
| **Planning** | "high tide san diego", "water temp huntington" | Tide/water-temp intent pages |
| **Comparison** | "surfline vs quiver", "free surf forecast" | Competitive positioning content |

---

## Geographic Focus

### Priority Markets (Tier 1)

| Region | Coverage | Notes |
|--------|----------|-------|
| **California** | 1,200+ spots | Largest market, highest competition |
| **Hawaii** | 300+ spots | Premium surf destination, year-round |
| **Florida** | 400+ spots | East coast hub, consistent traffic |

### Secondary Markets (Tier 2)

| Region | Coverage | Notes |
|--------|----------|-------|
| **East Coast** | 500+ spots | NJ, NY, NC, SC - seasonal but loyal |
| **Pacific Northwest** | 200+ spots | OR, WA - cold water, dedicated community |
| **Texas** | 100+ spots | Growing market, underserved |
| **Puerto Rico** | 80+ spots | Caribbean crossover |

---

## Keyword Strategy

### Primary Keyword Themes

1. **[Location] + surf report** - Transactional, high intent
2. **[Location] + surf forecast** - Informational, recurring visits
3. **best [intent] surf spots [location]** - Discovery, long-tail
4. **[location] water temperature** - Informational, seasonal
5. **[location] tide times** - Utility, daily traffic

### Intent-Based Page Types

| Page Type | URL Pattern | Keyword Target |
|-----------|-------------|----------------|
| Beach Detail | `/beaches/usa/{state}/{city}/{beach}` | "{beach name} surf" |
| City Listing | `/beaches/usa/{state}/{city}` | "surf spots in {city}" |
| State Listing | `/beaches/usa/{state}` | "{state} surf spots" |
| Beginner Intent | `/beginner/{city}` | "beginner surf spots {city}" |
| Tide Intent | `/tide/{city}` | "{city} tide surf" |
| Water Temp Intent | `/water-temp/{city}` | "{city} water temperature surfing" |
| Hub Guide | `/guides/surfing-{region}` | "surfing {region} guide" |

---

## Content Pillars

### 1. Beach Pages (5,000+)

**Purpose:** Individual surf spot authority pages

**Content elements:**
- Live conditions (ML forecast)
- Skill level indicator
- Best tide/swell windows
- Crowd patterns
- User reviews/reports

### 2. Intent Pages (3,500+)

**Purpose:** Answer specific surfer questions by intent + location

**Intent types:**
- `beginner` - Gentle, forgiving waves for learners
- `longboard` - Mellow points and mushburger peaks
- `least-crowded` - Hidden gems, off-peak spots
- `dawn-patrol` - Early morning session planning
- `sunset` - Evening glass-off sessions
- `tide` - Tide-sensitive spot recommendations
- `water-temp` - Temperature forecasts and wetsuit guidance

### 3. Location Pages (500+)

**Purpose:** City-level surf spot aggregations

**Content elements:**
- All spots in city
- Local conditions summary
- Links to intent pages

### 4. Hub Guides (4)

**Purpose:** Regional authority content

**Current guides:**
- Southern California
- San Diego
- Orange County
- Hawaii

---

## Competitive Positioning

### vs. Surfline

| Dimension | Surfline | Quiver |
|-----------|----------|--------|
| **Price** | $99/year premium | Free |
| **Coverage** | Global, premium spots | US-focused, comprehensive |
| **Forecasts** | Human forecasters + ML | ML-powered, local training |
| **Community** | Limited | Session logs, crowd reports |
| **Mobile** | Native apps | PWA + native apps |

### Messaging Angles

- "Free surf forecasts powered by machine learning"
- "Find your perfect wave without the premium price"
- "Community-driven surf intelligence"
- "Real-time conditions from actual surfers"

---

## Content Voice Guidelines

### Tone

- **Authentic** - Write like a surfer, not a marketer
- **Helpful** - Focus on practical, actionable info
- **Concise** - Surfers want quick answers
- **Local** - Reference local landmarks, not generic descriptions

### Language Patterns

**Use:**
- "waves" not "surf conditions"
- "session" not "surfing experience"
- "stoked" sparingly, only when natural
- "glass" for clean conditions
- "lined up" for organized swells

**Avoid:**
- Overly technical meteorology jargon
- Marketing buzzwords ("revolutionary", "game-changing")
- Generic descriptions that could apply anywhere
- Excessive use of emojis

### AI Writing Patterns to Avoid

| Pattern | Why It's Bad | Better Approach |
|---------|--------------|-----------------|
| "Whether you're a beginner or expert..." | Generic, obvious | Be specific to the intent |
| "With its stunning beaches..." | Filler, no value | Skip or add real detail |
| "This comprehensive guide..." | Self-referential | Just provide the content |
| "Located on the beautiful coast..." | Every coast is "beautiful" | Describe what makes it unique |
| Bullet lists of generic tips | Low value | Specific, actionable advice |

---

## SEO Technical Notes

### Indexing Strategy

- **Index:** Beach pages, city pages, intent pages with content
- **Noindex:** Empty intent pages (no matching beaches), auth pages, API routes
- **Canonical:** Prefer hierarchical URLs over legacy `/spots/{slug}` format

### Sitemap Strategy

- Segmented sitemaps by content type (beaches, locations, intents, guides)
- Daily changefreq for forecast-dependent pages
- Weekly changefreq for static pages

### Structured Data

- `Organization` on homepage
- `SoftwareApplication` on features page
- `Place` + `Beach` on beach pages
- `FAQPage` on intent pages
- `BreadcrumbList` on all pages

---

## Metrics & Goals

### SEO KPIs

| Metric | Current | Target |
|--------|---------|--------|
| Organic sessions/month | Track | +20% QoQ |
| Indexed pages | ~8,000 | 10,000+ |
| Avg. position (target keywords) | Track | Top 10 |
| Click-through rate | Track | >3% |

### Content Quality Signals

- Bounce rate < 60% on intent pages
- Time on page > 2min on beach pages
- Return visitor rate > 30%
