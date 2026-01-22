-- Clear ML Observations Backlog
-- Run this script after deploying the pg_cron migration to clear pending predictions
--
-- USAGE: Run via Supabase SQL Editor or psql
-- This script processes ~100,000 predictions per run (100 batches x 1000 each)
-- Re-run as needed until backlog is cleared

-- First, check current health metrics
SELECT 'BEFORE BACKFILL:' as status;
SELECT * FROM get_ml_health_metrics();

-- Run aggressive backfill in batches
DO $$
DECLARE
  result RECORD;
  total_processed INT := 0;
  total_matched INT := 0;
  batch_num INT := 0;
  max_batches INT := 100;
  batch_size INT := 1000;
BEGIN
  RAISE NOTICE 'Starting aggressive backfill...';
  RAISE NOTICE 'Max batches: %, batch size: %', max_batches, batch_size;

  FOR batch_num IN 1..max_batches LOOP
    SELECT * INTO result FROM backfill_ml_observations_batch(batch_size);

    total_processed := total_processed + result.processed;
    total_matched := total_matched + result.matched;

    -- Log progress every 10 batches
    IF batch_num % 10 = 0 THEN
      RAISE NOTICE 'Batch %: processed=%, matched=%, total_processed=%, total_matched=%',
        batch_num, result.processed, result.matched, total_processed, total_matched;
    END IF;

    -- Exit early if no more predictions to process
    IF result.processed = 0 THEN
      RAISE NOTICE 'No more pending predictions - exiting at batch %', batch_num;
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'BACKFILL COMPLETE';
  RAISE NOTICE 'Total processed: %', total_processed;
  RAISE NOTICE 'Total matched: %', total_matched;
  RAISE NOTICE 'Match rate: %', ROUND(100.0 * total_matched / NULLIF(total_processed, 0), 1);
  RAISE NOTICE '========================================';
END $$;

-- Show updated health metrics
SELECT 'AFTER BACKFILL:' as status;
SELECT * FROM get_ml_health_metrics();

-- Check pg_cron job status (if pg_cron is available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job'
  ) THEN
    RAISE NOTICE 'Checking pg_cron job status...';
  END IF;
END $$;

SELECT
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'ml-backfill-observations';

-- Show recent job executions
SELECT
  jobname,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 5;
