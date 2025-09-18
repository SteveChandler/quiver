-- Normalize invitee_email and make RLS case-insensitive for email matching

begin;

-- Backfill: lower-case all existing invitee_email values
update public.session_invitations
set invitee_email = lower(invitee_email)
where invitee_email is not null;

-- Ensure a functional index supports lower(email) lookups if needed later
create index if not exists idx_session_invitations_invitee_email_lower
on public.session_invitations (lower(invitee_email));

-- Update RLS to compare lowercased values
drop policy if exists "Users can view invitations they received" on public.session_invitations;
create policy "Users can view invitations they received"
on public.session_invitations
for select
using (
  (select auth.uid()) = invitee_id
  or lower(invitee_email) = lower(((select auth.jwt()) ->> 'email'))
);

drop policy if exists "Users can respond to invitations they received" on public.session_invitations;
create policy "Users can respond to invitations they received"
on public.session_invitations
for update
using (
  (select auth.uid()) = invitee_id
  or lower(invitee_email) = lower(((select auth.jwt()) ->> 'email'))
)
with check (
  (select auth.uid()) = invitee_id
  or lower(invitee_email) = lower(((select auth.jwt()) ->> 'email'))
);

commit;


