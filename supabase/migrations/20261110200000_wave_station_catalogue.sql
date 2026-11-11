-- Public wave-station catalogue (phase 1 of the free buoy pages).
--
-- New, separate tables. The forecast pipeline reads ndbc_direct_*, ioos_*,
-- unified_wave_observations, observable_beaches and beach_observation_stations;
-- none of those are touched here, so no forecast changes. About 150 stations
-- are stored twice (here and in ndbc_direct/ioos); that is accepted.
--
-- Writers: /api/cron/wave-stations-sync (service role) through the functions
-- below. Readers: public pages with the anon client.
-- Retention: observations older than 180 days are pruned by the cron in
-- bounded batches (prune_wave_station_observations).

BEGIN;

CREATE TABLE IF NOT EXISTS public.wave_stations (
  id text PRIMARY KEY,                       -- '{source}:{source_station_id}', e.g. 'ndbc:46225'
  source text NOT NULL,                      -- 'ndbc', 'marine_ie', 'aodn', 'fmi', 'smhi' (WaveStationSource)
  source_station_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,                        -- stable once assigned; the sync never rewrites it
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  region text,                               -- US state/territory code when known
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  geog geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) STORED,
  station_type text,
  owner text,
  program text,
  cdip_station_id text,                      -- alternate id, 3-digit CDIP number ('100')
  wmo_id text,                               -- WMO number when the source gives one ('62095')
  -- Same physical buoy as another source's row (e.g. the NDBC relay of an
  -- Irish M-buoy). Readers hide it and its page redirects. Set by the registry sync.
  duplicate_of text REFERENCES public.wave_stations(id) ON DELETE SET NULL,
  has_wave boolean NOT NULL DEFAULT false,
  has_swell_split boolean NOT NULL DEFAULT false,
  has_met boolean NOT NULL DEFAULT false,
  license text NOT NULL,
  attribution text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz,
  last_wave_observed_at timestamptz,
  spec_checked_at timestamptz,               -- NDBC swell-split sync state (other sources leave these null)
  spec_last_modified text,                   -- Last-Modified header, sent back as If-Modified-Since
  spec_last_observed_at timestamptz,         -- newest swell-split row stored
  txt_checked_at timestamptz,                -- NDBC standard .txt sync state (every NDBC wave station)
  txt_last_modified text,
  txt_last_observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wave_stations_id_format CHECK (id = source || ':' || source_station_id),
  CONSTRAINT wave_stations_source_station_key UNIQUE (source, source_station_id),
  CONSTRAINT wave_stations_slug_key UNIQUE (slug),
  CONSTRAINT wave_stations_not_own_duplicate CHECK (duplicate_of IS NULL OR duplicate_of <> id)
);

CREATE INDEX IF NOT EXISTS wave_stations_country_region_idx
  ON public.wave_stations (country_code, region) WHERE active AND has_wave AND duplicate_of IS NULL;
CREATE INDEX IF NOT EXISTS wave_stations_geog_idx
  ON public.wave_stations USING GIST (geog);
CREATE INDEX IF NOT EXISTS wave_stations_cdip_station_id_idx
  ON public.wave_stations (cdip_station_id) WHERE cdip_station_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wave_stations_wmo_id_idx
  ON public.wave_stations (wmo_id) WHERE wmo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wave_stations_spec_queue_idx
  ON public.wave_stations (spec_checked_at NULLS FIRST) WHERE active AND has_swell_split;
CREATE INDEX IF NOT EXISTS wave_stations_txt_queue_idx
  ON public.wave_stations (txt_checked_at NULLS FIRST) WHERE active AND has_wave;

