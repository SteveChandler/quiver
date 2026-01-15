# Auto-Assign Beach to Intel Posts

**Date:** 2026-01-14
**Status:** Ready for implementation

## Problem

When users post intel via quick check-in, the API stores lat/lon coordinates but never finds or assigns the nearest beach. The `beach_id` stays NULL, causing posts to display "Unknown Beach" even when posted at well-known spots like La Jolla Shores.

## Solution

Add a database trigger that automatically finds and assigns the nearest beach when intel posts are created, plus backfill existing posts.

## Design

### 1. Core Function: `find_nearest_beach_id`

```sql
CREATE OR REPLACE FUNCTION find_nearest_beach_id(
  post_lat DECIMAL(10,8),
  post_lon DECIMAL(11,8),
  max_distance_meters DOUBLE PRECISION DEFAULT 3218.69  -- 2 miles
) RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  nearest_id UUID;
BEGIN
  -- Validate input coordinates
  IF post_lat IS NULL OR post_lon IS NULL
     OR post_lat = 0 OR post_lon = 0
     OR post_lat < -90 OR post_lat > 90
     OR post_lon < -180 OR post_lon > 180 THEN
    RETURN NULL;
  END IF;

  SELECT b.id INTO nearest_id
  FROM beaches b
  WHERE b.geog IS NOT NULL
    AND ST_DWithin(
      b.geog,  -- Pre-computed geography column with GiST index
      ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography,
      max_distance_meters
    )
  ORDER BY ST_Distance(
    b.geog,
    ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography
  )
  LIMIT 1;

  RETURN nearest_id;
END;
$$;
```

### 2. Trigger Function: `assign_nearest_beach_to_intel_post`

```sql
CREATE OR REPLACE FUNCTION assign_nearest_beach_to_intel_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only assign if beach_id is not already set
  IF NEW.beach_id IS NULL THEN
    NEW.beach_id := find_nearest_beach_id(NEW.latitude, NEW.longitude);
  END IF;

  RETURN NEW;
END;
$$;
```

### 3. Trigger: `set_intel_post_beach_id`

```sql
CREATE TRIGGER set_intel_post_beach_id
  BEFORE INSERT ON intel_posts
  FOR EACH ROW
  EXECUTE FUNCTION assign_nearest_beach_to_intel_post();
```

### 4. Backfill Existing Posts

```sql
UPDATE intel_posts
SET beach_id = find_nearest_beach_id(latitude, longitude)
WHERE beach_id IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;
```

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| No beach within 2 miles | Returns NULL → displays "Unknown Beach" (correct) |
| Multiple equidistant beaches | ORDER BY distance LIMIT 1 - deterministic |
| Beach missing coordinates | Filtered out (WHERE geog IS NOT NULL) |
| Invalid user coordinates | Validation returns NULL early |
| GPS drift | 2-mile radius handles typical 50-200m error |
| Offshore posts | Matches nearest coastal beach within radius |

## Testing

1. Create intel post at known beach location → verify beach_id is set
2. Create intel post far from any beach → verify beach_id stays NULL
3. Verify existing orphaned posts get backfilled
4. Verify posts with pre-set beach_id are not overwritten

## Migration File

`supabase/migrations/YYYYMMDDHHMMSS_auto_assign_beach_to_intel_posts.sql`

## Rollback

```sql
DROP TRIGGER IF EXISTS set_intel_post_beach_id ON intel_posts;
DROP FUNCTION IF EXISTS assign_nearest_beach_to_intel_post();
DROP FUNCTION IF EXISTS find_nearest_beach_id(DECIMAL, DECIMAL, DOUBLE PRECISION);
-- Note: Backfilled beach_id values will remain (no harm)
```
