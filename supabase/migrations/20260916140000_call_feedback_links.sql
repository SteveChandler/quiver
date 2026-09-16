-- Link shown calls to sessions and call-check feedback.
BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS call_id text;

CREATE INDEX IF NOT EXISTS idx_sessions_user_call_id
  ON public.sessions (user_id, call_id)
  WHERE call_id IS NOT NULL;

ALTER TABLE public.forecast_feedback_contexts
  ADD COLUMN IF NOT EXISTS call_id text;

CREATE INDEX IF NOT EXISTS idx_forecast_feedback_contexts_user_call_id
  ON public.forecast_feedback_contexts (user_id, call_id)
  WHERE call_id IS NOT NULL;

DO $$
DECLARE
  current_check text;
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.forecast_feedback_contexts'::regclass
    AND conname = 'forecast_feedback_contexts_feedback_kind_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'forecast_feedback_contexts_feedback_kind_check constraint not found';
  END IF;

  IF current_check !~ '(^|[^[:alnum:]_])call_check([^[:alnum:]_]|$)' THEN
    ALTER TABLE public.forecast_feedback_contexts
      DROP CONSTRAINT forecast_feedback_contexts_feedback_kind_check;
    EXECUTE format(
      'ALTER TABLE public.forecast_feedback_contexts ADD CONSTRAINT forecast_feedback_contexts_feedback_kind_check CHECK ((%s) OR feedback_kind = chr(99) || chr(97) || chr(108) || chr(108) || chr(95) || chr(99) || chr(104) || chr(101) || chr(99) || chr(107))',
      current_check
    );
  END IF;
END $$;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_recommendation_call_accuracy_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_recommendation_call_accuracy_check
  CHECK (
    recommendation_call_accuracy IS NULL OR
    recommendation_call_accuracy IN (
      'right', 'partly', 'wrong', 'not_sure', 'nailed_it', 'better', 'worse'
    )
  );

DO $$
DECLARE
  current_check text;
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
    current_check,
    ARRAY['call_check_prompted', 'call_check_answered', 'session_linked_to_call']
  );
END $$;

DROP VIEW IF EXISTS public.call_feedback_summary;

CREATE VIEW public.call_feedback_summary
WITH (security_invoker = true)
AS
WITH shown_calls AS (
  SELECT DISTINCT ON (ue.user_id, ue.metadata->>'call_id')
    ue.user_id,
    ue.metadata->>'call_id' AS call_id,
    ue.beach_id,
    COALESCE(ue.metadata->>'forecast_at', ue.metadata->>'selected_forecast_at') AS forecast_at,
    ue.metadata->>'surface' AS surface,
    ue.metadata->>'label' AS label,
    ue.metadata->>'board_class' AS board_class,
    NULLIF(ue.metadata->>'board_id', '')::uuid AS board_id,
    (ue.metadata->>'is_any_board')::boolean AS is_any_board,
    (ue.metadata->>'is_personal')::boolean AS is_personal,
    ue.metadata->>'plan' AS plan,
    ue.created_at AS first_shown_at
  FROM public.user_events AS ue
  WHERE ue.event_type = 'board_pick_exposed'
    AND ue.user_id IS NOT NULL
    AND NULLIF(ue.metadata->>'call_id', '') IS NOT NULL
  ORDER BY ue.user_id, ue.metadata->>'call_id', ue.created_at
)
SELECT
  shown_calls.user_id,
  shown_calls.call_id,
  shown_calls.beach_id,
  shown_calls.forecast_at,
  shown_calls.surface,
  shown_calls.label,
  shown_calls.board_class,
  shown_calls.board_id,
  shown_calls.is_any_board,
  shown_calls.is_personal,
  shown_calls.plan,
  shown_calls.first_shown_at,
  sessions.id AS session_id,
  sessions.rating,
  sessions.recommendation_call_accuracy,
  sessions.board_fit,
  sessions.session_board_fit,
  feedback.feedback_value,
  feedback.surf_call_context->>'board_value' AS board_value,
  boards.name AS board_name,
  boards.board_type AS board_type
FROM shown_calls
LEFT JOIN public.sessions AS sessions
  ON sessions.user_id = shown_calls.user_id
 AND sessions.call_id = shown_calls.call_id
LEFT JOIN public.forecast_feedback_contexts AS feedback
  ON feedback.user_id = shown_calls.user_id
 AND feedback.call_id = shown_calls.call_id
 AND feedback.feedback_kind = 'call_check'
LEFT JOIN public.boards AS boards
  ON boards.user_id = shown_calls.user_id
 AND boards.id = shown_calls.board_id;

REVOKE ALL ON public.call_feedback_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.call_feedback_summary TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
