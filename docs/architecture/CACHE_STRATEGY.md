# Cache Strategy Architecture

> Comprehensive caching patterns for Quiver's API and data layers.

## Overview

Quiver implements a multi-tier caching strategy:

1. **CDN/Edge Cache** - Vercel CDN with stale-while-revalidate
2. **Application Cache** - In-memory request caching
3. **Database Cache** - Materialized views and query caching
4. **Client Cache** - React Query and browser caching

## Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ React Query     │  │ Browser Cache   │  │ Service Worker      │ │
│  │ (5min default)  │  │ (ETags)         │  │ (offline support)   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
└───────────┼─────────────────────┼─────────────────────┼────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                        Vercel Edge                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Cache-Control: public, s-maxage=600, stale-while-revalidate  │  │
│  │ ETag-based conditional requests (304 Not Modified)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                     Next.js Server                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ apiCache        │  │ forecastCache   │  │ beachCache          │ │
│  │ TTL: 3min       │  │ TTL: 15min      │  │ TTL: 30min          │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
└───────────┼─────────────────────┼─────────────────────┼────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                      Supabase/PostgreSQL                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Materialized Views (refreshed via cron)                      │  │
│  │ - mv_beach_hourly_scores (2hr refresh)                       │  │
│  │ - mv_best_times (hourly refresh)                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## CDN Cache Headers

**Location:** `lib/utils/cache-headers.ts`

### Cache Duration Presets

```typescript
export const CacheDuration = {
  /** 2 minutes - Live conditions, recent posts */
  SHORT: {
    maxAge: 120,
    sMaxAge: 120,
    staleWhileRevalidate: 300,  // 5 min SWR
  },
  /** 5 minutes - Search results, beach lists */
  MEDIUM: {
    maxAge: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 3600,  // 1 hour SWR
  },
  /** 10 minutes - Beach details, forecasts */
  LONG: {
    maxAge: 600,
    sMaxAge: 1200,
    staleWhileRevalidate: 7200,  // 2 hours SWR
  },
  /** 30 minutes - Static content, metadata */
  VERY_LONG: {
    maxAge: 1800,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400, // 24 hours SWR
  },
};
```

### Usage in API Routes

```typescript
import { createCacheHeaders, CacheDuration, generateETag } from '@/lib/utils/cache-headers';

export async function GET(request: Request) {
  const data = await fetchData();
  const etag = await generateETag(data);

  return NextResponse.json(data, {
    headers: createCacheHeaders(CacheDuration.LONG, etag)
  });
}

// Resulting headers:
// Cache-Control: public, max-age=600, s-maxage=1200, stale-while-revalidate=7200
// ETag: "a3f8b2c1..."
// Vary: Accept-Encoding
```

### ETag Support

```typescript
import { isETagMatch, generateETag } from '@/lib/utils/cache-headers';

export async function GET(request: Request) {
  const data = await fetchData();
  const requestETag = request.headers.get('If-None-Match');

  // Return 304 if content unchanged
  if (await isETagMatch(requestETag, data)) {
    return new Response(null, { status: 304 });
  }

  const etag = await generateETag(data);
  return NextResponse.json(data, {
    headers: createCacheHeaders(CacheDuration.MEDIUM, etag)
  });
}
```

## Application Cache

**Location:** `lib/utils/request-cache.ts`

### Cache Instances

| Cache | TTL | Max Size | Use Case |
|-------|-----|----------|----------|
| `apiCache` | 3 min | 50 entries | General API responses |
| `forecastCache` | 15 min | 30 entries | Forecast data |
| `beachCache` | 30 min | 100 entries | Beach details |

### RequestCache Class

```typescript
import { apiCache, forecastCache, beachCache, RequestCache } from '@/lib/utils/request-cache';

// Get cached data
const cached = forecastCache.get<ForecastData>(cacheKey);
if (cached) {
  return cached;
}

// Fetch and cache
const data = await fetchForecast();
forecastCache.set(cacheKey, data, 15 * 60 * 1000); // 15 min TTL

// Create cache keys
const key = RequestCache.createKey('beach', beachId, 'forecast');
// Result: "beach:abc123:forecast"
```

### Cache Statistics

```typescript
const stats = forecastCache.getStats();
// { size: 25, maxSize: 30, defaultTTL: 900000 }
```

### Auto-Cleanup

