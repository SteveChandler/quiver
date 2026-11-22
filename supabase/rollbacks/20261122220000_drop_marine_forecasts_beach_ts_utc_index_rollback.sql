-- Recreate in a quiet window because the original build blocks writes.
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_beach_ts_utc ON public.marine_forecasts (beach_id, ts_utc);
