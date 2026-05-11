-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE public.sessions
  ADD COLUMN session_decomposition jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_session_decomposition_gin
  ON public.sessions USING gin (session_decomposition);

COMMENT ON COLUMN public.sessions.session_decomposition IS
  'Optional JSONB capturing what made the session, e.g. { waves: true, crew: false, vibe: true, skill_fit: false }. NULL = picker not shown or skipped. Populated by session-form decomposition picker.';
