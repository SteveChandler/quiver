BEGIN;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_decomposition jsonb;

COMMIT;
