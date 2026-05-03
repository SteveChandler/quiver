-- Backfill: documents prod state of public.get_user_match_candidates as of
-- 2026-05-03. The function was first deployed to prod out-of-band (no migration
-- file in this repo); this file retroactively brings it under version control
-- so local `supabase db reset` works and the migration history is complete.
--
-- IMPORTANT: this body intentionally contains the POST-FIX corrected version
-- (the latest_forecast CTE selects `(ef.wind_direction_deg)::text AS
-- wind_direction`, not the buggy `ef.wind_direction`). The buggy version
-- produced score 0 for any non-numeric wind direction text label and was the
-- reason for hotfix migration 20260503160458_fix_get_user_match_candidates_wind_direction.
--
-- Why backfill the FIXED body instead of the original buggy body:
--   This file's timestamp is OLDER than the hotfix. If we backfilled the buggy
--   body, then on a fresh `supabase db push` against any environment that
--   already has 20260503160458 marked applied (e.g. prod after the hotfix),
--   the backfill would run as a NEW migration and overwrite the fix with the
--   buggy body, while the hotfix would not re-run (already applied) — silent
--   regression. Backfilling the corrected state is idempotent against prod
--   and leaves the hotfix migration as a no-op CREATE OR REPLACE on replay.
--
-- The companion hotfix migration is preserved as-is for git/history clarity:
-- the commit explains what changed, even though the file is now functionally
-- a no-op against this backfill.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_match_candidates(p_user_id uuid, p_exclude_beach_id uuid DEFAULT NULL::uuid, p_device_lat double precision DEFAULT NULL::double precision, p_device_lon double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 50, p_limit integer DEFAULT 5)
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
        SELECT fb.beach_id FROM public.favorite_beaches fb WHERE fb.user_id = p_user_id
        UNION
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
      (ef.wind_direction_deg)::text AS wind_direction,
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

GRANT EXECUTE ON FUNCTION public.get_user_match_candidates(uuid, uuid, double precision, double precision, double precision, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_match_candidates(uuid, uuid, double precision, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_match_candidates(uuid, uuid, double precision, double precision, double precision, integer) TO service_role;

COMMIT;
