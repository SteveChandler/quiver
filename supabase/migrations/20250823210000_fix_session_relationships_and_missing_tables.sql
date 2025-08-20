-- Fix missing foreign key relationships and create missing tables

begin;

-- Add foreign key constraints for sessions table to profiles (if not exists)
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sessions_profile_id_fkey'
  ) then
    alter table public.sessions 
      add constraint sessions_profile_id_fkey 
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Note: user_id column may not exist in remote database, skipping this constraint

-- Create comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comments_session_id on public.comments(session_id, created_at desc);
create index if not exists idx_comments_user_id on public.comments(user_id, created_at desc);

-- Enable RLS on comments
alter table public.comments enable row level security;

-- RLS policies for comments
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_select_all'
  ) then
    create policy comments_select_all on public.comments
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_insert_own'
  ) then
    create policy comments_insert_own on public.comments
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_update_own'
  ) then
    create policy comments_update_own on public.comments
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_delete_own'
  ) then
    create policy comments_delete_own on public.comments
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Create session_likes table
create table if not exists public.session_likes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(session_id, user_id)
);

create index if not exists idx_session_likes_session_id on public.session_likes(session_id);
create index if not exists idx_session_likes_user_id on public.session_likes(user_id);

-- Enable RLS on session_likes
alter table public.session_likes enable row level security;

-- RLS policies for session_likes
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='session_likes' and policyname='session_likes_select_all'
  ) then
    create policy session_likes_select_all on public.session_likes
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='session_likes' and policyname='session_likes_insert_own'
  ) then
    create policy session_likes_insert_own on public.session_likes
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='session_likes' and policyname='session_likes_delete_own'
  ) then
    create policy session_likes_delete_own on public.session_likes
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Create trigger function to update comments_count on sessions
create or replace function update_session_comments_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.sessions 
    set comments_count = comments_count + 1 
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sessions 
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.session_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

-- Create trigger for comments count
drop trigger if exists trigger_update_session_comments_count on public.comments;
create trigger trigger_update_session_comments_count
  after insert or delete on public.comments
  for each row execute function update_session_comments_count();

-- Create trigger function to update likes_count on sessions
create or replace function update_session_likes_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.sessions 
    set likes_count = likes_count + 1 
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sessions 
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.session_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

-- Create trigger for likes count
drop trigger if exists trigger_update_session_likes_count on public.session_likes;
create trigger trigger_update_session_likes_count
  after insert or delete on public.session_likes
  for each row execute function update_session_likes_count();

commit;