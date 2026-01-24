# Coast Pulse Realtime Design

**Date:** 2026-01-20
**Status:** Approved

## Overview

Upgrade Live Coast Pulse from 2-minute polling to true Supabase Realtime subscriptions. All condition data (intel posts, forecasts, tides, sessions) will stream live to users.

## Goals

- Intel posts appear instantly when created (no 2-min wait)
- Forecast/tide/buoy updates push to users when ingested
- Nearby sessions show as live activity ("Sarah started a session at La Jolla")
- Leverage Supabase Pro capacity for higher connection limits

## Architecture

### Data Flow

```
User opens Coast Pulse
    → Initial API fetch returns items + nearbyBeachIds
    → Subscribe to Realtime channel keyed by beach IDs
    → Listen for INSERT on intel/forecasts/tides
    → Listen for INSERT/UPDATE on sessions

New data arrives
    → Intel: immediate prepend (or "New posts" pill if scrolled)
    → Forecasts/Tides: debounced summary revalidation
    → Sessions: toast notification
```

### Realtime Subscription Strategy

| Table | Events | Filter | Debounce |
|-------|--------|--------|----------|
| `intel_posts` | INSERT | `beach_id=in.(...)&created_at=gte.{24h}` | Immediate |
| `marine_forecasts` | INSERT | `beach_id=in.(...)&forecast_time=gte.{now}` | 500ms batch |
| `tide_forecasts` | INSERT | `beach_id=in.(...)&time=gte.{now}` | 500ms batch |
| `enhanced_forecasts` | INSERT | `beach_id=in.(...)&forecast_time=gte.{now}` | 500ms batch |
| `sessions` | INSERT, UPDATE | `beach_id=in.(...)&status=eq.active` | 150ms |

### Channel Key Strategy

Channel keyed by sorted beach IDs (not lat/lon) for stability:

```typescript
const channelKey = useMemo(() => {
  const sorted = [...nearbyBeachIds].sort().slice(0, 10);
  return `coast-pulse-${sorted.join('-').slice(0, 50)}`;
}, [nearbyBeachIds]);
```

## Database Changes

### Migration: Enable Realtime for Coast Pulse Tables

```sql
-- supabase/migrations/20260120_enable_realtime_coast_pulse.sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'marine_forecasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marine_forecasts;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tide_forecasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tide_forecasts;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'enhanced_forecasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.enhanced_forecasts;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
END $$;

-- Note: Skipping REPLICA IDENTITY FULL for sessions
-- We only need new row data for UPDATE events, not old row
-- PK-based identity (default) is sufficient and reduces WAL overhead

COMMIT;
```

### Tables Already Configured

- `intel_posts` - Already in publication (migration 20251006000001)
- `intel_post_confirmations` - Already in publication

## New Files

### 1. `hooks/use-coast-pulse-realtime.ts`

