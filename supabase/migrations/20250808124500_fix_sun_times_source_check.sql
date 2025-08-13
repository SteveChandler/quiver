-- Align sun_times source check with app logic (allow 'computed')
begin;
do $$
begin
  if to_regclass('public.sun_times') is not null then
    -- Drop existing check if present (auto-named)
    begin
      alter table public.sun_times drop constraint if exists sun_times_source_check;
    exception when others then null; end;

    -- Recreate with expanded allowed values
    alter table public.sun_times
      add constraint sun_times_source_check
      check (source in ('open-meteo','computed'));
  end if;
end $$;
commit;


