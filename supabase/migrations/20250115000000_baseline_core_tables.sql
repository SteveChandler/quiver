-- Baseline core tables to unblock local migrations (placed early)

create extension if not exists pgcrypto;
create extension if not exists postgis;

-- Minimal profiles
do $$ begin
  if to_regclass('public.profiles') is null then
    create table public.profiles (
      id uuid primary key default gen_random_uuid(),
      full_name text,
      created_at timestamptz not null default now()
    );
  end if;
end $$;

-- Minimal beaches
do $$ begin
  if to_regclass('public.beaches') is null then
    create table public.beaches (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      location text,
      latitude double precision,
      longitude double precision,
      is_private boolean not null default false,
      owner_id uuid references public.profiles(id) on delete set null,
      created_at timestamptz not null default now()
    );
    create unique index if not exists beaches_name_unique on public.beaches (lower(name));
  end if;
end $$;


