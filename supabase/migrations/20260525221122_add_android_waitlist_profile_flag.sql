BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wants_android_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS android_waitlist_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS android_waitlist_source text,
  ADD COLUMN IF NOT EXISTS android_waitlist_surface text,
  ADD COLUMN IF NOT EXISTS android_waitlist_placement text;

COMMENT ON COLUMN public.profiles.wants_android_access IS
  'True when the user has explicitly joined the Android waitlist from a web CTA.';
COMMENT ON COLUMN public.profiles.android_waitlist_joined_at IS
  'Timestamp when the user most recently joined or confirmed Android waitlist intent.';
COMMENT ON COLUMN public.profiles.android_waitlist_source IS
  'Source identifier for the CTA that captured Android waitlist intent.';
COMMENT ON COLUMN public.profiles.android_waitlist_surface IS
  'Page or surface where Android waitlist intent was captured.';
COMMENT ON COLUMN public.profiles.android_waitlist_placement IS
  'Placement of the CTA that captured Android waitlist intent.';

NOTIFY pgrst, 'reload schema';

COMMIT;
