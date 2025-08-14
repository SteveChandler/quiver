-- Enable required PostGIS extensions for geospatial features
-- This must run before any migration that uses geometry/geography or ST_* functions

CREATE EXTENSION IF NOT EXISTS postgis;
-- Optional, only if needed later:
-- CREATE EXTENSION IF NOT EXISTS postgis_topology;

DO $$
BEGIN
  RAISE NOTICE 'PostGIS extension ensured (postgis).';
END $$;


