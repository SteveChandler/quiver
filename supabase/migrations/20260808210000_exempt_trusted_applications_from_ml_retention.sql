-- Keep ml_predictions_log retention working once Phase 21 starts writing
-- trusted_forecast_applications.
--
-- `trusted_forecast_applications.prediction_snapshot_id` references
-- `ml_predictions_log (id)` ON DELETE RESTRICT. The daily
-- `cleanup-ml-predictions` job deletes rows older than 30 days, so ~30 days
-- after the first application row that DELETE raises a foreign key violation.
-- The violation aborts `cleanup_old_ml_predictions()` outright, which stops
-- retention for the WHOLE table, not just the referenced row — reinstating the
-- 234MB-per-10-days growth the retention policy was written for. The batch is
-- an unordered `LIMIT`, so every subsequent nightly run keeps hitting it.
--
-- ON DELETE SET NULL is not an option: nulling the column fires an UPDATE and
-- `trusted_forecast_applications_append_only` rejects UPDATE. Dropping the FK
-- would give up the integrity guarantee. So retention skips referenced rows
-- instead: a snapshot that a trusted decision was based on is the evidence for
-- that decision and is deliberately retained. Coverage is two beaches with at
-- most a handful of governed slots per day, so the retained set stays small.

BEGIN;

CREATE OR REPLACE FUNCTION cleanup_old_ml_predictions()
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

REVOKE ALL ON FUNCTION cleanup_old_ml_predictions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_ml_predictions() TO service_role;

COMMENT ON FUNCTION cleanup_old_ml_predictions() IS
'Deletes ml_predictions_log rows older than 30 days in batches, skipping snapshots referenced by trusted_forecast_applications (FK is ON DELETE RESTRICT).';

-- Postgres does not automatically index the referencing column of a foreign
-- key. Both the NOT EXISTS above and the RESTRICT check that runs on every
-- delete from ml_predictions_log need this to avoid a full scan.
CREATE INDEX IF NOT EXISTS trusted_forecast_applications_prediction_snapshot_idx
  ON public.trusted_forecast_applications (prediction_snapshot_id)
  WHERE prediction_snapshot_id IS NOT NULL;

COMMIT;
