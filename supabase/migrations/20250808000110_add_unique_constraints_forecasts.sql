begin;

-- Unique constraints to support idempotent upserts (guarded)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marine_forecasts_unique'
      and conrelid = 'public.marine_forecasts'::regclass
  ) then
    alter table public.marine_forecasts
      add constraint marine_forecasts_unique unique (beach_id, ts, source);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tide_forecasts_unique'
      and conrelid = 'public.tide_forecasts'::regclass
  ) then
    alter table public.tide_forecasts
      add constraint tide_forecasts_unique unique (beach_id, ts, source);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sun_times_unique'
      and conrelid = 'public.sun_times'::regclass
  ) then
    alter table public.sun_times
      add constraint sun_times_unique unique (beach_id, date, source);
  end if;
end $$;

commit;