```typescript
// Hourly cleanup of expired entries (browser only)
if (typeof window !== "undefined") {
  setInterval(() => {
    apiCache.clearExpired();
    forecastCache.clearExpired();
    beachCache.clearExpired();
  }, 60 * 60 * 1000);
}
```

## Database Materialized Views

### `mv_beach_hourly_scores`

Pre-computed hourly surf scores for all beaches.

**Refresh:** Every 2 hours via cron

```sql
-- Refresh function
CREATE OR REPLACE FUNCTION refresh_mv_beach_hourly_scores()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_beach_hourly_scores;
END;
$$ LANGUAGE plpgsql;
```

### `mv_best_times`

Pre-computed optimal surf windows.

**Refresh:** Hourly via cron

### Cron Schedule

```typescript
// vercel.json or cron configuration
{
  "crons": [
    {
      "path": "/api/cron/forecasts/refresh",
      "schedule": "0 */2 * * *"  // Every 2 hours
    }
  ]
}
```

## Cache by Endpoint

| Endpoint | Cache Type | Duration | Notes |
|----------|------------|----------|-------|
| `/api/beaches` | CDN + App | MEDIUM (5min) | List of all beaches |
| `/api/beaches/[id]` | CDN + App | LONG (10min) | Beach details |
| `/api/beaches/nearby` | CDN | SHORT (2min) | Location-based |
| `/api/beaches/featured` | CDN | VERY_LONG (30min) | Landing page |
| `/api/surf` | CDN + App | LONG (10min) | Forecast data |
| `/api/surf/discover` | CDN | MEDIUM (5min) | Discovery feed |
| `/api/home/personalized-forecast` | None | - | User-specific |
| `/api/sessions` | None | - | User data |
| `/api/recent-posts` | CDN | SHORT (2min) | Live feed |

## Cache Invalidation

### Manual Invalidation

```typescript
import { beachCache, forecastCache } from '@/lib/utils/request-cache';

// Clear specific entry
beachCache.delete(RequestCache.createKey('beach', beachId));

// Clear all entries
forecastCache.clear();

// Clear expired only
const clearedCount = forecastCache.clearExpired();
```

### Revalidation Patterns

```typescript
// Next.js revalidation
import { revalidatePath, revalidateTag } from 'next/cache';

// After mutation
export async function updateBeach(beachId: string, data: BeachUpdate) {
  await supabase.from('beaches').update(data).eq('id', beachId);

  // Revalidate related paths
  revalidatePath(`/beach/${beachId}`);
  revalidatePath('/beaches');
  revalidateTag('beaches');
}
```

## Best Practices

### When to Cache

| Scenario | Cache | Duration |
|----------|-------|----------|
| Public data, read-heavy | Yes | MEDIUM-LONG |
| Personalized data | No | - |
| Real-time conditions | Yes | SHORT |
| Static content | Yes | VERY_LONG |
| User-specific data | Client only | - |

### Cache Key Design

```typescript
// Good: Hierarchical, specific
const key = RequestCache.createKey('beach', beachId, 'forecast', date);
// "beach:abc123:forecast:2025-12-03"

// Bad: Too generic
const key = 'forecast'; // Will collide
```

### Stale-While-Revalidate

Use SWR for optimal UX:

```typescript
// User sees cached data immediately
// Background revalidation updates cache
CacheDuration.LONG = {
  maxAge: 600,              // Fresh for 10 min
  sMaxAge: 1200,            // CDN fresh for 20 min
  staleWhileRevalidate: 7200 // Serve stale for 2 hours while revalidating
};
```

## Monitoring

### Cache Hit Metrics

Track cache effectiveness:

```typescript
// In API route
const cacheHit = forecastCache.has(cacheKey);

trackEvent('api_request', {
  endpoint: '/api/surf',
  cache_hit: cacheHit,
  response_time_ms: duration
});
```

### Headers to Monitor

```
X-Cache: HIT | MISS | STALE
Age: <seconds since cached>
X-Vercel-Cache: HIT | MISS | STALE
```

## Related Documentation

- [API Architecture](/app/api/ARCHITECTURE.md)
- [Rate Limiting](/docs/architecture/RATE_LIMITING_ARCHITECTURE.md)
- [Performance Optimization](/docs/PERFORMANCE_OPTIMIZATION.md)
- [Vercel CDN Docs](https://vercel.com/docs/manage-cdn-usage)

---

**Last Updated:** December 2025
