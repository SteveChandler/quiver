do $$ begin
  -- marine_forecasts unique
  if to_regclass('public.marine_forecasts') is not null then
    begin
      alter table public.marine_forecasts
        add constraint marine_forecasts_unique unique (beach_id, ts, source);
    exception when duplicate_object then
      raise notice 'marine_forecasts_unique already exists, skipping';
    end;
  else
    raise notice 'Skipping marine unique: marine_forecasts not found';
  end if;

  -- tide_forecasts unique
  if to_regclass('public.tide_forecasts') is not null then
    begin
      alter table public.tide_forecasts
        add constraint tide_forecasts_unique unique (beach_id, ts, source);
    exception when duplicate_object then
      raise notice 'tide_forecasts_unique already exists, skipping';
    end;
  else
    raise notice 'Skipping tide unique: tide_forecasts not found';
  end if;

  -- sun_times unique
  if to_regclass('public.sun_times') is not null then
    begin
      alter table public.sun_times
        add constraint sun_times_unique unique (beach_id, date, source);
    exception when duplicate_object then
      raise notice 'sun_times_unique already exists, skipping';
    end;
  else
    raise notice 'Skipping sun_times unique: sun_times not found';
  end if;
end $$;


