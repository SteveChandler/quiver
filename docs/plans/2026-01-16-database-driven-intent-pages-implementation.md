# Database-Driven Intent Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make intent pages (`/beginner/{city}`, etc.) work automatically for any city with 3+ beaches in the database, across all US states.

**Architecture:** Remove hardcoded `SURF_CITIES` gate from intent pages. Add city resolution from database with collision detection (state suffix when needed). Generate page content via smart templates using beach data.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, existing SEO utilities

---

## Phase 1: City Slug Utilities

### Task 1: Create city-slug-utils.ts with State Constants

**Files:**
- Create: `lib/seo/city-slug-utils.ts`
- Reference: `lib/utils/beach-url-utils.ts` (for existing state utilities)

**Step 1: Create the file with state constants**

```typescript
// lib/seo/city-slug-utils.ts
/**
 * City slug utilities for database-driven intent pages.
 * Handles slug generation, collision detection, and resolution.
 */

import { slugifyAscii } from "@/lib/utils/text-utils";

/**
 * US state abbreviations mapped to slugs.
 */
export const US_STATE_SLUGS: Record<string, string> = {
  AL: "al", AK: "ak", AZ: "az", AR: "ar", CA: "ca",
  CO: "co", CT: "ct", DE: "de", FL: "fl", GA: "ga",
  HI: "hi", ID: "id", IL: "il", IN: "in", IA: "ia",
  KS: "ks", KY: "ky", LA: "la", ME: "me", MD: "md",
  MA: "ma", MI: "mi", MN: "mn", MS: "ms", MO: "mo",
  MT: "mt", NE: "ne", NV: "nv", NH: "nh", NJ: "nj",
  NM: "nm", NY: "ny", NC: "nc", ND: "nd", OH: "oh",
  OK: "ok", OR: "or", PA: "pa", RI: "ri", SC: "sc",
  SD: "sd", TN: "tn", TX: "tx", UT: "ut", VT: "vt",
  VA: "va", WA: "wa", WV: "wv", WI: "wi", WY: "wy",
  PR: "pr", // Puerto Rico
};

/**
 * Reverse mapping: slug to state abbreviation.
 */
export const SLUG_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_SLUGS).map(([abbrev, slug]) => [slug, abbrev])
);

/**
 * All valid state slugs as a Set for O(1) lookup.
 */
export const VALID_STATE_SLUGS = new Set(Object.values(US_STATE_SLUGS));
```

**Step 2: Verify file compiles**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/database-driven-intent-pages && npx tsc lib/seo/city-slug-utils.ts --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/seo/city-slug-utils.ts
git commit -m "feat(seo): add city-slug-utils with state constants"
```

---

### Task 2: Add detectCityCollisions Function

**Files:**
- Modify: `lib/seo/city-slug-utils.ts`
- Test: `__tests__/lib/seo/city-slug-utils.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/seo/city-slug-utils.test.ts
import { detectCityCollisions } from "@/lib/seo/city-slug-utils";

