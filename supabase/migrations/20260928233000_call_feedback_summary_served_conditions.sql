-- Expose the conditions the app served with each shown call, so a session log
-- can be compared with what the surfer was actually told.
-- Body copied from 20260916190000_call_feedback_links.sql, the only definition
-- of call_feedback_summary; its pg_get_viewdef matched prod on 2026-09-28. The one
-- change is the appended served_conditions column (CREATE OR REPLACE may only append).
-- Rollback: DROP VIEW public.call_feedback_summary, then re-run the view block of
-- 20260916190000_call_feedback_links.sql.
BEGIN;

CREATE OR REPLACE VIEW public.call_feedback_summary
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
    ue.created_at AS first_shown_at,
    ue.metadata->'served_conditions' AS served_conditions
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
  boards.board_type AS board_type,
  shown_calls.served_conditions
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS c
    CROSS JOIN LATERAL pg_options_to_table(c.reloptions) AS o
    WHERE c.oid = 'public.call_feedback_summary'::regclass
      AND o.option_name = 'security_invoker'
      AND o.option_value IN ('true', 'on')
  ) THEN
    RAISE EXCEPTION 'call_feedback_summary lost security_invoker';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
