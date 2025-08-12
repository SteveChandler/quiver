-- Create hourly beach scoring view

create or replace view public.v_beach_hourly_scores as
select
  f.beach_id,
  f.ts at time zone 'UTC' as ts_utc,
  -- Wind dir closeness to offshore (0 best, 180 worst)
  abs(mod((f.wind_dir_deg - c.offshore_bearing_deg + 540)::int, 360) - 180) as wind_off_by_deg,
  -- Map 0..180 → 1..0 with a cosine falloff; penalize high onshore speed
  greatest(
    0,
    (1 + cos(radians(abs(mod((f.wind_dir_deg - c.offshore_bearing_deg + 540)::int,360)-180))))/2
    * (1 - greatest(0, f.wind_kts - c.wind_max_ok_kts)::float / 10.0)
  ) as wind_score,
  -- Tide: triangle around preferred mid inside min/max rails
  greatest(
    0,
    1 - abs(f.tide_ft - c.tide_mid_ft) / nullif((c.tide_max_ft - c.tide_min_ft)/2.0,0)
  ) as tide_score,
  -- Swell window: inside = 1, fade to 0 by 30° beyond window
  greatest(
    0,
    1 - greatest(0, least(
      abs(mod((f.swell_dir_deg - c.swell_min_deg + 360)::int,360)),
      abs(mod((c.swell_max_deg - f.swell_dir_deg + 360)::int,360))
    ) - (c.swell_max_deg - c.swell_min_deg))::float / 30.0
  ) as swell_dir_score,
  -- Period & height triangles
  greatest(0, 1 - abs(f.period_s - c.period_mid_s) / nullif(c.period_range_s/2.0,0)) as period_score,
  greatest(0, 1 - abs(f.height_ft - c.height_mid_ft) / nullif(c.height_range_ft/2.0,0)) as height_score,
  -- Weighted total
  round(
    100 *
    greatest(0,
      (c.w_wind   * ((1 + cos(radians(abs(mod((f.wind_dir_deg - c.offshore_bearing_deg + 540)::int,360)-180))))/2
                     * (1 - greatest(0, f.wind_kts - c.wind_max_ok_kts)::float / 10.0)))
    + (c.w_tide   * greatest(0, 1 - abs(f.tide_ft - c.tide_mid_ft) / nullif((c.tide_max_ft - c.tide_min_ft)/2.0,0)))
    + (c.w_swell  * greatest(0, 1 - greatest(0, least(
                        abs(mod((f.swell_dir_deg - c.swell_min_deg + 360)::int,360)),
                        abs(mod((c.swell_max_deg - f.swell_dir_deg + 360)::int,360))
                      ) - (c.swell_max_deg - c.swell_min_deg))::float / 30.0))
    + (c.w_period * greatest(0, 1 - abs(f.period_s - c.period_mid_s) / nullif(c.period_range_s/2.0,0)))
    + (c.w_height * greatest(0, 1 - abs(f.height_ft - c.height_mid_ft) / nullif(c.height_range_ft/2.0,0)))
    ) * coalesce(f.confidence_0_1, 1)
  )::int as score_0_100
from public.hourly_forecast f
join public.beach_recommendation_calibration c using (beach_id);

comment on view public.v_beach_hourly_scores is 'Per-hour beach suitability scores (0-100) based on wind, tide, swell, period, height, and data confidence.';
