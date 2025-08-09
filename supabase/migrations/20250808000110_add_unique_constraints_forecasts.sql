begin;

-- Unique constraints to support idempotent upserts
alter table public.marine_forecasts
  add constraint marine_forecasts_unique unique (beach_id, ts, source);

alter table public.tide_forecasts
  add constraint tide_forecasts_unique unique (beach_id, ts, source);

alter table public.sun_times
  add constraint sun_times_unique unique (beach_id, date, source);

commit;


