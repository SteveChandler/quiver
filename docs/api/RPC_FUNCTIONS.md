# Supabase RPC Functions Reference

> PostgreSQL stored procedures accessible via Supabase RPC.

## Overview

Quiver uses Supabase RPC functions for:
- Complex queries that benefit from server-side execution
- Operations requiring `SECURITY DEFINER` (elevated privileges)
- Batch operations and maintenance tasks
- Geospatial calculations

## Calling RPC Functions

### From TypeScript

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Note: createSupabaseServerClient is async (Next.js 15+ compatibility)
const supabase = await createSupabaseServerClient();

// Call RPC function
const { data, error } = await supabase.rpc('function_name', {
  param1: 'value1',
  param2: 'value2'
});

if (error) {
  console.error('RPC error:', error);
}
```

### From Server Actions

```typescript
'use server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function myAction() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('function_name', { param: 'value' });
  return { data, error };
}
```

---

## Content Functions

### get_city_editorial

Fetch editorial content for city landing pages.

**Signature:**
```sql
get_city_editorial(
  p_city TEXT,
  p_state TEXT DEFAULT 'ca',
  p_country TEXT DEFAULT 'usa'
) RETURNS city_editorial_content
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `p_city` | TEXT | (required) | City slug (e.g., "san-diego") |
| `p_state` | TEXT | 'ca' | State slug (2-letter code) |
| `p_country` | TEXT | 'usa' | Country slug |

**Returns:** Single row from `city_editorial_content` table or NULL

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_city_editorial', {
  p_city: 'san-diego',
  p_state: 'ca',
  p_country: 'usa'
});

// data: { id, city_name, description[], session_timing[], ... }
```

**Source:** `20251204030000_create_city_editorial_content.sql`

---

## Geospatial Functions

### get_nearby_beaches

Find beaches within a radius of given coordinates.

**Signature:**
```sql
get_nearby_beaches(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  max_distance_km DOUBLE PRECISION DEFAULT 50,
  result_limit INTEGER DEFAULT 20
) RETURNS TABLE(...)
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `user_lat` | DOUBLE PRECISION | (required) | User latitude |
| `user_lon` | DOUBLE PRECISION | (required) | User longitude |
| `max_distance_km` | DOUBLE PRECISION | 50 | Search radius in km |
| `result_limit` | INTEGER | 20 | Max results to return |

**Returns:** Table with beach data and `distance_km` column

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_nearby_beaches', {
  user_lat: 32.7503,
  user_lon: -117.2534,
  max_distance_km: 30,
  result_limit: 10
});

// data: [{ id, name, slug, lat, lon, distance_km, ... }]
```

**Performance:** Uses PostGIS geography index for efficient spatial queries.

**Source:** `20250904000002_add_beaches_geog_and_update_get_nearby_beaches.sql`

### get_nearby_intel_posts

Find community intel posts near a location.

**Signature:**
```sql
get_nearby_intel_posts(
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000,
  post_limit INTEGER DEFAULT 50
) RETURNS TABLE(...)
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `lat` | DOUBLE PRECISION | (required) | Center latitude |
| `lon` | DOUBLE PRECISION | (required) | Center longitude |
| `radius_meters` | INTEGER | 5000 | Search radius in meters |
| `post_limit` | INTEGER | 50 | Max posts to return |

**Returns:** Intel posts with distance, ordered by recency

**Source:** `20250825000005_fix_remaining_security_warnings.sql`

---

## Forecast Functions

### get_best_times

Calculate optimal surf times for a beach.

**Signature:**
```sql
get_best_times(
  p_beach_id UUID,
  p_hours_ahead INTEGER DEFAULT 48
) RETURNS TABLE(...)
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `p_beach_id` | UUID | (required) | Beach UUID |
| `p_hours_ahead` | INTEGER | 48 | Hours to look ahead |

**Returns:** Table with hourly time slots and quality scores

**Columns:**
- `ts_utc` - Timestamp
- `score_0_100` - Quality score (0-100)
- `hs_m` - Wave height (meters)
- `tp_s` - Wave period (seconds)
- `wind_spd_kts` - Wind speed (knots)
- `tide_ft` - Tide height (feet)

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_best_times', {
  p_beach_id: 'beach-uuid-here',
  p_hours_ahead: 24
});

// data: [{ ts_utc, score_0_100, hs_m, tp_s, ... }]
```

