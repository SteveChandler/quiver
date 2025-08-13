-- Migration to add data_source column to enhanced_forecasts table
-- This tracks whether forecast data comes from real NOAA sources or fallback data

-- Add data_source column to enhanced_forecasts table
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    ALTER TABLE public.enhanced_forecasts 
      ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'FALLBACK';
  END IF;
END $$;

-- Drop existing constraint if it exists, then add it
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    ALTER TABLE public.enhanced_forecasts 
      DROP CONSTRAINT IF EXISTS check_data_source;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    ALTER TABLE public.enhanced_forecasts 
      ADD CONSTRAINT check_data_source 
      CHECK (data_source IN ('NOAA_NWS', 'FALLBACK'));
  END IF;
END $$;

-- Create index for efficient querying by data source
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_data_source 
    ON public.enhanced_forecasts (data_source);
  END IF;
END $$;

-- Create index for querying by beach and data source
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_data_source 
    ON public.enhanced_forecasts (beach_id, data_source);
  END IF;
END $$;

-- Update comment to reflect the new column
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    COMMENT ON TABLE public.enhanced_forecasts IS 'Comprehensive surf forecasts combining NOAA WaveWatch III, CO-OPS tidal data, and weather forecasts. Tracks data source transparency.';
  END IF;
END $$;

-- Update existing records to reflect their actual data source
-- Since current records are likely fallback data, they default to FALLBACK
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    UPDATE public.enhanced_forecasts 
    SET data_source = 'FALLBACK' 
    WHERE data_source IS NULL OR data_source = 'FALLBACK';
  END IF;
END $$;

-- Add comment for the new column
DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    COMMENT ON COLUMN public.enhanced_forecasts.data_source IS 'Data source indicator: NOAA_NWS for real NOAA data, FALLBACK for simulated/estimated data';
  END IF;
END $$;
