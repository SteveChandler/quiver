BEGIN;

-- The station resolver fallback tiers use PostGIS geography casts. PostGIS is
-- installed in the extensions schema in production, so the SECURITY DEFINER
-- function must include extensions in its fixed search_path.
ALTER FUNCTION public.get_beach_observation_station(uuid)
  SET search_path = public, extensions, pg_temp;

COMMENT ON FUNCTION public.get_beach_observation_station(UUID) IS
  'Station resolver epoch 2026-06-10: prefer explicit beaches.cdip_station when recent CDIP wave observations exist, then preserve IOOS/NDBC fallback tiers. Historical observed_m re-backfill is intentionally out of scope. Search path includes extensions for PostGIS geography casts.';

COMMIT;
