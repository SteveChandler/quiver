-- Migration: Create saved_windows table for user-saved surf windows
-- Part of Email Core Loop feature

create table if not exists public.saved_windows (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id uuid not null references public.beaches(id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  source text not null default 'email' check (source in ('email', 'app')),
  created_at timestamptz not null default now()
);

comment on table public.saved_windows is 'Surf windows saved by users from emails or app';

-- Enable RLS
alter table public.saved_windows enable row level security;

-- Users can view their own saved windows
create policy "Users can view their own saved windows"
  on public.saved_windows for select
  using (auth.uid() = user_id);

-- Users can insert their own saved windows
create policy "Users can insert their own saved windows"
  on public.saved_windows for insert
  with check (auth.uid() = user_id);

-- Users can delete their own saved windows
create policy "Users can delete their own saved windows"
  on public.saved_windows for delete
  using (auth.uid() = user_id);

-- Service role has full access
create policy "Service role has full access to saved windows"
  on public.saved_windows for all
  using (auth.role() = 'service_role');

-- Prevent duplicate saves of same window
create unique index uniq_saved_window
  on public.saved_windows(user_id, beach_id, start_ts, end_ts);

-- Index for finding user's recent windows
create index idx_saved_windows_user_created
  on public.saved_windows(user_id, created_at desc);
