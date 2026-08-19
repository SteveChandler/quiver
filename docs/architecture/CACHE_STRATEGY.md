# Cache Strategy Architecture

> Comprehensive caching philosophy + implementation reference for Quiver’s API and data layers.

## Overview

Quiver implements a **multi-tier caching strategy**. The important nuance is that we have _multiple caches at different layers_, and they can either complement each other (best case) or fight each other (worst case).

### Philosophy (what we optimize for)

- **Correctness + security > performance**: we will not cache user-specific data in shared caches (CDN, “public” HTTP caches, or service worker caches that could cross users on a shared device).
- **Cache where it’s safe and high leverage**: public read-heavy endpoints (beaches, featured lists, some forecast data) should be cacheable via HTTP/CDN with SWR.
- **Keep invalidation simple**: prefer **time-based freshness** for public data and **explicit invalidation** for server-rendered pages affected by mutations (`revalidatePath`, `revalidateTag`).
- **Avoid “cache soup”**: don’t stack 4 caches for the same resource unless we can explain which one is authoritative and how they align.

### Caching layers in Quiver (today)

1. **HTTP/CDN Cache (Vercel Edge)** – `Cache-Control` + `stale-while-revalidate` + optional ETag/304.
2. **Next.js Cache (Server Components / Server Actions)** – `export const revalidate`, `unstable_cache`, `revalidatePath`, `revalidateTag`.
3. **Client Cache (React Query)** – `@tanstack/react-query` default query caching.
4. **In-memory “request cache”** – lightweight TTL Map caches (primarily client-side, sometimes imported server-side).
5. **Service worker cache (PWA)** – `next-pwa` runtime caching rules for offline and perceived speed.
6. **Database precompute** – materialized views / indexed tables refreshed by cron jobs.

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
│  │ request-cache   │  │ Next.js cache   │  │ route headers       │ │
│  │ TTL: minutes→h  │  │ tags/paths/TTL  │  │ Cache-Control/ETag  │ │
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

## HTTP/CDN Cache Headers (Vercel Edge)

**Primary utilities:**

- `lib/utils/cache-headers.ts` – Cache-Control presets, ETag generation/match helpers.
- `lib/api-utils.ts` – `createCachedResponse()`, `createPaginatedResponse()`, `checkNotModified()`.

**Global defaults (important):**

- `next.config.mjs` applies a default header for **all** `/api/(.*)` routes:
  - `Cache-Control: public, max-age=60, stale-while-revalidate=120`
  - Any API route that serves authenticated or personalized data **must override this**.

### Cache Duration Presets

```typescript
export const CacheDuration = {
  /** 2 minutes - Live conditions, recent posts */
  SHORT: {
    maxAge: 120,
    sMaxAge: 120,
    staleWhileRevalidate: 300, // 5 min SWR
  },
  /** 5 minutes - Search results, beach lists */
  MEDIUM: {
    maxAge: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 3600, // 1 hour SWR
  },
  /** 10 minutes - Beach details, forecasts */
  LONG: {
    maxAge: 600,
    sMaxAge: 1200,
    staleWhileRevalidate: 7200, // 2 hours SWR
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
import {
  createCacheHeaders,
  CacheDuration,
  generateETag,
} from "@/lib/utils/cache-headers";

export async function GET(request: Request) {
  const data = await fetchData();
  const etag = await generateETag(data);

  return NextResponse.json(data, {
    headers: createCacheHeaders(CacheDuration.LONG, etag),
  });
}

// Resulting headers:
// Cache-Control: public, max-age=600, s-maxage=1200, stale-while-revalidate=7200
// ETag: "a3f8b2c1..."
// Vary: Accept-Encoding
```

### ETag Support

```typescript
import { isETagMatch, generateETag } from "@/lib/utils/cache-headers";

export async function GET(request: Request) {
  const data = await fetchData();
  const requestETag = request.headers.get("If-None-Match");

  // Return 304 if content unchanged
  if (await isETagMatch(requestETag, data)) {
    return new Response(null, { status: 304 });
  }

  const etag = await generateETag(data);
  return NextResponse.json(data, {
    headers: createCacheHeaders(CacheDuration.MEDIUM, etag),
  });
}
```

## In-memory Request Cache (TTL Map caches)

**Location:** `lib/utils/request-cache.ts` + TTL config in `lib/constants/ui.ts`.

This is a lightweight in-process cache (a Map with TTL + simple eviction). In practice, today it is mostly used from client hooks (so it behaves like a per-tab memory cache), but it _can_ be imported in server code (in which case it behaves like a per-runtime-instance cache).

### Cache Instances

