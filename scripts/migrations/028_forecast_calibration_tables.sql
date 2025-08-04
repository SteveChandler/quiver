-- Forecast Calibration System Migration
-- Creates tables to support surf forecast calibration in Quiver
-- 
-- Strategy: Reuse existing sessions and enhanced_forecasts tables,
-- add minimal new tables for calibration data linking and accuracy stats

-- =====================================================
-- 1. SESSION FORECAST SNAPSHOTS TABLE
-- =====================================================
-- Links user sessions with forecast data that was active at session time
-- This enables accurate forecast vs actual conditions comparison

CREATE TABLE IF NOT EXISTS session_forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to existing session (actual conditions)
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Link to user and beach (for easy querying)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  
  -- Forecast snapshot at the time of session (JSONB for flexibility)
  -- Captures the forecast data that was available when the session occurred
  forecast_snapshot JSONB NOT NULL,
  
  -- Actual conditions from the session (JSONB for flexibility)
  -- Consolidated from session table + any additional conditions captured
  actual_conditions JSONB NOT NULL,
  
  -- Calibration metadata
  forecast_confidence_score INTEGER, -- Original forecast confidence
  data_source TEXT, -- NOAA_NWS, FALLBACK, etc.
  session_date DATE NOT NULL, -- Extracted from session for indexing
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. BEACH FORECAST ACCURACY TABLE
-- =====================================================
-- Stores rolling average accuracy statistics per beach for visualizations
-- Updated periodically based on session_forecast_snapshots data

CREATE TABLE IF NOT EXISTS beach_forecast_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Beach reference
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  
  -- Accuracy statistics (calculated from calibration data)
  avg_wave_height_delta NUMERIC(5,2), -- Average difference in feet
  avg_wind_speed_delta NUMERIC(5,2),  -- Average difference in mph
  avg_confidence_accuracy NUMERIC(5,2), -- How well confidence scores predict accuracy
  
  -- Sample statistics
  total_sessions_count INTEGER DEFAULT 0,
  last_30_days_count INTEGER DEFAULT 0,
  last_7_days_count INTEGER DEFAULT 0,
  
  -- Quality metrics
  overall_accuracy_score NUMERIC(5,2), -- Overall accuracy percentage (0-100)
  wave_height_accuracy NUMERIC(5,2),   -- Wave height specific accuracy
  wind_accuracy NUMERIC(5,2),          -- Wind condition accuracy
  
  -- Data freshness
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Session Forecast Snapshots indexes
CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_session_id 
ON session_forecast_snapshots(session_id);

CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_user_id 
ON session_forecast_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_beach_id 
ON session_forecast_snapshots(beach_id);

CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_date 
ON session_forecast_snapshots(session_date DESC);

CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_beach_date 
ON session_forecast_snapshots(beach_id, session_date DESC);

-- GIN index for JSONB queries on forecast and conditions data
CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_forecast_gin 
ON session_forecast_snapshots USING GIN (forecast_snapshot);

CREATE INDEX IF NOT EXISTS idx_session_forecast_snapshots_conditions_gin 
ON session_forecast_snapshots USING GIN (actual_conditions);

-- Beach Forecast Accuracy indexes
CREATE INDEX IF NOT EXISTS idx_beach_forecast_accuracy_beach_id 
ON beach_forecast_accuracy(beach_id);

