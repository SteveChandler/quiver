-- Migration: Remove ISM-prefixed stations from ioos_stations table
--
-- Problem: ISM federated IDs (e.g., "ism-secoora-cap2wave-capers-near") were stored
-- in the database, but the ERDDAP tabledap API only accepts native dataset IDs
-- (e.g., "cap2wave-capers-nearshore-wave"). This caused all observation fetches to fail.
--
-- Solution: Remove ISM-prefixed stations so they can be re-discovered with native IDs.
-- The ioos-service.ts now filters out ISM IDs during station discovery.

BEGIN;

-- Log count of ISM-prefixed stations being removed
DO $$
DECLARE
  ism_station_count INTEGER;
  ism_observation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ism_station_count
  FROM ioos_stations
  WHERE LOWER(station_id) LIKE 'ism-%';

  SELECT COUNT(*) INTO ism_observation_count
  FROM ioos_observations
  WHERE LOWER(station_id) LIKE 'ism-%';

  RAISE NOTICE 'Removing % ISM-prefixed stations and % associated observations',
    ism_station_count, ism_observation_count;
END $$;

-- Delete observations for ISM-prefixed stations first (foreign key constraint)
DELETE FROM ioos_observations
WHERE LOWER(station_id) LIKE 'ism-%';

-- Delete ISM-prefixed stations
DELETE FROM ioos_stations
WHERE LOWER(station_id) LIKE 'ism-%';

-- Refresh the observable_beaches materialized view to reflect changes
-- This view determines which beaches have nearby observation stations
REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;

COMMIT;

-- Verification query (run manually after migration)
-- SELECT COUNT(*) as remaining_stations FROM ioos_stations WHERE LOWER(station_id) LIKE 'ism-%';
-- Expected: 0
