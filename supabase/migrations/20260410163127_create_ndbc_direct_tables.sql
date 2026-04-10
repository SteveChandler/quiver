-- NDBC Direct Observation Tables
-- Stores station metadata and observations fetched directly from NDBC
-- for the 137+ stations with wave data that are NOT available via IOOS ERDDAP.
-- Parallel pipeline to ioos_stations / ioos_observations.

BEGIN;

-- ============================================
-- Table: ndbc_direct_stations
-- NDBC station metadata, synced from NDBC feeds
-- ============================================
CREATE TABLE IF NOT EXISTS public.ndbc_direct_stations (
  station_id TEXT PRIMARY KEY,               -- bare NDBC ID, e.g. "46225"
  name TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  coordinates GEOMETRY(Point, 4326),         -- auto-populated via trigger
  station_type TEXT,                          -- e.g. "buoy", "cman"
  has_wave_data BOOLEAN DEFAULT FALSE,
  nearest_beach_id UUID REFERENCES beaches(id) ON DELETE SET NULL,
  distance_to_beach_km NUMERIC,
  ioos_station_id TEXT,                      -- cross-ref to ioos_stations (e.g. "wmo_46225"), NULL if exclusive
  active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ndbc_direct_stations
CREATE INDEX IF NOT EXISTS idx_ndbc_direct_stations_geo
  ON ndbc_direct_stations USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_ndbc_direct_stations_active
  ON ndbc_direct_stations(active);
CREATE INDEX IF NOT EXISTS idx_ndbc_direct_stations_beach
  ON ndbc_direct_stations(nearest_beach_id);
CREATE INDEX IF NOT EXISTS idx_ndbc_direct_stations_ioos
  ON ndbc_direct_stations(ioos_station_id);

-- ============================================
-- Table: ndbc_direct_observations
-- Append-only observation history from NDBC direct feeds
-- ============================================
CREATE TABLE IF NOT EXISTS public.ndbc_direct_observations (
  id BIGSERIAL PRIMARY KEY,
  station_id TEXT REFERENCES ndbc_direct_stations(station_id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  wave_height_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction_deg NUMERIC,
  water_temp_c NUMERIC,
  wind_speed_ms NUMERIC,
  wind_direction_deg NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ndbc_direct_observations
CREATE INDEX IF NOT EXISTS idx_ndbc_direct_obs_station_time
  ON ndbc_direct_observations(station_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndbc_direct_obs_time
  ON ndbc_direct_observations(observed_at DESC);

-- Prevent duplicate observations
CREATE UNIQUE INDEX IF NOT EXISTS idx_ndbc_direct_obs_unique
  ON ndbc_direct_observations(station_id, observed_at);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.ndbc_direct_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ndbc_direct_observations ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Allow read access to ndbc_direct_stations"
  ON public.ndbc_direct_stations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access to ndbc_direct_observations"
  ON public.ndbc_direct_observations FOR SELECT
  TO authenticated
  USING (true);

-- Read access for anonymous users (public buoy data)
CREATE POLICY "Allow anon read access to ndbc_direct_stations"
  ON public.ndbc_direct_stations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon read access to ndbc_direct_observations"
  ON public.ndbc_direct_observations FOR SELECT
  TO anon
  USING (true);

-- Service role full access for cron jobs / ingestion
CREATE POLICY "Allow service role full access to ndbc_direct_stations"
  ON public.ndbc_direct_stations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to ndbc_direct_observations"
  ON public.ndbc_direct_observations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Grants
-- ============================================
GRANT SELECT ON public.ndbc_direct_stations TO authenticated, anon;
GRANT ALL ON public.ndbc_direct_stations TO service_role;
GRANT SELECT ON public.ndbc_direct_observations TO authenticated, anon;
GRANT ALL ON public.ndbc_direct_observations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ndbc_direct_observations_id_seq TO service_role;

-- ============================================
-- Trigger: Auto-populate coordinates + updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_ndbc_direct_station_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.coordinates := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ndbc_direct_station_coordinates
  BEFORE INSERT OR UPDATE OF latitude, longitude ON ndbc_direct_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_ndbc_direct_station_coordinates();

-- Separate updated_at trigger for non-coordinate updates
CREATE OR REPLACE FUNCTION update_ndbc_direct_station_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ndbc_direct_station_updated_at
  BEFORE UPDATE ON ndbc_direct_stations
  FOR EACH ROW
  WHEN (OLD.latitude IS NOT DISTINCT FROM NEW.latitude
    AND OLD.longitude IS NOT DISTINCT FROM NEW.longitude)
  EXECUTE FUNCTION update_ndbc_direct_station_updated_at();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE public.ndbc_direct_stations IS
  'NDBC station metadata fetched directly from NDBC feeds. Covers 137+ wave-data stations not available in IOOS ERDDAP.';
COMMENT ON TABLE public.ndbc_direct_observations IS
  'Historical wave/wind/temp observations from NDBC direct feeds. Append-only with 90-day retention target.';
COMMENT ON COLUMN public.ndbc_direct_stations.station_id IS
  'Bare NDBC station ID, e.g. "46225" (no wmo_ prefix)';
COMMENT ON COLUMN public.ndbc_direct_stations.ioos_station_id IS
  'Cross-reference to ioos_stations.station_id (e.g. "wmo_46225") for dedup. NULL if station is exclusive to NDBC direct.';
COMMENT ON COLUMN public.ndbc_direct_stations.station_type IS
  'NDBC platform type: "buoy", "cman", "dart", etc.';

COMMIT;
