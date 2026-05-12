BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_session_time text;

COMMENT ON COLUMN public.profiles.preferred_session_time IS
  'User preferred surf time: dawn_patrol, morning, lunch, afternoon, evening, any. NULL = not set.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_preferred_session_time;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_preferred_session_time
  CHECK (
    preferred_session_time IS NULL
    OR preferred_session_time IN (
      'dawn_patrol',
      'morning',
      'lunch',
      'afternoon',
      'evening',
      'any'
    )
  );

COMMIT;
