BEGIN;

-- Allow native sessions to identify titles generated during submission while
-- preserving every existing session source value.
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_source_check,
  ADD CONSTRAINT sessions_source_check
  CHECK (
    source IS NULL
    OR source IN (
      'manual',
      'conditions_report',
      'email_one_tap',
      'maestro_smoke',
      'auto_title'
    )
  ) NOT VALID;

ALTER TABLE public.sessions
  VALIDATE CONSTRAINT sessions_source_check;

COMMENT ON CONSTRAINT sessions_source_check ON public.sessions IS
  'Allowed session source values. maestro_smoke marks rows created by native Maestro smoke flows for targeted cleanup; auto_title marks native sessions whose title was generated rather than user-entered.';

COMMIT;
