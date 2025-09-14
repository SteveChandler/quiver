-- Rollback for beaches search and sources additions

begin;

-- Drop RLS policies and tables
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='beach_calibration') then
    drop trigger if exists trg_beach_calibration_set_updated_at on public.beach_calibration;
    drop table if exists public.beach_calibration cascade;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='beach_sources') then
    drop table if exists public.beach_sources cascade;
  end if;
end $$;

-- Drop triggers and functions
drop trigger if exists trg_set_beach_coordinates on public.beaches;
drop function if exists public.set_beach_coordinates();
drop function if exists public.set_updated_at();

-- Drop indexes
drop index if exists beaches_slug_unique;
drop index if exists idx_beaches_coordinates_gist;
drop index if exists idx_beaches_name_trgm;
drop index if exists idx_beaches_slug_trgm;
drop index if exists idx_beaches_alt_names_trgm;

-- Drop added columns (keep core lat/lon/name)
alter table public.beaches
  drop column if exists slug,
  drop column if exists popularity_score,
  drop column if exists swell_window,
  drop column if exists shore_aspect,
  drop column if exists alt_names,
  drop column if exists is_featured,
  drop column if exists coordinates,
  drop column if exists lng;

commit;