DROP TRIGGER IF EXISTS trg_wave_stations_set_updated_at ON public.wave_stations;
CREATE TRIGGER trg_wave_stations_set_updated_at
  BEFORE UPDATE ON public.wave_stations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.wave_station_observations (
  station_id text NOT NULL REFERENCES public.wave_stations(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  wave_height_m real,
  dominant_period_s real,
  average_period_s real,
  mean_wave_direction_deg real,
  swell_height_m real,
  swell_period_s real,
  swell_direction_deg real,
  wind_wave_height_m real,
  wind_wave_period_s real,
  wind_wave_direction_deg real,
  steepness text,
  water_temp_c real,
  air_temp_c real,
  wind_speed_ms real,
  wind_direction_deg real,
  wind_gust_ms real,
  pressure_hpa real,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (station_id, observed_at)
);

-- The PK serves "latest N hours for a station"; this one serves the prune.
CREATE INDEX IF NOT EXISTS wave_station_observations_observed_at_idx
  ON public.wave_station_observations (observed_at);

ALTER TABLE public.wave_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_station_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read wave_stations" ON public.wave_stations;
CREATE POLICY "Public read wave_stations"
  ON public.wave_stations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read wave_station_observations" ON public.wave_station_observations;
CREATE POLICY "Public read wave_station_observations"
  ON public.wave_station_observations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages wave_stations" ON public.wave_stations;
CREATE POLICY "Service role manages wave_stations"
  ON public.wave_stations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages wave_station_observations" ON public.wave_station_observations;
CREATE POLICY "Service role manages wave_station_observations"
  ON public.wave_station_observations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.wave_stations, public.wave_station_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.wave_stations, public.wave_station_observations TO anon, authenticated;
GRANT ALL ON public.wave_stations, public.wave_station_observations TO service_role;

-- Merge observation rows from more than one feed into the same (station, time).
-- Each feed sends only what it knows; a NULL never erases a stored value, and an
-- unchanged row is not rewritten. Rows for unknown stations are dropped so one
-- stray id cannot fail the batch. Also advances the station's observed times.
CREATE OR REPLACE FUNCTION public.merge_wave_station_observations(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH incoming AS (
    SELECT DISTINCT ON (r.station_id, r.observed_at) r.*
    FROM jsonb_to_recordset(p_rows) AS r(
      station_id text,
      observed_at timestamptz,
      wave_height_m real,
      dominant_period_s real,
      average_period_s real,
      mean_wave_direction_deg real,
      swell_height_m real,
      swell_period_s real,
      swell_direction_deg real,
      wind_wave_height_m real,
      wind_wave_period_s real,
      wind_wave_direction_deg real,
      steepness text,
      water_temp_c real,
      air_temp_c real,
      wind_speed_ms real,
      wind_direction_deg real,
      wind_gust_ms real,
      pressure_hpa real,
      source text
    )
    WHERE r.station_id IS NOT NULL
      AND r.observed_at IS NOT NULL
      AND r.source IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.wave_stations s WHERE s.id = r.station_id)
    ORDER BY r.station_id, r.observed_at
  ),
  upserted AS (
    INSERT INTO public.wave_station_observations AS t (
      station_id, observed_at, wave_height_m, dominant_period_s, average_period_s,
      mean_wave_direction_deg, swell_height_m, swell_period_s, swell_direction_deg,
      wind_wave_height_m, wind_wave_period_s, wind_wave_direction_deg, steepness,
      water_temp_c, air_temp_c, wind_speed_ms, wind_direction_deg, wind_gust_ms,
      pressure_hpa, source, fetched_at
    )
    SELECT
      i.station_id, i.observed_at, i.wave_height_m, i.dominant_period_s, i.average_period_s,
      i.mean_wave_direction_deg, i.swell_height_m, i.swell_period_s, i.swell_direction_deg,
      i.wind_wave_height_m, i.wind_wave_period_s, i.wind_wave_direction_deg, i.steepness,
      i.water_temp_c, i.air_temp_c, i.wind_speed_ms, i.wind_direction_deg, i.wind_gust_ms,
      i.pressure_hpa, i.source, now()
    FROM incoming i
    ON CONFLICT (station_id, observed_at) DO UPDATE SET
      wave_height_m = COALESCE(EXCLUDED.wave_height_m, t.wave_height_m),
      dominant_period_s = COALESCE(EXCLUDED.dominant_period_s, t.dominant_period_s),
      average_period_s = COALESCE(EXCLUDED.average_period_s, t.average_period_s),
      mean_wave_direction_deg = COALESCE(EXCLUDED.mean_wave_direction_deg, t.mean_wave_direction_deg),
      swell_height_m = COALESCE(EXCLUDED.swell_height_m, t.swell_height_m),
      swell_period_s = COALESCE(EXCLUDED.swell_period_s, t.swell_period_s),
      swell_direction_deg = COALESCE(EXCLUDED.swell_direction_deg, t.swell_direction_deg),
      wind_wave_height_m = COALESCE(EXCLUDED.wind_wave_height_m, t.wind_wave_height_m),
      wind_wave_period_s = COALESCE(EXCLUDED.wind_wave_period_s, t.wind_wave_period_s),
      wind_wave_direction_deg = COALESCE(EXCLUDED.wind_wave_direction_deg, t.wind_wave_direction_deg),
      steepness = COALESCE(EXCLUDED.steepness, t.steepness),
      water_temp_c = COALESCE(EXCLUDED.water_temp_c, t.water_temp_c),
      air_temp_c = COALESCE(EXCLUDED.air_temp_c, t.air_temp_c),
      wind_speed_ms = COALESCE(EXCLUDED.wind_speed_ms, t.wind_speed_ms),
      wind_direction_deg = COALESCE(EXCLUDED.wind_direction_deg, t.wind_direction_deg),
      wind_gust_ms = COALESCE(EXCLUDED.wind_gust_ms, t.wind_gust_ms),
      pressure_hpa = COALESCE(EXCLUDED.pressure_hpa, t.pressure_hpa),
      fetched_at = EXCLUDED.fetched_at
    WHERE (
      t.wave_height_m, t.dominant_period_s, t.average_period_s, t.mean_wave_direction_deg,
      t.swell_height_m, t.swell_period_s, t.swell_direction_deg, t.wind_wave_height_m,
      t.wind_wave_period_s, t.wind_wave_direction_deg, t.steepness, t.water_temp_c,
      t.air_temp_c, t.wind_speed_ms, t.wind_direction_deg, t.wind_gust_ms, t.pressure_hpa
    ) IS DISTINCT FROM (
      COALESCE(EXCLUDED.wave_height_m, t.wave_height_m),
      COALESCE(EXCLUDED.dominant_period_s, t.dominant_period_s),
      COALESCE(EXCLUDED.average_period_s, t.average_period_s),
      COALESCE(EXCLUDED.mean_wave_direction_deg, t.mean_wave_direction_deg),
      COALESCE(EXCLUDED.swell_height_m, t.swell_height_m),
      COALESCE(EXCLUDED.swell_period_s, t.swell_period_s),
      COALESCE(EXCLUDED.swell_direction_deg, t.swell_direction_deg),
      COALESCE(EXCLUDED.wind_wave_height_m, t.wind_wave_height_m),
      COALESCE(EXCLUDED.wind_wave_period_s, t.wind_wave_period_s),
      COALESCE(EXCLUDED.wind_wave_direction_deg, t.wind_wave_direction_deg),
      COALESCE(EXCLUDED.steepness, t.steepness),
      COALESCE(EXCLUDED.water_temp_c, t.water_temp_c),
      COALESCE(EXCLUDED.air_temp_c, t.air_temp_c),
      COALESCE(EXCLUDED.wind_speed_ms, t.wind_speed_ms),
      COALESCE(EXCLUDED.wind_direction_deg, t.wind_direction_deg),
      COALESCE(EXCLUDED.wind_gust_ms, t.wind_gust_ms),
      COALESCE(EXCLUDED.pressure_hpa, t.pressure_hpa)
    )
    RETURNING t.station_id, t.observed_at, t.wave_height_m
  ),
  touched AS (
    UPDATE public.wave_stations s SET
      last_observed_at = GREATEST(s.last_observed_at, u.max_observed_at),
      last_wave_observed_at = GREATEST(s.last_wave_observed_at, u.max_wave_observed_at),
      has_wave = s.has_wave OR u.max_wave_observed_at IS NOT NULL
    FROM (
      SELECT
        station_id,
        max(observed_at) AS max_observed_at,
        max(observed_at) FILTER (WHERE wave_height_m IS NOT NULL) AS max_wave_observed_at
      FROM upserted
      GROUP BY station_id
    ) u
    WHERE s.id = u.station_id
      AND (
        s.last_observed_at IS DISTINCT FROM GREATEST(s.last_observed_at, u.max_observed_at)
        OR s.last_wave_observed_at IS DISTINCT FROM GREATEST(s.last_wave_observed_at, u.max_wave_observed_at)
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upserted;

  RETURN v_count;
END;
$$;

-- Retention: delete at most p_limit rows older than p_before. Refuses a cutoff
-- newer than 30 days so a bad argument cannot empty the table.
CREATE OR REPLACE FUNCTION public.prune_wave_station_observations(
  p_before timestamptz,
  p_limit integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_before IS NULL OR p_before > now() - interval '30 days' THEN
    RAISE EXCEPTION 'prune_wave_station_observations: cutoff % is newer than 30 days', p_before
      USING ERRCODE = '22023';
  END IF;

  WITH doomed AS (
    SELECT station_id, observed_at
    FROM public.wave_station_observations
    WHERE observed_at < p_before
    ORDER BY observed_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 0), 0), 20000)
  )
  DELETE FROM public.wave_station_observations o
  USING doomed d
  WHERE o.station_id = d.station_id AND o.observed_at = d.observed_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_wave_station_observations(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_wave_station_observations(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.prune_wave_station_observations(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_wave_station_observations(timestamptz, integer) TO service_role;

-- Nearest catalogue stations to a point (public read; RLS applies as invoker).
-- Duplicate rows (duplicate_of set) are left out.
CREATE OR REPLACE FUNCTION public.get_nearby_wave_stations(
  p_lat double precision,
  p_lon double precision,
  p_limit integer DEFAULT 10,
  p_wave_only boolean DEFAULT true
)
RETURNS SETOF public.wave_stations
LANGUAGE sql
STABLE
SECURITY INVOKER
-- PostGIS may live in the extensions schema (same as get_nearby_beaches).
SET search_path = public, extensions, pg_temp
AS $$
  SELECT s.*
  FROM public.wave_stations s
  WHERE s.active
    AND s.duplicate_of IS NULL
    AND (NOT p_wave_only OR s.has_wave)
  ORDER BY s.geog <-> ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_nearby_wave_stations(double precision, double precision, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_wave_stations(double precision, double precision, integer, boolean)
  TO anon, authenticated, service_role;

COMMENT ON TABLE public.wave_stations IS
  'Public wave-station catalogue (one row per source station, id = source:source_station_id; sources ndbc, marine_ie, aodn, fmi, smhi). Separate from the forecast station tables on purpose.';
COMMENT ON TABLE public.wave_station_observations IS
  'Observations for the public wave-station catalogue (wave stations only), merged from the NDBC latest_obs feed and realtime2 .spec / .txt files and from bulk feeds of the other sources. 180-day retention.';

COMMIT;
