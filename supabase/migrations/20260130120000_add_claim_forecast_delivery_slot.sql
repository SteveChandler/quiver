-- Migration: Add atomic claim_forecast_delivery_slot function
-- Fixes race condition in forecast-digest-email deduplication (TOCTOU vulnerability)
--
-- Problem: Two concurrent cron instances can both pass checkAlreadySent() before
-- either inserts a tracking record, causing duplicate emails.
--
-- Solution: Atomic RPC function that claims the delivery slot using row-level locking.
-- Returns true if slot was claimed, false if already sent within dedupe window.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_forecast_delivery_slot(
  p_user_id uuid,
  p_beach_id uuid,
  p_alert_type text,
  p_dedupe_hours int DEFAULT 20
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold timestamptz;
  v_existing timestamptz;
BEGIN
  v_threshold := NOW() - (p_dedupe_hours || ' hours')::interval;

  -- Try to get existing record with row lock (FOR UPDATE)
  -- This prevents concurrent transactions from reading the same row
  SELECT last_sent_at INTO v_existing
  FROM forecast_alert_deliveries
  WHERE user_id = p_user_id
    AND beach_id = p_beach_id
    AND alert_type = p_alert_type
  FOR UPDATE;

  -- If exists and within dedupe window, deny the claim
  IF v_existing IS NOT NULL AND v_existing > v_threshold THEN
    RETURN false;
  END IF;

  -- Upsert the delivery record (claim the slot atomically)
  INSERT INTO forecast_alert_deliveries (user_id, beach_id, alert_type, last_sent_at)
  VALUES (p_user_id, p_beach_id, p_alert_type, NOW())
  ON CONFLICT (user_id, beach_id, alert_type)
  DO UPDATE SET last_sent_at = NOW();

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.claim_forecast_delivery_slot IS
  'Atomically claim a forecast delivery slot. Returns true if claimed, false if already sent within dedupe window. Uses row-level locking to prevent race conditions.';

-- Grant execute to service_role (used by cron jobs)
GRANT EXECUTE ON FUNCTION public.claim_forecast_delivery_slot TO service_role;

COMMIT;
