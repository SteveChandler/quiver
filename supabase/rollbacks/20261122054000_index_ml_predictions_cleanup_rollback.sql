-- Restore the function from 20260808210000_exempt_trusted_applications_from_ml_retention.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_old_ml_predictions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  batch_deleted integer;
  batch_size integer := 10000;
BEGIN
  -- Delete in batches to prevent long-running transactions and lock contention
  LOOP
    DELETE FROM ml_predictions_log
    WHERE id IN (
      SELECT id FROM ml_predictions_log
      WHERE created_at < NOW() - INTERVAL '30 days'
        -- Skip snapshots a trusted-forecast application still points at; the
        -- FK is ON DELETE RESTRICT and one violation kills the whole run.
        AND NOT EXISTS (
          SELECT 1
          FROM public.trusted_forecast_applications application
          WHERE application.prediction_snapshot_id = ml_predictions_log.id
        )
      LIMIT batch_size
    );

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    deleted_count := deleted_count + batch_deleted;

    -- Exit when no more rows to delete. A batch that is short because the
    -- remaining old rows are all referenced terminates here too.
    EXIT WHEN batch_deleted < batch_size;

    -- Brief pause to allow other transactions
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- Log the cleanup for monitoring
  RAISE NOTICE 'ML predictions cleanup: deleted % rows older than 30 days', deleted_count;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_ml_predictions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_ml_predictions() TO service_role;

COMMIT;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_ml_predictions_log_created_at_id;
