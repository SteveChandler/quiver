BEGIN;

CREATE TABLE IF NOT EXISTS public.recommendation_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id text NOT NULL CHECK (char_length(recommendation_id) BETWEEN 1 AND 200),
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0 AND rank <= 100),
  score numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  mode text NOT NULL DEFAULT 'log' CHECK (mode IN ('log')),
  time_slot text CHECK (
    time_slot IS NULL OR time_slot IN (
      'dawn-patrol',
      'morning',
      'late-morning',
      'lunch-session',
      'afternoon',
      'evening',
      'any'
    )
  ),
  surface text NOT NULL CHECK (
    surface IN (
      'home_hero',
      'home_top_spots',
      'home_nearby_spots',
      'discover_list',
      'explore_for_you',
      'session_intelligence'
    )
  ),
  impression_key text NOT NULL CHECK (char_length(impression_key) BETWEEN 1 AND 260),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_impressions_window_check CHECK (window_start < window_end)
);

CREATE UNIQUE INDEX IF NOT EXISTS recommendation_impressions_key_idx
  ON public.recommendation_impressions (impression_key);

CREATE INDEX IF NOT EXISTS recommendation_impressions_user_created_idx
  ON public.recommendation_impressions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recommendation_impressions_recommendation_idx
  ON public.recommendation_impressions (recommendation_id);

CREATE INDEX IF NOT EXISTS recommendation_impressions_beach_created_idx
  ON public.recommendation_impressions (beach_id, created_at DESC);

ALTER TABLE public.recommendation_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_impressions_select_own
  ON public.recommendation_impressions;
CREATE POLICY recommendation_impressions_select_own
  ON public.recommendation_impressions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS recommendation_impressions_insert_own
  ON public.recommendation_impressions;
CREATE POLICY recommendation_impressions_insert_own
  ON public.recommendation_impressions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS recommendation_impressions_service_role_all
  ON public.recommendation_impressions;
CREATE POLICY recommendation_impressions_service_role_all
  ON public.recommendation_impressions
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

REVOKE ALL ON public.recommendation_impressions FROM PUBLIC;
GRANT SELECT, INSERT ON public.recommendation_impressions TO authenticated;
GRANT ALL ON public.recommendation_impressions TO service_role;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recommendation_id text,
  ADD COLUMN IF NOT EXISTS recommendation_call_accuracy text,
  ADD COLUMN IF NOT EXISTS forecast_wave_height_ft numeric,
  ADD COLUMN IF NOT EXISTS forecast_tide_status text,
  ADD COLUMN IF NOT EXISTS wave_height_correct boolean,
  ADD COLUMN IF NOT EXISTS tide_status_correct boolean;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_recommendation_call_accuracy_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_recommendation_call_accuracy_check
  CHECK (
    recommendation_call_accuracy IS NULL OR
    recommendation_call_accuracy IN ('right', 'partly', 'wrong', 'not_sure')
  );

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_forecast_tide_status_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_forecast_tide_status_check
  CHECK (
    forecast_tide_status IS NULL OR
    forecast_tide_status IN ('rising', 'falling', 'high', 'low')
  );

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_forecast_wave_height_ft_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_forecast_wave_height_ft_check
  CHECK (
    forecast_wave_height_ft IS NULL OR
    (forecast_wave_height_ft >= 0 AND forecast_wave_height_ft <= 50)
  );

CREATE INDEX IF NOT EXISTS sessions_recommendation_id_idx
  ON public.sessions (recommendation_id)
  WHERE recommendation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_recommendation_feedback_idx
  ON public.sessions (user_id, beach_id, created_at DESC)
  WHERE recommendation_id IS NOT NULL
    AND (
      rating <= 2 OR
      recommendation_call_accuracy = 'wrong'
    );

ALTER TABLE public.recommendation_session_contexts
  DROP CONSTRAINT IF EXISTS recommendation_session_contexts_source_surface_check;

ALTER TABLE public.recommendation_session_contexts
  ADD CONSTRAINT recommendation_session_contexts_source_surface_check
  CHECK (source_surface IN (
    'home_hero',
    'home_top_spots',
    'home_nearby_spots',
    'home_also_worth_it',
    'discover_list',
    'explore_for_you',
    'beach_detail',
    'session_intelligence',
    'surf_window_adjacent'
  ));

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY['recommendation_impression'];
  missing_events text[];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  SELECT array_agg(event_name)
    INTO missing_events
  FROM unnest(candidate_events) AS event_name
  WHERE current_check NOT LIKE '%' || event_name || '%';

  IF missing_events IS NOT NULL AND array_length(missing_events, 1) IS NOT NULL THEN
    ALTER TABLE public.user_events
      DROP CONSTRAINT user_events_event_type_check;

    EXECUTE format(
      'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
      current_check,
      missing_events
    );
  END IF;
END $$;

CREATE OR REPLACE VIEW public.recommendation_feedback_summary
WITH (security_invoker = true)
AS
SELECT
  ri.user_id,
  ri.recommendation_id,
  ri.beach_id,
  ri.surface,
  ri.rank,
  ri.score,
  ri.window_start,
  ri.window_end,
  ri.created_at AS impression_at,
  s.id AS session_id,
  s.created_at AS session_created_at,
  s.rating,
  s.recommendation_call_accuracy,
  s.wave_height_correct,
  s.tide_status_correct
FROM public.recommendation_impressions ri
LEFT JOIN public.sessions s
  ON s.user_id = ri.user_id
 AND s.recommendation_id = ri.recommendation_id
 AND s.deleted_at IS NULL;

GRANT SELECT ON public.recommendation_feedback_summary TO authenticated;
GRANT SELECT ON public.recommendation_feedback_summary TO service_role;

COMMENT ON TABLE public.recommendation_impressions IS
  'Durable authenticated recommendation exposure log. No historical backfill exists before this migration.';
COMMENT ON COLUMN public.sessions.recommendation_id IS
  'Deterministic recommendation identifier passed when a session is logged from a recommendation surface.';
COMMENT ON COLUMN public.sessions.recommendation_call_accuracy IS
  'User answer to suggested-session call correctness: right, partly, wrong, not_sure.';
COMMENT ON VIEW public.recommendation_feedback_summary IS
  'Forward-looking attribution view linking recommendation impressions to subsequently attributed sessions.';

NOTIFY pgrst, 'reload schema';

COMMIT;
