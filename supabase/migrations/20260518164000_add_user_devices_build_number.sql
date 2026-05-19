BEGIN;

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS build_number text;

COMMENT ON COLUMN public.user_devices.build_number IS
  'Optional native binary build number captured from iOS CFBundleVersion or Android versionCode.';

NOTIFY pgrst, 'reload schema';

COMMIT;
