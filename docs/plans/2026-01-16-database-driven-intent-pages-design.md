# Database-Driven Intent Pages Design

> **Goal:** Make intent pages (`/beginner/{city}`, `/least-crowded/{city}`, etc.) work automatically for any city with 3+ beaches in the database, across all states.

**Date:** 2026-01-16
**Status:** Approved

---

## Overview

Currently, intent pages only work for hardcoded cities (San Diego, Orange County). This design extends them to support ~50+ cities across 17 states automatically by querying the database.

**Scope:**
- 7 intents: `beginner`, `least-crowded`, `tide`, `water-temp`, `longboard`, `dawn-patrol`, `sunset`
- ~50 cities with 3+ beaches qualify
- ~350 new SEO pages generated at build time

**Key Decisions:**
- **Content generation:** Smart templates using beach data (not AI-generated)
- **City threshold:** 3+ beaches minimum
- **URL collisions:** State suffix only when needed (`/beginner/santa-cruz` vs `/beginner/newport-ca`)
- **Build strategy:** Static generation at build time with ISR revalidation

---

## URL Structure

**Unique cities (no collision):**
```
/beginner/santa-cruz
/tide/honolulu
/longboard/malibu
```

**Colliding cities (state suffix required):**
```
/beginner/newport-ca
/beginner/newport-or
/beginner/newport-ri
```

**State-level pages (existing, unchanged):**
```
/beginner/ca
/least-crowded/hi
```

---

## City Resolution Logic

New function `resolveCityFromSlug(slug)` handles parsing:

```
Input: "santa-cruz"  → Output: { city: "Santa Cruz", state: "CA" }
Input: "newport-ca"  → Output: { city: "Newport Beach", state: "CA" }
Input: "newport-or"  → Output: { city: "Newport", state: "OR" }
Input: "nonexistent" → Output: null
```

**Algorithm:**
1. Check if slug ends with known state suffix (`-ca`, `-or`, `-hi`, etc.)
2. If yes: extract state, search for city in that state only
3. If no: search all states, return match if exactly one city found
4. If multiple matches and no state suffix: return null (404)

---

## Smart Template Content System

Templates generate unique content using database values.

**Available Variables:**
- `{cityName}`, `{stateName}`, `{stateAbbrev}`
- `{totalBeaches}`, `{beginnerCount}`, `{advancedCount}`
- `{topSpotNames}` - comma-separated list of top 3 beaches
- `{allSpotNames}` - full list for longer content
- `{hasBeginnerSpots}`, `{hasAdvancedSpots}` - booleans for conditional text

**Example Output for `/beginner/santa-cruz`:**

**Title:** `Santa Cruz Beginner Surf Spots & Lessons | California`

**Heading:** `Beginner-friendly waves in Santa Cruz`

**Intro:**
> Santa Cruz offers 5 surf spots along the California coast. While known for advanced breaks like Steamer Lane, the area provides options for surfers building their skills at spots like 38th Avenue and Pleasure Point during smaller swells.

**Meta description:**
> Find beginner-friendly surf spots in Santa Cruz, CA. 5 breaks including 38th Avenue, Mitchell's Cove, and Pleasure Point. Updated daily with conditions.

**Conditional Logic:**
- If `beginnerCount === 0`: mention challenging breaks, suggest nearby beginner-friendly cities
- If `beginnerCount >= 3`: emphasize beginner paradise

---

## Page Component Flow

**File:** `app/[intent]/[city]/page.tsx`

**New Flow:**
1. Check if state-level route (`/beginner/ca`) → existing logic unchanged
2. Check if legacy redirect (`/ca/encinitas`) → existing logic unchanged
3. Call `resolveCityFromSlug(params.city)` → queries database
4. If no city found or beach count < 3 → return 404
5. Call `getCityMetadata(city, state)` → get beach data
6. Call `getBeachesByIntentAndCity(intent, city, state)` → get filtered beaches
7. Generate content via `buildIntentPageContent(intent, cityMetadata)`
8. Render page with smart template content

