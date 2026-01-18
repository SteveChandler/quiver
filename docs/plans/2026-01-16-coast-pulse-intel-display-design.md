# Coast Pulse Intel Display Improvements Design

**Date:** 2026-01-16
**Status:** Approved

## Overview

Improve how user intel posts are displayed in the Live Coast Pulse feed by showing richer, more actionable data: beach name, emoji rating prominently, and structured surf conditions.

## Problem

Current intel items show minimal information:
```
USER    Test User
        Valid description
        30 hr ago · 7 mi away
```

This doesn't tell users:
- Which beach the report is for
- What conditions the reporter experienced (emoji rating)
- Structured data like wave height, wind, crowd level

## Solution

Enhanced intel display format:
```
USER    Test User @ La Jolla Shores
        🔥 · 4ft · 8kt NW · light
        30 hr ago · 7 mi away
```

## Decisions Made

| Decision | Choice |
|----------|--------|
| Source name format | `"{username} @ {beach_name}"` |
| Beach name source | Join via `beach_id`, fallback to nearest beach from lat/lon |
| Message format | Emoji first, then structured conditions, fallback to description |
| Emoji display | Unicode emoji in message (🔥 🤙 😐 👎) |
| Crowd level text | 1=empty, 2=light, 3=moderate, 4=busy, 5=packed |
| Name truncation | Max ~35 chars, truncate beach name with ellipsis |

## Implementation

### 1. Modify `fetchRecentIntel()` in `app/api/coast-pulse/route.ts`

**Update Supabase query to include beach join and surf_conditions:**

```typescript
const { data: posts } = await supabase
  .from("intel_posts")
  .select(`
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
    profiles:user_id (full_name),
    beaches:beach_id (name)
  `)
  .eq("is_active", true)
  .gte("created_at", twentyFourHoursAgo)
  .order("created_at", { ascending: false })
  .limit(10);
```

**Pass beaches cache to function:**

Change function signature to accept beaches list:
```typescript
async function fetchRecentIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache?: Array<{ id: string; name: string; lat: number; lon: number }>
): Promise<CoastPulseItem[]>
```

### 2. Add `formatIntelMessage()` helper function

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
    fire: '🔥',
    shaka: '🤙',
    meh: '😐',
    thumbsdown: '👎'
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
    const dir = conditions.wind_direction || '';
    parts.push(`${conditions.wind_speed}kt ${dir}`.trim());
  }

  // 4. Crowd level (1-5 scale → text)
  if (conditions?.crowd_level != null) {
    const crowdText = ['empty', 'light', 'moderate', 'busy', 'packed'];
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

  return parts.join(' · ');
}
```

### 3. Add `formatIntelSourceName()` helper function

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

### 4. Add `findNearestBeachName()` helper function

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

### 5. Update intel item mapping in `fetchRecentIntel()`

```typescript
return nearbyPosts.slice(0, 5).map((post: any) => {
  const surferName = post.profiles?.full_name || "Local Surfer";

  // Get beach name from join or nearest lookup
  const beachName = post.beaches?.name
    || findNearestBeachName(post.latitude, post.longitude, beachesCache || []);

  return {
    id: `intel-${post.id}`,
    source: {
      name: formatIntelSourceName(surferName, beachName),
      type: "intel" as const,
      credibility: 50 + Math.min(post.confirmations_count || 0, 20) * 2,
    },
    message: formatIntelMessage({
      emoji_rating: post.emoji_rating,
      surf_conditions: post.surf_conditions,
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

### 6. Update `fetchCoastPulseData()` to share beaches cache

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

  const beachesCache = beaches || [];

  // Fetch from all sources in parallel
  const [localBuoysResult, forecastResult, dailyIntelResult, intelResult, ndbcResult, cdipResult, tideResult] =
    await Promise.allSettled([
      fetchLocalBuoys(supabase, lat, lon),
      fetchEnhancedForecast(supabase, lat, lon, beachesCache),
      fetchDailyIntel(supabase, lat, lon, beachesCache),
      fetchRecentIntel(supabase, lat, lon, beachesCache),  // Pass cache
      fetchLiveNDBCData(lat, lon),
      fetchLiveCDIPData(lat, lon),
      fetchTideData(lat, lon),
    ]);

  // ... rest unchanged
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/coast-pulse/route.ts` | Add helper functions, update query, share beaches cache |

## Example Outputs

**Full structured data:**
```
USER    Steve @ La Jolla Shores
        🔥 · 4ft · 8kt NW · light
        15 min ago · 0.3 mi away
```

**Partial data (no wind/crowd):**
```
USER    Local Surfer @ Pacific Beach
        🤙 · 3ft
        1 hr ago · 2 mi away
```

**No structured data, has description:**
```
USER    Mike @ Blacks Beach
        🔥 Glassy and firing, best session in weeks!
        45 min ago · 5 mi away
```

**No emoji, just description:**
```
USER    Sarah @ Scripps Pier
        Choppy but fun, getting better
        2 hr ago · 1 mi away
```

**No beach_id, nearest beach found:**
```
USER    Anonymous @ Ocean Beach
        😐 · 2ft · 12kt SW · busy
        3 hr ago · 4 mi away
```

## Testing Requirements

- Unit tests for `formatIntelMessage()` with various input combinations
- Unit tests for `formatIntelSourceName()` truncation logic
- Unit tests for `findNearestBeachName()` distance calculation
- Integration test: intel post with full surf_conditions displays correctly
- Integration test: intel post with only emoji_rating displays correctly
- Integration test: intel post with beach_id shows beach name
- Integration test: intel post without beach_id finds nearest beach

## Migration Checklist

1. [ ] Add helper functions to coast-pulse route
2. [ ] Update Supabase query to include beaches join and surf_conditions
3. [ ] Update function signatures to accept beaches cache
4. [ ] Update intel item mapping to use new formatters
5. [ ] Add unit tests for new helper functions
6. [ ] Manual test with real intel posts
7. [ ] Verify no performance regression (beaches query is shared)
