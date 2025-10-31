set check_function_bodies = off;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device text,
  app_version text,
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_devices_token_key on public.push_devices (token);
create index if not exists push_devices_user_id_idx on public.push_devices (user_id);

drop trigger if exists trg_push_devices_set_updated_at on public.push_devices;
create trigger trg_push_devices_set_updated_at
before update on public.push_devices
for each row execute function public.set_updated_at();

alter table public.push_devices enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_devices' and policyname = 'push_devices_select_own'
  ) then
    create policy push_devices_select_own
      on public.push_devices
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_devices' and policyname = 'push_devices_insert_own'
  ) then
    create policy push_devices_insert_own
      on public.push_devices
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_devices' and policyname = 'push_devices_update_own'
  ) then
    create policy push_devices_update_own
      on public.push_devices
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.push_devices is 'Stores device tokens captured from the Capacitor shell for future push campaigns.';
comment on column public.push_devices.platform is 'Reported Capacitor platform (ios, android, web).';
comment on column public.push_devices.device is 'Optional device identifier or model string supplied by the client.';
comment on column public.push_devices.app_version is 'Semantic app version recorded at registration time.';

commit;
