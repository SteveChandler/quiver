# Coast Pulse Intel Display Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve how user intel posts display in Live Coast Pulse by showing beach name, emoji rating prominently, and structured surf conditions.

**Architecture:** Add three helper functions to format intel messages and source names, update Supabase query to fetch beach joins and surf_conditions, share beaches cache across fetch functions to avoid duplicate queries.

**Tech Stack:** TypeScript, Supabase, Next.js API Routes

---

## Task 1: Add formatIntelMessage() Helper

**Files:**
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/app/api/coast-pulse/route.ts`
- Test: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/__tests__/api/coast-pulse-helpers.test.ts` (create)

**Step 1: Create test file with failing tests**

Create `__tests__/api/coast-pulse-helpers.test.ts`:

```typescript
/**
 * Tests for coast-pulse helper functions
 */

// We'll test the helpers by importing them once exported
// For now, define the expected behavior

describe("formatIntelMessage", () => {
  // Mock the function signature for testing
  const formatIntelMessage = (post: {
    emoji_rating?: string | null;
    surf_conditions?: {
      wave_height?: number;
      wind_speed?: number;
      wind_direction?: string;
      crowd_level?: number;
    } | null;
    description?: string;
  }): string => {
    // Will be imported from route.ts after implementation
    throw new Error("Not implemented");
  };

  it("formats full structured data with emoji", () => {
    const result = formatIntelMessage({
      emoji_rating: "fire",
      surf_conditions: {
        wave_height: 4,
        wind_speed: 8,
        wind_direction: "NW",
        crowd_level: 2,
      },
      description: "Great session",
    });
    expect(result).toBe("🔥 · 4ft · 8kt NW · light");
  });

  it("formats partial data (no wind/crowd)", () => {
    const result = formatIntelMessage({
      emoji_rating: "shaka",
      surf_conditions: { wave_height: 3 },
      description: "Fun waves",
    });
    expect(result).toBe("🤙 · 3ft");
  });

  it("falls back to description when no structured data", () => {
    const result = formatIntelMessage({
      emoji_rating: "fire",
      surf_conditions: null,
      description: "Glassy and firing!",
    });
    expect(result).toBe("🔥 Glassy and firing!");
  });

  it("returns just description when no emoji", () => {
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: "Choppy but fun",
    });
    expect(result).toBe("Choppy but fun");
  });

  it("handles all emoji types", () => {
    expect(formatIntelMessage({ emoji_rating: "fire", description: "x" })).toContain("🔥");
    expect(formatIntelMessage({ emoji_rating: "shaka", description: "x" })).toContain("🤙");
    expect(formatIntelMessage({ emoji_rating: "meh", description: "x" })).toContain("😐");
    expect(formatIntelMessage({ emoji_rating: "thumbsdown", description: "x" })).toContain("👎");
  });

  it("handles all crowd levels", () => {
    const levels = [
      { level: 1, text: "empty" },
      { level: 2, text: "light" },
      { level: 3, text: "moderate" },
      { level: 4, text: "busy" },
      { level: 5, text: "packed" },
    ];
    for (const { level, text } of levels) {
      const result = formatIntelMessage({
        surf_conditions: { crowd_level: level },
        description: "x",
      });
      expect(result).toContain(text);
    }
  });

  it("truncates long descriptions", () => {
    const longDesc = "A".repeat(100);
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: longDesc,
    });
    expect(result.length).toBeLessThanOrEqual(80);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: FAIL with "Not implemented"

**Step 3: Implement formatIntelMessage in route.ts**

Add after the existing `truncateText` function (around line 1057):

```typescript
/**
 * Format intel post into a readable message with emoji and conditions
 */
