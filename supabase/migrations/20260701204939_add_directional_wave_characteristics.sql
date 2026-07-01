-- Widen the sessions_wave_characteristics_check CHECK constraint to allow the
-- three new directional/shape wave-characteristic tags: rights, lefts, steep.
--
-- Append-only: this preserves every existing value (the `<@` subset check means
-- all currently-stored rows still validate) and only widens the allow-list so
-- inserts/updates carrying 'rights', 'lefts', or 'steep' are accepted. No rows
-- are rewritten or deleted. Idempotent via DROP CONSTRAINT IF EXISTS.
--
-- Companion to native/web WAVE_CHARACTERISTICS additions (plan 055). Must deploy
-- before or with the app release so the DB never rejects a value the app sends.

BEGIN;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_wave_characteristics_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_wave_characteristics_check
  CHECK (
    wave_characteristics IS NULL
    OR wave_characteristics <@ ARRAY[
      'clean',
      'glassy',
      'choppy',
      'blown_out',
      'fat',
      'mushy',
      'peaky',
      'powerful',
      'closeouts',
      'barreling',
      'reform',
      'walled',
      'rights',
      'lefts',
      'steep'
    ]::text[]
  );

COMMIT;

-- Rollback (only safe if no stored row uses 'rights', 'lefts', or 'steep';
-- otherwise the ADD CONSTRAINT will fail against existing data):
--
-- BEGIN;
--
-- ALTER TABLE public.sessions
--   DROP CONSTRAINT IF EXISTS sessions_wave_characteristics_check;
--
-- ALTER TABLE public.sessions
--   ADD CONSTRAINT sessions_wave_characteristics_check
--   CHECK (
--     wave_characteristics IS NULL
--     OR wave_characteristics <@ ARRAY[
--       'clean',
--       'glassy',
--       'choppy',
--       'blown_out',
--       'fat',
--       'mushy',
--       'peaky',
--       'powerful',
--       'closeouts',
--       'barreling',
--       'reform',
--       'walled'
--     ]::text[]
--   );
--
-- COMMIT;
