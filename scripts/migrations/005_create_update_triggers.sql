-- Create triggers for automatic timestamp updates and coordinate maintenance
-- Ensures data consistency and matches Ruby ActiveRecord behavior

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for buoys table
DROP TRIGGER IF EXISTS update_buoys_updated_at ON buoys;
CREATE TRIGGER update_buoys_updated_at
  BEFORE UPDATE ON buoys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for beaches table  
DROP TRIGGER IF EXISTS update_beaches_updated_at ON beaches;
CREATE TRIGGER update_beaches_updated_at
  BEFORE UPDATE ON beaches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update coordinates when lat/lng changes
CREATE OR REPLACE FUNCTION update_coordinates_from_lat_lng()
RETURNS TRIGGER AS $$
BEGIN
  -- For buoys table (if it had separate lat/lng columns)
  IF TG_TABLE_NAME = 'buoys' THEN
    -- Buoys use coordinates directly, no separate lat/lng columns
    RETURN NEW;
  END IF;
  
  -- For beaches table
  IF TG_TABLE_NAME = 'beaches' THEN
    IF NEW.latitude IS DISTINCT FROM OLD.latitude 
       OR NEW.longitude IS DISTINCT FROM OLD.longitude THEN
      NEW.coordinates = ST_Point(NEW.longitude, NEW.latitude)::geography;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for beaches coordinate updates
DROP TRIGGER IF EXISTS update_beaches_coordinates ON beaches;
CREATE TRIGGER update_beaches_coordinates
  BEFORE UPDATE ON beaches
  FOR EACH ROW
  EXECUTE FUNCTION update_coordinates_from_lat_lng();

-- Function to automatically set coordinates on insert for beaches
CREATE OR REPLACE FUNCTION set_coordinates_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'beaches' THEN
    IF NEW.coordinates IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.coordinates = ST_Point(NEW.longitude, NEW.latitude)::geography;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for beaches coordinate creation on insert
DROP TRIGGER IF EXISTS set_beaches_coordinates_on_insert ON beaches;
CREATE TRIGGER set_beaches_coordinates_on_insert
  BEFORE INSERT ON beaches
  FOR EACH ROW
  EXECUTE FUNCTION set_coordinates_on_insert();

-- Add validation constraint to ensure coordinates match lat/lng for beaches
-- This helps maintain data consistency
ALTER TABLE beaches 
DROP CONSTRAINT IF EXISTS check_coordinates_match_lat_lng;

ALTER TABLE beaches 
ADD CONSTRAINT check_coordinates_match_lat_lng 
CHECK (
  coordinates IS NULL 
  OR latitude IS NULL 
  OR longitude IS NULL
  OR (
    abs(ST_Y(coordinates::geometry) - latitude) < 0.000001 
    AND abs(ST_X(coordinates::geometry) - longitude) < 0.000001
  )
);

-- Add comments for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 
'Automatically updates the updated_at timestamp when a record is modified.';

COMMENT ON FUNCTION update_coordinates_from_lat_lng() IS 
'Automatically updates PostGIS coordinates when latitude/longitude values change.';

COMMENT ON FUNCTION set_coordinates_on_insert() IS 
'Automatically sets PostGIS coordinates from latitude/longitude on new record creation.'; 