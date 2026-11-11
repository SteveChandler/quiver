BEGIN;

-- Public tide station registry behind /tides/station/{slug}. Additive only.
-- Rows come from scripts/tides/seed-tide-stations.ts (NOAA CO-OPS prediction
-- stations plus commercially licensed TICON-4 gauges). Only stations that
-- may be shown in a commercial product are stored: commercial_use must be true.
CREATE TABLE IF NOT EXISTS public.tide_stations (
  id text PRIMARY KEY,
  source text NOT NULL,
  source_station_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  country_code text NOT NULL,
  country_slug text NOT NULL,
  region text,
  region_slug text,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  timezone text NOT NULL,
  station_kind text NOT NULL,
  reference_station_id text,
  datum_label text NOT NULL,
  datum_offset_m double precision,
  constituents jsonb,
  operator text NOT NULL,
  licence text NOT NULL,
  licence_url text NOT NULL,
  attribution text NOT NULL,
  commercial_use boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tide_stations_slug_key UNIQUE (slug),
  CONSTRAINT tide_stations_source_station_key UNIQUE (source, source_station_id),
  CONSTRAINT tide_stations_id_format CHECK (id = source || ':' || source_station_id),
  CONSTRAINT tide_stations_source_check CHECK (source IN ('noaa', 'ticon')),
  CONSTRAINT tide_stations_kind_check
    CHECK (station_kind IN ('reference', 'subordinate', 'harmonic-model')),
  CONSTRAINT tide_stations_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT tide_stations_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT tide_stations_country_slug_not_reserved CHECK (country_slug <> 'station'),
  CONSTRAINT tide_stations_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT tide_stations_lon_range CHECK (lon BETWEEN -180 AND 180),
  CONSTRAINT tide_stations_commercial_only CHECK (commercial_use),
  CONSTRAINT tide_stations_harmonic_has_constituents
    CHECK (station_kind <> 'harmonic-model' OR jsonb_typeof(constituents) = 'array')
);

CREATE INDEX IF NOT EXISTS tide_stations_place_idx
  ON public.tide_stations (country_slug, region_slug, name)
  WHERE active;

CREATE INDEX IF NOT EXISTS tide_stations_lat_lon_idx
  ON public.tide_stations (lat, lon)
  WHERE active;

ALTER TABLE public.tide_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tide_stations_public_read ON public.tide_stations;
CREATE POLICY tide_stations_public_read
  ON public.tide_stations
  FOR SELECT
  TO anon, authenticated
  USING (active);

-- Reads only for clients; the seed script writes with the service role.
REVOKE ALL ON public.tide_stations FROM anon, authenticated;
GRANT SELECT ON public.tide_stations TO anon, authenticated;
GRANT ALL ON public.tide_stations TO service_role;

-- Hub counts in one row per country/region instead of paging thousands of rows.
CREATE OR REPLACE VIEW public.tide_station_region_counts
WITH (security_invoker = true) AS
SELECT
  country_code,
  country_slug,
  region,
  region_slug,
  count(*)::integer AS station_count
FROM public.tide_stations
WHERE active
GROUP BY country_code, country_slug, region, region_slug;

REVOKE ALL ON public.tide_station_region_counts FROM anon, authenticated;
GRANT SELECT ON public.tide_station_region_counts TO anon, authenticated, service_role;

COMMENT ON TABLE public.tide_stations IS
  'Public tide station registry (NOAA CO-OPS + commercially licensed TICON-4). Seeded by scripts/tides/seed-tide-stations.ts.';
COMMENT ON COLUMN public.tide_stations.datum_offset_m IS
  'Metres added to harmonic predictions (relative to mean sea level) so zero is the computed mean lower low water. NULL for NOAA rows, which NOAA serves on MLLW.';
COMMENT ON COLUMN public.tide_stations.constituents IS
  'Harmonic constants [{name, amplitudeM, phaseDeg}] for computed stations; NULL for NOAA rows.';

COMMIT;

-- Rollback (manual):
-- BEGIN;
-- DROP VIEW IF EXISTS public.tide_station_region_counts;
-- DROP TABLE IF EXISTS public.tide_stations;
-- COMMIT;
