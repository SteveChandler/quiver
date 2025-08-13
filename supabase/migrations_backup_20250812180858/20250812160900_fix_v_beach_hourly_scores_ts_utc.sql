-- Ensure ts_utc is timestamptz by aliasing m.ts directly

create or replace view public.v_beach_hourly_scores as
select
  m.beach_id,
  m.ts as ts_utc,
  abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int, 360) - 180) as wind_off_by_deg,
  greatest(
    0,
    (1 + cos(radians(abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
    * (1 - greatest(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
  ) as wind_score,
  coalesce(
    greatest(
      0,
      1 - abs((t.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
            / nullif((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
    ),
    0
  ) as tide_score,
  (
    with params as (
      select
        ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) as span,
        b.swell_window_min_deg as min_deg
    )
    select
      greatest(
        0,
        1 - greatest(
              0,
              abs(mod((m.wave_direction_deg - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
            )::float / 30.0
      )
    from params
  ) as swell_dir_score,
  0.0 as period_score,
  0.0 as height_score,
  round(
    100 * greatest(
      0,
      (0.4 * greatest(0,
        (1 + cos(radians(abs(mod((m.wind_direction_deg - b.wind_offshore_deg + 540)::int,360)-180))))/2
        * (1 - greatest(0, (m.wind_speed_ms * 1.94384449) - b.wind_cross_shore_ok_kt)::float / 10.0)
      ))
      + (0.2 * coalesce(
        greatest(
          0,
          1 - abs((t.tide_height_m * 3.28084) - ((b.preferred_tide_ft_min + b.preferred_tide_ft_max)/2.0))
                / nullif((b.preferred_tide_ft_max - b.preferred_tide_ft_min)/2.0,0)
        ), 0
      ))
      + (0.4 * (
        with params as (
          select ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) as span,
                 b.swell_window_min_deg as min_deg
        )
        select greatest(
          0,
          1 - greatest(0, abs(mod((m.wave_direction_deg - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0))::float / 30.0
        )
        from params
      ))
    )
    * 1
  )::int as score_0_100
from public.marine_forecasts m
left join public.tide_forecasts t
  on t.beach_id = m.beach_id and t.ts = m.ts
join public.beaches b
  on b.id = m.beach_id;

comment on view public.v_beach_hourly_scores is 'Per-hour beach suitability scores (0-100) based on wind (vs offshore), tide band, and swell window; units normalized and wrap-around handled. ts_utc is timestamptz.';
