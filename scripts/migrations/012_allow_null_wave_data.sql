-- Migration to allow null values for wave-related fields in enhanced_forecasts table
-- This removes the requirement for fake wave height values when no data is available

-- Alter wave-related columns to allow null values
ALTER TABLE enhanced_forecasts 
  ALTER COLUMN wave_height DROP NOT NULL,
  ALTER COLUMN wave_period DROP NOT NULL, 
  ALTER COLUMN wave_direction DROP NOT NULL,
  ALTER COLUMN swell_1_height DROP NOT NULL,
  ALTER COLUMN swell_1_period DROP NOT NULL,
  ALTER COLUMN swell_1_direction DROP NOT NULL,
  ALTER COLUMN swell_2_height DROP NOT NULL,
  ALTER COLUMN swell_2_period DROP NOT NULL,
  ALTER COLUMN swell_2_direction DROP NOT NULL,
  ALTER COLUMN wind_wave_height DROP NOT NULL,
  ALTER COLUMN wind_wave_period DROP NOT NULL,
  ALTER COLUMN wind_wave_direction DROP NOT NULL;

-- Update any existing fake default values to null
UPDATE enhanced_forecasts 
SET 
  wave_height = NULL 
WHERE wave_height IN ('2-3 ft', '1-2 ft', '0.5-1 ft', '0.5 ft');

UPDATE enhanced_forecasts 
SET 
  swell_1_height = NULL 
WHERE swell_1_height IN ('1-2 ft', '0.5-1 ft');

UPDATE enhanced_forecasts 
SET 
  swell_2_height = NULL 
WHERE swell_2_height IN ('0.5-1 ft', '0.5 ft');

UPDATE enhanced_forecasts 
SET 
  wind_wave_height = NULL 
WHERE wind_wave_height IN ('0.5 ft', '1-2 ft');

-- Update fake period values to null
UPDATE enhanced_forecasts 
SET 
  wave_period = NULL 
WHERE wave_period IN ('8s', '10s', '12s', '4s');

UPDATE enhanced_forecasts 
SET 
  swell_1_period = NULL 
WHERE swell_1_period = '10s';

UPDATE enhanced_forecasts 
SET 
  swell_2_period = NULL 
WHERE swell_2_period = '12s';

UPDATE enhanced_forecasts 
SET 
  wind_wave_period = NULL 
WHERE wind_wave_period = '4s';

-- Update fake direction values to null
UPDATE enhanced_forecasts 
SET 
  wave_direction = NULL 
WHERE wave_direction IN ('W', 'SW', 'Variable');

UPDATE enhanced_forecasts 
SET 
  swell_1_direction = NULL 
WHERE swell_1_direction = 'SW';

UPDATE enhanced_forecasts 
SET 
  swell_2_direction = NULL 
WHERE swell_2_direction = 'W';

UPDATE enhanced_forecasts 
SET 
  wind_wave_direction = NULL 
WHERE wind_wave_direction = 'SW'; 