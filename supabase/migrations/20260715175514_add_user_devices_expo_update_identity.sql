BEGIN;

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS expo_update_id varchar(64),
  ADD COLUMN IF NOT EXISTS expo_channel varchar(64),
  ADD COLUMN IF NOT EXISTS expo_runtime_version varchar(64),
  ADD COLUMN IF NOT EXISTS expo_is_embedded_launch boolean,
  ADD COLUMN IF NOT EXISTS expo_is_emergency_launch boolean;

COMMENT ON COLUMN public.user_devices.expo_update_id IS
  'Optional non-secret Expo Updates update ID reported by the native client.';
COMMENT ON COLUMN public.user_devices.expo_channel IS
  'Optional Expo Updates channel reported by the native client.';
COMMENT ON COLUMN public.user_devices.expo_runtime_version IS
  'Optional Expo Updates runtime version reported by the native client.';
COMMENT ON COLUMN public.user_devices.expo_is_embedded_launch IS
  'Whether the native client launched the update embedded in the binary.';
COMMENT ON COLUMN public.user_devices.expo_is_emergency_launch IS
  'Whether Expo Updates reported an emergency launch.';

NOTIFY pgrst, 'reload schema';

COMMIT;
