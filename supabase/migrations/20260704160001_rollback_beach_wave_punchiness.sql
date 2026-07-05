BEGIN;

ALTER TABLE public.beaches
  DROP COLUMN IF EXISTS wave_punchiness;

COMMIT;