**Source:** `20250812161000_create_get_best_times.sql`

### refresh_enhanced_forecasts_for_active_beaches

Refresh forecast data for beaches with recent activity.

**Signature:**
```sql
refresh_enhanced_forecasts_for_active_beaches()
RETURNS INTEGER
```

**Returns:** Count of beaches refreshed

**Usage:** Called by cron job at 6 AM daily

**Security:** `SECURITY DEFINER` - executes with elevated privileges

**Source:** `20251202100000_fix_forecast_refresh_column_names.sql`

---

## Location Functions

### get_beaches_by_location_with_scores

Fetch beaches for a city with session counts and ratings.

**Signature:**
```sql
get_beaches_by_location_with_scores(
  p_city TEXT,
  p_state TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'usa'
) RETURNS TABLE(...)
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `p_city` | TEXT | (required) | City name (case-insensitive) |
| `p_state` | TEXT | NULL | State code |
| `p_country` | TEXT | 'usa' | Country code |

**Returns:** Beaches with aggregated stats

**Columns:**
- All beach columns (includes location ranking coordinates as `lat` and `lon` — not `lng`)
- `session_count` - Number of logged sessions
- `average_rating` - Average user rating
- `review_count` - Number of reviews

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_beaches_by_location_with_scores', {
  p_city: 'San Diego',
  p_state: 'CA'
});

// data: [{ id, name, slug, session_count, average_rating, ... }]
```

**Source:** `20251204120000_case_insensitive_location_search.sql`

### get_location_stats

Get aggregate statistics for a location.

**Signature:**
```sql
get_location_stats(
  p_city TEXT,
  p_state TEXT DEFAULT NULL
) RETURNS TABLE(...)
```

**Returns:**
- `beach_count` - Total beaches
- `total_sessions` - All logged sessions
- `active_users` - Users with recent sessions

**Source:** `20251204120000_case_insensitive_location_search.sql`

---

## User Functions

### get_user_activity_feed

Fetch personalized activity feed for a user.

