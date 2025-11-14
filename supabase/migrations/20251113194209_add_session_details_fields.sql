-- ================================================
-- Migration: Add Session Details Fields
-- ================================================
-- Description: Add missing session condition fields that were being collected
--              in the UI but not saved to the database.
--
-- Fields Added:
--   1. wave_height_ft     - Actual wave height in feet (user-reported)
--   2. wind_speed_mph     - Wind speed in mph (user-reported)
--   3. wind_direction     - Wind direction (N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS)
--   4. forecast_accuracy  - User feedback on forecast accuracy (accurate, somewhat, inaccurate)
--
-- Existing Fields (No Changes):
--   - water_temp          - Already exists (numeric)
--   - wave_quality        - Already exists (integer, 1-5 rating)
--   - crowd_level         - Already exists (integer, 1-5 rating)
--   - parking_ease        - Already exists (integer, 1-5 rating)
--   - rating              - Already exists (integer, 1-5 overall rating)
--   - notes               - Already exists (text)
--   - goals               - Already exists (text[] - can store wave types)
--
-- Design Rationale:
--   - All new columns are NULLABLE to maintain backward compatibility
--   - No DEFAULT values to avoid misleading data
--   - Indexes added for performance on common query patterns
--   - CHECK constraints ensure data quality
--   - Column comments document purpose and expected values
--
-- Rollback: See bottom of file for complete rollback procedure
--
-- Created: 2025-11-13
-- Author: Database Engineering Team
-- ================================================

-- ================================================
-- 1. Add New Columns to sessions Table
-- ================================================

-- Add wave_height_ft column
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS wave_height_ft DECIMAL(4,1);

-- Add wind_speed_mph column
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS wind_speed_mph INTEGER;

-- Add wind_direction column
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS wind_direction TEXT;

-- Add forecast_accuracy column with constraint
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS forecast_accuracy TEXT;

-- Add CHECK constraint for forecast_accuracy
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS check_forecast_accuracy;

ALTER TABLE sessions
ADD CONSTRAINT check_forecast_accuracy
CHECK (forecast_accuracy IN ('accurate', 'somewhat', 'inaccurate') OR forecast_accuracy IS NULL);

-- Add CHECK constraint for wave_height_ft (reasonable range for surfable waves)
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS check_wave_height_ft;

ALTER TABLE sessions
ADD CONSTRAINT check_wave_height_ft
CHECK (wave_height_ft >= 0 AND wave_height_ft <= 50 OR wave_height_ft IS NULL);

-- Add CHECK constraint for wind_speed_mph (reasonable range up to hurricane-force)
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS check_wind_speed_mph;

ALTER TABLE sessions
ADD CONSTRAINT check_wind_speed_mph
CHECK (wind_speed_mph >= 0 AND wind_speed_mph <= 150 OR wind_speed_mph IS NULL);

-- ================================================
-- 2. Add Column Comments (Documentation)
-- ================================================

COMMENT ON COLUMN sessions.wave_height_ft IS 'Actual wave height in feet as reported by user. Range: 0-50 ft (largest surfable waves). NULL indicates not reported.';
COMMENT ON COLUMN sessions.wind_speed_mph IS 'Wind speed in miles per hour as reported by user. Range: 0-150 mph (up to hurricane-force winds). NULL indicates not reported.';
COMMENT ON COLUMN sessions.wind_direction IS 'Wind direction as reported by user. Values: N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS. NULL indicates not reported.';
COMMENT ON COLUMN sessions.forecast_accuracy IS 'User feedback on forecast accuracy. Values: accurate (forecast was spot on), somewhat (close but not perfect), inaccurate (way off). NULL indicates not reported.';

-- ================================================
-- 3. Add Indexes for Performance
-- ================================================

-- Index for wave_height_ft (common query pattern: find sessions by wave size)
CREATE INDEX IF NOT EXISTS idx_sessions_wave_height
ON sessions(wave_height_ft)
WHERE wave_height_ft IS NOT NULL;

-- Index for wind_speed_mph (common query pattern: find sessions by wind conditions)
CREATE INDEX IF NOT EXISTS idx_sessions_wind_speed
ON sessions(wind_speed_mph)
WHERE wind_speed_mph IS NOT NULL;

-- Index for forecast_accuracy (analytics query pattern: forecast accuracy analysis)
CREATE INDEX IF NOT EXISTS idx_sessions_forecast_accuracy
ON sessions(forecast_accuracy)
WHERE forecast_accuracy IS NOT NULL;

-- Composite index for condition-based queries (wave height + wind speed)
CREATE INDEX IF NOT EXISTS idx_sessions_conditions
ON sessions(beach_id, wave_height_ft, wind_speed_mph)
WHERE wave_height_ft IS NOT NULL OR wind_speed_mph IS NOT NULL;

