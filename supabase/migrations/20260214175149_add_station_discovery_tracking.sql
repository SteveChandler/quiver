-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Add consecutive discovery miss tracking to prevent mass deactivation
-- when ERDDAP catalog returns incomplete results

ALTER TABLE ioos_stations
  ADD COLUMN IF NOT EXISTS consecutive_discovery_misses INTEGER NOT NULL DEFAULT 0;

-- RPC function to increment miss counter for stations not found in discovery
CREATE OR REPLACE FUNCTION increment_station_discovery_misses(seen_ids TEXT[])
RETURNS void AS $$
BEGIN
  UPDATE ioos_stations
  SET consecutive_discovery_misses = consecutive_discovery_misses + 1
  WHERE station_id != ALL(seen_ids)
    AND active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