**Signature:**
```sql
get_user_activity_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE(...)
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `p_user_id` | UUID | (required) | User UUID |
| `p_limit` | INTEGER | 50 | Max activities |

**Returns:** Activity items from followed users and own sessions

**Source:** `20250825000005_fix_remaining_security_warnings.sql`

### get_most_visited_beach

Get user's most frequently visited beach.

**Signature:**
```sql
get_most_visited_beach() RETURNS UUID
```

**Returns:** Beach UUID or NULL

**Security:** Uses `auth.uid()` to get current user

**Source:** `20250825000005_fix_remaining_security_warnings.sql`

---

## Social Functions

### update_follow_counts

Update follower/following counts after follow/unfollow.

**Signature:**
```sql
update_follow_counts() RETURNS TRIGGER
```

**Type:** Trigger function (called automatically)

**Triggers on:** `user_follows` table INSERT/DELETE

**Source:** `20250825000005_fix_remaining_security_warnings.sql`

### increment_session_share_count

Increment share count for a session.

**Signature:**
```sql
increment_session_share_count(session_id UUID) RETURNS VOID
```

**Usage:**
```typescript
await supabase.rpc('increment_session_share_count', {
  session_id: 'session-uuid'
});
```

**Source:** `20251031211518_add_increment_share_count_function.sql`

---

## Maintenance Functions

### cleanup_old_forecasts

Remove forecast data older than retention period.

**Signature:**
```sql
cleanup_old_forecasts(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
```

**Returns:** Count of rows deleted

**Source:** `20250816130000_add_maintenance_functions.sql`

### cleanup_old_activities

Remove old activity feed entries.

**Signature:**
```sql
cleanup_old_activities(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
```

**Source:** `20250825000005_fix_remaining_security_warnings.sql`

### cleanup_inactive_buoys

Deactivate buoys without recent data.

**Signature:**
```sql
cleanup_inactive_buoys(inactive_days INTEGER DEFAULT 7)
RETURNS INTEGER
```

**Source:** `20250816130000_add_maintenance_functions.sql`

### check_database_health

Run database health diagnostics.

**Signature:**
```sql
check_database_health() RETURNS TABLE(
  metric TEXT,
  value TEXT,
  status TEXT
)
```

**Returns:** Health metrics for monitoring

**Source:** `20250816130000_add_maintenance_functions.sql`

### run_database_maintenance

Execute all maintenance tasks.

**Signature:**
```sql
run_database_maintenance(
  retention_days INTEGER DEFAULT 30,
  inactive_buoy_days INTEGER DEFAULT 7
) RETURNS TABLE(task TEXT, result TEXT)
```

**Source:** `20250816130000_add_maintenance_functions.sql`

---

## Materialized View Functions

### refresh_mv_beach_hourly_scores

Refresh the beach hourly scores materialized view.

**Signature:**
```sql
refresh_mv_beach_hourly_scores() RETURNS VOID
```

**Usage:** Called by cron job every 2 hours

**Refreshes:** `mv_beach_hourly_scores` view

**Source:** `20250820140000_update_refresh_mv_beach_hourly_scores.sql`

### refresh_mv_best_times

Refresh the best times materialized view.

**Signature:**
```sql
refresh_mv_best_times() RETURNS VOID
```

**Refreshes:** `mv_best_times` view

**Source:** `20250812170000_create_mv_best_times.sql`

---

## Trigger Functions

These functions are automatically called by database triggers:

| Function | Trigger Table | Event |
|----------|---------------|-------|
| `update_beach_affinity_on_session_change` | `sessions` | INSERT/UPDATE/DELETE |
| `handle_new_user` | `auth.users` | INSERT |
| `add_session_owner_as_participant` | `sessions` | INSERT |
| `handle_invitation_acceptance` | `session_invitations` | UPDATE |
| `create_beach_review_activity` | `beach_reviews` | INSERT |
| `create_follow_activity` | `user_follows` | INSERT |
| `update_user_storage_usage` | `session_media` | INSERT/DELETE |

---

## Utility Functions

### format_coordinates

Format coordinates for display.

**Signature:**
```sql
format_coordinates(
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  precision INTEGER DEFAULT 4
) RETURNS TEXT
```

**Example:** `format_coordinates(32.7503, -117.2534)` → `"32.7503°N, 117.2534°W"`

### direction_to_compass

Convert degrees to compass direction.

**Signature:**
```sql
direction_to_compass(degrees DOUBLE PRECISION) RETURNS TEXT
```

**Example:** `direction_to_compass(270)` → `"W"`

### increment / decrement

Simple increment/decrement helpers.

**Signatures:**
```sql
increment(val INTEGER, amount INTEGER DEFAULT 1) RETURNS INTEGER
decrement(val INTEGER, amount INTEGER DEFAULT 1) RETURNS INTEGER
```

---

## Security Considerations

### SECURITY DEFINER Functions

These functions run with elevated privileges:

- `update_beach_affinity_on_session_change`
- `refresh_enhanced_forecasts_for_active_beaches`
- `cleanup_old_forecasts`
- `handle_new_user`

**Note:** All SECURITY DEFINER functions include `SET search_path = public` to prevent SQL injection.

### RLS Bypass

Some functions bypass Row Level Security for maintenance operations. These are restricted to:
- Service role calls
- Cron job execution
- Admin users

---

## Related Documentation

- [API Overview](README.md) - API architecture
- [Server Actions](SERVER_ACTIONS.md) - TypeScript server actions
- [Supabase Architecture](/supabase/ARCHITECTURE.md) - Database design
- [Coverage Areas](/docs/COVERAGE_AREAS.md) - Geographic coverage

---

**Last Updated:** December 2025
