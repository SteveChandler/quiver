-- Add capability columns to ioos_stations for dynamic variable discovery
-- available_variables: raw list from ERDDAP /info endpoint
-- variable_map: canonical field -> actual ERDDAP variable name

ALTER TABLE ioos_stations
  ADD COLUMN IF NOT EXISTS available_variables JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS variable_map JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS variables_last_synced_at TIMESTAMPTZ;

-- Index for filtering by network (used in station ranking)
CREATE INDEX IF NOT EXISTS idx_ioos_stations_network ON ioos_stations(source_network);

-- Index for finding stations needing variable refresh
CREATE INDEX IF NOT EXISTS idx_ioos_stations_vars_synced ON ioos_stations(variables_last_synced_at);

-- Improve observation query performance for cached-first scoring
CREATE INDEX IF NOT EXISTS idx_ioos_obs_station_observed
  ON ioos_observations(station_id, observed_at DESC);

COMMENT ON COLUMN ioos_stations.available_variables IS 'Raw variable list from ERDDAP /info endpoint';
COMMENT ON COLUMN ioos_stations.variable_map IS 'Mapping: canonical field name -> actual ERDDAP variable name';
COMMENT ON COLUMN ioos_stations.variables_last_synced_at IS 'Last time we refreshed variable info from ERDDAP';
