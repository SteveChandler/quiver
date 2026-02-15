-- Add consecutive discovery miss tracking to prevent mass deactivation
-- when ERDDAP catalog returns incomplete results

BEGIN;

-- Track how many consecutive station discovery runs missed this station
ALTER TABLE ioos_stations
  ADD COLUMN IF NOT EXISTS consecutive_discovery_misses INTEGER NOT NULL DEFAULT 0;

-- RPC function to increment miss counter for stations not found in discovery
CREATE OR REPLACE FUNCTION increment_station_discovery_misses(seen_ids TEXT[])
RETURNS void AS $$
BEGIN
  -- Guard: do nothing if called with an empty array (would match ALL active stations)
  IF seen_ids IS NULL OR array_length(seen_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE ioos_stations
  SET consecutive_discovery_misses = consecutive_discovery_misses + 1
  WHERE station_id != ALL(seen_ids)
    AND active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION increment_station_discovery_misses(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_station_discovery_misses(TEXT[]) TO service_role;

COMMIT;
