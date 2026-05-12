-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS skill_ratings jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.sessions.skill_ratings IS
  'Per-skill self-assessment ratings (1-5). Shape: {"Pop-ups": 4, "Duck Dives": 3}';
CREATE INDEX idx_sessions_skill_ratings ON public.sessions USING gin(skill_ratings);
COMMIT;
