BEGIN;

-- Native distinguishes generated titles from user-authored titles for feed
-- eligibility. Preserve every existing source while accepting that marker.
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_source_check,
  ADD CONSTRAINT sessions_source_check
  CHECK (
    source IS NULL
    OR source IN (
      'manual',
      'auto_title',
      'conditions_report',
      'email_one_tap',
      'maestro_smoke'
    )
  ) NOT VALID;

ALTER TABLE public.sessions
  VALIDATE CONSTRAINT sessions_source_check;

COMMENT ON CONSTRAINT sessions_source_check ON public.sessions IS
  'Allowed session source values. auto_title identifies generated native titles; maestro_smoke identifies test cleanup rows.';

COMMIT;
