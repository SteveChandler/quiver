# SEO Domination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scale intent pages to all cities, add state-level pages, create regional hub pages, and establish technical SEO foundation.

**Architecture:** Extend existing `/{intent}/{city}` pattern to database-driven approach. Add new `/{intent}/{state}` routes. Create hub pages at `/guides/surfing-{region}` with Mapbox maps.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Mapbox GL, existing SEO utilities

---

## Phase 1: Technical Foundation & Quick Wins

### Task 1: Add robots.txt

**Files:**
- Create: `public/robots.txt`
- Modify: `app/sitemap.ts` (verify sitemap URL)

**Step 1: Create robots.txt file**

```txt
# Quiver Surf - robots.txt
User-agent: *
Allow: /

# Sitemap
Sitemap: https://www.quiversurf.app/sitemap.xml

# Block non-SEO pages
Disallow: /api/
Disallow: /admin/
Disallow: /profile/
Disallow: /inbox/
Disallow: /sessions/
Disallow: /_next/

# Allow specific API endpoints for rich results
Allow: /api/og/
```

**Step 2: Verify file is served**

Run: `yarn dev` then `curl http://localhost:3000/robots.txt`
Expected: File contents returned with correct MIME type

**Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "feat(seo): add robots.txt with sitemap reference"
```

---

### Task 2: Create getBeachesByIntentAndCity Action

**Files:**
- Modify: `actions/beach/beach-query-actions.ts`
- Test: `__tests__/actions/beach/beach-query-actions.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/actions/beach/beach-query-actions.test.ts`:

```typescript
describe("getBeachesByIntentAndCity", () => {
  it("returns beginner beaches for a given city", async () => {
    const result = await getBeachesByIntentAndCity("beginner", "san-diego", "ca");

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    // All returned beaches should have beginner-friendly skill level
    result.data?.forEach((beach) => {
      const skill = (beach.skill_level || "").toLowerCase();
      expect(skill).toMatch(/beginner|longboard/i);
    });
  });

  it("returns empty array for city with no matching beaches", async () => {
    const result = await getBeachesByIntentAndCity("beginner", "nonexistent-city", "zz");

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/actions/beach/beach-query-actions.test.ts`
Expected: FAIL - getBeachesByIntentAndCity is not defined

**Step 3: Implement the action**

Add to `actions/beach/beach-query-actions.ts`:

```typescript
/**
 * Intent to skill_level mapping for database queries.
 * Maps SurfIntentSlug to database skill_level patterns.
 */
const INTENT_SKILL_FILTERS: Record<string, string[]> = {
  beginner: ["beginner", "longboard"],
  longboard: ["longboard", "beginner"],
  advanced: ["advanced", "expert"],
};

/**
 * Intent to crowd_level mapping.
 */
const INTENT_CROWD_FILTERS: Record<string, string[]> = {
  "least-crowded": ["light", "low"],
};

/**
 * Fetch beaches matching an intent for a specific city.
 *
 * @param intent - The surf intent (beginner, least-crowded, tide, water-temp)
 * @param citySlug - City slug (e.g., "san-diego")
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByIntentAndCity(
  intent: string,
  citySlug: string,
  stateSlug: string
) {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    // Start with base query for city
    let query = supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .or("is_private.is.null,is_private.eq.false");

    // Match city by slug pattern (handles hyphenated city names)
    const cityPattern = citySlug.replace(/-/g, " ");
    query = query.ilike("city", `%${cityPattern}%`);

    // Match state
    const stateUpper = stateSlug.toUpperCase();
    query = query.or(`state.eq.${stateUpper},state.ilike.%${stateSlug}%`);

    // Apply intent-specific filters
    const skillFilters = INTENT_SKILL_FILTERS[intent];
    if (skillFilters) {
      const skillConditions = skillFilters
        .map((s) => `skill_level.ilike.%${s}%`)
        .join(",");
      query = query.or(skillConditions);
    }

    const crowdFilters = INTENT_CROWD_FILTERS[intent];
    if (crowdFilters) {
      const crowdConditions = crowdFilters
        .map((c) => `crowd_level.ilike.%${c}%`)
        .join(",");
      query = query.or(crowdConditions);
    }

    // tide and water-temp intents return all beaches (no filtering)

    const { data, error } = await query.order("name");

    if (error) throw error;

    return { data: (data ?? []) as Beach[], error: null };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/actions/beach/beach-query-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add actions/beach/beach-query-actions.ts __tests__/actions/beach/beach-query-actions.test.ts
git commit -m "feat(actions): add getBeachesByIntentAndCity for database-driven intent pages"
```

---

### Task 3: Create getBeachesByIntentAndState Action

**Files:**
- Modify: `actions/beach/beach-query-actions.ts`
- Test: `__tests__/actions/beach/beach-query-actions.test.ts`

**Step 1: Write the failing test**

```typescript
describe("getBeachesByIntentAndState", () => {
  it("returns beginner beaches for a given state", async () => {
    const result = await getBeachesByIntentAndState("beginner", "ca");

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data!.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/actions/beach/beach-query-actions.test.ts`
Expected: FAIL

**Step 3: Implement the action**

```typescript
/**
 * Fetch beaches matching an intent for an entire state.
 *
 * @param intent - The surf intent
 * @param stateSlug - State slug (e.g., "ca")
 */
export async function getBeachesByIntentAndState(
  intent: string,
  stateSlug: string
) {
  return withDatabaseOperation<Beach[]>(async (supabase) => {
    let query = supabase
      .from("beaches")
      .select(BEACH_DETAIL_FIELDS)
      .or("is_private.is.null,is_private.eq.false");

    // Match state
    const stateUpper = stateSlug.toUpperCase();
    query = query.or(`state.eq.${stateUpper},state.ilike.%${stateSlug}%`);

    // Apply intent-specific filters (same as city version)
    const skillFilters = INTENT_SKILL_FILTERS[intent];
    if (skillFilters) {
      const skillConditions = skillFilters
        .map((s) => `skill_level.ilike.%${s}%`)
        .join(",");
      query = query.or(skillConditions);
    }

    const crowdFilters = INTENT_CROWD_FILTERS[intent];
    if (crowdFilters) {
      const crowdConditions = crowdFilters
        .map((c) => `crowd_level.ilike.%${c}%`)
        .join(",");
      query = query.or(crowdConditions);
    }

    const { data, error } = await query
      .order("city")
      .order("name")
      .limit(100); // Limit for performance

    if (error) throw error;

    return { data: (data ?? []) as Beach[], error: null };
  });
}
```

**Step 4: Run test and commit**

```bash
yarn test:unit __tests__/actions/beach/beach-query-actions.test.ts
git add -A && git commit -m "feat(actions): add getBeachesByIntentAndState for state-level intent pages"
```

---

### Task 4: Create getAllCitiesWithBeaches Action

**Files:**
- Create: `actions/beach/beach-location-actions.ts`

**Step 1: Implement the action**

```typescript
"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";

export interface CityWithBeachCount {
  city: string;
  state: string;
  country: string | null;
  beachCount: number;
}

/**
 * Get all cities that have at least N beaches.
 * Used for generating intent pages for cities with sufficient content.
 */
export async function getAllCitiesWithBeaches(minBeaches: number = 1) {
  return withDatabaseOperation<CityWithBeachCount[]>(async (supabase) => {
    const { data, error } = await supabase
      .from("beaches")
      .select("city, state, country")
      .or("is_private.is.null,is_private.eq.false")
      .not("city", "is", null)
      .not("state", "is", null);

    if (error) throw error;

    // Aggregate by city/state/country
    const cityMap = new Map<string, CityWithBeachCount>();

    for (const beach of data || []) {
      const key = `${beach.city}|${beach.state}|${beach.country || "USA"}`;
      const existing = cityMap.get(key);

      if (existing) {
        existing.beachCount++;
      } else {
        cityMap.set(key, {
          city: beach.city,
          state: beach.state,
          country: beach.country || "USA",
          beachCount: 1,
        });
      }
    }

    // Filter by minimum beach count
    const cities = [...cityMap.values()]
      .filter((c) => c.beachCount >= minBeaches)
      .sort((a, b) => a.city.localeCompare(b.city));

    return { data: cities, error: null };
  });
}
```

**Step 2: Commit**

```bash
git add actions/beach/beach-location-actions.ts
git commit -m "feat(actions): add getAllCitiesWithBeaches for sitemap generation"
```

---

### Task 5: Update Intent Page to Use Database

**Files:**
- Modify: `app/[intent]/[city]/page.tsx`
- Reference: `lib/utils/beach-to-surfspot-transformer.ts`

**Step 1: Read current implementation**

Current page uses hardcoded `SURF_CITIES` and `getSpotsForIntent()`. Need to replace with database query.

**Step 2: Update the page component**

Replace the spots fetching logic:

```typescript
// OLD: const spots = getSpotsForIntent(city.slug, params.intent as SurfIntentSlug);

// NEW: Fetch from database
import { getBeachesByIntentAndCity } from "@/actions/beach/beach-query-actions";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";

// In the component:
const beachesResult = await getBeachesByIntentAndCity(
  params.intent,
  params.city,
  "ca" // TODO: Detect state from city or URL
);

if (!beachesResult.success || !beachesResult.data?.length) {
  // Fall back to hardcoded data if database returns nothing
  const spots = getSpotsForIntent(city.slug, params.intent as SurfIntentSlug);
  if (spots.length === 0) return notFound();
  // ... use hardcoded spots
}

const spots = transformBeachesToSurfSpots(beachesResult.data);
```

**Step 3: Test manually**

Run: `yarn dev`
Visit: `http://localhost:3000/beginner/san-diego`
Expected: Page loads with beaches from database

**Step 4: Commit**

```bash
git add app/[intent]/[city]/page.tsx
git commit -m "feat(intent-pages): use database for intent page beaches with hardcoded fallback"
```

---

### Task 6: Expand Sitemap to All Cities

**Files:**
- Modify: `app/sitemap.ts`

**Step 1: Update sitemap to include all cities with beaches**

Add after existing intentRoutes:

```typescript
import { getAllCitiesWithBeaches } from "@/actions/beach/beach-location-actions";
import { slugifyAscii } from "@/lib/utils/text-utils";
import { stateToSlug } from "@/lib/utils/beach-url-utils";

// Generate intent routes for ALL cities with 3+ beaches
let dynamicIntentRoutes: MetadataRoute.Sitemap = [];
try {
  const citiesResult = await getAllCitiesWithBeaches(3);
  if (citiesResult.success && citiesResult.data) {
    const intents = ["beginner", "least-crowded", "tide", "water-temp"];

    dynamicIntentRoutes = citiesResult.data.flatMap((city) => {
      const citySlug = slugifyAscii(city.city);
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
  console.error("Sitemap: Failed to generate dynamic intent routes", error);
}

// Add to return array
return [
  ...staticRoutes,
  ...cityRoutes,
  ...intentRoutes,
  ...dynamicIntentRoutes, // NEW
  ...usaStateRoutes,
  ...locationRoutes,
  ...beachEntries,
];
```

**Step 2: Test sitemap generation**

Run: `yarn build && curl http://localhost:3000/sitemap.xml | head -100`
Expected: Sitemap includes many more intent URLs

**Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat(sitemap): expand to all cities with 3+ beaches for intent pages"
```

---

## Phase 2: State-Level Intent Pages

### Task 7: Create State Intent Page Route

**Files:**
- Create: `app/[intent]/[state]/page.tsx` (careful: may conflict with city route)
- Alternative: Create at `app/surf/[intent]/[state]/page.tsx` to avoid conflicts

**Analysis:** The existing `app/[intent]/[city]/page.tsx` would conflict. We need a disambiguated route.

**Option A:** Use `/surf/beginner/california` pattern
**Option B:** Use `/beginner/state/california` pattern
**Option C:** Detect state vs city in the existing `[city]` param

**Recommended:** Option C - detect in existing route, similar to how it detects legacy state/city URLs.

**Step 1: Update existing intent/city page to handle states**

In `app/[intent]/[city]/page.tsx`, add state detection:

```typescript
import {
  isValidStateSlug,
  getUsStateDisplayNameFromSlug
} from "@/lib/utils/beach-url-utils";
import { getBeachesByIntentAndState } from "@/actions/beach/beach-query-actions";

// Near top of component, after legacy route handling:
const isStateRoute = isValidStateSlug(params.city);

if (isStateRoute) {
  // This is /{intent}/{state} like /beginner/ca
  const stateName = getUsStateDisplayNameFromSlug(params.city);
  const beachesResult = await getBeachesByIntentAndState(params.intent, params.city);

  if (!beachesResult.success || !beachesResult.data?.length) {
    return notFound();
  }

  const spots = transformBeachesToSurfSpots(beachesResult.data);

  // Render state-level intent page
  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: `${stateName} Surf`, url: `${baseUrl}/beaches/usa/${params.city}` },
          { name: definition.label, url: `${baseUrl}/${params.intent}/${params.city}` },
        ]}
      />
      {/* State-level content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold">
          {definition.heading({ cityName: stateName })}
        </h1>
        <p className="text-lg text-gray-600 mt-2">
          {spots.length} spots across {stateName}
        </p>
        {/* Map and spot list */}
        <StateMapView
          beaches={beachesResult.data}
          ariaLabel={`${definition.label} spots in ${stateName}`}
        />
      </div>
    </div>
  );
}
```

**Step 2: Update generateMetadata for state routes**

```typescript
export async function generateMetadata({ params }: IntentPageParams): Promise<Metadata> {
  const definition = SURF_INTENTS[params.intent as SurfIntentSlug];

  // State-level intent page
  if (isValidStateSlug(params.city)) {
    const stateName = getUsStateDisplayNameFromSlug(params.city);
    return buildPageMetadata({
      title: `${definition?.label || "Surf"} Spots in ${stateName}`,
      description: `Find the best ${definition?.label?.toLowerCase() || "surf"} spots across ${stateName}. AI-powered recommendations for every skill level.`,
      path: `/${params.intent}/${params.city}`,
    });
  }

  // Existing city-level logic...
}
```

**Step 3: Add state intent routes to sitemap**

```typescript
// State-level intent routes
const usStates = ["ca", "or", "wa", "hi", "fl", "nj", "ny", "nc", "sc", "tx"];
const intents = ["beginner", "least-crowded", "tide", "water-temp"];

