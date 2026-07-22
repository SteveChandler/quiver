-- Repair Coach Picks after the hourly scoring views were retired.
-- Keep the existing RPC contract while ranking nearby public beaches by the
-- latest precomputed daily conditions score.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_coach_picks(
  _beach_id uuid,
  _radius_km numeric DEFAULT 80
)
RETURNS TABLE (
  pick_rank int,
  beach_id uuid,
  name text,
  distance_km numeric,
  score int
)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $function$
  WITH origin AS (
    SELECT b.lat, b.lon
    FROM public.beaches b
    WHERE b.id = _beach_id
      AND b.deleted_at IS NULL
      AND NOT b.is_private
  ),
  candidate_distances AS (
    SELECT
      b.id,
      b.name,
      (
        6371.0088 * 2 * asin(
          least(
            1.0,
            sqrt(
              power(sin(radians((b.lat - o.lat) / 2.0)), 2) +
              cos(radians(o.lat)) * cos(radians(b.lat)) *
              power(sin(radians((b.lon - o.lon) / 2.0)), 2)
            )
          )
        )
      )::numeric AS distance_km
    FROM public.beaches b
    CROSS JOIN origin o
    WHERE b.id <> _beach_id
      AND b.deleted_at IS NULL
      AND NOT b.is_private
  ),
  scored_candidates AS (
    SELECT
      candidate.id,
      candidate.name,
      candidate.distance_km,
      coalesce(latest_intel.conditions_score, 0)::int AS score
    FROM candidate_distances candidate
    LEFT JOIN LATERAL (
      SELECT intel.conditions_score
      FROM public.beach_daily_intel intel
      WHERE intel.beach_id = candidate.id
      ORDER BY intel.forecast_date DESC, intel.generated_at DESC
      LIMIT 1
    ) latest_intel ON true
    WHERE candidate.distance_km <= _radius_km
  )
  SELECT
    row_number() OVER (
      ORDER BY candidate.score DESC, candidate.distance_km ASC, candidate.id
    )::int AS pick_rank,
    candidate.id AS beach_id,
    candidate.name,
    candidate.distance_km,
    candidate.score
  FROM scored_candidates candidate
  ORDER BY pick_rank
  LIMIT 3;
$function$;

COMMENT ON FUNCTION public.get_coach_picks(uuid, numeric) IS
  'Returns the top three public beaches within a strict radius, ranked by each beach''s latest daily conditions score.';

REVOKE ALL ON FUNCTION public.get_coach_picks(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_picks(uuid, numeric)
  TO anon, authenticated, service_role;

COMMIT;
