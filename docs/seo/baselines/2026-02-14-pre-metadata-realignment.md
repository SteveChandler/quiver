# SEO Baseline — Pre-Metadata Realignment

**Captured**: 2026-02-14
**Commit**: `271bbf28e` (metadata changes deployed)
**GSC Data Range**: 2026-01-15 to 2026-02-11 (28 days, 3-day lag)
**Purpose**: Baseline for measuring impact of SEO metadata realignment

---

## Google Search Console — Overview

| Metric | Value |
|--------|-------|
| Total Clicks | 46 |
| Total Impressions | 25,461 |
| Avg CTR | 0.18% |
| Avg Position | 12.2 |

## Traffic by Device

| Device | Clicks | Impressions | CTR | Position |
|--------|--------|-------------|-----|----------|
| Mobile | 28 | 7,501 | 0.37% | 8.7 |
| Desktop | 16 | 17,758 | 0.09% | 13.7 |
| Tablet | 2 | 202 | 0.99% | 11.0 |

## Vercel Analytics — Traffic (28 days)

| Metric | Value |
|--------|-------|
| Total Page Views | 722 |
| Total Unique Devices | 289 |
| Avg Daily PV | 24 |
| Avg Bounce Rate | 65% |

---

## P0 Target Queries — Baseline Performance

These are the queries we're specifically targeting with the metadata realignment.

| Query | Clicks | Impressions | CTR | Position | Status |
|-------|--------|-------------|-----|----------|--------|
| best time to surf today | 0 | 0 | - | - | Not appearing |
| least crowded surf spots | 0 | 0 | - | - | Not appearing |
| AI surf forecast | 0 | 0 | - | - | Not appearing |
| personalized surf forecast | 0 | 0 | - | - | Not appearing |

## P1 Target Queries — Baseline Performance

| Query | Clicks | Impressions | CTR | Position | Status |
|-------|--------|-------------|-----|----------|--------|
| surf report | 0 | 0 | - | - | Not appearing |
| surf forecast | 0 | 0 | - | - | Not appearing |
| surf conditions today | 0 | 0 | - | - | Not appearing |
| wave height today | 0 | 0 | - | - | Not appearing |
| best beginner surf spots | 0 | 0 | - | - | Not appearing |
| where to surf today | 0 | 0 | - | - | Not appearing |
| surf cam | 0 | 0 | - | - | Not appearing |
| tide chart | 0 | 0 | - | - | Not appearing |

## Related Queries We DO Appear For

| Query | Clicks | Impressions | CTR | Position |
|-------|--------|-------------|-----|----------|
| 7 day surf forecast southern california | 0 | 13 | 0.00% | 10.7 |
| 5 day surf forecast san diego | 0 | 1 | 0.00% | 21.0 |
| agate beach surf report | 0 | 8 | 0.00% | 13.6 |
| agate beach surf forecast | 0 | 1 | 0.00% | 10.0 |
| silver strand surf report | 0 | 34 | 0.00% | 8.6 |
| cardiff reef latest | 0 | 21 | 0.00% | 7.5 |

---

## Top Pages by Clicks (baseline)

| Page | Clicks | Impressions | CTR | Position |
|------|--------|-------------|-----|----------|
| / | 5 | 20 | 25.00% | 4.3 |
| /ca/san-diego/sunset-cliffs | 2 | 26 | 7.69% | 5.5 |
| /longboard/san-diego | 2 | 119 | 1.68% | 11.3 |
| /beginner/long-beach-wa | 1 | 20 | 5.00% | 10.6 |
| /beginner/newport-or | 1 | 17 | 5.88% | 29.5 |
| /beginner/orange-county | 1 | 18 | 5.56% | 14.1 |
| /dawn-patrol/aguadilla | 1 | 224 | 0.45% | 8.7 |
| /dawn-patrol/encinitas | 1 | 7 | 14.29% | 6.0 |

## Key Pages to Watch (high impressions, low/zero CTR)

These pages have visibility but aren't converting clicks — the metadata realignment should improve CTR here.

| Page | Impressions | Clicks | CTR | Position |
|------|-------------|--------|-----|----------|
| /pr/rinc-n/marias-rincon-pr | 1,272 | 0 | 0.00% | 5.7 |
| /beaches/usa/pr/rincon | 1,198 | 0 | 0.00% | 6.9 |
| /pr/rinc-n/tres-palmas-rincon-pr | 1,179 | 0 | 0.00% | 8.4 |
| /pr/aguadilla | 695 | 0 | 0.00% | 6.6 |
| /beaches/usa/pr/isabela | 633 | 0 | 0.00% | 6.8 |
| /pr/isabela/middles | 631 | 0 | 0.00% | 7.9 |
| /water-temp/isabela | 557 | 0 | 0.00% | 6.5 |
| /dawn-patrol/aguadilla | 224 | 1 | 0.45% | 8.7 |
| /longboard/san-diego | 119 | 2 | 1.68% | 11.3 |

## Anomaly: Good Position but 0% CTR (top 10)

Queries where we rank well but get zero clicks — likely poor snippet appeal.

| Query | Position | CTR | Impressions |
|-------|----------|-----|-------------|
| middles surf spot isabela puerto rico | 9.7 | 0.00% | 50 |
| middles surf spot isabela puerto rico description | 8.3 | 0.00% | 50 |
| indicators surf spot rincon puerto rico | 6.4 | 0.00% | 49 |
| tres palmas surf spot puerto rico description | 6.4 | 0.00% | 42 |
| silver strand surf report | 8.6 | 0.00% | 34 |
| water temperature surfing puerto rico wetsuit | 6.6 | 0.00% | 28 |
| jobos beach isabela surf description | 5.7 | 0.00% | 23 |
| cardiff reef latest | 7.5 | 0.00% | 21 |

---

## Sitemap Coverage

| Metric | Value |
|--------|-------|
| Sitemap URLs | 769 |
| URLs with impressions (28d) | 448 |
| Coverage | 58.26% |

| Category | Sitemap | Indexed | Coverage |
|----------|---------|---------|----------|
| Beach pages | 271 | 190 | 70.1% |
| Location browse | 153 | 81 | 52.9% |
| Intent pages | 14 | 0 | 0.0% |
| Static pages | 9 | 4 | 44.4% |
| Home | 1 | 1 | 100% |

---

## How to Measure Success (4-8 weeks post-deploy)

### Primary KPIs
1. **Overall CTR**: Baseline 0.18% → target >0.5%
2. **Total clicks**: Baseline 46/28d → target >100/28d
3. **Pages with 0 clicks despite >100 impressions**: Baseline 34 → target <20

### Secondary KPIs
4. **P0 query appearances**: Baseline 0 → any impressions = win
5. **Intent page indexation**: Baseline 0/14 → target >5/14
6. **Homepage CTR**: Baseline 25% → maintain or improve
7. **Dawn patrol/beginner/least-crowded page CTR**: Track individually

### Re-measure Command
```bash
/tmp/gsc-venv/bin/python3 scripts/gsc-stats.py
```

Compare against this file at 2-week and 4-week marks.
