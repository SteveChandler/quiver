-- Fix RLS policies for sessions table to allow authenticated users to insert/update their own sessions

begin;

-- Add INSERT policy for sessions (users can insert their own sessions)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='sessions' and policyname='sessions_insert_own'
  ) then
    create policy sessions_insert_own on public.sessions 
      for insert with check (auth.uid() = profile_id);
  end if;
end $$;

-- Add UPDATE policy for sessions (users can update their own sessions)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='sessions' and policyname='sessions_update_own'
  ) then
    create policy sessions_update_own on public.sessions 
      for update using (auth.uid() = profile_id);
  end if;
end $$;

-- Add DELETE policy for sessions (users can delete their own sessions)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='sessions' and policyname='sessions_delete_own'
  ) then
    create policy sessions_delete_own on public.sessions 
      for delete using (auth.uid() = profile_id);
  end if;
end $$;

commit;