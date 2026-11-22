BEGIN;

-- A failed concurrent build can leave an invalid index that IF NOT EXISTS skips.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index
    WHERE indexrelid = to_regclass('public.idx_ml_predictions_log_created_at_id')
      AND indrelid = 'public.ml_predictions_log'::regclass
      AND indisvalid
  ) THEN
    RAISE EXCEPTION 'Index public.idx_ml_predictions_log_created_at_id is missing or invalid';
  END IF;
END;
$$;

-- pg_cron reads this server setting in its database session. Unset is off.
-- For new sessions: ALTER DATABASE <database> SET app.ml_predictions_keyset_cleanup_enabled = 'on';
-- Use 'off' to return to the existing cleanup path.
CREATE OR REPLACE FUNCTION public.cleanup_old_ml_predictions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  batch_deleted integer;
  batch_size CONSTANT integer := 10000;
  retention_cutoff CONSTANT timestamptz := NOW() - INTERVAL '30 days';
  last_created_at timestamptz := '-infinity';
  last_id uuid := '00000000-0000-0000-0000-000000000000';
  candidate_ids uuid[];
BEGIN
  IF current_setting('app.ml_predictions_keyset_cleanup_enabled', true) = 'on' THEN
    LOOP
      WITH candidates AS MATERIALIZED (
        SELECT log.created_at, log.id
        FROM public.ml_predictions_log log
        WHERE log.created_at < retention_cutoff
          AND (log.created_at, log.id) >= (last_created_at, last_id)
        ORDER BY log.created_at, log.id
        LIMIT batch_size
      )
      SELECT ARRAY(SELECT id FROM candidates), page_end.created_at, page_end.id
      INTO candidate_ids, last_created_at, last_id
      FROM candidates page_end
      ORDER BY page_end.created_at DESC, page_end.id DESC
      LIMIT 1;

      EXIT WHEN NOT FOUND;

      DELETE FROM public.ml_predictions_log log
      WHERE log.id = ANY(candidate_ids)
        AND log.created_at < retention_cutoff
        AND NOT EXISTS (
          SELECT 1
          FROM public.trusted_forecast_applications application
          WHERE application.prediction_snapshot_id = log.id
        );

      GET DIAGNOSTICS batch_deleted = ROW_COUNT;
      deleted_count := deleted_count + batch_deleted;

      -- A full page can be entirely protected. Advance by the scanned keys;
      -- the inclusive lower bound can revisit at most the previous end key.
      EXIT WHEN cardinality(candidate_ids) < batch_size;
      PERFORM pg_sleep(0.1);
    END LOOP;
  ELSE
    LOOP
      DELETE FROM public.ml_predictions_log
      WHERE id IN (
        SELECT id FROM public.ml_predictions_log
        WHERE created_at < retention_cutoff
          AND NOT EXISTS (
            SELECT 1
            FROM public.trusted_forecast_applications application
            WHERE application.prediction_snapshot_id = ml_predictions_log.id
          )
        LIMIT batch_size
      );

      GET DIAGNOSTICS batch_deleted = ROW_COUNT;
      deleted_count := deleted_count + batch_deleted;
      EXIT WHEN batch_deleted < batch_size;
      PERFORM pg_sleep(0.1);
    END LOOP;
  END IF;

  RAISE NOTICE 'ML predictions cleanup: deleted % rows older than 30 days', deleted_count;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_ml_predictions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_ml_predictions() TO service_role;

COMMIT;
