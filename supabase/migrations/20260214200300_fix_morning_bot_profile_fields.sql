-- Fix missing fields on morning bot profiles that the original cleanup migration
-- (20260117160551) was supposed to set but couldn't because profiles didn't exist yet.
BEGIN;

-- Morning Intel Bot: set email so morningIntel.ts can look it up via profiles.email
UPDATE profiles SET email = 'morning.intel@quiversurf.app'
WHERE id = 'f2472229-100e-4a8a-ae6e-bc8b23d7cf87' AND email IS NULL;

-- Quiver Surf Forecast: set personality_type so morning-forecast.ts can find it
-- via is_system_account = true AND personality_type = 'forecaster'
UPDATE profiles SET personality_type = 'forecaster'
WHERE id = '3290f65d-b474-49e2-ac5e-27de2db3fc9e' AND personality_type IS NULL;

COMMIT;