**Removed:**
- `getCityBySlug()` call (hardcoded city lookup)
- `SURF_CITIES` dependency for page rendering

**Kept:**
- `SURF_INTENTS` definitions (focusPoints, etc.)
- State-level intent page logic
- Legacy URL redirect handling
- Map component, FAQ schema, breadcrumbs

---

## Static Generation

**`generateStaticParams` approach:**

```typescript
export async function generateStaticParams() {
  // 1. Fetch all cities with 3+ beaches
  const cities = await getAllCitiesWithBeaches(3);

  // 2. Build collision map
  const collisionMap = detectCityCollisions(cities);

  // 3. Generate city × intent params
  const params = [];
  for (const city of cities) {
    const citySlug = buildCitySlug(city, collisionMap);
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, city: citySlug });
    }
  }

  // 4. Add state-level params
  for (const state of US_STATE_SLUGS) {
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, city: state });
    }
  }

  return params;
}
```

**Build Impact:**
- ~350 new static pages
- Minimal build time increase
- No cold-start latency for users

---

## New Files

| File | Purpose |
|------|---------|
| `lib/seo/city-slug-utils.ts` | `resolveCityFromSlug()`, `buildCitySlug()`, `detectCityCollisions()` |
| `lib/seo/intent-content-templates.ts` | `buildIntentPageContent()`, template strings for all 7 intents |
| `actions/city/city-metadata-actions.ts` | `getCityMetadata()` - beach counts, names, coordinates |

## Modified Files

| File | Changes |
|------|---------|
| `app/[intent]/[city]/page.tsx` | Remove hardcoded city gate, use new resolution flow |
| `app/sitemap.ts` | Simplify, remove redundant generation |
| `lib/data/surf-spots.ts` | Keep `SURF_INTENTS`, remove `SURF_CITIES` dependency |

---

## Error Handling

**404 Scenarios:**
- City slug doesn't match any database city
- City has fewer than 3 beaches
- Ambiguous slug (multiple cities, no state suffix)
- Invalid intent slug

**Edge Cases:**
- City with 0 matching intent beaches → render page with helpful "nearby cities" content
- Beach missing coordinates → exclude from map, show in list
- Beach missing skill_level → treat as "intermediate"

**Graceful Degradation:**
- Database query fails at build → fall back to hardcoded cities
- Database query fails at runtime → serve stale cached version

---

## Testing Strategy

**Unit Tests:**
- `resolveCityFromSlug`: unique city, collision with suffix, collision without suffix, invalid
- `buildCitySlug`: unique → no suffix, collision → state suffix
- `detectCityCollisions`: no collisions, multiple collisions, case insensitivity
- `buildIntentPageContent`: each intent type, zero beginner spots, rich data

**Integration Tests:**
- `getCityMetadata` returns correct counts and names
- `getBeachesByIntentAndCity` filters correctly
- Full page render produces valid HTML

**E2E Tests:**
```typescript
test('Santa Cruz beginner page loads', async ({ page }) => {
  await page.goto('/beginner/santa-cruz');
  await expect(page.locator('h1')).toContainText('Santa Cruz');
});

test('Newport requires state suffix', async ({ page }) => {
  const response = await page.goto('/beginner/newport');
  expect(response?.status()).toBe(404);

  await page.goto('/beginner/newport-ca');
  await expect(page.locator('h1')).toContainText('Newport');
});
```

**Manual Verification:**
- Check 5-10 city pages across states
- Validate structured data with Google Rich Results Test
- Confirm sitemap includes new URLs

---

## Implementation Order

1. Create `lib/seo/city-slug-utils.ts` with resolution functions
2. Create `actions/city/city-metadata-actions.ts`
3. Create `lib/seo/intent-content-templates.ts`
4. Refactor `app/[intent]/[city]/page.tsx` to use new flow
5. Update `generateStaticParams` for all cities
6. Update sitemap
7. Add tests
8. Manual verification
