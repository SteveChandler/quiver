BEGIN;

-- Reactivate 8 CDIP stations that are still reporting valid wave data.
-- These were incorrectly caught in the Feb 26 mass deactivation (commit 6cf9fb10e).
-- Verified via ERDDAP that all 8 have recent observations.
UPDATE ioos_stations
SET active = true
WHERE station_id IN (
  'edu_ucsd_cdip_271',  -- San Clemente, CA (last obs: Feb 28)
  'edu_ucsd_cdip_106',  -- Oahu North, HI (last obs: Feb 25)
  'edu_ucsd_cdip_238',  -- Oahu West, HI (last obs: Feb 26)
  'edu_ucsd_cdip_162',  -- Grays Harbor, WA (last obs: Feb 27)
  'edu_ucsd_cdip_171',  -- NC Outer Banks (last obs: Feb 27)
  'edu_ucsd_cdip_430',  -- NC Cape Hatteras (last obs: Feb 26)
  'edu_ucsd_cdip_209',  -- NJ Long Beach (last obs: Feb 26)
  'edu_ucsd_cdip_221'   -- MA Cape Cod (last obs: Feb 26)
)
AND active = false;

-- Refresh observable_beaches so ML health metrics reflect the reactivated stations
SELECT refresh_observable_beaches();

COMMIT;
