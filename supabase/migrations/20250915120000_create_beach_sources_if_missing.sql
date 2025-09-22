-- Create beach_sources mapping table if missing
-- Safe, idempotent migration (IF NOT EXISTS guards)

begin;

create table if not exists public.beach_sources (
  beach_id uuid primary key references public.beaches(id) on delete cascade,
  ndbc_buoy_ids text[] not null default '{}',
  forecast_source_id text,
  camera_url text,
  created_at timestamptz not null default now()
);

comment on table public.beach_sources is 'External source mappings per beach: NDBC buoy IDs, primary forecast source, camera URL';

-- Indexes
create index if not exists idx_beach_sources_beach_id on public.beach_sources (beach_id);

-- RLS: enable and add public read-only policy
alter table public.beach_sources enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='beach_sources' and policyname='select_all'
  ) then
    create policy select_all on public.beach_sources for select using (true);
  end if;
end $$;

commit;


