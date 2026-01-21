-- Migration: Create user_email_prefs table for email preferences
-- Part of Email Core Loop feature

-- Create the table
create table if not exists public.user_email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_frequency text not null default 'daily'
    check (email_frequency in ('daily', 'only_good', 'off')),
  min_good_score numeric not null default 6.0,
  skill_level text not null default 'beginner'
    check (skill_level in ('beginner', 'intermediate', 'advanced')),
  pref_time_bucket text not null default 'dawn'
    check (pref_time_bucket in ('dawn', 'after_work', 'weekends')),
  timezone text not null default 'America/Los_Angeles',
  home_beach_id uuid null references public.beaches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add comment
comment on table public.user_email_prefs is 'User preferences for email notifications';

-- Enable RLS
alter table public.user_email_prefs enable row level security;

-- RLS Policies
create policy "Users can view their own email prefs"
  on public.user_email_prefs for select
  using (auth.uid() = user_id);

create policy "Users can update their own email prefs"
  on public.user_email_prefs for update
  using (auth.uid() = user_id);

create policy "Users can insert their own email prefs"
  on public.user_email_prefs for insert
  with check (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
create policy "Service role has full access to email prefs"
  on public.user_email_prefs for all
  using (auth.role() = 'service_role');

-- Updated_at trigger
create or replace function public.update_user_email_prefs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_email_prefs_updated_at
  before update on public.user_email_prefs
  for each row execute function public.update_user_email_prefs_updated_at();

-- Index for timezone-based queries (daily email scheduling)
create index idx_user_email_prefs_timezone on public.user_email_prefs(timezone);
create index idx_user_email_prefs_frequency on public.user_email_prefs(email_frequency);
