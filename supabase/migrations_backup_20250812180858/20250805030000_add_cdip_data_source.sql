-- Migration to add CDIP as a valid data source
-- Updates the check_data_source constraint to include CDIP

DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    -- Drop existing constraint if it exists
    ALTER TABLE public.enhanced_forecasts 
    DROP CONSTRAINT IF EXISTS check_data_source;

    -- Add updated constraint including CDIP
    ALTER TABLE public.enhanced_forecasts 
    ADD CONSTRAINT check_data_source 
    CHECK (data_source IN ('NOAA_NWS', 'CDIP', 'FALLBACK'));

    -- Comment the constraint for documentation
    COMMENT ON CONSTRAINT check_data_source ON public.enhanced_forecasts 
    IS 'Ensures data_source is one of: NOAA_NWS (real NOAA data), CDIP (real CDIP buoy data), or FALLBACK (synthetic/default data)';
  ELSE
    RAISE NOTICE 'Skipping CDIP data_source constraint update: enhanced_forecasts not found';
  END IF;
END $$;