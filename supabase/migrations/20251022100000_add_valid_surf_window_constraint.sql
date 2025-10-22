-- Add CHECK constraint to prevent invalid surf windows where start = end
-- This ensures data integrity for the best surf window recommendation

BEGIN;

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
