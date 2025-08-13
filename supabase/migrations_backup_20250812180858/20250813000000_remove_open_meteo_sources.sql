-- Remove Open-Meteo from source checks and clean existing data safely

do $$ begin
  if to_regclass('public.marine_forecasts') is not null then
    -- Drop existing source check constraint if it mentions open-meteo
    perform 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'marine_forecasts'
      and pg_get_constraintdef(c.oid) ilike '%open-meteo%';
    if found then
      -- Find the constraint name dynamically and drop it
      execute (
        select 'alter table public.marine_forecasts drop constraint ' || quote_ident(c.conname)
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname = 'marine_forecasts'
          and pg_get_constraintdef(c.oid) ilike '%open-meteo%'
        limit 1
      );
    end if;
    -- Add strict allowed sources
    alter table public.marine_forecasts
      add constraint marine_forecasts_source_chk check (source in ('cdip','ndbc'));
    -- Remove any lingering open-meteo rows to avoid violations
    delete from public.marine_forecasts where source = 'open-meteo';
  end if;
end $$;

do $$ begin
  if to_regclass('public.tide_forecasts') is not null then
    perform 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'tide_forecasts'
      and pg_get_constraintdef(c.oid) ilike '%open-meteo%';
    if found then
      execute (
        select 'alter table public.tide_forecasts drop constraint ' || quote_ident(c.conname)
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname = 'tide_forecasts'
          and pg_get_constraintdef(c.oid) ilike '%open-meteo%'
        limit 1
      );
    end if;
    alter table public.tide_forecasts
      add constraint tide_forecasts_source_chk check (source in ('noaa'));
    update public.tide_forecasts set source='noaa' where source='open-meteo';
  end if;
end $$;

do $$ begin
  if to_regclass('public.sun_times') is not null then
    perform 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'sun_times'
      and pg_get_constraintdef(c.oid) ilike '%open-meteo%';
    if found then
      execute (
        select 'alter table public.sun_times drop constraint ' || quote_ident(c.conname)
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname = 'sun_times'
          and pg_get_constraintdef(c.oid) ilike '%open-meteo%'
        limit 1
      );
    end if;
    alter table public.sun_times
      add constraint sun_times_source_chk check (source in ('computed'));
    update public.sun_times set source='computed' where source='open-meteo';
  end if;
end $$;


