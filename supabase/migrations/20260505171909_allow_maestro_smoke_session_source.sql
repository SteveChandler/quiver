BEGIN;

-- Allow native Maestro smoke sessions to be identified without matching on
-- user-entered title or notes text.
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_source_check,
  ADD CONSTRAINT sessions_source_check
  CHECK (
    source IS NULL
    OR source IN (
      'manual',
      'conditions_report',
      'email_one_tap',
      'maestro_smoke'
    )
  ) NOT VALID;

ALTER TABLE public.sessions
  VALIDATE CONSTRAINT sessions_source_check;

COMMENT ON CONSTRAINT sessions_source_check ON public.sessions IS
  'Allowed session source values. maestro_smoke marks rows created by native Maestro smoke flows for targeted cleanup.';

COMMIT;
