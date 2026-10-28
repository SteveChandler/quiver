BEGIN;

-- Soft retire for boards. sessions.board_id references boards(id) with no ON DELETE
-- action, so hard-deleting a board that has a logged session fails with 23503.
-- Retiring sets retired_at instead: lists of a user's boards and the 10-board cap
-- ignore retired boards, while reads by board id (a session's board) keep working.
--
-- Function bodies below are copied from the live pg_get_functiondef output on
-- 2026-10-28; the only change in each is the retired_at IS NULL filter.
--
-- Rollback: re-create the three functions without the retired_at filter, then
-- DROP INDEX public.idx_boards_user_id_active; ALTER TABLE public.boards DROP COLUMN retired_at;
-- (only after every client stops reading or writing retired_at).

ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS retired_at timestamptz;

COMMENT ON COLUMN public.boards.retired_at
  IS 'When the owner retired the board. Retired boards drop out of board lists and the 10-board cap; sessions keep referencing them.';

CREATE INDEX IF NOT EXISTS idx_boards_user_id_active
  ON public.boards (user_id)
  WHERE retired_at IS NULL;

CREATE OR REPLACE FUNCTION private.enforce_user_board_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  existing_board_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT count(*)
  INTO existing_board_count
  FROM public.boards
  WHERE user_id = NEW.user_id
    AND retired_at IS NULL;

  IF existing_board_count >= 10 THEN
    RAISE EXCEPTION 'board_limit_reached'
      USING
        ERRCODE = '23514',
        DETAIL = 'user_board_limit_10',
        HINT = 'Retire a board before adding another.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_user_board_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.enforce_user_board_limit() FROM anon;
REVOKE ALL ON FUNCTION private.enforce_user_board_limit() FROM authenticated;

COMMENT ON FUNCTION private.enforce_user_board_limit()
  IS 'Enforces the app-wide limit of 10 active (not retired) boards per user before inserts.';

CREATE OR REPLACE FUNCTION public.get_user_board_deck_stats(p_user_id uuid)
 RETURNS TABLE(board_id uuid, sessions_count integer, positive_sessions_count integer, best_period_range text, best_wind_label text, learned_label text, last_used_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only query own board stats';
  END IF;

  RETURN QUERY
  WITH board_base AS (
    SELECT b.id AS board_id
    FROM public.boards b
    WHERE b.user_id = p_user_id
      AND b.retired_at IS NULL
  ),
  session_base AS (
    SELECT
      s.board_id,
      s.id AS session_id,
      s.rating,
      s.arrival_time,
      s.custom_spot_id,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period_s,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed_mph,
      public.parse_numeric_from_text(COALESCE(
        sfs.forecast_snapshot->>'wind_direction_deg',
        sfs.forecast_snapshot->>'wind_direction'
      )) AS wind_direction_deg
    FROM public.sessions s
    LEFT JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    WHERE s.user_id = p_user_id
      AND s.board_id IS NOT NULL
      AND s.status = 'completed'
      AND s.deleted_at IS NULL
  ),
  positive AS (
    SELECT *
    FROM session_base
    WHERE rating >= 4
  ),
  aggregate_stats AS (
    SELECT
      bb.board_id,
      COUNT(sb.session_id)::integer AS sessions_count,
      COUNT(p.session_id)::integer AS positive_sessions_count,
      MAX(sb.arrival_time) AS last_used_at,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY p.wave_period_s)
        FILTER (WHERE p.wave_period_s IS NOT NULL) AS p25_period,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY p.wave_period_s)
        FILTER (WHERE p.wave_period_s IS NOT NULL) AS p75_period,
      AVG(p.wind_speed_mph) FILTER (WHERE p.wind_speed_mph IS NOT NULL) AS avg_wind_speed,
      AVG(
        CASE
          WHEN cs.offshore_direction_deg IS NULL OR p.wind_direction_deg IS NULL THEN NULL
          ELSE LEAST(
            ABS(cs.offshore_direction_deg - p.wind_direction_deg),
            360 - ABS(cs.offshore_direction_deg - p.wind_direction_deg)
          )
        END
      ) FILTER (WHERE cs.offshore_direction_deg IS NOT NULL AND p.wind_direction_deg IS NOT NULL) AS avg_offshore_delta
    FROM board_base bb
    LEFT JOIN session_base sb ON sb.board_id = bb.board_id
    LEFT JOIN positive p ON p.board_id = bb.board_id
    LEFT JOIN public.custom_spots cs ON cs.id = p.custom_spot_id
    GROUP BY bb.board_id
  )
  SELECT
    a.board_id,
    COALESCE(a.sessions_count, 0),
    COALESCE(a.positive_sessions_count, 0),
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 OR a.p25_period IS NULL OR a.p75_period IS NULL THEN NULL
      ELSE format('Best: %s-%ss', round(a.p25_period)::integer, round(a.p75_period)::integer)
    END AS best_period_range,
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 THEN NULL
      WHEN a.avg_offshore_delta IS NOT NULL AND a.avg_offshore_delta <= 45 THEN 'Light offshore'
      WHEN a.avg_offshore_delta IS NOT NULL AND a.avg_offshore_delta <= 75 THEN 'Clean side-off'
      WHEN a.avg_wind_speed IS NULL THEN NULL
      WHEN a.avg_wind_speed <= 7 THEN 'Light wind'
      WHEN a.avg_wind_speed <= 12 THEN 'Handles texture'
      ELSE 'Wind tolerant'
    END AS best_wind_label,
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 THEN 'Learning this board'
      ELSE 'Learned from sessions'
    END AS learned_label,
    a.last_used_at
  FROM aggregate_stats a;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_board_deck_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_board_deck_stats(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_bulk_forecast_decision_context(p_user_id uuid, p_beach_ids uuid[], p_slots jsonb, p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH runs AS MATERIALIZED (
  (SELECT r.* FROM public.county_beach_advisory_runs r
    WHERE source_identifier = 'county-san-diego-dehq-sdbeachinfo'
    ORDER BY fetched_at DESC LIMIT 1)
  UNION
  (SELECT r.* FROM public.county_beach_advisory_runs r
    WHERE source_identifier = 'county-san-diego-dehq-sdbeachinfo' AND status = 'completed'
    ORDER BY fetched_at DESC LIMIT 1)
)
SELECT jsonb_build_object(
  'beaches', (SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]') FROM (
    SELECT id, name, slug, lat, lon,
      city, state, country, region, timezone,
      break_type, skill_level, cdip_station, cdip_eligible, wind_offshore_deg,
      wind_offshore_tol_deg, wind_cross_shore_ok_kt, wind_onshore_bad_kt, swell_window_center_deg, swell_window_halfwidth_deg,
      swell_access_factors, wind_exposure_factors, preferred_tide_direction, preferred_tide_ft_min, preferred_tide_ft_max,
      tide_direction_sensitivity, preference_model, features, hazards, average_rating,
      review_count, shoaling_factors FROM public.beaches
    WHERE id = ANY(p_beach_ids) AND (NOT coalesce(is_private, false) OR owner_id = p_user_id)) b),
  'profile', (SELECT jsonb_build_object('experience_level',experience_level) FROM public.profiles WHERE id=p_user_id),
  'boards', (SELECT coalesce(jsonb_agg(jsonb_build_object('board_type',board_type)), '[]') FROM public.boards WHERE user_id=p_user_id AND retired_at IS NULL),
  'sun_times', (SELECT coalesce(jsonb_agg(jsonb_build_object('beach_id',beach_id,
    'sunrise_utc',sunrise_utc,'sunset_utc',sunset_utc) ORDER BY sunrise_utc), '[]')
    FROM public.sun_times WHERE beach_id=ANY(p_beach_ids) AND date BETWEEN p_start AND p_end),
  'personalization', CASE WHEN p_user_id IS NOT NULL THEN
    public.get_week_scout_personalization(p_user_id,p_beach_ids,p_slots) ELSE NULL END,
  'water_quality', jsonb_build_object(
    'beach_water_quality', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]') FROM public.beach_water_quality w WHERE beach_id=ANY(p_beach_ids)),
    'water_quality_held_beaches', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]') FROM public.water_quality_held_beaches w WHERE beach_id=ANY(p_beach_ids)),
    'county_beach_advisory_runs', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') FROM runs r),
    'county_beach_advisories', (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]') FROM public.county_beach_advisories a
      WHERE run_id IN (SELECT id FROM runs) AND beach_id=ANY(p_beach_ids))
  )
);
$function$;

REVOKE ALL ON FUNCTION public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date) TO service_role;

COMMIT;
