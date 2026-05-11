-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- Add session_id column for anonymous visitor tracking
ALTER TABLE public.user_events ADD COLUMN IF NOT EXISTS session_id uuid;

-- Make user_id nullable (was NOT NULL) to support anonymous events
ALTER TABLE public.user_events ALTER COLUMN user_id DROP NOT NULL;

-- Require at least one identifier (user_id or session_id)
ALTER TABLE public.user_events ADD CONSTRAINT user_events_identity_check
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL);

-- Index for looking up anonymous events by session_id
CREATE INDEX IF NOT EXISTS idx_user_events_session_id
  ON public.user_events(session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- Index for finding unlinked anonymous events (for upgrade linking)
CREATE INDEX IF NOT EXISTS idx_user_events_session_id_unlinked
  ON public.user_events(session_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL;

-- Function to link anonymous events to a user after sign-up
CREATE OR REPLACE FUNCTION public.link_anonymous_events(p_session_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  UPDATE public.user_events
  SET user_id = p_user_id
  WHERE session_id = p_session_id
    AND user_id IS NULL
    AND created_at > now() - interval '30 days';

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;

-- Only callable via service role
GRANT EXECUTE ON FUNCTION public.link_anonymous_events(uuid, uuid) TO service_role;

COMMENT ON COLUMN public.user_events.session_id IS 'Anonymous visitor ID from localStorage, used to track pre-signup behavior';
COMMENT ON FUNCTION public.link_anonymous_events IS 'Links anonymous events to an authenticated user after sign-up. Called via service role from /api/events/link endpoint. Limited to events from the last 30 days.';

COMMIT;
