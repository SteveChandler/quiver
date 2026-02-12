# Data Fetching Guide

This guide documents when to use each data fetching pattern in Quiver. The codebase uses multiple patterns depending on the rendering context (client vs server), caching needs, and data freshness requirements.

---

## Decision Matrix

| Pattern | When to Use | Context | Caching |
|---------|-------------|---------|---------|
| `useDataFetcher` | Default for client components loading data on mount | Client | None (in-memory state) |
| SWR | Real-time data needing background revalidation | Client | Stale-while-revalidate |
| TanStack Query | Complex cache invalidation, dependent queries | Client | Query key-based |
| Server Actions | Mutations from client components | Client -> Server | None |
| `fetch()` + API route | CDN-cacheable data, custom caching headers | Server or Client | HTTP / `Cache-Control` |
| `unstable_cache` | Server-side RSC time-based revalidation | Server only | Tag-based / TTL |

---

## Pattern Details

### 1. `useDataFetcher` -- Default Client Pattern

**Location:** `hooks/use-data-fetcher.ts`

The standard hook for client components that need to load data on mount. Wraps any async function with loading/error/data state management.

**When to use:**
- Client components calling server actions or API routes
- Simple fetch-on-mount with optional refetch
- No need for background revalidation or shared cache

**Example:**

```tsx
import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getSessionsAction } from "@/actions/session-actions";

function SessionList() {
  const fetchSessions = useCallback(async () => {
    return await getSessionsAction();
  }, []);

  const { data, loading, error, refetch } = useDataFetcher(fetchSessions);

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage message={error} />;
  return <List items={data} />;
}
```

**Options:**
- `immediate` (default `true`) -- fetch on mount
- `skip` -- conditionally skip fetching
- `onSuccess` / `onError` -- callbacks
- `initialData` -- pre-populate state

**Return value:** `{ data, loading, error, refetch, retry, reset }`

---

### 2. SWR -- Background Revalidation

**When to use:**
- Data that benefits from stale-while-revalidate (show cached, refresh in background)
- High-frequency reads where deduplication matters
- API routes with `Cache-Control` headers

**Current usage in the codebase:**
- `hooks/use-sun-times.ts` -- sunrise/sunset times (5-min dedup, rarely changes)
- `hooks/use-beach-detail-data.ts` -- beach detail with parallel SWR fetches (60s dedup)

**Example:**

```tsx
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

function SunTimes({ beachId, date }: { beachId: string; date: string }) {
  const { data, error, isLoading } = useSWR(
    `/api/beaches/${beachId}/sun-times?date=${date}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min
      errorRetryCount: 1,
    }
  );

  // ...
}
```

**Key SWR options used in Quiver:**
- `revalidateOnFocus: false` -- avoid unnecessary refetches on tab switch
- `dedupingInterval` -- prevent duplicate requests within a time window
- `errorRetryCount` -- limit retries for non-transient errors

---

### 3. TanStack Query -- Complex Cache Management

**When to use:**
- Geospatial queries where cache key granularity matters
- Data shared across multiple components (query key deduplication)
- Garbage collection of stale cache entries

**Current usage in the codebase:**
- `hooks/useNearbyBeaches.ts` -- nearby beaches via Supabase RPC with rounded lat/lon keys

**Setup:** The app wraps with `QueryClientProvider` in `components/providers/react-query-provider.tsx`.

**Example:**

```tsx
import { useQuery } from "@tanstack/react-query";

function NearbyBeaches({ lat, lon }: { lat: number; lon: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["nearby-beaches", Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000],
    queryFn: () => fetchNearestBeaches(lat, lon),
    enabled: Number.isFinite(lat) && Number.isFinite(lon),
    staleTime: 60_000,       // 1 minute before considered stale
    gcTime: 10 * 60_000,     // 10 minutes before garbage collected
  });

  // ...
}
```

---

### 4. Server Actions -- Mutations

**Location:** `lib/server-action-utils.ts`

All authenticated mutations use `withAuthenticatedAction`. This validates the user session and provides the Supabase client.

**When to use:**
- Any write operation (create, update, delete) from a client component
- Actions that need the authenticated user context

**Example:**

```ts
// actions/session-actions.ts
import { withAuthenticatedAction } from "@/lib/server-action-utils";

export async function deleteSession(sessionId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return { deleted: true };
  });
}
```

**Response shape:** `{ success: boolean; data?: T; error?: string }`

Also available: `makeAuthenticatedAction` (curried), `withValidation` (Zod schema), `createServerAction` (combined auth + validation).

---

### 5. `fetch()` + API Route -- CDN-Cacheable Data

**When to use:**
- Server components or API routes that need HTTP-level caching
- Data served to unauthenticated users (CDN-friendly)
- Custom `Cache-Control` headers

**API route pattern (preferred: `withAuth` wrapper):**

```ts
// app/api/beaches/[id]/route.ts
import { withAuth } from "@/lib/middleware/api-wrappers";
import { createSuccessResponse } from "@/lib/middleware/api-wrappers";

export const GET = withAuth(async (request, { user, supabase, params }) => {
  const beach = await getBeach(params.id, supabase);
  return createSuccessResponse(beach);
}, { errorMessage: "Failed to load beach" });
```

**Client-side fetch with cache hints:**

```ts
const res = await fetch(`/api/beaches/${beachId}/forecasts`, {
  cache: "force-cache",
  next: { revalidate: 600 }, // 10 minutes
});
```

---

### 6. `unstable_cache` -- Server-Side RSC Caching

**When to use:**
- Server components or server actions that run expensive DB queries
- Data that can be revalidated on a time schedule or by tag
- Shared across multiple requests on the server

**Current usage in the codebase:**
- `lib/data/server/featured-beaches.ts` -- landing page beach list (1-hour TTL)
- `actions/beach/beach-query-actions.ts` -- intent + city beach queries (30-min TTL)
- `actions/beach/cam-actions.ts` -- beaches with cameras
- `actions/profile-actions.ts` -- profile data with tag-based revalidation
- `lib/services/coast-pulse/coast-pulse-service.ts` -- coast pulse aggregation

**Example:**

```ts
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function _getBeachesByCity(citySlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("beaches")
    .select("*")
    .eq("city_slug", citySlug);

  if (error) throw new Error(error.message);
  return data;
}

export const getBeachesByCity = unstable_cache(
  _getBeachesByCity,
  ["beaches-by-city"],
  { revalidate: 1800 } // 30 minutes
);
```

**Key options:**
- Second arg: cache key segments (array of strings)
- `revalidate`: TTL in seconds
- `tags`: for on-demand revalidation via `revalidateTag()`

---

## Choosing the Right Pattern

```
Is this a mutation (write)?
  YES -> Server Action with withAuthenticatedAction
  NO  -> Is this server-side (RSC / API route)?
           YES -> Does it need time-based caching?
                    YES -> unstable_cache
                    NO  -> Direct DB query or fetch()
           NO  -> Is background revalidation needed?
                    YES -> Does it need complex cache keys?
                            YES -> TanStack Query
                            NO  -> SWR
                    NO  -> useDataFetcher (default)
```

---

## Anti-Patterns

**Do not** mix patterns unnecessarily within a single component. If `useDataFetcher` handles the use case, prefer it over SWR or TanStack Query.

**Do not** use `useEffect` + `useState` for data fetching. Always use `useDataFetcher` or one of the other patterns above.

**Do not** call `fetch()` directly in client components for authenticated data. Use server actions or the `useDataFetcher` + action pattern instead.

**Do not** create new data fetching hooks without checking if an existing pattern covers the use case. Consult `hooks/ARCHITECTURE.md` for the full hook inventory.
