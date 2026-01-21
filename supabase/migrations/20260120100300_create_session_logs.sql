-- Migration: Create session_logs table for user session feedback
-- Part of Email Core Loop feature (the "memory" component)

create table if not exists public.session_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id uuid not null references public.beaches(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz null,
  rating text not null check (rating in ('skip', 'good', 'fired')),
  notes text null,
  source text not null default 'email' check (source in ('email', 'app', 'manual')),
  predicted_score numeric null,
  created_at timestamptz not null default now()
);

comment on table public.session_logs is 'User feedback on surf sessions - used to personalize future recommendations';

-- Enable RLS
alter table public.session_logs enable row level security;

-- Users can view their own session logs
create policy "Users can view their own session logs"
  on public.session_logs for select
  using (auth.uid() = user_id);

-- Users can insert their own session logs
create policy "Users can insert their own session logs"
  on public.session_logs for insert
  with check (auth.uid() = user_id);

-- Users can update their own session logs
create policy "Users can update their own session logs"
  on public.session_logs for update
  using (auth.uid() = user_id);

-- Service role has full access
create policy "Service role has full access to session logs"
  on public.session_logs for all
  using (auth.role() = 'service_role');

-- Index for user session history
create index idx_session_logs_user_created
  on public.session_logs(user_id, created_at desc);

-- Index for analyzing prediction accuracy
create index idx_session_logs_rating_score
  on public.session_logs(rating, predicted_score)
  where predicted_score is not null;