const stateIntentRoutes: MetadataRoute.Sitemap = usStates.flatMap((state) =>
  intents.map((intent) => ({
    url: `${baseUrl}/${intent}/${state}`,
    lastModified: lastmod,
    changeFrequency: "daily" as const,
    priority: 0.75,
  }))
);
```

**Step 4: Test and commit**

```bash
yarn dev
# Visit http://localhost:3000/beginner/ca
git add -A && git commit -m "feat(intent-pages): add state-level intent pages (/beginner/ca)"
```

---

### Task 8: Add FAQPage Structured Data to Intent Pages

**Files:**
- Create: `components/seo/faq-structured-data.tsx`
- Modify: `app/[intent]/[city]/page.tsx`

**Step 1: Create FAQ structured data component**

```typescript
// components/seo/faq-structured-data.tsx
import Script from "next/script";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQStructuredDataProps {
  items: FAQItem[];
}

export function FAQStructuredData({ items }: FAQStructuredDataProps) {
  if (items.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

**Step 2: Generate FAQ items for intent pages**

```typescript
function generateIntentFAQ(
  intent: SurfIntentSlug,
  cityName: string,
  topSpots: string[]
): { question: string; answer: string }[] {
  const faqs: Record<SurfIntentSlug, { question: string; answer: string }[]> = {
    beginner: [
      {
        question: `What are the best beginner surf spots in ${cityName}?`,
        answer: `The top beginner-friendly surf spots in ${cityName} include ${topSpots.slice(0, 3).join(", ")}. These spots feature gentle waves, sandy bottoms, and manageable crowds.`,
      },
      {
        question: `Is ${cityName} good for learning to surf?`,
        answer: `Yes! ${cityName} offers excellent conditions for learning to surf with consistent small waves, surf schools, and beginner-friendly beaches.`,
      },
    ],
    "least-crowded": [
      {
        question: `Where can I find uncrowded waves in ${cityName}?`,
        answer: `Less crowded surf spots in ${cityName} include ${topSpots.slice(0, 3).join(", ")}. Early mornings and weekdays offer the best chance for empty lineups.`,
      },
    ],
    tide: [
      {
        question: `What's the best tide for surfing in ${cityName}?`,
        answer: `Tide preferences vary by spot in ${cityName}. Generally, incoming mid-tides work well for most beaches. Check individual spot guides for specific recommendations.`,
      },
    ],
    "water-temp": [
      {
        question: `What wetsuit do I need for ${cityName}?`,
        answer: `Water temperatures in ${cityName} typically range from 55-70°F. A 3/2mm wetsuit works for summer, while 4/3mm is recommended for winter.`,
      },
    ],
  };

  return faqs[intent] || [];
}
```

**Step 3: Add to intent page**

```typescript
// In the return statement:
<FAQStructuredData
  items={generateIntentFAQ(params.intent as SurfIntentSlug, city.name, spots.map(s => s.name))}
