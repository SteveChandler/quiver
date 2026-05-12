-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE public.enhanced_forecasts
  ADD COLUMN IF NOT EXISTS wind_direction_deg numeric;
COMMENT ON COLUMN public.enhanced_forecasts.wind_direction_deg IS 'Wind direction in degrees (0-360), computed from cardinal direction text';
