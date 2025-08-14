-- Fix RLS for session_invitations to avoid selecting from auth.users
-- Use JWT email claim instead to prevent "permission denied for table users"

begin;

-- Ensure RLS is enabled only if table exists
do $$ begin
  if to_regclass('public.session_invitations') is not null then
    execute 'alter table public.session_invitations enable row level security';
  else
    raise notice 'Skipping RLS enable: session_invitations missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.session_invitations') is not null then
    drop policy if exists "Users can view invitations they received" on public.session_invitations;
    drop policy if exists "Users can respond to invitations they received" on public.session_invitations;
  else
    raise notice 'Skipping policy drops: session_invitations missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.session_invitations') is not null then
    create policy "Users can view invitations they received"
    on public.session_invitations
    for select
    using (
      (select auth.uid()) = invitee_id
      or invitee_email = ((select auth.jwt()) ->> 'email')
    );
  else
    raise notice 'Skipping policy create (select): session_invitations missing';
  end if;
end $$;

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
    raise notice 'Skipping policy create (update): session_invitations missing';
  end if;
end $$;

commit;


