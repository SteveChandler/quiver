-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Fix Morning Intel Bot: set email so morningIntel.ts can look it up
UPDATE profiles SET email = 'morning.intel@quiversurf.app'
WHERE id = 'f2472229-100e-4a8a-ae6e-bc8b23d7cf87' AND email IS NULL;

-- Fix Quiver Surf Forecast: set personality_type so morning-forecast.ts can find it
UPDATE profiles SET personality_type = 'forecaster'
WHERE id = '3290f65d-b474-49e2-ac5e-27de2db3fc9e' AND personality_type IS NULL;
