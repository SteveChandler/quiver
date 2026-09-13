-- Disposable PostgreSQL-only fixture. Geographic primitives are stubs: this tests
-- relational matching/ties, not PostGIS distance or real station coverage.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE DOMAIN geography AS double precision;
CREATE FUNCTION st_distance(geography, geography) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$ SELECT abs($1::double precision - $2::double precision) $$;
CREATE FUNCTION st_dwithin(geography, geography, double precision) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT st_distance($1,$2) <= $3 $$;
CREATE FUNCTION swell_windows_overlap(numeric,numeric,numeric,numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$ SELECT 360::numeric $$;
CREATE TABLE beaches(id uuid PRIMARY KEY, cdip_station text, geog geography,
  swell_window_min_deg numeric, swell_window_max_deg numeric);
CREATE TABLE ioos_stations(station_id text PRIMARY KEY, active boolean DEFAULT true,
  has_wave_data boolean DEFAULT true, nearest_beach_id uuid, coordinates geography,
  latitude numeric, longitude numeric, distance_to_beach_km numeric, source_network text);
CREATE TABLE ndbc_direct_stations(LIKE ioos_stations INCLUDING ALL);
ALTER TABLE ndbc_direct_stations ADD COLUMN ioos_station_id text;
CREATE TABLE ioos_observations(id bigserial PRIMARY KEY, station_id text,
  observed_at timestamptz NOT NULL, wave_height_m numeric, wave_period_s numeric,
  wave_direction_deg numeric, water_temp_c numeric, created_at timestamptz DEFAULT now(),
  UNIQUE(station_id, observed_at));
CREATE TABLE ndbc_direct_observations(LIKE ioos_observations INCLUDING ALL);
CREATE TABLE ml_predictions_log(id uuid PRIMARY KEY, beach_id uuid, predicted_at timestamptz,
  raw_forecast_m numeric, corrected_forecast_m numeric, observed_m numeric,
  raw_error_m numeric, corrected_error_m numeric, raw_display_height_m numeric);
-- Use the actual unified-view definition (extracted by the runner), preserving
-- the migration's source deduplication rather than implementing a test double.
INSERT INTO beaches VALUES ('00000000-0000-0000-0000-000000000001',NULL,0,0,360);
INSERT INTO ioos_stations(station_id,nearest_beach_id) VALUES
 ('legacy','00000000-0000-0000-0000-000000000001');
INSERT INTO ioos_observations(station_id,observed_at,wave_height_m) VALUES
 ('legacy',now()-interval '1 day',1);
