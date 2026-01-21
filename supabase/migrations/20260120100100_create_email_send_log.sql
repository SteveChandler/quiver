-- Migration: Create email_send_log table for tracking sent emails
-- Part of Email Core Loop feature

create table if not exists public.email_send_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('welcome', 'daily_best_window', 'heads_up_alert')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  subject text not null,
  best_score numeric null,
  best_beach_id uuid null references public.beaches(id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);

comment on table public.email_send_log is 'Log of all emails sent to users for deduplication and analytics';

-- Enable RLS
alter table public.email_send_log enable row level security;

-- Users can view their own email logs
create policy "Users can view their own email logs"
  on public.email_send_log for select
  using (auth.uid() = user_id);

-- Service role has full access (for Edge Functions)
create policy "Service role has full access to email logs"
  on public.email_send_log for all
  using (auth.role() = 'service_role');

-- Unique constraint: one email type per user per day
create unique index uniq_email_per_user_per_type_per_day
  on public.email_send_log(user_id, email_type, local_date);

-- Index for finding users who haven't been sent today
create index idx_email_send_log_type_date on public.email_send_log(email_type, local_date);
