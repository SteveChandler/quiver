BEGIN;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS muted boolean DEFAULT false;

COMMENT ON COLUMN sessions.muted IS 'When true, session is public on profile but hidden from community feed';

COMMIT;