CREATE INDEX IF NOT EXISTS idx_beach_forecast_accuracy_updated 
ON beach_forecast_accuracy(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_beach_forecast_accuracy_calculation_date 
ON beach_forecast_accuracy(calculation_date DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE session_forecast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE beach_forecast_accuracy ENABLE ROW LEVEL SECURITY;

-- Session Forecast Snapshots Policies
DROP POLICY IF EXISTS "Users can view their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can view their own session forecast snapshots" 
ON session_forecast_snapshots FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can insert their own session forecast snapshots" 
ON session_forecast_snapshots FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can update their own session forecast snapshots" 
ON session_forecast_snapshots FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can delete their own session forecast snapshots" 
ON session_forecast_snapshots FOR DELETE 
USING (auth.uid() = user_id);

-- Beach Forecast Accuracy Policies (public read access, admin write)
DROP POLICY IF EXISTS "Anyone can view beach forecast accuracy" ON beach_forecast_accuracy;
CREATE POLICY "Anyone can view beach forecast accuracy" 
ON beach_forecast_accuracy FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Service role can manage beach forecast accuracy" ON beach_forecast_accuracy;
CREATE POLICY "Service role can manage beach forecast accuracy" 
ON beach_forecast_accuracy FOR ALL 
USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.uid() = id 
    AND raw_app_meta_data->>'role' = 'admin'
  )
);

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to automatically create forecast snapshot when session is completed
CREATE OR REPLACE FUNCTION create_session_forecast_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
BEGIN
  -- Only create snapshot for completed sessions
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get forecast data that was active around the session time
    SELECT to_jsonb(ef.*) INTO forecast_data
    FROM enhanced_forecasts ef
    WHERE ef.beach_id::uuid = NEW.beach_id::uuid
    AND ef.forecast_date = NEW.arrival_time::date
    ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_time::time - NEW.arrival_time::time))) ASC
    LIMIT 1;
    
    -- Build actual conditions data from session
    conditions_data := jsonb_build_object(
      'wave_height', NEW.wave_height,
      'wave_quality', NEW.wave_quality,
      'water_temp', NEW.water_temp,
      'crowd_level', NEW.crowd_level,
      'crowd_rating', NEW.crowd_rating,
      'parking_ease', NEW.parking_ease,
      'rating', NEW.rating,
      'notes', NEW.notes,
      'duration_minutes', NEW.duration_minutes,
      'arrival_time', NEW.arrival_time
    );
    
    -- Insert forecast snapshot if we found matching forecast data
    IF forecast_data IS NOT NULL THEN
      INSERT INTO session_forecast_snapshots (
        session_id,
        user_id,
        beach_id,
        forecast_snapshot,
        actual_conditions,
        forecast_confidence_score,
        data_source,
        session_date
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.beach_id::uuid,
        forecast_data,
        conditions_data,
        (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source',
        NEW.arrival_time::date
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically capture forecast snapshots
DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON sessions;
CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER UPDATE OF status ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_session_forecast_snapshot();

-- Function to calculate and update beach accuracy statistics
CREATE OR REPLACE FUNCTION update_beach_forecast_accuracy(target_beach_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  beach_record RECORD;
BEGIN
  -- If no specific beach provided, update all beaches with recent sessions
  FOR beach_record IN 
    SELECT DISTINCT beach_id 
    FROM session_forecast_snapshots sfs
    WHERE (target_beach_id IS NULL OR beach_id = target_beach_id)
    AND created_at >= CURRENT_DATE - INTERVAL '90 days'
  LOOP
    
    -- Calculate accuracy statistics for this beach
    INSERT INTO beach_forecast_accuracy (
      beach_id,
      avg_wave_height_delta,
      avg_wind_speed_delta,
      total_sessions_count,
      last_30_days_count,
      last_7_days_count,
      overall_accuracy_score,
      calculation_date
    )
    SELECT 
      beach_record.beach_id,
      
      -- Calculate average wave height delta
      AVG(
        ABS(
          COALESCE((actual_conditions->>'wave_height')::numeric, 0) - 
          COALESCE((forecast_snapshot->>'wave_height')::numeric, 0)
        )
      ) as avg_wave_height_delta,
      
      -- Calculate average wind speed delta  
      AVG(
        ABS(
          COALESCE((actual_conditions->>'wind_speed')::numeric, 0) - 
          COALESCE((forecast_snapshot->>'wind_speed')::numeric, 0)
        )
      ) as avg_wind_speed_delta,
      
      -- Session counts
      COUNT(*) as total_sessions_count,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as last_30_days_count,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7_days_count,
      
      -- Overall accuracy score (simplified - can be enhanced)
      100 - LEAST(100, AVG(
        ABS(
          COALESCE((actual_conditions->>'wave_height')::numeric, 0) - 
          COALESCE((forecast_snapshot->>'wave_height')::numeric, 0)
        )
      ) * 20) as overall_accuracy_score,
      
      CURRENT_DATE as calculation_date
      
    FROM session_forecast_snapshots
    WHERE beach_id = beach_record.beach_id
    AND created_at >= CURRENT_DATE - INTERVAL '90 days'
    
    ON CONFLICT (beach_id) 
    DO UPDATE SET
      avg_wave_height_delta = EXCLUDED.avg_wave_height_delta,
      avg_wind_speed_delta = EXCLUDED.avg_wind_speed_delta,
      total_sessions_count = EXCLUDED.total_sessions_count,
      last_30_days_count = EXCLUDED.last_30_days_count,
      last_7_days_count = EXCLUDED.last_7_days_count,
      overall_accuracy_score = EXCLUDED.overall_accuracy_score,
      calculation_date = EXCLUDED.calculation_date,
      updated_at = CURRENT_TIMESTAMP;
      
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. UNIQUE CONSTRAINTS
-- =====================================================

-- Ensure one forecast snapshot per session
ALTER TABLE session_forecast_snapshots 
ADD CONSTRAINT unique_session_forecast_snapshot 
UNIQUE (session_id);

-- Ensure one accuracy record per beach
ALTER TABLE beach_forecast_accuracy 
ADD CONSTRAINT unique_beach_accuracy 
UNIQUE (beach_id);

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE session_forecast_snapshots IS 
'Links user surf sessions with forecast data that was active at session time for calibration analysis';

COMMENT ON COLUMN session_forecast_snapshots.forecast_snapshot IS 
'JSONB snapshot of forecast data (from enhanced_forecasts) that was active when the session occurred';

COMMENT ON COLUMN session_forecast_snapshots.actual_conditions IS 
'JSONB snapshot of actual conditions reported by the user during the session';

COMMENT ON TABLE beach_forecast_accuracy IS 
'Rolling average forecast accuracy statistics per beach for visualization and calibration improvements';

COMMENT ON FUNCTION create_session_forecast_snapshot() IS 
'Automatically captures forecast snapshots when sessions are marked as completed';

COMMENT ON FUNCTION update_beach_forecast_accuracy(UUID) IS 
'Calculates and updates forecast accuracy statistics for beaches based on session calibration data';

-- =====================================================
-- 8. INITIAL DATA SETUP (OPTIONAL)
-- =====================================================

-- Optionally populate accuracy table for existing beaches with some default values
INSERT INTO beach_forecast_accuracy (beach_id, total_sessions_count, overall_accuracy_score)
SELECT id, 0, 50.0 
FROM beaches 
ON CONFLICT (beach_id) DO NOTHING;

-- =====================================================
-- END MIGRATION
-- =====================================================

-- Summary of what this migration provides:
-- 
-- 1. ✅ REUSES EXISTING TABLES:
--    - sessions: Already captures actual conditions (wave_height, water_temp, etc.)
--    - enhanced_forecasts: Already has detailed forecast data with confidence scores
--    - beaches: Beach directory with location data
--    - profiles: User management
--
-- 2. ✅ ADDS MINIMAL NEW TABLES:
--    - session_forecast_snapshots: Links sessions to forecast data at session time
--    - beach_forecast_accuracy: Rolling accuracy statistics for visualizations
--
-- 3. ✅ PROVIDES CALIBRATION FEATURES:
--    - Automatic forecast snapshot capture when sessions completed
--    - Flexible JSONB storage for forecast and conditions data
--    - Accuracy calculation functions
--    - Performance indexes for calibration queries
--    - Proper security with RLS policies
--
-- 4. ✅ MAINTAINS ARCHITECTURAL CONSISTENCY:
--    - Follows existing UUID primary key patterns
--    - Uses standard created_at/updated_at timestamps  
--    - Implements proper foreign key constraints
--    - Enables Row Level Security following app patterns
--    - Uses JSONB for flexible data storage (existing pattern)