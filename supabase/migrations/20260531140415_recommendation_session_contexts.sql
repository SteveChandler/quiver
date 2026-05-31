BEGIN;

CREATE TABLE IF NOT EXISTS public.recommendation_session_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  recommendation_id text NOT NULL,
  source_surface text NOT NULL CHECK (source_surface IN (
    'home_hero',
    'home_also_worth_it',
    'explore_for_you',
    'beach_detail',
    'surf_window_adjacent'
  )),
  beach_id uuid REFERENCES public.beaches(id) ON DELETE SET NULL,
  beach_name text,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  forecast_at timestamptz,
  condition_score numeric(5,2) NOT NULL CHECK (condition_score >= 0 AND condition_score <= 100),
  personal_match_score numeric(4,2) NOT NULL CHECK (personal_match_score >= 0 AND personal_match_score <= 10),
  overall_score numeric(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  reason_type text NOT NULL,
  recommendation_state text NOT NULL CHECK (recommendation_state IN (
    'ready_today',
    'future_fallback',
    'no_good_window'
  )),
  ranking_position integer NOT NULL CHECK (ranking_position > 0),
  fallback_horizon_hours integer CHECK (fallback_horizon_hours IS NULL OR fallback_horizon_hours > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS recommendation_session_contexts_user_created_idx
  ON public.recommendation_session_contexts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recommendation_session_contexts_session_idx
  ON public.recommendation_session_contexts (session_id);

CREATE INDEX IF NOT EXISTS recommendation_session_contexts_recommendation_idx
  ON public.recommendation_session_contexts (recommendation_id);

ALTER TABLE public.recommendation_session_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_session_contexts_select_own
  ON public.recommendation_session_contexts;
CREATE POLICY recommendation_session_contexts_select_own
  ON public.recommendation_session_contexts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS recommendation_session_contexts_insert_own
  ON public.recommendation_session_contexts;
CREATE POLICY recommendation_session_contexts_insert_own
  ON public.recommendation_session_contexts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS recommendation_session_contexts_update_own
  ON public.recommendation_session_contexts;
CREATE POLICY recommendation_session_contexts_update_own
  ON public.recommendation_session_contexts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.recommendation_session_contexts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.recommendation_session_contexts TO authenticated;
GRANT ALL ON public.recommendation_session_contexts TO service_role;

COMMENT ON TABLE public.recommendation_session_contexts IS
  'Attribution context captured when a user logs a session from a recommendation surface.';

NOTIFY pgrst, 'reload schema';

COMMIT;