function formatIntelMessage(post: {
  emoji_rating?: string | null;
  surf_conditions?: {
    wave_height?: number;
    wind_speed?: number;
    wind_direction?: string;
    crowd_level?: number;
  } | null;
  description?: string;
}): string {
  const parts: string[] = [];

  // 1. Emoji first (if present)
  const emojiMap: Record<string, string> = {
    fire: "🔥",
    shaka: "🤙",
    meh: "😐",
    thumbsdown: "👎",
  };
  const emoji = post.emoji_rating ? emojiMap[post.emoji_rating] : null;
  if (emoji) {
    parts.push(emoji);
  }

  const conditions = post.surf_conditions;

  // 2. Wave height from surf_conditions
  if (conditions?.wave_height != null) {
    parts.push(`${conditions.wave_height}ft`);
  }

  // 3. Wind conditions
  if (conditions?.wind_speed != null) {
    const dir = conditions.wind_direction || "";
    parts.push(`${conditions.wind_speed}kt ${dir}`.trim());
  }

  // 4. Crowd level (1-5 scale → text)
  if (conditions?.crowd_level != null) {
    const crowdText = ["empty", "light", "moderate", "busy", "packed"];
    const crowdLabel = crowdText[conditions.crowd_level - 1];
    if (crowdLabel) {
      parts.push(crowdLabel);
    }
  }

  // 5. Fall back to description if no structured data
  if (parts.length <= 1 && post.description) {
    const desc = truncateText(post.description, 80);
    return emoji ? `${emoji} ${desc}` : desc;
  }

  return parts.join(" · ");
}
```

**Step 4: Export helper for testing**

Add at the bottom of the file, before the final export:

```typescript
// Export helpers for testing
export { formatIntelMessage };
```

**Step 5: Update test to import the real function**

Update `__tests__/api/coast-pulse-helpers.test.ts`:

```typescript
/**
 * Tests for coast-pulse helper functions
 */
import { formatIntelMessage } from "@/app/api/coast-pulse/route";

describe("formatIntelMessage", () => {
  it("formats full structured data with emoji", () => {
    const result = formatIntelMessage({
      emoji_rating: "fire",
      surf_conditions: {
        wave_height: 4,
        wind_speed: 8,
        wind_direction: "NW",
        crowd_level: 2,
      },
      description: "Great session",
    });
    expect(result).toBe("🔥 · 4ft · 8kt NW · light");
  });

  it("formats partial data (no wind/crowd)", () => {
    const result = formatIntelMessage({
      emoji_rating: "shaka",
      surf_conditions: { wave_height: 3 },
      description: "Fun waves",
    });
    expect(result).toBe("🤙 · 3ft");
  });

  it("falls back to description when no structured data", () => {
    const result = formatIntelMessage({
      emoji_rating: "fire",
      surf_conditions: null,
      description: "Glassy and firing!",
    });
    expect(result).toBe("🔥 Glassy and firing!");
  });

  it("returns just description when no emoji", () => {
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: "Choppy but fun",
    });
    expect(result).toBe("Choppy but fun");
  });

  it("handles all emoji types", () => {
    expect(formatIntelMessage({ emoji_rating: "fire", description: "x" })).toContain("🔥");
    expect(formatIntelMessage({ emoji_rating: "shaka", description: "x" })).toContain("🤙");
    expect(formatIntelMessage({ emoji_rating: "meh", description: "x" })).toContain("😐");
    expect(formatIntelMessage({ emoji_rating: "thumbsdown", description: "x" })).toContain("👎");
  });

  it("handles all crowd levels", () => {
    const levels = [
      { level: 1, text: "empty" },
      { level: 2, text: "light" },
      { level: 3, text: "moderate" },
      { level: 4, text: "busy" },
      { level: 5, text: "packed" },
    ];
    for (const { level, text } of levels) {
      const result = formatIntelMessage({
        surf_conditions: { crowd_level: level },
        description: "x",
      });
      expect(result).toContain(text);
    }
  });

  it("truncates long descriptions", () => {
    const longDesc = "A".repeat(100);
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: longDesc,
    });
    expect(result.length).toBeLessThanOrEqual(80);
  });
});
```

**Step 6: Run tests to verify they pass**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: PASS (all 7 tests)

**Step 7: Commit**

```bash
git add __tests__/api/coast-pulse-helpers.test.ts app/api/coast-pulse/route.ts
git commit -m "feat(coast-pulse): add formatIntelMessage helper with tests"
```

---

## Task 2: Add formatIntelSourceName() Helper

**Files:**
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/app/api/coast-pulse/route.ts`
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/__tests__/api/coast-pulse-helpers.test.ts`

**Step 1: Add failing tests**

Add to `__tests__/api/coast-pulse-helpers.test.ts`:

```typescript
import { formatIntelMessage, formatIntelSourceName } from "@/app/api/coast-pulse/route";

// ... existing tests ...

