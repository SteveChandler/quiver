-- Ensure beaches.region_id exists for functions that reference it
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beaches'
      and column_name = 'region_id'
  ) then
    alter table public.beaches add column region_id uuid null;
  end if;
end $$;

-- Optional index for lookups (safe if exists)
create index if not exists beaches_region_id_idx on public.beaches(region_id);