/>
```

**Step 4: Commit**

```bash
git add components/seo/faq-structured-data.tsx app/[intent]/[city]/page.tsx
git commit -m "feat(seo): add FAQPage structured data to intent pages"
```

---

## Phase 3: Regional Hub Pages

### Task 9: Create Hub Page Route and Template

**Files:**
- Create: `app/guides/surfing-[region]/page.tsx`
- Create: `components/hub/hub-map-view.tsx`
- Create: `lib/data/hub-regions.ts`

**Step 1: Define hub regions**

```typescript
// lib/data/hub-regions.ts
export interface HubRegion {
  slug: string;
  name: string;
  title: string;
  description: string;
  states: string[]; // State slugs to include
  centerLat: number;
  centerLng: number;
  zoom: number;
}

export const HUB_REGIONS: Record<string, HubRegion> = {
  "southern-california": {
    slug: "southern-california",
    name: "Southern California",
    title: "Complete Guide to Surfing Southern California",
    description: "From Malibu to the Mexican border, Southern California offers world-class waves for every skill level. Explore 200+ surf spots across LA, Orange County, and San Diego.",
    states: ["ca"],
    centerLat: 33.5,
    centerLng: -117.8,
    zoom: 8,
  },
  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    title: "Complete Guide to Surfing San Diego",
    description: "San Diego delivers year-round surf with 70+ miles of coastline. From La Jolla reefs to Imperial Beach sandbars, find your perfect wave.",
    states: ["ca"],
    centerLat: 32.85,
    centerLng: -117.25,
    zoom: 10,
  },
  "orange-county": {
    slug: "orange-county",
    name: "Orange County",
    title: "Complete Guide to Surfing Orange County",
    description: "Home to Trestles, Huntington Beach, and The Wedge. Orange County is the heart of California surf culture.",
    states: ["ca"],
    centerLat: 33.6,
    centerLng: -117.9,
    zoom: 10,
  },
  hawaii: {
    slug: "hawaii",
    name: "Hawaii",
    title: "Complete Guide to Surfing Hawaii",
    description: "The birthplace of surfing. From North Shore's legendary winter swells to Waikiki's perfect learning waves.",
    states: ["hi"],
    centerLat: 21.3,
    centerLng: -157.8,
    zoom: 7,
  },
};

