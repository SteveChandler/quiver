-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Batching RPC consumed by Phase 2 Home/Explore match strips.
-- Replaces N client-side compute_user_match_score calls with a single
-- server-side call. Per `defensive-paid-api-batching` and memory
-- `feedback_scale_api_before_code.md`.
--
-- Candidate set:
--   1. User's saved beaches (favorite_beaches)
--   2. UNION beaches within p_radius_km of (p_device_lat, p_device_lon)
--      when both are non-null (PostGIS ST_DWithin on beaches.geog)
--   3. EXCLUDE p_exclude_beach_id if non-null (e.g. current hero beach)
--
-- Each candidate is scored via compute_user_match_score against its
-- latest enhanced_forecasts row (most recent forecast_at). Onboarding-
-- state results are dropped (strips don't show for <5-session users).

CREATE OR REPLACE FUNCTION public.get_user_match_candidates(
  p_user_id uuid,
  p_exclude_beach_id uuid DEFAULT NULL,
  p_device_lat double precision DEFAULT NULL,
  p_device_lon double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 50,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(beach jsonb, score numeric, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_have_device boolean := p_device_lat IS NOT NULL AND p_device_lon IS NOT NULL;
BEGIN
  RETURN QUERY
  WITH candidate_beaches AS (
    SELECT DISTINCT b.id, b.name, b.lat, b.lon
    FROM public.beaches b
    WHERE b.deleted_at IS NULL
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND b.id IN (
        -- Favorites
        SELECT fb.beach_id FROM public.favorite_beaches fb WHERE fb.user_id = p_user_id
        UNION
        -- Nearby (only if device coords provided)
        SELECT b2.id FROM public.beaches b2
        WHERE v_have_device
          AND b2.geog IS NOT NULL
          AND ST_DWithin(
            b2.geog,
            ST_SetSRID(ST_MakePoint(p_device_lon, p_device_lat), 4326)::geography,
            p_radius_km * 1000
          )
      )
  ),
  latest_forecast AS (
    SELECT DISTINCT ON (ef.beach_id)
      ef.beach_id,
      ef.wave_height,
      ef.wave_period,
      ef.wind_speed,
      ef.wind_direction,
      ef.tide_height
    FROM public.enhanced_forecasts ef
    WHERE ef.beach_id IN (SELECT id FROM candidate_beaches)
    ORDER BY ef.beach_id, ef.forecast_at DESC NULLS LAST
  ),
  scored AS (
    SELECT
      cb.id,
      cb.name,
      cb.lat,
      cb.lon,
      public.compute_user_match_score(
        p_user_id,
        cb.id,
        lf.wave_height,
        lf.wave_period,
        lf.wind_speed,
        lf.wind_direction,
        lf.tide_height
      ) AS result
    FROM candidate_beaches cb
    JOIN latest_forecast lf ON lf.beach_id = cb.id
  )
  SELECT
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'lat', s.lat,
      'lon', s.lon
    ) AS beach,
    (s.result->>'score')::numeric AS score,
    s.result->>'label' AS label
  FROM scored s
  WHERE s.result->>'state' = 'ready'
  ORDER BY (s.result->>'score')::numeric DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;

-- Allow authenticated callers (and service_role) to invoke the RPC. The
-- function is SECURITY DEFINER so RLS on underlying tables is bypassed
-- intentionally (the RPC only exposes public beach metadata + a score
-- computed from the caller's own sessions).
GRANT EXECUTE ON FUNCTION public.get_user_match_candidates(
  uuid, uuid, double precision, double precision, double precision, integer
) TO authenticated, service_role;
