DO $migration$
DECLARE
  v_def text;
  v_expr text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check not found on public.user_events';
  END IF;

  IF position('learning_signal' IN v_def) > 0 THEN
    RAISE NOTICE 'learning-loop event types already present; skipping';
    RETURN;
  END IF;

  v_expr := regexp_replace(v_def, '^CHECK \((.*)\)$', '\1');
  v_expr := v_expr
    || ' OR (event_type = ANY (ARRAY['
    || '''learning_signal''::text, '
    || '''learning_progress_revealed''::text, '
    || '''learned_me_moment_viewed''::text, '
    || '''session_log_draft_opened''::text, '
    || '''session_log_time_selected''::text, '
    || '''session_log_draft_progress''::text, '
    || '''paywall_soft_prompt_shown''::text]))';

  EXECUTE 'ALTER TABLE public.user_events DROP CONSTRAINT user_events_event_type_check';
  EXECUTE 'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (' || v_expr || ')';
END
$migration$;;
