-- Fix buoy table constraints to allow proper upserts
-- This migration addresses the ON CONFLICT error by creating the correct unique constraint

-- Drop the existing unique constraint on buoy_uuid
ALTER TABLE buoys DROP CONSTRAINT IF EXISTS buoys_buoy_uuid_key;

-- Create a composite unique constraint on (buoy_uuid, kind)
-- This allows the same buoy_uuid to exist with different kind values ('buoy' vs 'station')
ALTER TABLE buoys ADD CONSTRAINT buoys_buoy_uuid_kind_unique UNIQUE (buoy_uuid, kind);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_buoys_buoy_uuid ON buoys (buoy_uuid);
CREATE INDEX IF NOT EXISTS idx_buoys_kind ON buoys (kind);

-- Verify the constraint was created correctly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'buoys' 
    AND constraint_name = 'buoys_buoy_uuid_kind_unique'
    AND constraint_type = 'UNIQUE'
  ) THEN
    RAISE NOTICE 'SUCCESS: Composite unique constraint created on (buoy_uuid, kind)';
  ELSE
    RAISE EXCEPTION 'FAILED: Could not create composite unique constraint';
  END IF;
END $$; 