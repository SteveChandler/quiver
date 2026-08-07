# Supabase Database Guide

This document provides comprehensive documentation for working with Supabase in the Quiver surfing application. It covers database schema, data access patterns, RLS policies, and best practices.

**Last Updated**: January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Client Configuration](#client-configuration)
3. [Database Schema](#database-schema)
4. [Data Access Patterns](#data-access-patterns)
5. [Row Level Security (RLS)](#row-level-security-rls)
6. [TypeScript Types](#typescript-types)
7. [Server Actions](#server-actions)
8. [Real-time Subscriptions](#real-time-subscriptions)
9. [Common Operations](#common-operations)
10. [Best Practices](#best-practices)

---

## Overview

Quiver uses **Supabase** as its backend platform, providing:

- **PostgreSQL 15+** with PostGIS extension for geospatial queries
- **Row Level Security (RLS)** for data access control
- **Real-time subscriptions** for live updates
- **Storage** for user media and images
- **Authentication** via Supabase Auth

### Key Files

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Core client factory functions |
| `lib/supabase/client.ts` | Browser client wrapper |
| `lib/supabase/server.ts` | Server client wrapper |
| `types/database.ts` | Type aliases and extended types |
| `types/database.generated.ts` | Auto-generated types from schema |
| `supabase/migrations/` | Database migration files |

---

## Client Configuration

### Client Types

Quiver provides three Supabase client types for different contexts:

#### 1. Browser Client (Client Components)

```typescript
// lib/supabase/client.ts
import { createClient } from "@/lib/supabase/client";

// Usage in client component
const supabase = createClient();
const { data, error } = await supabase.from("beaches").select("*");
```

#### 2. Server Client (Server Components / Server Actions)

```typescript
// lib/supabase/server.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Usage in server action
const supabase = await createSupabaseServerClient();
const { data, error } = await supabase.from("sessions").select("*");
```

#### 3. Service Role Client (Admin Operations)

```typescript
// lib/supabase/server.ts
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Bypasses RLS - use with caution
const supabase = await createSupabaseServiceRoleClient();
```

### Environment Variables

Required environment variables:

```bash
# Public (client-side accessible)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-side only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase Management API (Required for CLI & MCP)
SUPABASE_ACCESS_TOKEN=sbp_your_access_token_here
```

### SUPABASE_ACCESS_TOKEN

The `SUPABASE_ACCESS_TOKEN` is a **Personal Access Token (PAT)** for the Supabase Management API. This is different from the `ANON_KEY` or `SERVICE_ROLE_KEY`.

**How to get it:**
1. Go to [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
2. Click "Generate New Token"
3. Copy the token (starts with `sbp_`)
4. Add to your `.env` or `.env.local` file

**What it's used for:**

| Use Case | Description |
|----------|-------------|
| **Supabase CLI** | Required for `supabase login`, `supabase link`, `supabase db push` |
| **MCP Server** | Enables Claude/Cursor to inspect database schema via Supabase MCP |
| **CI/CD Workflows** | Database backups, migrations, schema diffing in GitHub Actions |
| **Type Generation** | Running `supabase gen types` to generate TypeScript types |

**Important Notes:**
- This token authenticates **you** (the developer), not the application
- Never commit this token to version control
- The token has access to all your Supabase projects
- For CI/CD, add as a GitHub secret: `SUPABASE_ACCESS_TOKEN`

**CLI Authentication:**
```bash
# Option 1: Export in shell
export SUPABASE_ACCESS_TOKEN="sbp_your_token_here"
supabase login --token "$SUPABASE_ACCESS_TOKEN"

# Option 2: Add to .env.local (auto-loaded by scripts/run-supabase-mcp.js)
# SUPABASE_ACCESS_TOKEN=sbp_your_token_here
```

---

## Database Schema

### Core Tables

#### profiles

User profile information linked to Supabase Auth.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | References auth.users.id |
| `email` | TEXT | User email |
| `full_name` | TEXT | Display name |
| `avatar_url` | TEXT | Profile picture URL |
| `home_beach_id` | UUID (FK) | User's home beach |
| `experience_level` | TEXT | beginner/intermediate/advanced |
| `is_admin` | BOOLEAN | Admin flag |
| `is_mock` | BOOLEAN | Test/mock account flag |
| `created_at` | TIMESTAMPTZ | Account creation time |

**Relationships**:
- `profiles.home_beach_id` -> `beaches.id`
- `profiles.favorite_spot_id` -> `beaches.id`

#### beaches

Surf spots with location and condition metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Beach identifier |
| `name` | TEXT | Beach name |
| `slug` | TEXT | URL-safe identifier |
| `lat` | DOUBLE PRECISION | Latitude |
| `lon` | DOUBLE PRECISION | Longitude |
| `geog` | GEOGRAPHY | PostGIS geography point |
| `city` | TEXT | City name |
| `state` | TEXT | State code (2-letter) |
| `country` | TEXT | Country |
| `region` | TEXT | Region identifier |
| `break_type` | TEXT | Beach break/point break/reef |
| `skill_level` | TEXT | Recommended skill level |
| `wind_offshore_deg` | DOUBLE PRECISION | Offshore wind direction |
| `swell_window_min_deg` | DOUBLE PRECISION | Optimal swell direction min |
| `swell_window_max_deg` | DOUBLE PRECISION | Optimal swell direction max |
| `preferred_tide_ft_min` | DOUBLE PRECISION | Optimal tide minimum |
| `preferred_tide_ft_max` | DOUBLE PRECISION | Optimal tide maximum |
| `average_rating` | DOUBLE PRECISION | Calculated average rating |
| `review_count` | INTEGER | Number of reviews |

**Key Indexes**:
- `idx_beaches_coordinates_gist` - GIST index on `geog` for nearest-beach queries
- `idx_beaches_name_trgm` - GIN trigram index for fuzzy search
- `idx_beaches_slug_trgm` - GIN trigram index for slug search

#### sessions

User surf sessions (logged or planned).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Session identifier |
| `user_id` | UUID (FK) | Session owner |
| `beach_id` | UUID (FK) | Beach location |
| `board_id` | UUID (FK) | Board used (nullable) |
| `arrival_time` | TIMESTAMPTZ | Session date/time |
| `duration_minutes` | INTEGER | Session length |
| `rating` | INTEGER | User rating (1-5) |
| `wave_height_ft` | DOUBLE PRECISION | Reported wave height |
| `wave_quality` | INTEGER | Wave quality rating |
| `crowd_level` | INTEGER | Crowd rating |
| `status` | TEXT | planned/completed/cancelled |
| `is_public` | BOOLEAN | Visibility flag |
| `notes` | TEXT | Session notes |
| `board_snapshot` | JSONB | Board details at session time |
| `likes_count` | INTEGER | Denormalized like count |
| `comments_count` | INTEGER | Denormalized comment count |

**Key Indexes**:
- `idx_sessions_user_rated_completed` - Composite index for personalization queries

#### boards

User surfboard inventory.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Board identifier |
| `user_id` | UUID (FK) | Board owner |
| `name` | TEXT | Board nickname |
| `board_type` | TEXT | shortboard/longboard/fish/etc |
| `dimensions` | TEXT | Dimensions string |
| `volume` | DOUBLE PRECISION | Volume in liters |
| `session_count` | INTEGER | Times used |

### Forecast Tables

#### enhanced_forecasts

Primary forecast data per beach/time.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Forecast identifier |
| `beach_id` | UUID (FK) | Beach reference |
| `forecast_date` | DATE | Forecast date |
| `forecast_time` | TIME | Forecast hour |
| `wave_height` | TEXT | Wave height range |
| `wave_period` | TEXT | Wave period |
| `wave_direction` | TEXT | Wave direction |
| `wind_speed` | TEXT | Wind speed |
| `wind_direction` | TEXT | Wind direction |
| `tide_height` | TEXT | Tide height |
| `tide_status` | TEXT | rising/falling/high/low |
| `confidence_score` | INTEGER | Forecast confidence |
| `data_source` | TEXT | NOAA_NWS/FALLBACK |
| `raw_forecast` | JSONB | Complete raw data |

**Unique Constraint**: `(beach_id, forecast_date, forecast_time)`

#### marine_forecasts

Raw marine data from external sources.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Forecast identifier |
| `beach_id` | UUID (FK) | Beach reference |
| `ts` | TIMESTAMPTZ | Forecast timestamp |
| `wave_height_m` | DOUBLE PRECISION | Wave height (meters) |
| `wave_period_s` | DOUBLE PRECISION | Wave period (seconds) |
| `wave_direction_deg` | DOUBLE PRECISION | Wave direction (degrees) |
| `wind_speed_ms` | DOUBLE PRECISION | Wind speed (m/s) |
| `wind_direction_deg` | DOUBLE PRECISION | Wind direction (degrees) |
| `source` | TEXT | Data source identifier |

#### tide_forecasts

Tide predictions per beach.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Forecast identifier |
| `beach_id` | UUID (FK) | Beach reference |
| `ts` | TIMESTAMPTZ | Tide timestamp |
| `tide_height_m` | DOUBLE PRECISION | Tide height (meters) |
| `tide_ft` | DOUBLE PRECISION | Tide height (feet) |
| `tide_phase` | TEXT | high/low/rising/falling |
| `source` | TEXT | Data source identifier |

### Social Tables

#### intel_posts

Community surf intel/reports.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Post identifier |
| `user_id` | UUID (FK) | Author |
| `beach_id` | UUID (FK) | Beach reference (nullable) |
| `latitude` | DOUBLE PRECISION | Post location lat |
| `longitude` | DOUBLE PRECISION | Post location lon |
| `title` | TEXT | Post title |
| `description` | TEXT | Post content |
| `tag` | ENUM | conditions/parking/hazard/crowd/access/other |
| `surf_conditions` | JSONB | Structured conditions data |
| `photo_url` | TEXT | Attached photo URL |
| `confirmations_count` | INTEGER | Community confirmations |
| `is_active` | BOOLEAN | Active flag |
| `expires_at` | TIMESTAMPTZ | Auto-expiration time |

**Enums**: `intel_post_tag` = 'conditions' | 'parking' | 'hazard' | 'crowd' | 'access' | 'other'

#### beach_reviews

User reviews of beaches.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Review identifier |
| `user_id` | UUID (FK) | Reviewer |
| `beach_id` | UUID (FK) | Beach reviewed |
| `title` | TEXT | Review title |
| `content` | TEXT | Review body |
| `overall_rating` | INTEGER | Overall (1-5) |
| `wave_quality_rating` | INTEGER | Wave quality (1-5) |
| `crowd_density_rating` | INTEGER | Crowd level (1-5) |
| `parking_rating` | INTEGER | Parking ease (1-5) |
| `accessibility_rating` | INTEGER | Access ease (1-5) |
| `visit_date` | DATE | Visit date |
| `helpful_count` | INTEGER | Helpful votes |

#### user_follows

Social following relationships.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Follow identifier |
| `follower_id` | UUID (FK) | Following user |
| `following_id` | UUID (FK) | Followed user |
| `created_at` | TIMESTAMPTZ | Follow timestamp |

**Unique Constraint**: `(follower_id, following_id)`

#### session_likes

Session like interactions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Like identifier |
| `session_id` | UUID (FK) | Liked session |
| `user_id` | UUID (FK) | User who liked |
| `created_at` | TIMESTAMPTZ | Like timestamp |

**Unique Constraint**: `(session_id, user_id)`

### Support Tables

#### favorite_beaches

User beach favorites/bookmarks.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Favorite identifier |
| `user_id` | UUID (FK) | User |
| `beach_id` | UUID (FK) | Favorited beach |
| `rank` | INTEGER | Display order |

#### session_forecast_snapshots

Captured forecast conditions at session time.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Snapshot identifier |
| `session_id` | UUID (FK) | Associated session |
| `user_id` | UUID (FK) | Session owner |
| `beach_id` | UUID (FK) | Session beach |
| `session_date` | DATE | Session date |
| `forecast_snapshot` | JSONB | Forecast at session time |
| `actual_conditions` | JSONB | User-reported conditions |
| `forecast_vs_actual` | JSONB | Comparison data |
| `forecast_confidence_score` | INTEGER | Confidence metric |

#### push_devices

Mobile push notification tokens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Device identifier |
| `user_id` | UUID (FK) | Device owner |
| `token` | TEXT | Push token |
| `platform` | TEXT | ios/android/web |
| `device` | TEXT | Device info |

---

## Data Access Patterns

### Using useDataFetcher Hook

The canonical pattern for data fetching in Quiver:

```typescript
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useCallback } from "react";

function MyComponent({ beachId }: { beachId: string }) {
  const fetchData = useCallback(async () => {
    const result = await getBeachById(beachId);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }, [beachId]);

  const { data, loading, error, refetch } = useDataFetcher(fetchData, {
    immediate: true,
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return <BeachCard beach={data} />;
}
```

### Server Action Pattern

Standard server action structure:

```typescript
// actions/beach-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withServerAction } from "@/lib/server-action-utils";

export async function getBeachById(beachId: string) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (error) throw error;
    return data;
  });
}
```

### Authenticated Action Pattern

For actions requiring user authentication:

```typescript
import { withAuthenticatedAction } from "@/lib/server-action-utils";

export const createSession = withAuthenticatedAction(
  async (userId, sessionData: SessionInsert) => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        ...sessionData,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
);
```

### Query with Relationships

Fetching data with related tables:

```typescript
const { data, error } = await supabase
  .from("sessions")
  .select(`
    *,
    beaches (*),
    boards (*),
    profiles (id, full_name, avatar_url)
  `)
  .eq("user_id", userId)
  .order("arrival_time", { ascending: false })
  .limit(10);
```

### Geospatial Queries

Finding nearby beaches using PostGIS:

```typescript
// Using RPC function
const { data, error } = await supabase
  .rpc("get_nearby_beaches", {
    user_lat: latitude,
    user_lon: longitude,
    radius_miles: 25,
    limit_count: 10,
  });

// Direct query with geography
const { data, error } = await supabase
  .from("beaches")
  .select("*")
  .not("geog", "is", null)
  .order("geog", {
    ascending: true,
    foreignTable: undefined,
    nullsFirst: false,
  });
```

---

## Row Level Security (RLS)

### Policy Patterns

#### Public Read, Owner Write

```sql
-- Anyone can read
CREATE POLICY "beaches_select_all" ON beaches
  FOR SELECT USING (true);

-- Only owner can modify
CREATE POLICY "sessions_update_own" ON sessions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
```

#### Owner-Only CRUD

```sql
CREATE POLICY "boards_select_own" ON boards
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "boards_insert_own" ON boards
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "boards_update_own" ON boards
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "boards_delete_own" ON boards
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
```

#### Performance-Optimized Auth

Always wrap `auth.uid()` in a subquery for better query planning:

```sql
-- GOOD: Wrapped in subquery
CREATE POLICY "example" ON table
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- BAD: Direct call (causes InitPlan issues)
CREATE POLICY "example" ON table
  FOR SELECT USING (auth.uid() = user_id);
```

### Security Views

Views must use `security_invoker`:

```sql
CREATE OR REPLACE VIEW public.profiles_with_home_beach
WITH (security_invoker = true) AS
SELECT p.*, b.name as home_beach_name
FROM profiles p
LEFT JOIN beaches b ON p.home_beach_id = b.id;
```

---

## TypeScript Types

### Auto-Generated Types

Types are generated from the database schema:

```bash
yarn db:types
```

This updates `types/database.generated.ts`.

### Type Aliases

Common type aliases in `types/database.ts`:

```typescript
import type { Database } from './database.generated';

// Table row types
export type Beach = Database['public']['Tables']['beaches']['Row'];
export type BeachInsert = Database['public']['Tables']['beaches']['Insert'];
export type BeachUpdate = Database['public']['Tables']['beaches']['Update'];

export type Session = Database['public']['Tables']['sessions']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Board = Database['public']['Tables']['boards']['Row'];
export type IntelPost = Database['public']['Tables']['intel_posts']['Row'];

// Enum types
export type IntelPostTag = Database['public']['Enums']['intel_post_tag'];
```

### Extended Types with Relationships

```typescript
export interface SessionWithDetails extends Session {
  beaches: Beach | null;
  boards: Board | null;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  featured_photo_url?: string | null;
}

export interface BeachWithReviews extends Beach {
  reviews: BeachReview[];
}

export interface IntelPostWithUser extends IntelPost {
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  user_has_confirmed?: boolean;
}
```

---

## Server Actions

### Action Result Pattern

All server actions return a consistent result type:

```typescript
interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Helper Utilities

```typescript
// lib/server-action-utils.ts

// Wrap any action with error handling
export function withServerAction<T>(
  action: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Require authentication
export function withAuthenticatedAction<T, Args extends any[]>(
  action: (userId: string, ...args: Args) => Promise<T>
) {
  return async (...args: Args): Promise<ActionResult<T>> => {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { success: false, error: "Authentication required" };
    }

    return withServerAction(() => action(user.id, ...args));
  };
}
```

### Example Actions

#### Beach Actions

```typescript
// actions/beach/beach-query-actions.ts
export async function getBeaches(options?: {
  limit?: number;
  state?: string;
  city?: string;
}) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("beaches")
      .select("*")
      .order("name");

    if (options?.state) {
      query = query.ilike("state", options.state);
    }
    if (options?.city) {
      query = query.ilike("city", options.city);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  });
}
```

#### Session Actions

```typescript
// actions/session-actions.ts
export async function getUserSessions(userId: string, limit?: number) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("sessions")
      .select(`
        *,
        beaches (*),
        boards (*),
        profiles (id, full_name, avatar_url)
      `)
      .eq("user_id", userId)
      .order("arrival_time", { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return data as SessionWithDetails[];
  });
}
```

---

## Real-time Subscriptions

### Basic Subscription

```typescript
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

function useSessionLikesRealtime(sessionId: string) {
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`session-likes-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_likes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLikesCount((prev) => prev + 1);
          } else if (payload.eventType === "DELETE") {
            setLikesCount((prev) => prev - 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return likesCount;
}
```

### Optimized Subscription Manager

See `hooks/use-optimized-realtime.ts` for batched subscription handling.

---

## Common Operations

### Insert with Select

```typescript
const { data, error } = await supabase
  .from("sessions")
  .insert({
    user_id: userId,
    beach_id: beachId,
    arrival_time: new Date().toISOString(),
    status: "planned",
  })
  .select()
  .single();
```

### Upsert

```typescript
const { data, error } = await supabase
  .from("favorite_beaches")
  .upsert(
    {
      user_id: userId,
      beach_id: beachId,
      rank: newRank,
    },
    {
      onConflict: "user_id,beach_id",
    }
  );
```

### Soft Delete

```typescript
const { error } = await supabase
  .from("sessions")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", sessionId)
  .eq("user_id", userId);
```

### Pagination

```typescript
const PAGE_SIZE = 20;

const { data, error, count } = await supabase
  .from("sessions")
  .select("*", { count: "exact" })
  .eq("user_id", userId)
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  .order("arrival_time", { ascending: false });
```

### Full-Text Search

```typescript
const { data, error } = await supabase
  .from("beaches")
  .select("*")
  .or(`name.ilike.%${query}%,city.ilike.%${query}%`);
```

### RPC Function Calls

```typescript
// Calling database functions
const { data, error } = await supabase.rpc("get_nearby_intel_posts", {
  center_lat: latitude,
  center_lng: longitude,
  radius_miles: 5,
  limit_count: 20,
});
```

---

## Best Practices

### 1. Always Use Server Actions for Mutations

```typescript
// GOOD: Server action
export const updateProfile = withAuthenticatedAction(
  async (userId, updates: ProfileUpdate) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
);

// BAD: Direct client-side mutation
const supabase = createClient();
await supabase.from("profiles").update(updates);
```

### 2. Type Your Queries

```typescript
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type TypedClient = SupabaseClient<Database>;

async function getBeach(supabase: TypedClient, id: string) {
  const { data, error } = await supabase
    .from("beaches")
    .select("*")
    .eq("id", id)
    .single();

  // data is properly typed as Beach | null
  return data;
}
```

### 3. Handle Errors Gracefully

```typescript
const { data, error } = await supabase
  .from("sessions")
  .select("*")
  .eq("id", sessionId)
  .single();

if (error) {
  if (error.code === "PGRST116") {
    // Not found
    return { success: false, error: "Session not found" };
  }
  // Log unexpected errors
  console.error("Database error:", error);
  return { success: false, error: "Failed to fetch session" };
}
```

### 4. Use Query Builders for Consistency

```typescript
// lib/supabase/query-builders.ts
export function withApprovedPhotos<T>(
  query: T,
  options: { includeDeleted?: boolean } = {}
): T {
  let filtered = query;
  filtered = filtered.eq("approved", true);
  if (!options.includeDeleted) {
    filtered = filtered.is("deleted_at", null);
  }
  return filtered;
}

// Usage
const query = withApprovedPhotos(
  supabase.from("beach_photos").select("*")
);
```

### 5. Respect Coordinate Conventions

Database uses `lat`/`lon` for beaches. Always map explicitly:

```typescript
// CORRECT: Explicit mapping
<MapComponent
  latitude={beach.lat}
  longitude={beach.lon}
/>

// WRONG: Assuming property names match
<MapComponent
  latitude={beach.latitude}  // Does not exist!
/>
```

### 6. Validate Before Insert

```typescript
import { z } from "zod";

const SessionSchema = z.object({
  beach_id: z.string().uuid(),
  arrival_time: z.string().datetime(),
  duration_minutes: z.number().min(0).max(480),
  rating: z.number().min(1).max(5).optional(),
});

export const createSession = withAuthenticatedAction(
  async (userId, input: unknown) => {
    const validated = SessionSchema.parse(input);
    // Proceed with validated data
  }
);
```

### 7. Batch Operations When Possible

```typescript
// GOOD: Single batch insert
const { error } = await supabase
  .from("favorite_beaches")
  .insert(
    beachIds.map((beachId, index) => ({
      user_id: userId,
      beach_id: beachId,
      rank: index,
    }))
  );

// BAD: Multiple individual inserts
for (const beachId of beachIds) {
  await supabase.from("favorite_beaches").insert({ ... });
}
```

### 8. Cache Where Appropriate

```typescript
// Server action with cache control
export async function getPopularBeaches() {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .order("review_count", { ascending: false })
      .limit(10);

    if (error) throw error;
    return data;
  });
}

// Use with Next.js caching in API route
export async function GET() {
  const result = await getPopularBeaches();
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
```

---

## Migration Guide

### Creating New Migrations

```bash
# Create new migration file
supabase migration new descriptive_migration_name
```

### Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Examples:
- `20260114120000_add_user_preferences.sql`
- `20260114130000_create_notifications_table.sql`

### Migration Template

```sql
-- Migration: descriptive_name
-- Purpose: Brief description of changes

BEGIN;

-- Add new table
CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_new_table_user_id ON new_table(user_id);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "new_table_select_own" ON new_table
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "new_table_insert_own" ON new_table
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;
```

---

## Related Documentation

- [supabase/ARCHITECTURE.md](/Users/stevenchandler/Desktop/quiver/supabase/ARCHITECTURE.md) - Migration history and patterns
- [hooks/ARCHITECTURE.md](/Users/stevenchandler/Desktop/quiver/hooks/ARCHITECTURE.md) - Data fetching hooks
- [docs/diagrams/database-schema.md](/Users/stevenchandler/Desktop/quiver/docs/diagrams/database-schema.md) - ERD diagrams
- [types/ARCHITECTURE.md](/Users/stevenchandler/Desktop/quiver/types/ARCHITECTURE.md) - TypeScript type system

---

## Quick Reference

### Import Paths

```typescript
// Supabase clients
import { createClient } from "@/lib/supabase/client";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Types
import type { Beach, Session, Profile, Board, IntelPost } from "@/types/database";

// Server action helpers
import { withServerAction, withAuthenticatedAction } from "@/lib/server-action-utils";

// Hooks
import { useDataFetcher } from "@/hooks/use-data-fetcher";
```

### Common Commands

```bash
# Generate types from database
yarn db:types

# Reset local database
yarn db:reset

# Create new migration
supabase migration new migration_name

# Run migrations locally
supabase db reset

# Push migrations to production
supabase db push
```
