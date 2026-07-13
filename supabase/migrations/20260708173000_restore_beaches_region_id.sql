BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS region_id uuid NULL;

CREATE INDEX IF NOT EXISTS beaches_region_id_idx
  ON public.beaches(region_id);

COMMENT ON COLUMN public.beaches.region_id IS
  'Optional region identifier used by beach detail responses and regional recommendation functions.';

NOTIFY pgrst, 'reload schema';

COMMIT;