-- ================================================
-- 4. Update sessions_history Table (Audit Trail)
-- ================================================

-- Add same columns to sessions_history for complete audit trail
ALTER TABLE sessions_history
ADD COLUMN IF NOT EXISTS wave_height_ft DECIMAL(4,1);

ALTER TABLE sessions_history
ADD COLUMN IF NOT EXISTS wind_speed_mph INTEGER;

ALTER TABLE sessions_history
ADD COLUMN IF NOT EXISTS wind_direction TEXT;

ALTER TABLE sessions_history
ADD COLUMN IF NOT EXISTS forecast_accuracy TEXT;

-- Add comments to history table
COMMENT ON COLUMN sessions_history.wave_height_ft IS 'Historical snapshot of wave_height_ft from sessions table';
COMMENT ON COLUMN sessions_history.wind_speed_mph IS 'Historical snapshot of wind_speed_mph from sessions table';
COMMENT ON COLUMN sessions_history.wind_direction IS 'Historical snapshot of wind_direction from sessions table';
COMMENT ON COLUMN sessions_history.forecast_accuracy IS 'Historical snapshot of forecast_accuracy from sessions table';

-- ================================================
-- 5. Grant Appropriate Permissions
-- ================================================

-- Note: RLS policies on sessions table automatically apply to new columns
-- No additional policies needed - columns inherit table-level RLS

-- Verify authenticated users can read/write (existing policies apply)
-- Policies should already exist:
--   - Users can INSERT their own sessions
--   - Users can UPDATE their own sessions
--   - Users can SELECT sessions based on is_public flag

-- ================================================
-- 6. Migration Verification Queries
-- ================================================

-- To verify migration success, run these queries after deployment:

-- 1. Verify columns exist
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'sessions'
--   AND column_name IN ('wave_height_ft', 'wind_speed_mph', 'wind_direction', 'forecast_accuracy')
-- ORDER BY column_name;

-- 2. Verify constraints exist
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_schema = 'public'
--   AND table_name = 'sessions'
--   AND constraint_name LIKE '%forecast_accuracy%' OR constraint_name LIKE '%wave_height%' OR constraint_name LIKE '%wind_speed%';

-- 3. Verify indexes exist
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'sessions'
--   AND indexname LIKE 'idx_sessions_%'
-- ORDER BY indexname;

-- 4. Test INSERT with new fields
-- INSERT INTO sessions (
--   profile_id,
--   user_id,
--   beach_id,
--   beach_name,
--   arrival_time,
--   duration_minutes,
--   status,
--   wave_height_ft,
--   wind_speed_mph,
--   wind_direction,
--   forecast_accuracy,
--   notes
-- ) VALUES (
--   auth.uid(),
--   auth.uid(),
--   (SELECT id FROM beaches LIMIT 1),
--   'Test Beach',
--   NOW(),
--   60,
--   'completed',
--   3.5,
--   10,
--   'OFFSHORE',
--   'accurate',
--   'Test session with new fields'
-- );

-- 5. Test SELECT with new fields
-- SELECT
--   id,
--   beach_name,
--   wave_height_ft,
--   wind_speed_mph,
--   wind_direction,
--   forecast_accuracy,
--   created_at
-- FROM sessions
-- WHERE wave_height_ft IS NOT NULL
-- ORDER BY created_at DESC
-- LIMIT 5;

-- ================================================
-- ROLLBACK PROCEDURE
-- ================================================
-- If this migration needs to be rolled back, execute the following SQL:
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_sessions_wave_height;
-- DROP INDEX IF EXISTS idx_sessions_wind_speed;
-- DROP INDEX IF EXISTS idx_sessions_forecast_accuracy;
-- DROP INDEX IF EXISTS idx_sessions_conditions;
--
-- -- Drop constraints
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_forecast_accuracy;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_wave_height_ft;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_wind_speed_mph;
--
-- -- Drop columns from sessions table
-- ALTER TABLE sessions DROP COLUMN IF EXISTS wave_height_ft;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS wind_speed_mph;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS wind_direction;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS forecast_accuracy;
--
-- -- Drop columns from sessions_history table
-- ALTER TABLE sessions_history DROP COLUMN IF EXISTS wave_height_ft;
-- ALTER TABLE sessions_history DROP COLUMN IF EXISTS wind_speed_mph;
-- ALTER TABLE sessions_history DROP COLUMN IF EXISTS wind_direction;
-- ALTER TABLE sessions_history DROP COLUMN IF EXISTS forecast_accuracy;
--
-- ================================================
-- END OF MIGRATION
-- ================================================
