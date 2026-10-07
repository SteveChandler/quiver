-- Validate the widened tide_forecasts_source_check from 20261007050000.
--
-- VALIDATE CONSTRAINT takes SHARE UPDATE EXCLUSIVE, so tide reads and the
-- refresh cron's upserts keep running during the scan. It must run in a
-- separate transaction from the ADD, or the ADD's ACCESS EXCLUSIVE lock is
-- still held while it scans.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.tide_forecasts
  VALIDATE CONSTRAINT tide_forecasts_source_check;

COMMIT;