describe("formatIntelSourceName", () => {
  it("formats username with beach name", () => {
    const result = formatIntelSourceName("Steve", "La Jolla Shores");
    expect(result).toBe("Steve @ La Jolla Shores");
  });

  it("returns just username when no beach", () => {
    const result = formatIntelSourceName("Local Surfer", null);
    expect(result).toBe("Local Surfer");
  });

  it("truncates long beach names", () => {
    const result = formatIntelSourceName("Steve", "San Diego - Mission Beach Pier North");
    expect(result.length).toBeLessThanOrEqual(35);
    expect(result).toContain("Steve @");
    expect(result).toContain("...");
  });

  it("truncates username when no beach and too long", () => {
    const result = formatIntelSourceName("VeryLongUsernameHere123456", null, 20);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("handles edge case of very short max length", () => {
    const result = formatIntelSourceName("Steve", "Beach", 10);
    // Should handle gracefully without crashing
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: FAIL with import error (formatIntelSourceName not exported)

**Step 3: Implement formatIntelSourceName in route.ts**

Add after `formatIntelMessage`:

```typescript
/**
 * Format intel source name with username and beach
 */
function formatIntelSourceName(
  username: string,
  beachName: string | null,
  maxLength: number = 35
): string {
  if (!beachName) {
    return truncateText(username, maxLength);
  }

  const full = `${username} @ ${beachName}`;
  if (full.length <= maxLength) {
    return full;
  }

  // Truncate beach name to fit
  const prefix = `${username} @ `;
  const availableForBeach = maxLength - prefix.length - 3; // 3 for "..."
  if (availableForBeach > 5) {
    return `${prefix}${beachName.slice(0, availableForBeach)}...`;
  }

  // Beach name too short to be useful, just show username
  return truncateText(username, maxLength);
}
```

**Step 4: Update export**

```typescript
// Export helpers for testing
export { formatIntelMessage, formatIntelSourceName };
```

**Step 5: Run tests to verify they pass**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: PASS (all 12 tests)

**Step 6: Commit**

```bash
git add __tests__/api/coast-pulse-helpers.test.ts app/api/coast-pulse/route.ts
git commit -m "feat(coast-pulse): add formatIntelSourceName helper with tests"
```

---

## Task 3: Add findNearestBeachName() Helper

**Files:**
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/app/api/coast-pulse/route.ts`
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/__tests__/api/coast-pulse-helpers.test.ts`

**Step 1: Add failing tests**

Add to `__tests__/api/coast-pulse-helpers.test.ts`:

```typescript
import { formatIntelMessage, formatIntelSourceName, findNearestBeachName } from "@/app/api/coast-pulse/route";

// ... existing tests ...

describe("findNearestBeachName", () => {
  const beaches = [
    { name: "La Jolla Shores", lat: 32.8567, lon: -117.2575 },
    { name: "Pacific Beach", lat: 32.7946, lon: -117.2557 },
    { name: "Ocean Beach", lat: 32.7497, lon: -117.2507 },
  ];

  it("finds nearest beach within distance", () => {
    // Point very close to La Jolla Shores
    const result = findNearestBeachName(32.857, -117.258, beaches);
    expect(result).toBe("La Jolla Shores");
  });

  it("returns null when no beaches within max distance", () => {
    // Point far from all beaches (Los Angeles)
    const result = findNearestBeachName(34.0522, -118.2437, beaches);
    expect(result).toBeNull();
  });

  it("returns null for empty beaches array", () => {
    const result = findNearestBeachName(32.857, -117.258, []);
    expect(result).toBeNull();
  });

  it("respects custom max distance", () => {
    // Point ~7km from La Jolla Shores, use 5km max
    const result = findNearestBeachName(32.79, -117.26, beaches, 5);
    // Should find Pacific Beach (closer) but not La Jolla
    expect(result).toBe("Pacific Beach");
  });

  it("returns closest beach when multiple within range", () => {
    // Point between Pacific Beach and Ocean Beach
    const result = findNearestBeachName(32.77, -117.253, beaches);
    expect(result).toBe("Ocean Beach"); // Closest
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: FAIL with import error

**Step 3: Implement findNearestBeachName in route.ts**

Add after `formatIntelSourceName`:

```typescript
/**
 * Find nearest beach name from coordinates using cached beach list
 */
function findNearestBeachName(
  lat: number,
  lon: number,
  beaches: Array<{ name: string; lat: number; lon: number }>,
  maxDistanceKm: number = 5
): string | null {
  if (!beaches?.length) return null;

  let nearest: { name: string; distance: number } | null = null;

  for (const beach of beaches) {
    const dist = haversineDistance(lat, lon, beach.lat, beach.lon);
    if (dist <= maxDistanceKm && (!nearest || dist < nearest.distance)) {
      nearest = { name: beach.name, distance: dist };
    }
  }

  return nearest?.name || null;
}
```

**Step 4: Update export**

```typescript
// Export helpers for testing
export { formatIntelMessage, formatIntelSourceName, findNearestBeachName };
```

**Step 5: Run tests to verify they pass**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: PASS (all 17 tests)

**Step 6: Commit**

```bash
git add __tests__/api/coast-pulse-helpers.test.ts app/api/coast-pulse/route.ts
git commit -m "feat(coast-pulse): add findNearestBeachName helper with tests"
```

---

## Task 4: Update fetchRecentIntel Query

**Files:**
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/app/api/coast-pulse/route.ts`

**Step 1: Update function signature**

Change `fetchRecentIntel` signature to accept beaches cache (around line 527):

```typescript
/**
 * Fetch recent user intel posts
 */
async function fetchRecentIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Array<{ id: string; name: string; lat: number; lon: number }> = []
): Promise<CoastPulseItem[]> {
```

**Step 2: Update Supabase query**

Replace the existing query (around line 536) with:

```typescript
    const { data: posts } = await supabase
      .from("intel_posts")
      .select(
        `
        id,
        title,
        description,
        emoji_rating,
        created_at,
        photo_url,
        latitude,
        longitude,
        confirmations_count,
        surf_conditions,
        profiles:user_id (
          full_name
        ),
        beaches:beach_id (
          name
        )
      `
      )
      .eq("is_active", true)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(10);
```

**Step 3: Update item mapping**

Replace the mapping logic (around line 568) with:

```typescript
    return nearbyPosts.slice(0, 5).map((post: any) => {
      const surferName = post.profiles?.full_name || "Local Surfer";

      // Get beach name from join or nearest lookup
      const beachName =
        post.beaches?.name ||
        findNearestBeachName(post.latitude, post.longitude, beachesCache);

      return {
        id: `intel-${post.id}`,
        source: {
          name: formatIntelSourceName(surferName, beachName),
          type: "intel" as const,
          credibility: 50 + Math.min(post.confirmations_count || 0, 20) * 2,
        },
        message: formatIntelMessage({
          emoji_rating: post.emoji_rating,
          surf_conditions: post.surf_conditions as any,
          description: post.description || post.title,
        }),
        timestamp: new Date(post.created_at),
        location: {
          lat: post.latitude,
          lon: post.longitude,
          distanceKm: haversineDistance(lat, lon, post.latitude, post.longitude),
        },
        photoUrl: post.photo_url || undefined,
        emoji_rating: post.emoji_rating || undefined,
      };
    });
```

**Step 4: Run typecheck**

Run: `yarn typecheck`

Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add app/api/coast-pulse/route.ts
git commit -m "feat(coast-pulse): update fetchRecentIntel with beach join and helpers"
```

---

## Task 5: Share Beaches Cache Across Functions

**Files:**
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/app/api/coast-pulse/route.ts`

**Step 1: Update fetchCoastPulseData to fetch beaches first**

Modify `fetchCoastPulseData` (around line 78) to fetch beaches before parallel calls:

```typescript
async function fetchCoastPulseData(
  lat: number,
  lon: number,
  limit: number
): Promise<CoastPulseResponse> {
  const supabase = await createSupabaseServerClient();
  const items: CoastPulseItem[] = [];

  // Fetch beaches first for shared cache
  const { data: beaches } = await supabase
    .from("beaches")
    .select("id, name, lat, lon")
    .not("lat", "is", null)
    .limit(100);

  const beachesCache = (beaches || []).map((b) => ({
    id: b.id,
    name: b.name,
    lat: b.lat,
    lon: b.lon,
  }));

  // Fetch from all sources in parallel (including live external sources)
  const [localBuoysResult, forecastResult, dailyIntelResult, intelResult, ndbcResult, cdipResult, tideResult] =
    await Promise.allSettled([
      fetchLocalBuoys(supabase, lat, lon),
      fetchEnhancedForecast(supabase, lat, lon, beachesCache),
      fetchDailyIntel(supabase, lat, lon, beachesCache),
      fetchRecentIntel(supabase, lat, lon, beachesCache),
      fetchLiveNDBCData(lat, lon),
      fetchLiveCDIPData(lat, lon),
      fetchTideData(lat, lon),
    ]);
```

**Step 2: Update fetchEnhancedForecast signature**

Update function signature (around line 346):

```typescript
async function fetchEnhancedForecast(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Array<{ id: string; name: string; lat: number; lon: number }> = []
): Promise<CoastPulseItem[]> {
```

Replace the beaches query inside with using the cache:

```typescript
  try {
    // Use provided cache or empty array
    const beaches = beachesCache.length > 0 ? beachesCache : [];

    if (!beaches.length) return [];
```

**Step 3: Update fetchDailyIntel signature**

Update function signature (around line 439):

```typescript
async function fetchDailyIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Array<{ id: string; name: string; lat: number; lon: number }> = []
): Promise<CoastPulseItem | null> {
```

Replace the beaches query inside with using the cache:

```typescript
  try {
    // Use provided cache or empty array
    const beaches = beachesCache.length > 0 ? beachesCache : [];

    if (!beaches.length) return null;
```

**Step 4: Run typecheck**

Run: `yarn typecheck`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/coast-pulse/route.ts
git commit -m "refactor(coast-pulse): share beaches cache across fetch functions"
```

---

## Task 6: Integration Test

**Files:**
- Modify: `/Users/stevenchandler/Desktop/quiver/.worktrees/coast-pulse-intel-display/__tests__/api/coast-pulse-helpers.test.ts`

**Step 1: Add integration test**

Add at the end of the test file:

```typescript
describe("Coast Pulse Intel Integration", () => {
  it("formats a complete intel item correctly", () => {
    // Simulate full flow
    const mockPost = {
      emoji_rating: "fire",
      surf_conditions: {
        wave_height: 4,
        wind_speed: 8,
        wind_direction: "NW",
        crowd_level: 2,
      },
      description: "Epic morning session",
    };

    const message = formatIntelMessage(mockPost);
    expect(message).toBe("🔥 · 4ft · 8kt NW · light");

    const sourceName = formatIntelSourceName("Steve", "La Jolla Shores");
    expect(sourceName).toBe("Steve @ La Jolla Shores");
  });

  it("handles minimal intel post gracefully", () => {
    const mockPost = {
      emoji_rating: null,
      surf_conditions: null,
      description: "Just checked it out",
    };

    const message = formatIntelMessage(mockPost);
    expect(message).toBe("Just checked it out");

    const sourceName = formatIntelSourceName("Anonymous", null);
    expect(sourceName).toBe("Anonymous");
  });
});
```

**Step 2: Run all helper tests**

Run: `yarn test:unit __tests__/api/coast-pulse-helpers.test.ts`

Expected: PASS (all 19 tests)

**Step 3: Run full unit test suite**

Run: `yarn test:unit --testPathPattern="coast-pulse" --passWithNoTests`

Expected: PASS (no new failures)

**Step 4: Commit**

```bash
git add __tests__/api/coast-pulse-helpers.test.ts
git commit -m "test(coast-pulse): add integration tests for intel formatting"
```

---

## Task 7: Manual Verification

**Step 1: Start dev server**

Run: `yarn dev`

**Step 2: Test with real data**

Navigate to home screen and verify Coast Pulse shows improved intel formatting:
- Intel items show `"{username} @ {beach}"` format
- Emoji ratings appear at start of message
- Structured conditions display when available
- Falls back to description text gracefully

**Step 3: Test edge cases**

- Intel post with no beach_id (should find nearest)
- Intel post with no surf_conditions (should show description)
- Intel post with only emoji (should show emoji + description)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(coast-pulse): complete intel display improvements" --allow-empty
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | formatIntelMessage helper | 7 tests |
| 2 | formatIntelSourceName helper | 5 tests |
| 3 | findNearestBeachName helper | 5 tests |
| 4 | Update fetchRecentIntel query | typecheck |
| 5 | Share beaches cache | typecheck |
| 6 | Integration tests | 2 tests |
| 7 | Manual verification | visual |

**Total: 6 commits, 19 unit tests**
