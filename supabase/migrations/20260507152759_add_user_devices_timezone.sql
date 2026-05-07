BEGIN;

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN public.user_devices.timezone IS
  'Optional IANA timezone captured from the registering browser or native device.';

UPDATE public.profiles p
SET timezone = b.timezone
FROM public.beaches b
WHERE p.timezone IS NULL
  AND p.home_beach_id = b.id
  AND b.timezone IS NOT NULL
  AND p.deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
