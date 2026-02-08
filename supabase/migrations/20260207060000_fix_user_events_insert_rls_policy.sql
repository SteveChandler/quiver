-- Fix: user_events INSERT RLS policy was too restrictive.
--
-- The old policy required a profile row with allow_implicit_tracking = true.
-- This silently rejected inserts for users without a profile row yet,
-- causing most authenticated users' events to be dropped.
--
-- The new policy defaults to ALLOW, only blocking when a profile
-- explicitly sets allow_implicit_tracking = false.
-- This matches the API-level logic in app/api/events/route.ts:141.
--
-- Rollback: re-run the original CREATE POLICY from
-- 20260125120002_implicit_preference_learning.sql lines 244-255.

drop policy if exists "Users can insert their own events" on public.user_events;

create policy "Users can insert their own events"
  on public.user_events
  for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and allow_implicit_tracking = false
    )
  );
