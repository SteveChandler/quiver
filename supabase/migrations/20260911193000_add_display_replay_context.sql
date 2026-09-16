BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS display_replay_context jsonb;
COMMENT ON COLUMN public.ml_predictions_log.display_replay_context IS
  'Versioned same-generation transform inputs and handoff endpoints. First-write-wins with the prediction. NULL historical rows are not replayable; never backfill from a later forecast run.';
-- Extend the existing RPC in place, preserving its permissions and other fixes.
DO $migration$
DECLARE
  signature text;
  definition text;
  updated text;
  old_text text;
  new_text text;
BEGIN
  FOR signature, old_text, new_text IN
    SELECT * FROM (VALUES
      ('public.trusted_forecast_snapshot_columns()',
       E'    ''display_raw_input_height_m'',',
       E'    ''display_raw_input_height_m'',\n    ''display_replay_context'','),
      ('public.trusted_forecast_canonical_snapshot(jsonb)',
       'AS column_name;',
       E'AS column_name\n  WHERE column_name <> ''display_replay_context''\n     OR (p_row -> column_name IS NOT NULL AND p_row -> column_name <> ''null''::jsonb);'),
      ('public.persist_trusted_forecast_build(jsonb)',
       '        display_raw_input_height_m double precision,',
       E'        display_raw_input_height_m double precision,\n        display_replay_context jsonb,'),
      ('public.persist_trusted_forecast_build(jsonb)',
       E'        display_raw_input_height_m,\n',
       E'        display_raw_input_height_m,\n        display_replay_context,\n'),
      ('public.persist_trusted_forecast_build(jsonb)',
       E'        source.display_raw_input_height_m,\n',
       E'        source.display_raw_input_height_m,\n        source.display_replay_context,\n')
    ) AS patches(signature, old_text, new_text)
  LOOP
    definition := pg_get_functiondef(signature::regprocedure);
    IF strpos(definition, new_text) > 0 THEN
      CONTINUE;
    END IF;
    IF (length(definition) - length(replace(definition, old_text, '')))
       / length(old_text) <> 1 THEN
      RAISE EXCEPTION 'Replay migration expected one patch target in %: %', signature, old_text;
    END IF;
    updated := replace(definition, old_text, new_text);
    EXECUTE updated;
  END LOOP;
END;
$migration$;
-- Absent/null context keeps old receipt hashes stable; supplied context is hashed.
COMMIT;
