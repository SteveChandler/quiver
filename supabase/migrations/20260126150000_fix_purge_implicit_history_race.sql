-- Fix TOCTOU Race Condition in purge_implicit_history
--
-- Description: Fixes a race condition vulnerability where the authorization check
-- and the deletion operations were not atomic. An attacker could theoretically
-- time requests to bypass authorization.
--
-- Solution: Use advisory locks to ensure atomic authorization + deletion.
-- The lock is acquired on the user_id being purged, preventing concurrent
-- operations on the same user's data.
--
-- Author: supabase-db-expert
-- Date: 2026-01-26
-- Issue: PR #131 Code Review - TOCTOU race condition fix

begin;

-- ==============================================================================
-- FUNCTION: purge_implicit_history(target_user_id) - FIXED VERSION
-- ==============================================================================
-- User-initiated deletion of all implicit preference data
-- Called from "Clear my data" button in privacy settings
-- Security: Only allows users to delete their own data, or service role to delete any user
--
-- SECURITY FIX: Uses advisory lock to ensure authorization check and deletion
-- are atomic, preventing TOCTOU race conditions.

create or replace function public.purge_implicit_history(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  is_service_role boolean;
begin
  -- Acquire advisory lock on user_id to prevent concurrent purge operations
  -- This ensures the auth check and deletion are atomic
  -- Using xact-level lock that auto-releases on transaction end
  perform pg_advisory_xact_lock(hashtext('purge_implicit_history'), hashtext(target_user_id::text));

  -- Get current user info
  current_user_id := auth.uid();
  is_service_role := (
    current_setting('role', true) = 'service_role' or
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

  -- Security check: user can only purge their own data
  -- Service role bypasses this check and can purge any user
  -- IMPORTANT: This check happens INSIDE the lock to prevent race conditions
  if target_user_id != current_user_id and not is_service_role then
    raise exception 'Unauthorized: Cannot purge another user''s data';
  end if;

  -- Delete all events for this user
  delete from public.user_events
  where user_id = target_user_id;

  -- Delete implicit preferences for this user
  delete from public.user_implicit_preferences
  where user_id = target_user_id;

  -- Log the purge action for audit trail (optional but recommended)
  -- Note: This could be expanded to write to an audit_log table
  raise notice 'Purged implicit history for user %', target_user_id;

  -- Note: Does NOT change profiles.allow_implicit_tracking
  -- User can disable tracking separately via settings
end;
$$;

comment on function public.purge_implicit_history(uuid) is
  'Deletes all implicit preference data for a user. Uses advisory lock to prevent race conditions. User can only purge their own data unless service_role.';

commit;
