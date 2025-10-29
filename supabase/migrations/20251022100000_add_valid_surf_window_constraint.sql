-- Add CHECK constraint to prevent invalid surf windows where start = end
-- This ensures data integrity for the best surf window recommendation

BEGIN;

-- First, clean up any invalid data before adding the constraint
-- Set both to NULL if:
-- 1. One is NULL and the other is NOT NULL (partial window)
-- 2. Both are NOT NULL but equal (zero-length window)
UPDATE beach_daily_intel
SET best_window_start = NULL, best_window_end = NULL
WHERE
  -- Case 1: Partial windows
  (best_window_start IS NULL AND best_window_end IS NOT NULL)
  OR (best_window_start IS NOT NULL AND best_window_end IS NULL)
  -- Case 2: Zero-length windows (start = end)
  OR (best_window_start IS NOT NULL AND best_window_end IS NOT NULL AND best_window_start = best_window_end);

-- Add constraint to ensure surf window times are valid
-- Either both are NULL (no valid window) or they are different times
ALTER TABLE beach_daily_intel
  ADD CONSTRAINT valid_surf_window
  CHECK (
    (best_window_start IS NULL AND best_window_end IS NULL)
    OR (best_window_start IS NOT NULL AND best_window_end IS NOT NULL AND best_window_start != best_window_end)
  );

COMMENT ON CONSTRAINT valid_surf_window ON beach_daily_intel IS
  'Ensures surf windows have different start and end times, preventing invalid windows like 06:00-06:00';

COMMIT;
