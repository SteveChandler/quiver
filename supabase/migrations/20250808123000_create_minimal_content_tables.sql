-- Minimal content tables required by the app (sessions, boards)
-- Guards to avoid conflicts; designed for local dev

begin;

-- Boards table
do $$
begin
  if to_regclass('public.boards') is null then
    create table public.boards (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      name text not null,
      board_type text not null,
      dimensions text not null,
      description text,
      image_url text,
      session_count integer default 0,
      size text,
      volume numeric,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  end if;
end $$;

-- Sessions table (matches app expectations)
do $$
begin
  if to_regclass('public.sessions') is null then
    create table public.sessions (
      id uuid primary key default gen_random_uuid(),
      profile_id uuid not null,
      user_id uuid not null,
      beach_id uuid not null references public.beaches(id) on delete cascade,
      board_id uuid references public.boards(id),
      arrival_time timestamptz not null default now(),
      duration_minutes integer not null default 60,
      goals text[] not null default '{}',
      notes text,
      invitee_ids uuid[] not null default '{}',
      created_at timestamptz not null default now(),
      status text default 'planned',
      beach_name text,
      rating smallint,
      description text,
      image_url text,
      likes_count integer not null default 0,
      comments_count integer not null default 0,
      crowd_level integer,
      wave_quality integer,
      water_temp numeric,
      parking_ease integer,
      is_public boolean default true
    );
    create index if not exists sessions_created_idx on public.sessions (created_at desc);
    create index if not exists sessions_user_idx on public.sessions (user_id, arrival_time desc);
    create index if not exists sessions_beach_idx on public.sessions (beach_id, created_at desc);
  end if;
end $$;

-- RLS: allow public select for local dev; writes require auth in app flows
alter table if exists public.sessions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='sessions' and policyname='sessions_select_all'
  ) then
    create policy sessions_select_all on public.sessions for select using (true);
  end if;
end $$;

commit;


