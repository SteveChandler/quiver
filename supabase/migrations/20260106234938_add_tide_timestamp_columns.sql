-- Migration: Add next_tide_at and coops_station_id columns to enhanced_forecasts
-- Purpose: Fix tide timezone display bug by storing UTC timestamps instead of pre-formatted strings
-- The next_tide_at column stores canonical UTC time, allowing client-side timezone formatting
-- The coops_station_id column tracks which CO-OPS station was used for tide data

ALTER TABLE public.enhanced_forecasts
ADD COLUMN IF NOT EXISTS next_tide_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS coops_station_id TEXT;

COMMENT ON COLUMN public.enhanced_forecasts.next_tide_at IS 'UTC timestamp of next tide event (ISO 8601)';
COMMENT ON COLUMN public.enhanced_forecasts.coops_station_id IS 'NOAA CO-OPS station ID used for tide data (e.g., 9410230 for La Jolla)';

-- Create index for efficient queries by station
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_coops_station_id
ON public.enhanced_forecasts(coops_station_id)
WHERE coops_station_id IS NOT NULL;
