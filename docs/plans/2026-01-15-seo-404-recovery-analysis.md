# SEO 404 Recovery Analysis

**Date:** 2026-01-15
**Source:** Google Search Console - 48 pages returning 404

## Summary

Most 404s are **not truly missing beaches** - they're URL structure mismatches where:
1. The old URL used "orange-county" but beaches are stored with actual city names (Huntington Beach, Dana Point, etc.)
2. Mexico beaches exist but the `/mexico/` route structure isn't supported
3. Some URLs have typos (e.g., `/pr/rincn/` instead of `/pr/rincon/`)

---

## Category 1: City/Slug Mismatch (Beaches EXIST - need redirect)

These beaches exist in the database but the 404 URLs use incorrect city slugs.

| 404 URL | Beach Name | Actual City | Correct URL |
|---------|------------|-------------|-------------|
| `/ca/orange-county/huntington-pier` | Huntington Beach Pier Southside | Huntington Beach | `/ca/huntington-beach/huntington-beach-pier-southside` |
| `/ca/orange-county/doheny-state-beach` | Doheny State Beach | Dana Point | `/ca/dana-point/doheny-state-beach` |
| `/ca/orange-county/lowers-trestles` | Lower Trestles | San Onofre | `/ca/san-onofre/lower-trestles` |
| `/ca/san-diego/blacks` | Blacks Beach | La Jolla | `/ca/la-jolla/blacks` |

**Action:** Middleware will handle these via slug lookup + redirect to canonical URL.

---

## Category 2: URL Typos (Beaches EXIST - need redirect)

| 404 URL | Issue | Correct URL |
|---------|-------|-------------|
| `/pr/rincn/indicators-rincon-pr` | Missing 'o' in rincon | `/pr/rincon/indicators-rincon-pr` |
| `/pr/rincn/the-point-at-sandy-rincon-pr` | Missing 'o' in rincon | `/pr/rincon/the-point-at-sandy-rincon-pr` |

**Action:** Middleware will handle via slug lookup.

---

## Category 3: Mexico Route Structure (Beaches EXIST - need route support)

These beaches exist but the `/mexico/` URL pattern isn't currently supported.

| 404 URL | Beach Name | Status |
|---------|------------|--------|
| `/mexico/baja-california/rosarito/alfonsos` | Alfonsos | EXISTS in DB |
| `/mexico/baja-california/rosarito/teresas` | Teresa's | EXISTS in DB |
| `/mexico/baja-california/rosarito/rosarito-beach` | Rosarito Beach | EXISTS in DB |
| `/mexico/baja-california/rosarito/el-morro-point-k375` | El Morro Point (K37.5) | EXISTS in DB |
| `/mexico/baja-california/puerto-nuevo/k-40-puerto-nuevo` | K-40 (Puerto Nuevo) | EXISTS in DB |

**Action:** Either add `/mexico/` route support OR redirect to `/spots/[slug]` via middleware.

---

## Category 4: Truly Missing Beaches (need to be added)

These beaches do NOT exist in the database and should be added later.

| Beach Name | Location | Priority |
|------------|----------|----------|
| Seal Beach | Seal Beach, CA | High (popular OC beach) |
| Bolsa Chica | Huntington Beach, CA | High (popular OC beach) |

**Action:** Add these beaches to the database in a future migration.

---

## Category 5: State/Region Landing Pages (not beach-specific)

These are listing pages, not individual beaches. Many don't have dedicated routes.

### State Pages (2-letter codes)
- `/nj`, `/sc`, `/ri`, `/ma`, `/pr`, `/nc`, `/or`, `/wa`, `/nh`, `/me`, `/tx`, `/ca`

### City/Region Pages
- `/ca/malibu`, `/ca/san-clemente`, `/ca/san-francisco`, `/ca/los-angeles`, `/ca/goleta`, `/ca/grover-beach`
- `/ga/tybee-island`, `/sc/folly-beach`
- `/hi/honolulu`, `/hi/kailua-kona`, `/hi/kahaluu-keauhou`
- `/or/lincoln-city`, `/or/florence`
- `/me/ogunquit`, `/nh/hampton`
- `/ny/queens`
- `/fl/pensacola-beach`

**Action:** Redirect state codes to `/beaches/usa/[state]` or show helpful 404 with nearby beaches.

---

## Middleware Redirect Strategy

```
1. Extract slug from URL (last segment)
2. Query DB: SELECT * FROM beaches WHERE slug = $slug
3. If found → 301 redirect to /{state}/{city}/{slug}
4. If not found → try fuzzy match on beach name
5. If still not found → redirect to state/region page if valid
6. Otherwise → pass through to show 404 page
```

---

## Next Steps

1. [ ] Implement SEO redirect middleware
2. [ ] Add Seal Beach and Bolsa Chica to database
3. [ ] Consider adding `/mexico/` route support
4. [ ] Consider adding state landing pages (`/ca`, `/or`, etc.)
