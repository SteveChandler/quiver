-- ================================================
-- Migration: Add Tide Fields to Sessions Table
-- ================================================
-- Description: Add tide data fields to sessions table for auto-forecast
--              autofill feature. Users can report tide height and status
--              during their surf sessions.
--
-- Fields Added:
--   1. tide_height_ft  - Tide height in feet (user-reported)
--   2. tide_status     - Tide status (rising, falling, high, low)
--
-- Existing Related Fields (No Changes):
--   - wave_height_ft     - Already exists (added in 20251113194209)
--   - wind_speed_mph     - Already exists (added in 20251113194209)
--   - wind_direction     - Already exists (added in 20251113194209)
--   - forecast_accuracy  - Already exists (added in 20251113194209)
--
-- Design Rationale:
--   - All new columns are NULLABLE to maintain backward compatibility
--   - No DEFAULT values to avoid misleading data
--   - CHECK constraints ensure data quality
--   - Column comments document purpose and expected values
--   - Consistent with existing session condition fields
--   - No indexes needed yet (can add later if query patterns emerge)
--
-- Rollback: See bottom of file for complete rollback procedure
--
-- Created: 2026-01-06
-- Author: Database Engineering Team
-- ================================================

-- ================================================
-- 1. Add New Columns to sessions Table
-- ================================================

-- Add tide_height_ft column
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS tide_height_ft DECIMAL(4,2);

-- Add tide_status column
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS tide_status TEXT;

-- ================================================
-- 2. Add CHECK Constraints for Data Quality
-- ================================================

-- Add CHECK constraint for tide_height_ft (reasonable range for tides)
-- Most tidal ranges are 0-20 ft, with extreme tides up to 50 ft (Bay of Fundy)
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS check_tide_height_ft;

ALTER TABLE sessions
ADD CONSTRAINT check_tide_height_ft
CHECK (tide_height_ft >= -10 AND tide_height_ft <= 50 OR tide_height_ft IS NULL);

-- Add CHECK constraint for tide_status (valid tide states)
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS check_tide_status;

ALTER TABLE sessions
ADD CONSTRAINT check_tide_status
CHECK (tide_status IN ('rising', 'falling', 'high', 'low') OR tide_status IS NULL);

-- ================================================
-- 3. Add Column Comments (Documentation)
-- ================================================

COMMENT ON COLUMN sessions.tide_height_ft IS 'Tide height in feet as reported by user at time of session. Range: -10 to 50 ft (covers extreme tidal ranges). NULL indicates not reported.';
COMMENT ON COLUMN sessions.tide_status IS 'Tide status as reported by user. Values: rising (incoming tide), falling (outgoing tide), high (high tide), low (low tide). NULL indicates not reported.';

-- ================================================
-- 4. Update sessions_history Table (Audit Trail)
-- ================================================

-- Add same columns to sessions_history for complete audit trail
ALTER TABLE sessions_history
ADD COLUMN IF NOT EXISTS tide_height_ft DECIMAL(4,2);

ALTER TABLE sessions_history
ADD COLUMN IF NOT EXISTS tide_status TEXT;

-- Add comments to history table
COMMENT ON COLUMN sessions_history.tide_height_ft IS 'Historical snapshot of tide_height_ft from sessions table';
COMMENT ON COLUMN sessions_history.tide_status IS 'Historical snapshot of tide_status from sessions table';

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
-- SELECT column_name, data_type, is_nullable, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'sessions'
--   AND column_name IN ('tide_height_ft', 'tide_status')
-- ORDER BY column_name;

-- 2. Verify constraints exist
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_schema = 'public'
--   AND table_name = 'sessions'
--   AND (constraint_name LIKE '%tide_height%' OR constraint_name LIKE '%tide_status%');

-- 3. Test INSERT with new fields
-- INSERT INTO sessions (
--   profile_id,
--   user_id,
--   beach_id,
--   beach_name,
--   arrival_time,
--   duration_minutes,
--   status,
--   tide_height_ft,
--   tide_status,
--   notes
-- ) VALUES (
--   auth.uid(),
--   auth.uid(),
--   (SELECT id FROM beaches LIMIT 1),
--   'Test Beach',
--   NOW(),
--   60,
--   'completed',
--   3.25,
--   'rising',
--   'Test session with tide fields'
-- );

-- 4. Test SELECT with new fields
-- SELECT
--   id,
--   beach_name,
--   tide_height_ft,
--   tide_status,
--   wave_height_ft,
--   wind_speed_mph,
--   created_at
-- FROM sessions
-- WHERE tide_height_ft IS NOT NULL
-- ORDER BY created_at DESC
-- LIMIT 5;

-- 5. Verify sessions_history has columns
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'sessions_history'
--   AND column_name IN ('tide_height_ft', 'tide_status')
-- ORDER BY column_name;

-- ================================================
-- ROLLBACK PROCEDURE
-- ================================================
-- If this migration needs to be rolled back, execute the following SQL:
--
-- -- Drop constraints
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_tide_height_ft;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_tide_status;
--
-- -- Drop columns from sessions table
-- ALTER TABLE sessions DROP COLUMN IF EXISTS tide_height_ft;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS tide_status;
--
-- -- Drop columns from sessions_history table
-- ALTER TABLE sessions_history DROP COLUMN IF EXISTS tide_height_ft;
-- ALTER TABLE sessions_history DROP COLUMN IF EXISTS tide_status;
--
-- ================================================
-- END OF MIGRATION
-- ================================================
