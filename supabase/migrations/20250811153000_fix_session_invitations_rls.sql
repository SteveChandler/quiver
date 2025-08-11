-- Fix RLS for session_invitations to avoid selecting from auth.users
-- Use JWT email claim instead to prevent "permission denied for table users"

begin;

-- Ensure RLS is enabled
alter table if exists public.session_invitations enable row level security;

-- Drop problematic policies if they exist
drop policy if exists "Users can view invitations they received" on public.session_invitations;
drop policy if exists "Users can respond to invitations they received" on public.session_invitations;

-- Re-create policy for viewing received invitations using jwt email
create policy "Users can view invitations they received"
on public.session_invitations
for select
using (
  -- Recipient by id
  (select auth.uid()) = invitee_id
  -- Or recipient by email from JWT claim
  or invitee_email = ((select auth.jwt()) ->> 'email')
);

-- Re-create policy for responding to received invitations
create policy "Users can respond to invitations they received"
on public.session_invitations
for update
using (
  (select auth.uid()) = invitee_id
  or invitee_email = ((select auth.jwt()) ->> 'email')
)
with check (
  (select auth.uid()) = invitee_id
  or invitee_email = ((select auth.jwt()) ->> 'email')
);

commit;


