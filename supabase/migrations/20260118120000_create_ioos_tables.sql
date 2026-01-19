-- IOOS Integration Tables
-- Stores station metadata and observations from IOOS ERDDAP API
-- Supports ML training pipeline and fallback chain for wave data

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- Table: ioos_stations
-- Stores IOOS station metadata, synced weekly
-- ============================================
CREATE TABLE IF NOT EXISTS public.ioos_stations (
  station_id TEXT PRIMARY KEY,
  source_network TEXT NOT NULL,          -- e.g., "NDBC", "PacIOOS", "SECOORA"
  name TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  coordinates GEOMETRY(Point, 4326),
  sensors JSONB,                          -- Available sensor types
  has_wave_data BOOLEAN DEFAULT FALSE,
  nearest_beach_id UUID REFERENCES beaches(id),
  distance_to_beach_km NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ioos_stations
CREATE INDEX IF NOT EXISTS idx_ioos_stations_geo
  ON ioos_stations USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_ioos_stations_active
  ON ioos_stations(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ioos_stations_beach
  ON ioos_stations(nearest_beach_id);
CREATE INDEX IF NOT EXISTS idx_ioos_stations_network
  ON ioos_stations(source_network);

-- ============================================
-- Table: ioos_observations
-- Append-only observation history for ML training
-- ============================================
CREATE TABLE IF NOT EXISTS public.ioos_observations (
  id BIGSERIAL PRIMARY KEY,
  station_id TEXT REFERENCES ioos_stations(station_id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  wave_height_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction_deg NUMERIC,
  water_temp_c NUMERIC,
  wind_speed_ms NUMERIC,
  wind_direction_deg NUMERIC,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ioos_observations
CREATE INDEX IF NOT EXISTS idx_ioos_obs_station_time
  ON ioos_observations(station_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ioos_obs_time
  ON ioos_observations(observed_at DESC);

-- Prevent duplicate observations
CREATE UNIQUE INDEX IF NOT EXISTS idx_ioos_obs_unique
  ON ioos_observations(station_id, observed_at);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.ioos_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ioos_observations ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to ioos_stations"
  ON public.ioos_stations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access to ioos_observations"
  ON public.ioos_observations FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access for cron jobs
CREATE POLICY "Allow service role full access to ioos_stations"
  ON public.ioos_stations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to ioos_observations"
  ON public.ioos_observations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Helper function: Update coordinates geometry
-- ============================================
CREATE OR REPLACE FUNCTION update_ioos_station_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.coordinates := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ioos_station_coordinates
  BEFORE INSERT OR UPDATE OF latitude, longitude ON ioos_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_ioos_station_coordinates();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.ioos_stations IS 'IOOS station metadata from ERDDAP API, synced weekly';
COMMENT ON TABLE public.ioos_observations IS 'Historical wave observations for ML training, 90-day retention';
COMMENT ON COLUMN public.ioos_stations.source_network IS 'Regional network: PacIOOS, SECOORA, CeNCOOS, etc.';
COMMENT ON COLUMN public.ioos_stations.sensors IS 'JSON array of available sensor types';
COMMENT ON COLUMN public.ioos_observations.raw_data IS 'Original API response for debugging';
