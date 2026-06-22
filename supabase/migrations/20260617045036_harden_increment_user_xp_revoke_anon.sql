-- Supabase default privileges grant EXECUTE on new public functions to anon; the activation-loop
-- XP RPC must only be callable by authenticated users (the body already guards auth.uid()=p_user_id).
-- authenticated/service_role/postgres retain EXECUTE.
REVOKE EXECUTE ON FUNCTION public.increment_user_xp(uuid, integer, text, uuid, text) FROM anon;;
