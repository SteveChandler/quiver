-- Fix RLS for session_invitations to avoid selecting from auth.users
-- Use JWT email claim instead to prevent "permission denied for table users"

begin;

-- Ensure RLS is enabled (if table exists)
do $$ begin
  if to_regclass('public.session_invitations') is not null then
    alter table public.session_invitations enable row level security;
  else
    raise notice 'Skipping session_invitations RLS enable: table not found';
  end if;
end $$;

-- Drop problematic policies if they exist
do $$ begin
  if to_regclass('public.session_invitations') is not null then
    drop policy if exists "Users can view invitations they received" on public.session_invitations;
    drop policy if exists "Users can respond to invitations they received" on public.session_invitations;
  else
    raise notice 'Skipping policy drops: session_invitations not found';
  end if;
end $$;

-- Re-create policy for viewing received invitations using jwt email
do $$ begin
  if to_regclass('public.session_invitations') is not null then
    create policy "Users can view invitations they received"
    on public.session_invitations
    for select
    using (
      -- Recipient by id
      (select auth.uid()) = invitee_id
      -- Or recipient by email from JWT claim
      or invitee_email = ((select auth.jwt()) ->> 'email')
    );
  else
    raise notice 'Skipping policy create (select): session_invitations not found';
  end if;
end $$;

-- Re-create policy for responding to received invitations
do $$ begin
  if to_regclass('public.session_invitations') is not null then
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
  else
    raise notice 'Skipping policy create (update): session_invitations not found';
  end if;
end $$;

commit;


