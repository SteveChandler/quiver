BEGIN;

-- Create Morning Intel Bot profile if it doesn't exist
INSERT INTO profiles (id, full_name, display_name, is_system_account, is_mock)
VALUES (
  'f2472229-100e-4a8a-ae6e-bc8b23d7cf87',
  'Morning Intel Bot',
  'Morning Intel Bot',
  true,
  false
)
ON CONFLICT (id) DO UPDATE SET
  is_system_account = true,
  display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);

-- Create Quiver Surf Forecast profile if it doesn't exist
INSERT INTO profiles (id, full_name, display_name, is_system_account, is_mock)
VALUES (
  '3290f65d-b474-49e2-ac5e-27de2db3fc9e',
  'Quiver Surf Forecast',
  'Quiver Surf Forecast',
  true,
  false
)
ON CONFLICT (id) DO UPDATE SET
  is_system_account = true,
  display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);

COMMIT;
