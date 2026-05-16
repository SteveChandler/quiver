BEGIN;

ALTER TABLE public.user_surf_preferences
  ADD COLUMN IF NOT EXISTS eligible_session_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avoidance_by_beach jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_surf_preferences.eligible_session_count IS
  'Number of clean completed real sessions considered for learned preference activation, including sessions without usable forecast snapshots.';

COMMENT ON COLUMN public.user_surf_preferences.avoidance_by_beach IS
  'Per-beach negative learned preference patterns from low-rated or low-wave-quality sessions. Used as a soft penalty for alerts and scoring.';

COMMIT;
