BEGIN;

-- Add provenance column to track whether raw input came from NOAA (legacy)
-- or Open-Meteo (new primary for 0-168h horizon).
-- Default 'NOAA_NWS' backfills existing rows to the legacy source.
ALTER TABLE corrected_forecasts
  ADD COLUMN primary_source text NOT NULL DEFAULT 'NOAA_NWS'
  CHECK (primary_source IN ('NOAA_NWS', 'OPEN_METEO'));

COMMIT;
