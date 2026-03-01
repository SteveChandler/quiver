-- Migration: Add anonymous visitor tracking support
-- Description: Makes user_id nullable and adds session_id column to user_events
--              to support tracking pre-signup anonymous visitor behavior.
--              Includes a function to link anonymous events to a user after sign-up.
-- Date: 2026-03-01

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
-- Called by the authenticated linking endpoint
CREATE OR REPLACE FUNCTION public.link_anonymous_events(p_session_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_count integer;
BEGIN
  -- Only allow linking to the calling user (prevents claiming someone else's events)
  -- This function is called via service role from /api/events/link which validates auth
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  -- Only link events from the last 30 days to prevent historical session hijacking
  UPDATE public.user_events
  SET user_id = p_user_id
  WHERE session_id = p_session_id
    AND user_id IS NULL
    AND created_at > now() - interval '30 days';

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;

-- Only callable via service role (the API route handles auth validation)
-- Do NOT grant to authenticated role — prevents direct RPC abuse
GRANT EXECUTE ON FUNCTION public.link_anonymous_events(uuid, uuid) TO service_role;

-- NOTE ON RLS: Anonymous inserts use createServiceRoleClient() which bypasses RLS entirely.
-- The existing INSERT policy requires auth.uid() = user_id, which fails for NULL user_id rows.
-- This is intentional: anonymous events can ONLY be inserted via the service role path in
-- /api/events/route.ts, which validates sessionId format and restricts event types.
-- If anonymous inserts are ever moved away from service role, an explicit RLS INSERT policy
-- must be added for the (user_id IS NULL, session_id IS NOT NULL) pattern.

COMMENT ON COLUMN public.user_events.session_id IS 'Anonymous visitor ID from localStorage, used to track pre-signup behavior';
COMMENT ON FUNCTION public.link_anonymous_events IS 'Links anonymous events to an authenticated user after sign-up. Called via service role from /api/events/link endpoint. Limited to events from the last 30 days.';

COMMIT;

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================
-- To rollback this migration, run the following SQL:
--
-- BEGIN;
--
-- DROP FUNCTION IF EXISTS public.link_anonymous_events(uuid, uuid);
--
-- DROP INDEX IF EXISTS idx_user_events_session_id_unlinked;
-- DROP INDEX IF EXISTS idx_user_events_session_id;
--
-- ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_identity_check;
--
-- -- NOTE: Re-adding NOT NULL requires no NULL user_id rows exist.
-- -- Check first: SELECT COUNT(*) FROM public.user_events WHERE user_id IS NULL;
-- -- If rows exist, delete or reassign them before proceeding.
-- ALTER TABLE public.user_events ALTER COLUMN user_id SET NOT NULL;
--
-- ALTER TABLE public.user_events DROP COLUMN IF EXISTS session_id;
--
-- COMMIT;
-- =============================================================================
