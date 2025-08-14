-- Update per-beach scoring weight defaults and backfill all rows

BEGIN;

-- Update column defaults
ALTER TABLE public.beaches
  ALTER COLUMN w_wind   SET DEFAULT 0.300,
  ALTER COLUMN w_tide   SET DEFAULT 0.200,
  ALTER COLUMN w_swell  SET DEFAULT 0.250,
  ALTER COLUMN w_period SET DEFAULT 0.150,
  ALTER COLUMN w_height SET DEFAULT 0.100;

-- Backfill all existing rows to the new defaults
UPDATE public.beaches
SET
  w_wind   = 0.300,
  w_tide   = 0.200,
  w_swell  = 0.250,
  w_period = 0.150,
  w_height = 0.100;

-- Quick sanity notices
DO $$
DECLARE
  out_of_range integer;
  sum_not_one integer;
BEGIN
  SELECT COUNT(*) INTO out_of_range
  FROM public.beaches
  WHERE w_wind<0 OR w_wind>1 OR w_swell<0 OR w_swell>1 OR w_tide<0 OR w_tide>1 OR w_period<0 OR w_period>1 OR w_height<0 OR w_height>1;

  SELECT COUNT(*) INTO sum_not_one
  FROM public.beaches
  WHERE abs((coalesce(w_wind,0)+coalesce(w_swell,0)+coalesce(w_tide,0)+coalesce(w_period,0)+coalesce(w_height,0)) - 1.0) > 0.001;

  RAISE NOTICE 'Weights out of range: %', out_of_range;
  RAISE NOTICE 'Weight sum not ~1.0: %', sum_not_one;
END $$;

COMMIT;
