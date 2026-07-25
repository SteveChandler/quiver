-- Store one privacy-bounded foreground location per user and one immutable
-- Weekend Scout ranking per weekend. Coordinates are replaced in place; no
-- location history is retained.

BEGIN;

CREATE TABLE public.user_location_snapshots (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 64),
  captured_at timestamptz NOT NULL,
  source text NOT NULL CHECK (
    source IN ('home', 'explore', 'week_scout', 'permission_recovery')
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_location_snapshots IS
  'Latest rounded foreground location for local surf forecasting. One replaceable row per user; no history.';
COMMENT ON COLUMN public.user_location_snapshots.lat IS
  'Latitude rounded to two decimals before storage.';
COMMENT ON COLUMN public.user_location_snapshots.lon IS
  'Longitude rounded to two decimals before storage.';

CREATE INDEX idx_user_location_snapshots_captured_at
  ON public.user_location_snapshots(captured_at);

ALTER TABLE public.user_location_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_location_snapshots_owner_select
  ON public.user_location_snapshots
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_location_snapshots_owner_delete
  ON public.user_location_snapshots
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_location_snapshots_service_role_all
  ON public.user_location_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.user_location_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.user_location_snapshots TO authenticated;
GRANT ALL ON TABLE public.user_location_snapshots TO service_role;

CREATE TABLE public.weekend_scout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekend_start date NOT NULL,
  weekend_end date NOT NULL,
  generated_at timestamptz NOT NULL,
  location_captured_at timestamptz NOT NULL,
  location_timezone text NOT NULL CHECK (length(location_timezone) BETWEEN 1 AND 64),
  max_drive_minutes integer NOT NULL CHECK (max_drive_minutes BETWEEN 1 AND 300),
  qualifying_count integer NOT NULL CHECK (qualifying_count BETWEEN 1 AND 3),
  lead_beach_id uuid NOT NULL REFERENCES public.beaches(id),
  lead_beach_name text NOT NULL CHECK (length(lead_beach_name) > 0),
  lead_window_local text NOT NULL CHECK (length(lead_window_local) > 0),
  scorer_version text NOT NULL CHECK (length(scorer_version) > 0),
  contract_version text NOT NULL CHECK (contract_version = 'weekend-scout-v1'),
  rankings jsonb NOT NULL CHECK (jsonb_typeof(rankings) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekend_scout_snapshots_user_weekend_unique
    UNIQUE (user_id, weekend_start),
  CONSTRAINT weekend_scout_snapshots_two_day_window
    CHECK (weekend_end = weekend_start + 1)
);

COMMENT ON TABLE public.weekend_scout_snapshots IS
  'Immutable top-three Weekend Scout alert evidence. One snapshot per user and Saturday date.';

CREATE INDEX idx_weekend_scout_snapshots_weekend_user
  ON public.weekend_scout_snapshots(weekend_start, user_id);

ALTER TABLE public.weekend_scout_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekend_scout_snapshots_owner_select
  ON public.weekend_scout_snapshots
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY weekend_scout_snapshots_service_role_select
  ON public.weekend_scout_snapshots
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY weekend_scout_snapshots_service_role_insert
  ON public.weekend_scout_snapshots
  FOR INSERT
  TO service_role
  WITH CHECK (true);

REVOKE ALL ON TABLE public.weekend_scout_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.weekend_scout_snapshots TO authenticated;
GRANT SELECT, INSERT ON TABLE public.weekend_scout_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.get_weekend_scout_candidates(
  input_user_id uuid,
  input_lat double precision,
  input_lon double precision,
  max_distance_meters integer,
  limit_count integer DEFAULT 1000
)
RETURNS TABLE(
  id uuid,
  distance_meters double precision,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(input_lon, input_lat), 4326)::geography AS geog
    WHERE input_lat BETWEEN -90 AND 90
      AND input_lon BETWEEN -180 AND 180
      AND max_distance_meters > 0
  ),
  eligible AS (
    SELECT
      b.id,
      ST_Distance(b.geog, origin.geog) AS distance_meters
    FROM public.beaches b
    CROSS JOIN origin
    WHERE b.geog IS NOT NULL
      AND b.is_private IS NOT TRUE
      AND b.deleted_at IS NULL
      AND ST_DWithin(b.geog, origin.geog, max_distance_meters)
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_beach_exclusions ube
        WHERE ube.user_id = input_user_id
          AND ube.beach_id = b.id
      )
  ),
  counted AS (
    SELECT
      eligible.id,
      eligible.distance_meters,
      count(*) OVER () AS total_count
    FROM eligible
  )
  SELECT counted.id, counted.distance_meters, counted.total_count
  FROM counted
  ORDER BY counted.distance_meters ASC, counted.id ASC
  LIMIT LEAST(GREATEST(limit_count, 1), 1000);
$function$;

COMMENT ON FUNCTION public.get_weekend_scout_candidates(
  uuid,
  double precision,
  double precision,
  integer,
  integer
) IS 'Returns all non-hidden beaches in current-location range, plus total count for truncation detection.';

REVOKE ALL ON FUNCTION public.get_weekend_scout_candidates(
  uuid,
  double precision,
  double precision,
  integer,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekend_scout_candidates(
  uuid,
  double precision,
  double precision,
  integer,
  integer
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
