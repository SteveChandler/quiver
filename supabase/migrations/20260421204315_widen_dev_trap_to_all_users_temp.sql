-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Widen the dev_log_session_mutation forensic trap to audit ALL session mutations,
-- not just user 73040cff. Phase 2 seeding for user 610a5745 needs forensic coverage
-- in case the mystery bulk-softdelete wiper fires again.
-- This is TEMPORARY — to be reverted (or the trap fully dropped) after A4+A5 land.

CREATE OR REPLACE FUNCTION public.dev_log_session_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_pid_info record;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT application_name, client_addr, query
    INTO v_pid_info
    FROM pg_stat_activity
   WHERE pid = pg_backend_pid();

  INSERT INTO public.dev_session_mutation_audit
    (op, user_id, session_id, old_row, new_row,
     application_name, client_addr, current_user_role, session_user_role,
     current_query)
  VALUES
    (TG_OP, v_user_id, COALESCE(NEW.id, OLD.id),
     to_jsonb(OLD), to_jsonb(NEW),
     v_pid_info.application_name, v_pid_info.client_addr,
     current_user::name, session_user::name,
     v_pid_info.query);

  RETURN COALESCE(NEW, OLD);
END
$function$;
