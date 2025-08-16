-- Add meta columns to public.beaches if missing
-- Includes orientation, swell window, tide preferences, and wind thresholds

BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS break_type text,
  ADD COLUMN IF NOT EXISTS aspect_deg int,
  ADD COLUMN IF NOT EXISTS offshore_deg int,
  ADD COLUMN IF NOT EXISTS swell_window_center_deg int,
  ADD COLUMN IF NOT EXISTS swell_window_halfwidth_deg int,
  ADD COLUMN IF NOT EXISTS tide_min_ft numeric,
  ADD COLUMN IF NOT EXISTS tide_max_ft numeric,
  ADD COLUMN IF NOT EXISTS wind_cross_ok_kts int DEFAULT 8,
  ADD COLUMN IF NOT EXISTS wind_onshore_bad_kts int DEFAULT 10;

COMMENT ON COLUMN public.beaches.break_type IS 'Primary break type (e.g., beach, point, reef)';
COMMENT ON COLUMN public.beaches.aspect_deg IS 'Beach aspect/orientation in degrees (0-360)';
COMMENT ON COLUMN public.beaches.offshore_deg IS 'Offshore wind direction in degrees (0-360)';
COMMENT ON COLUMN public.beaches.swell_window_center_deg IS 'Center direction of swell window (0-360)';
COMMENT ON COLUMN public.beaches.swell_window_halfwidth_deg IS 'Half-width of acceptable swell window in degrees';
COMMENT ON COLUMN public.beaches.tide_min_ft IS 'Minimum preferred tide level (feet)';
COMMENT ON COLUMN public.beaches.tide_max_ft IS 'Maximum preferred tide level (feet)';
COMMENT ON COLUMN public.beaches.wind_cross_ok_kts IS 'Cross-shore wind threshold (knots) considered acceptable';
COMMENT ON COLUMN public.beaches.wind_onshore_bad_kts IS 'Onshore wind threshold (knots) considered bad';

COMMIT;


