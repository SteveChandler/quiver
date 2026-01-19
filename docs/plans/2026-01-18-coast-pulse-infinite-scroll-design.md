# Coast Pulse Infinite Scroll Design

**Date:** 2026-01-18
**Status:** Approved

## Overview

Add infinite scroll to the Coast Pulse timeline, allowing users to scroll back through historical intel posts indefinitely. Real-time data (buoys, tide, forecast) appears at the top and naturally ages out as users scroll deeper into history.

## Requirements

- Infinite scroll on CoastPulse timeline
- Everything ages together - real-time data at top, older intel below
- Unlimited scroll depth (as far back as data exists)
- 8 items per page
- Modern, seamless UX (no "Load More" buttons)

## API Changes

### Endpoint: `GET /api/coast-pulse`

**New query parameter:**
- `before` (optional): ISO timestamp cursor for pagination

**Updated response shape:**
```typescript
{
  success: true,
  data: {
    items: CoastPulseItem[],
    summary: CoastPulseSummary,  // Only meaningful on first page
    hasMore: boolean,
    nextCursor: string | null   // ISO timestamp of oldest item
  }
}
```

### Pagination Logic

**First page (no `before` cursor):**
- Fetch real-time sources: buoys, CDIP, NDBC, tide, forecast
- Fetch recent intel posts (last 24 hours)
- Return mixed feed sorted by timestamp
- Set `nextCursor` to oldest item's timestamp

**Subsequent pages (with `before` cursor):**
- Skip all real-time sources (they only exist for "now")
- Fetch only intel posts older than the cursor timestamp
- Return `hasMore: false` when no more posts exist

### Updated `fetchRecentIntel` Function

```typescript
async function fetchRecentIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Beach[],
  options?: {
    before?: string;  // ISO timestamp cursor
    limit?: number;
  }
): Promise<CoastPulseItem[]>
```

**Query behavior:**
- First page: `created_at >= 24 hours ago`, newest first
- Subsequent pages: `created_at < cursor`, no floor, newest first
- Geo-filter: Only posts within 50km of user location

## Component Changes

### New State

```typescript
const [items, setItems] = useState<CoastPulseItem[]>([]);
const [summary, setSummary] = useState<CoastPulseSummary | null>(null);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [nextCursor, setNextCursor] = useState<string | null>(null);
```

### Data Flow

1. **Initial load** - Fetch first page, set items + summary + cursor
2. **Scroll trigger** - Intersection Observer detects near-bottom, fetch next page
3. **Append items** - New items appended to existing list
4. **Stop condition** - When `hasMore: false`, remove scroll trigger

### Infinite Scroll Implementation

- Intersection Observer on invisible sentinel element at list bottom
- Threshold: 200px before bottom (preload)
- Debounce: 300ms to prevent duplicate requests
- Cancel in-flight requests if location changes

### Loading States

**Initial load:** Existing skeleton with pulsing timeline dots

**Loading more:** Subtle 3-dot pulsing indicator at bottom of list

**End of feed:** "You've reached the beginning" subtle text message

**Error on load more:** Inline retry button, existing items preserved

### UX Polish

- Smooth fade-in animation for new items
- Summary bar only updates on initial load (stays pinned)
- Pull-to-refresh resets everything, fetches fresh first page
- Location change resets all state

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No intel posts exist | Show real-time data only, `hasMore: false` |
| Scroll past all intel | Show "You've reached the beginning" message |
| Network error on load more | Show retry button inline, keep existing items |
| Pull to refresh | Reset all state, fresh first-page fetch |
| Location changes | Reset all state, fetch for new location |

## Out of Scope (YAGNI)

- Virtualized list (unnecessary for realistic scroll depths)
- Local caching/persistence between sessions
- "Jump to date" feature
- Unread indicators
- Storing historical buoy/tide snapshots

## Files to Modify

1. `app/api/coast-pulse/route.ts` - Add pagination support
2. `components/dashboard/coast-pulse.tsx` - Add infinite scroll UI

## Testing Considerations

- Test first page returns real-time + intel mix
- Test subsequent pages return only older intel
- Test `hasMore: false` when intel exhausted
- Test geo-filtering still applies on paginated requests
- Test error handling on load more
- Test location change resets state
