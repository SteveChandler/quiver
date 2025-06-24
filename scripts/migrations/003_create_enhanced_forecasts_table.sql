-- Create enhanced_forecasts table for comprehensive 10-day surf forecasting
-- This table stores detailed wave, tide, and weather forecast data

CREATE TABLE IF NOT EXISTS enhanced_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL,
  forecast_date DATE NOT NULL,
  forecast_time TIME NOT NULL,
  
  -- Wave data from WaveWatch III (allow null when no data available)
  wave_height TEXT,
  wave_period TEXT,
  wave_direction TEXT,
  
  -- Detailed swell information (allow null when no data available)
  swell_1_height TEXT,
  swell_1_period TEXT,
  swell_1_direction TEXT,
  swell_2_height TEXT,
  swell_2_period TEXT,
  swell_2_direction TEXT,
  
  -- Wind wave data (allow null when no data available)
  wind_wave_height TEXT,
  wind_wave_period TEXT,
  wind_wave_direction TEXT,
  
  -- Weather data
  water_temp TEXT NOT NULL,
  air_temperature TEXT NOT NULL,
  wind_speed TEXT NOT NULL,
  wind_direction TEXT NOT NULL,
  weather_condition TEXT NOT NULL,
  
  -- Tide and current data from CO-OPS
  tide_status TEXT NOT NULL,
  tide_height TEXT NOT NULL,
  next_tide_time TEXT NOT NULL,
  next_tide_type TEXT NOT NULL,
  next_tide_height TEXT NOT NULL,
  current_speed TEXT NOT NULL,
  current_direction TEXT NOT NULL,
  
  -- Data quality
  confidence_score INTEGER NOT NULL DEFAULT 50,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT fk_enhanced_forecasts_beach
    FOREIGN KEY (beach_id) 
    REFERENCES beaches (id) 
    ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_id 
ON enhanced_forecasts (beach_id);

CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_date_time 
ON enhanced_forecasts (forecast_date, forecast_time);

CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_date 
ON enhanced_forecasts (beach_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_confidence 
ON enhanced_forecasts (confidence_score);

-- Create a function to clean up old forecast data (older than 1 day)
CREATE OR REPLACE FUNCTION cleanup_old_enhanced_forecasts()
RETURNS void AS $$
BEGIN
  DELETE FROM enhanced_forecasts 
  WHERE forecast_date < CURRENT_DATE 
  AND created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create a view for current day forecasts (with SECURITY INVOKER)
CREATE OR REPLACE VIEW current_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT * FROM enhanced_forecasts
WHERE forecast_date >= CURRENT_DATE
ORDER BY beach_id, forecast_date, forecast_time;

-- Create a view for next 10 days forecasts (with SECURITY INVOKER)
CREATE OR REPLACE VIEW ten_day_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT * FROM enhanced_forecasts
WHERE forecast_date >= CURRENT_DATE 
AND forecast_date <= CURRENT_DATE + INTERVAL '10 days'
ORDER BY beach_id, forecast_date, forecast_time;

-- Add RLS (Row Level Security)
ALTER TABLE enhanced_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS policies for enhanced_forecasts (public read access)
CREATE POLICY "Anyone can view enhanced forecasts" ON enhanced_forecasts
    FOR SELECT USING (true);

-- Admin/service role can insert/update/delete forecasts
CREATE POLICY "Service role can manage enhanced forecasts" ON enhanced_forecasts
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Add comment to table
COMMENT ON TABLE enhanced_forecasts IS 'Comprehensive surf forecasts combining NOAA WaveWatch III, CO-OPS tidal data, and weather forecasts'; 