export const HUB_REGION_SLUGS = Object.keys(HUB_REGIONS);

export function getHubRegion(slug: string): HubRegion | null {
  return HUB_REGIONS[slug] || null;
}
```

**Step 2: Create hub map component**

```typescript
// components/hub/hub-map-view.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { BeachWithMetrics } from "@/types/location";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

interface HubMapViewProps {
  beaches: BeachWithMetrics[];
  centerLat: number;
  centerLng: number;
  zoom: number;
  ariaLabel: string;
}

const SKILL_COLORS: Record<string, string> = {
  beginner: "#22c55e", // green
  intermediate: "#3b82f6", // blue
  advanced: "#1e293b", // dark
};

function getSkillColor(skillLevel: string | null): string {
  if (!skillLevel) return SKILL_COLORS.intermediate;
  const normalized = skillLevel.toLowerCase();
  if (normalized.includes("beginner") || normalized.includes("longboard")) {
    return SKILL_COLORS.beginner;
  }
  if (normalized.includes("advanced") || normalized.includes("expert")) {
    return SKILL_COLORS.advanced;
  }
  return SKILL_COLORS.intermediate;
}

export function HubMapView({
  beaches,
  centerLat,
  centerLng,
  zoom,
  ariaLabel,
}: HubMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [centerLng, centerLat],
      zoom,
    });

    // Add markers for each beach
    beaches.forEach((beach) => {
      if (!beach.lat || !beach.lon) return;

      const el = document.createElement("div");
      el.className = "hub-map-marker";
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${getSkillColor(beach.skill_level)};
        border: 2px solid white;
        cursor: pointer;
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <a href="${buildBeachUrl(beach)}" class="font-medium text-ocean-blue hover:underline">
          ${beach.name}
        </a>
        <p class="text-sm text-gray-600">${beach.city}, ${beach.state}</p>
      `);

      new mapboxgl.Marker(el)
        .setLngLat([beach.lon, beach.lat])
        .setPopup(popup)
        .addTo(map.current!);
    });

    return () => map.current?.remove();
  }, [beaches, centerLat, centerLng, zoom]);

  return (
    <div className="relative">
      <div
        ref={mapContainer}
        className="w-full h-[400px] rounded-xl"
        aria-label={ariaLabel}
      />
      <div className="absolute bottom-4 left-4 bg-white rounded-lg p-3 shadow-md">
        <p className="text-xs font-medium text-gray-700 mb-2">Skill Level</p>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs">Beginner</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs">Intermediate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-slate-800" />
            <span className="text-xs">Advanced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create hub page route**

```typescript
// app/guides/surfing-[region]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { getHubRegion, HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getBeachesByIntentAndState } from "@/actions/beach/beach-query-actions";
import { HubMapView } from "@/components/hub/hub-map-view";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQStructuredData } from "@/components/seo/faq-structured-data";

export function generateStaticParams() {
  return HUB_REGION_SLUGS.map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: { region: string };
}): Promise<Metadata> {
  const hub = getHubRegion(params.region);
  if (!hub) return {};

  return buildPageMetadata({
    title: hub.title,
    description: hub.description,
    path: `/guides/surfing-${hub.slug}`,
  });
}

