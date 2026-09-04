BEGIN;

CREATE OR REPLACE FUNCTION public.get_weekend_scout_candidates_page(
  input_user_id uuid,
  input_lat double precision,
  input_lon double precision,
  max_distance_meters integer,
  offset_count integer DEFAULT 0,
  limit_count integer DEFAULT 500
)
RETURNS TABLE(id uuid, distance_meters double precision, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(input_lon, input_lat), 4326)::geography AS geog
    WHERE input_lat BETWEEN -90 AND 90
      AND input_lon BETWEEN -180 AND 180
      AND max_distance_meters > 0
  ), eligible AS (
    SELECT b.id,
      ST_Distance(b.geog, origin.geog) AS distance_meters
    FROM public.beaches b
    CROSS JOIN origin
    WHERE b.is_private IS NOT TRUE
      AND b.deleted_at IS NULL
      AND b.recommendation_eligible
      AND b.geog IS NOT NULL
      AND ST_DWithin(b.geog, origin.geog, max_distance_meters)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_beach_exclusions e
        WHERE e.user_id = input_user_id AND e.beach_id = b.id
      )
  ), counted AS (
    SELECT *, count(*) OVER () AS total_count FROM eligible
  )
  SELECT counted.id, counted.distance_meters, counted.total_count
  FROM counted
  ORDER BY counted.distance_meters ASC, counted.id ASC
  OFFSET GREATEST(offset_count, 0)
  LIMIT LEAST(GREATEST(limit_count, 1), 1000);
$function$;

REVOKE ALL ON FUNCTION public.get_weekend_scout_candidates_page(uuid, double precision, double precision, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekend_scout_candidates_page(uuid, double precision, double precision, integer, integer, integer)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
