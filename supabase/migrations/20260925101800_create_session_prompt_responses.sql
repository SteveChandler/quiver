-- Answers to the native "How was it?" prompts
-- (spec: docs/superpowers/specs/2026-09-25-week-scout-swell-planning.md, session prompt responses).
-- Native upserts rows directly through PostgREST on the client-generated id.
BEGIN;

CREATE TABLE IF NOT EXISTS public.session_prompt_responses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('beach_visit', 'swell_event')),
  beach_id uuid NULL REFERENCES public.beaches(id) ON DELETE SET NULL,
  swell_event_key text NULL,
  prompted_at timestamptz NOT NULL,
  response text NOT NULL CHECK (response IN ('logged', 'not_surfed', 'dismissed')),
  session_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.session_prompt_responses IS
  'One row per native session prompt (beach visit or swell event), keyed by a client-generated id so retries are idempotent.';
COMMENT ON COLUMN public.session_prompt_responses.session_id IS
  'sessions.id when response = logged. No foreign key: the session may sync after this row.';

CREATE INDEX IF NOT EXISTS session_prompt_responses_user_created_idx
  ON public.session_prompt_responses (user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_session_prompt_responses_updated_at ON public.session_prompt_responses;
CREATE TRIGGER set_session_prompt_responses_updated_at
  BEFORE UPDATE ON public.session_prompt_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.session_prompt_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_prompt_responses_select_own ON public.session_prompt_responses;
CREATE POLICY session_prompt_responses_select_own ON public.session_prompt_responses
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS session_prompt_responses_insert_own ON public.session_prompt_responses;
CREATE POLICY session_prompt_responses_insert_own ON public.session_prompt_responses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS session_prompt_responses_update_own ON public.session_prompt_responses;
CREATE POLICY session_prompt_responses_update_own ON public.session_prompt_responses
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- No DELETE or TRUNCATE for clients: RLS does not cover TRUNCATE.
REVOKE ALL ON public.session_prompt_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.session_prompt_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.session_prompt_responses TO service_role;

COMMIT;
