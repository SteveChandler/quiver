BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS max_wind_onshore_mph numeric,
  ADD COLUMN IF NOT EXISTS max_wind_any_mph numeric;

COMMENT ON COLUMN public.beaches.max_wind_onshore_mph IS
  'Wind speed (mph) that degrades conditions when onshore. Default logic uses 10 if null.';

COMMENT ON COLUMN public.beaches.max_wind_any_mph IS
  'Wind speed (mph) that is too strong regardless of direction. Default logic uses 18 if null.';

UPDATE public.beaches
SET
  max_wind_onshore_mph = 10,
  max_wind_any_mph = 18
WHERE lower(name) = 'ocean beach pier'
  AND (
    max_wind_onshore_mph IS DISTINCT FROM 10
    OR max_wind_any_mph IS DISTINCT FROM 18
  );

UPDATE public.beaches
SET
  max_wind_onshore_mph = 12,
  max_wind_any_mph = 20
WHERE break_type = 'reef'
  AND max_wind_onshore_mph IS NULL
  AND max_wind_any_mph IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
