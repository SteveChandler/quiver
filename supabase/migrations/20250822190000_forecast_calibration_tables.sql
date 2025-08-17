-- Forecast Calibration System Migration (aligned to current sessions schema)

-- 1) Tables
CREATE TABLE IF NOT EXISTS session_forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  forecast_snapshot JSONB NOT NULL,
  actual_conditions JSONB NOT NULL,
  forecast_confidence_score INTEGER,
  data_source TEXT,
  session_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beach_forecast_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  avg_wave_height_delta NUMERIC(5,2),
  avg_wind_speed_delta NUMERIC(5,2),
  avg_confidence_accuracy NUMERIC(5,2),
  total_sessions_count INTEGER DEFAULT 0,
  last_30_days_count INTEGER DEFAULT 0,
  last_7_days_count INTEGER DEFAULT 0,
  overall_accuracy_score NUMERIC(5,2),
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_sfs_session_id ON session_forecast_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_sfs_user_id ON session_forecast_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_sfs_beach_id ON session_forecast_snapshots(beach_id);
CREATE INDEX IF NOT EXISTS idx_sfs_date ON session_forecast_snapshots(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_sfs_beach_date ON session_forecast_snapshots(beach_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_sfs_forecast_gin ON session_forecast_snapshots USING GIN (forecast_snapshot);
CREATE INDEX IF NOT EXISTS idx_sfs_actual_gin ON session_forecast_snapshots USING GIN (actual_conditions);

CREATE INDEX IF NOT EXISTS idx_bfa_beach_id ON beach_forecast_accuracy(beach_id);
CREATE INDEX IF NOT EXISTS idx_bfa_updated ON beach_forecast_accuracy(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bfa_calc_date ON beach_forecast_accuracy(calculation_date DESC);

-- 3) RLS
ALTER TABLE session_forecast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE beach_forecast_accuracy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can view their own session forecast snapshots"
ON session_forecast_snapshots FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can insert their own session forecast snapshots"
ON session_forecast_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can update their own session forecast snapshots"
ON session_forecast_snapshots FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own session forecast snapshots" ON session_forecast_snapshots;
CREATE POLICY "Users can delete their own session forecast snapshots"
ON session_forecast_snapshots FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view beach forecast accuracy" ON beach_forecast_accuracy;
CREATE POLICY "Anyone can view beach forecast accuracy"
ON beach_forecast_accuracy FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage beach forecast accuracy" ON beach_forecast_accuracy;
CREATE POLICY "Service role can manage beach forecast accuracy"
ON beach_forecast_accuracy FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.uid() = id 
    AND raw_app_meta_data->>'role' = 'admin'
  )
);

-- 4) Trigger to capture snapshots when sessions become completed
CREATE OR REPLACE FUNCTION create_session_forecast_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT to_jsonb(ef.*) INTO forecast_data
    FROM enhanced_forecasts ef
    WHERE ef.beach_id::uuid = NEW.beach_id::uuid
      AND ef.forecast_date = NEW.arrival_time::date
    ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_time::time - NEW.arrival_time::time))) ASC
    LIMIT 1;

    conditions_data := jsonb_build_object(
      'wave_quality', NEW.wave_quality,
      'water_temp', NEW.water_temp,
      'crowd_level', NEW.crowd_level,
      'parking_ease', NEW.parking_ease,
      'rating', NEW.rating,
      'notes', NEW.notes,
      'duration_minutes', NEW.duration_minutes,
      'arrival_time', NEW.arrival_time
    );

    IF forecast_data IS NOT NULL THEN
      INSERT INTO session_forecast_snapshots (
        session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
        forecast_confidence_score, data_source, session_date
      ) VALUES (
        NEW.id, NEW.user_id, NEW.beach_id::uuid, forecast_data, conditions_data,
        (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source', NEW.arrival_time::date
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON sessions;
CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER UPDATE OF status ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_session_forecast_snapshot();

-- 5) Constraints & initial rows
ALTER TABLE session_forecast_snapshots
  ADD CONSTRAINT unique_session_forecast_snapshot UNIQUE (session_id);

ALTER TABLE beach_forecast_accuracy
  ADD CONSTRAINT unique_beach_accuracy UNIQUE (beach_id);

INSERT INTO beach_forecast_accuracy (beach_id, total_sessions_count, overall_accuracy_score)
SELECT id, 0, 50.0 FROM beaches
ON CONFLICT (beach_id) DO NOTHING;


