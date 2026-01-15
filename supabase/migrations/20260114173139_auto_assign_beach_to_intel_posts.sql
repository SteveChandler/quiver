-- Auto-assign nearest beach to intel posts
-- Fixes "Unknown Beach" issue when posting intel via quick check-in
-- See: docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md

BEGIN;

-- 1. Create function to find nearest beach within radius
CREATE OR REPLACE FUNCTION find_nearest_beach_id(
  post_lat DECIMAL(10,8),
  post_lon DECIMAL(11,8),
  max_distance_meters DOUBLE PRECISION DEFAULT 3218.69  -- 2 miles
) RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
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
  FROM public.beaches b
  WHERE b.lat IS NOT NULL
    AND b.lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(b.lon, b.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography,
      max_distance_meters
    )
  ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(b.lon, b.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography
  )
  LIMIT 1;

  RETURN nearest_id;
END;
$$;

-- 2. Create trigger function to assign beach on insert
CREATE OR REPLACE FUNCTION assign_nearest_beach_to_intel_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign if beach_id is not already set
  IF NEW.beach_id IS NULL THEN
    NEW.beach_id := find_nearest_beach_id(NEW.latitude, NEW.longitude);
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create the trigger (drop first if exists for idempotency)
DROP TRIGGER IF EXISTS set_intel_post_beach_id ON public.intel_posts;

CREATE TRIGGER set_intel_post_beach_id
  BEFORE INSERT ON public.intel_posts
  FOR EACH ROW
  EXECUTE FUNCTION assign_nearest_beach_to_intel_post();

-- 4. Backfill existing posts that have NULL beach_id
UPDATE public.intel_posts
SET beach_id = find_nearest_beach_id(latitude, longitude),
    updated_at = now()
WHERE beach_id IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

COMMIT;
