-- Recreate in a quiet window because the original build blocks writes.
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_nws_wind_mv_lookup
  ON public.marine_forecasts (beach_id, ts)
  INCLUDE (wind_speed_ms, wind_direction_deg)
  WHERE source = 'nws_wind';