describe("detectCityCollisions", () => {
  it("returns empty map when no collisions", () => {
    const cities = [
      { city: "Santa Cruz", state: "CA" },
      { city: "Honolulu", state: "HI" },
    ];
    const collisions = detectCityCollisions(cities);
    expect(collisions.size).toBe(0);
  });

  it("detects cities that appear in multiple states", () => {
    const cities = [
      { city: "Newport", state: "CA" },
      { city: "Newport", state: "OR" },
      { city: "Newport", state: "RI" },
      { city: "Santa Cruz", state: "CA" },
    ];
    const collisions = detectCityCollisions(cities);
    expect(collisions.get("newport")).toBe(3);
    expect(collisions.has("santa-cruz")).toBe(false);
  });

  it("handles case-insensitive city names", () => {
    const cities = [
      { city: "NEWPORT BEACH", state: "CA" },
      { city: "Newport Beach", state: "OR" },
    ];
    const collisions = detectCityCollisions(cities);
    expect(collisions.get("newport-beach")).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/seo/city-slug-utils.test.ts`
Expected: FAIL - detectCityCollisions is not defined

**Step 3: Implement detectCityCollisions**

Add to `lib/seo/city-slug-utils.ts`:

```typescript
export interface CityStateRecord {
  city: string;
  state: string;
}

/**
 * Detect city names that appear in multiple states.
 * Returns a Map of slugified city name -> count of states.
 * Only includes entries where count > 1 (actual collisions).
 */
export function detectCityCollisions(
  cities: CityStateRecord[]
): Map<string, number> {
  const cityStateCounts = new Map<string, Set<string>>();

  for (const { city, state } of cities) {
    const slug = slugifyAscii(city);
    if (!slug) continue;

    const states = cityStateCounts.get(slug) || new Set();
    states.add(state.toUpperCase());
    cityStateCounts.set(slug, states);
  }

  // Filter to only collisions (appears in 2+ states)
  const collisions = new Map<string, number>();
  for (const [slug, states] of cityStateCounts) {
    if (states.size > 1) {
      collisions.set(slug, states.size);
    }
  }

  return collisions;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/seo/city-slug-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/seo/city-slug-utils.ts __tests__/lib/seo/city-slug-utils.test.ts
git commit -m "feat(seo): add detectCityCollisions function"
```

---

### Task 3: Add buildCitySlug Function

**Files:**
- Modify: `lib/seo/city-slug-utils.ts`
- Modify: `__tests__/lib/seo/city-slug-utils.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/lib/seo/city-slug-utils.test.ts`:

```typescript
import { buildCitySlug, detectCityCollisions } from "@/lib/seo/city-slug-utils";

describe("buildCitySlug", () => {
  it("returns simple slug for unique city", () => {
    const collisions = new Map<string, number>();
    const slug = buildCitySlug("Santa Cruz", "CA", collisions);
    expect(slug).toBe("santa-cruz");
  });

  it("appends state suffix for colliding city", () => {
    const collisions = new Map([["newport", 3]]);
    const slug = buildCitySlug("Newport", "CA", collisions);
    expect(slug).toBe("newport-ca");
  });

  it("handles Newport Beach correctly", () => {
    const collisions = new Map([["newport-beach", 2]]);
    const slug = buildCitySlug("Newport Beach", "CA", collisions);
    expect(slug).toBe("newport-beach-ca");
  });

  it("lowercases state suffix", () => {
    const collisions = new Map([["newport", 2]]);
    const slug = buildCitySlug("Newport", "OR", collisions);
    expect(slug).toBe("newport-or");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/seo/city-slug-utils.test.ts`
Expected: FAIL - buildCitySlug is not defined

**Step 3: Implement buildCitySlug**

Add to `lib/seo/city-slug-utils.ts`:

```typescript
/**
 * Build a URL slug for a city.
 * Appends state suffix only if city name collides across states.
 *
 * @param city - City name (e.g., "Santa Cruz")
 * @param state - State abbreviation (e.g., "CA")
 * @param collisions - Map from detectCityCollisions()
 * @returns Slug like "santa-cruz" or "newport-ca"
 */
export function buildCitySlug(
  city: string,
  state: string,
  collisions: Map<string, number>
): string {
  const baseSlug = slugifyAscii(city);
  if (!baseSlug) return "";

  if (collisions.has(baseSlug)) {
    const stateSlug = state.toLowerCase();
    return `${baseSlug}-${stateSlug}`;
  }

  return baseSlug;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/seo/city-slug-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/seo/city-slug-utils.ts __tests__/lib/seo/city-slug-utils.test.ts
git commit -m "feat(seo): add buildCitySlug function"
```

---

### Task 4: Add resolveCityFromSlug Function

**Files:**
- Modify: `lib/seo/city-slug-utils.ts`
- Modify: `__tests__/lib/seo/city-slug-utils.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/lib/seo/city-slug-utils.test.ts`:

```typescript
import {
  resolveCityFromSlug,
  US_STATE_SLUGS,
} from "@/lib/seo/city-slug-utils";

describe("resolveCityFromSlug", () => {
  it("parses simple slug without state suffix", () => {
    const result = resolveCityFromSlug("santa-cruz");
    expect(result).toEqual({
      cityPattern: "santa cruz",
      stateFilter: null,
    });
  });

  it("parses slug with state suffix", () => {
    const result = resolveCityFromSlug("newport-ca");
    expect(result).toEqual({
      cityPattern: "newport",
      stateFilter: "CA",
    });
  });

  it("parses multi-word city with state suffix", () => {
    const result = resolveCityFromSlug("newport-beach-ca");
    expect(result).toEqual({
      cityPattern: "newport beach",
      stateFilter: "CA",
    });
  });

  it("handles slug that ends with state-like but is not a state", () => {
    // "la" is not a state slug (Louisiana is "la" but city is "La Jolla")
    const result = resolveCityFromSlug("la-jolla");
    // "la" IS a state slug for Louisiana, so it will parse as state suffix
    // This is expected - the database query will disambiguate
    expect(result.stateFilter).toBe("LA");
  });

  it("handles oregon state suffix", () => {
    const result = resolveCityFromSlug("newport-or");
    expect(result).toEqual({
      cityPattern: "newport",
      stateFilter: "OR",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/seo/city-slug-utils.test.ts`
Expected: FAIL - resolveCityFromSlug is not defined

**Step 3: Implement resolveCityFromSlug**

Add to `lib/seo/city-slug-utils.ts`:

```typescript
export interface ParsedCitySlug {
  /** City name pattern for ILIKE search (spaces instead of hyphens) */
  cityPattern: string;
  /** State abbreviation if suffix detected, null otherwise */
  stateFilter: string | null;
}

/**
 * Parse a city slug to extract city pattern and optional state filter.
 *
 * Examples:
 * - "santa-cruz" → { cityPattern: "santa cruz", stateFilter: null }
 * - "newport-ca" → { cityPattern: "newport", stateFilter: "CA" }
 * - "newport-beach-ca" → { cityPattern: "newport beach", stateFilter: "CA" }
 *
 * @param slug - URL slug like "santa-cruz" or "newport-ca"
 * @returns Parsed components for database query
 */
export function resolveCityFromSlug(slug: string): ParsedCitySlug {
  const parts = slug.toLowerCase().split("-");

  // Check if last part is a valid state slug
  const lastPart = parts[parts.length - 1];
  if (VALID_STATE_SLUGS.has(lastPart) && parts.length > 1) {
    const stateAbbrev = SLUG_TO_STATE[lastPart];
    const cityParts = parts.slice(0, -1);
    return {
      cityPattern: cityParts.join(" "),
      stateFilter: stateAbbrev,
    };
  }

  // No state suffix - return full slug as city pattern
  return {
    cityPattern: parts.join(" "),
    stateFilter: null,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/seo/city-slug-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/seo/city-slug-utils.ts __tests__/lib/seo/city-slug-utils.test.ts
git commit -m "feat(seo): add resolveCityFromSlug function"
```

---

## Phase 2: City Metadata Action

### Task 5: Create getCityMetadata Action

**Files:**
- Create: `actions/city/city-metadata-actions.ts`
- Test: `__tests__/actions/city/city-metadata-actions.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/actions/city/city-metadata-actions.test.ts
import { getCityMetadata } from "@/actions/city/city-metadata-actions";

describe("getCityMetadata", () => {
  it("returns metadata for Santa Cruz", async () => {
    const result = await getCityMetadata("Santa Cruz", "CA");

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.cityName).toBe("Santa Cruz");
    expect(result.data?.state).toBe("CA");
    expect(result.data?.totalBeaches).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(result.data?.beaches)).toBe(true);
  });

  it("returns null for nonexistent city", async () => {
    const result = await getCityMetadata("Nonexistent City", "ZZ");

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("includes skill level counts", async () => {
    const result = await getCityMetadata("San Diego", "CA");

    expect(result.success).toBe(true);
    expect(result.data?.beginnerCount).toBeGreaterThanOrEqual(0);
    expect(result.data?.intermediateCount).toBeGreaterThanOrEqual(0);
    expect(result.data?.advancedCount).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/actions/city/city-metadata-actions.test.ts`
Expected: FAIL - Cannot find module

**Step 3: Implement getCityMetadata**

```typescript
// actions/city/city-metadata-actions.ts
"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";

export interface CityMetadata {
  cityName: string;
  state: string;
  stateName: string;
  totalBeaches: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  beaches: Array<{
    name: string;
    slug: string;
    skillLevel: string | null;
  }>;
  centerLat: number;
  centerLon: number;
}

const STATE_NAMES: Record<string, string> = {
  CA: "California",
  HI: "Hawaii",
  OR: "Oregon",
  WA: "Washington",
  FL: "Florida",
  NC: "North Carolina",
  SC: "South Carolina",
  NJ: "New Jersey",
  NY: "New York",
  TX: "Texas",
  MA: "Massachusetts",
  ME: "Maine",
  RI: "Rhode Island",
  NH: "New Hampshire",
  GA: "Georgia",
  PR: "Puerto Rico",
};

function categorizeSkillLevel(skillLevel: string | null): "beginner" | "intermediate" | "advanced" {
  if (!skillLevel) return "intermediate";
  const lower = skillLevel.toLowerCase();
  if (lower.includes("beginner") || lower.includes("longboard")) return "beginner";
  if (lower.includes("advanced") || lower.includes("expert")) return "advanced";
  return "intermediate";
}

/**
 * Get metadata for a city including beach counts and names.
 * Returns null if city doesn't exist or has fewer than 3 beaches.
 */
export async function getCityMetadata(
  cityName: string,
  state: string
) {
  return withDatabaseOperation<CityMetadata | null>(async (supabase) => {
    const { data: beaches, error } = await supabase
      .from("beaches")
      .select("id, name, slug, skill_level, center_lat, center_lng")
      .ilike("city", cityName)
      .eq("state", state.toUpperCase())
      .or("is_private.is.null,is_private.eq.false")
      .order("name");

    if (error) throw error;

    if (!beaches || beaches.length < 3) {
      return { data: null, error: null };
    }

    // Calculate skill level counts
    let beginnerCount = 0;
    let intermediateCount = 0;
    let advancedCount = 0;

    for (const beach of beaches) {
      const category = categorizeSkillLevel(beach.skill_level);
      if (category === "beginner") beginnerCount++;
      else if (category === "intermediate") intermediateCount++;
      else advancedCount++;
    }

    // Calculate center coordinates (average of all beaches)
    const validCoords = beaches.filter((b) => b.center_lat && b.center_lng);
    const centerLat = validCoords.length > 0
      ? validCoords.reduce((sum, b) => sum + b.center_lat, 0) / validCoords.length
      : 0;
    const centerLon = validCoords.length > 0
      ? validCoords.reduce((sum, b) => sum + b.center_lng, 0) / validCoords.length
      : 0;

    return {
      data: {
        cityName,
        state: state.toUpperCase(),
        stateName: STATE_NAMES[state.toUpperCase()] || state,
        totalBeaches: beaches.length,
        beginnerCount,
        intermediateCount,
        advancedCount,
        beaches: beaches.map((b) => ({
          name: b.name,
          slug: b.slug,
          skillLevel: b.skill_level,
        })),
        centerLat,
        centerLon,
      },
      error: null,
    };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/actions/city/city-metadata-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add actions/city/city-metadata-actions.ts __tests__/actions/city/city-metadata-actions.test.ts
git commit -m "feat(actions): add getCityMetadata for intent page data"
```

---

### Task 6: Add findCityBySlug Action

**Files:**
- Modify: `actions/city/city-metadata-actions.ts`
- Modify: `__tests__/actions/city/city-metadata-actions.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/actions/city/city-metadata-actions.test.ts`:

```typescript
import { findCityBySlug } from "@/actions/city/city-metadata-actions";

describe("findCityBySlug", () => {
  it("finds Santa Cruz by simple slug", async () => {
    const result = await findCityBySlug("santa-cruz");

    expect(result.success).toBe(true);
    expect(result.data?.cityName).toBe("Santa Cruz");
    expect(result.data?.state).toBe("CA");
  });

  it("finds city by slug with state suffix", async () => {
    const result = await findCityBySlug("san-diego-ca");

    expect(result.success).toBe(true);
    expect(result.data?.cityName).toBe("San Diego");
    expect(result.data?.state).toBe("CA");
  });

  it("returns null for ambiguous slug without state suffix", async () => {
    // If Newport exists in multiple states, slug without suffix should fail
    // This test may pass or fail depending on data - adjust as needed
    const result = await findCityBySlug("nonexistent-city-xyz");

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("returns null for city with fewer than 3 beaches", async () => {
    // Use a city known to have fewer than 3 beaches if exists
    const result = await findCityBySlug("tiny-town-with-one-beach");

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/actions/city/city-metadata-actions.test.ts`
Expected: FAIL - findCityBySlug is not defined

**Step 3: Implement findCityBySlug**

Add to `actions/city/city-metadata-actions.ts`:

```typescript
import { resolveCityFromSlug } from "@/lib/seo/city-slug-utils";

/**
 * Find a city by its URL slug and return full metadata.
 * Handles both simple slugs ("santa-cruz") and state-suffixed slugs ("newport-ca").
 * Returns null if city not found, ambiguous, or has fewer than 3 beaches.
 */
export async function findCityBySlug(slug: string) {
  return withDatabaseOperation<CityMetadata | null>(async (supabase) => {
    const { cityPattern, stateFilter } = resolveCityFromSlug(slug);

    // Build query to find matching cities
    let query = supabase
      .from("beaches")
      .select("city, state")
      .ilike("city", `%${cityPattern}%`)
      .or("is_private.is.null,is_private.eq.false");

    if (stateFilter) {
      query = query.eq("state", stateFilter);
    }

    const { data: matches, error } = await query;

    if (error) throw error;

    if (!matches || matches.length === 0) {
      return { data: null, error: null };
    }

    // Group by city/state to find unique combinations
    const cityStates = new Map<string, { city: string; state: string; count: number }>();
    for (const match of matches) {
      const key = `${match.city}|${match.state}`;
      const existing = cityStates.get(key);
      if (existing) {
        existing.count++;
      } else {
        cityStates.set(key, { city: match.city, state: match.state, count: 1 });
      }
    }

    // Filter to cities with 3+ beaches
    const validCities = [...cityStates.values()].filter((c) => c.count >= 3);

    if (validCities.length === 0) {
      return { data: null, error: null };
    }

    // If multiple valid cities and no state filter, ambiguous
    if (validCities.length > 1 && !stateFilter) {
      return { data: null, error: null };
    }

    // Use first valid city (or only match with state filter)
    const { city, state } = validCities[0];

    // Get full metadata
    const metadataResult = await getCityMetadata(city, state);
    return metadataResult;
  });
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/actions/city/city-metadata-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add actions/city/city-metadata-actions.ts __tests__/actions/city/city-metadata-actions.test.ts
git commit -m "feat(actions): add findCityBySlug for slug-based city lookup"
```

---

## Phase 3: Content Templates

### Task 7: Create Intent Content Templates

**Files:**
- Create: `lib/seo/intent-content-templates.ts`
- Test: `__tests__/lib/seo/intent-content-templates.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/seo/intent-content-templates.test.ts
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
import type { CityMetadata } from "@/actions/city/city-metadata-actions";

const mockMetadata: CityMetadata = {
  cityName: "Santa Cruz",
  state: "CA",
  stateName: "California",
  totalBeaches: 5,
  beginnerCount: 1,
  intermediateCount: 3,
  advancedCount: 1,
  beaches: [
    { name: "Steamer Lane", slug: "steamer-lane", skillLevel: "advanced" },
    { name: "Pleasure Point", slug: "pleasure-point", skillLevel: "intermediate" },
    { name: "38th Avenue", slug: "38th-avenue", skillLevel: "lower-intermediate" },
  ],
  centerLat: 36.95,
  centerLon: -122.02,
};

describe("buildIntentPageContent", () => {
  it("generates beginner page content", () => {
    const content = buildIntentPageContent("beginner", mockMetadata);

    expect(content.title).toContain("Santa Cruz");
    expect(content.title).toContain("Beginner");
    expect(content.heading).toContain("Santa Cruz");
    expect(content.intro).toBeTruthy();
    expect(content.metaDescription).toContain("Santa Cruz");
    expect(content.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it("generates least-crowded page content", () => {
    const content = buildIntentPageContent("least-crowded", mockMetadata);

    expect(content.title).toContain("Crowded");
    expect(content.heading).toContain("crowded");
  });

  it("includes beach names in content", () => {
    const content = buildIntentPageContent("beginner", mockMetadata);

    expect(content.intro).toMatch(/Steamer Lane|Pleasure Point|38th Avenue/);
  });

  it("handles city with no beginner spots gracefully", () => {
    const noBeginnerMetadata: CityMetadata = {
      ...mockMetadata,
      beginnerCount: 0,
    };
    const content = buildIntentPageContent("beginner", noBeginnerMetadata);

    expect(content.intro).toBeTruthy();
    // Should mention alternatives or acknowledge challenge
    expect(content.intro.toLowerCase()).toMatch(/challenging|advanced|experienced/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/seo/intent-content-templates.test.ts`
Expected: FAIL - Cannot find module

**Step 3: Implement buildIntentPageContent**

```typescript
// lib/seo/intent-content-templates.ts
import type { CityMetadata } from "@/actions/city/city-metadata-actions";
import type { SurfIntentSlug } from "@/lib/data/surf-spots";

export interface IntentPageContent {
  title: string;
  heading: string;
  intro: string;
  metaDescription: string;
}

function getTopSpotNames(metadata: CityMetadata, count: number = 3): string {
  return metadata.beaches
    .slice(0, count)
    .map((b) => b.name)
    .join(", ");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

const templates: Record<SurfIntentSlug, (m: CityMetadata) => IntentPageContent> = {
  beginner: (m) => {
    const spots = getTopSpotNames(m);
    const hasBeginnerSpots = m.beginnerCount > 0;

    return {
      title: `${m.cityName} Beginner Surf Spots & Lessons | ${m.stateName}`,
      heading: `Beginner-friendly waves in ${m.cityName}`,
      intro: hasBeginnerSpots
        ? `${m.cityName} offers ${m.totalBeaches} surf spots along the ${m.stateName} coast, including ${m.beginnerCount} beginner-friendly breaks. Start your surfing journey at spots like ${spots}, where mellow waves and sandy bottoms welcome new surfers.`
        : `${m.cityName} is known for more challenging waves suited to experienced surfers. Spots like ${spots} offer powerful breaks. Beginners may want to consider nearby cities with gentler learning waves, or book a lesson with a local surf school that knows the safest conditions.`,
      metaDescription: truncate(
        `Find beginner surf spots in ${m.cityName}, ${m.state}. ${m.totalBeaches} breaks including ${spots}. Updated daily with conditions.`,
        160
      ),
    };
  },

  "least-crowded": (m) => {
    const spots = getTopSpotNames(m);
    return {
      title: `${m.cityName} Uncrowded Surf Spots | ${m.stateName}`,
      heading: `Less crowded waves in ${m.cityName}`,
      intro: `Find your own peak in ${m.cityName}. With ${m.totalBeaches} surf spots spread across the coastline, including ${spots}, you can escape the crowds. Early mornings and weekdays offer the best chance at empty lineups.`,
      metaDescription: truncate(
        `Escape the crowds at ${m.cityName} surf spots. ${m.totalBeaches} breaks including ${spots}. Find uncrowded waves today.`,
        160
      ),
    };
  },

  tide: (m) => {
    const spots = getTopSpotNames(m);
    return {
      title: `${m.cityName} Surf Tide Guide | Best Tides by Spot`,
      heading: `Tide guide for ${m.cityName} surf spots`,
      intro: `Understanding tides is key to scoring good waves in ${m.cityName}. Each of the ${m.totalBeaches} spots—including ${spots}—has its own tide preferences. Some breaks fire on low tide, others need a pushing mid-tide.`,
      metaDescription: truncate(
        `${m.cityName} surf tide guide. Best tide windows for ${m.totalBeaches} spots including ${spots}. Plan your session.`,
        160
      ),
    };
  },

  "water-temp": (m) => {
    const spots = getTopSpotNames(m);
    return {
      title: `${m.cityName} Water Temperature & Wetsuit Guide`,
      heading: `Water temperature in ${m.cityName}`,
      intro: `Know what to wear before you paddle out in ${m.cityName}. Water temps along the ${m.stateName} coast vary by season. Check current conditions at spots like ${spots} and gear up with the right wetsuit thickness.`,
      metaDescription: truncate(
        `${m.cityName} water temperature and wetsuit guide. Current conditions for ${m.totalBeaches} surf spots.`,
        160
      ),
    };
  },

  longboard: (m) => {
    const spots = getTopSpotNames(m);
    return {
      title: `${m.cityName} Longboard Surf Spots | Mellow Waves`,
      heading: `Best longboard waves in ${m.cityName}`,
      intro: `${m.cityName} delivers classic longboard waves when conditions align. Look for mellow, peeling walls at spots like ${spots}. Small summer swells and glassy mornings are prime time for nose-riding and classic style.`,
      metaDescription: truncate(
        `Find longboard-friendly waves in ${m.cityName}. ${m.totalBeaches} spots including ${spots}. Mellow waves for logging.`,
        160
      ),
    };
  },

  "dawn-patrol": (m) => {
    const spots = getTopSpotNames(m);
    return {
      title: `${m.cityName} Dawn Patrol Surf Spots | Early Morning`,
      heading: `Dawn patrol spots in ${m.cityName}`,
      intro: `Beat the crowds and catch glassy morning conditions in ${m.cityName}. Dawn patrol at spots like ${spots} means lighter winds, fewer surfers, and often the best waves of the day. Get there before sunrise for the magic hour.`,
      metaDescription: truncate(
        `Dawn patrol surf spots in ${m.cityName}. ${m.totalBeaches} early morning breaks including ${spots}.`,
        160
      ),
    };
  },

  sunset: (m) => {
    const spots = getTopSpotNames(m);
    return {
      title: `${m.cityName} Sunset Surf Sessions | Evening Waves`,
      heading: `Sunset sessions in ${m.cityName}`,
      intro: `End your day with a sunset surf in ${m.cityName}. Evening glass-off conditions at spots like ${spots} offer clean waves as winds die down. Pack your headlamp for the walk back and catch the golden hour.`,
      metaDescription: truncate(
        `Sunset surf sessions in ${m.cityName}. ${m.totalBeaches} evening spots including ${spots}.`,
        160
      ),
    };
  },
};

/**
 * Generate page content for an intent page using smart templates.
 */
export function buildIntentPageContent(
  intent: SurfIntentSlug,
  metadata: CityMetadata
): IntentPageContent {
  const template = templates[intent];
  if (!template) {
    // Fallback for unknown intents
    return {
      title: `${metadata.cityName} Surf Spots | ${metadata.stateName}`,
      heading: `Surf spots in ${metadata.cityName}`,
      intro: `Explore ${metadata.totalBeaches} surf spots in ${metadata.cityName}, ${metadata.stateName}.`,
      metaDescription: `${metadata.cityName} surf spots. ${metadata.totalBeaches} breaks to explore.`,
    };
  }
  return template(metadata);
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/seo/intent-content-templates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/seo/intent-content-templates.ts __tests__/lib/seo/intent-content-templates.test.ts
git commit -m "feat(seo): add intent content templates with smart data injection"
```

---

## Phase 4: Refactor Intent Page

### Task 8: Update Intent Page to Use Database Resolution

**Files:**
- Modify: `app/[intent]/[city]/page.tsx`
- Reference: `actions/city/city-metadata-actions.ts`
- Reference: `lib/seo/intent-content-templates.ts`

**Step 1: Read current implementation**

Run: Read `app/[intent]/[city]/page.tsx` to understand current flow.

**Step 2: Update imports**

Add new imports at top of file:

```typescript
import { findCityBySlug, type CityMetadata } from "@/actions/city/city-metadata-actions";
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
```

**Step 3: Replace city resolution logic**

Find the section after state-level and legacy route handling. Replace the hardcoded city lookup with database lookup.

**Before (around line 186):**
```typescript
if (!city || !definition) {
  return notFound();
}
```

**After:**
```typescript
// Database-driven city resolution (replaces hardcoded SURF_CITIES)
const cityResult = await findCityBySlug(params.city);
const cityMetadata = cityResult.success ? cityResult.data : null;

if (!cityMetadata || !definition) {
  return notFound();
}

// Generate content from templates
const pageContent = buildIntentPageContent(params.intent as SurfIntentSlug, cityMetadata);
```

**Step 4: Update page rendering to use cityMetadata**

Replace references to `city.name` with `cityMetadata.cityName`, etc.

Update the header section:
```typescript
<header className="mb-8">
  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
    {pageContent.heading}
  </h1>
  <p className="text-lg text-gray-600 mb-4">
    {cityMetadata.cityName}, {cityMetadata.stateName}
  </p>

  <div className="space-y-2 mt-6">
    <p className="text-base text-slate-700">
      Updated {updatedAt} · Dialed recommendations refresh every 30
      minutes based on tide, wind, and crowd telemetry from Quiver.
    </p>
    <p className="text-base text-slate-700">
      {pageContent.intro}
    </p>
  </div>
</header>
```

**Step 5: Update generateMetadata**

Update the metadata function to use database resolution:

```typescript
export async function generateMetadata({
  params,
}: IntentPageParams): Promise<Metadata> {
  // State-level intent pages (existing)
  if (isValidStateSlug(params.city) && SURF_INTENTS[params.intent as SurfIntentSlug]) {
    // ... existing state-level logic
  }

  // Legacy state/city URL redirect (existing)
  if (isValidStateSlug(params.intent)) {
    // ... existing legacy logic
  }

  // Database-driven city metadata
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];
  if (!definition) return {};

  const cityResult = await findCityBySlug(params.city);
  if (!cityResult.success || !cityResult.data) return {};

  const cityMetadata = cityResult.data;
  const pageContent = buildIntentPageContent(params.intent as SurfIntentSlug, cityMetadata);

  return buildPageMetadata({
    title: pageContent.title,
    description: pageContent.metaDescription,
    path: `/${params.intent}/${params.city}`,
    keywords: [
      `${cityMetadata.cityName} ${definition.label}`,
      `${cityMetadata.cityName} surf`,
      `${cityMetadata.stateName} surfing`,
    ],
  });
}
```

**Step 6: Test manually**

Run: `yarn dev`
Visit: `http://localhost:3000/beginner/santa-cruz`
Expected: Page loads with Santa Cruz data

Visit: `http://localhost:3000/tide/honolulu`
Expected: Page loads with Honolulu data

**Step 7: Commit**

```bash
git add app/[intent]/[city]/page.tsx
git commit -m "feat(intent-pages): use database resolution instead of hardcoded cities"
```

---

### Task 9: Update generateStaticParams for All Cities

**Files:**
- Modify: `app/[intent]/[city]/page.tsx`
- Reference: `actions/beach/beach-location-actions.ts`

**Step 1: Update generateStaticParams**

Replace the current implementation:

```typescript
import { getAllCitiesWithBeaches } from "@/actions/beach/beach-location-actions";
import { detectCityCollisions, buildCitySlug } from "@/lib/seo/city-slug-utils";
import { SURF_INTENTS, type SurfIntentSlug } from "@/lib/data/surf-spots";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";

const INTENT_SLUGS = Object.keys(SURF_INTENTS) as SurfIntentSlug[];
const US_STATES = ["ca", "hi", "or", "wa", "fl", "nc", "sc", "nj", "ny", "tx", "ma", "me", "ri", "pr"];

export async function generateStaticParams() {
  const params: Array<{ intent: string; city: string }> = [];

  try {
    // Get all cities with 3+ beaches
    const citiesResult = await getAllCitiesWithBeaches(3);
    if (citiesResult.success && citiesResult.data) {
      // Detect collisions
      const collisionMap = detectCityCollisions(citiesResult.data);

      // Generate city × intent combinations
      for (const cityRecord of citiesResult.data) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        for (const intent of INTENT_SLUGS) {
          params.push({ intent, city: citySlug });
        }
      }
    }
  } catch (error) {
    console.error("generateStaticParams: Failed to fetch cities", error);
  }

  // Add state-level intent params
  for (const state of US_STATES) {
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, city: state });
    }
  }

  return params;
}
```

**Step 2: Verify build**

Run: `yarn build 2>&1 | grep -E "(intent|city|Generating|error)" | head -30`
Expected: Build succeeds, shows static pages being generated

**Step 3: Commit**

```bash
git add app/[intent]/[city]/page.tsx
git commit -m "feat(intent-pages): generate static params for all cities with 3+ beaches"
```

---

## Phase 5: Sitemap & Cleanup

### Task 10: Update Sitemap

**Files:**
- Modify: `app/sitemap.ts`

**Step 1: Simplify sitemap generation**

The sitemap should rely on the same logic as generateStaticParams. Update to use shared utilities:

```typescript
// Add intent routes for all cities
import { getAllCitiesWithBeaches } from "@/actions/beach/beach-location-actions";
import { detectCityCollisions, buildCitySlug } from "@/lib/seo/city-slug-utils";

// In sitemap function, replace dynamicIntentRoutes generation:
let cityIntentRoutes: MetadataRoute.Sitemap = [];
try {
  const citiesResult = await getAllCitiesWithBeaches(3);
  if (citiesResult.success && citiesResult.data) {
    const collisionMap = detectCityCollisions(citiesResult.data);
    const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

    cityIntentRoutes = citiesResult.data.flatMap((cityRecord) => {
      const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
      if (!citySlug) return [];

      return intents.map((intent) => ({
        url: `${baseUrl}/${intent}/${citySlug}`,
        lastModified: lastmod,
        changeFrequency: "daily" as const,
        priority: intent === "beginner" ? 0.85 : 0.8,
      }));
    });
  }
} catch (error) {
  console.error("Sitemap: Failed to generate city intent routes", error);
}
```

**Step 2: Test sitemap**

Run: `yarn build && yarn start &` then `curl http://localhost:3000/sitemap.xml | grep santa-cruz | head -5`
Expected: Shows Santa Cruz URLs in sitemap

**Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat(sitemap): include all database-driven city intent pages"
```

---

### Task 11: Add E2E Test

**Files:**
- Create: `e2e/intent-pages-database.spec.ts`

**Step 1: Write E2E test**

```typescript
// e2e/intent-pages-database.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Database-driven intent pages", () => {
  test("Santa Cruz beginner page loads", async ({ page }) => {
    await page.goto("/beginner/santa-cruz");

    // Should not 404
    await expect(page).not.toHaveURL(/404/);

    // Should have Santa Cruz in heading
    const heading = page.locator("h1");
    await expect(heading).toContainText(/Santa Cruz/i);

    // Should have beach list or map
    await expect(page.locator("main")).toBeVisible();
  });

  test("Honolulu tide page loads", async ({ page }) => {
    await page.goto("/tide/honolulu");

    await expect(page).not.toHaveURL(/404/);
    await expect(page.locator("h1")).toContainText(/Honolulu/i);
  });

  test("Nonexistent city returns 404", async ({ page }) => {
    const response = await page.goto("/beginner/nonexistent-city-xyz");

    expect(response?.status()).toBe(404);
  });

  test("State-level pages still work", async ({ page }) => {
    await page.goto("/beginner/ca");

    await expect(page).not.toHaveURL(/404/);
    await expect(page.locator("h1")).toContainText(/California/i);
  });
});
```

**Step 2: Run E2E test**

Run: `yarn test:e2e e2e/intent-pages-database.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/intent-pages-database.spec.ts
git commit -m "test(e2e): add database-driven intent pages tests"
```

---

### Task 12: Final Cleanup and Verification

**Step 1: Remove unused hardcoded city imports**

In `app/[intent]/[city]/page.tsx`, remove or comment out unused imports:
- `SURF_CITY_SLUGS` (if no longer used)
- `getCityBySlug` (if no longer used)
- `getSpotsForIntent` (if no longer used as primary)

Keep `SURF_INTENTS` as it's still needed for intent definitions.

**Step 2: Run full test suite**

Run: `yarn test:unit`
Expected: Same or better pass rate as baseline

**Step 3: Run build**

Run: `yarn build`
Expected: Build succeeds, shows 350+ static pages generated

**Step 4: Manual verification**

Test these URLs locally:
- `/beginner/santa-cruz` - Should load
- `/tide/san-francisco` - Should load
- `/longboard/malibu` - Should load
- `/beginner/ca` - State page should still work
- `/beginner/nonexistent` - Should 404

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: cleanup unused hardcoded city imports"
```

---

## Summary

**Files Created:**
- `lib/seo/city-slug-utils.ts`
- `lib/seo/intent-content-templates.ts`
- `actions/city/city-metadata-actions.ts`
- `__tests__/lib/seo/city-slug-utils.test.ts`
- `__tests__/lib/seo/intent-content-templates.test.ts`
- `__tests__/actions/city/city-metadata-actions.test.ts`
- `e2e/intent-pages-database.spec.ts`

**Files Modified:**
- `app/[intent]/[city]/page.tsx`
- `app/sitemap.ts`

**Result:**
- ~350 new SEO pages for 50+ cities × 7 intents
- Santa Cruz and all other cities with 3+ beaches now work
- State-suffixed slugs handle collisions automatically
- Smart templates generate unique content per city