```typescript
import { useEffect, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseCoastPulseRealtimeOptions {
  nearbyBeachIds: string[];
  onIntelPost: (post: IntelPostPayload) => void;
  onConditionsChanged: () => void;
  onSessionEvent: (session: SessionPayload) => void;
}

export function useCoastPulseRealtime({
  nearbyBeachIds,
  onIntelPost,
  onConditionsChanged,
  onSessionEvent,
}: UseCoastPulseRealtimeOptions) {
  const supabase = useMemo(() => createClient(), []);

  // Refs for stable callbacks
  const onIntelPostRef = useRef(onIntelPost);
  const onConditionsChangedRef = useRef(onConditionsChanged);
  const onSessionEventRef = useRef(onSessionEvent);

  useEffect(() => {
    onIntelPostRef.current = onIntelPost;
    onConditionsChangedRef.current = onConditionsChanged;
    onSessionEventRef.current = onSessionEvent;
  }, [onIntelPost, onConditionsChanged, onSessionEvent]);

  // Debounce timer for conditions
  const conditionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedConditionsUpdate = useCallback(() => {
    if (conditionsDebounceRef.current) {
      clearTimeout(conditionsDebounceRef.current);
    }
    conditionsDebounceRef.current = setTimeout(() => {
      onConditionsChangedRef.current();
      conditionsDebounceRef.current = null;
    }, 500);
  }, []);

  // Session debounce (shorter)
  const sessionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSessionUpdate = useCallback((session: SessionPayload) => {
    if (sessionDebounceRef.current) {
      clearTimeout(sessionDebounceRef.current);
    }
    sessionDebounceRef.current = setTimeout(() => {
      onSessionEventRef.current(session);
      sessionDebounceRef.current = null;
    }, 150);
  }, []);

  // Stable channel key from beach IDs
  const channelKey = useMemo(() => {
    if (nearbyBeachIds.length === 0) return null;
    const sorted = [...nearbyBeachIds].sort().slice(0, 10);
    return `coast-pulse-${sorted.join("-").slice(0, 50)}`;
  }, [nearbyBeachIds]);

  useEffect(() => {
    if (!channelKey || nearbyBeachIds.length === 0) return;

    let isStale = false;

    const beachFilter = `beach_id=in.(${nearbyBeachIds.join(",")})`;
    const nowIso = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const channel = supabase
      .channel(channelKey)
      // Intel posts - immediate
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intel_posts",
          filter: `${beachFilter}&created_at=gte.${twentyFourHoursAgo}`,
        },
        (payload) => {
          if (!isStale) {
            onIntelPostRef.current(payload.new as IntelPostPayload);
          }
        }
      )
      // Marine forecasts - debounced
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "marine_forecasts",
          filter: `${beachFilter}&forecast_time=gte.${nowIso}`,
        },
        () => {
          if (!isStale) debouncedConditionsUpdate();
        }
      )
      // Tide forecasts - debounced
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tide_forecasts",
          filter: `${beachFilter}&time=gte.${nowIso}`,
        },
        () => {
          if (!isStale) debouncedConditionsUpdate();
        }
      )
      // Enhanced forecasts - debounced
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enhanced_forecasts",
          filter: `${beachFilter}&forecast_time=gte.${nowIso}`,
        },
        () => {
          if (!isStale) debouncedConditionsUpdate();
        }
      )
      // Sessions - INSERT
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sessions",
          filter: `${beachFilter}&status=eq.active`,
        },
        (payload) => {
          if (!isStale) debouncedSessionUpdate(payload.new as SessionPayload);
        }
      )
      // Sessions - UPDATE
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `${beachFilter}&status=eq.active`,
        },
        (payload) => {
          if (!isStale) debouncedSessionUpdate(payload.new as SessionPayload);
        }
      )
      .subscribe();

    return () => {
      isStale = true;
      if (conditionsDebounceRef.current) {
        clearTimeout(conditionsDebounceRef.current);
      }
      if (sessionDebounceRef.current) {
        clearTimeout(sessionDebounceRef.current);
      }
      setTimeout(() => {
        supabase.removeChannel(channel).catch(() => {
          if (process.env.NODE_ENV === "development") {
            console.debug("[CoastPulseRealtime] Channel cleanup completed");
          }
        });
      }, 100);
    };
  }, [supabase, channelKey, nearbyBeachIds, debouncedConditionsUpdate, debouncedSessionUpdate]);
}

// Type definitions
interface IntelPostPayload {
  id: string;
  beach_id: string;
  user_id: string;
  content: string;
  emoji_rating?: string;
  photo_url?: string;
  created_at: string;
}

interface SessionPayload {
  id: string;
  beach_id: string;
  user_id: string;
  status: string;
  arrival_time: string;
}
```

### 2. `app/api/coast-pulse/summary/route.ts`

Lightweight endpoint for summary-only revalidation:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSummary } from "@/lib/utils/coast-pulse-formatter";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ success: false, error: "Invalid coordinates" }, { status: 400 });
  }

  const supabase = await createClient();
  const summary = await buildSummary(supabase, lat, lon);

  return NextResponse.json({ success: true, data: { summary } });
}
```

## Modified Files

### 1. `app/api/coast-pulse/route.ts`

Add `nearbyBeachIds` to response and support `since` param:

```typescript
// In the GET handler, add to response:
return NextResponse.json({
  success: true,
  data: {
    items,
    summary,
    nearbyBeachIds: nearbyBeaches.map(b => b.id), // NEW
    hasMore,
    nextCursor,
  },
});

