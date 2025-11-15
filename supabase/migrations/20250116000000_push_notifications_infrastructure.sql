-- Push Notifications Infrastructure
-- Adds user_devices and notifications tables for FCM push notifications

begin;

-- Device tokens for push notifications
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  device_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_token)
);

create index if not exists idx_user_devices_user_id on public.user_devices(user_id);
create index if not exists idx_user_devices_token on public.user_devices(device_token);

-- In-app notification records
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('session_invite', 'session_update', 'comment', 'like', 'follow')),
  data jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id, read_at) where read_at is null;

-- Enable RLS
alter table public.user_devices enable row level security;
alter table public.notifications enable row level security;

-- RLS Policies for user_devices

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Users can insert their own devices" on public.user_devices;
drop policy if exists "Users can view their own devices" on public.user_devices;
drop policy if exists "Users can delete their own devices" on public.user_devices;
drop policy if exists "Users can update their own devices" on public.user_devices;

-- Users can insert their own device tokens
create policy "Users can insert their own devices" on public.user_devices
  for insert with check (auth.uid() = user_id);

-- Users can view their own device tokens
create policy "Users can view their own devices" on public.user_devices
  for select using (auth.uid() = user_id);

-- Users can delete their own device tokens
create policy "Users can delete their own devices" on public.user_devices
  for delete using (auth.uid() = user_id);

-- Users can update their own device tokens
create policy "Users can update their own devices" on public.user_devices
  for update using (auth.uid() = user_id);

-- RLS Policies for notifications

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;

-- Users can view their own notifications
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- Note: No INSERT policy for notifications table
-- Notifications are created server-side only via service role client (bypassing RLS)
-- This prevents clients from creating arbitrary notifications

-- Note: updated_at trigger for user_devices is added in migration 20251114015909

commit;





























