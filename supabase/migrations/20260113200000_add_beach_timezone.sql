-- Add timezone column to beaches table for NOAA timestamp conversion
BEGIN;

ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

COMMENT ON COLUMN beaches.timezone IS 'IANA timezone for forecast timestamp conversion (e.g., America/Los_Angeles)';

COMMIT;
