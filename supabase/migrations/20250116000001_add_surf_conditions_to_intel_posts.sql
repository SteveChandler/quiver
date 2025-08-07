-- Add surf condition fields to intel_posts table
-- This allows intel posts to include detailed surf condition data like session logging

-- Add surf condition columns to intel_posts
ALTER TABLE intel_posts 
ADD COLUMN wave_height DECIMAL(5,2),
ADD COLUMN wind_speed DECIMAL(5,2),
ADD COLUMN wind_direction TEXT,
ADD COLUMN water_temp INTEGER,
ADD COLUMN crowd_level INTEGER CHECK (crowd_level >= 1 AND crowd_level <= 5),
ADD COLUMN wave_types TEXT[], -- Array of wave type strings
ADD COLUMN forecast_accuracy TEXT CHECK (forecast_accuracy IN ('accurate', 'somewhat', 'inaccurate'));

-- Add comments for documentation
COMMENT ON COLUMN intel_posts.wave_height IS 'Wave height in feet (0-50)';
COMMENT ON COLUMN intel_posts.wind_speed IS 'Wind speed in mph (0-150)';
COMMENT ON COLUMN intel_posts.wind_direction IS 'Wind direction (N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS)';
COMMENT ON COLUMN intel_posts.water_temp IS 'Water temperature in Fahrenheit (32-100)';
COMMENT ON COLUMN intel_posts.crowd_level IS 'Crowd level rating from 1 (empty) to 5 (packed)';
COMMENT ON COLUMN intel_posts.wave_types IS 'Array of wave characteristics (fat, mushy, peaky, powerful, closeouts, barreling, reform, clean)';
COMMENT ON COLUMN intel_posts.forecast_accuracy IS 'How accurate was the forecast (accurate, somewhat, inaccurate)';

-- Create index for wave_height queries (useful for finding good surf spots)
CREATE INDEX IF NOT EXISTS intel_posts_wave_height_idx ON intel_posts(wave_height) WHERE wave_height IS NOT NULL;

-- Create index for wind conditions (useful for kiting/windsurfing spots)
CREATE INDEX IF NOT EXISTS intel_posts_wind_speed_idx ON intel_posts(wind_speed) WHERE wind_speed IS NOT NULL;

-- Create index for crowd level (useful for finding less crowded spots)
CREATE INDEX IF NOT EXISTS intel_posts_crowd_level_idx ON intel_posts(crowd_level) WHERE crowd_level IS NOT NULL;
