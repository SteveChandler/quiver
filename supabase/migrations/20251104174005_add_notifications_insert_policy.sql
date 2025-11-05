-- Add INSERT RLS policy for notifications table
-- Allows authenticated users to insert notifications
-- Note: Service role bypasses RLS, so no special check needed for backend services

begin;

-- Drop existing policy if it exists (for idempotency)
drop policy if exists "Authenticated users can insert notifications" on public.notifications;

-- Allow authenticated users to insert notifications
-- Backend Edge Functions use service role which bypasses RLS
-- This policy allows client-side notification creation if needed
create policy "Authenticated users can insert notifications" on public.notifications
  for insert with check (auth.uid() = user_id);

commit;
