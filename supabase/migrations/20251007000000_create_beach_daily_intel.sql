-- Create beach_daily_intel table for storing pre-computed surf intelligence
-- This enables instant loading of surf recommendations without edge function calls

BEGIN;

-- Main intel table
CREATE TABLE IF NOT EXISTS beach_daily_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  
  -- Generation metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_time TEXT NOT NULL, -- '06:00', '10:00', '14:00'
  forecast_date DATE NOT NULL,
  
  -- Best window recommendation
  best_window_start TIME,
  best_window_end TIME,
  best_window_description TEXT, -- "6-8am on mid-tide"
  
  -- Surf conditions
  surf_min_ft NUMERIC,
  surf_max_ft NUMERIC,
  surf_description TEXT, -- "waist-high", "chest-high"
  
  -- Tide information
  tide_height_ft NUMERIC,
  tide_time TIME,
  tide_status TEXT, -- "rising", "falling", "slack"
  tide_optimal_range TEXT, -- "2-5 ft"
  next_tide_type TEXT, -- "HIGH", "LOW"
  next_tide_time TEXT,
  next_tide_height_ft NUMERIC,
  
  -- Wind conditions
  wind_speed_mph NUMERIC,
  wind_direction_deg NUMERIC,
  wind_direction_text TEXT, -- "N", "NW", etc
  wind_quality TEXT, -- "offshore", "onshore", "cross-shore"
  wind_description TEXT, -- "5 mph offshore (clean)"
  
  -- Swell details
  primary_swell_height_ft NUMERIC,
  primary_swell_period_s NUMERIC,
  primary_swell_direction_deg NUMERIC,
  primary_swell_direction_text TEXT,
  
  secondary_swell_height_ft NUMERIC,
  secondary_swell_period_s NUMERIC,
  secondary_swell_direction_deg NUMERIC,
  secondary_swell_direction_text TEXT,
  
  -- Analysis
  confidence TEXT NOT NULL, -- "Low", "Medium", "High"
  recommendation TEXT, -- Human-readable summary paragraph
  conditions_score INTEGER, -- 0-100
  
  -- Full data for advanced display
  raw_intel_data JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT beach_daily_intel_unique 
    UNIQUE (beach_id, forecast_date, generation_time)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_beach_daily_intel_lookup 
  ON beach_daily_intel (beach_id, forecast_date, generation_time DESC);

CREATE INDEX IF NOT EXISTS idx_beach_daily_intel_latest
  ON beach_daily_intel (beach_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_beach_daily_intel_cleanup 
  ON beach_daily_intel (created_at);

-- RLS Policies (public read access)
ALTER TABLE beach_daily_intel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON beach_daily_intel;
CREATE POLICY "Allow public read access"
  ON beach_daily_intel FOR SELECT
  USING (true);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_beach_daily_intel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_beach_daily_intel_updated_at_trigger ON beach_daily_intel;
CREATE TRIGGER update_beach_daily_intel_updated_at_trigger
    BEFORE UPDATE ON beach_daily_intel
    FOR EACH ROW
    EXECUTE FUNCTION update_beach_daily_intel_updated_at();

-- Auto-cleanup function (keep last 3 days)
CREATE OR REPLACE FUNCTION cleanup_old_beach_intel()
RETURNS void AS $$
BEGIN
    DELETE FROM beach_daily_intel
    WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE beach_daily_intel IS 'Pre-computed surf intelligence for beaches, updated 3x daily (6am, 10am, 2pm PT). Provides instant surf window recommendations without edge function calls.';

COMMIT;