export default async function HubPage({
  params,
}: {
  params: { region: string };
}) {
  const hub = getHubRegion(params.region);
  if (!hub) return notFound();

  // Fetch all beaches for the region's states
  const beachPromises = hub.states.map((state) =>
    getBeachesByIntentAndState("tide", state) // "tide" returns all beaches
  );
  const results = await Promise.all(beachPromises);
  const beaches = results.flatMap((r) => (r.success ? r.data || [] : []));

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Group beaches by skill level for stats
  const beginnerCount = beaches.filter((b) =>
    (b.skill_level || "").toLowerCase().includes("beginner")
  ).length;
  const advancedCount = beaches.filter((b) =>
    (b.skill_level || "").toLowerCase().includes("advanced")
  ).length;

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Guides", url: `${baseUrl}/guides` },
          { name: hub.name, url: `${baseUrl}/guides/surfing-${hub.slug}` },
        ]}
      />
      <FAQStructuredData
        items={[
          {
            question: `How many surf spots are in ${hub.name}?`,
            answer: `${hub.name} has ${beaches.length}+ documented surf spots, including ${beginnerCount} beginner-friendly and ${advancedCount} advanced breaks.`,
          },
          {
            question: `What's the best time to surf ${hub.name}?`,
            answer: `${hub.name} offers year-round surfing. Fall and winter bring larger swells, while summer provides smaller, cleaner waves perfect for beginners.`,
          },
        ]}
      />

      <div className="container mx-auto px-4 py-10 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {hub.title}
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-3xl">
            {hub.description}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {beaches.length} spots documented · Updated daily
          </p>
        </header>

        {/* Interactive Map */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Explore the Map
          </h2>
          <HubMapView
            beaches={beaches}
            centerLat={hub.centerLat}
            centerLng={hub.centerLng}
            zoom={hub.zoom}
            ariaLabel={`Map of surf spots in ${hub.name}`}
          />
        </section>

        {/* Spots by Skill Level */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Spots by Skill Level
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href={`/beginner/${hub.states[0]}`}
              className="rounded-xl border border-green-200 bg-green-50 p-6 hover:bg-green-100 transition"
            >
              <h3 className="font-semibold text-green-800">Beginner</h3>
              <p className="text-3xl font-bold text-green-600">{beginnerCount}</p>
              <p className="text-sm text-green-700">spots</p>
            </Link>
            <Link
              href={`/tide/${hub.states[0]}`}
              className="rounded-xl border border-blue-200 bg-blue-50 p-6 hover:bg-blue-100 transition"
            >
              <h3 className="font-semibold text-blue-800">Intermediate</h3>
              <p className="text-3xl font-bold text-blue-600">
                {beaches.length - beginnerCount - advancedCount}
              </p>
              <p className="text-sm text-blue-700">spots</p>
            </Link>
            <Link
              href={`/tide/${hub.states[0]}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-6 hover:bg-slate-100 transition"
            >
              <h3 className="font-semibold text-slate-800">Advanced</h3>
              <p className="text-3xl font-bold text-slate-600">{advancedCount}</p>
              <p className="text-sm text-slate-700">spots</p>
            </Link>
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Quick Links
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href={`/beginner/${hub.states[0]}`}
              className="rounded-lg border p-4 hover:bg-gray-50"
            >
              Beginner Spots →
            </Link>
            <Link
              href={`/least-crowded/${hub.states[0]}`}
              className="rounded-lg border p-4 hover:bg-gray-50"
            >
              Less Crowded →
            </Link>
            <Link
              href={`/tide/${hub.states[0]}`}
              className="rounded-lg border p-4 hover:bg-gray-50"
            >
              Tide Guide →
            </Link>
            <Link
              href={`/water-temp/${hub.states[0]}`}
              className="rounded-lg border p-4 hover:bg-gray-50"
            >
              Water Temps →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
```

**Step 4: Add hub pages to sitemap**

```typescript
// In app/sitemap.ts
import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";

const hubRoutes: MetadataRoute.Sitemap = HUB_REGION_SLUGS.map((region) => ({
  url: `${baseUrl}/guides/surfing-${region}`,
  lastModified: lastmod,
  changeFrequency: "weekly",
  priority: 0.9,
}));
```

**Step 5: Test and commit**

```bash
yarn dev
# Visit http://localhost:3000/guides/surfing-southern-california
git add -A && git commit -m "feat(hub-pages): create regional hub pages with interactive maps"
```

---

## Phase 4: New Intents (Future)

### Task 10: Add New Intent Definitions

**Files:**
- Modify: `lib/data/surf-spots.ts`

Add to `SurfIntentSlug` type and `SURF_INTENTS` object:

```typescript
export type SurfIntentSlug =
  | "beginner"
  | "least-crowded"
  | "tide"
  | "water-temp"
  | "longboard"      // NEW
  | "dawn-patrol"    // NEW
  | "sunset";        // NEW

// Add definitions for new intents
longboard: {
  slug: "longboard",
  label: "Longboard Friendly",
  titleTemplate: ({ cityName }) =>
    `${cityName} Longboard Surf Spots & Mellow Waves`,
  heading: ({ cityName }) =>
    `Best longboard waves in ${cityName}`,
  metaDescription: ({ cityName, topSpots }) =>
    `Find the best longboard-friendly waves in ${cityName}. Mellow point breaks and rolling beach breaks at ${topSpots.slice(0, 3).join(", ")}.`,
  intro: ({ cityName }) =>
    `${cityName} offers plenty of mellow, longboard-friendly waves. These spots feature gentle shoulders, long rides, and a classic surfing vibe.`,
  focusPoints: [
    "Long, peeling waves perfect for noseriding",
    "Mellow takeoff zones with forgiving shoulders",
    "Classic surf spots with old-school vibes",
    "Best tide windows for logging sessions",
  ],
},
```

---

## Verification Checklist

After completing each phase, verify:

- [ ] `yarn build` succeeds
- [ ] `yarn test:unit` passes (excluding pre-existing failures)
- [ ] Sitemap generates correctly (`curl localhost:3000/sitemap.xml`)
- [ ] New pages render correctly
- [ ] Structured data validates (Google Rich Results Test)
- [ ] robots.txt is accessible

---

## File Summary

### Created Files
- `public/robots.txt`
- `actions/beach/beach-location-actions.ts`
- `components/seo/faq-structured-data.tsx`
- `components/hub/hub-map-view.tsx`
- `lib/data/hub-regions.ts`
- `app/guides/surfing-[region]/page.tsx`

### Modified Files
- `actions/beach/beach-query-actions.ts`
- `app/[intent]/[city]/page.tsx`
- `app/sitemap.ts`
- `lib/data/surf-spots.ts`

### Test Files
- `__tests__/actions/beach/beach-query-actions.test.ts`
