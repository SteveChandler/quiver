-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Migration: Add forecast_at timestamptz column to enhanced_forecasts
-- The existing forecast_date + forecast_time columns store UTC values
-- (written by Vercel server using date.getHours() which returns UTC).
-- We combine them into a proper timestamptz column.

BEGIN;

-- 1. Add the new column (nullable initially for backfill)
ALTER TABLE public.enhanced_forecasts
  ADD COLUMN IF NOT EXISTS forecast_at timestamptz;

-- 2. Backfill from existing data
-- forecast_date + forecast_time are UTC values (generated on Vercel UTC server)
UPDATE public.enhanced_forecasts
SET forecast_at = (forecast_date || 'T' || forecast_time || 'Z')::timestamptz
WHERE forecast_at IS NULL;

-- 3. Make it NOT NULL after backfill
ALTER TABLE public.enhanced_forecasts
  ALTER COLUMN forecast_at SET NOT NULL;

-- 4. Add new index for common query pattern (beach + time range)
CREATE INDEX IF NOT EXISTS idx_ef_beach_forecast_at
  ON public.enhanced_forecasts (beach_id, forecast_at);

-- 5. Add unique constraint for upserts (will coexist with old constraint during transition)
ALTER TABLE public.enhanced_forecasts
  ADD CONSTRAINT enhanced_forecasts_beach_forecast_at_unique
  UNIQUE (beach_id, forecast_at);

COMMIT;
