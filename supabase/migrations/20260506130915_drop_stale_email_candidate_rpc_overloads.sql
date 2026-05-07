BEGIN;

DROP FUNCTION IF EXISTS public.get_conditions_alert_candidates(integer, integer);
DROP FUNCTION IF EXISTS public.get_session_prompt_candidates(integer, integer);

NOTIFY pgrst, 'reload schema';

COMMIT;
