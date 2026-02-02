-- Migration: ML Predictions Retention Policy
-- Impact: 234MB in 10 days with no cleanup policy, 11% dead rows
-- Priority: P2 (Medium)
--
-- Sets up automatic cleanup of old ML prediction logs to prevent unbounded growth
-- Note: VACUUM ANALYZE cannot run inside a transaction, run separately after migration

-- First transaction: Create the function
BEGIN;

-- Create retention cleanup function with batching to prevent long-running transactions
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
      LIMIT batch_size
    );

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    deleted_count := deleted_count + batch_deleted;

    -- Exit when no more rows to delete
    EXIT WHEN batch_deleted < batch_size;

    -- Brief pause to allow other transactions
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- Log the cleanup for monitoring
  RAISE NOTICE 'ML predictions cleanup: deleted % rows older than 30 days', deleted_count;

  RETURN deleted_count;
END;
$$;

-- Only grant execute to service_role (not authenticated users)
REVOKE ALL ON FUNCTION cleanup_old_ml_predictions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_ml_predictions() TO service_role;

COMMIT;

-- Schedule cron job OUTSIDE of transaction (pg_cron requirement)
-- This may fail if cron job already exists - that's OK
DO $$
BEGIN
  -- Remove existing job if it exists
  PERFORM cron.unschedule('cleanup-ml-predictions');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-ml-predictions',
  '0 3 * * *',  -- Every day at 3 AM UTC
  $$SELECT cleanup_old_ml_predictions()$$
);

-- Perform initial cleanup of old data (outside transaction)
SELECT cleanup_old_ml_predictions();

-- Manual VACUUM (run outside of transaction after migration completes):
-- VACUUM ANALYZE ml_predictions_log;

-- Verification queries:
-- SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM ml_predictions_log;
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-ml-predictions';

-- Monitoring query for dead rows:
-- SELECT relname, n_dead_tup, n_live_tup,
--        ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) as dead_pct
-- FROM pg_stat_user_tables
-- WHERE relname = 'ml_predictions_log';

-- Rollback procedure:
-- BEGIN;
-- SELECT cron.unschedule('cleanup-ml-predictions');
-- DROP FUNCTION IF EXISTS cleanup_old_ml_predictions();
-- COMMIT;