// Add since param support for revalidation:
const since = searchParams.get("since");
if (since) {
  // Only fetch intel newer than timestamp, merge with existing
}
```

### 2. `components/dashboard/coast-pulse.tsx`

Full integration with Realtime hook:

```typescript
export function CoastPulse({ lat, lon }: CoastPulseProps) {
  const [items, setItems] = useState<CoastPulseItem[]>([]);
  const [summary, setSummary] = useState<CoastPulseSummary | null>(null);
  const [nearbyBeachIds, setNearbyBeachIds] = useState<string[]>([]);
  const [pendingIntelIds, setPendingIntelIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isAtTopRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      isAtTopRef.current = el.scrollTop < 40;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Summary revalidation (debounced)
  const scheduleRefetchSummary = useDebouncedCallback(async () => {
    if (lat == null || lon == null) return;
    const res = await fetch(`/api/coast-pulse/summary?lat=${lat}&lon=${lon}`);
    const json = await res.json();
    if (json.success) {
      setSummary(json.data.summary);
    }
  }, 500);

  // Session toast
  const showSessionToast = useCallback((session: SessionPayload) => {
    // Fetch user name and show toast
    toast(`🏄 Someone started a session nearby`);
  }, []);

  // Realtime subscription
  useCoastPulseRealtime({
    nearbyBeachIds,
    onIntelPost: (post) => {
      if (seenIdsRef.current.has(post.id)) return;
      seenIdsRef.current.add(post.id);

      if (isAtTopRef.current) {
        setItems((prev) => [formatIntelItem(post), ...prev]);
      } else {
        setPendingIntelIds((prev) => new Set(prev).add(post.id));
      }
    },
    onConditionsChanged: () => scheduleRefetchSummary(),
    onSessionEvent: showSessionToast,
  });

  // Initial fetch (sets nearbyBeachIds)
  const fetchData = useCallback(async (since?: string) => {
    if (lat == null || lon == null) return;

    const url = since
      ? `/api/coast-pulse?lat=${lat}&lon=${lon}&since=${encodeURIComponent(since)}`
      : `/api/coast-pulse?lat=${lat}&lon=${lon}`;

    const res = await fetch(url);
    const json: CoastPulseResponse = await res.json();

    if (!json.success) return;

    if (since) {
      // Merge/dedupe
      setItems((prev) => {
        const newItems = json.data.items.filter((i) => !seenIdsRef.current.has(i.id));
        newItems.forEach((i) => seenIdsRef.current.add(i.id));
        return [...newItems, ...prev];
      });
    } else {
      // Initial load
      setItems(json.data.items);
      json.data.items.forEach((i) => seenIdsRef.current.add(i.id));
      setNearbyBeachIds(json.data.nearbyBeachIds);
    }
    setSummary(json.data.summary);
  }, [lat, lon]);

  // "New posts" pill handler
  const handleNewPostsClick = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setPendingIntelIds(new Set());
  };

  // Polling fallback (extended to 10 min)
  useEffect(() => {
    if (lat == null || lon == null) return;
    const interval = setInterval(() => {
      const lastItem = items[0];
      if (lastItem) {
        fetchData(lastItem.timestamp);
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lon, items, fetchData]);

  // ... rest of component with "New posts" pill UI
}
```

## Testing Plan

### Unit Tests

| Test | Description |
|------|-------------|
| Channel creation | Only when `nearbyBeachIds.length > 0` |
| Channel stability | Recreated only when beach ID set changes |
| Cleanup | Calls `supabase.removeChannel()` |
| Debounce buckets | Intel immediate, forecasts 500ms |
| Dedupe logic | `seenIdsRef` prevents duplicates |

### Integration Tests

| Test | Description |
|------|-------------|
| API nearbyBeachIds | Returns stable ordering |
| API since param | Returns only newer intel |
| Summary endpoint | Returns current conditions |

### E2E Tests

```typescript
// e2e/coast-pulse-realtime.spec.ts

test('new intel post appears live', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByTestId('coast-pulse-section')).toBeVisible();
  await expect(page.getByText('Live')).toBeVisible();

  // Insert via test helper endpoint
  const res = await request.post('/api/test/create-intel', {
    data: {
      beachId: testBeachId,
      content: 'E2E test - glassy conditions',
      emojiRating: 'fire',
    }
  });
  const { postId } = await res.json();

  // Should appear without refresh
  await expect(page.getByText('E2E test - glassy conditions')).toBeVisible({ timeout: 8000 });

  // Cleanup
  await request.delete(`/api/test/delete-intel/${postId}`);
});

test('dedupe under polling fallback', async ({ page, request }) => {
  await page.goto('/');

  const res = await request.post('/api/test/create-intel', {
    data: { beachId: testBeachId, content: 'Dedupe test post' }
  });

  await expect(page.getByText('Dedupe test post')).toBeVisible();

  // Trigger revalidate
  await page.evaluate(() => window.__coastPulseRevalidate?.());

  // Ensure no duplicate
  const items = await page.getByText('Dedupe test post').all();
  expect(items.length).toBe(1);
});

test('new posts pill shows when scrolled', async ({ page, request }) => {
  await page.goto('/');

  // Scroll down
  await page.getByTestId('coast-pulse-section').evaluate(el => el.scrollTop = 200);

  // Insert post
  await request.post('/api/test/create-intel', {
    data: { beachId: testBeachId, content: 'Scrolled test post' }
  });

  // Pill should appear
  await expect(page.getByText(/new post/i)).toBeVisible({ timeout: 8000 });

  // Tap pill
  await page.getByText(/new post/i).click();

  // Should scroll to top and show post
  await expect(page.getByText('Scrolled test post')).toBeVisible();
});
```

## Rollout

1. **Deploy migration** - Add tables to Realtime publication
2. **Deploy API changes** - `nearbyBeachIds`, `since` param, summary endpoint
3. **Deploy hook + component** - Full Realtime integration
4. **Monitor** - Watch Realtime metrics in Supabase dashboard for 24h

## Performance Considerations

- **Channel key stability** - Based on beach IDs, not lat/lon, to prevent GPS jitter reconnects
- **Tight filters** - All subscriptions scoped by beach ID + time window
- **INSERT-only for forecasts** - Avoids REPLICA IDENTITY FULL overhead
- **Debounced batch updates** - Prevents UI thrashing during forecast ingestion
- **10-min polling fallback** - Safety net, not primary mechanism

## Future Enhancements

If Realtime volume becomes high:

1. Create `live_*` slice tables (next 48h per beach)
2. Ingestion upserts current slice only
3. Clients subscribe to slice tables instead of raw ingestion tables

## Related Documentation

- [REALTIME_OPTIMIZATION_GUIDE.md](/docs/REALTIME_OPTIMIZATION_GUIDE.md)
- [supabase/ARCHITECTURE.md](/supabase/ARCHITECTURE.md)
- [components/dashboard/coast-pulse.tsx](/components/dashboard/coast-pulse.tsx)
