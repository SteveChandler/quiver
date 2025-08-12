-- Rollback defaults to previous values; no data overwrite

BEGIN;

ALTER TABLE public.beaches
  ALTER COLUMN w_wind   SET DEFAULT 0.400,
  ALTER COLUMN w_tide   SET DEFAULT 0.200,
  ALTER COLUMN w_swell  SET DEFAULT 0.400,
  ALTER COLUMN w_period SET DEFAULT 0.000,
  ALTER COLUMN w_height SET DEFAULT 0.000;

COMMIT;
