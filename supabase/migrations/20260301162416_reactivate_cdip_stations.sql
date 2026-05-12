-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Reactivate 8 CDIP stations that are still reporting valid wave data.
-- These were incorrectly caught in the Feb 26 mass deactivation (commit 6cf9fb10e).
-- Verified via ERDDAP that all 8 have recent observations.
UPDATE ioos_stations
SET active = true
WHERE station_id IN (
  'edu_ucsd_cdip_271',
  'edu_ucsd_cdip_106',
  'edu_ucsd_cdip_238',
  'edu_ucsd_cdip_162',
  'edu_ucsd_cdip_171',
  'edu_ucsd_cdip_430',
  'edu_ucsd_cdip_209',
  'edu_ucsd_cdip_221'
)
AND active = false;

-- Refresh observable_beaches so ML health metrics reflect the reactivated stations
SELECT refresh_observable_beaches();
