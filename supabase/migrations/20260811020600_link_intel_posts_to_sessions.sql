BEGIN;

ALTER TABLE public.intel_posts
  ADD COLUMN IF NOT EXISTS session_id uuid NULL
  REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_intel_posts_session_id
  ON public.intel_posts (session_id);

COMMIT;
