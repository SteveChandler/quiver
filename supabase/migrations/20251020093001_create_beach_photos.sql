create table if not exists public.beach_photos (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  source text not null check (source in ('openverse', 'flickr', 'unsplash', 'pexels', 'wikimedia', 'user')),
  source_id text not null,
  image_url text not null,
  thumb_url text,
  title text,
  creator_name text,
  creator_url text,
  license_code text,
  license_url text,
  attribution_html text,
  fetched_at timestamptz not null default now(),
  approved boolean not null default true,
  unique (beach_id, source, source_id)
);

create or replace view public.beach_photos_featured as
select distinct on (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
from public.beach_photos
where approved is true
order by beach_id, fetched_at desc;

alter table public.beach_photos enable row level security;

create policy beach_photos_read on public.beach_photos
  for select
  using (true);
