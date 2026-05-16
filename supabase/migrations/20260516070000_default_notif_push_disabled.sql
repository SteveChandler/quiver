BEGIN;

ALTER TABLE profiles
ALTER COLUMN notif_push_enabled SET DEFAULT false;

COMMIT;