| Cache           | TTL        | Max Size    | Use Case                                              |
| --------------- | ---------- | ----------- | ----------------------------------------------------- |
| `apiCache`      | 30 minutes | 50 entries  | General lightweight client caching (maps, UI fetches) |
| `forecastCache` | 3 hours    | 30 entries  | Forecast data (aligned to NOAA cadence)               |
| `beachCache`    | 12 hours   | 100 entries | Beach metadata (rarely changes)                       |

**Source of truth:** `lib/constants/ui.ts` (`CACHE_TTL`).

### RequestCache Class

```typescript
import {
  apiCache,
  forecastCache,
  beachCache,
  RequestCache,
} from "@/lib/utils/request-cache";

// Get cached data
const cached = forecastCache.get<ForecastData>(cacheKey);
if (cached) {
  return cached;
}

// Fetch and cache
const data = await fetchForecast();
forecastCache.set(cacheKey, data, 3 * 60 * 60 * 1000); // 3 hours (see CACHE_TTL.FORECASTS)

// Create cache keys
const key = RequestCache.createKey("beach", beachId, "forecast");
// Result: "beach:abc123:forecast"
```

### Cache Statistics

```typescript
const stats = forecastCache.getStats();
// { size: 25, maxSize: 30, defaultTTL: 10800000 }
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

### Where it’s used

- `hooks/use-cached-api.ts` – generic hook that first checks the cache, then fetches and stores results.
- `hooks/use-enhanced-forecast.ts` – uses `useCachedApi(..., { cache: forecastCache })` for `/api/forecasts/update-enhanced` reads.

## Client Cache (React Query)

**Provider config:** `components/providers/react-query-provider.tsx`

- Default `staleTime`: 5 minutes
- Default `gcTime`: 30 minutes
- `refetchOnWindowFocus`: false
- `refetchOnMount`: false

**Important detail:** some hooks override these defaults, e.g.:

- `hooks/useNearbyBeaches.ts` sets `staleTime: 0`, meaning it’s effectively always stale and can refetch frequently (depending on usage patterns).

## Next.js Cache (Server Actions / Server Components)

We use Next.js caching primitives mostly for server-rendered pages and server-side data fetchers:

- `revalidatePath()` after mutations (common across actions).
- `revalidateTag()` for tag-based invalidation when used.
- `unstable_cache()` for memoized server fetchers where tag-based invalidation is useful.

Example:

- `actions/profile-actions.ts` uses `unstable_cache(..., { tags: ['profile'], revalidate: 300 })` and invalidates via `revalidateTag('profile')` and `revalidatePath(...)`.

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

This table is intentionally pragmatic: it reflects what is implemented in `app/api/*` today (plus key behavior from `next.config.mjs`).

| Endpoint                            | Audience          | Cache Type       | Duration                        | Notes                                                                         |
| ----------------------------------- | ----------------- | ---------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `/api/beaches`                      | Public            | CDN (ETag)       | `CacheDuration.MEDIUM`          | Uses `checkNotModified()` + `createCachedResponse()`                          |
| `/api/beaches/featured`             | Public            | CDN (ETag)       | `CacheDuration.MEDIUM`          | Landing page list; cached response                                            |
| `/api/beaches/[id]`                 | Public            | CDN              | `s-maxage=3600, swr=86400`      | Sets explicit headers in route                                                |
| `/api/beaches/[id]/sources`         | Public            | CDN              | `s-maxage=1800, swr=7200`       | Sets explicit headers in route                                                |
| `/api/beaches/search`               | Public            | CDN (ETag)       | `CacheDuration.MEDIUM`          | Search results; paginated cached response                                     |
| `/api/beaches/nearby`               | Public            | (currently none) | (defaults apply)                | Does not set cache headers today; inherits `next.config.mjs` `/api/*` default |
| `/api/beaches/[id]/sessions`        | Public-ish        | (currently none) | (defaults apply)                | Doesn’t set cache headers; often fetched with `cache: "no-store"` from client |
| `/api/beaches/favorites`            | Auth              | (currently none) | (must be private/no-store)      | Must override global `/api/*` header (see Pitfalls)                           |
| `/api/beaches/[id]/favorite/toggle` | Auth mutation     | No cache         | -                               | Should be non-cacheable                                                       |
| `/api/forecasts/update-enhanced`    | Public            | CDN              | `s-maxage=600, swr=3600`        | Cached forecast reads with staleness semantics                                |
| `/api/surf/discover`                | Auth/personalized | Private + ETag   | `private, max-age=300, swr=900` | Uses ETag and private caching (per-user)                                      |
| `/api/surf/insights`                | Auth/personalized | Private          | `private, max-age=300`          | User-specific insights                                                        |

## Cache Invalidation

### Manual Invalidation

```typescript
import { beachCache, forecastCache } from "@/lib/utils/request-cache";

// Clear specific entry
beachCache.delete(RequestCache.createKey("beach", beachId));

// Clear all entries
forecastCache.clear();

// Clear expired only
const clearedCount = forecastCache.clearExpired();
```

### Revalidation Patterns

```typescript
// Next.js revalidation
import { revalidatePath, revalidateTag } from "next/cache";

// After mutation
export async function updateBeach(beachId: string, data: BeachUpdate) {
  await supabase.from("beaches").update(data).eq("id", beachId);

  // Revalidate related paths
  revalidatePath(`/beach/${beachId}`);
  revalidatePath("/beaches");
  revalidateTag("beaches");
}
```

## Decision Matrix (what to choose)

### Public, non-sensitive GET endpoints (safe to share)

- **Prefer**: `createCachedResponse()` + `CacheDuration.*` (+ `checkNotModified()` when payload is stable enough)
- **Headers**: `public, s-maxage=..., stale-while-revalidate=...` (+ ETag)
- **Client fetch**: avoid `cache: "no-store"`; allow HTTP caching to work.

### Authenticated / user-specific GET endpoints (must not be shared)

- **Prefer**: explicit `Cache-Control: private, max-age=<small>` (or `no-store` when correctness matters more than UX)
- If using ETag, keep it **private**.
- **Never** rely on global defaults; set the header in the route.

### Mutations (POST/PATCH/DELETE)

- **Always** non-cacheable responses.
- **Invalidate** server-rendered paths/tags via `revalidatePath()` / `revalidateTag()` as needed.

## Best Practices (current conventions)

### When to Cache

| Scenario                | Cache       | Duration    |
| ----------------------- | ----------- | ----------- |
| Public data, read-heavy | Yes         | MEDIUM-LONG |
| Personalized data       | No          | -           |
| Real-time conditions    | Yes         | SHORT       |
| Static content          | Yes         | VERY_LONG   |
| User-specific data      | Client only | -           |

### Cache Key Design

```typescript
// Good: Hierarchical, specific
const key = RequestCache.createKey("beach", beachId, "forecast", date);
// "beach:abc123:forecast:2025-12-03"

// Bad: Too generic
const key = "forecast"; // Will collide
```

### Stale-While-Revalidate

Use SWR for optimal UX:

```typescript
// User sees cached data immediately
// Background revalidation updates cache
CacheDuration.LONG = {
  maxAge: 600, // Fresh for 10 min
  sMaxAge: 1200, // CDN fresh for 20 min
  staleWhileRevalidate: 7200, // Serve stale for 2 hours while revalidating
};
```

## Service Worker Cache (PWA)

**Config location:** `next.config.mjs` (Workbox via `next-pwa`).

This cache is about **offline support** and **perceived performance**. It can be extremely valuable, but it is also a common source of “why am I seeing stale data?” and (worse) **cross-user leakage on shared devices** if auth endpoints are cached.

**Reality check (today):**

- There is a runtime caching rule matching `url.pathname.startsWith("/api/beaches")` with `NetworkFirst` and a 1-hour expiration.
  - This pattern is broad enough to include auth endpoints like `/api/beaches/favorites` unless explicitly excluded.
- There is a runtime caching rule matching `url.pathname.startsWith("/api/forecast")`, but most forecast endpoints are under `/api/forecasts/*` in this codebase.

## Pitfalls (things that can bite us)

### 1) Global `/api/*` default is `public` caching (security/correctness risk)

**Source:** `next.config.mjs` sets:

- `source: "/api/(.*)"` → `Cache-Control: public, max-age=60, stale-while-revalidate=120`

**Why this is risky:** any authenticated/user-specific route that forgets to set its own header could become cacheable as **public**, enabling incorrect caching and (in worst cases) unintended sharing via intermediary caches.

**Actionable rule:** all auth/personalized API routes should set an explicit `Cache-Control` (typically `private, ...` or `no-store`) in the route handler.

### 2) Service worker caching rules can accidentally cache auth endpoints

**Source:** `next.config.mjs` Workbox runtimeCaching:

- `urlPattern: ({ url }) => url.pathname.startsWith("/api/beaches")`

**Why this is risky:** this will match both public and auth endpoints under `/api/beaches/*` (for example `/api/beaches/favorites`). On shared devices, a service worker cache can serve responses across logins if the request URL matches and the SW chooses cached data (especially offline / flaky network).

**Impact:** potential cross-user data exposure + “stale favorites” bugs.

### 3) `cache: "no-store"` on the client bypasses HTTP caching and can hurt UX/perf

**Source examples:** `lib/data/client.ts` uses `fetch(..., { cache: "no-store" })` widely; multiple components do the same.

**Why this matters:**

- It disables browser HTTP caching even when the API route returns strong caching headers (`Cache-Control`, ETag).
- It can contribute to Lighthouse findings around back/forward cache when key requests are `no-store`.
- It creates a split-brain where the server is “cacheable” but the client opts out.

### 4) Mismatched TTLs across layers makes staleness debugging hard

Examples of “same data, different TTL knobs”:

- React Query default `staleTime` (5m) vs. HTTP cache headers that may be 10m+.
- `forecastCache` in-memory TTL (3h) vs `/api/forecasts/update-enhanced` headers (10m + 1h SWR).
- CDN SWR might serve stale while revalidating, while client in-memory cache might also serve stale, etc.

When these are not intentionally aligned, it becomes hard to answer: “Why did the user see old data?”

### 5) ETag generation cost and 304 semantics

**Source:** `lib/utils/cache-headers.ts` uses JSON stringify + SHA-256 via WebCrypto to generate ETags.

**Trade-off:** ETags reduce bytes over the wire (304), but hashing large payloads can add CPU and latency. This is worth it for large public payloads _only if_ the total win is positive.

**Implementation gotcha:** `lib/api-utils.ts` `checkNotModified()` returns a 304 with security headers but does **not** include the matching ETag or Cache-Control on the 304 response. (Many clients/CDNs behave best when 304s also carry cache headers/validators.)

### 6) Doc drift / stale references

Example: `/app/api/ARCHITECTURE.md` references `/cache/status/route.ts`, but `app/api/cache/*` does not exist in the current tree. These stale references slow debugging and lead to “I thought we had a cache dashboard.”

## Recommendations (prioritized)

### Quick wins (high impact, low risk)

1. **Remove or narrow the global `/api/(.*)` `public` Cache-Control default**

- **Current:** `next.config.mjs` applies `public, max-age=60, stale-while-revalidate=120` to every API route.
- **Recommendation:** default API caching should be conservative (often `no-store`) and let _explicitly cacheable_ endpoints opt in.
- **Why:** eliminates an entire class of “oops, auth route got cached” failures.

2. **Make service worker runtimeCaching patterns specific to safe public routes**

- **Current risk:** broad match on `/api/beaches*` can include auth endpoints (`/api/beaches/favorites`).
- **Recommendation:** whitelist only truly public endpoints (e.g. `/api/beaches`, `/api/beaches/featured`, `/api/beaches/search`, `/api/beaches/[id]`, `/api/beaches/[id]/sources`) and explicitly exclude anything auth/mutation.
- **Also fix:** `/api/forecast` → `/api/forecasts` mismatch so offline caching actually covers forecast reads.

3. **Stop using `cache: "no-store"` for endpoints that already return cacheable HTTP headers**

- **Current:** many client fetches opt out of browser caching even when the server is doing the right thing.
- **Recommendation:** for public GETs, use default browser behavior and rely on `Cache-Control`/ETag; reserve `no-store` for user-specific or correctness-critical reads.

4. **Standardize public GET routes on `createCachedResponse()` + `checkNotModified()`**

- **Benefit:** consistent headers and consistent ETag/304 behavior across endpoints, fewer one-off header strings.
- **Follow-up:** improve `checkNotModified()` to include appropriate cache validators/headers on 304 responses.

### Medium-term (bigger wins, some refactoring)

5. **Align TTLs across layers for the same resource**

- Example: if `/api/forecasts/update-enhanced` is cached at 10 minutes + 1 hour SWR, don’t also keep a 3-hour in-memory cache in front of it unless that’s explicitly desired (and documented as “offline/UX cache”).
- Align React Query `staleTime` with server TTL when using React Query for those resources.

6. **Add lightweight cache observability headers on cacheable endpoints**

- Standardize on a small set of debug headers like:
  - `X-Quiver-Cache-Policy` (e.g. `public-swr`, `private-short`, `no-store`)
  - `X-Quiver-ETag` (or rely on `ETag`)
  - `Age` and `X-Vercel-Cache` (already provided by platform in many cases)
- This makes debugging “stale vs fresh” tractable without digging through code.

7. **Create a “Cache Audit Checklist” and keep docs in sync**

- For every new API route: audience classification, header choice, SW inclusion/exclusion, client fetch behavior.
- Remove or fix stale references (e.g., the non-existent `/api/cache/status` route reference).

### Long-term (scale and cost control)

8. **Introduce a distributed cache only for a few expensive hot paths**

- Candidates: personalized surf discovery/recommendations endpoints where compute is expensive and the same user may request repeatedly.
- Prefer Redis/Upstash/Vercel KV with explicit TTLs and clear “who owns freshness” semantics.
- Do **not** use distributed caching as a blanket solution; use it when profiling confirms DB/compute is the bottleneck.

## Monitoring / Debugging

### Cache Hit Metrics

Track cache effectiveness:

```typescript
// In API route
const cacheHit = forecastCache.has(cacheKey);

trackEvent("api_request", {
  endpoint: "/api/surf",
  cache_hit: cacheHit,
  response_time_ms: duration,
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
