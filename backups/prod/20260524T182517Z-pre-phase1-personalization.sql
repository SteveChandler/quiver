

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "maintenance";


ALTER SCHEMA "maintenance" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "posthog_export";


ALTER SCHEMA "posthog_export" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'Removed mv_beach_hourly_scores on 2026-01-13 - not used by app code';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."beach_persona" AS ENUM (
    'sheltered_reef',
    'exposed_beach_break',
    'canyon_amplified',
    'point_break',
    'jetty_harbor'
);


ALTER TYPE "public"."beach_persona" OWNER TO "postgres";


COMMENT ON TYPE "public"."beach_persona" IS 'Archetype classification for beach wave physics. Determines how deep-water model energy translates to nearshore face height.';



CREATE TYPE "public"."content_report_reason" AS ENUM (
    'spam',
    'harassment',
    'hate_speech',
    'sexual_content',
    'violence',
    'self_harm',
    'misinformation',
    'ip_violation',
    'other'
);


ALTER TYPE "public"."content_report_reason" OWNER TO "postgres";


CREATE TYPE "public"."content_report_status" AS ENUM (
    'pending',
    'reviewing',
    'actioned',
    'dismissed'
);


ALTER TYPE "public"."content_report_status" OWNER TO "postgres";


CREATE TYPE "public"."content_report_target" AS ENUM (
    'user',
    'session',
    'comment'
);


ALTER TYPE "public"."content_report_target" OWNER TO "postgres";


CREATE TYPE "public"."intel_post_tag" AS ENUM (
    'parking',
    'hazard',
    'crowd',
    'conditions',
    'access',
    'other'
);


ALTER TYPE "public"."intel_post_tag" OWNER TO "postgres";


CREATE TYPE "public"."intel_vote_type" AS ENUM (
    'helpful',
    'off',
    'confirmed'
);


ALTER TYPE "public"."intel_vote_type" OWNER TO "postgres";


CREATE TYPE "public"."roadmap_category" AS ENUM (
    'forecasts',
    'logging',
    'community',
    'notifications',
    'subscription',
    'other'
);


ALTER TYPE "public"."roadmap_category" OWNER TO "postgres";


CREATE TYPE "public"."roadmap_status" AS ENUM (
    'under_consideration',
    'in_progress',
    'shipped',
    'declined'
);


ALTER TYPE "public"."roadmap_status" OWNER TO "postgres";


CREATE TYPE "public"."roadmap_submission_decision" AS ENUM (
    'pending',
    'approved',
    'declined',
    'merged_into'
);


ALTER TYPE "public"."roadmap_submission_decision" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_for_user"("inviter" "uuid", "invitee" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_follow_id uuid;
  v_follow_created boolean;
  v_referral_result jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM $2 THEN
    RAISE EXCEPTION 'invitee mismatch: must match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  IF $1 IS NULL OR $2 IS NULL THEN
    RAISE EXCEPTION 'inviter and invitee are required'
      USING ERRCODE = '22023';
  END IF;

  IF $1 = $2 THEN
    RAISE EXCEPTION 'cannot accept your own invite'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES ($2, $1)
  ON CONFLICT (follower_id, following_id) DO NOTHING
  RETURNING id INTO v_follow_id;

  v_follow_created := v_follow_id IS NOT NULL;

  v_referral_result := public.record_referral_attribution(
    $1,
    $2,
    'invite_token',
    NULL
  );

  RETURN jsonb_build_object(
    'follow_created', v_follow_created,
    'follow_existing', NOT v_follow_created,
    'referral_created', COALESCE((v_referral_result->>'created')::boolean, false),
    'referral_existing', COALESCE((v_referral_result->>'existing')::boolean, false)
  );
END;
$_$;


ALTER FUNCTION "public"."accept_invite_for_user"("inviter" "uuid", "invitee" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."accept_invite_for_user"("inviter" "uuid", "invitee" "uuid") IS 'Accepts an invite for the authenticated invitee by creating the follow edge and referral attribution idempotently.';



CREATE OR REPLACE FUNCTION "public"."assign_nearest_beach_to_intel_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NEW.beach_id IS NULL THEN
    NEW.beach_id := find_nearest_beach_id(NEW.latitude, NEW.longitude);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_nearest_beach_to_intel_post"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_nearest_beach_to_intel_post"() IS 'Trigger function that automatically assigns the nearest beach to intel posts on INSERT. Only assigns if beach_id is NULL (preserves explicit assignments). Uses SECURITY DEFINER to bypass RLS when reading beaches table.';



CREATE OR REPLACE FUNCTION "public"."backfill_ml_observations"("batch_size" integer DEFAULT 1000) RETURNS TABLE("processed" integer, "matched" integer, "no_match" integer, "elapsed_ms" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  start_time TIMESTAMPTZ := clock_timestamp();
  v_processed INT := 0;
  v_matched INT := 0;
  v_no_match INT := 0;
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '2 hours';
  observation_window_start TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  pred RECORD;
  obs RECORD;
BEGIN
  -- Get pending predictions for observable beaches
  FOR pred IN
    SELECT p.id, p.beach_id, p.predicted_at, p.raw_forecast_m, p.corrected_forecast_m
    FROM ml_predictions_log p
    INNER JOIN observable_beaches o ON p.beach_id = o.beach_id
    WHERE p.observed_m IS NULL
      AND p.predicted_at < cutoff
      AND p.predicted_at > observation_window_start
    ORDER BY p.predicted_at ASC
    LIMIT batch_size
  LOOP
    v_processed := v_processed + 1;
    
    -- Find nearest observation within 1 hour window
    SELECT mf.wave_height_m INTO obs
    FROM marine_forecasts mf
    WHERE mf.beach_id = pred.beach_id
      AND mf.is_observed = true
      AND mf.wave_height_m IS NOT NULL
      AND mf.ts >= pred.predicted_at - INTERVAL '1 hour'
      AND mf.ts <= pred.predicted_at + INTERVAL '1 hour'
    ORDER BY mf.ts ASC
    LIMIT 1;
    
    IF obs.wave_height_m IS NOT NULL THEN
      -- Update prediction with ground truth
      UPDATE ml_predictions_log
      SET 
        observed_m = obs.wave_height_m,
        raw_error_m = ABS(pred.raw_forecast_m - obs.wave_height_m),
        corrected_error_m = ABS(pred.corrected_forecast_m - obs.wave_height_m)
      WHERE id = pred.id;
      
      v_matched := v_matched + 1;
    ELSE
      v_no_match := v_no_match + 1;
    END IF;
  END LOOP;
  
  processed := v_processed;
  matched := v_matched;
  no_match := v_no_match;
  elapsed_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INT;
  
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."backfill_ml_observations"("batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."backfill_ml_observations"("batch_size" integer) IS 'Backfills ML predictions with ground truth observations. Run via pg_cron every 10 minutes.';



CREATE OR REPLACE FUNCTION "public"."backfill_ml_observations_batch"("batch_size" integer DEFAULT 10000) RETURNS TABLE("processed" integer, "matched" integer, "sentinel_marked" integer, "expired_deleted" integer, "elapsed_ms" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  v_matched INT := 0;
  v_sentinel INT := 0;
  v_expired INT := 0;
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '12 hours';
  observation_window_start TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  WITH matchable AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      uwo.wave_height_m AS obs_height
    FROM ml_predictions_log p
    INNER JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    INNER JOIN unified_wave_observations uwo
      ON uwo.nearest_beach_id = p.beach_id
      AND uwo.wave_height_m IS NOT NULL
      AND uwo.observed_at >= p.predicted_at - INTERVAL '12 hours'
      AND uwo.observed_at <= p.predicted_at + INTERVAL '12 hours'
    WHERE p.observed_m IS NULL
      AND p.predicted_at < cutoff
      AND p.predicted_at > observation_window_start
    ORDER BY p.id, ABS(EXTRACT(EPOCH FROM (uwo.observed_at - p.predicted_at)))
    LIMIT batch_size
  ),
  updated AS (
    UPDATE ml_predictions_log p
    SET
      observed_m = m.obs_height,
      raw_error_m = ABS(p.raw_forecast_m - m.obs_height),
      corrected_error_m = ABS(p.corrected_forecast_m - m.obs_height)
    FROM matchable m
    WHERE p.id = m.id
    RETURNING p.id
  )
  SELECT COUNT(*)::INT INTO v_matched FROM updated;

  WITH sentinel AS (
    UPDATE ml_predictions_log
    SET observed_m = -1
    WHERE observed_m IS NULL
      AND predicted_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_sentinel FROM sentinel;

  WITH expired AS (
    DELETE FROM ml_predictions_log
    WHERE observed_m IS NULL
      AND predicted_at < NOW() - INTERVAL '72 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_expired FROM expired;

  RETURN QUERY SELECT
    v_matched + v_sentinel + v_expired,
    v_matched,
    v_sentinel,
    v_expired,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, 2);
END;
$$;


ALTER FUNCTION "public"."backfill_ml_observations_batch"("batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."backfill_ml_observations_batch"("batch_size" integer) IS 'JOIN-based ML ground truth matcher with expanded ±4h window.
   Step 1: Match predictions with observations via ±4h window (was ±2h).
   Step 2: Mark predictions >24h old as unmatchable (sentinel -1).
   Step 3: DELETE pending predictions >72h old (TTL cleanup).
   Returns: (processed, matched, sentinel_marked, expired_deleted, elapsed_ms).
   Updated Feb 2 2026: expanded matching window 2h→4h for better match rate.';



CREATE OR REPLACE FUNCTION "public"."capture_board_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- Only capture if board_id is provided and snapshot is null
  IF NEW.board_id IS NOT NULL AND NEW.board_snapshot IS NULL THEN
    SELECT jsonb_build_object(
      'name', b.name,
      'board_type', b.board_type,
      'size', b.size,
      'volume', b.volume,
      'dimensions', b.dimensions
    ) INTO NEW.board_snapshot
    FROM boards b
    WHERE b.id = NEW.board_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capture_board_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_database_health"() RETURNS TABLE("table_name" "text", "row_count" bigint, "table_size" "text", "last_analyzed" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT,
        COALESCE(t.n_live_tup, 0) AS row_count,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.relname)) AS table_size,
        t.last_analyze
    FROM pg_stat_user_tables t
    WHERE t.schemaname = 'public' 
      AND t.relname IN ('enhanced_forecasts', 'buoys', 'beaches', 'spot_feedback')
    ORDER BY pg_total_relation_size(t.schemaname||'.'||t.relname) DESC;
END;
$$;


ALTER FUNCTION "public"."check_database_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_ml_drift"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_current_improvement NUMERIC;
  v_current_mae NUMERIC;
  v_previous_mae NUMERIC;
  v_mae_degradation_pct NUMERIC;
  v_current_model_version TEXT;
BEGIN
  SELECT
    pct_improved,
    avg_corrected_error_m,
    model_version
  INTO
    v_current_improvement,
    v_current_mae,
    v_current_model_version
  FROM get_ml_weekly_metrics()
  LIMIT 1;

  IF v_current_improvement IS NULL THEN
    RETURN false;
  END IF;

  IF v_current_improvement < 40 THEN
    RETURN true;
  END IF;

  SELECT
    ROUND(AVG(corrected_error_m)::numeric, 3)
  INTO v_previous_mae
  FROM ml_predictions_log
  WHERE model_version = v_current_model_version
    AND predicted_at > now() - interval '14 days'
    AND predicted_at <= now() - interval '7 days'
    AND observed_m > 0;

  IF v_previous_mae IS NOT NULL AND v_previous_mae > 0 THEN
    v_mae_degradation_pct := 100.0 * (v_current_mae - v_previous_mae) / v_previous_mae;

    IF v_mae_degradation_pct > 20 THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."check_ml_drift"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_ml_drift"() IS 'Detects ML model drift. Returns true if current week improvement <40% OR MAE degraded >20% vs previous week. Used by automated retraining pipeline.';



CREATE OR REPLACE FUNCTION "public"."check_ml_ground_truth_health"() RETURNS TABLE("metric" "text", "value" numeric, "status" "text", "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- Check 1: Recent ground truth rate (last 24 hours, excluding recent 2 hours)
  RETURN QUERY
  WITH recent AS (
    SELECT
      COUNT(*) as total,
      COUNT(observed_m) as matched
    FROM ml_predictions_log
    WHERE predicted_at > NOW() - INTERVAL '24 hours'
      AND predicted_at < NOW() - INTERVAL '2 hours'
  )
  SELECT
    'ground_truth_rate_24h'::TEXT,
    ROUND(100.0 * matched / NULLIF(total, 0), 1),
    CASE
      WHEN matched * 100.0 / NULLIF(total, 0) >= 50 THEN 'ok'
      WHEN matched * 100.0 / NULLIF(total, 0) >= 20 THEN 'warning'
      ELSE 'critical'
    END,
    format('Matched %s of %s predictions', matched, total)
  FROM recent;

  -- Check 2: Backlog size (predictions waiting for ground truth)
  RETURN QUERY
  SELECT
    'backlog_size'::TEXT,
    COUNT(*)::NUMERIC,
    CASE
      WHEN COUNT(*) <= 20000 THEN 'ok'
      WHEN COUNT(*) <= 50000 THEN 'warning'
      ELSE 'critical'
    END,
    format('%s predictions waiting for ground truth', COUNT(*))
  FROM ml_predictions_log
  WHERE observed_m IS NULL
    AND predicted_at < NOW() - INTERVAL '2 hours'
    AND predicted_at > NOW() - INTERVAL '7 days';

  -- Check 3: Model improvement rate (from weekly metrics)
  RETURN QUERY
  WITH metrics AS (
    SELECT * FROM get_ml_weekly_metrics()
  )
  SELECT
    'improvement_rate_7d'::TEXT,
    pct_improved::NUMERIC,
    CASE
      WHEN pct_improved >= 55 THEN 'ok'
      WHEN pct_improved >= 45 THEN 'warning'
      ELSE 'critical'
    END,
    format('ML improved %s pct of forecasts', pct_improved)
  FROM metrics;

  -- Check 4: Observable beaches coverage
  RETURN QUERY
  SELECT
    'observable_beaches'::TEXT,
    COUNT(*)::NUMERIC,
    CASE
      WHEN COUNT(*) >= 80 THEN 'ok'
      WHEN COUNT(*) >= 50 THEN 'warning'
      ELSE 'critical'
    END,
    format('%s beaches have observation sources', COUNT(*))
  FROM observable_beaches;
END;
$$;


ALTER FUNCTION "public"."check_ml_ground_truth_health"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_ml_ground_truth_health"() IS 'Health checks for ML ground truth matching pipeline.
Returns metrics with status (ok/warning/critical) and human-readable messages.';



CREATE OR REPLACE FUNCTION "public"."claim_daily_forecast_notification_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_notification_type" "text", "p_local_forecast_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$ DECLARE v_claimed_id uuid; BEGIN INSERT INTO public.notification_send_log ( user_id, beach_id, notification_type, local_forecast_date ) VALUES ( p_user_id, p_beach_id, p_notification_type, p_local_forecast_date ) ON CONFLICT (user_id, beach_id, notification_type, local_forecast_date) DO NOTHING RETURNING id INTO v_claimed_id; IF v_claimed_id IS NULL THEN RETURN false; END IF; RETURN true; END; $$;


ALTER FUNCTION "public"."claim_daily_forecast_notification_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_notification_type" "text", "p_local_forecast_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_daily_forecast_notification_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_notification_type" "text", "p_local_forecast_date" "date") IS 'Atomically claims a daily forecast notification slot. Returns false when the same user/beach/type/local date was already claimed.';



CREATE OR REPLACE FUNCTION "public"."claim_forecast_delivery_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_alert_type" "text", "p_dedupe_hours" integer DEFAULT 20) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
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


ALTER FUNCTION "public"."claim_forecast_delivery_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_alert_type" "text", "p_dedupe_hours" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_forecast_delivery_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_alert_type" "text", "p_dedupe_hours" integer) IS 'Atomically claim a forecast delivery slot. Returns true if claimed, false if already sent within dedupe window. Uses row-level locking to prevent race conditions.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "type" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dedupe_key" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "skip_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "claimed_at" timestamp with time zone,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone,
    "last_attempt_at" timestamp with time zone,
    "claim_token" "uuid",
    "cancel_reason" "text",
    "last_error" "text",
    CONSTRAINT "notification_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'processed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."notification_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notification_events"."claimed_at" IS 'Timestamp the delivery worker took ownership of this row. NULL means unclaimed; a value older than 5 minutes is treated as abandoned and may be reclaimed. See lib/notifications/worker.ts.';



COMMENT ON COLUMN "public"."notification_events"."attempt_count" IS 'Incremented each time the worker claims this event. Capped per the registry maxAttempts (default 3).';



COMMENT ON COLUMN "public"."notification_events"."next_attempt_at" IS 'Earliest time the worker may re-claim this event. Set on retryable failure (1m/5m/30m backoff) and on deferred_quiet_hours.';



COMMENT ON COLUMN "public"."notification_events"."last_attempt_at" IS 'Most recent claim timestamp. Distinct from claimed_at, which is cleared when the lease is released.';



COMMENT ON COLUMN "public"."notification_events"."claim_token" IS 'Per-claim UUID set by claim_notification_events RPC. Workers write terminal status only WHERE claim_token = $own — defends against stale-lease races.';



COMMENT ON COLUMN "public"."notification_events"."cancel_reason" IS 'Set when status=cancelled. Used by upstream/business reasons (e.g. recipient deleted account) to record why an event will never deliver.';



COMMENT ON COLUMN "public"."notification_events"."last_error" IS 'Last failure message (truncated). Surfaced by /api/admin/notifications/recent.';



CREATE OR REPLACE FUNCTION "public"."claim_notification_events"("p_batch_size" integer, "p_lease_seconds" integer, "p_claim_token" "uuid") RETURNS SETOF "public"."notification_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM notification_events
    WHERE (
      status = 'pending'
      OR (
        status = 'processing'
        AND claimed_at < now() - make_interval(secs => p_lease_seconds)
      )
    )
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
    ORDER BY next_attempt_at NULLS FIRST, created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_events ne
  SET
    status = 'processing',
    claimed_at = now(),
    claim_token = p_claim_token,
    attempt_count = ne.attempt_count + 1,
    last_attempt_at = now()
  FROM claimable
  WHERE ne.id = claimable.id
  RETURNING ne.*;
END;
$$;


ALTER FUNCTION "public"."claim_notification_events"("p_batch_size" integer, "p_lease_seconds" integer, "p_claim_token" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_notification_events"("p_batch_size" integer, "p_lease_seconds" integer, "p_claim_token" "uuid") IS 'Atomically claim up to p_batch_size pending or stale-processing events for a worker tick. Uses FOR UPDATE SKIP LOCKED so parallel workers claim disjoint sets. See lib/notifications/worker.ts for the caller pattern.';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_events"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  deleted_count integer;
begin
  delete from public.user_events
  where expires_at < now();

  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_expired_events"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_events"() IS 'Deletes events past their expires_at timestamp. Schedule daily. Returns count of deleted rows.';



CREATE OR REPLACE FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer DEFAULT 7) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Mark buoys as inactive if no recent updates
    UPDATE public.buoys 
    SET active = false, 
        updated_at = NOW()
    WHERE active = true 
      AND updated_at < NOW() - (inactive_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Marked % buoys as inactive after % days without updates', updated_count, inactive_days;
    
    RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_beach_intel"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    DELETE FROM beach_daily_intel
    WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_beach_intel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old enhanced forecasts beyond retention period
    DELETE FROM public.enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % old forecast records older than % days', deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_ml_predictions"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
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


ALTER FUNCTION "public"."cleanup_old_ml_predictions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_orphan_smoke_profiles"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.profiles p
    WHERE p.email LIKE 'smoke+%@quiversurf.test'
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_orphan_smoke_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_session_media"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete media records that reference non-existent sessions
  DELETE FROM public.session_media
  WHERE session_id NOT IN (SELECT id FROM public.sessions);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_orphaned_session_media"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_orphaned_session_media"() IS 'Removes session_media records that reference deleted sessions. Returns count of deleted records.';



CREATE OR REPLACE FUNCTION "public"."cleanup_session_media_storage"("media_id" "uuid") RETURNS TABLE("success" boolean, "message" "text", "storage_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    media_record RECORD;
    is_admin BOOLEAN;
BEGIN
    -- Check if user is admin or media owner
    SELECT
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    INTO is_admin;

    -- Get media record
    SELECT sm.*, (sm.user_id = auth.uid() OR is_admin) as can_delete
    INTO media_record
    FROM public.session_media sm
    WHERE sm.id = media_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Media not found', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT media_record.can_delete THEN
        RETURN QUERY SELECT false, 'Unauthorized to delete this media', NULL::TEXT;
        RETURN;
    END IF;

    -- Soft delete the media record
    UPDATE public.session_media
    SET deleted_at = NOW()
    WHERE id = media_id
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Media already deleted', media_record.storage_path;
        RETURN;
    END IF;

    -- Return success with storage path for external cleanup
    RETURN QUERY SELECT
        true,
        'Media record soft-deleted. Storage cleanup required: ' || media_record.storage_path,
        media_record.storage_path;
END;
$$;


ALTER FUNCTION "public"."cleanup_session_media_storage"("media_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_session_media_storage"("media_id" "uuid") IS 'Soft deletes session media and returns storage path for cleanup. Caller must remove file from storage bucket separately.';



CREATE OR REPLACE FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer DEFAULT 14) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete enhanced forecasts older than retention period
    DELETE FROM public.enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % stale enhanced forecasts older than % days', 
        deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_all_affinities_initial"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
  SELECT
    user_id,
    beach_id,
    COUNT(*) as session_count,
    MAX(arrival_time) as last_surfed_at,
    compute_beach_affinity(user_id, beach_id) as affinity_score
  FROM sessions
  GROUP BY user_id, beach_id
  ON CONFLICT (user_id, beach_id) DO UPDATE SET
    session_count = EXCLUDED.session_count,
    last_surfed_at = EXCLUDED.last_surfed_at,
    affinity_score = EXCLUDED.affinity_score,
    computed_at = NOW();
END;
$$;


ALTER FUNCTION "public"."compute_all_affinities_initial"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_all_affinities_initial"() IS 'One-time bulk computation of beach affinities from existing session history. Idempotent - safe to run multiple times. Used by scripts/compute-initial-affinities.ts';



CREATE OR REPLACE FUNCTION "public"."compute_beach_affinity"("_user_id" "uuid", "_beach_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  session_count int;
  last_surfed timestamptz;
  days_since_last numeric;
  base_score numeric;
  recency_bonus numeric;
  frequency_bonus numeric;
  affinity numeric;
BEGIN
  -- Count sessions and get last surf date
  SELECT COUNT(*), MAX(arrival_time)
  INTO session_count, last_surfed
  FROM sessions
  WHERE user_id = _user_id AND beach_id = _beach_id;

  -- No sessions = 0 affinity
  IF session_count = 0 THEN
    RETURN 0;
  END IF;

  -- Base score: 10 points per session, capped at 50
  base_score := LEAST(session_count * 10, 50);

  -- Recency bonus: 30 points max, exponential decay over 180 days
  days_since_last := EXTRACT(DAY FROM (NOW() - last_surfed));
  recency_bonus := 30 * EXP(-days_since_last / 180.0);

  -- Frequency bonus: +20 if 5+ sessions
  frequency_bonus := CASE WHEN session_count >= 5 THEN 20 ELSE 0 END;

  -- Total affinity (capped at 100)
  affinity := base_score + recency_bonus + frequency_bonus;

  RETURN LEAST(100, affinity);
END;
$$;


ALTER FUNCTION "public"."compute_beach_affinity"("_user_id" "uuid", "_beach_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_beach_affinity"("_user_id" "uuid", "_beach_id" "uuid") IS 'Calculates beach affinity: base (10*sessions, max 50) + recency (30*exp(-days/180)) + frequency (+20 if 5+ sessions)';



CREATE OR REPLACE FUNCTION "public"."compute_implicit_preferences"("target_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  processed_count integer := 0;
BEGIN
  RAISE NOTICE 'compute_implicit_preferences: starting (target_user_id=%)', target_user_id;

  INSERT INTO public.user_implicit_preferences (
    user_id,
    inferred_wave_min_ft,
    inferred_wave_max_ft,
    break_type_weights,
    location_centroid_lat,
    location_centroid_lon,
    top_engaged_beach_ids,
    confidence,
    event_count,
    last_computed_at,
    computed_from,
    computed_to
  )
  WITH
    weighted_events AS (
      SELECT
        e.user_id,
        e.beach_id,
        e.event_type,
        e.created_at,
        e.metadata,
        COALESCE(
          ((regexp_match(e.metadata->>'wave_height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'forecast_wave_height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'wave_height', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'waveHeight', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric
        ) AS metadata_wave_ft,
        CASE e.event_type
          WHEN 'location_update' THEN 10.0
          WHEN 'discovery_click' THEN 3.0
          WHEN 'forecast_check' THEN 2.5
          WHEN 'beach_view' THEN 0.5
          WHEN 'discovery_skip' THEN -1.0
          ELSE 0
        END AS weight,
        GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)) AS recency_factor
      FROM public.user_events e
      JOIN public.profiles p
        ON p.id = e.user_id
       AND p.allow_implicit_tracking = true
      WHERE e.user_id IS NOT NULL
        AND e.created_at > now() - interval '90 days'
        AND e.event_type IN (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
        AND (target_user_id IS NULL OR e.user_id = target_user_id)
    ),

    event_wave_samples AS (
      SELECT
        samples.user_id,
        samples.wave_height_ft
      FROM (
        SELECT
          we.user_id,
          COALESCE(we.metadata_wave_ft, forecast_wave.wave_height_ft) AS wave_height_ft
        FROM weighted_events we
        LEFT JOIN LATERAL (
          SELECT
            ((regexp_match(ef.wave_height::text, '-?\d+(?:\.\d+)?'))[1])::numeric AS wave_height_ft
          FROM public.enhanced_forecasts ef
          WHERE we.beach_id IS NOT NULL
            AND ef.beach_id = we.beach_id
            AND ef.forecast_at IS NOT NULL
            AND ef.forecast_at BETWEEN we.created_at - interval '6 hours'
                                  AND we.created_at + interval '6 hours'
          ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - we.created_at))) ASC
          LIMIT 1
        ) forecast_wave ON true
        WHERE we.weight > 0
      ) samples
      WHERE samples.wave_height_ft BETWEEN 0 AND 50
    ),

    wave_ranges AS (
      SELECT
        user_id,
        CASE
          WHEN count(*) >= 3 THEN round((percentile_cont(0.1) WITHIN GROUP (ORDER BY wave_height_ft))::numeric, 1)
          ELSE NULL::numeric
        END AS inferred_wave_min_ft,
        CASE
          WHEN count(*) >= 3 THEN round((percentile_cont(0.9) WITHIN GROUP (ORDER BY wave_height_ft))::numeric, 1)
          ELSE NULL::numeric
        END AS inferred_wave_max_ft
      FROM event_wave_samples
      GROUP BY user_id
    ),

    user_metrics AS (
      SELECT
        we.user_id,
        count(*) AS event_count,
        min(we.created_at) AS computed_from,
        max(we.created_at) AS computed_to,
        sum(abs(we.weight)) AS total_abs_weight,
        array_agg(
          jsonb_build_object(
            'beach_id', we.beach_id,
            'lat', b.lat,
            'lon', b.lon,
            'break_type', b.break_type,
            'weighted_engagement', we.weight * we.recency_factor
          )
          ORDER BY (we.weight * we.recency_factor) DESC
        ) FILTER (WHERE we.beach_id IS NOT NULL) AS beach_data
      FROM weighted_events we
      LEFT JOIN public.beaches b ON we.beach_id = b.id
      GROUP BY we.user_id
      HAVING count(*) >= 3
    )

  SELECT
    um.user_id,
    wr.inferred_wave_min_ft,
    wr.inferred_wave_max_ft,
    coalesce(
      (
        SELECT jsonb_object_agg(break_type, round(weight_pct::numeric, 2))
        FROM (
          SELECT
            (beach_obj->>'break_type')::text AS break_type,
            sum((beach_obj->>'weighted_engagement')::numeric) /
              nullif(sum(sum((beach_obj->>'weighted_engagement')::numeric)) OVER (), 0) AS weight_pct
          FROM unnest(um.beach_data) AS beach_obj
          WHERE beach_obj->>'break_type' IS NOT NULL
            AND (beach_obj->>'weighted_engagement')::numeric > 0
          GROUP BY (beach_obj->>'break_type')::text
        ) bt
        WHERE weight_pct > 0
      ),
      '{}'::jsonb
    ),
    round(
      (
        SELECT sum((beach_obj->>'lat')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(CASE WHEN beach_obj->>'lat' IS NOT NULL
                               THEN (beach_obj->>'weighted_engagement')::numeric
                               ELSE 0 END), 0)
        FROM unnest(um.beach_data) AS beach_obj
        WHERE (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    round(
      (
        SELECT sum((beach_obj->>'lon')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(CASE WHEN beach_obj->>'lon' IS NOT NULL
                               THEN (beach_obj->>'weighted_engagement')::numeric
                               ELSE 0 END), 0)
        FROM unnest(um.beach_data) AS beach_obj
        WHERE (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    coalesce(
      (
        SELECT array_agg(beach_id ORDER BY weighted_engagement DESC)
        FROM (
          SELECT
            (beach_obj->>'beach_id')::uuid AS beach_id,
            sum((beach_obj->>'weighted_engagement')::numeric) AS weighted_engagement
          FROM unnest(um.beach_data) AS beach_obj
          WHERE (beach_obj->>'weighted_engagement')::numeric > 0
          GROUP BY (beach_obj->>'beach_id')::uuid
          ORDER BY weighted_engagement DESC
          LIMIT 5
        ) ranked
      ),
      ARRAY[]::uuid[]
    ),
    round(
      (1.0 / (1.0 + exp(-0.05 * (um.total_abs_weight - 20))))::numeric,
      2
    ),
    um.event_count::int,
    now(),
    um.computed_from,
    um.computed_to
  FROM user_metrics um
  LEFT JOIN wave_ranges wr ON wr.user_id = um.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    inferred_wave_min_ft = excluded.inferred_wave_min_ft,
    inferred_wave_max_ft = excluded.inferred_wave_max_ft,
    break_type_weights = excluded.break_type_weights,
    location_centroid_lat = excluded.location_centroid_lat,
    location_centroid_lon = excluded.location_centroid_lon,
    top_engaged_beach_ids = excluded.top_engaged_beach_ids,
    confidence = excluded.confidence,
    event_count = excluded.event_count,
    last_computed_at = now(),
    computed_from = excluded.computed_from,
    computed_to = excluded.computed_to;

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  DELETE FROM public.user_implicit_preferences prefs
  WHERE (target_user_id IS NULL OR prefs.user_id = target_user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_events e
      JOIN public.profiles p
        ON p.id = e.user_id
       AND p.allow_implicit_tracking = true
      WHERE e.user_id = prefs.user_id
        AND e.created_at > now() - interval '90 days'
        AND e.event_type IN (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
      GROUP BY e.user_id
      HAVING count(*) >= 3
    );

  RAISE NOTICE 'compute_implicit_preferences: completed (processed_count=%)', processed_count;

  RETURN processed_count;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'compute_implicit_preferences: error - % (%)', sqlerrm, sqlstate;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."compute_implicit_preferences"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_implicit_preferences"("target_user_id" "uuid") IS 'Computes implicit preferences from opted-in user_events with weighted decay. Wave range is inferred from positive implicit event metadata first, then nearest enhanced_forecasts.forecast_at within +/- 6 hours. Pass NULL for batch processing all users, or user_id for single-user update.';



CREATE OR REPLACE FUNCTION "public"."compute_user_match_score"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_session_count integer;
  v_forecast_wave numeric;
  v_forecast_period numeric;
  v_forecast_wind numeric;
  v_forecast_wind_dir numeric;
  v_forecast_tide numeric;

  v_pref_wave numeric;
  v_pref_period numeric;
  v_pref_wind numeric;
  v_pref_wind_dir numeric;
  v_pref_tide numeric;
  v_pref_count integer;

  v_av_wave numeric;
  v_av_period numeric;
  v_av_wind numeric;
  v_av_wind_dir numeric;
  v_av_tide numeric;
  v_av_count integer;

  v_wave_distance numeric;
  v_period_distance numeric;
  v_wind_distance numeric;
  v_wind_dir_distance numeric;
  v_tide_distance numeric;

  v_av_wave_distance numeric;
  v_av_period_distance numeric;
  v_av_wind_distance numeric;
  v_av_wind_dir_distance numeric;
  v_av_tide_distance numeric;

  v_base_distance numeric;
  v_base_score numeric;
  v_aversion_distance numeric;
  v_aversion_proximity numeric;
  v_aversion_penalty numeric;
  v_score numeric;
  v_label text;
  v_confidence text;
  v_reason_bullets jsonb;
  v_board_tip text;
  v_beach_break_type text;

  c_aversion_scaling constant numeric := 3.0;
BEGIN
  -- Gate: need >=5 sessions with rating + snapshot in the last 12 months.
  SELECT COUNT(*)::integer INTO v_session_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL;

  IF v_session_count < 5 THEN
    RETURN jsonb_build_object(
      'state', 'onboarding',
      'session_count', v_session_count,
      'sessions_needed', 5 - v_session_count
    );
  END IF;

  -- Parse forecast inputs.
  v_forecast_wave     := public.parse_numeric_from_text(p_wave_height);
  v_forecast_period   := public.parse_numeric_from_text(p_wave_period);
  v_forecast_wind     := public.parse_numeric_from_text(p_wind_speed);
  v_forecast_wind_dir := public.parse_numeric_from_text(p_wind_direction);
  v_forecast_tide     := public.parse_numeric_from_text(p_tide_height);

  SELECT break_type INTO v_beach_break_type FROM public.beaches WHERE id = p_beach_id;

  -- Preference peak: weighted mean of conditions over sessions with rating >= 4.
  -- Weight = rating - 3 (1 for r=4, 2 for r=5). No contribution from r=3 or r<=2.
  SELECT
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_direction_deg') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    COUNT(*)::integer
  INTO
    v_pref_wave, v_pref_period, v_pref_wind, v_pref_wind_dir, v_pref_tide, v_pref_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  LEFT JOIN public.beaches b ON b.id = s.beach_id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating >= 4
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
    AND (v_beach_break_type IS NULL OR b.break_type = v_beach_break_type OR b.break_type IS NULL);

  -- Aversion peak: weighted mean of conditions over sessions with rating <= 2.
  -- Weight = 3 - rating (1 for r=2, 2 for r=1). No contribution from r=3 or r>=4.
  SELECT
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_direction_deg') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    COUNT(*)::integer
  INTO
    v_av_wave, v_av_period, v_av_wind, v_av_wind_dir, v_av_tide, v_av_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  LEFT JOIN public.beaches b ON b.id = s.beach_id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating <= 2
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
    AND (v_beach_break_type IS NULL OR b.break_type = v_beach_break_type OR b.break_type IS NULL);

  -- Degenerate: all-negative profile (no rating >= 4 samples). Cannot anchor a preference.
  IF v_pref_count IS NULL OR v_pref_count = 0 THEN
    IF v_av_count IS NULL OR v_av_count = 0 THEN
      -- Also no aversion samples -> all rating = 3 sessions. Return neutral ready state.
      RETURN jsonb_build_object(
        'state', 'ready',
        'score', 5.0,
        'label', 'FAIR',
        'reason_bullets', jsonb_build_array(
          'No strong preferences logged yet — keep rating sessions',
          format('Wave height %s ft — no profile peak', round(v_forecast_wave::numeric, 1)),
          format('Period %s s — no profile peak', round(v_forecast_period::numeric, 0))
        ),
        'board_tip', NULL,
        'confidence', 'low',
        'sessions_in_profile', v_session_count,
        'profile_kind', 'neutral'
      );
    END IF;

    -- Aversion only — we know what the user hates but not what they love. Can't score.
    RETURN jsonb_build_object(
      'state', 'onboarding',
      'session_count', v_session_count,
      'sessions_needed', 0,
      'reason', 'no_positive_sessions'
    );
  END IF;

  -- Base distance (forecast vs preference peak).
  v_wave_distance     := LEAST(ABS(v_pref_wave - v_forecast_wave) / GREATEST(v_pref_wave, 1), 1);
  v_period_distance   := LEAST(ABS(v_pref_period - v_forecast_period) / GREATEST(v_pref_period, 1), 1);
  v_wind_distance     := LEAST(ABS(v_pref_wind - v_forecast_wind) / GREATEST(v_pref_wind, 5), 1);
  v_tide_distance     := LEAST(ABS(v_pref_tide - v_forecast_tide) / 3, 1);
  v_wind_dir_distance := LEAST(
    LEAST(ABS(v_pref_wind_dir - v_forecast_wind_dir), 360 - ABS(v_pref_wind_dir - v_forecast_wind_dir)) / 180,
    1
  );

  v_base_distance := LEAST(
    0.35 * v_wave_distance +
    0.25 * v_period_distance +
    0.20 * v_wind_distance +
    0.10 * v_tide_distance +
    0.10 * v_wind_dir_distance,
    1.0
  );
  v_base_score := (1.0 - v_base_distance) * 10.0;

  -- Aversion penalty (forecast vs aversion peak). Only when we have samples.
  IF v_av_count IS NOT NULL AND v_av_count > 0 THEN
    v_av_wave_distance     := LEAST(ABS(v_av_wave - v_forecast_wave) / GREATEST(v_av_wave, 1), 1);
    v_av_period_distance   := LEAST(ABS(v_av_period - v_forecast_period) / GREATEST(v_av_period, 1), 1);
    v_av_wind_distance     := LEAST(ABS(v_av_wind - v_forecast_wind) / GREATEST(v_av_wind, 5), 1);
    v_av_tide_distance     := LEAST(ABS(v_av_tide - v_forecast_tide) / 3, 1);
    v_av_wind_dir_distance := LEAST(
      LEAST(ABS(v_av_wind_dir - v_forecast_wind_dir), 360 - ABS(v_av_wind_dir - v_forecast_wind_dir)) / 180,
      1
    );

    v_aversion_distance := LEAST(
      0.35 * v_av_wave_distance +
      0.25 * v_av_period_distance +
      0.20 * v_av_wind_distance +
      0.10 * v_av_tide_distance +
      0.10 * v_av_wind_dir_distance,
      1.0
    );
    v_aversion_proximity := 1.0 - v_aversion_distance;
    v_aversion_penalty := v_aversion_proximity * c_aversion_scaling;
  ELSE
    v_aversion_penalty := 0;
  END IF;

  v_score := GREATEST(0, LEAST(10, v_base_score - v_aversion_penalty));

  v_label := CASE
    WHEN v_score >= 8.5 THEN 'EPIC'
    WHEN v_score >= 7.0 THEN 'GOOD'
    WHEN v_score >= 5.5 THEN 'FAIR'
    WHEN v_score >= 3.5 THEN 'RIDEABLE'
    ELSE 'MEH'
  END;

  v_confidence := CASE
    WHEN v_session_count >= 25 THEN 'high'
    WHEN v_session_count >= 10 THEN 'medium'
    ELSE 'low'
  END;

  v_reason_bullets := jsonb_build_array(
    format('Wave height %s ft — profile peak %s ft', round(v_forecast_wave::numeric, 1), round(v_pref_wave::numeric, 1)),
    format('Period %s s — profile peak %s s', round(v_forecast_period::numeric, 0), round(v_pref_period::numeric, 0)),
    format('Wind %s mph — profile peak %s mph', round(v_forecast_wind::numeric, 0), round(v_pref_wind::numeric, 0))
  );

  -- Board tip (unchanged: most-used board at rating >=4 sessions with nearby wave height).
  SELECT
    CASE
      WHEN b.dimensions IS NOT NULL AND b.dimensions <> '' THEN b.name || ' ' || b.dimensions
      ELSE b.name
    END
  INTO v_board_tip
  FROM public.sessions s
  JOIN public.boards b ON b.id = s.board_id
  WHERE s.user_id = p_user_id
    AND s.rating >= 4
    AND s.status = 'completed'
    AND ABS(public.parse_numeric_from_text((SELECT forecast_snapshot->>'wave_height' FROM public.session_forecast_snapshots WHERE session_id = s.id)) - v_forecast_wave) < 1.5
  GROUP BY b.id, b.name, b.dimensions
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'state', 'ready',
    'score', round(v_score::numeric, 1),
    'label', v_label,
    'reason_bullets', v_reason_bullets,
    'board_tip', v_board_tip,
    'confidence', v_confidence,
    'sessions_in_profile', v_session_count,
    'profile_kind', CASE WHEN v_av_count IS NOT NULL AND v_av_count > 0 THEN 'two_sided' ELSE 'preference_only' END,
    'base_score', round(v_base_score::numeric, 2),
    'aversion_penalty', round(v_aversion_penalty::numeric, 2),
    'aversion_sample_count', COALESCE(v_av_count, 0)
  );
END;
$$;


ALTER FUNCTION "public"."compute_user_match_score"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_user_match_score_batch"("p_user_id" "uuid", "p_beach_id" "uuid", "p_slots" "jsonb") RETURNS TABLE("slot_idx" integer, "forecast_at" timestamp with time zone, "result" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$ DECLARE v_slot jsonb; v_idx int := 0; BEGIN IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN RAISE EXCEPTION 'compute_user_match_score_batch: p_slots must be a jsonb array (got: %)', coalesce(jsonb_typeof(p_slots), '<null>'); END IF; FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP slot_idx := v_idx; forecast_at := (v_slot->>'forecast_at')::timestamptz; result := public.compute_user_match_score(p_user_id, p_beach_id, v_slot->>'wave_height', v_slot->>'wave_period', v_slot->>'wind_speed', v_slot->>'wind_direction', v_slot->>'tide_height'); RETURN NEXT; v_idx := v_idx + 1; END LOOP; END; $$;


ALTER FUNCTION "public"."compute_user_match_score_batch"("p_user_id" "uuid", "p_beach_id" "uuid", "p_slots" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_user_match_score_batch"("p_user_id" "uuid", "p_beach_id" "uuid", "p_slots" "jsonb") IS 'Batched form of compute_user_match_score. Takes p_slots as a jsonb array of {forecast_at, wave_height, wave_period, wind_speed, wind_direction, tide_height} and returns one row per slot with (slot_idx, forecast_at, result). The result jsonb is the verbatim output of compute_user_match_score for that slot — preserving every possible shape (state=onboarding, state=ready, neutral fallback). Saves N-1 round-trips when scoring a forecast horizon. Declared VOLATILE to match the inner function''s default volatility — do not re-mark STABLE without first making compute_user_match_score STABLE-safe (its reads of sessions / session_forecast_snapshots / boards may not qualify under your data model).';



CREATE OR REPLACE FUNCTION "public"."concat_text_array"("vals" "text"[]) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select array_to_string(vals, ' ');
$$;


ALTER FUNCTION "public"."concat_text_array"("vals" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_auth_apple_orphan_users"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT COUNT(*)::integer
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'iss' LIKE '%appleid%'
    AND NOT EXISTS (
      SELECT 1
      FROM auth.identities i
      WHERE i.user_id = u.id
    );
$$;


ALTER FUNCTION "public"."count_auth_apple_orphan_users"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_auth_apple_orphan_users"() IS 'Release audit gate: counts Apple OIDC auth.users rows with no auth.identities row. Expected value before mobile release: 0. Service-role only; returns no PII.';



CREATE OR REPLACE FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  activity_id uuid;
begin
  insert into public.user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  values (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  returning id into activity_id;
  
  return activity_id;
end;
$$;


ALTER FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_custom_spot_guarded"("p_name" "text", "p_lat" double precision, "p_lon" double precision, "p_break_type" "text" DEFAULT NULL::"text", "p_visibility" "text" DEFAULT 'private'::"text", "p_facing_direction_deg" numeric DEFAULT NULL::numeric, "p_swell_window_min_deg" numeric DEFAULT NULL::numeric, "p_swell_window_max_deg" numeric DEFAULT NULL::numeric, "p_offshore_direction_deg" numeric DEFAULT NULL::numeric, "p_exposure_level" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "lat" numeric, "lon" numeric, "break_type" "text", "visibility" "text", "nearest_beach_id" "uuid", "nearest_beach_distance_mi" numeric, "deleted_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "facing_direction_deg" numeric, "swell_window_min_deg" numeric, "swell_window_max_deg" numeric, "offshore_direction_deg" numeric, "exposure_level" "text", "fingerprint_confidence" "text", "fingerprint_updated_at" timestamp with time zone, "favorite_id" "uuid", "favorite_rank" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  trimmed_name text := btrim(p_name);
  nearest_id uuid;
  nearest_distance_miles numeric(5,2);
  favorite_count integer;
  next_rank integer;
  has_unlimited_favorites boolean;
  inserted_spot public.custom_spots%ROWTYPE;
  has_fingerprint boolean := (
    p_facing_direction_deg IS NOT NULL
    OR p_swell_window_min_deg IS NOT NULL
    OR p_swell_window_max_deg IS NOT NULL
    OR p_offshore_direction_deg IS NOT NULL
    OR p_exposure_level IS NOT NULL
  );
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF trimmed_name IS NULL OR char_length(trimmed_name) < 1 OR char_length(trimmed_name) > 60 THEN
    RAISE EXCEPTION 'invalid_custom_spot_name'
      USING DETAIL = 'name_length_1_60_required';
  END IF;

  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lon < -180 OR p_lon > 180 THEN
    RAISE EXCEPTION 'invalid_custom_spot_coordinates'
      USING DETAIL = 'lat_lon_out_of_range';
  END IF;

  IF p_break_type IS NOT NULL
     AND p_break_type <> ALL (ARRAY['reef','point','beach','rivermouth','jetty']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_break_type'
      USING DETAIL = 'unsupported_break_type';
  END IF;

  IF p_exposure_level IS NOT NULL
     AND p_exposure_level <> ALL (ARRAY['sheltered','mixed','exposed']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_exposure'
      USING DETAIL = 'unsupported_exposure_level';
  END IF;

  IF p_facing_direction_deg IS NOT NULL
     AND (p_facing_direction_deg < 0 OR p_facing_direction_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_facing_direction'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  IF p_swell_window_min_deg IS NOT NULL
     AND (p_swell_window_min_deg < 0 OR p_swell_window_min_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_swell_min'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  IF p_swell_window_max_deg IS NOT NULL
     AND (p_swell_window_max_deg < 0 OR p_swell_window_max_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_swell_max'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  IF p_offshore_direction_deg IS NOT NULL
     AND (p_offshore_direction_deg < 0 OR p_offshore_direction_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_offshore_direction'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  nearest_id := public.find_nearest_beach_id(
    p_lat::decimal,
    p_lon::decimal,
    241401.6
  );

  IF nearest_id IS NULL THEN
    RAISE EXCEPTION 'custom_spot_out_of_coverage'
      USING DETAIL = 'nearest_beach_required';
  END IF;

  SELECT round((ST_Distance(
    b.geog,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  ) / 1609.344)::numeric, 2)::numeric(5,2)
  INTO nearest_distance_miles
  FROM public.beaches b
  WHERE b.id = nearest_id;

  IF nearest_distance_miles IS NULL THEN
    RAISE EXCEPTION 'custom_spot_out_of_coverage'
      USING DETAIL = 'nearest_beach_distance_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements ue
    WHERE ue.user_id = current_user_id
      AND (ue.is_pro = true OR ue.is_trialing = true)
      AND (
        ue.expires_at IS NULL
        OR ue.expires_at > now()
        OR ue.billing_issue = true
      )
  ) INTO has_unlimited_favorites;

  SELECT count(*) INTO favorite_count
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  IF NOT has_unlimited_favorites AND favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING DETAIL = 'free_favorites_limit';
  END IF;

  SELECT COALESCE(max(fb.rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  INSERT INTO public.custom_spots (
    user_id,
    name,
    lat,
    lon,
    break_type,
    visibility,
    nearest_beach_id,
    nearest_beach_distance_mi,
    facing_direction_deg,
    swell_window_min_deg,
    swell_window_max_deg,
    offshore_direction_deg,
    exposure_level,
    fingerprint_confidence,
    fingerprint_updated_at
  )
  VALUES (
    current_user_id,
    trimmed_name,
    p_lat,
    p_lon,
    p_break_type,
    'private',
    nearest_id,
    nearest_distance_miles,
    p_facing_direction_deg,
    p_swell_window_min_deg,
    p_swell_window_max_deg,
    p_offshore_direction_deg,
    p_exposure_level,
    CASE WHEN has_fingerprint THEN 'user_set' ELSE 'unset' END,
    CASE WHEN has_fingerprint THEN now() ELSE NULL END
  )
  RETURNING * INTO inserted_spot;

  INSERT INTO public.favorite_beaches (
    user_id,
    beach_id,
    custom_spot_id,
    rank,
    alerts_enabled
  )
  VALUES (
    current_user_id,
    NULL,
    inserted_spot.id,
    next_rank,
    false
  )
  RETURNING favorite_beaches.id, favorite_beaches.rank
  INTO favorite_id, favorite_rank;

  id := inserted_spot.id;
  user_id := inserted_spot.user_id;
  name := inserted_spot.name;
  lat := inserted_spot.lat;
  lon := inserted_spot.lon;
  break_type := inserted_spot.break_type;
  visibility := inserted_spot.visibility;
  nearest_beach_id := inserted_spot.nearest_beach_id;
  nearest_beach_distance_mi := inserted_spot.nearest_beach_distance_mi;
  deleted_at := inserted_spot.deleted_at;
  created_at := inserted_spot.created_at;
  updated_at := inserted_spot.updated_at;
  facing_direction_deg := inserted_spot.facing_direction_deg;
  swell_window_min_deg := inserted_spot.swell_window_min_deg;
  swell_window_max_deg := inserted_spot.swell_window_max_deg;
  offshore_direction_deg := inserted_spot.offshore_direction_deg;
  exposure_level := inserted_spot.exposure_level;
  fingerprint_confidence := inserted_spot.fingerprint_confidence;
  fingerprint_updated_at := inserted_spot.fingerprint_updated_at;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."create_custom_spot_guarded"("p_name" "text", "p_lat" double precision, "p_lon" double precision, "p_break_type" "text", "p_visibility" "text", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_session_forecast_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  forecast_data jsonb;
  conditions_data jsonb;
  forecast_vs_actual_data jsonb := '{}'::jsonb;
  snapshot_exists boolean;
  should_rematch_forecast boolean := false;
  forecast_wave_height numeric;
  forecast_wind_speed numeric;
  forecast_tide_height numeric;
BEGIN
  PERFORM public.sync_session_wave_observation_candidate(
    new.id,
    new.user_id,
    new.beach_id::uuid,
    new.arrival_time,
    new.status,
    new.wave_height_ft,
    'trigger'
  );

  IF new.status IS DISTINCT FROM 'completed' THEN
    RETURN new;
  END IF;

  conditions_data := jsonb_build_object(
    'wave_quality', new.wave_quality,
    'water_temp', new.water_temp,
    'crowd_level', new.crowd_level,
    'parking_ease', new.parking_ease,
    'rating', new.rating,
    'notes', new.notes,
    'duration_minutes', new.duration_minutes,
    'arrival_time', new.arrival_time,
    'wave_height_ft', new.wave_height_ft,
    'wind_speed_mph', new.wind_speed_mph,
    'wind_direction', new.wind_direction,
    'forecast_accuracy', new.forecast_accuracy,
    'tide_height_ft', new.tide_height_ft,
    'tide_status', new.tide_status
  );

  IF tg_op = 'UPDATE' THEN
    should_rematch_forecast :=
      old.status = 'completed'
      AND (
        old.arrival_time IS DISTINCT FROM new.arrival_time
        OR old.beach_id IS DISTINCT FROM new.beach_id
      );
  END IF;

  IF tg_op = 'UPDATE' THEN
    IF old.status = 'completed' THEN
      SELECT sfs.forecast_snapshot
      INTO forecast_data
      FROM public.session_forecast_snapshots sfs
      WHERE sfs.session_id = new.id;

      IF forecast_data IS NOT NULL AND NOT should_rematch_forecast THEN
        IF forecast_data->>'wave_height' IS NOT NULL AND new.wave_height_ft IS NOT NULL THEN
          BEGIN
            forecast_wave_height := (forecast_data->>'wave_height')::numeric;
            IF forecast_wave_height IS DISTINCT FROM new.wave_height_ft THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wave_height_ft', jsonb_build_object(
                  'forecast', forecast_wave_height,
                  'actual', new.wave_height_ft,
                  'diff', new.wave_height_ft - forecast_wave_height
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'wind_speed_mph' IS NOT NULL AND new.wind_speed_mph IS NOT NULL THEN
          BEGIN
            forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
            IF forecast_wind_speed IS DISTINCT FROM new.wind_speed_mph THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wind_speed_mph', jsonb_build_object(
                  'forecast', forecast_wind_speed,
                  'actual', new.wind_speed_mph,
                  'diff', new.wind_speed_mph - forecast_wind_speed
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'wind_direction' IS NOT NULL AND new.wind_direction IS NOT NULL THEN
          IF forecast_data->>'wind_direction' <> new.wind_direction THEN
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'wind_direction', jsonb_build_object(
                'forecast', forecast_data->>'wind_direction',
                'actual', new.wind_direction
              )
            );
          END IF;
        END IF;

        IF forecast_data->>'tide_height' IS NOT NULL AND new.tide_height_ft IS NOT NULL THEN
          BEGIN
            forecast_tide_height := (forecast_data->>'tide_height')::numeric;
            IF forecast_tide_height IS DISTINCT FROM new.tide_height_ft THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'tide_height_ft', jsonb_build_object(
                  'forecast', forecast_tide_height,
                  'actual', new.tide_height_ft,
                  'diff', new.tide_height_ft - forecast_tide_height
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'tide_status' IS NOT NULL AND new.tide_status IS NOT NULL THEN
          IF forecast_data->>'tide_status' <> new.tide_status THEN
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'tide_status', jsonb_build_object(
                'forecast', forecast_data->>'tide_status',
                'actual', new.tide_status
              )
            );
          END IF;
        END IF;

        UPDATE public.session_forecast_snapshots
        SET
          actual_conditions = coalesce(actual_conditions, '{}'::jsonb) || conditions_data,
          forecast_vs_actual = forecast_vs_actual_data,
          session_date = new.arrival_time::date,
          updated_at = now()
        WHERE session_id = new.id;

        RETURN new;
      END IF;
    END IF;
  END IF;

  SELECT exists(
    SELECT 1
    FROM public.session_forecast_snapshots
    WHERE session_id = new.id
  ) INTO snapshot_exists;

  IF snapshot_exists AND NOT should_rematch_forecast THEN
    RETURN new;
  END IF;

  SELECT to_jsonb(ef.*)
  INTO forecast_data
  FROM public.enhanced_forecasts ef
  WHERE ef.beach_id::uuid = new.beach_id::uuid
    AND ef.forecast_at IS NOT NULL
    AND ef.forecast_at BETWEEN new.arrival_time - interval '6 hours'
                          AND new.arrival_time + interval '6 hours'
  ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - new.arrival_time))) ASC
  LIMIT 1;

  IF forecast_data IS NOT NULL THEN
    forecast_vs_actual_data := '{}'::jsonb;

    IF forecast_data->>'wave_height' IS NOT NULL AND new.wave_height_ft IS NOT NULL THEN
      BEGIN
        forecast_wave_height := (forecast_data->>'wave_height')::numeric;
        IF forecast_wave_height IS DISTINCT FROM new.wave_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wave_height_ft', jsonb_build_object(
              'forecast', forecast_wave_height,
              'actual', new.wave_height_ft,
              'diff', new.wave_height_ft - forecast_wave_height
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'wind_speed_mph' IS NOT NULL AND new.wind_speed_mph IS NOT NULL THEN
      BEGIN
        forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
        IF forecast_wind_speed IS DISTINCT FROM new.wind_speed_mph THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wind_speed_mph', jsonb_build_object(
              'forecast', forecast_wind_speed,
              'actual', new.wind_speed_mph,
              'diff', new.wind_speed_mph - forecast_wind_speed
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'wind_direction' IS NOT NULL AND new.wind_direction IS NOT NULL THEN
      IF forecast_data->>'wind_direction' <> new.wind_direction THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'wind_direction', jsonb_build_object(
            'forecast', forecast_data->>'wind_direction',
            'actual', new.wind_direction
          )
        );
      END IF;
    END IF;

    IF forecast_data->>'tide_height' IS NOT NULL AND new.tide_height_ft IS NOT NULL THEN
      BEGIN
        forecast_tide_height := (forecast_data->>'tide_height')::numeric;
        IF forecast_tide_height IS DISTINCT FROM new.tide_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'tide_height_ft', jsonb_build_object(
              'forecast', forecast_tide_height,
              'actual', new.tide_height_ft,
              'diff', new.tide_height_ft - forecast_tide_height
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'tide_status' IS NOT NULL AND new.tide_status IS NOT NULL THEN
      IF forecast_data->>'tide_status' <> new.tide_status THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'tide_status', jsonb_build_object(
            'forecast', forecast_data->>'tide_status',
            'actual', new.tide_status
          )
        );
      END IF;
    END IF;

    IF snapshot_exists THEN
      UPDATE public.session_forecast_snapshots
      SET
        beach_id = new.beach_id::uuid,
        forecast_snapshot = forecast_data,
        actual_conditions = coalesce(actual_conditions, '{}'::jsonb) || conditions_data,
        forecast_vs_actual = forecast_vs_actual_data,
        forecast_confidence_score = (forecast_data->>'confidence_score')::integer,
        data_source = forecast_data->>'data_source',
        session_date = new.arrival_time::date,
        updated_at = now()
      WHERE session_id = new.id;
    ELSE
      BEGIN
        INSERT INTO public.session_forecast_snapshots (
          session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
          forecast_vs_actual, forecast_confidence_score, data_source, session_date
        ) VALUES (
          new.id, new.user_id, new.beach_id::uuid, forecast_data, conditions_data,
          forecast_vs_actual_data, (forecast_data->>'confidence_score')::integer,
          forecast_data->>'data_source', new.arrival_time::date
        );
      EXCEPTION
        WHEN unique_violation THEN NULL;
        WHEN others THEN RAISE WARNING 'Failed to create forecast snapshot for session %: %', new.id, sqlerrm;
      END;
    END IF;
  ELSIF snapshot_exists AND should_rematch_forecast THEN
    DELETE FROM public.session_forecast_snapshots
    WHERE session_id = new.id;
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."create_session_forecast_snapshot"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_session_forecast_snapshot"() IS 'Creates session forecast snapshots and keeps actual_conditions synced. Forecast rows are matched by nearest enhanced_forecasts.forecast_at within +/- 6 hours of session arrival_time.';



CREATE OR REPLACE FUNCTION "public"."custom_spots_lock_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'custom_spots.user_id is immutable after insert';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."custom_spots_lock_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_session_share_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE sessions
  SET share_count = GREATEST(0, share_count - 1)
  WHERE id = OLD.session_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_session_share_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_audit_id uuid;
  v_sessions_soft_deleted int := 0;
  v_comments_anonymized int := 0;
  v_personal_rows_deleted int := 0;
  v_count int;
BEGIN
  INSERT INTO account_deletions (user_id) VALUES (p_user_id) RETURNING id INTO v_audit_id;

  UPDATE sessions
  SET deleted_at = now(),
      notes = NULL,
      description = NULL,
      image_url = NULL,
      board_snapshot = NULL,
      muted = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sessions_soft_deleted = ROW_COUNT;

  UPDATE comments
  SET content = '[deleted]',
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_comments_anonymized = ROW_COUNT;

  UPDATE beach_reviews
  SET title = '[deleted]',
      content = '[deleted]',
      deleted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  UPDATE intel_posts
  SET is_active = false,
      title = '[deleted]',
      description = '[deleted]',
      photo_url = NULL,
      photo_storage_path = NULL,
      vibe = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  DELETE FROM intel_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_email_prefs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_surf_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_implicit_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_beach_affinity WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM favorite_beaches WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_devices WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_badges WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_xp WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM xp_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM personalization_milestones WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM saved_windows WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_invitations WHERE inviter_id = p_user_id OR invitee_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM boards WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  UPDATE session_media
  SET deleted_at = now(),
      caption = NULL
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  DELETE FROM session_forecast_snapshots WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM spot_feedback WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM notifications WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_alert_deliveries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_follows WHERE follower_id = p_user_id OR following_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM beach_review_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_shares WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_accuracy_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_post_confirmations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Soft-delete the profile + scrub PII.
  -- (Removed: preferred_wave_size, preferred_break_type, crowd_preference —
  -- those columns were dropped from profiles via MCP earlier.)
  UPDATE profiles
  SET deleted_at = now(),
      full_name = 'Deleted surfer',
      avatar_url = NULL,
      bio = NULL,
      location = NULL,
      instagram = NULL,
      home_beach_id = NULL,
      experience_level = NULL,
      preferred_session_time = NULL,
      surf_styles = NULL,
      followers_count = 0,
      following_count = 0,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE account_deletions
  SET completed_at = now(),
      sessions_soft_deleted = v_sessions_soft_deleted,
      comments_anonymized = v_comments_anonymized,
      personal_rows_deleted = v_personal_rows_deleted
  WHERE id = v_audit_id;

  RETURN jsonb_build_object(
    'audit_id', v_audit_id,
    'sessions_soft_deleted', v_sessions_soft_deleted,
    'comments_anonymized', v_comments_anonymized,
    'personal_rows_deleted', v_personal_rows_deleted
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE account_deletions
  SET error = SQLERRM
  WHERE id = v_audit_id;
  RAISE;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_account"("p_user_id" "uuid") IS 'Atomic soft-delete of a user account. Service role only. Called from the delete-account Edge Function after verifying the caller JWT.';



CREATE OR REPLACE FUNCTION "public"."dev_log_session_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_user_id uuid;
  v_pid_info record;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id <> '73040cff-afe9-4fa0-a874-2016203fc015'::uuid THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT application_name, client_addr, query
    INTO v_pid_info
    FROM pg_stat_activity
   WHERE pid = pg_backend_pid();

  INSERT INTO public.dev_session_mutation_audit
    (op, user_id, session_id, old_row, new_row,
     application_name, client_addr, current_user_role, session_user_role,
     current_query)
  VALUES
    (TG_OP, v_user_id, COALESCE(NEW.id, OLD.id),
     to_jsonb(OLD), to_jsonb(NEW),
     v_pid_info.application_name, v_pid_info.client_addr,
     current_user::name, session_user::name,
     v_pid_info.query);

  RETURN COALESCE(NEW, OLD);
END
$$;


ALTER FUNCTION "public"."dev_log_session_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_anon_alert_capture"("p_user_id" "uuid", "p_email" "text") RETURNS TABLE("capture_id" "uuid", "beach_id" "uuid", "preset_type" "text", "return_path" "text", "captured_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_first_beach_id uuid;
BEGIN
  -- 1. Atomic claim. UPDATE...RETURNING in a CTE so the SELECT can ORDER.
  CREATE TEMP TABLE claimed_captures ON COMMIT DROP AS
  WITH claimed AS (
    UPDATE pending_alert_captures
       SET consumed_at      = now(),
           consumed_user_id = p_user_id
     WHERE email       = lower(p_email)
       AND consumed_at IS NULL
       AND expires_at  > now()
    RETURNING id, beach_id, preset_type, return_path, captured_at
  )
  SELECT * FROM claimed;

  -- 2. Insert one alert_rules row per claimed capture.
  INSERT INTO alert_rules (user_id, beach_id, name, preset_type, conditions, notify_email, notify_push, enabled)
  SELECT
    p_user_id,
    c.beach_id,
    preset_default_name(c.preset_type, c.beach_id),
    c.preset_type,
    preset_default_conditions(c.preset_type, c.beach_id),
    true,
    false,
    true
  FROM claimed_captures c;

  -- 3 + 4. Update profile if there was at least one capture.
  SELECT beach_id INTO v_first_beach_id
  FROM claimed_captures
  ORDER BY captured_at ASC
  LIMIT 1;

  IF v_first_beach_id IS NOT NULL THEN
    UPDATE profiles
       SET home_beach_id  = COALESCE(home_beach_id, v_first_beach_id),
           signup_context = jsonb_set(
             COALESCE(signup_context, '{}'::jsonb),
             '{entrypoint}',
             '"anon_alert_capture"'::jsonb
           )
     WHERE id = p_user_id;
  END IF;

  -- Return the materialized captures ordered by captured_at ASC for the
  -- caller to use as redirect/event metadata.
  RETURN QUERY
    SELECT id, beach_id, preset_type, return_path, captured_at
    FROM claimed_captures
    ORDER BY captured_at ASC;
END;
$$;


ALTER FUNCTION "public"."finalize_anon_alert_capture"("p_user_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_cities_by_pattern"("search_pattern" "text", "state_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("city" "text", "state" "text", "beach_count" bigint, "is_exact_match" boolean)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.city,
    b.state,
    COUNT(*)::BIGINT as beach_count,
    -- Exact match: normalized city equals normalized search pattern
    (unaccent(lower(b.city)) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(b.city, '-', ' '))) = unaccent(lower(search_pattern))) as is_exact_match
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND (state_filter IS NULL OR b.state = state_filter)
    AND (
      -- Match with unaccent (handles Rincon vs rincon)
      unaccent(lower(b.city)) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
      OR
      -- Match with hyphen normalization (handles Cardiff-by-the-Sea vs cardiff by the sea)
      unaccent(lower(replace(b.city, '-', ' '))) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
    )
  GROUP BY b.city, b.state
  ORDER BY
    -- Exact matches first
    (unaccent(lower(b.city)) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(b.city, '-', ' '))) = unaccent(lower(search_pattern))) DESC,
    -- Then by beach count (more beaches = more popular)
    COUNT(*) DESC;
END;
$$;


ALTER FUNCTION "public"."find_cities_by_pattern"("search_pattern" "text", "state_filter" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ioos_stations" (
    "station_id" "text" NOT NULL,
    "source_network" "text" NOT NULL,
    "name" "text",
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "coordinates" "public"."geometry"(Point,4326),
    "sensors" "jsonb",
    "has_wave_data" boolean DEFAULT false,
    "nearest_beach_id" "uuid",
    "distance_to_beach_km" numeric,
    "active" boolean DEFAULT true,
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "available_variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "variable_map" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "variables_last_synced_at" timestamp with time zone,
    "consecutive_discovery_misses" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."ioos_stations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ioos_stations" IS 'IOOS station metadata from ERDDAP API, synced weekly';



COMMENT ON COLUMN "public"."ioos_stations"."source_network" IS 'Regional network: PacIOOS, SECOORA, CeNCOOS, etc.';



COMMENT ON COLUMN "public"."ioos_stations"."sensors" IS 'JSON array of available sensor types';



COMMENT ON COLUMN "public"."ioos_stations"."available_variables" IS 'Raw variable list from ERDDAP /info endpoint';



COMMENT ON COLUMN "public"."ioos_stations"."variable_map" IS 'Mapping: canonical field name -> actual ERDDAP variable name';



COMMENT ON COLUMN "public"."ioos_stations"."variables_last_synced_at" IS 'Last time we refreshed variable info from ERDDAP';



CREATE OR REPLACE FUNCTION "public"."find_nearby_ioos_stations"("p_lat" numeric, "p_lon" numeric, "p_radius_km" numeric DEFAULT 100) RETURNS SETOF "public"."ioos_stations"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT s.*
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000  -- Convert km to meters
    )
  ORDER BY ST_Distance(
    s.coordinates::geography,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  )
  LIMIT 10;
$$;


ALTER FUNCTION "public"."find_nearby_ioos_stations"("p_lat" numeric, "p_lon" numeric, "p_radius_km" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_nearby_ioos_stations"("p_lat" numeric, "p_lon" numeric, "p_radius_km" numeric) IS 'Find active IOOS wave stations within radius_km of a point, ordered by distance';



CREATE OR REPLACE FUNCTION "public"."find_nearest_beach_id"("post_lat" numeric, "post_lon" numeric, "max_distance_meters" double precision DEFAULT 3218.69) RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  nearest_id UUID;
BEGIN
  IF post_lat IS NULL OR post_lon IS NULL
     OR post_lat = 0 OR post_lon = 0
     OR post_lat < -90 OR post_lat > 90
     OR post_lon < -180 OR post_lon > 180 THEN
    RETURN NULL;
  END IF;

  SELECT b.id INTO nearest_id
  FROM public.beaches b
  WHERE b.geog IS NOT NULL
    AND ST_DWithin(
      b.geog,
      ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography,
      max_distance_meters
    )
  ORDER BY ST_Distance(
    b.geog,
    ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography
  )
  LIMIT 1;

  RETURN nearest_id;
END;
$$;


ALTER FUNCTION "public"."find_nearest_beach_id"("post_lat" numeric, "post_lon" numeric, "max_distance_meters" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_nearest_beach_id"("post_lat" numeric, "post_lon" numeric, "max_distance_meters" double precision) IS 'Finds the nearest beach within a given radius of the specified coordinates. Uses the pre-computed geog column with GiST index for optimal performance. Default radius is 2 miles (3218.69 meters).';



CREATE OR REPLACE FUNCTION "public"."find_orphaned_session_media"() RETURNS TABLE("storage_path" "text", "media_id" "uuid", "deleted_at" timestamp with time zone, "days_since_deletion" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    -- Only admins can run this query
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Only administrators can query orphaned media';
    END IF;

    RETURN QUERY
    SELECT
        sm.storage_path,
        sm.id as media_id,
        sm.deleted_at,
        EXTRACT(DAY FROM (NOW() - sm.deleted_at))::INTEGER as days_since_deletion
    FROM public.session_media sm
    WHERE sm.deleted_at IS NOT NULL
    AND sm.deleted_at < NOW() - INTERVAL '7 days'  -- Grace period
    ORDER BY sm.deleted_at ASC;
END;
$$;


ALTER FUNCTION "public"."find_orphaned_session_media"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_orphaned_session_media"() IS 'Admin function to find soft-deleted media records older than 7 days.
These records indicate storage files that should be cleaned up.
Returns storage paths for bulk cleanup operations.';



CREATE OR REPLACE FUNCTION "public"."follow_user_with_notification"("p_target_user_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_event_id uuid;
  v_dedup_collision boolean := false;
  v_existing_id uuid;
BEGIN
  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_id mismatch: must match auth.uid()';
  END IF;

  IF p_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'cannot follow yourself';
  END IF;

  SELECT id INTO v_existing_id
    FROM user_follows
    WHERE follower_id = p_actor_id AND following_id = p_target_user_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object(
      'followed', true,
      'was_existing', true,
      'event_id', null,
      'notification_dedup_collision', false
    );
  END IF;

  INSERT INTO user_follows (follower_id, following_id)
    VALUES (p_actor_id, p_target_user_id);

  BEGIN
    INSERT INTO notification_events (
      recipient_user_id, actor_user_id, type,
      entity_type, entity_id, payload, dedupe_key
    ) VALUES (
      p_target_user_id, p_actor_id, 'follow',
      'user', p_target_user_id,
      '{}'::jsonb,
      p_dedupe_key
    )
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    v_dedup_collision := true;
    v_event_id := null;
  END;

  RETURN json_build_object(
    'followed', true,
    'was_existing', false,
    'event_id', v_event_id,
    'notification_dedup_collision', v_dedup_collision
  );
END;
$$;


ALTER FUNCTION "public"."follow_user_with_notification"("p_target_user_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_referral_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    -- Try to generate a unique code (max 10 attempts to avoid infinite loops)
    LOOP
        -- Generate 6-character alphanumeric code
        new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

        -- Check if code already exists (case-insensitive)
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE LOWER(referral_code) = LOWER(new_code)
        ) INTO code_exists;

        -- Exit if unique code found
        EXIT WHEN NOT code_exists;

        -- Increment attempt counter
        attempt := attempt + 1;

        -- Raise exception if max attempts reached
        IF attempt >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', max_attempts;
        END IF;
    END LOOP;

    RETURN new_code;
END;
$$;


ALTER FUNCTION "public"."generate_referral_code"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_referral_code"() IS 'Generates a unique 6-character alphanumeric referral code (case-insensitive uniqueness check)';



CREATE OR REPLACE FUNCTION "public"."get_all_beach_locations"() RETURNS TABLE("country" "text", "state" "text", "city" "text", "beach_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.country,
    b.state,
    b.city,
    COUNT(*) as beach_count
  FROM beaches b
  WHERE b.is_private = false
    AND b.city IS NOT NULL
    AND b.state IS NOT NULL
    AND b.country IS NOT NULL
  GROUP BY b.country, b.state, b.city
  HAVING COUNT(*) >= 1
  ORDER BY beach_count DESC, b.country, b.state, b.city;
END;
$$;


ALTER FUNCTION "public"."get_all_beach_locations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_all_beach_locations"() IS 'Returns all unique location combinations (city, state, country) with at least 1 beach.
Used for Next.js static generation of location pages and sitemaps.';



CREATE OR REPLACE FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") RETURNS TABLE("beach_id" "uuid", "beach_name" "text", "predictions_total" bigint, "predictions_matched" bigint, "match_rate_pct" numeric, "raw_mae" numeric, "corrected_mae" numeric, "mae_improvement_pct" numeric, "improvement_rate_pct" numeric, "avg_raw_bias" numeric, "avg_corrected_bias" numeric, "last_prediction_at" timestamp with time zone, "period_start" timestamp with time zone, "period_end" timestamp with time zone)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    beach_id, beach_name, predictions_total, predictions_matched,
    match_rate_pct, raw_mae, corrected_mae, mae_improvement_pct,
    improvement_rate_pct, avg_raw_bias, avg_corrected_bias,
    last_prediction_at, period_start, period_end
  FROM beach_ml_performance_baseline
  WHERE beach_id = p_beach_id;
$$;


ALTER FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") IS 'Returns ML performance metrics for a specific beach from the baseline view.';



CREATE OR REPLACE FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  -- Tier 1: IOOS direct match
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
  LIMIT 1;
  IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;

  -- Tier 2: IOOS spatial 25km + swell compat
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;
  IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;

  -- Tier 3: NDBC direct match (exclusive only)
  SELECT s.station_id INTO v_station_id
  FROM ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
  ORDER BY s.distance_to_beach_km
  LIMIT 1;
  IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;

  -- Tier 4: NDBC direct spatial 25km + swell compat
  SELECT s.station_id INTO v_station_id
  FROM ndbc_direct_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$;


ALTER FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") IS 'Returns the nearest active IOOS station_id for a beach, filtered by 3km proximity and swell window compatibility. Used by backfill to find observation sources.';



CREATE OR REPLACE FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") RETURNS TABLE("beach_id" "uuid", "total_reviews" integer, "average_overall_rating" numeric, "average_wave_quality" numeric, "average_crowd_density" numeric, "average_parking" numeric, "average_accessibility" numeric, "rating_distribution" "jsonb")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        target_beach_id,
        COUNT(*)::INTEGER AS total_reviews,
        ROUND(AVG(br.overall_rating)::DECIMAL, 2) AS average_overall_rating,
        ROUND(AVG(br.wave_quality_rating)::DECIMAL, 2) AS average_wave_quality,
        ROUND(AVG(br.crowd_density_rating)::DECIMAL, 2) AS average_crowd_density,
        ROUND(AVG(br.parking_rating)::DECIMAL, 2) AS average_parking,
        ROUND(AVG(br.accessibility_rating)::DECIMAL, 2) AS average_accessibility,
        jsonb_build_object(
            '5_star', COUNT(*) FILTER (WHERE br.overall_rating = 5),
            '4_star', COUNT(*) FILTER (WHERE br.overall_rating = 4),
            '3_star', COUNT(*) FILTER (WHERE br.overall_rating = 3),
            '2_star', COUNT(*) FILTER (WHERE br.overall_rating = 2),
            '1_star', COUNT(*) FILTER (WHERE br.overall_rating = 1)
        ) AS rating_distribution
    FROM public.beach_reviews br
    WHERE br.beach_id = target_beach_id;
END;
$$;


ALTER FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer DEFAULT 0, "limit_count" integer DEFAULT 10, "min_rating" integer DEFAULT 1) RETURNS TABLE("id" "uuid", "beach_id" "uuid", "user_id" "uuid", "overall_rating" integer, "wave_quality_rating" integer, "crowd_density_rating" integer, "parking_rating" integer, "accessibility_rating" integer, "title" character varying, "content" "text", "visit_date" "date", "helpful_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "user_name" "text", "beach_name" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.id,
        br.beach_id,
        br.user_id,
        br.overall_rating,
        br.wave_quality_rating,
        br.crowd_density_rating,
        br.parking_rating,
        br.accessibility_rating,
        br.title,
        br.content,
        br.visit_date,
        br.helpful_count,
        br.created_at,
        br.updated_at,
        p.full_name AS user_name,
        b.name AS beach_name
    FROM public.beach_reviews br
    LEFT JOIN public.profiles p ON p.id = br.user_id
    LEFT JOIN public.beaches b ON b.id = br.beach_id
    WHERE (target_beach_id IS NULL OR br.beach_id = target_beach_id)
      AND br.overall_rating >= min_rating
    ORDER BY 
        br.helpful_count DESC,
        br.created_at DESC
    OFFSET offset_count
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text" DEFAULT 'USA'::"text") RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "city" "text", "state" "text", "country" "text", "lat" double precision, "lon" double precision, "average_rating" numeric, "review_count" integer, "skill_level" "text", "break_type" "text", "description" "text", "crowd_level" "text", "best_conditions_prose" "text", "composite_score" numeric, "recent_intel_count" integer, "avg_confirmations" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state,
    b.country,
    b.lat AS lat,
    b.lon AS lon,
    COALESCE(review_stats.average_rating, 0)::NUMERIC AS average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER AS review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    (
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) AS composite_score,
    COALESCE(intel_recent.count, 0)::INTEGER AS recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) AS avg_confirmations

  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) AS average_rating,
      COUNT(*)::INTEGER AS review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS count,
      AVG(confirmations_count)::NUMERIC AS avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE LOWER(b.city) = LOWER(p_city)
    AND LOWER(b.state) = LOWER(p_state)
    AND LOWER(b.country) = LOWER(p_country)
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text") IS 'Retrieves beaches for a specific location (city, state, country) with computed composite scores.
Composite score combines: rating (40%), review volume (30%), recent intel activity (20%), intel quality (10%).
Uses case-insensitive matching and standardized lat/lon column naming.';



CREATE OR REPLACE FUNCTION "public"."get_beaches_by_metro_with_scores"("p_cities" "text"[], "p_state" "text", "p_country" "text" DEFAULT 'USA'::"text") RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "city" "text", "state" "text", "country" "text", "lat" double precision, "lon" double precision, "average_rating" numeric, "review_count" integer, "skill_level" "text", "break_type" "text", "description" "text", "crowd_level" "text", "best_conditions_prose" "text", "composite_score" numeric, "recent_intel_count" integer, "avg_confirmations" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state,
    b.country,
    b.lat,  -- FIXED: was b.latitude as lat
    b.lon,  -- FIXED: was b.longitude as lon
    COALESCE(review_stats.average_rating, 0)::NUMERIC as average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER as review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    -- Composite score calculation (same formula as single-city function)
    (
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) as composite_score,
    COALESCE(intel_recent.count, 0)::INTEGER as recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) as avg_confirmations

  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER as count,
      AVG(confirmations_count)::NUMERIC as avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE b.city = ANY(p_cities)  -- Match any city in the array
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_beaches_by_metro_with_scores"("p_cities" "text"[], "p_state" "text", "p_country" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_beaches_by_metro_with_scores"("p_cities" "text"[], "p_state" "text", "p_country" "text") IS 'Retrieves beaches across multiple cities in a metro area with composite scores.
Useful for aggregate views like "San Diego Area" which includes La Jolla, Pacific Beach, etc.
Uses lat/lon columns (not latitude/longitude).';



CREATE OR REPLACE FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision DEFAULT 25) RETURNS TABLE("id" "uuid", "name" "text", "lat" double precision, "lon" double precision, "break_type" "text", "aspect_deg" integer, "wind_offshore_deg" integer, "swell_window_center_deg" integer, "swell_window_halfwidth_deg" integer, "preferred_tide_ft_min" numeric, "preferred_tide_ft_max" numeric, "wind_cross_shore_ok_kt" integer, "wind_onshore_bad_kt" integer, "dist_km" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  WITH base AS (
    SELECT
      b.id,
      b.name,
      b.lat,  -- FIXED: was b.latitude AS lat
      b.lon,  -- FIXED: was b.longitude AS lon
      b.break_type,
      b.aspect_deg,
      b.wind_offshore_deg,  -- FIXED: was offshore_deg
      b.swell_window_center_deg,
      b.swell_window_halfwidth_deg,
      b.preferred_tide_ft_min,  -- FIXED: was tide_min_ft
      b.preferred_tide_ft_max,  -- FIXED: was tide_max_ft
      b.wind_cross_shore_ok_kt,  -- FIXED: was wind_cross_ok_kts
      b.wind_onshore_bad_kt,  -- FIXED: was wind_onshore_bad_kts
      -- Haversine (spherical law of cosines) with clamped argument
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(b.lat)) * cos(radians(b.lon) - radians(_lon))  -- FIXED: was b.latitude and b.longitude
          + sin(radians(_lat)) * sin(radians(b.lat))  -- FIXED: was b.latitude
        ))
      ) AS dist_km
    FROM public.beaches b
    WHERE b.lat IS NOT NULL AND b.lon IS NOT NULL  -- FIXED: was b.latitude and b.longitude
  )
  SELECT *
  FROM base
  WHERE dist_km <= _radius_km
  ORDER BY dist_km
  LIMIT 12;
$$;


ALTER FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer DEFAULT 6) RETURNS TABLE("start_ts" timestamp with time zone, "end_ts" timestamp with time zone, "label" "text", "score" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
WITH params AS (
  SELECT 
    b.id AS beach_id,
    b.wind_offshore_deg,
    b.wind_cross_shore_ok_kt,
    b.preferred_tide_ft_min,
    b.preferred_tide_ft_max,
    ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS swell_span,
    b.swell_window_min_deg AS swell_min
  FROM public.beaches b
  WHERE b.id = p_beach
),
hrs AS (
  SELECT generate_series(
           date_trunc('hour', p_start),
           date_trunc('hour', p_end),
           interval '1 hour'
         ) AS ts_utc
),
nearest AS (
  SELECT
    h.ts_utc,
    -- nearest marine within ±6 hours
    (
      SELECT m.ts FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS m_ts,
    (
      SELECT m.wave_height_m FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_height_m,
    (
      SELECT m.wave_period_s FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_period_s,
    (
      SELECT m.wave_direction_deg FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_direction_deg,
    (
      SELECT m.wind_speed_ms FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wind_speed_ms,
    (
      SELECT m.wind_direction_deg FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wind_direction_deg,
    -- nearest tide within ±90 minutes
    (
      SELECT t.tide_height_m FROM public.tide_forecasts t
      WHERE t.beach_id = p_beach
        AND t.ts BETWEEN h.ts_utc - interval '90 minutes' AND h.ts_utc + interval '90 minutes'
      ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - h.ts_utc)))
      LIMIT 1
    ) AS tide_height_m
  FROM hrs h
),
scored AS (
  SELECT
    n.ts_utc,
    -- Wind score
    GREATEST(
      0,
      (1 + COS(RADIANS(ABS(MOD(((n.wind_direction_deg)::int - p.wind_offshore_deg + 540),360) - 180))))/2
      * (1 - GREATEST(0, ((COALESCE(n.wind_speed_ms,0) * 1.94384449) - p.wind_cross_shore_ok_kt)::float / 10.0))
    ) AS wind_score,
    -- Tide score (ft band triangle)
    COALESCE(
      GREATEST(
        0,
        1 - ABS(((n.tide_height_m * 3.28084)) - ((p.preferred_tide_ft_min + p.preferred_tide_ft_max)/2.0))
              / NULLIF((p.preferred_tide_ft_max - p.preferred_tide_ft_min)/2.0,0)
      ), 0
    )::numeric AS tide_score,
    -- Swell direction score
    GREATEST(
      0,
      1 - GREATEST(
            0,
            ABS(MOD(((n.wave_direction_deg)::int - ((p.swell_min + p.swell_span/2.0)) + 540)::int, 360) - 180) - (p.swell_span/2.0)
          )::float / 30.0
    ) AS swell_dir_score,
    0.0 AS period_score,
    0.0 AS height_score,
    -- Total score
    ROUND(
      100 * GREATEST(
        0,
        (0.4 * GREATEST(0,
          (1 + COS(RADIANS(ABS(MOD(((n.wind_direction_deg)::int - p.wind_offshore_deg + 540),360) - 180))))/2
          * (1 - GREATEST(0, ((COALESCE(n.wind_speed_ms,0) * 1.94384449) - p.wind_cross_shore_ok_kt)::float / 10.0))
        ))
        + (0.2 * COALESCE(
          GREATEST(
            0,
            1 - ABS(((n.tide_height_m * 3.28084)) - ((p.preferred_tide_ft_min + p.preferred_tide_ft_max)/2.0))
                  / NULLIF((p.preferred_tide_ft_max - p.preferred_tide_ft_min)/2.0,0)
          ), 0
        ))
        + (0.4 * GREATEST(
          0,
          1 - GREATEST(0, ABS(MOD(((n.wave_direction_deg)::int - ((p.swell_min + p.swell_span/2.0)) + 540)::int, 360) - 180) - (p.swell_span/2.0))::float / 30.0
        ))
      )
    )::int AS score_0_100
  FROM nearest n
  JOIN params p ON TRUE
  WHERE n.m_ts IS NOT NULL -- require a marine reference within window
),
win AS (
  SELECT
    h1.ts_utc                       AS start_ts,
    h1.ts_utc + interval '2 hour'   AS end_ts,
    round(avg(h2.score_0_100))::int AS score
  FROM scored h1
  JOIN scored h2
    ON h2.ts_utc BETWEEN h1.ts_utc AND h1.ts_utc + interval '1 hour'
  GROUP BY h1.ts_utc
),
ranked AS (
  SELECT
    w.*,
    CASE
      WHEN w.score >= 85 THEN 'epic'
      WHEN w.score >= 70 THEN 'good'
      WHEN w.score >= 55 THEN 'fair'
      ELSE 'poor'
    END AS grade
  FROM win w
  WHERE w.score >= 55
)
SELECT
  r.start_ts,
  r.end_ts,
  (r.grade || ' (' || r.score || ')')::text AS label,
  r.score
FROM ranked r
ORDER BY r.score DESC, r.start_ts
LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bulk_current_forecasts"("p_beach_ids" "uuid"[], "p_target_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("beach_id" "uuid", "wave_height" "text", "forecast_date" "date", "forecast_time" time without time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  WITH ranked AS (
    SELECT
      ef.beach_id,
      ef.wave_height,
      ef.forecast_date,
      ef.forecast_time,
      ROW_NUMBER() OVER (
        PARTITION BY ef.beach_id
        ORDER BY
          CASE
            WHEN ef.forecast_date = p_target_date
                 AND ef.forecast_time >= CURRENT_TIME THEN 1
            WHEN ef.forecast_date = p_target_date + 1 THEN 2
            ELSE 3
          END ASC,
          CASE
            WHEN ef.forecast_date = p_target_date
                 AND ef.forecast_time < CURRENT_TIME
            THEN -EXTRACT(EPOCH FROM ef.forecast_time)
            ELSE  EXTRACT(EPOCH FROM ef.forecast_time)
          END ASC
      ) AS rn
    FROM enhanced_forecasts ef
    WHERE ef.beach_id = ANY(p_beach_ids)
      AND ef.forecast_date IN (p_target_date, p_target_date + 1)
  )
  SELECT r.beach_id, r.wave_height, r.forecast_date, r.forecast_time
  FROM ranked r
  WHERE r.rn = 1;
$$;


ALTER FUNCTION "public"."get_bulk_current_forecasts"("p_beach_ids" "uuid"[], "p_target_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_bulk_current_forecasts"("p_beach_ids" "uuid"[], "p_target_date" "date") IS 'Returns the current/next forecast wave_height for each beach. wave_height is the per-beach face-Hs from the transformer (lib/utils/wave-height-transformer.ts). Used by /api/forecasts/bulk to avoid PostgREST row-limit truncation.';



CREATE OR REPLACE FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer DEFAULT 1) RETURNS TABLE("city" "text", "state" "text", "country" "text", "beach_count" bigint, "has_beginner" boolean, "has_advanced" boolean, "has_editorial" boolean, "has_least_crowded" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT b.city, b.state, COALESCE(b.country, 'USA') as country, COUNT(*) as beach_count,
    bool_or(LOWER(COALESCE(b.skill_level, '')) LIKE '%beginner%' OR LOWER(COALESCE(b.skill_level, '')) LIKE '%longboard%') as has_beginner,
    bool_or(LOWER(COALESCE(b.skill_level, '')) LIKE '%advanced%' OR LOWER(COALESCE(b.skill_level, '')) LIKE '%expert%') as has_advanced,
    COUNT(*) FILTER (WHERE COALESCE(b.description, '') <> '' AND (COALESCE(b.crowd_tips, '') <> '' OR COALESCE(b.wave_tips, '') <> '' OR COALESCE(b.best_conditions_prose, '') <> '')) >= LEAST(2, COUNT(*)) as has_editorial,
    bool_or(LOWER(COALESCE(b.crowd_level, '')) IN ('light', 'moderate')) as has_least_crowded
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false) AND b.city IS NOT NULL AND b.state IS NOT NULL AND b.deleted_at IS NULL
  GROUP BY b.city, b.state, b.country
  HAVING COUNT(*) >= min_beaches
  ORDER BY b.city ASC
$$;


ALTER FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer) IS 'Returns cities with skill, editorial (LEAST(2,count) threshold), and crowd flags. Used by sitemap and intent pages.';



CREATE TABLE IF NOT EXISTS "public"."city_editorial_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_slug" "text" NOT NULL,
    "state_slug" "text" DEFAULT 'ca'::"text" NOT NULL,
    "country_slug" "text" DEFAULT 'usa'::"text" NOT NULL,
    "city_name" "text" NOT NULL,
    "region_label" "text" NOT NULL,
    "description" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "session_timing" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "quick_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "featured_intents" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "planning_checklist" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intent" "text",
    CONSTRAINT "city_editorial_content_intent_check" CHECK ((("intent" IS NULL) OR ("intent" = ANY (ARRAY['beginner'::"text", 'tide'::"text", 'water-temp'::"text", 'general'::"text", 'least-crowded'::"text"]))))
);


ALTER TABLE "public"."city_editorial_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."city_editorial_content" IS 'Stores curated editorial content for city landing pages including session timing modules,
quick action links, about section paragraphs, and planning checklists.
This content is shown on /beaches/[country]/[state]/[city] pages when available.
To add editorial content for a new city, insert a row into this table.';



CREATE OR REPLACE FUNCTION "public"."get_city_editorial"("p_city" "text", "p_state" "text" DEFAULT 'ca'::"text", "p_country" "text" DEFAULT 'usa'::"text") RETURNS "public"."city_editorial_content"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT * FROM city_editorial_content
  WHERE city_slug = p_city
    AND state_slug = p_state
    AND country_slug = p_country
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_city_editorial"("p_city" "text", "p_state" "text", "p_country" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric DEFAULT 80) RETURNS TABLE("pick_rank" integer, "beach_id" "uuid", "name" "text", "distance_km" numeric, "score" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
WITH origin AS (
  SELECT id, name, lat, lon, region_id  -- FIXED: was latitude as lat, longitude as lon
  FROM beaches WHERE id = _beach_id
),
candidates AS (
  SELECT b.id, b.name, b.lat, b.lon, b.region_id,  -- FIXED: was b.latitude, b.longitude
         -- Haversine distance (km)
         6371 * 2 * asin(sqrt(
           pow(sin(radians(b.lat - o.lat)/2),2) +  -- FIXED: was b.latitude
           cos(radians(o.lat))*cos(radians(b.lat))*  -- FIXED: was b.latitude
           pow(sin(radians(b.lon - o.lon)/2),2)  -- FIXED: was b.longitude
         )) as distance_km,
         coalesce(s.score_0_100, 0) as score
  FROM beaches b
  CROSS JOIN origin o
  LEFT JOIN v_beach_hourly_scores s ON s.beach_id = b.id
  WHERE b.id <> _beach_id
    AND (
      b.region_id = o.region_id
      OR 6371 * 2 * asin(sqrt(
           pow(sin(radians(b.lat - o.lat)/2),2) +  -- FIXED: was b.latitude
           cos(radians(o.lat))*cos(radians(b.lat))*  -- FIXED: was b.latitude
           pow(sin(radians(b.lon - o.lon)/2),2)  -- FIXED: was b.longitude
         )) <= _radius_km
    )
)
SELECT row_number() over(order by score desc nulls last, distance_km asc) as pick_rank,
       id as beach_id, name, distance_km, score
FROM candidates
ORDER BY pick_rank
LIMIT 3;
$$;


ALTER FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conditions_alert_candidates"("p_min_score" integer DEFAULT 7) RETURNS TABLE("user_id" "uuid", "email" "text", "display_name" "text", "home_beach_id" "uuid", "beach_name" "text", "beach_slug" "text", "beach_state" "text", "beach_city" "text", "conditions_score" integer, "surf_description" "text", "wind_description" "text", "best_window_start" time without time zone, "best_window_end" time without time zone, "recommendation" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH eligible_users AS (
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.home_beach_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
  ),
  -- Join beaches early to get timezone for each user's home beach
  users_with_beach AS (
    SELECT
      eu.id,
      eu.email,
      eu.display_name,
      eu.home_beach_id,
      COALESCE(b.timezone, 'America/Los_Angeles') AS beach_tz
    FROM eligible_users eu
    INNER JOIN beaches b ON b.id = eu.home_beach_id
  ),
  latest_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description,
      bdi.best_window_start,
      bdi.best_window_end,
      bdi.recommendation
    FROM beach_daily_intel bdi
    INNER JOIN users_with_beach uwb ON uwb.home_beach_id = bdi.beach_id
    WHERE bdi.forecast_date = (CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz)::date
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  active_today_filter AS (
    SELECT uwb.id, uwb.email, uwb.display_name, uwb.home_beach_id, uwb.beach_tz
    FROM users_with_beach uwb
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_events ue
      WHERE ue.user_id = uwb.id
        AND ue.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz)::date AT TIME ZONE uwb.beach_tz
    )
  ),
  email_dedup AS (
    SELECT atf.id, atf.email, atf.display_name, atf.home_beach_id
    FROM active_today_filter atf
    WHERE NOT EXISTS (
      SELECT 1
      FROM email_send_log esl
      WHERE esl.user_id = atf.id
        AND esl.sent_at >= (CURRENT_TIMESTAMP AT TIME ZONE atf.beach_tz)::date AT TIME ZONE atf.beach_tz
    )
  )
  SELECT
    ed.id AS user_id,
    ed.email,
    ed.display_name,
    ed.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    b.state AS beach_state,
    b.city AS beach_city,
    li.conditions_score,
    li.surf_description,
    li.wind_description,
    li.best_window_start,
    li.best_window_end,
    li.recommendation
  FROM email_dedup ed
  INNER JOIN beaches b ON b.id = ed.home_beach_id
  INNER JOIN latest_intel li ON li.beach_id = ed.home_beach_id;
END;
$$;


ALTER FUNCTION "public"."get_conditions_alert_candidates"("p_min_score" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conditions_alert_candidates"("p_min_score" integer) IS 'Returns users eligible for conditions alert emails based on high beach_daily_intel scores today. Excludes users active in app today or who received any email today. Uses beach-specific timezone for date calculations.';



CREATE OR REPLACE FUNCTION "public"."get_conversion_funnel"("days" integer DEFAULT 7) RETURNS TABLE("funnel_step" "text", "step_order" integer, "total_count" bigint, "unique_sessions" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  cutoff TIMESTAMPTZ;
BEGIN
  cutoff := NOW() - (days || ' days')::INTERVAL;

  RETURN QUERY
  WITH funnel_events AS (
    SELECT
      event_type,
      COALESCE(session_id::text, user_id::text) AS identity_key
    FROM public.user_events
    WHERE created_at >= cutoff
      AND (bot_flagged IS NULL OR bot_flagged = false)
  )
  SELECT
    s.step_name AS funnel_step,
    s.step_order,
    COALESCE(f.total_count, 0) AS total_count,
    COALESCE(f.unique_sessions, 0) AS unique_sessions
  FROM (
    VALUES
      ('anonymous_sessions', 1),
      ('cta_views', 2),
      ('cta_clicks', 3),
      ('auth_modal_opens', 4),
      ('signup_starts', 5),
      ('signup_completes', 6),
      ('onboarding_completes', 7)
  ) AS s(step_name, step_order)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_count,
      COUNT(DISTINCT fe.identity_key) AS unique_sessions
    FROM funnel_events fe
    WHERE
      CASE s.step_name
        WHEN 'anonymous_sessions' THEN fe.event_type IN (
          'page_view', 'beach_view', 'tab_view', 'forecast_interaction',
          'beach_search', 'map_interaction', 'map_marker_click',
          'signup_cta_view', 'signup_cta_click', 'signin_cta_click',
          'auth_modal_opened', 'auth_method_selected',
          'signup_started', 'signup_success', 'login_success'
        )
        WHEN 'cta_views' THEN fe.event_type = 'signup_cta_view'
        WHEN 'cta_clicks' THEN fe.event_type IN ('signup_cta_click', 'signin_cta_click', 'cta_click')
        WHEN 'auth_modal_opens' THEN fe.event_type = 'auth_modal_opened'
        WHEN 'signup_starts' THEN fe.event_type = 'signup_started'
        WHEN 'signup_completes' THEN fe.event_type = 'signup_success'
        WHEN 'onboarding_completes' THEN fe.event_type = 'onboarding_step'
          AND fe.identity_key IN (
            SELECT p.id::text FROM public.profiles p
            WHERE p.onboarding_completed_at IS NOT NULL
              AND p.onboarding_completed_at >= cutoff
          )
        ELSE false
      END
  ) f ON true
  ORDER BY s.step_order;
END;
$$;


ALTER FUNCTION "public"."get_conversion_funnel"("days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conversion_funnel"("days" integer) IS 'Returns the signup conversion funnel metrics for the past N days. Steps: anonymous_sessions -> cta_views -> cta_clicks -> auth_modal_opens -> signup_starts -> signup_completes -> onboarding_completes. Excludes bot-flagged events.';



CREATE OR REPLACE FUNCTION "public"."get_current_production_model"() RETURNS TABLE("version" "text", "deployed_at" timestamp with time zone, "production_improvement_pct" numeric, "training_samples" integer, "holdout_improvement_pct" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    version,
    deployed_at,
    production_improvement_pct,
    training_samples,
    holdout_improvement_pct
  FROM ml_model_registry
  WHERE status = 'deployed'
  ORDER BY deployed_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_production_model"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_production_model"() IS 'Returns currently deployed model version and metrics. Used by /ml-stats endpoint.';



CREATE OR REPLACE FUNCTION "public"."get_entity_history"("table_name" "text", "entity_id" "uuid", "limit_rows" integer DEFAULT 50) RETURNS TABLE("history_id" "uuid", "changed_at" timestamp with time zone, "changed_by" "uuid", "change_type" "text", "snapshot" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
    sql_query TEXT;
BEGIN
    -- Validate table name to prevent SQL injection
    IF table_name NOT IN ('beach_reviews', 'beach_photos', 'session_media') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;

    -- Build and execute history query
    sql_query := format(
        'SELECT history_id, changed_at, changed_by, change_type, to_jsonb(h.*) as snapshot
         FROM public.%I h
         WHERE id = $1
         ORDER BY changed_at DESC
         LIMIT $2',
        table_name || '_history'
    );

    RETURN QUERY EXECUTE sql_query USING entity_id, limit_rows;
END;
$_$;


ALTER FUNCTION "public"."get_entity_history"("table_name" "text", "entity_id" "uuid", "limit_rows" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entity_history"("table_name" "text", "entity_id" "uuid", "limit_rows" integer) IS 'Retrieve audit history for a specific entity. Returns up to limit_rows most recent changes.';



CREATE OR REPLACE FUNCTION "public"."get_forecast_vs_observation_pairs"("p_days_back" integer DEFAULT 7, "p_max_distance_km" numeric DEFAULT 100) RETURNS TABLE("beach_id" "uuid", "observation_time" timestamp with time zone, "observed_wave_height_m" numeric, "observed_wave_period_s" numeric, "forecast_wave_height" "text", "forecast_period" "text", "observation_source" "text", "station_id" "text", "distance_km" numeric, "forecast_age_hours" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT DISTINCT ON (o.observed_at, o.station_id)
    o.nearest_beach_id AS beach_id,
    o.observed_at AS observation_time,
    o.wave_height_m AS observed_wave_height_m,
    o.wave_period_s AS observed_wave_period_s,
    f.wave_height AS forecast_wave_height,
    f.wave_period AS forecast_period,
    o.source AS observation_source,
    o.station_id,
    o.distance_to_beach_km AS distance_km,
    EXTRACT(EPOCH FROM (o.observed_at - (f.forecast_date + f.forecast_time)::TIMESTAMPTZ)) / 3600 AS forecast_age_hours
  FROM unified_wave_observations o
  JOIN enhanced_forecasts f
    ON o.nearest_beach_id = f.beach_id
    AND o.observed_at BETWEEN (f.forecast_date + f.forecast_time)::TIMESTAMPTZ - INTERVAL '1 hour'
                          AND (f.forecast_date + f.forecast_time)::TIMESTAMPTZ + INTERVAL '1 hour'
  WHERE o.observed_at >= NOW() - (p_days_back || ' days')::INTERVAL
    AND o.distance_to_beach_km <= p_max_distance_km
    AND f.wave_height IS NOT NULL
  ORDER BY o.observed_at, o.station_id, ABS(EXTRACT(EPOCH FROM (o.observed_at - (f.forecast_date + f.forecast_time)::TIMESTAMPTZ)));
$$;


ALTER FUNCTION "public"."get_forecast_vs_observation_pairs"("p_days_back" integer, "p_max_distance_km" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_forecast_vs_observation_pairs"("p_days_back" integer, "p_max_distance_km" numeric) IS 'Returns forecast vs observation pairs for ML training - matches forecasts to nearby observations within 1 hour window';



CREATE OR REPLACE FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") RETURNS TABLE("id" "uuid", "intel_post_id" "uuid", "user_id" "uuid", "user_name" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ipc.id,
        ipc.intel_post_id,
        ipc.user_id,
        p.full_name AS user_name,
        ipc.created_at
    FROM public.intel_post_confirmations ipc
    LEFT JOIN public.profiles p ON p.id = ipc.user_id
    WHERE ipc.intel_post_id = target_post_id
    ORDER BY ipc.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text" DEFAULT 'USA'::"text") RETURNS TABLE("total_beaches" bigint, "average_rating" numeric, "total_reviews" bigint, "top_beaches" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_beaches,
    AVG(review_stats.average_rating)::NUMERIC(10, 2) as average_rating,
    SUM(review_stats.review_count)::BIGINT as total_reviews,
    COUNT(CASE
      WHEN (
        (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
        (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3
      ) >= 0.8
      THEN 1
    END)::BIGINT as top_beaches
  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  WHERE LOWER(b.city) = LOWER(p_city)
    AND LOWER(b.state) = LOWER(p_state)
    AND LOWER(b.country) = LOWER(p_country)
    AND b.is_private = false;
END;
$$;


ALTER FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text") IS 'Returns aggregate statistics for a location including total beaches, average rating,
total reviews, and count of top-rated beaches (composite score >= 0.8).';



CREATE OR REPLACE FUNCTION "public"."get_metro_stats"("p_cities" "text"[], "p_state" "text", "p_country" "text" DEFAULT 'USA'::"text") RETURNS TABLE("total_beaches" bigint, "average_rating" numeric, "total_reviews" bigint, "top_beaches" bigint, "cities_count" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_beaches,
    AVG(review_stats.average_rating)::NUMERIC(10, 2) as average_rating,
    SUM(review_stats.review_count)::BIGINT as total_reviews,
    -- Count beaches with composite score >= 0.8 (tier 1-2)
    COUNT(CASE
      WHEN (
        (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
        (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3
      ) >= 0.8
      THEN 1
    END)::BIGINT as top_beaches,
    CARDINALITY(p_cities)::INTEGER as cities_count
  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  WHERE b.city = ANY(p_cities)
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false;
END;
$$;


ALTER FUNCTION "public"."get_metro_stats"("p_cities" "text"[], "p_state" "text", "p_country" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_metro_stats"("p_cities" "text"[], "p_state" "text", "p_country" "text") IS 'Returns aggregate statistics for a metro area spanning multiple cities.';



CREATE OR REPLACE FUNCTION "public"."get_ml_health_metrics"() RETURNS TABLE("total_predictions" bigint, "pending_observations" bigint, "pending_12_24h" bigint, "pending_gt_24h" bigint, "sentinel_marked" bigint, "matched_last_24h" bigint, "total_observable_24h" bigint, "match_rate_24h" numeric, "avg_raw_error_24h" numeric, "avg_corrected_error_24h" numeric, "improvement_pct_24h" numeric, "oldest_pending_age_hours" numeric, "observable_beaches_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      -- Only count predictions for observable beaches (have ground truth)
      -- Must be older than 4 hours AND within 7 days window
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '4 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ) as pending,
      -- Early warning - predictions 12-24h old (approaching sentinel threshold)
      -- Only count observable beaches
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '12 hours'
          AND p.predicted_at >= NOW() - INTERVAL '24 hours'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ) as pending_12_24h,
      -- Should be 0 - predictions >24h should be sentinel-marked
      -- Only count observable beaches
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '24 hours'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ) as pending_gt_24h,
      -- Count sentinel-marked predictions (observed_m = -1)
      COUNT(*) FILTER (
        WHERE p.observed_m = -1
      ) as sentinel,
      -- Scope 24h metrics to observable beaches for meaningful match rate
      COUNT(*) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.predicted_at < NOW() - INTERVAL '4 hours'
          AND ob.beach_id IS NOT NULL
      ) as total_24h,
      COUNT(*) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.observed_m IS NOT NULL
          AND p.observed_m > 0
          AND ob.beach_id IS NOT NULL
      ) as matched_24h,
      AVG(p.raw_error_m) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.observed_m IS NOT NULL
          AND p.observed_m > 0
      ) as avg_raw_24h,
      AVG(p.corrected_error_m) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.observed_m IS NOT NULL
          AND p.observed_m > 0
      ) as avg_corr_24h,
      -- Oldest pending age - only consider observable beaches
      EXTRACT(EPOCH FROM (NOW() - MIN(p.predicted_at) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '4 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ))) / 3600 as oldest_pending_hours
    FROM ml_predictions_log p
    LEFT JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    WHERE p.predicted_at > NOW() - INTERVAL '30 days'
  ),
  beach_count AS (
    SELECT COUNT(*) as cnt FROM observable_beaches
  )
  SELECT
    s.total,
    s.pending,
    s.pending_12_24h,
    s.pending_gt_24h,
    s.sentinel,
    s.matched_24h,
    s.total_24h,
    ROUND(100.0 * s.matched_24h / NULLIF(s.total_24h, 0), 1),
    ROUND(s.avg_raw_24h, 3),
    ROUND(s.avg_corr_24h, 3),
    ROUND(100.0 * (s.avg_raw_24h - s.avg_corr_24h) / NULLIF(s.avg_raw_24h, 0), 1),
    ROUND(s.oldest_pending_hours, 1),
    b.cnt
  FROM stats s, beach_count b;
END;
$$;


ALTER FUNCTION "public"."get_ml_health_metrics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ml_health_metrics"() IS 'Returns ML pipeline health metrics with ±4h matching window.
   Pending counts are filtered to only include observable beaches (have ground truth).
   Pending count uses 4h cutoff to match backfill function.
   Metrics: pending_12_24h (early warning), pending_gt_24h (should be 0).
   Match rate scoped to observable beaches.
   Updated Feb 9 2026: fixed pending counts to only include observable beaches.';



CREATE OR REPLACE FUNCTION "public"."get_ml_weekly_metrics"() RETURNS TABLE("model_version" "text", "predictions" bigint, "with_ground_truth" bigint, "avg_raw_error_m" numeric, "avg_corrected_error_m" numeric, "avg_improvement_m" numeric, "pct_improved" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.model_version,
    COUNT(*)::BIGINT as predictions,
    COUNT(*) FILTER (WHERE p.observed_m > 0)::BIGINT as with_ground_truth,
    ROUND(AVG(p.raw_error_m)::numeric, 3) as avg_raw_error_m,
    ROUND(AVG(p.corrected_error_m)::numeric, 3) as avg_corrected_error_m,
    ROUND(AVG(p.raw_error_m - p.corrected_error_m)::numeric, 3) as avg_improvement_m,
    ROUND(100.0 * COUNT(*) FILTER (WHERE p.corrected_error_m < p.raw_error_m) /
          NULLIF(COUNT(*) FILTER (WHERE p.observed_m > 0), 0), 1) as pct_improved
  FROM ml_predictions_log p
  WHERE p.predicted_at > now() - interval '7 days'
  GROUP BY p.model_version
  ORDER BY p.model_version DESC;
END;
$$;


ALTER FUNCTION "public"."get_ml_weekly_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_most_visited_beach"("user_id" "uuid") RETURNS TABLE("beach_id" "uuid", "visit_count" bigint, "beach_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.beach_id,
    COUNT(s.id)::BIGINT AS visit_count,
    b.name              AS beach_name
  FROM sessions s
  JOIN beaches b ON b.id = s.beach_id
  WHERE s.user_id = get_most_visited_beach.user_id
    AND s.deleted_at IS NULL
  GROUP BY s.beach_id, b.name
  ORDER BY visit_count DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_most_visited_beach"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_most_visited_beach"("user_id" "uuid") IS 'Returns the beach a user has visited most frequently. Recreated with a user_id parameter after the global version was dropped in remote_commit migration. SECURITY DEFINER with search_path protection.';



CREATE OR REPLACE FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer DEFAULT 80467, "limit_count" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "name" "text", "location" "text", "lat" double precision, "lon" double precision, "is_private" boolean, "distance_meters" double precision, "slug" "text", "city" "text", "state" "text", "skill_level" "text", "break_type" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    target_lat DOUBLE PRECISION := input_lat;
    target_lng DOUBLE PRECISION := input_lng;
    capped_distance INTEGER := LEAST(GREATEST(max_distance_meters, 0), 160934);
    capped_limit INTEGER := LEAST(GREATEST(limit_count, 1), 200);
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        CASE
            WHEN b.city IS NOT NULL AND b.state IS NOT NULL
                THEN b.city || ', ' || b.state
            WHEN b.city IS NOT NULL THEN b.city
            WHEN b.state IS NOT NULL THEN b.state
            ELSE 'Unknown'
        END AS location,
        b.lat,
        b.lon,
        b.is_private,
        ST_Distance(
            b.geog,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters,
        b.slug,
        b.city,
        b.state,
        b.skill_level,
        b.break_type
    FROM public.beaches b
    WHERE b.lat IS NOT NULL
      AND b.lon IS NOT NULL
      AND ST_DWithin(
          b.geog,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          capped_distance
      )
    ORDER BY distance_meters ASC
    LIMIT capped_limit;
END;
$$;


ALTER FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) IS 'Returns beaches within specified distance of given coordinates.

Includes URL generation fields (slug, city, state), skill_level, and break_type for display and filtering.

Parameters:
- input_lat/input_lng: Search center coordinates
- max_distance_meters: Max radius (default 50mi, capped 100mi)
- limit_count: Max results (default 50, capped 200)

Returns: Beaches sorted by distance with id, name, location, lat, lon, is_private,
distance_meters, slug, city, state, skill_level, break_type.

Version: 2026-03-10 - Added break_type for map filter support';



CREATE OR REPLACE FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer DEFAULT 100000, "result_limit" integer DEFAULT 4) RETURNS TABLE("buoy_uuid" "text", "buoy_name" "text", "active" boolean, "coordinates" "public"."geometry", "water_temperature" numeric, "air_temperature" numeric, "wave_height" numeric, "wave_period" numeric, "wind_speed" numeric, "wind_gust" numeric, "wind_direction" numeric, "tides" "jsonb", "updated_at" timestamp with time zone, "distance_meters" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.buoy_uuid,
        b.buoy_name,
        b.active,
        b.coordinates,
        b.water_temperature,
        b.air_temperature,
        b.wave_height,
        b.wave_period,
        b.wind_speed,
        b.wind_gust,
        b.wind_direction,
        b.tides,
        b.updated_at,
        ST_Distance(
            b.coordinates,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.buoys b
    WHERE b.active = true
      AND b.coordinates IS NOT NULL
      AND ST_DWithin(
          b.coordinates,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_m
      )
    ORDER BY distance_meters ASC
    LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer DEFAULT 50, "radius_miles" double precision DEFAULT 25.0, "tag_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "beach_id" "uuid", "latitude" numeric, "longitude" numeric, "tag" "public"."intel_post_tag", "title" "text", "description" "text", "photo_url" "text", "confirmations_count" integer, "is_active" boolean, "surf_conditions" "jsonb", "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "distance_miles" double precision, "user_name" "text", "beach_name" "text", "helpful_count" integer, "off_count" integer, "confirmed_count" integer, "rank_score" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ip.id,
        ip.user_id,
        ip.beach_id,
        ip.latitude,
        ip.longitude,
        ip.tag,
        ip.title,
        ip.description,
        ip.photo_url,
        ip.confirmations_count,
        ip.is_active,
        ip.surf_conditions,
        ip.expires_at,
        ip.created_at,
        ip.updated_at,
        (public.ST_Distance(
            public.ST_SetSRID(public.ST_MakePoint(ip.longitude, ip.latitude), 4326)::public.geography,
            public.ST_SetSRID(public.ST_MakePoint(center_lng, center_lat), 4326)::public.geography
        ) / 1609.34) AS distance_miles,
        p.full_name AS user_name,
        COALESCE(b.name, 'Unknown Beach') AS beach_name,
        ip.helpful_count,
        ip.off_count,
        ip.confirmed_count,
        (
            GREATEST(0, (ip.helpful_count - ip.off_count + ip.confirmed_count * 2)::DOUBLE PRECISION)
            * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600.0 / 8.0))
        ) AS rank_score
    FROM public.intel_posts ip
    LEFT JOIN public.profiles p ON p.id = ip.user_id
    LEFT JOIN public.beaches b ON b.id = ip.beach_id
    WHERE ip.is_active = true
      AND (ip.expires_at IS NULL OR ip.expires_at > NOW())
      AND public.ST_DWithin(
          public.ST_SetSRID(public.ST_MakePoint(ip.longitude, ip.latitude), 4326)::public.geography,
          public.ST_SetSRID(public.ST_MakePoint(center_lng, center_lat), 4326)::public.geography,
          radius_miles * 1609.34
      )
      AND (tag_filter IS NULL OR ip.tag::TEXT = tag_filter)
    ORDER BY
        rank_score DESC,
        ip.created_at DESC
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer DEFAULT 100000) RETURNS TABLE("buoy_uuid" "text", "buoy_name" "text", "active" boolean, "coordinates" "public"."geometry", "water_temperature" numeric, "air_temperature" numeric, "wave_height" numeric, "wave_period" numeric, "wind_speed" numeric, "wind_gust" numeric, "wind_direction" numeric, "tides" "jsonb", "updated_at" timestamp with time zone, "distance_meters" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.buoy_uuid,
        b.buoy_name,
        b.active,
        b.coordinates,
        b.water_temperature,
        b.air_temperature,
        b.wave_height,
        b.wave_period,
        b.wind_speed,
        b.wind_gust,
        b.wind_direction,
        b.tides,
        b.updated_at,
        ST_Distance(
            b.coordinates,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.buoys b
    WHERE b.active = true
      AND b.coordinates IS NOT NULL
      AND (b.water_temperature IS NOT NULL 
           OR b.air_temperature IS NOT NULL 
           OR b.wave_height IS NOT NULL)
      AND ST_DWithin(
          b.coordinates,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_m
      )
    ORDER BY 
        b.updated_at DESC,
        distance_meters ASC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric DEFAULT 6.0) RETURNS TABLE("beach_id" "uuid", "station_id" "text", "observed_at" timestamp with time zone, "wave_height_m" numeric, "wave_period_s" numeric, "wave_direction_deg" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  WITH resolved AS (
    SELECT
      ob.beach_id,
      get_beach_observation_station(ob.beach_id) AS station_id
    FROM observable_beaches ob
  ),
  latest AS (
    SELECT DISTINCT ON (r.beach_id)
      r.beach_id,
      r.station_id,
      uwo.observed_at,
      uwo.wave_height_m,
      uwo.wave_period_s,
      uwo.wave_direction_deg
    FROM resolved r
    JOIN unified_wave_observations uwo
      ON uwo.station_id = r.station_id
    WHERE r.station_id IS NOT NULL
      AND uwo.observed_at >= NOW() - (max_age_hours || ' hours')::INTERVAL
      AND uwo.wave_height_m IS NOT NULL
    ORDER BY r.beach_id, uwo.observed_at DESC
  )
  SELECT beach_id, station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg
  FROM latest;
$$;


ALTER FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric) IS 'Returns the latest buoy observation per observable beach within max_age_hours (default 6h). Beaches without a matched station or recent observation are omitted. Used by enhanced-forecast-sync to anchor nowcast wave heights on ground truth.';



CREATE OR REPLACE FUNCTION "public"."get_observations_for_beach"("p_beach_id" "uuid", "p_hours_back" integer DEFAULT 24) RETURNS TABLE("source" "text", "station_id" "text", "observed_at" timestamp with time zone, "wave_height_m" numeric, "wave_period_s" numeric, "wave_direction_deg" numeric, "water_temp_c" numeric, "distance_km" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    source,
    station_id,
    observed_at,
    wave_height_m,
    wave_period_s,
    wave_direction_deg,
    water_temp_c,
    distance_to_beach_km AS distance_km
  FROM unified_wave_observations
  WHERE nearest_beach_id = p_beach_id
    AND observed_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  ORDER BY observed_at DESC;
$$;


ALTER FUNCTION "public"."get_observations_for_beach"("p_beach_id" "uuid", "p_hours_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_popular_beaches"("p_limit" integer DEFAULT 8) RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "city" "text", "state" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state
  FROM public.beaches b
  LEFT JOIN public.profiles p
    ON p.home_beach_id = b.id
  LEFT JOIN public.favorite_beaches fb
    ON fb.beach_id = b.id
  WHERE b.deleted_at IS NULL
    AND COALESCE(b.is_private, false) = false
  GROUP BY b.id, b.name, b.slug, b.city, b.state
  HAVING COUNT(DISTINCT p.id) + COUNT(DISTINCT fb.id) > 0
  ORDER BY COUNT(DISTINCT p.id) + COUNT(DISTINCT fb.id) DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_popular_beaches"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_popular_beaches"("p_limit" integer) IS 'Returns popular curated beaches by home beach and beach favorite adoption.';



CREATE OR REPLACE FUNCTION "public"."get_profile_stats"("p_user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalSessions',      COUNT(*),
    'totalMinutes',       COALESCE(SUM(duration_minutes), 0),
    'avgRating',          ROUND(COALESCE(AVG(rating), 0)::numeric, 1),
    'uniqueBeaches',      COUNT(DISTINCT beach_id),
    'longestSession',     COALESCE(MAX(duration_minutes), 0),
    'sessionsThisMonth',  COUNT(*) FILTER (
                            WHERE arrival_time >= date_trunc('month', NOW())
                          ),
    'ytdSessions',        COUNT(*) FILTER (
                            WHERE arrival_time >= date_trunc('year', NOW())
                          ),
    'ytdMinutes',         COALESCE(
                            SUM(duration_minutes) FILTER (
                              WHERE arrival_time >= date_trunc('year', NOW())
                            ), 0
                          ),
    'ytdBeaches',         COUNT(DISTINCT beach_id) FILTER (
                            WHERE arrival_time >= date_trunc('year', NOW())
                          ),
    'ytdBestRating',      COALESCE(
                            MAX(rating) FILTER (
                              WHERE arrival_time >= date_trunc('year', NOW())
                            ), 0
                          )
  ) INTO result
  FROM sessions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_profile_stats"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_profile_stats"("p_user_id" "uuid") IS 'Returns aggregated session statistics for a user. SECURITY DEFINER — access is restricted to the specified user_id row set. Replaces client-side 2,000-row fetch in the native useProfileStats hook.';



CREATE OR REPLACE FUNCTION "public"."get_reengagement_email_candidates"("p_inactive_days" integer DEFAULT 7, "p_min_score" integer DEFAULT 7, "p_dedupe_hours" integer DEFAULT 72, "p_global_cooldown_hours" integer DEFAULT 48) RETURNS TABLE("user_id" "uuid", "email" "text", "display_name" "text", "home_beach_id" "uuid", "beach_name" "text", "beach_slug" "text", "conditions_score" integer, "surf_description" "text", "wind_description" "text", "best_window_start" time without time zone, "best_window_end" time without time zone, "recommendation" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_dedupe_threshold timestamptz;
  v_global_threshold timestamptz;
  v_inactive_threshold timestamptz;
BEGIN
  v_dedupe_threshold := NOW() - (p_dedupe_hours || ' hours')::interval;
  v_global_threshold := NOW() - (p_global_cooldown_hours || ' hours')::interval;
  v_inactive_threshold := NOW() - (p_inactive_days || ' days')::interval;

  RETURN QUERY
  WITH
  -- Get users who are inactive (no sessions in N days)
  inactive_users AS (
    SELECT p.id AS user_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
      -- No sessions in the inactive period
      AND NOT EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.user_id = p.id
          AND s.arrival_time > v_inactive_threshold
      )
  ),
  -- Get latest intel for each home beach
  latest_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description,
      bdi.best_window_start,
      bdi.best_window_end,
      bdi.recommendation
    FROM beach_daily_intel bdi
    WHERE bdi.forecast_date = CURRENT_DATE
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  -- Filter out users who received reengagement email recently
  dedupe_filtered AS (
    SELECT iu.user_id
    FROM inactive_users iu
    WHERE NOT EXISTS (
      SELECT 1 FROM forecast_alert_deliveries fad
      WHERE fad.user_id = iu.user_id
        AND fad.alert_type = 'reengagement'
        AND fad.last_sent_at > v_dedupe_threshold
    )
  ),
  -- Filter out users who received ANY email recently (global rate limit)
  global_filtered AS (
    SELECT df.user_id
    FROM dedupe_filtered df
    WHERE NOT EXISTS (
      SELECT 1 FROM forecast_alert_deliveries fad
      WHERE fad.user_id = df.user_id
        AND fad.last_sent_at > v_global_threshold
    )
  )
  SELECT
    p.id AS user_id,
    p.email,
    p.display_name,
    p.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    li.conditions_score::int,
    li.surf_description,
    li.wind_description,
    li.best_window_start,
    li.best_window_end,
    li.recommendation
  FROM global_filtered gf
  JOIN profiles p ON p.id = gf.user_id
  JOIN beaches b ON b.id = p.home_beach_id
  JOIN latest_intel li ON li.beach_id = p.home_beach_id;
END;
$$;


ALTER FUNCTION "public"."get_reengagement_email_candidates"("p_inactive_days" integer, "p_min_score" integer, "p_dedupe_hours" integer, "p_global_cooldown_hours" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_reengagement_email_candidates"("p_inactive_days" integer, "p_min_score" integer, "p_dedupe_hours" integer, "p_global_cooldown_hours" integer) IS 'Returns inactive users whose home beach has good conditions today. Respects per-type and global email rate limits.';



CREATE OR REPLACE FUNCTION "public"."get_referral_leaderboard"("max_results" integer DEFAULT 10) RETURNS TABLE("user_id" "uuid", "display_name" "text", "avatar_url" "text", "referral_count" bigint, "rank" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS user_id,
        COALESCE(p.display_name, p.full_name, 'Anonymous Surfer') AS display_name,
        p.avatar_url,
        COUNT(r.id) AS referral_count,
        ROW_NUMBER() OVER (ORDER BY COUNT(r.id) DESC, MIN(r.created_at) ASC) AS rank
    FROM public.profiles p
    INNER JOIN public.referrals r ON r.referrer_id = p.id
    GROUP BY p.id, p.display_name, p.full_name, p.avatar_url
    HAVING COUNT(r.id) > 0
    ORDER BY referral_count DESC, MIN(r.created_at) ASC
    LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."get_referral_leaderboard"("max_results" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_referral_leaderboard"("max_results" integer) IS 'Returns the top referrers by referral count for the leaderboard display. Prefers display_name over full_name for privacy.';



CREATE OR REPLACE FUNCTION "public"."get_session_prompt_candidates"("p_min_score" integer DEFAULT 7) RETURNS TABLE("user_id" "uuid", "email" "text", "display_name" "text", "home_beach_id" "uuid", "beach_name" "text", "beach_slug" "text", "conditions_score" integer, "surf_description" "text", "wind_description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH eligible_users AS (
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.home_beach_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
  ),
  -- Join beaches early to get timezone for each user's home beach
  users_with_beach AS (
    SELECT
      eu.id,
      eu.email,
      eu.display_name,
      eu.home_beach_id,
      COALESCE(b.timezone, 'America/Los_Angeles') AS beach_tz
    FROM eligible_users eu
    INNER JOIN beaches b ON b.id = eu.home_beach_id
  ),
  yesterday_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description
    FROM beach_daily_intel bdi
    INNER JOIN users_with_beach uwb ON uwb.home_beach_id = bdi.beach_id
    WHERE bdi.forecast_date = ((CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz) - INTERVAL '1 day')::date
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  no_session_yesterday AS (
    SELECT uwb.id, uwb.email, uwb.display_name, uwb.home_beach_id, uwb.beach_tz
    FROM users_with_beach uwb
    WHERE NOT EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.user_id = uwb.id
        AND s.arrival_time >= ((CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz) - INTERVAL '1 day')::date AT TIME ZONE uwb.beach_tz
        AND s.arrival_time < (CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz)::date AT TIME ZONE uwb.beach_tz
    )
  ),
  active_today_filter AS (
    SELECT nsy.id, nsy.email, nsy.display_name, nsy.home_beach_id, nsy.beach_tz
    FROM no_session_yesterday nsy
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_events ue
      WHERE ue.user_id = nsy.id
        AND ue.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE nsy.beach_tz)::date AT TIME ZONE nsy.beach_tz
    )
  ),
  email_dedup AS (
    SELECT atf.id, atf.email, atf.display_name, atf.home_beach_id
    FROM active_today_filter atf
    WHERE NOT EXISTS (
      SELECT 1
      FROM email_send_log esl
      WHERE esl.user_id = atf.id
        AND esl.sent_at >= (CURRENT_TIMESTAMP AT TIME ZONE atf.beach_tz)::date AT TIME ZONE atf.beach_tz
    )
  )
  SELECT
    ed.id AS user_id,
    ed.email,
    ed.display_name,
    ed.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    yi.conditions_score,
    yi.surf_description,
    yi.wind_description
  FROM email_dedup ed
  INNER JOIN beaches b ON b.id = ed.home_beach_id
  INNER JOIN yesterday_intel yi ON yi.beach_id = ed.home_beach_id;
END;
$$;


ALTER FUNCTION "public"."get_session_prompt_candidates"("p_min_score" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_session_prompt_candidates"("p_min_score" integer) IS 'Returns users eligible for session prompt emails based on high beach_daily_intel scores yesterday but no logged session. Excludes users active in app today or who received any email today. Uses beach-specific timezone for date calculations.';



CREATE OR REPLACE FUNCTION "public"."get_session_share_stats"("p_session_id" "uuid") RETURNS TABLE("total_shares" bigint, "instagram_shares" bigint, "tiktok_shares" bigint, "twitter_shares" bigint, "facebook_shares" bigint, "copy_shares" bigint, "unique_sharers" bigint, "last_shared_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_shares,
    COUNT(*) FILTER (WHERE platform = 'instagram')::bigint AS instagram_shares,
    COUNT(*) FILTER (WHERE platform = 'tiktok')::bigint AS tiktok_shares,
    COUNT(*) FILTER (WHERE platform = 'twitter')::bigint AS twitter_shares,
    COUNT(*) FILTER (WHERE platform = 'facebook')::bigint AS facebook_shares,
    COUNT(*) FILTER (WHERE platform = 'copy')::bigint AS copy_shares,
    COUNT(DISTINCT user_id)::bigint AS unique_sharers,
    MAX(created_at) AS last_shared_at
  FROM session_shares
  WHERE session_id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."get_session_share_stats"("p_session_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_session_share_stats"("p_session_id" "uuid") IS 'Get detailed share statistics for a session';



CREATE OR REPLACE FUNCTION "public"."get_session_wave_observation_analytics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  analytics jsonb;
BEGIN
  WITH
    real_completed_sessions AS (
      SELECT s.id
      FROM public.sessions s
      JOIN public.profiles p ON p.id = s.user_id
      WHERE s.status = 'completed'
        AND s.deleted_at IS NULL
        AND p.is_mock = false
        AND (
          p.email IS NULL
          OR (
            p.email NOT ILIKE '%test%'
            AND p.email NOT LIKE '%@local.test'
            AND p.email NOT LIKE '%@example.invalid'
          )
        )
    ),
    candidates AS (
      SELECT c.*
      FROM public.session_wave_observation_candidates c
      JOIN public.profiles p ON p.id = c.user_id
      WHERE p.is_mock = false
        AND (
          p.email IS NULL
          OR (
            p.email NOT ILIKE '%test%'
            AND p.email NOT LIKE '%@local.test'
            AND p.email NOT LIKE '%@example.invalid'
          )
        )
    ),
    comparable AS (
      SELECT
        c.*,
        abs(c.observed_m - c.snapshot_buoy_observed_m) AS user_abs_error_m,
        c.observed_m - c.snapshot_buoy_observed_m AS user_signed_error_m,
        CASE
          WHEN c.snapshot_display_height_m IS NULL THEN NULL
          ELSE abs(c.snapshot_display_height_m - c.snapshot_buoy_observed_m)
        END AS display_abs_error_m,
        CASE
          WHEN c.snapshot_raw_om_height_m IS NULL THEN NULL
          ELSE abs(c.snapshot_raw_om_height_m - c.snapshot_buoy_observed_m)
        END AS raw_om_abs_error_m,
        CASE
          WHEN c.snapshot_v5_shadow_height_m IS NULL THEN NULL
          ELSE abs(c.snapshot_v5_shadow_height_m - c.snapshot_buoy_observed_m)
        END AS v5_shadow_abs_error_m
      FROM candidates c
      WHERE c.quality_state <> 'rejected'
        AND c.observed_m IS NOT NULL
        AND c.snapshot_buoy_observed_m IS NOT NULL
        AND c.snapshot_buoy_observed_m > 0
    ),
    user_reliability_base AS (
      SELECT
        count(*) AS comparisons,
        round(avg(user_abs_error_m)::numeric, 3) AS avg_abs_error_m,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) AS median_abs_error_m,
        round((percentile_cont(0.75) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) AS p75_abs_error_m,
        round(avg(user_signed_error_m)::numeric, 3) AS avg_signed_bias_m
      FROM comparable
      GROUP BY user_id
    ),
    user_reliability AS (
      SELECT
        row_number() OVER (
          ORDER BY comparisons DESC, median_abs_error_m ASC
        ) AS anonymous_user_rank,
        comparisons,
        avg_abs_error_m,
        median_abs_error_m,
        p75_abs_error_m,
        avg_signed_bias_m
      FROM user_reliability_base
    ),
    beach_reliability AS (
      SELECT
        beach_id,
        count(*) AS comparisons,
        round(avg(user_abs_error_m)::numeric, 3) AS avg_abs_error_m,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) AS median_abs_error_m
      FROM comparable
      GROUP BY beach_id
    ),
    delta_buckets AS (
      SELECT
        CASE
          WHEN nearest_prediction_delta_minutes IS NULL THEN 'no_ml_match'
          WHEN nearest_prediction_delta_minutes <= 30 THEN '0_30m'
          WHEN nearest_prediction_delta_minutes <= 90 THEN '31_90m'
          WHEN nearest_prediction_delta_minutes <= 180 THEN '91_180m'
          ELSE '181_360m'
        END AS bucket,
        count(*) AS candidates,
        count(*) FILTER (WHERE snapshot_buoy_observed_m IS NOT NULL AND snapshot_buoy_observed_m > 0) AS with_buoy_truth
      FROM candidates
      GROUP BY 1
    )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'funnel', jsonb_build_object(
      'real_completed_sessions', (SELECT count(*) FROM real_completed_sessions),
      'candidate_rows', (SELECT count(*) FROM candidates),
      'valid_height_candidates', (
        SELECT count(*)
        FROM candidates
        WHERE quality_state <> 'rejected'
          AND observed_m IS NOT NULL
          AND reported_wave_height_ft > 0
          AND reported_wave_height_ft <= 50
      ),
      'matched_to_ml_within_6h', (
        SELECT count(*)
        FROM candidates
        WHERE quality_state <> 'rejected'
          AND ml_prediction_id IS NOT NULL
      ),
      'matched_with_buoy_truth', (SELECT count(*) FROM comparable),
      'candidate_sessions_7d', (
        SELECT count(*)
        FROM candidates
        WHERE observed_at >= now() - interval '7 days'
      ),
      'candidate_sessions_30d', (
        SELECT count(*)
        FROM candidates
        WHERE observed_at >= now() - interval '30 days'
      )
    ),
    'quality', jsonb_build_object(
      'user_vs_buoy_abs_error_avg_m', (SELECT round(avg(user_abs_error_m)::numeric, 3) FROM comparable),
      'user_vs_buoy_abs_error_median_m', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) FROM comparable),
      'user_vs_buoy_abs_error_p75_m', (SELECT round((percentile_cont(0.75) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) FROM comparable),
      'user_vs_buoy_abs_error_p90_m', (SELECT round((percentile_cont(0.9) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) FROM comparable),
      'user_vs_buoy_signed_bias_avg_m', (SELECT round(avg(user_signed_error_m)::numeric, 3) FROM comparable),
      'display_abs_error_avg_m', (SELECT round(avg(display_abs_error_m)::numeric, 3) FROM comparable WHERE display_abs_error_m IS NOT NULL),
      'raw_om_abs_error_avg_m', (SELECT round(avg(raw_om_abs_error_m)::numeric, 3) FROM comparable WHERE raw_om_abs_error_m IS NOT NULL),
      'v5_shadow_abs_error_avg_m', (SELECT round(avg(v5_shadow_abs_error_m)::numeric, 3) FROM comparable WHERE v5_shadow_abs_error_m IS NOT NULL),
      'user_beats_display_count', (SELECT count(*) FROM comparable WHERE display_abs_error_m IS NOT NULL AND user_abs_error_m < display_abs_error_m),
      'display_comparison_count', (SELECT count(*) FROM comparable WHERE display_abs_error_m IS NOT NULL),
      'user_beats_v5_shadow_count', (SELECT count(*) FROM comparable WHERE v5_shadow_abs_error_m IS NOT NULL AND user_abs_error_m < v5_shadow_abs_error_m),
      'v5_shadow_comparison_count', (SELECT count(*) FROM comparable WHERE v5_shadow_abs_error_m IS NOT NULL)
    ),
    'candidate_counts', jsonb_build_object(
      'by_quality_state', coalesce((
        SELECT jsonb_object_agg(quality_state, candidate_count)
        FROM (
          SELECT quality_state, count(*) AS candidate_count
          FROM candidates
          GROUP BY quality_state
        ) grouped
      ), '{}'::jsonb),
      'by_source_created_by', coalesce((
        SELECT jsonb_object_agg(source_created_by, candidate_count)
        FROM (
          SELECT source_created_by, count(*) AS candidate_count
          FROM candidates
          GROUP BY source_created_by
        ) grouped
      ), '{}'::jsonb),
      'effective_weak_label_mass', (
        SELECT coalesce(round(sum(observation_weight)::numeric, 3), 0)
        FROM candidates
        WHERE quality_state <> 'rejected'
          AND ml_prediction_id IS NOT NULL
      )
    ),
    'anonymous_user_reliability', coalesce((
      SELECT jsonb_agg(to_jsonb(user_reliability) ORDER BY anonymous_user_rank)
      FROM user_reliability
    ), '[]'::jsonb),
    'beach_reliability', coalesce((
      SELECT jsonb_agg(to_jsonb(beach_reliability) ORDER BY comparisons DESC, median_abs_error_m ASC)
      FROM beach_reliability
    ), '[]'::jsonb),
    'match_delta_buckets', coalesce((
      SELECT jsonb_agg(to_jsonb(delta_buckets) ORDER BY bucket)
      FROM delta_buckets
    ), '[]'::jsonb)
  ) INTO analytics;

  RETURN analytics;
END;
$$;


ALTER FUNCTION "public"."get_session_wave_observation_analytics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_session_wave_observation_analytics"() IS 'Returns aggregated weak session-wave observation analytics without user emails or raw user identifiers. Used by private ML/app-stats reporting only.';



CREATE OR REPLACE FUNCTION "public"."get_user_board_deck_stats"("p_user_id" "uuid") RETURNS TABLE("board_id" "uuid", "sessions_count" integer, "positive_sessions_count" integer, "best_period_range" "text", "best_wind_label" "text", "learned_label" "text", "last_used_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only query own board stats';
  END IF;

  RETURN QUERY
  WITH board_base AS (
    SELECT b.id AS board_id
    FROM public.boards b
    WHERE b.user_id = p_user_id
  ),
  session_base AS (
    SELECT
      s.board_id,
      s.id AS session_id,
      s.rating,
      s.arrival_time,
      s.custom_spot_id,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period_s,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed_mph,
      public.parse_numeric_from_text(COALESCE(
        sfs.forecast_snapshot->>'wind_direction_deg',
        sfs.forecast_snapshot->>'wind_direction'
      )) AS wind_direction_deg
    FROM public.sessions s
    LEFT JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    WHERE s.user_id = p_user_id
      AND s.board_id IS NOT NULL
      AND s.status = 'completed'
      AND s.deleted_at IS NULL
  ),
  positive AS (
    SELECT *
    FROM session_base
    WHERE rating >= 4
  ),
  aggregate_stats AS (
    SELECT
      bb.board_id,
      COUNT(sb.session_id)::integer AS sessions_count,
      COUNT(p.session_id)::integer AS positive_sessions_count,
      MAX(sb.arrival_time) AS last_used_at,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY p.wave_period_s)
        FILTER (WHERE p.wave_period_s IS NOT NULL) AS p25_period,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY p.wave_period_s)
        FILTER (WHERE p.wave_period_s IS NOT NULL) AS p75_period,
      AVG(p.wind_speed_mph) FILTER (WHERE p.wind_speed_mph IS NOT NULL) AS avg_wind_speed,
      AVG(
        CASE
          WHEN cs.offshore_direction_deg IS NULL OR p.wind_direction_deg IS NULL THEN NULL
          ELSE LEAST(
            ABS(cs.offshore_direction_deg - p.wind_direction_deg),
            360 - ABS(cs.offshore_direction_deg - p.wind_direction_deg)
          )
        END
      ) FILTER (WHERE cs.offshore_direction_deg IS NOT NULL AND p.wind_direction_deg IS NOT NULL) AS avg_offshore_delta
    FROM board_base bb
    LEFT JOIN session_base sb ON sb.board_id = bb.board_id
    LEFT JOIN positive p ON p.board_id = bb.board_id
    LEFT JOIN public.custom_spots cs ON cs.id = p.custom_spot_id
    GROUP BY bb.board_id
  )
  SELECT
    a.board_id,
    COALESCE(a.sessions_count, 0),
    COALESCE(a.positive_sessions_count, 0),
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 OR a.p25_period IS NULL OR a.p75_period IS NULL THEN NULL
      ELSE format('Best: %s-%ss', round(a.p25_period)::integer, round(a.p75_period)::integer)
    END AS best_period_range,
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 THEN NULL
      WHEN a.avg_offshore_delta IS NOT NULL AND a.avg_offshore_delta <= 45 THEN 'Light offshore'
      WHEN a.avg_offshore_delta IS NOT NULL AND a.avg_offshore_delta <= 75 THEN 'Clean side-off'
      WHEN a.avg_wind_speed IS NULL THEN NULL
      WHEN a.avg_wind_speed <= 7 THEN 'Light wind'
      WHEN a.avg_wind_speed <= 12 THEN 'Handles texture'
      ELSE 'Wind tolerant'
    END AS best_wind_label,
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 THEN 'Learning this board'
      ELSE 'Learned from sessions'
    END AS learned_label,
    a.last_used_at
  FROM aggregate_stats a;
END;
$$;


ALTER FUNCTION "public"."get_user_board_deck_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_match_candidates"("p_user_id" "uuid", "p_exclude_beach_id" "uuid" DEFAULT NULL::"uuid", "p_device_lat" double precision DEFAULT NULL::double precision, "p_device_lon" double precision DEFAULT NULL::double precision, "p_radius_km" double precision DEFAULT 50, "p_limit" integer DEFAULT 5) RETURNS TABLE("beach" "jsonb", "score" numeric, "label" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$ DECLARE v_have_device boolean := p_device_lat IS NOT NULL AND p_device_lon IS NOT NULL; BEGIN RETURN QUERY WITH candidate_beaches AS (SELECT DISTINCT b.id, b.name, b.lat, b.lon FROM public.beaches b WHERE b.deleted_at IS NULL AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id) AND b.id IN (SELECT fb.beach_id FROM public.favorite_beaches fb WHERE fb.user_id = p_user_id UNION SELECT b2.id FROM public.beaches b2 WHERE v_have_device AND b2.geog IS NOT NULL AND ST_DWithin(b2.geog, ST_SetSRID(ST_MakePoint(p_device_lon, p_device_lat), 4326)::geography, p_radius_km * 1000))), latest_forecast AS (SELECT DISTINCT ON (ef.beach_id) ef.beach_id, ef.wave_height, ef.wave_period, ef.wind_speed, (ef.wind_direction_deg)::text AS wind_direction, ef.tide_height FROM public.enhanced_forecasts ef WHERE ef.beach_id IN (SELECT id FROM candidate_beaches) ORDER BY ef.beach_id, ef.forecast_at DESC NULLS LAST), scored AS (SELECT cb.id, cb.name, cb.lat, cb.lon, public.compute_user_match_score(p_user_id, cb.id, lf.wave_height, lf.wave_period, lf.wind_speed, lf.wind_direction, lf.tide_height) AS result FROM candidate_beaches cb JOIN latest_forecast lf ON lf.beach_id = cb.id) SELECT jsonb_build_object('id', s.id, 'name', s.name, 'lat', s.lat, 'lon', s.lon) AS beach, (s.result->>'score')::numeric AS score, s.result->>'label' AS label FROM scored s WHERE s.result->>'state' = 'ready' ORDER BY (s.result->>'score')::numeric DESC NULLS LAST LIMIT p_limit; END; $$;


ALTER FUNCTION "public"."get_user_match_candidates"("p_user_id" "uuid", "p_exclude_beach_id" "uuid", "p_device_lat" double precision, "p_device_lon" double precision, "p_radius_km" double precision, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_referral_stats"("user_id" "uuid") RETURNS TABLE("total_referrals" bigint, "completed_referrals" bigint, "pending_referrals" bigint, "expired_referrals" bigint, "referral_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_referrals,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_referrals,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired_referrals,
        p.referral_code
    FROM public.profiles p
    LEFT JOIN public.referrals r ON r.referrer_id = p.id
    WHERE p.id = user_id
    GROUP BY p.id, p.referral_code;
END;
$$;


ALTER FUNCTION "public"."get_user_referral_stats"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_referral_stats"("user_id" "uuid") IS 'Returns referral statistics for a given user (total, completed, pending, expired counts)';



CREATE OR REPLACE FUNCTION "public"."get_user_session_match_comparison"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_profile_count integer;
  v_future_wave numeric := public.parse_numeric_from_text(p_wave_height);
  v_future_period numeric := public.parse_numeric_from_text(p_wave_period);
  v_future_wind numeric := public.parse_numeric_from_text(p_wind_speed);
  v_future_wind_dir numeric := public.parse_numeric_from_text(p_wind_direction);
  v_future_tide numeric := public.parse_numeric_from_text(p_tide_height);
  v_positive jsonb;
  v_negative jsonb;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only query own match comparison';
  END IF;

  SELECT COUNT(*)::integer INTO v_profile_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL;

  IF v_profile_count < 5 THEN
    RETURN jsonb_build_object(
      'state', 'locked',
      'session_count', v_profile_count,
      'sessions_needed', 5 - v_profile_count
    );
  END IF;

  WITH scored AS (
    SELECT
      s.id,
      s.rating,
      s.arrival_time,
      COALESCE(s.board_snapshot->>'name', b.name) AS board_name,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS wave_height,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed,
      public.parse_numeric_from_text(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) AS wind_direction,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') AS tide_height,
      (
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') - v_future_wave), 99) * 0.35 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') - v_future_period), 99) * 0.20 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') - v_future_wind), 99) * 0.15 +
        COALESCE(LEAST(
          ABS(public.parse_numeric_from_text(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) - v_future_wind_dir),
          360 - ABS(public.parse_numeric_from_text(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) - v_future_wind_dir)
        ) / 30, 99) * 0.15 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') - v_future_tide), 99) * 0.15
      ) AS distance_score
    FROM public.sessions s
    JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    LEFT JOIN public.boards b ON b.id = s.board_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND s.rating IS NOT NULL
      AND s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
      AND (s.beach_id = p_beach_id OR p_beach_id IS NULL)
  )
  SELECT jsonb_build_object(
    'session_id', id,
    'rating', rating,
    'arrival_time', arrival_time,
    'board_name', board_name,
    'deltas', jsonb_build_object(
      'waves', round((v_future_wave - wave_height)::numeric, 1),
      'period', round((v_future_period - wave_period)::numeric, 0),
      'wind', round((v_future_wind - wind_speed)::numeric, 0),
      'tide', round((v_future_tide - tide_height)::numeric, 1)
    )
  )
  INTO v_positive
  FROM scored
  WHERE rating >= 4
  ORDER BY distance_score ASC NULLS LAST
  LIMIT 1;

  WITH scored AS (
    SELECT
      s.id,
      s.rating,
      s.arrival_time,
      COALESCE(s.board_snapshot->>'name', b.name) AS board_name,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS wave_height,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') AS tide_height,
      (
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') - v_future_wave), 99) * 0.35 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') - v_future_period), 99) * 0.25 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') - v_future_wind), 99) * 0.20 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') - v_future_tide), 99) * 0.20
      ) AS distance_score
    FROM public.sessions s
    JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    LEFT JOIN public.boards b ON b.id = s.board_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND s.rating IS NOT NULL
      AND s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
      AND (s.beach_id = p_beach_id OR p_beach_id IS NULL)
  )
  SELECT jsonb_build_object(
    'session_id', id,
    'rating', rating,
    'arrival_time', arrival_time,
    'board_name', board_name
  )
  INTO v_negative
  FROM scored
  WHERE rating <= 2
  ORDER BY distance_score ASC NULLS LAST
  LIMIT 1;

  IF v_positive IS NULL THEN
    RETURN jsonb_build_object(
      'state', 'no_data',
      'session_count', v_profile_count
    );
  END IF;

  RETURN jsonb_build_object(
    'state', 'ready',
    'future', jsonb_build_object(
      'wave_height', p_wave_height,
      'wave_period', p_wave_period,
      'wind_speed', p_wind_speed,
      'wind_direction', p_wind_direction,
      'tide_height', p_tide_height
    ),
    'positive_session', v_positive,
    'negative_session', v_negative,
    'confidence', CASE WHEN v_profile_count >= 20 THEN 'high' WHEN v_profile_count >= 10 THEN 'medium' ELSE 'low' END
  );
END;
$$;


ALTER FUNCTION "public"."get_user_session_match_comparison"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") RETURNS TABLE("total_bytes" bigint, "image_count" integer, "remaining_bytes" bigint, "usage_percentage" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  user_limit CONSTANT BIGINT := 104857600; -- 100MB per user
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(su.total_bytes, 0) as total_bytes,
    COALESCE(su.image_count, 0) as image_count,
    GREATEST(0, user_limit - COALESCE(su.total_bytes, 0)) as remaining_bytes,
    ROUND((COALESCE(su.total_bytes, 0)::NUMERIC / user_limit::NUMERIC) * 100, 2) as usage_percentage
  FROM public.storage_usage su
  WHERE su.user_id = p_user_id
  UNION ALL
  SELECT 0::BIGINT, 0::INTEGER, user_limit, 0.00::NUMERIC
  WHERE NOT EXISTS (SELECT 1 FROM public.storage_usage WHERE user_id = p_user_id)
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") IS 'Returns storage statistics for a user including total bytes, image count, remaining quota, and usage percentage';



CREATE OR REPLACE FUNCTION "public"."get_user_viral_coefficient"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  total_sessions bigint;
  total_shares bigint;
  viral_coefficient numeric;
BEGIN
  -- Count user's public sessions
  SELECT COUNT(*)
  INTO total_sessions
  FROM sessions
  WHERE user_id = p_user_id
  AND status = 'completed'
  AND is_public = true;

  -- Return 0 if no sessions
  IF total_sessions = 0 THEN
    RETURN 0;
  END IF;

  -- Count total shares of user's sessions
  SELECT COUNT(*)
  INTO total_shares
  FROM session_shares ss
  INNER JOIN sessions s ON s.id = ss.session_id
  WHERE s.user_id = p_user_id;

  -- Calculate coefficient
  viral_coefficient := total_shares::numeric / total_sessions::numeric;

  RETURN ROUND(viral_coefficient, 2);
END;
$$;


ALTER FUNCTION "public"."get_user_viral_coefficient"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_viral_coefficient"("p_user_id" "uuid") IS 'Calculate viral coefficient (avg shares per session) for a user';



CREATE OR REPLACE FUNCTION "public"."get_welcome_email_candidates"() RETURNS TABLE("user_id" "uuid", "email" "text", "created_at" timestamp with time zone, "email_confirmed_at" timestamp with time zone, "home_beach_id" "uuid", "case_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.created_at,
    au.email_confirmed_at,
    p.home_beach_id,
    CASE
      WHEN au.email_confirmed_at IS NULL AND p.created_at < NOW() - INTERVAL '24 hours'
        THEN 'unconfirmed_24h'
      WHEN au.email_confirmed_at IS NOT NULL AND p.home_beach_id IS NULL
        AND p.created_at < NOW() - INTERVAL '48 hours'
        THEN 'no_home_beach_48h'
    END AS case_type
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  LEFT JOIN email_send_log esl ON esl.user_id = p.id AND esl.email_type = 'welcome'
  WHERE p.is_mock = false
    AND p.email IS NOT NULL
    AND esl.id IS NULL
    AND (
      (au.email_confirmed_at IS NULL AND p.created_at < NOW() - INTERVAL '24 hours')
      OR
      (au.email_confirmed_at IS NOT NULL AND p.home_beach_id IS NULL AND p.created_at < NOW() - INTERVAL '48 hours')
    );
END;
$$;


ALTER FUNCTION "public"."get_welcome_email_candidates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_worst_performing_beaches"("limit_count" integer DEFAULT 10) RETURNS TABLE("beach_id" "uuid", "beach_name" "text", "predictions_matched" bigint, "improvement_rate_pct" numeric, "mae_improvement_pct" numeric, "raw_mae" numeric, "corrected_mae" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    beach_id, beach_name, predictions_matched,
    improvement_rate_pct, mae_improvement_pct, raw_mae, corrected_mae
  FROM beach_ml_performance_baseline
  WHERE predictions_matched >= 10
  ORDER BY improvement_rate_pct ASC NULLS LAST
  LIMIT limit_count;
$$;


ALTER FUNCTION "public"."get_worst_performing_beaches"("limit_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_worst_performing_beaches"("limit_count" integer) IS 'Returns beaches with lowest ML improvement rates.';



CREATE OR REPLACE FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") RETURNS TABLE("beach_id" "uuid", "forecast_date" "date", "avg_predicted_m" numeric, "avg_observed_m" numeric, "mae_m" numeric, "relative_error_pct" numeric, "observation_count" integer, "should_display" boolean)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tz TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  -- Get beach timezone (default to LA)
  SELECT COALESCE(b.timezone, 'America/Los_Angeles') INTO v_tz
  FROM beaches b WHERE b.id = p_beach_id;

  IF v_tz IS NULL THEN
    v_tz := 'America/Los_Angeles';
  END IF;

  -- Pre-compute yesterday's UTC boundaries for index-friendly filtering
  -- on (beach_id, predicted_at) instead of DATE(predicted_at AT TIME ZONE ...)
  v_start := (CURRENT_DATE AT TIME ZONE v_tz - INTERVAL '1 day') AT TIME ZONE v_tz;
  v_end := (CURRENT_DATE AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  RETURN QUERY
  SELECT
    p.beach_id,
    (v_start AT TIME ZONE v_tz)::date AS forecast_date,
    ROUND(AVG(p.corrected_forecast_m)::numeric, 2) AS avg_predicted_m,
    ROUND(AVG(p.observed_m)::numeric, 2) AS avg_observed_m,
    ROUND(AVG(ABS(p.corrected_error_m))::numeric, 2) AS mae_m,
    -- Cap at 999% to prevent absurd values for very small observed waves
    LEAST(
      ROUND(
        AVG(
          CASE WHEN ABS(p.observed_m) > 0
          THEN ABS(p.corrected_error_m) / ABS(p.observed_m) * 100
          ELSE NULL END
        )::numeric, 1
      ),
      999
    ) AS relative_error_pct,
    COUNT(*)::integer AS observation_count,
    -- Hide when EITHER: error > 0.45m (~1.5ft) OR relative > 40%, OR observed < 0.3m (~1ft)
    NOT (
      AVG(ABS(p.corrected_error_m)) > 0.45
      OR COALESCE(AVG(
        CASE WHEN ABS(p.observed_m) > 0
        THEN ABS(p.corrected_error_m) / ABS(p.observed_m)
        ELSE NULL END
      ), 0) > 0.40
    ) AND AVG(p.observed_m) >= 0.3 AS should_display
  FROM ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.predicted_at >= v_start
    AND p.predicted_at < v_end
    AND p.observed_m IS NOT NULL
  GROUP BY p.beach_id;
END;
$$;


ALTER FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") IS 'Returns forecast accuracy metrics for yesterday at the given beach.
Uses ml_predictions_log with observed ground truth from IOOS buoys.
should_display is false when accuracy is poor (>0.45m MAE OR >40% relative) or waves too small (<0.3m).';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_location_data jsonb;
  v_signup_context jsonb;
  v_location text;
  v_home_region text;
  v_timezone text;
  v_profile_name text;
  v_display_name text;
BEGIN
  v_location_data := NEW.raw_user_meta_data->'location_data';
  v_signup_context := NEW.raw_user_meta_data->'signup_context';

  IF v_location_data IS NOT NULL
     AND v_location_data->>'city' IS NOT NULL
     AND v_location_data->>'region' IS NOT NULL THEN
    v_location := v_location_data->>'city' || ', ' || v_location_data->>'region';
  END IF;

  v_home_region := v_location_data->>'region';
  v_timezone := v_signup_context->>'tz';
  v_profile_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), '')
  );
  v_display_name := v_profile_name;

  IF v_display_name IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.display_name = v_display_name
         AND p.id <> NEW.id
     ) THEN
    v_display_name := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    avatar_url,
    location,
    home_region,
    timezone,
    signup_context,
    signup_location,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_profile_name,
    v_display_name,
    NEW.raw_user_meta_data->>'avatar_url',
    v_location,
    v_home_region,
    v_timezone,
    v_signup_context,
    v_location_data,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = CASE
      WHEN NULLIF(BTRIM(profiles.email), '') IS NULL THEN EXCLUDED.email
      ELSE profiles.email
    END,
    full_name = CASE
      WHEN NULLIF(BTRIM(profiles.full_name), '') IS NULL THEN EXCLUDED.full_name
      ELSE profiles.full_name
    END,
    display_name = CASE
      WHEN NULLIF(BTRIM(profiles.display_name), '') IS NULL THEN EXCLUDED.display_name
      ELSE profiles.display_name
    END,
    location = COALESCE(profiles.location, EXCLUDED.location),
    home_region = COALESCE(profiles.home_region, EXCLUDED.home_region),
    timezone = COALESCE(profiles.timezone, EXCLUDED.timezone),
    signup_context = COALESCE(profiles.signup_context, EXCLUDED.signup_context),
    signup_location = COALESCE(profiles.signup_location, EXCLUDED.signup_location),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Creates or self-heals a profile when an auth user signs up. Normalizes display_name, full_name, and name metadata without overwriting user-set names.';



CREATE OR REPLACE FUNCTION "public"."increment_session_share_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE sessions
  SET share_count = share_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_session_share_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_session_share_count"("session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.sessions
  SET share_count = share_count + 1
  WHERE id = session_id;
END;
$$;


ALTER FUNCTION "public"."increment_session_share_count"("session_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_session_share_count"("session_id" "uuid") IS 'Increments the share_count field on a session. Called after successful share. SECURITY: Protected with SET search_path = public.';



CREATE OR REPLACE FUNCTION "public"."increment_station_discovery_misses"("seen_ids" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- Guard: do nothing if called with an empty array (would match ALL active stations)
  IF seen_ids IS NULL OR array_length(seen_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE ioos_stations
  SET consecutive_discovery_misses = consecutive_discovery_misses + 1
  WHERE station_id != ALL(seen_ids)
    AND active = true;
END;
$$;


ALTER FUNCTION "public"."increment_station_discovery_misses"("seen_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (select auth.uid())
      AND is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin_user"() IS 'Returns true if the current authenticated user is an admin. Used in RLS policies.';



CREATE OR REPLACE FUNCTION "public"."like_session_with_notification"("p_session_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_session_owner_id uuid;
  v_beach_name text;
  v_event_id uuid;
  v_dedup_collision boolean := false;
  v_existing_id uuid;
BEGIN
  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_id mismatch: must match auth.uid()';
  END IF;

  SELECT id INTO v_existing_id
    FROM session_likes
    WHERE session_id = p_session_id AND user_id = p_actor_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object(
      'liked', true,
      'was_existing', true,
      'event_id', null,
      'notification_dedup_collision', false
    );
  END IF;

  INSERT INTO session_likes (session_id, user_id)
    VALUES (p_session_id, p_actor_id);

  SELECT user_id, beach_name INTO v_session_owner_id, v_beach_name
    FROM sessions
    WHERE id = p_session_id;

  IF v_session_owner_id IS NULL OR v_session_owner_id = p_actor_id THEN
    RETURN json_build_object(
      'liked', true,
      'was_existing', false,
      'event_id', null,
      'notification_dedup_collision', false
    );
  END IF;

  BEGIN
    INSERT INTO notification_events (
      recipient_user_id, actor_user_id, type,
      entity_type, entity_id, payload, dedupe_key
    ) VALUES (
      v_session_owner_id, p_actor_id, 'like',
      'session', p_session_id,
      jsonb_build_object(
        'session_id', p_session_id::text,
        'beach_name', v_beach_name
      ),
      p_dedupe_key
    )
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    v_dedup_collision := true;
    v_event_id := null;
  END;

  RETURN json_build_object(
    'liked', true,
    'was_existing', false,
    'event_id', v_event_id,
    'notification_dedup_collision', v_dedup_collision
  );
END;
$$;


ALTER FUNCTION "public"."like_session_with_notification"("p_session_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_anonymous_events"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  linked_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  UPDATE public.user_events
  SET user_id = p_user_id
  WHERE session_id = p_session_id
    AND user_id IS NULL
    AND created_at > now() - interval '30 days';

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;


ALTER FUNCTION "public"."link_anonymous_events"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."link_anonymous_events"("p_session_id" "uuid", "p_user_id" "uuid") IS 'Links anonymous events to an authenticated user after sign-up. Called via service role from /api/events/link endpoint. Limited to events from the last 30 days.';



CREATE OR REPLACE FUNCTION "public"."log_revision"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
    history_table_name TEXT;
    change_type_value TEXT;
    changed_by_id UUID;
    insert_query TEXT;
    column_list TEXT;
    value_list TEXT;
BEGIN
    -- Determine history table name
    history_table_name := TG_TABLE_NAME || '_history';

    -- Determine change type
    IF TG_OP = 'DELETE' THEN
        change_type_value := 'DELETE';
    ELSIF TG_OP = 'UPDATE' THEN
        change_type_value := 'UPDATE';
    ELSE
        -- This trigger should only fire on UPDATE or DELETE
        RETURN OLD;
    END IF;

    -- Get the current user ID from auth context (if available)
    BEGIN
        changed_by_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        changed_by_id := NULL;
    END;

    -- Build column list from OLD record
    -- We'll use a dynamic approach to capture all columns
    SELECT
        string_agg(column_name, ', ' ORDER BY ordinal_position),
        string_agg('($1).' || column_name, ', ' ORDER BY ordinal_position)
    INTO column_list, value_list
    FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA
    AND table_name = TG_TABLE_NAME
    AND column_name NOT IN ('changed_at', 'changed_by', 'change_type', 'history_id');

    -- Build and execute dynamic insert query
    insert_query := format(
        'INSERT INTO %I.%I (%s, changed_at, changed_by, change_type) VALUES (%s, NOW(), $2, $3)',
        TG_TABLE_SCHEMA,
        history_table_name,
        column_list,
        value_list
    );

    -- Execute the insert
    EXECUTE insert_query USING OLD, changed_by_id, change_type_value;

    -- Return the appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the operation
    RAISE WARNING 'Failed to log revision for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$_$;


ALTER FUNCTION "public"."log_revision"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_revision"() IS 'Trigger function that automatically logs row changes to corresponding history tables. Fires BEFORE UPDATE OR DELETE.';



CREATE OR REPLACE FUNCTION "public"."maintain_board_session_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$ BEGIN IF TG_OP = 'INSERT' THEN IF NEW.board_id IS NOT NULL THEN UPDATE boards SET session_count = COALESCE(session_count, 0) + 1 WHERE id = NEW.board_id; END IF; RETURN NEW; ELSIF TG_OP = 'DELETE' THEN IF OLD.board_id IS NOT NULL THEN UPDATE boards SET session_count = GREATEST(COALESCE(session_count, 0) - 1, 0) WHERE id = OLD.board_id; END IF; RETURN OLD; ELSIF TG_OP = 'UPDATE' THEN IF OLD.board_id IS DISTINCT FROM NEW.board_id THEN IF OLD.board_id IS NOT NULL THEN UPDATE boards SET session_count = GREATEST(COALESCE(session_count, 0) - 1, 0) WHERE id = OLD.board_id; END IF; IF NEW.board_id IS NOT NULL THEN UPDATE boards SET session_count = COALESCE(session_count, 0) + 1 WHERE id = NEW.board_id; END IF; END IF; RETURN NEW; END IF; RETURN NULL; END; $$;


ALTER FUNCTION "public"."maintain_board_session_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nightly_forecast_maintenance"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    refresh_result JSON;
    cleanup_count INTEGER;
    final_result JSON;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Refresh enhanced forecasts
    refresh_result := refresh_enhanced_forecasts_for_active_beaches();
    
    -- Cleanup stale forecasts
    cleanup_count := cleanup_stale_enhanced_forecasts(14);
    
    -- Update table statistics
    ANALYZE public.enhanced_forecasts;
    ANALYZE public.beaches;
    
    -- Build final result
    final_result := jsonb_build_object(
        'operation', 'nightly_forecast_maintenance',
        'started_at', start_time,
        'completed_at', NOW(),
        'duration_seconds', EXTRACT(EPOCH FROM (NOW() - start_time)),
        'refresh_summary', refresh_result,
        'stale_forecasts_cleaned', cleanup_count,
        'statistics_updated', true
    );
    
    RETURN final_result;
END;
$$;


ALTER FUNCTION "public"."nightly_forecast_maintenance"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" character varying(50) NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_activities" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_session_invite"("p_actor_id" "uuid", "p_recipient_id" "uuid", "p_session_id" "uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."user_activities"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_row public.user_activities;
begin
  insert into public.user_activities (
    user_id,
    activity_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_recipient_id,
    'session_invite.created',
    'session',
    p_session_id,
    coalesce(jsonb_build_object('actor_id', p_actor_id) || p_payload, jsonb_build_object('actor_id', p_actor_id))
  )
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."notify_session_invite"("p_actor_id" "uuid", "p_recipient_id" "uuid", "p_session_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_numeric_from_text"("input" "text") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT COALESCE(
    (regexp_match(input, '(-?\d+\.?\d*)'))[1]::numeric,
    0
  );
$$;


ALTER FUNCTION "public"."parse_numeric_from_text"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preset_default_conditions"("p_preset" "text", "p_beach_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_tide_min numeric;
  v_tide_max numeric;
  v_effective_tide_min numeric;
  v_effective_tide_max numeric;
  v_preference_model jsonb;
  v_beginner_window jsonb;
  v_beginner_fit text;
  v_apply_sandy_beginner boolean;
  v_result jsonb;
  v_wind_mph numeric;
  v_time_start text;
  v_time_end text;
BEGIN
  CASE p_preset
    WHEN 'glass_off' THEN
      RETURN jsonb_build_object(
        'wind_direction', 'offshore',
        'wind_speed_max_kt', 5,
        'swell_height_min', 2
      );
    WHEN 'big_day' THEN
      RETURN jsonb_build_object(
        'swell_height_min', 6,
        'swell_period_min', 10
      );
    WHEN 'mellow_session' THEN
      SELECT
        b.preferred_tide_ft_min,
        b.preferred_tide_ft_max,
        b.preference_model
      INTO
        v_tide_min,
        v_tide_max,
        v_preference_model
      FROM public.beaches b
      WHERE b.id = p_beach_id;

      v_beginner_window := v_preference_model -> 'beginner_window';
      v_beginner_fit := lower(v_beginner_window ->> 'beginner_fit');
      v_effective_tide_min := COALESCE(
        NULLIF(v_beginner_window ->> 'preferred_tide_ft_min', '')::numeric,
        v_tide_min
      );
      v_effective_tide_max := COALESCE(
        NULLIF(v_beginner_window ->> 'preferred_tide_ft_max', '')::numeric,
        v_tide_max
      );
      v_apply_sandy_beginner :=
        v_beginner_window IS NOT NULL
        AND v_beginner_fit IN ('primary', 'conditional');

      IF v_apply_sandy_beginner THEN
        v_wind_mph := COALESCE(
          NULLIF(v_beginner_window ->> 'max_beginner_wind_mph', '')::numeric,
          10
        );
        v_time_start := COALESCE(v_beginner_window #>> '{best_time_local,start}', '06:00');
        v_time_end := COALESCE(v_beginner_window #>> '{best_time_local,end}', '10:00');
        v_result := jsonb_build_object(
          'swell_height_min',
          COALESCE(
            NULLIF(v_beginner_window #>> '{acceptable_wave_height_ft,min}', '')::numeric,
            0.5
          ),
          'swell_height_max',
          COALESCE(
            NULLIF(v_beginner_window #>> '{acceptable_wave_height_ft,max}', '')::numeric,
            3
          ),
          'wind_speed_max_kt',
          round(v_wind_mph * 0.868976)::integer,
          'avoid_tide_statuses',
          jsonb_build_array('high'),
          'local_time_start',
          v_time_start,
          'local_time_end',
          v_time_end,
          'beginner_sandy_window',
          true
        );
      ELSE
        v_result := jsonb_build_object(
          'swell_height_min', 1.5,
          'swell_height_max', 4,
          'wind_speed_max_kt', 8
        );
      END IF;

      IF v_effective_tide_min IS NOT NULL THEN
        v_result := v_result || jsonb_build_object('tide_height_min_ft', v_effective_tide_min);
      END IF;
      IF v_effective_tide_max IS NOT NULL THEN
        v_result := v_result || jsonb_build_object('tide_height_max_ft', v_effective_tide_max);
      END IF;
      RETURN v_result;
    ELSE
      RAISE EXCEPTION 'Unknown preset_type: %', p_preset;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."preset_default_conditions"("p_preset" "text", "p_beach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preset_default_name"("p_preset" "text", "p_beach_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_beach_name text;
  v_label text;
BEGIN
  SELECT name INTO v_beach_name FROM beaches WHERE id = p_beach_id;
  v_label := CASE p_preset
    WHEN 'glass_off'       THEN 'Glassy mornings'
    WHEN 'big_day'         THEN 'Big swells'
    WHEN 'mellow_session'  THEN 'Beginner-friendly'
    ELSE p_preset
  END;
  RETURN v_label || ' — ' || COALESCE(v_beach_name, 'beach');
END;
$$;


ALTER FUNCTION "public"."preset_default_name"("p_preset" "text", "p_beach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_delete_on_protected"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- Allow ephemeral-smoke-test users to be deleted regardless of the
  -- destructive flag. Marker is server-only (app_metadata).
  IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
    IF (OLD.raw_app_meta_data->>'is_ephemeral_smoke_test')::boolean IS TRUE THEN
      RETURN OLD;
    END IF;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'profiles' THEN
    -- Orphan profiles (auth.users row already deleted) are always safe.
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.id) THEN
      RETURN OLD;
    END IF;
  END IF;

  -- Existing escape hatch: explicit DBA flag inside a transaction.
  IF current_setting('app.allow_destructive', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DELETE blocked on % (user=%). Set app.allow_destructive=on inside a transaction if you truly need to proceed.',
      TG_TABLE_NAME, current_user;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_delete_on_protected"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_forecasts_retention"("keep_days_raw" integer DEFAULT 90, "keep_days_enhanced" integer DEFAULT 14, "batch_size" integer DEFAULT 25000) RETURNS TABLE("marine_deleted" bigint, "tide_deleted" bigint, "enhanced_deleted" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  cutoff_ts_raw timestamptz := now() - make_interval(days => keep_days_raw);
  cutoff_date_enhanced date := current_date - keep_days_enhanced;
  v_deleted int;
BEGIN
  marine_deleted := 0;
  tide_deleted := 0;
  enhanced_deleted := 0;

  -- Delete old marine_forecasts (90 day retention for ML training data)
  LOOP
    DELETE FROM public.marine_forecasts
    WHERE ctid IN (
      SELECT ctid FROM public.marine_forecasts WHERE ts < cutoff_ts_raw LIMIT batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    marine_deleted := marine_deleted + v_deleted;
    EXIT WHEN v_deleted = 0;
  END LOOP;

  -- Delete old tide_forecasts (90 day retention)
  LOOP
    DELETE FROM public.tide_forecasts
    WHERE ctid IN (
      SELECT ctid FROM public.tide_forecasts WHERE ts < cutoff_ts_raw LIMIT batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    tide_deleted := tide_deleted + v_deleted;
    EXIT WHEN v_deleted = 0;
  END LOOP;

  -- Delete old enhanced_forecasts (14 day retention)
  LOOP
    DELETE FROM public.enhanced_forecasts
    WHERE ctid IN (
      SELECT ctid FROM public.enhanced_forecasts WHERE forecast_date::date < cutoff_date_enhanced LIMIT batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    enhanced_deleted := enhanced_deleted + v_deleted;
    EXIT WHEN v_deleted = 0;
  END LOOP;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."prune_forecasts_retention"("keep_days_raw" integer, "keep_days_enhanced" integer, "batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prune_forecasts_retention"("keep_days_raw" integer, "keep_days_enhanced" integer, "batch_size" integer) IS 'Prunes old forecast data. Retention: 90 days marine/tide (for ML training), 14 days enhanced.
Updated 2026-01-20 to support ML bias correction model training.
Runs daily at 5am via pg_cron. Est. storage: ~1.2 GB for 90 days.';



CREATE OR REPLACE FUNCTION "public"."purge_implicit_history"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  current_user_id uuid;
  is_service_role boolean;
begin
  -- Acquire advisory lock on user_id to prevent concurrent purge operations
  -- This ensures the auth check and deletion are atomic
  -- Using xact-level lock that auto-releases on transaction end
  perform pg_advisory_xact_lock(hashtext('purge_implicit_history'), hashtext(target_user_id::text));

  -- Get current user info
  current_user_id := auth.uid();
  is_service_role := (
    current_setting('role', true) = 'service_role' or
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

  -- Security check: user can only purge their own data
  -- Service role bypasses this check and can purge any user
  -- IMPORTANT: This check happens INSIDE the lock to prevent race conditions
  if target_user_id != current_user_id and not is_service_role then
    raise exception 'Unauthorized: Cannot purge another user''s data';
  end if;

  -- Delete all events for this user
  delete from public.user_events
  where user_id = target_user_id;

  -- Delete implicit preferences for this user
  delete from public.user_implicit_preferences
  where user_id = target_user_id;

  -- Log the purge action for audit trail (optional but recommended)
  -- Note: This could be expanded to write to an audit_log table
  raise notice 'Purged implicit history for user %', target_user_id;

  -- Note: Does NOT change profiles.allow_implicit_tracking
  -- User can disable tracking separately via settings
end;
$$;


ALTER FUNCTION "public"."purge_implicit_history"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."purge_implicit_history"("target_user_id" "uuid") IS 'Deletes all implicit preference data for a user. Uses advisory lock to prevent race conditions. User can only purge their own data unless service_role.';



CREATE OR REPLACE FUNCTION "public"."record_referral_attribution"("referrer" "uuid", "referee" "uuid", "source" "text", "referral_code" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_referrer_code text;
  v_attribution_code text;
  v_inserted_id uuid;
  v_existing_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM $2 THEN
    RAISE EXCEPTION 'referee mismatch: must match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  IF $1 IS NULL OR $2 IS NULL THEN
    RAISE EXCEPTION 'referrer and referee are required'
      USING ERRCODE = '22023';
  END IF;

  IF $1 = $2 THEN
    RAISE EXCEPTION 'cannot refer yourself'
      USING ERRCODE = '22023';
  END IF;

  IF $3 NOT IN ('referral_code', 'invite_token') THEN
    RAISE EXCEPTION 'invalid referral source: %', $3
      USING ERRCODE = '22023';
  END IF;

  SELECT p.referral_code
    INTO v_referrer_code
    FROM public.profiles p
    WHERE p.id = $1
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'referrer profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_referrer_code IS NULL THEN
    v_referrer_code := public.generate_referral_code();

    UPDATE public.profiles p
      SET referral_code = v_referrer_code
      WHERE p.id = $1
        AND p.referral_code IS NULL
      RETURNING p.referral_code
      INTO v_referrer_code;
  END IF;

  v_attribution_code := COALESCE(NULLIF(upper(trim($4)), ''), v_referrer_code);

  INSERT INTO public.referrals (
    referrer_id,
    referee_id,
    referral_code,
    status,
    source
  ) VALUES (
    $1,
    $2,
    v_attribution_code,
    'pending',
    $3
  )
  ON CONFLICT (referee_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'created', true,
      'existing', false,
      'referral_id', v_inserted_id,
      'source', $3
    );
  END IF;

  SELECT r.id
    INTO v_existing_id
    FROM public.referrals r
    WHERE r.referee_id = $2;

  RETURN jsonb_build_object(
    'created', false,
    'existing', true,
    'referral_id', v_existing_id,
    'source', $3
  );
END;
$_$;


ALTER FUNCTION "public"."record_referral_attribution"("referrer" "uuid", "referee" "uuid", "source" "text", "referral_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_referral_attribution"("referrer" "uuid", "referee" "uuid", "source" "text", "referral_code" "text") IS 'Creates one idempotent referral attribution row for the authenticated referee.';



CREATE OR REPLACE FUNCTION "public"."refresh_beach_ml_baseline"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.beach_ml_performance_baseline;
  RAISE NOTICE 'beach_ml_performance_baseline refreshed at %', NOW();
END;
$$;


ALTER FUNCTION "public"."refresh_beach_ml_baseline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    result JSON;
    beaches_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
    beach_rec RECORD;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'operation', 'enhanced_forecasts_refresh',
        'started_at', start_time,
        'beaches_processed', 0,
        'successful_updates', 0,
        'failed_updates', 0,
        'errors', '[]'::jsonb
    );
    
    -- Get active beaches that need forecast updates
    -- Focus on beaches with recent activity or explicit priority
    -- FIXED: Changed latitude/longitude to lat/lon to match actual column names
    FOR beach_rec IN
        SELECT DISTINCT b.id, b.name, b.lat, b.lon
        FROM public.beaches b
        WHERE b.lat IS NOT NULL 
          AND b.lon IS NOT NULL
          AND (
            -- Beaches with recent sessions (within 30 days)
            EXISTS (
                SELECT 1 FROM public.sessions s 
                WHERE s.beach_id = b.id 
                  AND s.created_at > NOW() - INTERVAL '30 days'
            )
            -- OR beaches with recent check-ins
            OR EXISTS (
                SELECT 1 FROM public.beach_checkins bc
                WHERE bc.beach_id = b.id
                  AND bc.created_at > NOW() - INTERVAL '7 days'
            )
            -- OR beaches explicitly marked as priority (if such a column exists)
            OR b.is_private = false -- Include all public beaches for now
          )
        ORDER BY b.name
        LIMIT 50 -- Limit to prevent overwhelming the API services
    LOOP
        beaches_count := beaches_count + 1;
        
        BEGIN
            -- Note: The actual forecast generation should be called via the enhanced forecast service
            -- This is a placeholder that logs the attempt - the actual implementation
            -- would call the NextJS API endpoint or service function
            
            -- FIXED: Changed latitude/longitude to lat/lon in the RAISE NOTICE
            RAISE NOTICE 'Processing forecast refresh for beach: % (%, %)', 
                beach_rec.name, beach_rec.lat, beach_rec.lon;
            
            -- TODO: Call enhanced forecast service API endpoint
            -- For now, just log success
            success_count := success_count + 1;
            
        EXCEPTION 
            WHEN OTHERS THEN
                error_count := error_count + 1;
                
                -- Add error to result
                result := jsonb_set(
                    result,
                    '{errors}',
                    (result->'errors')::jsonb || jsonb_build_object(
                        'beach_id', beach_rec.id,
                        'beach_name', beach_rec.name,
                        'error', SQLERRM,
                        'timestamp', NOW()
                    )
                );
                
                RAISE NOTICE 'Error processing beach %: %', beach_rec.name, SQLERRM;
        END;
    END LOOP;
    
    -- Update result with final counts
    result := jsonb_set(result, '{beaches_processed}', to_jsonb(beaches_count));
    result := jsonb_set(result, '{successful_updates}', to_jsonb(success_count));
    result := jsonb_set(result, '{failed_updates}', to_jsonb(error_count));
    result := jsonb_set(result, '{completed_at}', to_jsonb(NOW()));
    result := jsonb_set(result, '{duration_seconds}', 
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time))));
    
    -- Log summary
    RAISE NOTICE 'Enhanced forecasts refresh completed: % beaches processed, % successful, % failed',
        beaches_count, success_count, error_count;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() IS 'Refreshes enhanced forecasts for active beaches. Fixed 2025-12-02: Changed latitude/longitude to lat/lon to match actual beach table column names.';



CREATE OR REPLACE FUNCTION "public"."refresh_mv_beach_amenities"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_beach_amenities;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_beach_amenities"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_mv_beach_amenities"() IS 'Performs a non-blocking REFRESH MATERIALIZED VIEW CONCURRENTLY on mv_beach_amenities. Called by the CCC sync service after each upsert cycle.';



CREATE OR REPLACE FUNCTION "public"."refresh_observable_beaches"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;
END;
$$;


ALTER FUNCTION "public"."refresh_observable_beaches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_custom_spot_favorite_on_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.favorite_beaches
    WHERE custom_spot_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."remove_custom_spot_favorite_on_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_entity"("table_name" "text", "entity_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
    sql_query TEXT;
    rows_affected INTEGER;
BEGIN
    -- Validate table name to prevent SQL injection
    IF table_name NOT IN ('beaches', 'sessions', 'beach_reviews', 'beach_photos', 'session_media') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;

    -- Build and execute restore query
    sql_query := format(
        'UPDATE public.%I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
        table_name
    );

    EXECUTE sql_query USING entity_id;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    RETURN rows_affected > 0;
END;
$_$;


ALTER FUNCTION "public"."restore_entity"("table_name" "text", "entity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_entity"("table_name" "text", "entity_id" "uuid") IS 'Helper function to restore soft-deleted entities. Returns true if entity was restored, false if not deleted or not found.';



CREATE OR REPLACE FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean DEFAULT true, "cleanup_buoys" boolean DEFAULT true, "update_stats" boolean DEFAULT true, "forecast_retention_days" integer DEFAULT 30, "buoy_inactive_days" integer DEFAULT 7) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    result JSON;
    forecasts_cleaned INTEGER := 0;
    buoys_cleaned INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Initialize result object
    result := '{"maintenance_started": "' || start_time || '", "operations": []}'::JSON;
    
    -- Clean up old forecasts
    IF cleanup_forecasts THEN
        forecasts_cleaned := cleanup_old_forecasts(forecast_retention_days);
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'forecast_cleanup',
                'records_affected', forecasts_cleaned,
                'retention_days', forecast_retention_days
            )
        )::JSON;
    END IF;
    
    -- Clean up inactive buoys
    IF cleanup_buoys THEN
        buoys_cleaned := cleanup_inactive_buoys(buoy_inactive_days);
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'buoy_cleanup',
                'records_affected', buoys_cleaned,
                'inactive_days', buoy_inactive_days
            )
        )::JSON;
    END IF;
    
    -- Update statistics
    IF update_stats THEN
        PERFORM update_forecast_table_stats();
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'statistics_update',
                'completed', true
            )
        )::JSON;
    END IF;
    
    -- Add completion info
    result := jsonb_set(
        result::JSONB, 
        '{maintenance_completed}', 
        to_jsonb(NOW())
    )::JSON;
    
    result := jsonb_set(
        result::JSONB, 
        '{duration_seconds}', 
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time)))
    )::JSON;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_audit_triggers_enabled"("enabled" boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    trigger_state TEXT;
    result_message TEXT;
BEGIN
    -- Only admins can disable audit triggers
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only administrators can modify audit trigger state';
    END IF;

    IF enabled THEN
        trigger_state := 'ENABLE';
        result_message := 'Audit triggers enabled';
    ELSE
        trigger_state := 'DISABLE';
        result_message := 'Audit triggers disabled (WARNING: Changes will not be logged!)';
    END IF;

    -- Enable/disable triggers on all tracked tables
    EXECUTE format('ALTER TABLE public.beach_reviews %s TRIGGER log_beach_reviews_changes', trigger_state);

    -- Handle beach_photos if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        EXECUTE format('ALTER TABLE public.beach_photos %s TRIGGER log_beach_photos_changes', trigger_state);
    END IF;

    -- Handle session_media if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        EXECUTE format('ALTER TABLE public.session_media %s TRIGGER log_session_media_changes', trigger_state);
    END IF;

    RETURN result_message;
END;
$$;


ALTER FUNCTION "public"."set_audit_triggers_enabled"("enabled" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_audit_triggers_enabled"("enabled" boolean) IS 'Enable or disable audit triggers. Only admins can call this function. Use with caution - disabling triggers means changes will not be logged.';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_updated_at"() IS 'Trigger function to automatically update updated_at timestamp. SECURITY: Protected with SET search_path = public.';



CREATE OR REPLACE FUNCTION "public"."soft_delete_entity"("table_name" "text", "entity_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
    sql_query TEXT;
    rows_affected INTEGER;
BEGIN
    -- Validate table name to prevent SQL injection
    IF table_name NOT IN ('beaches', 'sessions', 'beach_reviews', 'beach_photos', 'session_media') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;

    -- Build and execute soft delete query
    sql_query := format(
        'UPDATE public.%I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        table_name
    );

    EXECUTE sql_query USING entity_id;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    RETURN rows_affected > 0;
END;
$_$;


ALTER FUNCTION "public"."soft_delete_entity"("table_name" "text", "entity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_entity"("table_name" "text", "entity_id" "uuid") IS 'Helper function to soft delete entities. Returns true if entity was deleted, false if already deleted or not found.';



CREATE OR REPLACE FUNCTION "public"."swell_windows_overlap"("p_min1" numeric, "p_max1" numeric, "p_min2" numeric, "p_max2" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  min1 NUMERIC;
  max1 NUMERIC;
  min2 NUMERIC;
  max2 NUMERIC;
  span1 NUMERIC;
  span2 NUMERIC;
BEGIN
  IF p_min1 IS NULL OR p_max1 IS NULL OR p_min2 IS NULL OR p_max2 IS NULL THEN
    RETURN 0;
  END IF;

  min1 := ((p_min1 % 360) + 360) % 360;
  max1 := ((p_max1 % 360) + 360) % 360;
  min2 := ((p_min2 % 360) + 360) % 360;
  max2 := ((p_max2 % 360) + 360) % 360;

  span1 := CASE WHEN min1 <= max1 THEN max1 - min1 ELSE 360 - min1 + max1 END;
  span2 := CASE WHEN min2 <= max2 THEN max2 - min2 ELSE 360 - min2 + max2 END;

  IF span1 = 0 OR span2 = 0 THEN
    RETURN 0;
  END IF;

  IF span1 >= 360 THEN RETURN span2; END IF;
  IF span2 >= 360 THEN RETURN span1; END IF;

  RETURN CASE
    WHEN min1 <= max1 AND min2 <= max2 THEN
      GREATEST(0, LEAST(max1, max2) - GREATEST(min1, min2))
    WHEN min1 <= max1 AND min2 > max2 THEN
      GREATEST(0, LEAST(max1, 360) - GREATEST(min1, min2))
      + GREATEST(0, LEAST(max1, max2) - GREATEST(min1, 0))
    WHEN min1 > max1 AND min2 <= max2 THEN
      GREATEST(0, LEAST(360, max2) - GREATEST(min1, min2))
      + GREATEST(0, LEAST(max1, max2) - GREATEST(0, min2))
    ELSE
      GREATEST(0, 360 - GREATEST(min1, min2))
      + GREATEST(0, max2 - min1)
      + GREATEST(0, max1 - min2)
      + GREATEST(0, LEAST(max1, max2))
  END;
END;
$$;


ALTER FUNCTION "public"."swell_windows_overlap"("p_min1" numeric, "p_max1" numeric, "p_min2" numeric, "p_max2" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."swell_windows_overlap"("p_min1" numeric, "p_max1" numeric, "p_min2" numeric, "p_max2" numeric) IS 'Computes the angular overlap (in degrees) between two swell windows on a 0-360 circle. Handles wraparound (e.g. 350-10). Returns 0 for NULL or zero-width inputs.';



CREATE OR REPLACE FUNCTION "public"."sync_session_wave_observation_candidate"("p_session_id" "uuid", "p_user_id" "uuid", "p_beach_id" "uuid", "p_arrival_time" timestamp with time zone, "p_status" "text", "p_wave_height_ft" numeric, "p_source_created_by" "text" DEFAULT 'trigger'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  candidate_id uuid;
  observed_height_m numeric;
  rejection_reason_text text := NULL;
  nearest_prediction public.ml_predictions_log%rowtype;
  nearest_delta_minutes numeric;
  normalized_source_created_by text;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  normalized_source_created_by := CASE
    WHEN p_source_created_by = 'backfill' THEN 'backfill'
    ELSE 'trigger'
  END;

  IF p_status IS DISTINCT FROM 'completed' THEN
    rejection_reason_text := 'session_not_completed';
  ELSIF p_beach_id IS NULL THEN
    rejection_reason_text := 'missing_beach_id';
  ELSIF p_arrival_time IS NULL THEN
    rejection_reason_text := 'missing_arrival_time';
  ELSIF p_wave_height_ft IS NULL THEN
    rejection_reason_text := 'missing_wave_height_ft';
  ELSIF p_wave_height_ft <= 0 OR p_wave_height_ft > 50 THEN
    rejection_reason_text := 'invalid_wave_height_ft';
  END IF;

  IF rejection_reason_text IS NOT NULL THEN
    IF p_status IS DISTINCT FROM 'completed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.session_wave_observation_candidates existing
        WHERE existing.session_id = p_session_id
      )
    THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.session_wave_observation_candidates (
      session_id,
      user_id,
      beach_id,
      observed_at,
      reported_wave_height_ft,
      observed_m,
      ml_prediction_id,
      nearest_prediction_delta_minutes,
      quality_state,
      rejection_reason,
      observation_weight,
      source_created_by,
      matched_prediction_at,
      snapshot_display_height_m,
      snapshot_raw_om_height_m,
      snapshot_v5_shadow_height_m,
      snapshot_buoy_observed_m,
      snapshot_raw_forecast_m,
      snapshot_corrected_forecast_m,
      snapshot_model_version,
      snapshot_v5_model_version,
      snapshot_candidate_model_version,
      snapshot_display_source,
      forecast_horizon_hours
    ) VALUES (
      p_session_id,
      p_user_id,
      p_beach_id,
      p_arrival_time,
      p_wave_height_ft,
      NULL,
      NULL,
      NULL,
      'rejected',
      rejection_reason_text,
      0,
      normalized_source_created_by,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (session_id) DO UPDATE SET
      user_id = excluded.user_id,
      beach_id = excluded.beach_id,
      observed_at = excluded.observed_at,
      reported_wave_height_ft = excluded.reported_wave_height_ft,
      observed_m = NULL,
      ml_prediction_id = NULL,
      nearest_prediction_delta_minutes = NULL,
      quality_state = 'rejected',
      rejection_reason = excluded.rejection_reason,
      observation_weight = 0,
      matched_prediction_at = NULL,
      snapshot_display_height_m = NULL,
      snapshot_raw_om_height_m = NULL,
      snapshot_v5_shadow_height_m = NULL,
      snapshot_buoy_observed_m = NULL,
      snapshot_raw_forecast_m = NULL,
      snapshot_corrected_forecast_m = NULL,
      snapshot_model_version = NULL,
      snapshot_v5_model_version = NULL,
      snapshot_candidate_model_version = NULL,
      snapshot_display_source = NULL,
      forecast_horizon_hours = NULL,
      updated_at = now()
    RETURNING id INTO candidate_id;

    RETURN candidate_id;
  END IF;

  observed_height_m := round((p_wave_height_ft * 0.3048)::numeric, 3);

  SELECT p.*
  INTO nearest_prediction
  FROM public.ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.predicted_at IS NOT NULL
    AND p.predicted_at BETWEEN p_arrival_time - interval '6 hours'
                           AND p_arrival_time + interval '6 hours'
  ORDER BY abs(EXTRACT(EPOCH FROM (p.predicted_at - p_arrival_time))) ASC
  LIMIT 1;

  IF nearest_prediction.id IS NOT NULL THEN
    nearest_delta_minutes :=
      round((abs(EXTRACT(EPOCH FROM (nearest_prediction.predicted_at - p_arrival_time))) / 60.0)::numeric, 1);
  END IF;

  INSERT INTO public.session_wave_observation_candidates (
    session_id,
    user_id,
    beach_id,
    ml_prediction_id,
    observed_at,
    reported_wave_height_ft,
    observed_m,
    nearest_prediction_delta_minutes,
    quality_state,
    rejection_reason,
    observation_weight,
    source_created_by,
    matched_prediction_at,
    snapshot_display_height_m,
    snapshot_raw_om_height_m,
    snapshot_v5_shadow_height_m,
    snapshot_buoy_observed_m,
    snapshot_raw_forecast_m,
    snapshot_corrected_forecast_m,
    snapshot_model_version,
    snapshot_v5_model_version,
    snapshot_candidate_model_version,
    snapshot_display_source,
    forecast_horizon_hours
  ) VALUES (
    p_session_id,
    p_user_id,
    p_beach_id,
    nearest_prediction.id,
    p_arrival_time,
    p_wave_height_ft,
    observed_height_m,
    nearest_delta_minutes,
    'weak',
    CASE WHEN nearest_prediction.id IS NULL THEN 'no_matching_prediction' ELSE NULL END,
    0.2,
    normalized_source_created_by,
    nearest_prediction.predicted_at,
    coalesce(nearest_prediction.offset_corrected_display_height_m, nearest_prediction.raw_display_height_m, nearest_prediction.corrected_forecast_m, nearest_prediction.raw_forecast_m, nearest_prediction.wave_height_om),
    nearest_prediction.wave_height_om,
    nearest_prediction.v5_shadow_height_m,
    nearest_prediction.observed_m,
    nearest_prediction.raw_forecast_m,
    nearest_prediction.corrected_forecast_m,
    nearest_prediction.model_version,
    nearest_prediction.v5_model_version,
    nearest_prediction.candidate_model_version,
    nearest_prediction.display_source,
    nearest_prediction.forecast_horizon_hours
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = excluded.user_id,
    beach_id = excluded.beach_id,
    ml_prediction_id = excluded.ml_prediction_id,
    observed_at = excluded.observed_at,
    reported_wave_height_ft = excluded.reported_wave_height_ft,
    observed_m = excluded.observed_m,
    nearest_prediction_delta_minutes = excluded.nearest_prediction_delta_minutes,
    quality_state = 'weak',
    rejection_reason = excluded.rejection_reason,
    observation_weight = 0.2,
    matched_prediction_at = excluded.matched_prediction_at,
    snapshot_display_height_m = excluded.snapshot_display_height_m,
    snapshot_raw_om_height_m = excluded.snapshot_raw_om_height_m,
    snapshot_v5_shadow_height_m = excluded.snapshot_v5_shadow_height_m,
    snapshot_buoy_observed_m = excluded.snapshot_buoy_observed_m,
    snapshot_raw_forecast_m = excluded.snapshot_raw_forecast_m,
    snapshot_corrected_forecast_m = excluded.snapshot_corrected_forecast_m,
    snapshot_model_version = excluded.snapshot_model_version,
    snapshot_v5_model_version = excluded.snapshot_v5_model_version,
    snapshot_candidate_model_version = excluded.snapshot_candidate_model_version,
    snapshot_display_source = excluded.snapshot_display_source,
    forecast_horizon_hours = excluded.forecast_horizon_hours,
    updated_at = now()
  RETURNING id INTO candidate_id;

  RETURN candidate_id;
END;
$$;


ALTER FUNCTION "public"."sync_session_wave_observation_candidate"("p_session_id" "uuid", "p_user_id" "uuid", "p_beach_id" "uuid", "p_arrival_time" timestamp with time zone, "p_status" "text", "p_wave_height_ft" numeric, "p_source_created_by" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_session_wave_observation_candidate"("p_session_id" "uuid", "p_user_id" "uuid", "p_beach_id" "uuid", "p_arrival_time" timestamp with time zone, "p_status" "text", "p_wave_height_ft" numeric, "p_source_created_by" "text") IS 'Stores user-logged sessions.wave_height_ft as weak observation candidates matched to the nearest ml_predictions_log.predicted_at within +/- 6 hours. It snapshots model values for analytics and never updates ml_predictions_log.observed_m.';



CREATE OR REPLACE FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT public.toggle_favorite_spot_guarded(p_beach_id, NULL::uuid);
$$;


ALTER FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") IS 'Atomically toggles the authenticated user favorite for one beach and enforces the free plan 3-favorite cap using server-side user_entitlements.';



CREATE OR REPLACE FUNCTION "public"."toggle_favorite_spot_guarded"("p_beach_id" "uuid" DEFAULT NULL::"uuid", "p_custom_spot_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_id uuid;
  favorite_count integer;
  next_rank integer;
  has_unlimited_favorites boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (p_beach_id IS NULL) = (p_custom_spot_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_favorite_target'
      USING DETAIL = 'exactly_one_target_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);

  IF p_custom_spot_id IS NOT NULL THEN
    PERFORM 1
    FROM public.custom_spots cs
    WHERE cs.id = p_custom_spot_id
      AND cs.user_id = current_user_id
      AND cs.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'custom_spot_not_found'
        USING DETAIL = 'custom_spot_not_owned_or_deleted';
    END IF;

    SELECT id INTO existing_id
    FROM public.favorite_beaches
    WHERE user_id = current_user_id
      AND custom_spot_id = p_custom_spot_id
    LIMIT 1;
  ELSE
    SELECT id INTO existing_id
    FROM public.favorite_beaches
    WHERE user_id = current_user_id
      AND beach_id = p_beach_id
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    DELETE FROM public.favorite_beaches
    WHERE id = existing_id
      AND user_id = current_user_id;
    RETURN 'removed';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements ue
    WHERE ue.user_id = current_user_id
      AND (ue.is_pro = true OR ue.is_trialing = true)
      AND (
        ue.expires_at IS NULL
        OR ue.expires_at > now()
        OR ue.billing_issue = true
      )
  ) INTO has_unlimited_favorites;

  SELECT count(*) INTO favorite_count
  FROM public.favorite_beaches
  WHERE user_id = current_user_id;

  IF NOT has_unlimited_favorites AND favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING DETAIL = 'free_favorites_limit';
  END IF;

  SELECT COALESCE(max(rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches
  WHERE user_id = current_user_id;

  INSERT INTO public.favorite_beaches (
    user_id,
    beach_id,
    custom_spot_id,
    rank,
    alerts_enabled
  )
  VALUES (
    current_user_id,
    p_beach_id,
    p_custom_spot_id,
    next_rank,
    false
  );

  RETURN 'added';
END;
$$;


ALTER FUNCTION "public"."toggle_favorite_spot_guarded"("p_beach_id" "uuid", "p_custom_spot_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_session_media_upload"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_user_storage_usage(NEW.user_id, NEW.file_size, 1);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_user_storage_usage(OLD.user_id, -OLD.file_size, -1);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."track_session_media_upload"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."track_session_media_upload"() IS 'Trigger function that automatically updates storage_usage when session_media records are inserted or deleted';



CREATE OR REPLACE FUNCTION "public"."trigger_manual_maintenance"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    result JSON;
BEGIN
    -- Run standard maintenance
    result := run_database_maintenance(true, true, true, 30, 7);
    
    -- Add manual trigger timestamp
    result := jsonb_set(
        result::JSONB,
        '{trigger_type}',
        '"manual"'::JSONB
    )::JSON;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."trigger_manual_maintenance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_insert_similarity_alert"("p_user_id" "uuid", "p_rule_id" "uuid", "p_beach_id" "uuid", "p_alert_date" "date", "p_send_at" timestamp with time zone, "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_best_hour" timestamp with time zone, "p_conditions_snapshot" "jsonb") RETURNS TABLE("inserted" boolean, "alert_queue_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$ DECLARE v_id uuid; BEGIN IF (p_conditions_snapshot->>'alert_type') IS DISTINCT FROM 'similarity_match' THEN RAISE EXCEPTION 'try_insert_similarity_alert requires conditions_snapshot.alert_type = similarity_match (got: %)', coalesce(p_conditions_snapshot->>'alert_type', '<null>'); END IF; INSERT INTO alert_queue (user_id, rule_id, beach_id, alert_date, send_at, window_start, window_end, best_hour, conditions_snapshot, sent) VALUES (p_user_id, p_rule_id, p_beach_id, p_alert_date, p_send_at, p_window_start, p_window_end, p_best_hour, p_conditions_snapshot, false) ON CONFLICT (user_id, alert_date) WHERE (conditions_snapshot->>'alert_type') = 'similarity_match' DO NOTHING RETURNING id INTO v_id; IF v_id IS NULL THEN RETURN QUERY SELECT false, NULL::uuid; ELSE RETURN QUERY SELECT true, v_id; END IF; END; $$;


ALTER FUNCTION "public"."try_insert_similarity_alert"("p_user_id" "uuid", "p_rule_id" "uuid", "p_beach_id" "uuid", "p_alert_date" "date", "p_send_at" timestamp with time zone, "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_best_hour" timestamp with time zone, "p_conditions_snapshot" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."try_insert_similarity_alert"("p_user_id" "uuid", "p_rule_id" "uuid", "p_beach_id" "uuid", "p_alert_date" "date", "p_send_at" timestamp with time zone, "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_best_hour" timestamp with time zone, "p_conditions_snapshot" "jsonb") IS 'Idempotent insert of a similarity_match alert_queue row. Returns inserted=true on success, inserted=false if the partial unique index alert_queue_one_similarity_per_user_day fired (already an alert for this user/date). Caller MUST stamp conditions_snapshot.alert_type=similarity_match.';



CREATE OR REPLACE FUNCTION "public"."update_beach_affinity_on_session_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
    SELECT
      NEW.user_id,
      NEW.beach_id,
      COUNT(*),
      MAX(arrival_time),
      compute_beach_affinity(NEW.user_id, NEW.beach_id)
    FROM sessions
    WHERE user_id = NEW.user_id AND beach_id = NEW.beach_id
    GROUP BY user_id, beach_id
    ON CONFLICT (user_id, beach_id) DO UPDATE SET
      session_count = EXCLUDED.session_count,
      last_surfed_at = EXCLUDED.last_surfed_at,
      affinity_score = EXCLUDED.affinity_score,
      computed_at = NOW();
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_beach_affinity
    WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    AND NOT EXISTS (
      SELECT 1 FROM sessions
      WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    );
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_beach_affinity_on_session_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_beach_affinity_on_session_change"() IS 'Trigger function that automatically updates beach affinity when sessions are added, modified, or deleted. Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."update_beach_coordinates"("p_beach_id" "uuid", "p_longitude" double precision, "p_latitude" double precision) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  update public.beaches
  set coordinates = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
  where id = p_beach_id;
end;
$$;


ALTER FUNCTION "public"."update_beach_coordinates"("p_beach_id" "uuid", "p_longitude" double precision, "p_latitude" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_beach_coordinates"("p_beach_id" "uuid", "p_longitude" double precision, "p_latitude" double precision) IS 'Updates beach coordinates geography field from lat/lon values. Used by data import scripts.';



CREATE OR REPLACE FUNCTION "public"."update_beach_daily_intel_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_beach_daily_intel_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_beach_editorial_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_beach_editorial_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_city_editorial_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_city_editorial_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_spots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "lat" numeric(9,6) NOT NULL,
    "lon" numeric(9,6) NOT NULL,
    "break_type" "text",
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nearest_beach_id" "uuid",
    "nearest_beach_distance_mi" numeric(5,2),
    "deleted_at" timestamp with time zone,
    "facing_direction_deg" numeric,
    "swell_window_min_deg" numeric,
    "swell_window_max_deg" numeric,
    "offshore_direction_deg" numeric,
    "exposure_level" "text",
    "fingerprint_confidence" "text",
    "fingerprint_updated_at" timestamp with time zone,
    CONSTRAINT "custom_spots_break_type" CHECK ((("break_type" IS NULL) OR ("break_type" = ANY (ARRAY['reef'::"text", 'point'::"text", 'beach'::"text", 'rivermouth'::"text", 'jetty'::"text"])))),
    CONSTRAINT "custom_spots_exposure_level_check" CHECK ((("exposure_level" IS NULL) OR ("exposure_level" = ANY (ARRAY['sheltered'::"text", 'mixed'::"text", 'exposed'::"text"])))),
    CONSTRAINT "custom_spots_facing_direction_deg_range" CHECK ((("facing_direction_deg" IS NULL) OR (("facing_direction_deg" >= (0)::numeric) AND ("facing_direction_deg" < (360)::numeric)))),
    CONSTRAINT "custom_spots_fingerprint_confidence_check" CHECK ((("fingerprint_confidence" IS NULL) OR ("fingerprint_confidence" = ANY (ARRAY['unset'::"text", 'user_set'::"text", 'calibrating'::"text", 'modeled'::"text"])))),
    CONSTRAINT "custom_spots_lat_range" CHECK ((("lat" >= ('-90'::integer)::numeric) AND ("lat" <= (90)::numeric))),
    CONSTRAINT "custom_spots_lon_range" CHECK ((("lon" >= ('-180'::integer)::numeric) AND ("lon" <= (180)::numeric))),
    CONSTRAINT "custom_spots_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60))),
    CONSTRAINT "custom_spots_offshore_direction_deg_range" CHECK ((("offshore_direction_deg" IS NULL) OR (("offshore_direction_deg" >= (0)::numeric) AND ("offshore_direction_deg" < (360)::numeric)))),
    CONSTRAINT "custom_spots_swell_window_max_deg_range" CHECK ((("swell_window_max_deg" IS NULL) OR (("swell_window_max_deg" >= (0)::numeric) AND ("swell_window_max_deg" < (360)::numeric)))),
    CONSTRAINT "custom_spots_swell_window_min_deg_range" CHECK ((("swell_window_min_deg" IS NULL) OR (("swell_window_min_deg" >= (0)::numeric) AND ("swell_window_min_deg" < (360)::numeric)))),
    CONSTRAINT "custom_spots_visibility" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."custom_spots" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_spots" IS 'User-authored surf breaks not present in the curated beaches table. Forecast is raw NOAA gridpoint at the pin (approximate). Visibility: private (owner-only) or public (discoverable within 5 mi, UI pending).';



COMMENT ON COLUMN "public"."custom_spots"."lat" IS 'Latitude in decimal degrees, WGS-84.';



COMMENT ON COLUMN "public"."custom_spots"."lon" IS 'Longitude in decimal degrees, WGS-84.';



COMMENT ON COLUMN "public"."custom_spots"."visibility" IS 'private = owner-only read. public = anyone-read (discovery UI lands later).';



COMMENT ON COLUMN "public"."custom_spots"."updated_at" IS 'Auto-maintained by custom_spots_lock_user_id trigger on UPDATE.';



COMMENT ON COLUMN "public"."custom_spots"."facing_direction_deg" IS 'User-set break-facing direction in degrees. Null means local rules are unset.';



COMMENT ON COLUMN "public"."custom_spots"."swell_window_min_deg" IS 'User-set lower bound of useful incoming swell window in degrees.';



COMMENT ON COLUMN "public"."custom_spots"."swell_window_max_deg" IS 'User-set upper bound of useful incoming swell window in degrees.';



COMMENT ON COLUMN "public"."custom_spots"."offshore_direction_deg" IS 'User-set offshore wind direction in degrees.';



COMMENT ON COLUMN "public"."custom_spots"."exposure_level" IS 'User-set custom spot exposure: sheltered, mixed, or exposed.';



COMMENT ON COLUMN "public"."custom_spots"."fingerprint_confidence" IS 'Fingerprint state for custom spots: unset, user_set, calibrating, modeled.';



CREATE OR REPLACE FUNCTION "public"."update_custom_spot_fingerprint"("p_spot_id" "uuid", "p_facing_direction_deg" numeric DEFAULT NULL::numeric, "p_swell_window_min_deg" numeric DEFAULT NULL::numeric, "p_swell_window_max_deg" numeric DEFAULT NULL::numeric, "p_offshore_direction_deg" numeric DEFAULT NULL::numeric, "p_exposure_level" "text" DEFAULT NULL::"text") RETURNS "public"."custom_spots"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  updated_spot public.custom_spots%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_exposure_level IS NOT NULL
     AND p_exposure_level <> ALL (ARRAY['sheltered','mixed','exposed']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_exposure'
      USING DETAIL = 'unsupported_exposure_level';
  END IF;

  UPDATE public.custom_spots
  SET
    facing_direction_deg = p_facing_direction_deg,
    swell_window_min_deg = p_swell_window_min_deg,
    swell_window_max_deg = p_swell_window_max_deg,
    offshore_direction_deg = p_offshore_direction_deg,
    exposure_level = p_exposure_level,
    fingerprint_confidence = CASE
      WHEN p_facing_direction_deg IS NULL
        AND p_swell_window_min_deg IS NULL
        AND p_swell_window_max_deg IS NULL
        AND p_offshore_direction_deg IS NULL
        AND p_exposure_level IS NULL
      THEN 'unset'
      ELSE 'user_set'
    END,
    fingerprint_updated_at = now()
  WHERE id = p_spot_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  RETURNING * INTO updated_spot;

  IF updated_spot.id IS NULL THEN
    RAISE EXCEPTION 'custom_spot_not_found';
  END IF;

  RETURN updated_spot;
END;
$$;


ALTER FUNCTION "public"."update_custom_spot_fingerprint"("p_spot_id" "uuid", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_follow_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment follower count for the user being followed
        UPDATE public.profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        -- Increment following count for the user doing the following
        UPDATE public.profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement follower count for the user being unfollowed
        UPDATE public.profiles 
        SET followers_count = GREATEST(0, followers_count - 1) 
        WHERE id = OLD.following_id;
        
        -- Decrement following count for the user doing the unfollowing
        UPDATE public.profiles 
        SET following_count = GREATEST(0, following_count - 1) 
        WHERE id = OLD.follower_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_follow_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_forecast_table_stats"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    -- Update table statistics for better query planning
    ANALYZE public.enhanced_forecasts;
    ANALYZE public.buoys;
    ANALYZE public.beaches;
    ANALYZE public.spot_feedback;
    
    -- Log the update
    RAISE NOTICE 'Database statistics updated for forecast tables at %', NOW();
END;
$$;


ALTER FUNCTION "public"."update_forecast_table_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intel_confirmations_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = confirmations_count + 1 
        WHERE id = NEW.intel_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = GREATEST(confirmations_count - 1, 0) 
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_intel_confirmations_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intel_report_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    v_trust_score       NUMERIC(4,3);
    v_hide_threshold    INTEGER;
    v_new_report_count  INTEGER;
    v_post_user_id      UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Atomically increment and capture the post-increment count in one
        -- statement. RETURNING guarantees v_new_report_count reflects the value
        -- committed by *this* UPDATE, not a concurrent one.
        UPDATE public.intel_posts
        SET    report_count = report_count + 1,
               updated_at   = now()
        WHERE  id = NEW.intel_post_id
        RETURNING report_count, user_id
            INTO v_new_report_count, v_post_user_id;

        -- Only apply auto-hide logic on INSERT (new report added).
        -- Fetch the author's trust score to determine the appropriate threshold.
        SELECT COALESCE(p.trust_score, 0.400)
        INTO   v_trust_score
        FROM   public.profiles p
        WHERE  p.id = v_post_user_id;

        v_hide_threshold := CASE WHEN v_trust_score < 0.3 THEN 2 ELSE 3 END;

        -- Evaluate threshold against the RETURNING'd count (atomic with the
        -- increment above), not a second read that a concurrent session could
        -- have already changed.
        IF v_new_report_count >= v_hide_threshold THEN
            UPDATE public.intel_posts
            SET    is_active  = false,
                   updated_at = now()
            WHERE  id = NEW.intel_post_id
              AND  is_active = true;   -- idempotent guard
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement on report retraction. No auto-show logic required here;
        -- moderator action is needed to restore a hidden post.
        UPDATE public.intel_posts
        SET    report_count = GREATEST(0, report_count - 1),
               updated_at   = now()
        WHERE  id = OLD.intel_post_id;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_intel_report_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intel_vote_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts
        SET
            helpful_count      = helpful_count   + CASE WHEN NEW.vote_type = 'helpful'   THEN 1 ELSE 0 END,
            off_count          = off_count       + CASE WHEN NEW.vote_type = 'off'        THEN 1 ELSE 0 END,
            confirmed_count    = confirmed_count + CASE WHEN NEW.vote_type = 'confirmed'  THEN 1 ELSE 0 END,
            confirmations_count = confirmations_count + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
            updated_at         = now()
        WHERE id = NEW.intel_post_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET
            helpful_count      = GREATEST(0, helpful_count   - CASE WHEN OLD.vote_type = 'helpful'   THEN 1 ELSE 0 END),
            off_count          = GREATEST(0, off_count       - CASE WHEN OLD.vote_type = 'off'        THEN 1 ELSE 0 END),
            confirmed_count    = GREATEST(0, confirmed_count - CASE WHEN OLD.vote_type = 'confirmed'  THEN 1 ELSE 0 END),
            confirmations_count = GREATEST(0, confirmations_count - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END),
            updated_at         = now()
        WHERE id = OLD.intel_post_id;

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.vote_type IS DISTINCT FROM NEW.vote_type THEN
            UPDATE public.intel_posts
            SET
                helpful_count   = GREATEST(0, helpful_count   - CASE WHEN OLD.vote_type = 'helpful'  THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'helpful'  THEN 1 ELSE 0 END,
                off_count       = GREATEST(0, off_count       - CASE WHEN OLD.vote_type = 'off'       THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'off'       THEN 1 ELSE 0 END,
                confirmed_count = GREATEST(0, confirmed_count - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
                confirmations_count = GREATEST(0, confirmations_count
                                        - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END)
                                        + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
                updated_at      = now()
            WHERE id = NEW.intel_post_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_intel_vote_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ioos_station_coordinates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.coordinates := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ioos_station_coordinates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ml_model_registry_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ml_model_registry_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ndbc_direct_station_coordinates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.coordinates := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ndbc_direct_station_coordinates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ndbc_direct_station_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ndbc_direct_station_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_npc_template_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_npc_template_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_helpful_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.beach_reviews 
        SET helpful_count = helpful_count + 1 
        WHERE id = NEW.review_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.beach_reviews 
        SET helpful_count = GREATEST(helpful_count - 1, 0) 
        WHERE id = OLD.review_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_review_helpful_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.sessions 
    set comments_count = comments_count + 1 
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sessions 
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.session_id;
    return old;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."update_session_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.sessions 
    set likes_count = likes_count + 1 
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.sessions 
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.session_id;
    return old;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."update_session_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_email_prefs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_user_email_prefs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_storage_usage"("p_user_id" "uuid", "p_bytes_to_add" integer, "p_images_to_add" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.storage_usage (user_id, total_bytes, image_count, last_updated)
  VALUES (
    p_user_id,
    GREATEST(0, p_bytes_to_add),
    GREATEST(0, p_images_to_add),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_bytes = GREATEST(0, public.storage_usage.total_bytes + p_bytes_to_add),
    image_count = GREATEST(0, public.storage_usage.image_count + p_images_to_add),
    last_updated = NOW();
END;
$$;


ALTER FUNCTION "public"."update_user_storage_usage"("p_user_id" "uuid", "p_bytes_to_add" integer, "p_images_to_add" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_storage_usage"("p_user_id" "uuid", "p_bytes_to_add" integer, "p_images_to_add" integer) IS 'Updates user storage usage tracking. Called after successful file upload. Supports negative values for deletion.';



CREATE TABLE IF NOT EXISTS "maintenance"."omg_history_move_backup_20260511" (
    "backup_id" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "row_data" "jsonb" NOT NULL,
    "backed_up_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "maintenance"."omg_history_move_backup_20260511" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "city" "text",
    "is_private" boolean DEFAULT false NOT NULL,
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "state" "text",
    "country" "text",
    "break_type" "text",
    "hazards" "text"[] DEFAULT '{}'::"text"[],
    "skill_level" "text",
    "swell_window_min_deg" smallint,
    "swell_window_max_deg" smallint,
    "wind_offshore_deg" smallint,
    "wind_offshore_tol_deg" smallint DEFAULT 30,
    "wind_cross_shore_ok_kt" smallint DEFAULT 10,
    "wind_onshore_bad_kt" smallint DEFAULT 8,
    "preferred_tide_ft_min" numeric,
    "preferred_tide_ft_max" numeric,
    "preference_model" "jsonb",
    "aspect_deg" integer,
    "swell_window_center_deg" integer,
    "swell_window_halfwidth_deg" integer,
    "features" "text"[],
    "parking_tips" "text",
    "access_tips" "text",
    "wave_tips" "text",
    "crowd_tips" "text",
    "best_conditions_prose" "text",
    "warnings" "text"[],
    "local_etiquette" "text",
    "crowd_level" "text",
    "description" "text",
    "real_takeaways" "text"[],
    "best_months" integer[],
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "deleted_at" timestamp with time zone,
    "average_rating" numeric,
    "review_count" integer DEFAULT 0,
    "slug" "text",
    "region" "text",
    "geog" "public"."geography"(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN (("lat" IS NOT NULL) AND ("lon" IS NOT NULL)) THEN ("public"."st_setsrid"("public"."st_makepoint"("lon", "lat"), 4326))::"public"."geography"
    ELSE NULL::"public"."geography"
END) STORED,
    "cdip_station" "text",
    "timezone" "text" DEFAULT 'America/Los_Angeles'::"text",
    "preferred_tide_direction" "text",
    "tide_direction_sensitivity" "text",
    "wind_exposure_factors" real[],
    "swell_access_factors" real[],
    "terrain_method" "text",
    "terrain_params" "jsonb",
    "terrain_params_hash" "text",
    "terrain_analyzed_at" timestamp with time zone,
    "wind_analyzed_at" timestamp with time zone,
    "swell_analyzed_at" timestamp with time zone,
    "terrain_status" "text",
    "terrain_enabled" boolean DEFAULT false NOT NULL,
    "terrain_analysis_debug" "jsonb",
    "cdip_eligible" boolean DEFAULT false NOT NULL,
    "shoaling_factors" "jsonb",
    "persona" "public"."beach_persona",
    "deepwater_decay_factor" real DEFAULT 1.0,
    "height_offset_enabled" boolean DEFAULT false NOT NULL,
    "height_offset_min_sample_count" integer DEFAULT 30 NOT NULL,
    "height_offset_max_age_days" integer DEFAULT 14 NOT NULL,
    CONSTRAINT "beaches_preferred_tide_direction_check" CHECK (("preferred_tide_direction" = ANY (ARRAY['rising'::"text", 'falling'::"text", 'either'::"text", 'slack'::"text"]))),
    CONSTRAINT "beaches_tide_direction_sensitivity_check" CHECK ((("tide_direction_sensitivity" IS NULL) OR ("tide_direction_sensitivity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))),
    CONSTRAINT "chk_beaches_aspect_range" CHECK ((("aspect_deg" IS NULL) OR (("aspect_deg" >= 0) AND ("aspect_deg" < 360)))),
    CONSTRAINT "chk_beaches_lat_range" CHECK ((("lat" >= ('-90'::integer)::double precision) AND ("lat" <= (90)::double precision))),
    CONSTRAINT "chk_beaches_lon_range" CHECK ((("lon" >= ('-180'::integer)::double precision) AND ("lon" <= (180)::double precision))),
    CONSTRAINT "chk_beaches_not_null_island" CHECK ((("lat" <> (0)::double precision) OR ("lon" <> (0)::double precision))),
    CONSTRAINT "chk_beaches_swell_halfwidth_range" CHECK ((("swell_window_halfwidth_deg" IS NULL) OR (("swell_window_halfwidth_deg" >= 0) AND ("swell_window_halfwidth_deg" <= 180)))),
    CONSTRAINT "chk_beaches_swell_window_range" CHECK (((("swell_window_min_deg" IS NULL) OR (("swell_window_min_deg" >= 0) AND ("swell_window_min_deg" < 360))) AND (("swell_window_max_deg" IS NULL) OR (("swell_window_max_deg" >= 0) AND ("swell_window_max_deg" < 360))) AND (("swell_window_center_deg" IS NULL) OR (("swell_window_center_deg" >= 0) AND ("swell_window_center_deg" < 360))))),
    CONSTRAINT "chk_beaches_tide_range" CHECK (((("preferred_tide_ft_min" IS NULL) OR ("preferred_tide_ft_min" >= ('-5'::integer)::numeric)) AND (("preferred_tide_ft_max" IS NULL) OR ("preferred_tide_ft_max" <= (15)::numeric)) AND (("preferred_tide_ft_min" IS NULL) OR ("preferred_tide_ft_max" IS NULL) OR ("preferred_tide_ft_min" <= "preferred_tide_ft_max")))),
    CONSTRAINT "chk_beaches_wind_offshore_range" CHECK ((("wind_offshore_deg" IS NULL) OR (("wind_offshore_deg" >= 0) AND ("wind_offshore_deg" < 360)))),
    CONSTRAINT "chk_beaches_wind_speeds_positive" CHECK (((("wind_cross_shore_ok_kt" IS NULL) OR ("wind_cross_shore_ok_kt" >= 0)) AND (("wind_onshore_bad_kt" IS NULL) OR ("wind_onshore_bad_kt" >= 0)) AND (("wind_offshore_tol_deg" IS NULL) OR ("wind_offshore_tol_deg" >= 0)))),
    CONSTRAINT "chk_country_format" CHECK (("country" <> 'US'::"text")),
    CONSTRAINT "swell_access_len" CHECK ((("swell_access_factors" IS NULL) OR ("array_length"("swell_access_factors", 1) = 72))),
    CONSTRAINT "terrain_status_valid" CHECK ((("terrain_status" IS NULL) OR ("terrain_status" = ANY (ARRAY['ok'::"text", 'wind_only'::"text", 'failed'::"text"])))),
    CONSTRAINT "wind_exposure_len" CHECK ((("wind_exposure_factors" IS NULL) OR ("array_length"("wind_exposure_factors", 1) = 72)))
);


ALTER TABLE "public"."beaches" OWNER TO "postgres";


COMMENT ON TABLE "public"."beaches" IS 'Surf spots/beaches. Public beaches (is_private=false) are readable by all. Private beaches (is_private=true) are only accessible to their owner.';



COMMENT ON COLUMN "public"."beaches"."city" IS 'City or locality where the beach is located';



COMMENT ON COLUMN "public"."beaches"."state" IS 'State, province, or region (e.g., CA, Baja California)';



COMMENT ON COLUMN "public"."beaches"."break_type" IS 'Primary break type (e.g., beach, point, reef)';



COMMENT ON COLUMN "public"."beaches"."wind_offshore_deg" IS 'Optimal offshore wind direction in degrees (0-360)';



COMMENT ON COLUMN "public"."beaches"."wind_cross_shore_ok_kt" IS 'Maximum acceptable cross-shore wind speed in knots';



COMMENT ON COLUMN "public"."beaches"."wind_onshore_bad_kt" IS 'Minimum onshore wind speed that degrades conditions (knots)';



COMMENT ON COLUMN "public"."beaches"."preferred_tide_ft_min" IS 'Minimum preferred tide height in feet';



COMMENT ON COLUMN "public"."beaches"."preferred_tide_ft_max" IS 'Maximum preferred tide height in feet';



COMMENT ON COLUMN "public"."beaches"."aspect_deg" IS 'Shoreline aspect in degrees (0-360, where 0=North)';



COMMENT ON COLUMN "public"."beaches"."swell_window_center_deg" IS 'Center direction of swell window (0-360)';



COMMENT ON COLUMN "public"."beaches"."swell_window_halfwidth_deg" IS 'Half-width of acceptable swell window in degrees';



COMMENT ON COLUMN "public"."beaches"."features" IS 'Feature tags for filtering (e.g., "Beginner friendly", "Lifeguard on duty")';



COMMENT ON COLUMN "public"."beaches"."best_conditions_prose" IS 'Human-readable best conditions (e.g., "Mid tide with offshore winds")';



COMMENT ON COLUMN "public"."beaches"."warnings" IS 'Safety warnings and hazards';



COMMENT ON COLUMN "public"."beaches"."real_takeaways" IS 'Emoji-prefixed local tips';



COMMENT ON COLUMN "public"."beaches"."lat" IS 'Latitude in decimal degrees (-90 to 90)';



COMMENT ON COLUMN "public"."beaches"."lon" IS 'Longitude in decimal degrees (-180 to 180)';



COMMENT ON COLUMN "public"."beaches"."deleted_at" IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';



COMMENT ON COLUMN "public"."beaches"."average_rating" IS 'Average overall rating from beach reviews (1-5 scale)';



COMMENT ON COLUMN "public"."beaches"."review_count" IS 'Total number of reviews for this beach';



COMMENT ON COLUMN "public"."beaches"."slug" IS 'URL-friendly unique identifier for the beach';



COMMENT ON COLUMN "public"."beaches"."timezone" IS 'IANA timezone for forecast timestamp conversion (e.g., America/Los_Angeles)';



COMMENT ON COLUMN "public"."beaches"."preferred_tide_direction" IS 'Optimal tide movement for this beach: rising (incoming), falling (outgoing), slack, or either. NULL means unknown.';



COMMENT ON COLUMN "public"."beaches"."tide_direction_sensitivity" IS 'Override for tide direction sensitivity. NULL = derive from break_type. low/medium/high = explicit override.';



COMMENT ON COLUMN "public"."beaches"."wind_exposure_factors" IS 'Directional wind exposure factors as 72-element array (5° bins: 0°, 5°, 10°... 355°). 1.0 = fully exposed, 0.0 = fully sheltered.';



COMMENT ON COLUMN "public"."beaches"."swell_access_factors" IS 'Directional swell access factors as 72-element array (5° bins). Includes direct + wrap-around effects. 1.0 = fully accessible, 0.0 = fully blocked.';



COMMENT ON COLUMN "public"."beaches"."terrain_method" IS 'Terrain analysis method identifier (e.g., ''dem_horizon_v1'') for cache invalidation and reproducibility.';



COMMENT ON COLUMN "public"."beaches"."terrain_params" IS 'Analysis parameters as JSONB (e.g., {radius_km: 50, step_m: 100, dem_source: "SRTM", resolution_m: 30}).';



COMMENT ON COLUMN "public"."beaches"."terrain_params_hash" IS 'SHA256 hash of canonical terrain_params JSON for fast cache validation without full JSON comparison.';



COMMENT ON COLUMN "public"."beaches"."terrain_analyzed_at" IS 'Timestamp when terrain analysis was completed (covers both wind and swell if terrain_status = ''ok'').';



COMMENT ON COLUMN "public"."beaches"."wind_analyzed_at" IS 'Timestamp when wind exposure analysis specifically completed.';



COMMENT ON COLUMN "public"."beaches"."swell_analyzed_at" IS 'Timestamp when swell access analysis specifically completed.';



COMMENT ON COLUMN "public"."beaches"."terrain_status" IS 'Analysis completion status: ''ok'' (both complete), ''wind_only'' (swell pending/failed), ''failed'' (analysis failed).';



COMMENT ON COLUMN "public"."beaches"."terrain_enabled" IS 'Feature flag for staged rollout. When true, terrain factors are used in scoring calculations.';



COMMENT ON COLUMN "public"."beaches"."terrain_analysis_debug" IS 'Optional debug data (horizon angles, headland detection, etc.) for visualization and troubleshooting. Not used in query hot path.';



COMMENT ON COLUMN "public"."beaches"."cdip_eligible" IS 'True if beach is within CDIP station coverage range (typically 50-150km depending on station). Computed by backfill script based on haversine distance to nearest active CDIP station.';



COMMENT ON COLUMN "public"."beaches"."shoaling_factors" IS 'Optional empirically calibrated period-keyed shoaling factor lookup.
Shape: {version: 1, type: "period_lookup", buckets: [{tp_min_s, tp_max_s, factor}], calibration: {...}}.
When set AND the upstream input source is CDIP significant height, the
wave-height transformer bypasses its generic base*period*direction pipeline
and multiplies raw Hs by the matching bucket factor directly. See migration
20260407134519 for the research methodology.';



COMMENT ON COLUMN "public"."beaches"."persona" IS 'Physics-based archetype: sheltered_reef, exposed_beach_break, canyon_amplified, point_break, or jetty_harbor.';



COMMENT ON COLUMN "public"."beaches"."deepwater_decay_factor" IS 'Energy ratio from deep-water model grid to nearshore face height. 0.4 = heavy sheltering, 1.0 = fully exposed (default), 1.15+ = canyon amplification.';



COMMENT ON COLUMN "public"."beaches"."height_offset_enabled" IS 'When true, forecast-builder applies the matching beach_height_offsets row (source=display) to display wave heights for forecasts with horizon >= 24h.';



COMMENT ON COLUMN "public"."beaches"."height_offset_min_sample_count" IS 'Minimum matched (raw_display_height_m, observed_m) samples required in the rolling window before applying offset. Default 30.';



COMMENT ON COLUMN "public"."beaches"."height_offset_max_age_days" IS 'Offset is ignored if computed_at is older than this many days. Default 14.';



CREATE OR REPLACE VIEW "posthog_export"."beaches" AS
 SELECT "beaches"."id",
    "beaches"."name",
    "beaches"."city",
    "beaches"."state",
    "beaches"."country",
    "beaches"."region",
    "beaches"."slug",
    "beaches"."lat",
    "beaches"."lon",
    "beaches"."break_type",
    "beaches"."skill_level",
    "beaches"."crowd_level",
    "beaches"."average_rating",
    "beaches"."review_count",
    "beaches"."is_private",
    "beaches"."created_at",
    "beaches"."timezone"
   FROM "public"."beaches"
  WHERE (("beaches"."deleted_at" IS NULL) AND (COALESCE("beaches"."is_private", false) = false));


ALTER TABLE "posthog_export"."beaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_send_log" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_type" "text" NOT NULL,
    "local_date" "date" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subject" "text" NOT NULL,
    "best_score" numeric,
    "best_beach_id" "uuid",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "resend_message_id" "text",
    "delivered_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "bounced_at" timestamp with time zone,
    CONSTRAINT "email_send_log_email_type_check" CHECK (("email_type" = ANY (ARRAY['welcome'::"text", 'forecast_digest'::"text", 'reengagement'::"text", 'weekly_recap'::"text", 'conditions_alert'::"text", 'session_prompt'::"text", 'first_session_nudge'::"text"])))
);


ALTER TABLE "public"."email_send_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_send_log" IS 'Log of all emails sent to users for deduplication and analytics';



COMMENT ON COLUMN "public"."email_send_log"."email_type" IS 'Type of email sent: welcome, daily_best_window, heads_up_alert, condition_alert, reengagement, weekly_recap, weekend_outlook';



COMMENT ON CONSTRAINT "email_send_log_email_type_check" ON "public"."email_send_log" IS 'Allowed email types: welcome, forecast_digest, reengagement, weekly_recap, conditions_alert, session_prompt, first_session_nudge';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_session_invites" boolean DEFAULT true NOT NULL,
    "inapp_session_invites" boolean DEFAULT true NOT NULL,
    "digest_session_invites" boolean DEFAULT false NOT NULL,
    "followers_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "is_mock" boolean DEFAULT false NOT NULL,
    "avatar_url" "text",
    "email" "text",
    "phone_number" "text",
    "bio" "text",
    "location" "text",
    "experience_level" "text",
    "instagram" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "home_beach_id" "uuid",
    "onboarding_completed_at" timestamp with time zone,
    "notif_push_enabled" boolean DEFAULT false NOT NULL,
    "notif_email_enabled" boolean DEFAULT true NOT NULL,
    "notif_inapp_enabled" boolean DEFAULT true NOT NULL,
    "notif_session_invites" boolean DEFAULT true NOT NULL,
    "notif_likes" boolean DEFAULT true NOT NULL,
    "notif_follows" boolean DEFAULT true NOT NULL,
    "notif_reminders" boolean DEFAULT true NOT NULL,
    "notif_xp_updates" boolean DEFAULT true NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "display_name" "text",
    "surf_styles" "text"[],
    "referral_code" "text",
    "preferences_v2_shown_at" timestamp with time zone,
    "notif_forecast_alerts" boolean DEFAULT true NOT NULL,
    "home_region" "text",
    "posting_window" "jsonb",
    "activity_level" "text",
    "personality_type" "text",
    "is_system_account" boolean DEFAULT false,
    "timezone" "text",
    "signup_context" "jsonb",
    "signup_location" "jsonb",
    "allow_implicit_tracking" boolean DEFAULT true NOT NULL,
    "trust_score" numeric(4,3) DEFAULT 0.400 NOT NULL,
    "notif_water_quality" boolean DEFAULT true NOT NULL,
    "preferred_session_time" "text",
    "deleted_at" timestamp with time zone,
    "notif_similarity_alerts" boolean DEFAULT true NOT NULL,
    CONSTRAINT "check_preferred_session_time" CHECK ((("preferred_session_time" IS NULL) OR ("preferred_session_time" = ANY (ARRAY['dawn_patrol'::"text", 'morning'::"text", 'lunch'::"text", 'afternoon'::"text", 'evening'::"text", 'any'::"text"])))),
    CONSTRAINT "experience_level_check" CHECK ((("experience_level" IS NULL) OR ("experience_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text", 'expert'::"text"])))),
    CONSTRAINT "profiles_activity_level_check" CHECK (("activity_level" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "profiles_personality_type_check" CHECK (("personality_type" = ANY (ARRAY['rookie'::"text", 'local'::"text", 'traveler'::"text", 'photographer'::"text", 'tactical'::"text", 'competitor'::"text", 'forecaster'::"text"]))),
    CONSTRAINT "profiles_trust_score_range" CHECK ((("trust_score" >= (0)::numeric) AND ("trust_score" <= (1)::numeric)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."is_mock" IS 'Flag to identify mock/test users for development and testing purposes';



COMMENT ON COLUMN "public"."profiles"."home_beach_id" IS 'User''s preferred home beach for forecasts and session defaults';



COMMENT ON COLUMN "public"."profiles"."notif_push_enabled" IS 'Master toggle for all push notifications';



COMMENT ON COLUMN "public"."profiles"."notif_email_enabled" IS 'Master toggle for all email notifications';



COMMENT ON COLUMN "public"."profiles"."notif_inapp_enabled" IS 'Master toggle for all in-app notifications';



COMMENT ON COLUMN "public"."profiles"."notif_session_invites" IS 'Receive notifications for session invites';



COMMENT ON COLUMN "public"."profiles"."notif_likes" IS 'Receive notifications when someone likes your content';



COMMENT ON COLUMN "public"."profiles"."notif_follows" IS 'Receive notifications when someone follows you';



COMMENT ON COLUMN "public"."profiles"."notif_reminders" IS 'Receive reminder notifications for planned sessions';



COMMENT ON COLUMN "public"."profiles"."notif_xp_updates" IS 'Receive notifications for XP achievements and level ups';



COMMENT ON COLUMN "public"."profiles"."display_name" IS 'Unique username for social features (previously collected but not saved due to missing column)';



COMMENT ON COLUMN "public"."profiles"."surf_styles" IS 'Array of surf styles: longboard, shortboard, bodyboard, etc. (previously collected but not saved due to missing column)';



COMMENT ON COLUMN "public"."profiles"."referral_code" IS 'Unique referral code that this user can share with others. Generated on first access.';



COMMENT ON COLUMN "public"."profiles"."preferences_v2_shown_at" IS 'Timestamp when the preferences v2 announcement popup was displayed to the user. NULL indicates the popup has not been shown yet.';



COMMENT ON COLUMN "public"."profiles"."notif_forecast_alerts" IS 'Opt-out toggle for forecast threshold push alerts (home beach).';



COMMENT ON COLUMN "public"."profiles"."timezone" IS 'IANA timezone from signup (e.g., America/Los_Angeles)';



COMMENT ON COLUMN "public"."profiles"."signup_context" IS 'Signup context: method, UTM params, device, referrer, entrypoint, landing_path';



COMMENT ON COLUMN "public"."profiles"."signup_location" IS 'IP-derived location at signup: city, region, country, lat/lng';



COMMENT ON COLUMN "public"."profiles"."allow_implicit_tracking" IS 'Privacy opt-out: if false, no user_events are recorded and preferences are not computed. Default true.';



COMMENT ON COLUMN "public"."profiles"."notif_water_quality" IS 'Opt-out toggle for water quality advisory and closure push notifications.';



COMMENT ON COLUMN "public"."profiles"."preferred_session_time" IS 'User preferred surf time: dawn_patrol, morning, lunch, afternoon, evening, any. NULL = not set.';



COMMENT ON COLUMN "public"."profiles"."deleted_at" IS 'Soft-delete tombstone. When set, the profile has been anonymized via delete_user_account().';



COMMENT ON COLUMN "public"."profiles"."notif_similarity_alerts" IS 'Per-type pref: gates similarity_match notifications across BOTH push and in_app channels. Default true — Pro flagship feature surfaces by default. Master gates (notif_push_enabled, notif_inapp_enabled) take priority.';



COMMENT ON CONSTRAINT "experience_level_check" ON "public"."profiles" IS 'Ensures experience_level is either NULL or one of the valid enum values: beginner, 
  intermediate, advanced, expert. Empty strings are not allowed.';



CREATE OR REPLACE VIEW "posthog_export"."email_send_log" AS
 SELECT "esl"."id",
    "esl"."user_id",
    "esl"."email_type",
    "esl"."local_date",
    "esl"."sent_at",
    "esl"."best_score",
    "esl"."best_beach_id",
    "esl"."delivered_at",
    "esl"."opened_at",
    "esl"."clicked_at",
    "esl"."bounced_at"
   FROM ("public"."email_send_log" "esl"
     JOIN "public"."profiles" "p" ON (("p"."id" = "esl"."user_id")))
  WHERE (COALESCE("p"."is_mock", false) = false);


ALTER TABLE "posthog_export"."email_send_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "posthog_export"."profiles" AS
 SELECT "profiles"."id",
    "profiles"."created_at",
    "profiles"."updated_at",
    "profiles"."home_beach_id",
    "profiles"."onboarding_completed_at",
    "profiles"."is_mock",
    "profiles"."allow_implicit_tracking",
    "profiles"."experience_level",
    "profiles"."preferred_session_time",
    "profiles"."notif_push_enabled",
    "profiles"."notif_email_enabled",
    "profiles"."notif_inapp_enabled",
    "profiles"."notif_forecast_alerts",
    "profiles"."notif_water_quality",
    "profiles"."notif_similarity_alerts",
    "profiles"."followers_count",
    "profiles"."following_count"
   FROM "public"."profiles"
  WHERE (("profiles"."deleted_at" IS NULL) AND (COALESCE("profiles"."is_mock", false) = false));


ALTER TABLE "posthog_export"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "board_id" "uuid",
    "arrival_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "goals" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text",
    "invitee_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'planned'::"text",
    "beach_name" "text",
    "rating" smallint,
    "description" "text",
    "image_url" "text",
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    "crowd_level" integer,
    "wave_quality" integer,
    "water_temp" numeric,
    "parking_ease" integer,
    "is_public" boolean DEFAULT true,
    "deleted_at" timestamp with time zone,
    "share_count" integer DEFAULT 0 NOT NULL,
    "wave_height_ft" numeric(4,1),
    "wind_speed_mph" integer,
    "wind_direction" "text",
    "forecast_accuracy" "text",
    "board_snapshot" "jsonb",
    "tide_height_ft" numeric(4,2),
    "tide_status" "text",
    "skill_ratings" "jsonb" DEFAULT '{}'::"jsonb",
    "muted" boolean DEFAULT false,
    "source" "text",
    "session_decomposition" "jsonb",
    "custom_spot_id" "uuid",
    CONSTRAINT "check_forecast_accuracy" CHECK ((("forecast_accuracy" = ANY (ARRAY['accurate'::"text", 'somewhat'::"text", 'inaccurate'::"text"])) OR ("forecast_accuracy" IS NULL))),
    CONSTRAINT "check_tide_height_ft" CHECK (((("tide_height_ft" >= ('-10'::integer)::numeric) AND ("tide_height_ft" <= (50)::numeric)) OR ("tide_height_ft" IS NULL))),
    CONSTRAINT "check_tide_status" CHECK ((("tide_status" = ANY (ARRAY['rising'::"text", 'falling'::"text", 'high'::"text", 'low'::"text"])) OR ("tide_status" IS NULL))),
    CONSTRAINT "check_wave_height_ft" CHECK (((("wave_height_ft" >= (0)::numeric) AND ("wave_height_ft" <= (50)::numeric)) OR ("wave_height_ft" IS NULL))),
    CONSTRAINT "check_wind_speed_mph" CHECK (((("wind_speed_mph" >= 0) AND ("wind_speed_mph" <= 150)) OR ("wind_speed_mph" IS NULL))),
    CONSTRAINT "sessions_source_check" CHECK ((("source" IS NULL) OR ("source" = ANY (ARRAY['manual'::"text", 'conditions_report'::"text", 'email_one_tap'::"text", 'maestro_smoke'::"text"]))))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sessions"."deleted_at" IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';



COMMENT ON COLUMN "public"."sessions"."share_count" IS 'Cached count of shares for this session (maintained by triggers)';



COMMENT ON COLUMN "public"."sessions"."wave_height_ft" IS 'Actual wave height in feet as reported by user. Range: 0-50 ft (largest surfable waves). NULL indicates not reported.';



COMMENT ON COLUMN "public"."sessions"."wind_speed_mph" IS 'Wind speed in miles per hour as reported by user. Range: 0-150 mph (up to hurricane-force winds). NULL indicates not reported.';



COMMENT ON COLUMN "public"."sessions"."wind_direction" IS 'Wind direction as reported by user. Values: N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS. NULL indicates not reported.';



COMMENT ON COLUMN "public"."sessions"."forecast_accuracy" IS 'User feedback on forecast accuracy. Values: accurate (forecast was spot on), somewhat (close but not perfect), inaccurate (way off). NULL indicates not reported.';



COMMENT ON COLUMN "public"."sessions"."board_snapshot" IS 'Snapshot of board details at session time. Stores {name, board_type, size, volume, dimensions} to preserve historical data even if board is modified or deleted.';



COMMENT ON COLUMN "public"."sessions"."tide_height_ft" IS 'Tide height in feet as reported by user at time of session. Range: -10 to 50 ft (covers extreme tidal ranges). NULL indicates not reported.';



COMMENT ON COLUMN "public"."sessions"."tide_status" IS 'Tide status as reported by user. Values: rising (incoming tide), falling (outgoing tide), high (high tide), low (low tide). NULL indicates not reported.';



COMMENT ON COLUMN "public"."sessions"."skill_ratings" IS 'Per-skill self-assessment ratings (1-5). Shape: {"Pop-ups": 4, "Duck Dives": 3}';



COMMENT ON COLUMN "public"."sessions"."muted" IS 'When true, session is public on profile but hidden from community feed';



COMMENT ON COLUMN "public"."sessions"."session_decomposition" IS 'Optional JSONB capturing what made the session, e.g. { waves: true, crew: false, vibe: true, skill_fit: false }. NULL = picker not shown or skipped. Populated by session-form decomposition picker.';



COMMENT ON CONSTRAINT "sessions_source_check" ON "public"."sessions" IS 'Allowed session source values. maestro_smoke marks rows created by native Maestro smoke flows for targeted cleanup.';



CREATE OR REPLACE VIEW "posthog_export"."sessions" AS
 SELECT "s"."id",
    "s"."user_id",
    "s"."beach_id",
    "s"."board_id",
    "s"."arrival_time",
    "s"."duration_minutes",
    "s"."created_at",
    "s"."status",
    "s"."rating",
    "s"."crowd_level",
    "s"."wave_quality",
    "s"."water_temp",
    "s"."parking_ease",
    "s"."is_public",
    "s"."likes_count",
    "s"."comments_count",
    "s"."share_count",
    "s"."wave_height_ft",
    "s"."wind_speed_mph",
    "s"."wind_direction",
    "s"."forecast_accuracy",
    "s"."tide_height_ft",
    "s"."tide_status",
    "s"."source",
    "s"."custom_spot_id"
   FROM ("public"."sessions" "s"
     JOIN "public"."profiles" "p" ON (("p"."id" = "s"."user_id")))
  WHERE (("s"."deleted_at" IS NULL) AND (COALESCE("p"."is_mock", false) = false));


ALTER TABLE "posthog_export"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "beach_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval) NOT NULL,
    "session_id" "uuid",
    "bot_flagged" boolean DEFAULT false,
    CONSTRAINT "user_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['beach_view'::"text", 'discovery_click'::"text", 'discovery_skip'::"text", 'forecast_check'::"text", 'location_update'::"text", 'page_view'::"text", 'forecast_interaction'::"text", 'session_action'::"text", 'profile_update'::"text", 'onboarding_step'::"text", 'cta_click'::"text", 'review_form_open'::"text", 'review_form_abandon'::"text", 'review_validation_error'::"text", 'review_submit'::"text", 'share_started'::"text", 'share_completed'::"text", 'share_link_opened'::"text", 'share_link_copied'::"text", 'share_image_saved'::"text", 'cam_share'::"text", 'share_intel_button_clicked'::"text", 'share_intel_signin_prompt'::"text", 'surf_plan_share'::"text", 'signup_cta_click'::"text", 'signup_cta_view'::"text", 'signin_cta_click'::"text", 'auth_modal_opened'::"text", 'auth_modal_closed_without_action'::"text", 'auth_method_selected'::"text", 'auth_provider_selected'::"text", 'signup_started'::"text", 'signup_success'::"text", 'login_success'::"text", 'signup_form_submitted'::"text", 'login_form_submitted'::"text", 'home_at_beach_click'::"text", 'home_plan_weekend_click'::"text", 'home_plan_weekend_no_recommendation'::"text", 'session_log_start'::"text", 'session_log_submit'::"text", 'session_share_opened_post_save'::"text", 'session_share_closed_post_save'::"text", 'product_tour_started'::"text", 'product_tour_completed'::"text", 'product_tour_skipped'::"text", 'product_tour_step_viewed'::"text", 'beach_search'::"text", 'forecast_tab_click'::"text", 'horizon_strip_day_selected'::"text", 'match_score_teaser_click'::"text", 'match_score_teaser_view'::"text", 'set_home_beach'::"text", 'map_marker_click'::"text", 'local_intel_tab_viewed'::"text", 'intel_post_created'::"text", 'intel_post_confirmed'::"text", 'plan_session_from_intel'::"text", 'surf_profile_viewed'::"text", 'surf_profile_progress_shown'::"text", 'personalized_score_shown'::"text", 'favorite_shown_in_carousel'::"text", 'mini_log_teaser_click'::"text", 'plan_unlock_click'::"text", 'social_follow'::"text", 'social_like'::"text", 'social_share'::"text", 'social_invite_send'::"text", 'social_invite_respond'::"text", 'social_intel_confirm'::"text", 'tab_view'::"text", 'map_interaction'::"text", 'onboarding_step_viewed'::"text", 'onboarding_step_completed'::"text", 'onboarding_step_auto_skipped'::"text", 'home_beach_forecast_viewed'::"text", 'onboarding_video_started'::"text", 'onboarding_video_completed'::"text", 'onboarding_video_skipped'::"text", 'onboarding_completed'::"text", 'location_permission_granted'::"text", 'location_permission_denied'::"text", 'first_session_logged'::"text", 'home_first_session_cta_tap'::"text", 'home_map_tap'::"text", 'home_menu_tap'::"text", 'home_nearby_spot_tap'::"text", 'home_notifications_tap'::"text", 'home_search_tap'::"text", 'home_surf_call_tap'::"text", 'home_timeline_tap'::"text", 'map_ready'::"text", 'map_load_failed'::"text", 'forecast_ready'::"text", 'session_log_beach_selected'::"text", 'session_log_rating_set'::"text", 'session_log_photo_added'::"text", 'session_photo_upload_started'::"text", 'session_photo_upload_succeeded'::"text", 'session_photo_upload_failed'::"text", 'session_log_abandon'::"text", 'beach_search_result_click'::"text", 'first_beach_view_post_signup'::"text", 'empty_state_shown'::"text", 'cta_impression'::"text", 'client_error'::"text", 'scroll_depth'::"text", 'time_on_page'::"text", 'match_card_rendered'::"text", 'match_strip_tap'::"text", 'for_you_tap'::"text", 'unlock_toast_shown'::"text", 'session_decomposition_selected'::"text", 'match_alert_toggle'::"text", 'roadmap_vote_cast'::"text", 'roadmap_item_submitted'::"text", 'roadmap_item_status_changed'::"text", 'anon_alert_capture_view'::"text", 'anon_alert_capture_submit'::"text", 'anon_alert_capture_error'::"text", 'anon_alert_magic_link_clicked'::"text", 'anon_alert_signup_success'::"text", 'session_log_validation_failed'::"text", 'paywall_opened'::"text", 'paywall_dismissed'::"text", 'paywall_purchase_started'::"text", 'paywall_purchase_success'::"text", 'paywall_purchase_failed'::"text", 'onboarding_paywall_skipped'::"text", 'onboarding_trial_started'::"text", 'home_hero_forecast_viewed'::"text", 'push_permission_denied'::"text", 'push_token_fetch_failed'::"text", 'push_device_registration_failed'::"text", 'push_device_registered'::"text", 'home_locked_best_spot_teaser_tap'::"text", 'home_set_alarm_tap'::"text", 'share_sheet_blocked_pending'::"text", 'apple_beta_prompt_eligible'::"text", 'apple_beta_prompt_viewed'::"text", 'apple_beta_prompt_qr_rendered'::"text", 'apple_beta_prompt_open_testflight_clicked'::"text", 'apple_beta_prompt_copy_link_clicked'::"text", 'apple_beta_prompt_dismissed'::"text"]))),
    CONSTRAINT "user_events_identity_check" CHECK ((("user_id" IS NOT NULL) OR ("session_id" IS NOT NULL)))
);


ALTER TABLE "public"."user_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_events" IS 'Behavioral signals for implicit preference learning. Events auto-expire after 90 days.';



COMMENT ON COLUMN "public"."user_events"."event_type" IS 'Type of behavioral signal: beach_view, discovery_click, discovery_skip, forecast_check, location_update';



COMMENT ON COLUMN "public"."user_events"."beach_id" IS 'Optional beach reference. NULL for non-beach events like location_update';



COMMENT ON COLUMN "public"."user_events"."metadata" IS 'Event-specific data: {wave_height_ft, break_type, time_of_day, lat, lon, etc.}';



COMMENT ON COLUMN "public"."user_events"."expires_at" IS 'Auto-deletion timestamp (90 days from creation). Maintains privacy and data freshness.';



COMMENT ON COLUMN "public"."user_events"."session_id" IS 'Anonymous visitor ID from localStorage, used to track pre-signup behavior';



CREATE OR REPLACE VIEW "posthog_export"."user_events" AS
 SELECT "ue"."id",
    "ue"."user_id",
    "ue"."session_id",
    "ue"."event_type",
    "ue"."beach_id",
    (((("ue"."metadata" - 'email'::"text") - 'token'::"text") - 'secret'::"text") - 'password'::"text") AS "metadata",
    "ue"."created_at",
    "ue"."expires_at",
    "ue"."bot_flagged"
   FROM ("public"."user_events" "ue"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "ue"."user_id")))
  WHERE (("ue"."user_id" IS NULL) OR (COALESCE("p"."is_mock", false) = false));


ALTER TABLE "posthog_export"."user_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE OR REPLACE VIEW "posthog_export"."user_follows" AS
 SELECT "uf"."id",
    "uf"."follower_id",
    "uf"."following_id",
    "uf"."created_at"
   FROM (("public"."user_follows" "uf"
     JOIN "public"."profiles" "follower" ON (("follower"."id" = "uf"."follower_id")))
     JOIN "public"."profiles" "following" ON (("following"."id" = "uf"."following_id")))
  WHERE ((COALESCE("follower"."is_mock", false) = false) AND (COALESCE("following"."is_mock", false) = false));


ALTER TABLE "posthog_export"."user_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_deletions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "sessions_soft_deleted" integer DEFAULT 0 NOT NULL,
    "comments_anonymized" integer DEFAULT 0 NOT NULL,
    "personal_rows_deleted" integer DEFAULT 0 NOT NULL,
    "error" "text"
);


ALTER TABLE "public"."account_deletions" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_deletions" IS 'Audit log of account deletion requests. Retains user_id but no PII.';



CREATE TABLE IF NOT EXISTS "public"."activation_push_log" (
    "user_id" "uuid" NOT NULL,
    "nudge_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."activation_push_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."activation_push_log" IS 'Per-user, per-nudge-type activation push idempotency log. One row = one push ever for that (user, nudge_type) pair.';



COMMENT ON COLUMN "public"."activation_push_log"."nudge_type" IS 'Kebab-snake identifier for the nudge campaign (e.g. first_session_day7, first_share_day14).';



CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "payload_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_log_action_check" CHECK (("length"("action") <= 100)),
    CONSTRAINT "admin_audit_log_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['beach'::"text", 'session'::"text", 'review'::"text", 'photo'::"text", 'intel'::"text", 'user'::"text", 'forecast'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alert_date" "date" NOT NULL,
    "channel" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alert_deliveries_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'push'::"text"])))
);


ALTER TABLE "public"."alert_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_id" "uuid" NOT NULL,
    "rule_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" NOT NULL,
    "skip_reason" "text",
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alert_delivery_attempts_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'push'::"text"]))),
    CONSTRAINT "alert_delivery_attempts_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'skipped_disabled'::"text", 'skipped_allowlist'::"text", 'skipped_cooldown'::"text", 'skipped_user_cap'::"text", 'skipped_no_device'::"text", 'skipped_no_email'::"text", 'skipped_channel_disabled'::"text", 'skipped_dedup_collision'::"text", 'skipped_stale_forecast'::"text", 'failed_provider'::"text", 'failed_internal'::"text"])))
);


ALTER TABLE "public"."alert_delivery_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rule_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "alert_date" "date" NOT NULL,
    "send_at" timestamp with time zone NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "best_hour" timestamp with time zone NOT NULL,
    "conditions_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sent" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alert_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "preset_type" "text",
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notify_email" boolean DEFAULT true NOT NULL,
    "notify_push" boolean DEFAULT true NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "last_matched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_created_at" timestamp with time zone,
    CONSTRAINT "alert_rules_preset_type_check" CHECK (("preset_type" = ANY (ARRAY['glass_off'::"text", 'big_day'::"text", 'clean_groundswell'::"text", 'mellow_session'::"text", 'tide_window'::"text", 'dawn_patrol'::"text", 'epic_conditions'::"text", 'similarity_alert'::"text", 'similarity_match'::"text", 'daily_check_in'::"text"])))
);


ALTER TABLE "public"."alert_rules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."alert_rules"."auto_created_at" IS 'Non-null when this rule was system-created (e.g., similarity_match auto-enable for Pro/trial users). Null = user-created. Used to distinguish auto-seeded rows from manual rules in audit/analytics.';



CREATE OR REPLACE VIEW "public"."auth_apple_orphan_users" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "user_id",
    "u"."email",
    "u"."created_at",
    "u"."last_sign_in_at",
    ("u"."raw_app_meta_data" ->> 'provider'::"text") AS "primary_provider",
    ("u"."raw_app_meta_data" -> 'providers'::"text") AS "providers_list",
    ("u"."raw_user_meta_data" ->> 'iss'::"text") AS "iss",
    ("u"."raw_user_meta_data" ->> 'sub'::"text") AS "apple_sub"
   FROM "auth"."users" "u"
  WHERE ((("u"."raw_user_meta_data" ->> 'iss'::"text") ~~ '%appleid%'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM "auth"."identities" "i"
          WHERE ("i"."user_id" = "u"."id")))));


ALTER TABLE "public"."auth_apple_orphan_users" OWNER TO "postgres";


COMMENT ON VIEW "public"."auth_apple_orphan_users" IS 'Audit: auth.users rows flagged as Apple OIDC sign-ins (iss=appleid.apple.com) that have NO row in auth.identities. Expected count: 0. Non-zero indicates Supabase OAuth identity-resolution drift, typically when an Apple sub is recognized as an existing linked identity *after* a new auth.users row has already been created (and not cleaned up). Admin-only — exposes user emails.';



CREATE TABLE IF NOT EXISTS "public"."badge_definitions" (
    "badge_slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "category" "text" NOT NULL,
    "xp_reward" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "badge_definitions_badge_slug_check" CHECK (("badge_slug" ~ '^[a-z][a-z0-9_]*[a-z0-9]$'::"text")),
    CONSTRAINT "badge_definitions_category_check" CHECK (("category" = ANY (ARRAY['global'::"text", 'journal'::"text", 'quiver'::"text"]))),
    CONSTRAINT "badge_definitions_description_check" CHECK (("length"("description") <= 500)),
    CONSTRAINT "badge_definitions_icon_check" CHECK (("length"("icon") <= 50)),
    CONSTRAINT "badge_definitions_name_check" CHECK (("length"("name") <= 100)),
    CONSTRAINT "badge_definitions_xp_reward_check" CHECK (("xp_reward" >= 0))
);


ALTER TABLE "public"."badge_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_amenity_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "ccc_location_id" "uuid" NOT NULL,
    "distance_m" double precision NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beach_amenity_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_amenity_sources" IS 'Beach-to-CCC access location linkage created by spatial proximity matching. A single beach may link to multiple nearby CCC access points; distance_m records the centroid-to-centroid distance in metres.';



CREATE TABLE IF NOT EXISTS "public"."beach_daily_intel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generation_time" "text" NOT NULL,
    "forecast_date" "date" NOT NULL,
    "best_window_start" time without time zone,
    "best_window_end" time without time zone,
    "best_window_description" "text",
    "surf_min_ft" numeric,
    "surf_max_ft" numeric,
    "surf_description" "text",
    "tide_height_ft" numeric,
    "tide_time" time without time zone,
    "tide_status" "text",
    "tide_optimal_range" "text",
    "next_tide_type" "text",
    "next_tide_time" "text",
    "next_tide_height_ft" numeric,
    "wind_speed_mph" numeric,
    "wind_direction_deg" numeric,
    "wind_direction_text" "text",
    "wind_quality" "text",
    "wind_description" "text",
    "primary_swell_height_ft" numeric,
    "primary_swell_period_s" numeric,
    "primary_swell_direction_deg" numeric,
    "primary_swell_direction_text" "text",
    "secondary_swell_height_ft" numeric,
    "secondary_swell_period_s" numeric,
    "secondary_swell_direction_deg" numeric,
    "secondary_swell_direction_text" "text",
    "confidence" "text" NOT NULL,
    "recommendation" "text",
    "conditions_score" integer,
    "raw_intel_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_surf_window" CHECK (((("best_window_start" IS NULL) AND ("best_window_end" IS NULL)) OR (("best_window_start" IS NOT NULL) AND ("best_window_end" IS NOT NULL) AND ("best_window_start" <> "best_window_end"))))
);


ALTER TABLE "public"."beach_daily_intel" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_daily_intel" IS 'Pre-computed surf intelligence for beaches, updated 3x daily (6am, 10am, 2pm PT). Provides instant surf window recommendations without edge function calls.';



COMMENT ON CONSTRAINT "valid_surf_window" ON "public"."beach_daily_intel" IS 'Ensures surf windows have different start and end times, preventing invalid windows like 06:00-06:00';



CREATE TABLE IF NOT EXISTS "public"."beach_dioramas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "condition_key" "text" NOT NULL,
    "video_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."beach_dioramas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_dioramas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_editorial_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "beach_editorial_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['beginner_notes'::"text", 'tide_notes'::"text", 'safety_notes'::"text", 'advanced_notes'::"text", 'crowd_notes'::"text"])))
);


ALTER TABLE "public"."beach_editorial_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_forecast_accuracy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "avg_wave_height_delta" numeric(5,2),
    "avg_wind_speed_delta" numeric(5,2),
    "avg_confidence_accuracy" numeric(5,2),
    "total_sessions_count" integer DEFAULT 0,
    "last_30_days_count" integer DEFAULT 0,
    "last_7_days_count" integer DEFAULT 0,
    "overall_accuracy_score" numeric(5,2),
    "calculation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."beach_forecast_accuracy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_height_offsets" (
    "beach_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'display'::"text" NOT NULL,
    "offset_m" numeric(5,3) NOT NULL,
    "sample_count" integer NOT NULL,
    "mae_before_m" numeric(5,3),
    "mae_after_m" numeric(5,3),
    "window_days" integer DEFAULT 30 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beach_height_offsets" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_height_offsets" IS 'Rolling per-beach residual offset applied to user-facing display forecasts. Written by Seaside cron compute-beach-height-offsets; read by quiver forecast-builder when beaches.height_offset_enabled = true.';



COMMENT ON COLUMN "public"."beach_height_offsets"."source" IS 'Positive marker identifying the layer this offset applies to. ''display'' = post-face-Hs-transformer user-facing value. Future sources (e.g. ''om-baseline'') must use distinct values.';



COMMENT ON COLUMN "public"."beach_height_offsets"."offset_m" IS 'Median residual in meters: median(display_forecast_m - observed_m) over window_days. Applied as: corrected = display_forecast_m - offset_m.';



CREATE OR REPLACE VIEW "public"."beach_location_audit" WITH ("security_invoker"='true') AS
 SELECT "beaches"."id",
    "beaches"."name",
    "beaches"."slug",
    "beaches"."city",
    "beaches"."state",
    "beaches"."country",
    "beaches"."created_at",
        CASE
            WHEN ((("beaches"."city" IS NULL) OR (TRIM(BOTH FROM "beaches"."city") = ''::"text")) AND (("beaches"."state" IS NULL) OR (TRIM(BOTH FROM "beaches"."state") = ''::"text"))) THEN 'BOTH_MISSING'::"text"
            WHEN (("beaches"."city" IS NULL) OR (TRIM(BOTH FROM "beaches"."city") = ''::"text")) THEN 'CITY_MISSING'::"text"
            WHEN (("beaches"."state" IS NULL) OR (TRIM(BOTH FROM "beaches"."state") = ''::"text")) THEN 'STATE_MISSING'::"text"
            ELSE 'COMPLETE'::"text"
        END AS "location_status"
   FROM "public"."beaches"
  WHERE (("beaches"."slug" IS NOT NULL) AND (("beaches"."is_private" IS NULL) OR ("beaches"."is_private" = false)));


ALTER TABLE "public"."beach_location_audit" OWNER TO "postgres";


COMMENT ON VIEW "public"."beach_location_audit" IS 'Audit view for beach location data quality. Use to identify beaches with incomplete location data that will fall back to /spots/{slug} URLs.';



CREATE OR REPLACE VIEW "public"."beach_location_audit_summary" WITH ("security_invoker"='true') AS
 SELECT "beach_location_audit"."location_status",
    "count"(*) AS "beach_count",
    "round"(((("count"(*))::numeric * 100.0) / "sum"("count"(*)) OVER ()), 2) AS "percentage"
   FROM "public"."beach_location_audit"
  GROUP BY "beach_location_audit"."location_status"
  ORDER BY
        CASE "beach_location_audit"."location_status"
            WHEN 'BOTH_MISSING'::"text" THEN 1
            WHEN 'CITY_MISSING'::"text" THEN 2
            WHEN 'STATE_MISSING'::"text" THEN 3
            WHEN 'COMPLETE'::"text" THEN 4
            ELSE NULL::integer
        END;


ALTER TABLE "public"."beach_location_audit_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."beach_location_audit_summary" IS 'Summary statistics for beach location data quality audit.';



CREATE TABLE IF NOT EXISTS "public"."ml_predictions_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "predicted_at" timestamp with time zone NOT NULL,
    "raw_forecast_m" numeric(4,2),
    "wave_period_s" numeric(4,1),
    "wave_direction_deg" numeric(5,1),
    "wind_speed_ms" numeric(4,1),
    "wind_direction_deg" numeric(5,1),
    "corrected_forecast_m" numeric(4,2),
    "bias_applied_m" numeric(4,2),
    "model_version" "text" NOT NULL,
    "observed_m" numeric(4,2),
    "raw_error_m" numeric(4,2),
    "corrected_error_m" numeric(4,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tide_state" "text",
    "tide_height_m" numeric(4,2),
    "forecast_horizon_hours" integer,
    "candidate_corrected_m" numeric(6,3),
    "candidate_model_version" "text",
    "wave_height_om" real,
    "wave_period_om" real,
    "wave_direction_om" real,
    "swell_height_om" real,
    "swell_period_om" real,
    "swell_direction_om" real,
    "wind_wave_height_om" real,
    "om_passthrough_m" real,
    "ml_skipped" boolean DEFAULT false NOT NULL,
    "noaa_swell_1_height_m" real,
    "noaa_swell_1_period_s" real,
    "noaa_swell_1_direction_deg" real,
    "noaa_swell_2_height_m" real,
    "noaa_swell_2_period_s" real,
    "noaa_swell_2_direction_deg" real,
    "noaa_wind_wave_height_m" real,
    "noaa_wind_wave_period_s" real,
    "noaa_wind_wave_direction_deg" real,
    "raw_display_height_m" numeric(5,3),
    "offset_corrected_display_height_m" numeric(5,3),
    "height_offset_m" numeric(5,3),
    "height_offset_sample_count" integer,
    "display_source" "text",
    "v5_shadow_height_m" numeric(5,3),
    "v5_model_version" "text",
    "direction_bucket" "text",
    "om_bucket" "text",
    CONSTRAINT "ml_predictions_log_forecast_horizon_range" CHECK ((("forecast_horizon_hours" >= 0) AND ("forecast_horizon_hours" <= 168))),
    CONSTRAINT "ml_predictions_log_tide_state_check" CHECK ((("tide_state" IS NULL) OR ("tide_state" = ANY (ARRAY['low'::"text", 'mid'::"text", 'high'::"text"]))))
);


ALTER TABLE "public"."ml_predictions_log" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ml_predictions_log"."tide_state" IS 'Tide state at prediction time: low, mid, or high. Used as ML feature for tide-dependent corrections.';



COMMENT ON COLUMN "public"."ml_predictions_log"."tide_height_m" IS 'Actual tide height in meters at prediction time. Enables continuous tide feature for ML model.';



COMMENT ON COLUMN "public"."ml_predictions_log"."forecast_horizon_hours" IS 'Number of hours ahead the forecast was made (0-168). Enables accuracy analysis by lead time. 0 = nowcast, 24 = day-ahead, 168 = week-ahead. NULL for legacy predictions.';



COMMENT ON COLUMN "public"."ml_predictions_log"."candidate_corrected_m" IS 'Corrected wave height from the candidate model during shadow scoring. NULL when no candidate is active.';



COMMENT ON COLUMN "public"."ml_predictions_log"."candidate_model_version" IS 'Version string of the candidate model that produced candidate_corrected_m. NULL when no candidate is active.';



COMMENT ON COLUMN "public"."ml_predictions_log"."wave_height_om" IS 'Open-Meteo combined significant wave height (meters) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."wave_period_om" IS 'Open-Meteo dominant wave period (seconds) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."wave_direction_om" IS 'Open-Meteo dominant wave direction (degrees true) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."swell_height_om" IS 'Open-Meteo primary swell height (meters) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."swell_period_om" IS 'Open-Meteo primary swell period (seconds) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."swell_direction_om" IS 'Open-Meteo primary swell direction (degrees true) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."wind_wave_height_om" IS 'Open-Meteo wind wave height (meters) at prediction time';



COMMENT ON COLUMN "public"."ml_predictions_log"."ml_skipped" IS 'True when the ML correction was effectively skipped for this row (small-wave passthrough, noise-threshold zeroing, or zero-bias prediction). Surfaced in UI so users know the ML had no effect on the displayed forecast.';



COMMENT ON COLUMN "public"."ml_predictions_log"."noaa_swell_1_height_m" IS 'NOAA primary swell partition height (parsed from enhanced_forecasts.swell_1_height, ft->m).';



COMMENT ON COLUMN "public"."ml_predictions_log"."noaa_swell_1_period_s" IS 'NOAA primary swell partition period in seconds.';



COMMENT ON COLUMN "public"."ml_predictions_log"."noaa_swell_1_direction_deg" IS 'NOAA primary swell partition direction in degrees (0-360, compass-to-deg converted).';



COMMENT ON COLUMN "public"."ml_predictions_log"."noaa_wind_wave_height_m" IS 'NOAA wind-wave partition height. Critical for <0.5m bucket discrimination - short-period wind chop vs long-period groundswell at same total height.';



COMMENT ON COLUMN "public"."ml_predictions_log"."raw_display_height_m" IS 'User-facing display wave height (face-Hs transformer output) BEFORE the per-beach offset correction is applied. Captured at issue time inside forecast-builder; never re-derived from enhanced_forecasts.wave_height.';



COMMENT ON COLUMN "public"."ml_predictions_log"."offset_corrected_display_height_m" IS 'User-facing display wave height AFTER the per-beach offset correction. Equal to raw_display_height_m when no offset applied.';



COMMENT ON COLUMN "public"."ml_predictions_log"."display_source" IS 'Identifier for the display-path version that produced raw_display_height_m. Examples: face-Hs-transformer-v1, backfill-from-ef-v1.';



COMMENT ON COLUMN "public"."ml_predictions_log"."v5_shadow_height_m" IS 'Shadow-only v5 candidate height in meters: f(wave_height_om) + g(direction_bucket), with the W × 0.5-1.0m guardrail (g skipped in that cell, raw OM passes through). NEVER read by user-facing serving paths. Populated only when wave_height_om and direction_bucket are both available at log time.';



COMMENT ON COLUMN "public"."ml_predictions_log"."v5_model_version" IS 'Identifier of the ml_calibration_versions row that produced v5_shadow_height_m. Format: v5_c.YYYYMMDD_HHMM (matches the calibration_versions.version key).';



COMMENT ON COLUMN "public"."ml_predictions_log"."direction_bucket" IS 'Direction bucket used for v5 g(dir) lookup. One of: S/SW (170-240), W (250-280), NW (280-340), OTHER (everything else, including null). Derived from NOAA primary swell direction (cardinalToDegrees(swell_1_direction)) at log time; falls back to wave_direction_om when NOAA is null.';



COMMENT ON COLUMN "public"."ml_predictions_log"."om_bucket" IS 'OM-predicted-height bucket used for v5 f(om) lookup. One of: <0.5m, 0.5-1.0m, 1.0-1.5m, 1.5m+. Derived from wave_height_om at log time.';



CREATE MATERIALIZED VIEW "public"."beach_ml_performance_baseline" AS
 SELECT "b"."id" AS "beach_id",
    "b"."name" AS "beach_name",
    "count"(*) AS "predictions_total",
    "count"(*) FILTER (WHERE ("p"."observed_m" > (0)::numeric)) AS "predictions_matched",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("p"."observed_m" > (0)::numeric)))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "match_rate_pct",
    "round"("avg"("p"."raw_error_m"), 3) AS "raw_mae",
    "round"("avg"("p"."corrected_error_m"), 3) AS "corrected_mae",
    "round"(((100.0 * ("avg"("p"."raw_error_m") - "avg"("p"."corrected_error_m"))) / NULLIF("avg"("p"."raw_error_m"), (0)::numeric)), 1) AS "mae_improvement_pct",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("p"."corrected_error_m" < "p"."raw_error_m")))::numeric) / (NULLIF("count"(*) FILTER (WHERE ("p"."observed_m" > (0)::numeric)), 0))::numeric), 1) AS "improvement_rate_pct",
    "round"("avg"(("p"."raw_forecast_m" - "p"."observed_m")), 3) AS "avg_raw_bias",
    "round"("avg"(("p"."corrected_forecast_m" - "p"."observed_m")), 3) AS "avg_corrected_bias",
    "max"("p"."predicted_at") AS "last_prediction_at",
    ("now"() - '14 days'::interval) AS "period_start",
    "now"() AS "period_end"
   FROM ("public"."beaches" "b"
     JOIN "public"."ml_predictions_log" "p" ON (("p"."beach_id" = "b"."id")))
  WHERE (("p"."predicted_at" > ("now"() - '14 days'::interval)) AND ("p"."observed_m" > (0)::numeric))
  GROUP BY "b"."id", "b"."name"
 HAVING ("count"(*) FILTER (WHERE ("p"."observed_m" > (0)::numeric)) >= 5)
  ORDER BY "b"."name"
  WITH NO DATA;


ALTER TABLE "public"."beach_ml_performance_baseline" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."beach_ml_performance_baseline" IS 'Per-beach ML performance metrics over rolling 14-day window. Used for monitoring model performance, identifying problem beaches, and comparing regional patterns. Refreshed daily at 7am UTC.';



CREATE TABLE IF NOT EXISTS "public"."beach_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "thumb_url" "text",
    "title" "text",
    "creator_name" "text",
    "creator_url" "text",
    "license_code" "text",
    "license_url" "text",
    "attribution_html" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved" boolean DEFAULT true NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "beach_photos_source_check" CHECK (("source" = ANY (ARRAY['openverse'::"text", 'flickr'::"text", 'unsplash'::"text", 'pexels'::"text", 'wikimedia'::"text", 'user'::"text", 'google_places'::"text"])))
);


ALTER TABLE "public"."beach_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_photos" IS 'Beach photos from various sources. PUBLIC ACCESS: Only approved, non-deleted photos are 
  visible. ADMIN ACCESS: Admins can view all photos including soft-deleted ones. SECURITY: RLS 
  policies enforce data access controls.';



COMMENT ON COLUMN "public"."beach_photos"."image_url" IS 'URL to beach photo. For external sources, this is the source URL.
        For user uploads, this may reference session-media storage bucket.';



COMMENT ON COLUMN "public"."beach_photos"."approved" IS 'Moderation flag. Only approved=true photos appear in public beach listings.
        Admins can toggle this to moderate user-submitted beach photos.';



COMMENT ON COLUMN "public"."beach_photos"."deleted_at" IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';



CREATE OR REPLACE VIEW "public"."beach_photos_featured" WITH ("security_invoker"='true') AS
 SELECT DISTINCT ON ("beach_photos"."beach_id") "beach_photos"."beach_id",
    "beach_photos"."image_url",
    "beach_photos"."thumb_url",
    "beach_photos"."attribution_html"
   FROM "public"."beach_photos"
  WHERE (("beach_photos"."approved" = true) AND ("beach_photos"."deleted_at" IS NULL))
  ORDER BY "beach_photos"."beach_id", "beach_photos"."fetched_at" DESC;


ALTER TABLE "public"."beach_photos_featured" OWNER TO "postgres";


COMMENT ON VIEW "public"."beach_photos_featured" IS 'Returns the most recent approved, non-deleted photo for each beach. Used for featured images in 
  listings and search results.';



CREATE TABLE IF NOT EXISTS "public"."beach_photos_history" (
    "history_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id" "uuid" NOT NULL,
    "beach_id" "uuid",
    "source" "text",
    "source_id" "text",
    "image_url" "text",
    "thumb_url" "text",
    "title" "text",
    "creator_name" "text",
    "creator_url" "text",
    "license_code" "text",
    "license_url" "text",
    "attribution_html" "text",
    "fetched_at" timestamp with time zone,
    "approved" boolean,
    "deleted_at" timestamp with time zone,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid",
    "change_type" "text" NOT NULL,
    CONSTRAINT "beach_photos_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."beach_photos_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_photos_history" IS 'Audit trail for beach_photos table. Captures snapshots on UPDATE/DELETE operations.';



CREATE TABLE IF NOT EXISTS "public"."beach_recommendation_calibration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "window_start" "date" NOT NULL,
    "window_end" "date" NOT NULL,
    "samples_count" integer DEFAULT 0 NOT NULL,
    "best_swell_dir_deg_min" smallint,
    "best_swell_dir_deg_max" smallint,
    "best_wind_offshore_deg" smallint,
    "best_wind_tol_deg" smallint,
    "best_tide_ft_min" numeric,
    "best_tide_ft_max" numeric,
    "skill_level_inferred" "text",
    "method" "text" DEFAULT 'default_seed'::"text" NOT NULL,
    "metrics" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beach_recommendation_calibration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_review_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beach_review_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beach_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall_rating" integer NOT NULL,
    "wave_quality_rating" integer NOT NULL,
    "crowd_density_rating" integer NOT NULL,
    "parking_rating" integer NOT NULL,
    "accessibility_rating" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "content" "text" NOT NULL,
    "visit_date" "date",
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "beach_reviews_accessibility_rating_check" CHECK ((("accessibility_rating" >= 1) AND ("accessibility_rating" <= 5))),
    CONSTRAINT "beach_reviews_crowd_density_rating_check" CHECK ((("crowd_density_rating" >= 1) AND ("crowd_density_rating" <= 5))),
    CONSTRAINT "beach_reviews_overall_rating_check" CHECK ((("overall_rating" >= 1) AND ("overall_rating" <= 5))),
    CONSTRAINT "beach_reviews_parking_rating_check" CHECK ((("parking_rating" >= 1) AND ("parking_rating" <= 5))),
    CONSTRAINT "beach_reviews_wave_quality_rating_check" CHECK ((("wave_quality_rating" >= 1) AND ("wave_quality_rating" <= 5)))
);


ALTER TABLE "public"."beach_reviews" OWNER TO "postgres";


COMMENT ON COLUMN "public"."beach_reviews"."deleted_at" IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';



CREATE TABLE IF NOT EXISTS "public"."beach_reviews_history" (
    "history_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id" "uuid" NOT NULL,
    "beach_id" "uuid",
    "user_id" "uuid",
    "overall_rating" integer,
    "wave_quality_rating" integer,
    "crowd_density_rating" integer,
    "parking_rating" integer,
    "accessibility_rating" integer,
    "title" character varying(255),
    "content" "text",
    "visit_date" "date",
    "helpful_count" integer,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid",
    "change_type" "text" NOT NULL,
    CONSTRAINT "beach_reviews_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."beach_reviews_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_reviews_history" IS 'Audit trail for beach_reviews table. Captures snapshots on UPDATE/DELETE operations.';



CREATE TABLE IF NOT EXISTS "public"."beach_sources" (
    "beach_id" "uuid" NOT NULL,
    "ndbc_buoy_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "forecast_source_id" "text",
    "camera_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "youtube_channel_handle" "text",
    "youtube_channel_id" "text",
    "youtube_stream_title_hint" "text",
    "youtube_last_resolved_at" timestamp with time zone,
    "thumbnail_url" "text"
);


ALTER TABLE "public"."beach_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."beach_sources" IS 'External source mappings per beach: NDBC buoy IDs, primary forecast source, camera URL';



COMMENT ON COLUMN "public"."beach_sources"."youtube_channel_handle" IS 'YouTube channel handle (e.g. @ExploreOceans). Stable anchor for resolving current live stream video IDs.';



COMMENT ON COLUMN "public"."beach_sources"."youtube_channel_id" IS 'YouTube channel ID (e.g. UCxxxxxx). Cached from handle lookup to avoid repeated API calls. Populated by resolver on first run.';



COMMENT ON COLUMN "public"."beach_sources"."youtube_stream_title_hint" IS 'Substring to match against stream titles for multi-cam channels (e.g. "Surf Camera" for @DeerfieldBeachLive). NULL for single-cam channels.';



COMMENT ON COLUMN "public"."beach_sources"."youtube_last_resolved_at" IS 'Timestamp of last successful resolver run for this cam. Used to detect stale cams.';



CREATE TABLE IF NOT EXISTS "public"."beach_water_quality" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "previous_status" "text",
    "latest_enterococcus" double precision,
    "latest_fecal_coliform" double precision,
    "latest_sample_date" "date",
    "exceedance_count_30d" integer DEFAULT 0 NOT NULL,
    "total_samples_30d" integer DEFAULT 0 NOT NULL,
    "monitoring_station_id" "uuid",
    "status_changed_at" timestamp with time zone,
    "status_reason" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "beach_water_quality_previous_status_check" CHECK (("previous_status" = ANY (ARRAY['good'::"text", 'advisory'::"text", 'closure'::"text", 'unknown'::"text"]))),
    CONSTRAINT "beach_water_quality_status_check" CHECK (("status" = ANY (ARRAY['good'::"text", 'advisory'::"text", 'closure'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."beach_water_quality" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_blocks_check" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_blocks" IS 'Per-user blocklist. Blocker cannot see blocked user''s profile or sessions in any native or web read path. Block is silent — blocked user is not notified.';



CREATE OR REPLACE VIEW "public"."blocked_user_ids" WITH ("security_invoker"='true') AS
 SELECT "user_blocks"."blocked_id"
   FROM "public"."user_blocks"
  WHERE ("user_blocks"."blocker_id" = "auth"."uid"());


ALTER TABLE "public"."blocked_user_ids" OWNER TO "postgres";


COMMENT ON VIEW "public"."blocked_user_ids" IS 'Convenience view for API-layer filtering. Always returns the calling user''s blocklist due to security_invoker + auth.uid() in WHERE clause.';



CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "board_type" "text" NOT NULL,
    "dimensions" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "session_count" integer DEFAULT 0,
    "size" "text",
    "volume" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buoys" (
    "buoy_uuid" "text" NOT NULL,
    "buoy_name" "text",
    "active" boolean DEFAULT true NOT NULL,
    "coordinates" "public"."geometry"(Point,4326),
    "water_temperature" numeric,
    "air_temperature" numeric,
    "wave_height" numeric,
    "wave_period" numeric,
    "wind_speed" numeric,
    "wind_gust" numeric,
    "wind_direction" numeric,
    "tides" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."buoys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ccc_access_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ccc_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "geog" "public"."geography"(Point,4326) GENERATED ALWAYS AS (("public"."st_setsrid"("public"."st_makepoint"("lon", "lat"), 4326))::"public"."geography") STORED,
    "county" "text",
    "has_parking" boolean DEFAULT false NOT NULL,
    "has_fee" boolean DEFAULT false NOT NULL,
    "has_restrooms" boolean DEFAULT false NOT NULL,
    "has_ada_access" boolean DEFAULT false NOT NULL,
    "has_dog_friendly" boolean DEFAULT false NOT NULL,
    "has_stroller_friendly" boolean DEFAULT false NOT NULL,
    "has_campground" boolean DEFAULT false NOT NULL,
    "has_boating" boolean DEFAULT false NOT NULL,
    "has_fishing" boolean DEFAULT false NOT NULL,
    "has_picnic_area" boolean DEFAULT false NOT NULL,
    "has_volleyball" boolean DEFAULT false NOT NULL,
    "has_bike_path" boolean DEFAULT false NOT NULL,
    "has_tidepools" boolean DEFAULT false NOT NULL,
    "has_sandy_beach" boolean DEFAULT false NOT NULL,
    "has_rocky_shore" boolean DEFAULT false NOT NULL,
    "has_bluff_trail" boolean DEFAULT false NOT NULL,
    "has_wildlife_viewing" boolean DEFAULT false NOT NULL,
    "has_visitor_center" boolean DEFAULT false NOT NULL,
    "raw_data" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ccc_access_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ccc_access_locations" IS 'Raw California Coastal Commission public access location data synced from the CCC API. Written by the server-side sync service; readable by all roles.';



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid",
    "target_type" "public"."content_report_target" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "target_owner_id" "uuid",
    "reason" "public"."content_report_reason" NOT NULL,
    "details" "text",
    "status" "public"."content_report_status" DEFAULT 'pending'::"public"."content_report_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "moderator_id" "uuid",
    "moderator_notes" "text"
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_reports" IS 'Polymorphic content reports. target_owner_id is resolved server-side at insert time so moderation queries do not need to re-resolve ownership against possibly-deleted source rows.';



CREATE TABLE IF NOT EXISTS "public"."corrected_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "forecast_ts" timestamp with time zone NOT NULL,
    "valid_time_utc" timestamp with time zone NOT NULL,
    "raw_height_m" numeric(4,2),
    "corrected_height_m" numeric(4,2),
    "bias_applied_m" numeric(4,2),
    "model_version" "text" NOT NULL,
    "corrected_at" timestamp with time zone DEFAULT "now"(),
    "primary_source" "text" DEFAULT 'NOAA_NWS'::"text" NOT NULL,
    CONSTRAINT "corrected_forecasts_primary_source_check" CHECK (("primary_source" = ANY (ARRAY['NOAA_NWS'::"text", 'OPEN_METEO'::"text"])))
);


ALTER TABLE "public"."corrected_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cron_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" NOT NULL,
    "summary" "jsonb",
    "error_message" "text",
    "duration_ms" integer,
    CONSTRAINT "cron_runs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'ok'::"text", 'error'::"text", 'timeout'::"text"])))
);


ALTER TABLE "public"."cron_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_cleanup_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleanup_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_name" "text" NOT NULL,
    "records_affected" integer NOT NULL,
    "cleanup_reason" "text" NOT NULL,
    "backup_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."data_cleanup_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_notes_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "raw_text" "text" NOT NULL,
    "polished_text" "text",
    "posted" boolean DEFAULT false NOT NULL,
    "posted_at" timestamp with time zone,
    "posting_log_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dev_notes_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_session_mutation_audit" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "txid" bigint DEFAULT "txid_current"() NOT NULL,
    "op" "text" NOT NULL,
    "user_id" "uuid",
    "session_id" "uuid",
    "old_row" "jsonb",
    "new_row" "jsonb",
    "application_name" "text",
    "client_addr" "inet",
    "current_user_role" "name",
    "session_user_role" "name",
    "current_query" "text"
);

ALTER TABLE ONLY "public"."dev_session_mutation_audit" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."dev_session_mutation_audit" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dev_session_mutation_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."dev_session_mutation_audit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dev_session_mutation_audit_id_seq" OWNED BY "public"."dev_session_mutation_audit"."id";



CREATE TABLE IF NOT EXISTS "public"."digest_run_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_started_at" timestamp with time zone NOT NULL,
    "run_completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "eligible_users" integer DEFAULT 0 NOT NULL,
    "emails_sent" integer DEFAULT 0 NOT NULL,
    "emails_sent_quick" integer DEFAULT 0 NOT NULL,
    "push_sent" integer DEFAULT 0 NOT NULL,
    "push_failed" integer DEFAULT 0 NOT NULL,
    "push_no_tokens" integer DEFAULT 0 NOT NULL,
    "skipped" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "digest_run_stats_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."digest_run_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."digest_run_stats" IS 'Tracks execution statistics for forecast-digest-email cron runs';



CREATE TABLE IF NOT EXISTS "public"."email_click_events" (
    "id" bigint NOT NULL,
    "email_send_log_id" bigint,
    "resend_message_id" "text" NOT NULL,
    "webhook_message_id" "text",
    "clicked_at" timestamp with time zone NOT NULL,
    "link" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_click_events_link_not_blank" CHECK (("length"("btrim"("link")) > 0))
);


ALTER TABLE "public"."email_click_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_click_events" IS 'First-party record of Resend email click events. Stores clicked links and user agent only; raw IP addresses are intentionally omitted.';



COMMENT ON COLUMN "public"."email_click_events"."webhook_message_id" IS 'Svix webhook message id used to make webhook replays idempotent when present.';



COMMENT ON COLUMN "public"."email_click_events"."user_agent" IS 'Click user agent from Resend payload; raw IP address is intentionally not stored.';



CREATE SEQUENCE IF NOT EXISTS "public"."email_click_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."email_click_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."email_click_events_id_seq" OWNED BY "public"."email_click_events"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."email_send_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."email_send_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."email_send_log_id_seq" OWNED BY "public"."email_send_log"."id";



CREATE TABLE IF NOT EXISTS "public"."email_suppression_list" (
    "id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "suppressed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    CONSTRAINT "email_suppression_list_reason_check" CHECK (("reason" = ANY (ARRAY['hard_bounce'::"text", 'typo'::"text", 'manual'::"text", 'complaint'::"text"])))
);


ALTER TABLE "public"."email_suppression_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_suppression_list" IS 'Emails that should not receive outbound email. Checked by cron routes before sending.';



CREATE SEQUENCE IF NOT EXISTS "public"."email_suppression_list_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."email_suppression_list_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."email_suppression_list_id_seq" OWNED BY "public"."email_suppression_list"."id";



CREATE TABLE IF NOT EXISTS "public"."embed_impressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_type" "text" NOT NULL,
    "beach_slug" "text" NOT NULL,
    "referrer_domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '180 days'::interval) NOT NULL,
    CONSTRAINT "embed_impressions_widget_type_check" CHECK (("widget_type" = ANY (ARRAY['tides'::"text", 'conditions'::"text", 'surf-terminal'::"text", 'ticker'::"text"])))
);


ALTER TABLE "public"."embed_impressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enhanced_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "forecast_date" "date" NOT NULL,
    "forecast_time" time without time zone NOT NULL,
    "wave_height" "text",
    "wave_period" "text",
    "wave_direction" "text",
    "swell_1_height" "text",
    "swell_1_period" "text",
    "swell_1_direction" "text",
    "swell_2_height" "text",
    "swell_2_period" "text",
    "swell_2_direction" "text",
    "wind_wave_height" "text",
    "wind_wave_period" "text",
    "wind_wave_direction" "text",
    "water_temp" "text",
    "air_temperature" "text",
    "wind_speed" "text",
    "wind_direction" "text",
    "weather_condition" "text",
    "tide_status" "text",
    "tide_height" "text",
    "next_tide_time" "text",
    "next_tide_type" "text",
    "next_tide_height" "text",
    "confidence_score" integer DEFAULT 50 NOT NULL,
    "data_source" "text",
    "raw_forecast" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_tide_at" timestamp with time zone,
    "coops_station_id" "text",
    "forecast_at" timestamp with time zone NOT NULL,
    "wind_direction_deg" numeric,
    "wind_source" "text",
    "wave_height_om" real,
    "wave_period_om" real,
    "wave_direction_om" real,
    "swell_height_om" real,
    "swell_period_om" real,
    "swell_direction_om" real,
    "wind_wave_height_om" real,
    "om_fetched_at" timestamp with time zone
);


ALTER TABLE "public"."enhanced_forecasts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."enhanced_forecasts"."next_tide_at" IS 'UTC timestamp of next tide event (ISO 8601)';



COMMENT ON COLUMN "public"."enhanced_forecasts"."coops_station_id" IS 'NOAA CO-OPS station ID used for tide data (e.g., 9410230 for La Jolla)';



COMMENT ON COLUMN "public"."enhanced_forecasts"."wind_direction_deg" IS 'Wind direction in degrees (0-360), computed from cardinal direction text';



COMMENT ON COLUMN "public"."enhanced_forecasts"."wind_source" IS 'Source that last wrote wind columns. Priority: HRRR > NWS > OPEN_METEO_WIND > null. Higher-priority sources are not overwritten by lower-priority ones.';



CREATE TABLE IF NOT EXISTS "public"."fallback_events" (
    "id" bigint NOT NULL,
    "domain" "text" NOT NULL,
    "field" "text" NOT NULL,
    "fallback_value" "text",
    "severity" "text" NOT NULL,
    "reason" "text",
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fallback_events_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'dangerous'::"text"])))
);


ALTER TABLE "public"."fallback_events" OWNER TO "postgres";


ALTER TABLE "public"."fallback_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."fallback_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."favorite_beaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid",
    "rank" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "alerts_enabled" boolean DEFAULT false NOT NULL,
    "custom_spot_id" "uuid",
    CONSTRAINT "favorite_beaches_custom_alerts_disabled" CHECK ((("custom_spot_id" IS NULL) OR ("alerts_enabled" = false))),
    CONSTRAINT "favorite_beaches_exactly_one_target" CHECK ((("beach_id" IS NOT NULL) <> ("custom_spot_id" IS NOT NULL)))
);


ALTER TABLE "public"."favorite_beaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_accuracy_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "forecast_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "was_accurate" boolean NOT NULL,
    "actual_conditions" "jsonb",
    "notes" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."forecast_accuracy_votes" OWNER TO "postgres";


COMMENT ON TABLE "public"."forecast_accuracy_votes" IS 'Community verification votes for forecast accuracy. Users can vote on whether a forecast was accurate, with optional notes and photo evidence.';



COMMENT ON COLUMN "public"."forecast_accuracy_votes"."was_accurate" IS 'Boolean indicating if the user found the forecast accurate for their session.';



COMMENT ON COLUMN "public"."forecast_accuracy_votes"."actual_conditions" IS 'JSON object describing what the user actually observed (optional). Can include wave_height, wave_period, wind_speed, etc.';



COMMENT ON COLUMN "public"."forecast_accuracy_votes"."photo_url" IS 'Optional URL to a session photo that serves as evidence for the verification.';



CREATE TABLE IF NOT EXISTS "public"."forecast_alert_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "alert_type" "text" NOT NULL,
    "last_sent_at" timestamp with time zone,
    "last_matching_forecast_ts" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_alert_deliveries_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['forecast_threshold'::"text", 'daily_digest_email'::"text", 'conditions_alert'::"text", 'session_prompt'::"text", 'reengagement'::"text"])))
);


ALTER TABLE "public"."forecast_alert_deliveries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."forecast_alert_deliveries"."alert_type" IS 'Type of alert: forecast_threshold (push notification) or daily_digest_email (morning digest)';



COMMENT ON CONSTRAINT "forecast_alert_deliveries_alert_type_check" ON "public"."forecast_alert_deliveries" IS 'Allowed alert types: forecast_threshold, daily_digest_email, conditions_alert, session_prompt, reengagement';



CREATE TABLE IF NOT EXISTS "public"."forecast_feedback_contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "anonymous_client_id" "text",
    "beach_id" "uuid" NOT NULL,
    "forecast_at" timestamp with time zone NOT NULL,
    "window_start" timestamp with time zone,
    "window_end" timestamp with time zone,
    "issued_at" timestamp with time zone,
    "predicted_at" timestamp with time zone,
    "forecast_horizon_hours" integer,
    "feedback_kind" "text" NOT NULL,
    "feedback_value" "text" NOT NULL,
    "feedback_note" "text",
    "displayed_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_model_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "calibration_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "surf_call_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "missing_flags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "audit_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "client_source" "text" NOT NULL,
    "client_version" "text",
    "schema_version" integer DEFAULT 1 NOT NULL,
    "contract_version" "text" DEFAULT 'forecast-feedback-context.v1'::"text" NOT NULL,
    "ingest_path" "text" NOT NULL,
    "request_id" "text",
    "correlation_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_feedback_contexts_feedback_kind_check" CHECK (("feedback_kind" = ANY (ARRAY['forecast_accuracy'::"text", 'surf_call'::"text", 'condition_report'::"text", 'other'::"text"]))),
    CONSTRAINT "forecast_feedback_contexts_forecast_horizon_hours_check" CHECK ((("forecast_horizon_hours" IS NULL) OR (("forecast_horizon_hours" >= 0) AND ("forecast_horizon_hours" <= 168)))),
    CONSTRAINT "forecast_feedback_contexts_schema_version_check" CHECK (("schema_version" >= 1)),
    CONSTRAINT "forecast_feedback_window_order" CHECK ((("window_start" IS NULL) OR ("window_end" IS NULL) OR ("window_start" <= "window_end")))
);


ALTER TABLE "public"."forecast_feedback_contexts" OWNER TO "postgres";


COMMENT ON TABLE "public"."forecast_feedback_contexts" IS 'Forecast feedback context rows captured with displayed forecast, source/model, calibration, surf-call, missing-context, and audit metadata. Phase 1 storage only; not a training label source.';



CREATE TABLE IF NOT EXISTS "public"."intel_post_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intel_post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."intel_post_confirmations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."intel_post_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intel_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid",
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "tag" "public"."intel_post_tag" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "photo_url" "text",
    "photo_storage_path" "text",
    "confirmations_count" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "surf_conditions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dedupe_hash" "text",
    "emoji_rating" "text",
    "report_count" integer DEFAULT 0 NOT NULL,
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "off_count" integer DEFAULT 0 NOT NULL,
    "confirmed_count" integer DEFAULT 0 NOT NULL,
    "wave_size_range" "text",
    "vibe" "text",
    CONSTRAINT "intel_posts_emoji_rating_check" CHECK (("emoji_rating" = ANY (ARRAY['fire'::"text", 'shaka'::"text", 'meh'::"text", 'thumbsdown'::"text"]))),
    CONSTRAINT "intel_posts_vibe_check" CHECK ((("vibe" IS NULL) OR ("vibe" = ANY (ARRAY['firing'::"text", 'fun'::"text", 'meh'::"text", 'rough'::"text"])))),
    CONSTRAINT "intel_posts_wave_size_range_check" CHECK ((("wave_size_range" IS NULL) OR ("wave_size_range" = ANY (ARRAY['1-2ft'::"text", '2-3ft'::"text", '3-4ft'::"text", '4-5ft'::"text", '5+ft'::"text"]))))
);

ALTER TABLE ONLY "public"."intel_posts" REPLICA IDENTITY FULL;


ALTER TABLE "public"."intel_posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."intel_posts"."photo_url" IS 'Public URL to intel post photo. May reference intel-photos storage bucket or external source.';



COMMENT ON COLUMN "public"."intel_posts"."photo_storage_path" IS 'Path to photo in intel-photos storage bucket (if applicable).
        When deactivating intel post (is_active=false), consider if associated photo should be removed.';



COMMENT ON COLUMN "public"."intel_posts"."is_active" IS 'Serves as soft delete flag for intel posts. FALSE means deleted/inactive. Use WHERE is_active = true in queries. Intel posts use is_active instead of deleted_at for architectural consistency.';



COMMENT ON COLUMN "public"."intel_posts"."dedupe_hash" IS 'Deterministic hash of user, beach, location, and normalized intel content for deduplication.';



CREATE TABLE IF NOT EXISTS "public"."intel_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intel_post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intel_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intel_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intel_post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote_type" "public"."intel_vote_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."intel_votes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."intel_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ioos_observations" (
    "id" bigint NOT NULL,
    "station_id" "text",
    "observed_at" timestamp with time zone NOT NULL,
    "wave_height_m" numeric,
    "wave_period_s" numeric,
    "wave_direction_deg" numeric,
    "water_temp_c" numeric,
    "wind_speed_ms" numeric,
    "wind_direction_deg" numeric,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'ioos_erddap'::"text" NOT NULL,
    CONSTRAINT "chk_observation_source" CHECK (("source" = ANY (ARRAY['ioos_erddap'::"text", 'ndbc_direct'::"text"])))
);


ALTER TABLE "public"."ioos_observations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ioos_observations" IS 'Historical wave observations for ML training, 90-day retention';



COMMENT ON COLUMN "public"."ioos_observations"."raw_data" IS 'Original API response for debugging';



COMMENT ON COLUMN "public"."ioos_observations"."source" IS 'Data source: ioos_erddap (primary) or ndbc_direct (fallback when ERDDAP fails)';



CREATE SEQUENCE IF NOT EXISTS "public"."ioos_observations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."ioos_observations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ioos_observations_id_seq" OWNED BY "public"."ioos_observations"."id";



CREATE TABLE IF NOT EXISTS "public"."marine_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "ts" timestamp with time zone NOT NULL,
    "wave_height_m" numeric,
    "wave_period_s" numeric,
    "wave_direction_deg" numeric,
    "wind_speed_ms" numeric,
    "wind_direction_deg" numeric,
    "source" "text" NOT NULL,
    "is_observed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ts_utc" timestamp with time zone GENERATED ALWAYS AS ("ts") STORED,
    "hs_m" real GENERATED ALWAYS AS (
CASE
    WHEN ("wave_height_m" IS NULL) THEN NULL::real
    ELSE ("wave_height_m")::real
END) STORED,
    "tp_s" real GENERATED ALWAYS AS (
CASE
    WHEN ("wave_period_s" IS NULL) THEN NULL::real
    ELSE ("wave_period_s")::real
END) STORED,
    "swell_dir_deg" integer GENERATED ALWAYS AS (
CASE
    WHEN ("wave_direction_deg" IS NULL) THEN NULL::integer
    ELSE ("wave_direction_deg")::integer
END) STORED,
    "wind_spd_kts" real GENERATED ALWAYS AS (
CASE
    WHEN ("wind_speed_ms" IS NULL) THEN NULL::real
    ELSE (("wind_speed_ms" * 1.94384449))::real
END) STORED,
    "wind_dir_deg" integer GENERATED ALWAYS AS (
CASE
    WHEN ("wind_direction_deg" IS NULL) THEN NULL::integer
    ELSE ("wind_direction_deg")::integer
END) STORED,
    CONSTRAINT "marine_forecasts_source_check" CHECK (("source" = ANY (ARRAY['open-meteo'::"text", 'cdip'::"text", 'ndbc'::"text", 'cdip_persistence'::"text", 'ndbc_persistence'::"text", 'nws_wind'::"text"])))
);


ALTER TABLE "public"."marine_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ml_calibration_versions" (
    "version" "text" NOT NULL,
    "fitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "train_window_start" timestamp with time zone NOT NULL,
    "train_window_end" timestamp with time zone NOT NULL,
    "train_n" integer NOT NULL,
    "knots" "jsonb" NOT NULL,
    "g_dir" "jsonb" NOT NULL,
    "guardrails" "jsonb",
    "is_active" boolean DEFAULT false NOT NULL,
    "notes" "text",
    CONSTRAINT "ml_calibration_versions_check" CHECK (("train_window_end" > "train_window_start")),
    CONSTRAINT "ml_calibration_versions_train_n_check" CHECK (("train_n" > 0))
);


ALTER TABLE "public"."ml_calibration_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ml_calibration_versions" IS 'v5 shadow calibration registry. Each row is a fitted (f(om), g(direction)) calibration. Written weekly by Seaside cron refit-calibration; read by Quiver web logDisplayPredictions to compute v5_shadow_height_m at issue time. Phase 2 of v5 shadow program — never serves user-facing values.';



COMMENT ON COLUMN "public"."ml_calibration_versions"."knots" IS 'f(om) knot anchors per OM-predicted-height bucket. Each bucket maps to {om_anchor, obs, n}. Read-time interpolation uses (om_anchor, obs) pairs as a saturating piecewise-linear curve.';



COMMENT ON COLUMN "public"."ml_calibration_versions"."g_dir" IS 'g(direction) residual constants per direction bucket. Fit as mean(observed_m - f(wave_height_om)) over train rows. Applied additively at inference: v5 = f(om) + g(dir).';



COMMENT ON COLUMN "public"."ml_calibration_versions"."guardrails" IS 'Per-cell overrides that pass through raw OM instead of f+g. Locked v5 entry: W × 0.5-1.0m (the walk-forward FAIL cell). May expand if future audits flag more cells.';



CREATE TABLE IF NOT EXISTS "public"."ml_model_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" "text" NOT NULL,
    "training_window_days" integer NOT NULL,
    "training_samples" integer NOT NULL,
    "training_started_at" timestamp with time zone,
    "training_completed_at" timestamp with time zone,
    "holdout_improvement_pct" numeric(5,2),
    "holdout_raw_mae" numeric(5,3),
    "holdout_corrected_mae" numeric(5,3),
    "deployed_at" timestamp with time zone,
    "production_improvement_pct" numeric(5,2),
    "status" "text" DEFAULT 'training'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "training_diagnostics" "jsonb",
    CONSTRAINT "ml_model_registry_status_check" CHECK (("status" = ANY (ARRAY['training'::"text", 'validated'::"text", 'deployed'::"text", 'rolled_back'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ml_model_registry" OWNER TO "postgres";


COMMENT ON TABLE "public"."ml_model_registry" IS 'Tracks ML model versions, training metadata, validation metrics, and production performance. Used for model lifecycle management and rollback.';



COMMENT ON COLUMN "public"."ml_model_registry"."version" IS 'Model version string (e.g., v3.20260202). Must be unique.';



COMMENT ON COLUMN "public"."ml_model_registry"."training_window_days" IS 'Number of days of training data used (max 365)';



COMMENT ON COLUMN "public"."ml_model_registry"."holdout_improvement_pct" IS 'Percentage of predictions improved on holdout set (must be >50% to deploy)';



COMMENT ON COLUMN "public"."ml_model_registry"."production_improvement_pct" IS 'Actual improvement percentage in production (calculated from ml_predictions_log)';



COMMENT ON COLUMN "public"."ml_model_registry"."status" IS 'Lifecycle status: training (in progress), validated (passed gates), deployed (active in production), rolled_back (reverted due to poor performance), failed (training or validation failed)';



COMMENT ON COLUMN "public"."ml_model_registry"."training_diagnostics" IS 'Training-time diagnostics: feature_importances, exclude_wind, bucket gate results, etc. Written by seaside/crons/retrain.py step 4 from the TrainResponse.training_diagnostics field.';



CREATE MATERIALIZED VIEW "public"."mv_beach_amenities" AS
 SELECT "bas"."beach_id",
    "bool_or"("cal"."has_parking") AS "has_parking",
    "bool_or"("cal"."has_fee") AS "has_fee",
    "bool_or"("cal"."has_restrooms") AS "has_restrooms",
    "bool_or"("cal"."has_ada_access") AS "has_ada_access",
    "bool_or"("cal"."has_dog_friendly") AS "has_dog_friendly",
    "bool_or"("cal"."has_stroller_friendly") AS "has_stroller_friendly",
    "bool_or"("cal"."has_campground") AS "has_campground",
    "bool_or"("cal"."has_boating") AS "has_boating",
    "bool_or"("cal"."has_fishing") AS "has_fishing",
    "bool_or"("cal"."has_picnic_area") AS "has_picnic_area",
    "bool_or"("cal"."has_volleyball") AS "has_volleyball",
    "bool_or"("cal"."has_bike_path") AS "has_bike_path",
    "bool_or"("cal"."has_tidepools") AS "has_tidepools",
    "bool_or"("cal"."has_sandy_beach") AS "has_sandy_beach",
    "bool_or"("cal"."has_rocky_shore") AS "has_rocky_shore",
    "bool_or"("cal"."has_bluff_trail") AS "has_bluff_trail",
    "bool_or"("cal"."has_wildlife_viewing") AS "has_wildlife_viewing",
    "bool_or"("cal"."has_visitor_center") AS "has_visitor_center",
    ("count"(*))::integer AS "source_count",
    "min"("bas"."distance_m") AS "nearest_source_m"
   FROM ("public"."beach_amenity_sources" "bas"
     JOIN "public"."ccc_access_locations" "cal" ON (("cal"."id" = "bas"."ccc_location_id")))
  GROUP BY "bas"."beach_id"
  WITH NO DATA;


ALTER TABLE "public"."mv_beach_amenities" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."mv_beach_amenities" IS 'Aggregated CCC amenity flags per beach. One row per beach_id. Amenity flags are the logical OR of all linked CCC access locations. Refreshed via refresh_mv_beach_amenities() on each CCC sync cycle.';



CREATE TABLE IF NOT EXISTS "public"."ndbc_direct_observations" (
    "id" bigint NOT NULL,
    "station_id" "text",
    "observed_at" timestamp with time zone NOT NULL,
    "wave_height_m" numeric,
    "wave_period_s" numeric,
    "wave_direction_deg" numeric,
    "water_temp_c" numeric,
    "wind_speed_ms" numeric,
    "wind_direction_deg" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ndbc_direct_observations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ndbc_direct_observations" IS 'Historical wave/wind/temp observations from NDBC direct feeds. Append-only with 90-day retention target.';



CREATE SEQUENCE IF NOT EXISTS "public"."ndbc_direct_observations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."ndbc_direct_observations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ndbc_direct_observations_id_seq" OWNED BY "public"."ndbc_direct_observations"."id";



CREATE TABLE IF NOT EXISTS "public"."ndbc_direct_stations" (
    "station_id" "text" NOT NULL,
    "name" "text",
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "coordinates" "public"."geometry"(Point,4326),
    "station_type" "text",
    "has_wave_data" boolean DEFAULT false,
    "nearest_beach_id" "uuid",
    "distance_to_beach_km" numeric,
    "ioos_station_id" "text",
    "active" boolean DEFAULT true,
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ndbc_direct_stations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ndbc_direct_stations" IS 'NDBC station metadata fetched directly from NDBC feeds. Covers 137+ wave-data stations not available in IOOS ERDDAP.';



COMMENT ON COLUMN "public"."ndbc_direct_stations"."station_id" IS 'Bare NDBC station ID, e.g. "46225" (no wmo_ prefix)';



COMMENT ON COLUMN "public"."ndbc_direct_stations"."station_type" IS 'NDBC platform type: "buoy", "cman", "dart", etc.';



COMMENT ON COLUMN "public"."ndbc_direct_stations"."ioos_station_id" IS 'Cross-reference to ioos_stations.station_id (e.g. "wmo_46225") for dedup. NULL if station is exclusive to NDBC direct.';



CREATE TABLE IF NOT EXISTS "public"."notification_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_event_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_response" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "notification_delivery_attempts_channel_check" CHECK (("channel" = ANY (ARRAY['push'::"text", 'in_app'::"text", 'email'::"text"]))),
    CONSTRAINT "notification_delivery_attempts_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'skipped_no_device'::"text", 'skipped_pref_master'::"text", 'skipped_pref_type'::"text", 'skipped_self'::"text", 'skipped_dedup'::"text", 'skipped_disabled'::"text", 'skipped_cooldown'::"text", 'deferred_quiet_hours'::"text", 'failed_provider'::"text", 'failed_internal'::"text"])))
);


ALTER TABLE "public"."notification_delivery_attempts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notification_delivery_attempts"."attempt_number" IS 'Which retry attempt this row records (1-indexed). Worker copies the parent event.attempt_count at write time.';



CREATE TABLE IF NOT EXISTS "public"."notification_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "local_forecast_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_send_log_notification_type_check" CHECK (("notification_type" = 'daily_forecast'::"text"))
);


ALTER TABLE "public"."notification_send_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_send_log" IS 'Durable per-user/per-beach/per-local-date notification send claims for producer idempotency.';



COMMENT ON COLUMN "public"."notification_send_log"."local_forecast_date" IS 'Forecast-local date used for daily forecast push idempotency.';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_nonempty_check" CHECK ((("type" IS NOT NULL) AND ("length"("type") > 0)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."npc_content_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "personality" "text" NOT NULL,
    "tag" "text",
    "template" "text" NOT NULL,
    "variables" "text"[] NOT NULL,
    "use_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "npc_content_templates_content_type_check" CHECK (("content_type" = ANY (ARRAY['intel'::"text", 'session_note'::"text", 'review'::"text"]))),
    CONSTRAINT "npc_content_templates_personality_check" CHECK (("personality" = ANY (ARRAY['rookie'::"text", 'local'::"text", 'traveler'::"text", 'photographer'::"text", 'tactical'::"text", 'competitor'::"text", 'forecaster'::"text"])))
);


ALTER TABLE "public"."npc_content_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."npc_content_templates" IS 'AI-generated content templates for NPC (mock user) posts. Templates contain {{variables}} that are hydrated with real forecast data at runtime.';



CREATE MATERIALIZED VIEW "public"."observable_beaches" AS
 SELECT DISTINCT "s"."nearest_beach_id" AS "beach_id"
   FROM "public"."ioos_stations" "s"
  WHERE (("s"."active" = true) AND ("s"."has_wave_data" = true) AND ("s"."nearest_beach_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."ioos_observations" "o"
          WHERE (("o"."station_id" = "s"."station_id") AND ("o"."wave_height_m" IS NOT NULL) AND ("o"."observed_at" > ("now"() - '24:00:00'::interval))))))
UNION
 SELECT DISTINCT "b"."id" AS "beach_id"
   FROM "public"."beaches" "b"
  WHERE (("b"."deleted_at" IS NULL) AND (EXISTS ( SELECT 1
           FROM ("public"."ioos_stations" "s"
             JOIN "public"."beaches" "nb" ON (("nb"."id" = "s"."nearest_beach_id")))
          WHERE (("s"."active" = true) AND ("s"."has_wave_data" = true) AND "public"."st_dwithin"("b"."geog", ("s"."coordinates")::"public"."geography", (25000)::double precision) AND ("public"."swell_windows_overlap"(("b"."swell_window_min_deg")::numeric, ("b"."swell_window_max_deg")::numeric, ("nb"."swell_window_min_deg")::numeric, ("nb"."swell_window_max_deg")::numeric) >= (30)::numeric) AND (EXISTS ( SELECT 1
                   FROM "public"."ioos_observations" "o"
                  WHERE (("o"."station_id" = "s"."station_id") AND ("o"."wave_height_m" IS NOT NULL) AND ("o"."observed_at" > ("now"() - '48:00:00'::interval)))))))))
UNION
 SELECT DISTINCT "s"."nearest_beach_id" AS "beach_id"
   FROM "public"."ndbc_direct_stations" "s"
  WHERE (("s"."active" = true) AND ("s"."has_wave_data" = true) AND ("s"."nearest_beach_id" IS NOT NULL) AND (("s"."ioos_station_id" IS NULL) OR (NOT (EXISTS ( SELECT 1
           FROM "public"."ioos_stations" "iss"
          WHERE (("iss"."station_id" = "s"."ioos_station_id") AND ("iss"."active" = true)))))) AND (EXISTS ( SELECT 1
           FROM "public"."ndbc_direct_observations" "o"
          WHERE (("o"."station_id" = "s"."station_id") AND ("o"."wave_height_m" IS NOT NULL) AND ("o"."observed_at" > ("now"() - '24:00:00'::interval))))))
UNION
 SELECT DISTINCT "b"."id" AS "beach_id"
   FROM "public"."beaches" "b"
  WHERE (("b"."deleted_at" IS NULL) AND (EXISTS ( SELECT 1
           FROM ("public"."ndbc_direct_stations" "s"
             JOIN "public"."beaches" "nb" ON (("nb"."id" = "s"."nearest_beach_id")))
          WHERE (("s"."active" = true) AND ("s"."has_wave_data" = true) AND (("s"."ioos_station_id" IS NULL) OR (NOT (EXISTS ( SELECT 1
                   FROM "public"."ioos_stations" "iss"
                  WHERE (("iss"."station_id" = "s"."ioos_station_id") AND ("iss"."active" = true)))))) AND "public"."st_dwithin"("b"."geog", ("s"."coordinates")::"public"."geography", (25000)::double precision) AND ("public"."swell_windows_overlap"(("b"."swell_window_min_deg")::numeric, ("b"."swell_window_max_deg")::numeric, ("nb"."swell_window_min_deg")::numeric, ("nb"."swell_window_max_deg")::numeric) >= (30)::numeric) AND (EXISTS ( SELECT 1
                   FROM "public"."ndbc_direct_observations" "o"
                  WHERE (("o"."station_id" = "s"."station_id") AND ("o"."wave_height_m" IS NOT NULL) AND ("o"."observed_at" > ("now"() - '48:00:00'::interval)))))))))
  WITH NO DATA;


ALTER TABLE "public"."observable_beaches" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."observable_beaches" IS 'Beaches with ground truth observation sources for ML training. Four paths: (A) IOOS direct station mapping (24h recency), (B) IOOS spatial proximity 25km with >= 30 deg swell overlap (48h recency), (C) NDBC direct station mapping, NDBC-exclusive only (24h recency), (D) NDBC direct spatial proximity 25km with >= 30 deg swell overlap (48h recency). Expanded Apr 2026 from 15km/IOOS-only to 25km/IOOS+NDBC. Refreshed every 2h by /api/cron/ioos-sync?phase=observations.';



CREATE TABLE IF NOT EXISTS "public"."pending_alert_captures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "preset_type" "text" NOT NULL,
    "return_path" "text" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "consumed_at" timestamp with time zone,
    "consumed_user_id" "uuid",
    CONSTRAINT "pending_alert_captures_email_check" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "pending_alert_captures_preset_type_check" CHECK (("preset_type" = ANY (ARRAY['glass_off'::"text", 'big_day'::"text", 'mellow_session'::"text"])))
);


ALTER TABLE "public"."pending_alert_captures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalization_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "milestone_key" "text" NOT NULL,
    "achieved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shown_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."personalization_milestones" OWNER TO "postgres";


COMMENT ON TABLE "public"."personalization_milestones" IS 'Tracks user personalization milestones for progress messaging and celebration UI';



CREATE TABLE IF NOT EXISTS "public"."posting_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_type" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "cadence_phase" "text" DEFAULT 'daily'::"text" NOT NULL,
    "last_posted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "posting_config_cadence_phase_check" CHECK (("cadence_phase" = ANY (ARRAY['daily'::"text", 'settled'::"text"]))),
    CONSTRAINT "posting_config_post_type_check" CHECK (("post_type" = ANY (ARRAY['go_no'::"text", 'weekend_wave'::"text", 'longboard_sunday'::"text", 'dev_notes'::"text"])))
);


ALTER TABLE "public"."posting_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posting_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_type" "text" NOT NULL,
    "bluesky_uri" "text",
    "content_text" "text" NOT NULL,
    "image_url" "text",
    "template_index" integer,
    "beaches_featured" "text"[],
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "posting_log_post_type_check" CHECK (("post_type" = ANY (ARRAY['go_no'::"text", 'weekend_wave'::"text", 'longboard_sunday'::"text", 'dev_notes'::"text"])))
);


ALTER TABLE "public"."posting_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_with_home_beach" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."full_name",
    "p"."created_at",
    "p"."email_session_invites",
    "p"."inapp_session_invites",
    "p"."digest_session_invites",
    "p"."followers_count",
    "p"."following_count",
    "p"."is_mock",
    "p"."avatar_url",
    "p"."email",
    "p"."phone_number",
    "p"."bio",
    "p"."location",
    "p"."experience_level",
    "p"."instagram",
    "p"."updated_at",
    "p"."home_beach_id",
    "p"."onboarding_completed_at",
    "b"."name" AS "home_beach_name"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."beaches" "b" ON (("b"."id" = "p"."home_beach_id")));


ALTER TABLE "public"."profiles_with_home_beach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referee_id" "uuid" NOT NULL,
    "referral_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'referral_code'::"text" NOT NULL,
    CONSTRAINT "referrals_completed_at_when_completed" CHECK (((("status" = 'completed'::"text") AND ("completed_at" IS NOT NULL)) OR (("status" <> 'completed'::"text") AND ("completed_at" IS NULL)))),
    CONSTRAINT "referrals_no_self_referral" CHECK (("referrer_id" <> "referee_id")),
    CONSTRAINT "referrals_source_check" CHECK (("source" = ANY (ARRAY['referral_code'::"text", 'invite_token'::"text"]))),
    CONSTRAINT "referrals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


COMMENT ON TABLE "public"."referrals" IS 'Tracks user referrals. Created when a new user signs up with a referral code.';



COMMENT ON COLUMN "public"."referrals"."referrer_id" IS 'User who created and shared the referral code';



COMMENT ON COLUMN "public"."referrals"."referee_id" IS 'User who signed up using the referral code (can only be referred once)';



COMMENT ON COLUMN "public"."referrals"."referral_code" IS 'The actual code entered (stored for audit/analytics purposes)';



COMMENT ON COLUMN "public"."referrals"."status" IS 'pending: just signed up; completed: finished onboarding; expired: code no longer valid';



COMMENT ON COLUMN "public"."referrals"."source" IS 'Attribution source for the referral row: referral_code for explicit code claims, invite_token for accepted invite links.';



CREATE TABLE IF NOT EXISTS "public"."roadmap_item_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "public"."roadmap_category" NOT NULL,
    "submitter_user_id" "uuid" NOT NULL,
    "decision" "public"."roadmap_submission_decision" DEFAULT 'pending'::"public"."roadmap_submission_decision" NOT NULL,
    "merged_into_item_id" "uuid",
    "founder_reply" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roadmap_item_submissions_description_check" CHECK ((("char_length"("description") >= 1) AND ("char_length"("description") <= 500))),
    CONSTRAINT "roadmap_item_submissions_founder_reply_check" CHECK ((("founder_reply" IS NULL) OR ("char_length"("founder_reply") <= 1000))),
    CONSTRAINT "roadmap_item_submissions_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 60)))
);


ALTER TABLE "public"."roadmap_item_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "public"."roadmap_category" NOT NULL,
    "status" "public"."roadmap_status" DEFAULT 'under_consideration'::"public"."roadmap_status" NOT NULL,
    "eta_label" "text",
    "founder_reply" "text",
    "shipped_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roadmap_items_description_check" CHECK ((("char_length"("description") >= 1) AND ("char_length"("description") <= 500))),
    CONSTRAINT "roadmap_items_eta_label_check" CHECK ((("eta_label" IS NULL) OR ("char_length"("eta_label") <= 40))),
    CONSTRAINT "roadmap_items_founder_reply_check" CHECK ((("founder_reply" IS NULL) OR ("char_length"("founder_reply") <= 1000))),
    CONSTRAINT "roadmap_items_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 60)))
);


ALTER TABLE "public"."roadmap_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_votes" (
    "item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roadmap_votes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."roadmap_items_with_vote_count" WITH ("security_invoker"='true') AS
 SELECT "i"."id",
    "i"."title",
    "i"."description",
    "i"."category",
    "i"."status",
    "i"."eta_label",
    "i"."founder_reply",
    "i"."shipped_at",
    "i"."created_at",
    "i"."updated_at",
    (COALESCE("v"."vote_count", (0)::bigint))::integer AS "vote_count"
   FROM ("public"."roadmap_items" "i"
     LEFT JOIN ( SELECT "roadmap_votes"."item_id",
            "count"(*) AS "vote_count"
           FROM "public"."roadmap_votes"
          GROUP BY "roadmap_votes"."item_id") "v" ON (("v"."item_id" = "i"."id")));


ALTER TABLE "public"."roadmap_items_with_vote_count" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_windows" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "start_ts" timestamp with time zone NOT NULL,
    "end_ts" timestamp with time zone NOT NULL,
    "source" "text" DEFAULT 'email'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "saved_windows_source_check" CHECK (("source" = ANY (ARRAY['email'::"text", 'app'::"text"])))
);


ALTER TABLE "public"."saved_windows" OWNER TO "postgres";


COMMENT ON TABLE "public"."saved_windows" IS 'Surf windows saved by users from emails or app';



CREATE SEQUENCE IF NOT EXISTS "public"."saved_windows_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."saved_windows_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."saved_windows_id_seq" OWNED BY "public"."saved_windows"."id";



CREATE TABLE IF NOT EXISTS "public"."session_forecast_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "forecast_snapshot" "jsonb" NOT NULL,
    "actual_conditions" "jsonb" NOT NULL,
    "forecast_confidence_score" integer,
    "data_source" "text",
    "session_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "forecast_vs_actual" "jsonb"
);


ALTER TABLE "public"."session_forecast_snapshots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."session_forecast_snapshots"."forecast_vs_actual" IS 'Calculated diff between forecast and actual conditions. Only includes fields where both values exist and differ. Format: { field_name: { forecast: value, actual: value, diff: numeric_diff } }';



CREATE TABLE IF NOT EXISTS "public"."session_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "invitee_id" "uuid",
    "invitee_email" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "idempotency_key" "text",
    "seen_at" timestamp with time zone,
    CONSTRAINT "session_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."session_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone,
    "rating" "text" NOT NULL,
    "notes" "text",
    "source" "text" DEFAULT 'email'::"text" NOT NULL,
    "predicted_score" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_logs_rating_check" CHECK (("rating" = ANY (ARRAY['skip'::"text", 'good'::"text", 'fired'::"text"]))),
    CONSTRAINT "session_logs_source_check" CHECK (("source" = ANY (ARRAY['email'::"text", 'app'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."session_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_logs" IS 'User feedback on surf sessions - used to personalize future recommendations';



CREATE SEQUENCE IF NOT EXISTS "public"."session_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."session_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."session_logs_id_seq" OWNED BY "public"."session_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."session_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "file_size" integer DEFAULT 0 NOT NULL,
    "media_type" "text" DEFAULT 'photo'::"text" NOT NULL,
    "caption" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "session_media_file_size_positive" CHECK (("file_size" >= 0)),
    CONSTRAINT "session_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['photo'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."session_media" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_media" IS 'Session media (photos/videos) storage tracking table.

STORAGE CONTRACT:
- Files stored in "session-media" Supabase storage bucket
- storage_path must match actual file path in bucket
- public_url should be generated from storage bucket public URL

DELETION REQUIREMENTS:
When deleting media, TWO operations are required:
1. Database: Set deleted_at = NOW() on this table (soft delete)
2. Storage: Remove file from session-media bucket using storage_path

IMPORTANT: Failing to remove storage files will result in orphaned files
and wasted storage space. Always perform both operations in admin actions.

Example deletion flow:
  1. UPDATE session_media SET deleted_at = NOW() WHERE id = ?
  2. DELETE FROM storage.objects WHERE bucket_id = ''session-media'' AND name = storage_path

For admin operations, use the cleanup_session_media_storage() function
which handles the database soft-delete and returns the storage path
for cleanup in the application layer.';



COMMENT ON COLUMN "public"."session_media"."storage_path" IS 'Path to file in session-media storage bucket. Format: user_id/session_id/filename.ext
CRITICAL: When soft-deleting this record, also remove file from storage bucket using this path.';



COMMENT ON COLUMN "public"."session_media"."public_url" IS 'Public URL for accessing the media file. Generated from Supabase storage public URL + storage_path.
Example: https://[project].supabase.co/storage/v1/object/public/session-media/[storage_path]';



COMMENT ON COLUMN "public"."session_media"."deleted_at" IS 'Soft delete timestamp. NULL = active media.
When set: Media is hidden from app but storage file may still exist.
Admin must ensure corresponding storage file is also removed.';



CREATE TABLE IF NOT EXISTS "public"."session_media_history" (
    "history_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id" "uuid" NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "storage_path" "text",
    "public_url" "text",
    "file_size" integer,
    "media_type" "text",
    "caption" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid",
    "change_type" "text" NOT NULL,
    CONSTRAINT "session_media_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."session_media_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_media_history" IS 'Audit trail for session_media table. Captures snapshots on UPDATE/DELETE operations.';



CREATE TABLE IF NOT EXISTS "public"."session_share_links" (
    "share_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "share_url" "text" NOT NULL,
    "surface" "text" DEFAULT 'session_detail'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_share_links_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'x'::"text", 'twitter'::"text", 'facebook'::"text", 'tiktok'::"text", 'copy'::"text", 'native'::"text", 'other'::"text", 'generic'::"text", 'download'::"text"]))),
    CONSTRAINT "session_share_links_surface_check" CHECK (("surface" = ANY (ARRAY['session_detail'::"text", 'profile'::"text"])))
);


ALTER TABLE "public"."session_share_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_share_links" IS 'Per-link session share attribution. Does not capture recipient identity or mutate session share_count.';



COMMENT ON COLUMN "public"."session_share_links"."share_id" IS 'Opaque ID appended to low-friction shared session URLs as share_id.';



CREATE TABLE IF NOT EXISTS "public"."session_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "share_url" "text",
    "variant" "text" DEFAULT 'story'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "share_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "aspect_ratio" "text",
    CONSTRAINT "check_aspect_ratio" CHECK ((("aspect_ratio" IS NULL) OR ("aspect_ratio" = ANY (ARRAY['1:1'::"text", '4:5'::"text", '9:16'::"text"])))),
    CONSTRAINT "check_platform" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'x'::"text", 'twitter'::"text", 'facebook'::"text", 'tiktok'::"text", 'copy'::"text", 'native'::"text", 'other'::"text", 'generic'::"text", 'download'::"text"]))),
    CONSTRAINT "check_variant" CHECK ((("variant" IS NULL) OR ("variant" = ANY (ARRAY['story'::"text", 'square'::"text", '1'::"text", '2'::"text", '3'::"text", '4'::"text", '5'::"text", '6'::"text"])))),
    CONSTRAINT "session_shares_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'tiktok'::"text", 'twitter'::"text", 'facebook'::"text", 'copy'::"text", 'native'::"text", 'other'::"text"]))),
    CONSTRAINT "session_shares_variant_check" CHECK (("variant" = ANY (ARRAY['story'::"text", 'square'::"text"])))
);


ALTER TABLE "public"."session_shares" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_shares" IS 'Tracks social media shares of surf sessions for viral growth analytics';



COMMENT ON COLUMN "public"."session_shares"."platform" IS 'Platform where session was shared: instagram, x, facebook, generic, or download';



COMMENT ON COLUMN "public"."session_shares"."share_url" IS 'Generated share URL with UTM parameters for tracking';



COMMENT ON COLUMN "public"."session_shares"."variant" IS 'Share card variant: legacy values (story, square) or numeric variants (1-6 as text)';



COMMENT ON COLUMN "public"."session_shares"."share_date" IS 'Date of share (used for daily uniqueness constraint)';



COMMENT ON COLUMN "public"."session_shares"."aspect_ratio" IS 'Image aspect ratio for the shared card: 1:1 (square), 4:5 (portrait), or 9:16 (story)';



COMMENT ON CONSTRAINT "check_platform" ON "public"."session_shares" IS 'Ensures platform is one of the supported share platforms. Includes legacy platforms for backward compatibility.';



CREATE TABLE IF NOT EXISTS "public"."session_wave_observation_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "beach_id" "uuid",
    "ml_prediction_id" "uuid",
    "observed_at" timestamp with time zone,
    "reported_wave_height_ft" numeric,
    "observed_m" numeric,
    "nearest_prediction_delta_minutes" numeric,
    "observation_source" "text" DEFAULT 'user_session'::"text" NOT NULL,
    "quality_state" "text" DEFAULT 'weak'::"text" NOT NULL,
    "rejection_reason" "text",
    "observation_weight" numeric DEFAULT 0.2 NOT NULL,
    "source_created_by" "text" DEFAULT 'trigger'::"text" NOT NULL,
    "matched_prediction_at" timestamp with time zone,
    "snapshot_display_height_m" numeric,
    "snapshot_raw_om_height_m" numeric,
    "snapshot_v5_shadow_height_m" numeric,
    "snapshot_buoy_observed_m" numeric,
    "snapshot_raw_forecast_m" numeric,
    "snapshot_corrected_forecast_m" numeric,
    "snapshot_model_version" "text",
    "snapshot_v5_model_version" "text",
    "snapshot_candidate_model_version" "text",
    "snapshot_display_source" "text",
    "forecast_horizon_hours" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_wave_observation_candidates_created_by_check" CHECK (("source_created_by" = ANY (ARRAY['trigger'::"text", 'backfill'::"text"]))),
    CONSTRAINT "session_wave_observation_candidates_quality_check" CHECK (("quality_state" = ANY (ARRAY['weak'::"text", 'calibrated_user'::"text", 'consensus'::"text", 'rejected'::"text"]))),
    CONSTRAINT "session_wave_observation_candidates_source_check" CHECK (("observation_source" = 'user_session'::"text")),
    CONSTRAINT "session_wave_observation_candidates_weight_check" CHECK ((("observation_weight" >= (0)::numeric) AND ("observation_weight" <= (1)::numeric)))
);


ALTER TABLE "public"."session_wave_observation_candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_wave_observation_candidates" IS 'Weak user-session wave-height observations for analytics and future reviewed ML experiments. These rows never update ml_predictions_log.observed_m.';



COMMENT ON COLUMN "public"."session_wave_observation_candidates"."observation_weight" IS 'Informational weak-label weight. Current ML training, gates, offsets, drift checks, and accuracy metrics do not consume this table.';



CREATE TABLE IF NOT EXISTS "public"."spot_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "rec_id" "uuid",
    "accurate" boolean NOT NULL,
    "reasons" "text"[],
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "spot_feedback_note_check" CHECK (("char_length"("note") <= 280))
);


ALTER TABLE "public"."spot_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_bucket_docs" (
    "bucket_name" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "path_pattern" "text" NOT NULL,
    "deletion_policy" "text" NOT NULL,
    "max_file_size" "text",
    "allowed_types" "text"[],
    "public_access" boolean DEFAULT false NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."storage_bucket_docs" OWNER TO "postgres";


COMMENT ON TABLE "public"."storage_bucket_docs" IS 'Documentation table describing Supabase storage buckets used by the application.
This is a metadata table for developer reference.';



CREATE TABLE IF NOT EXISTS "public"."storage_usage" (
    "user_id" "uuid" NOT NULL,
    "total_bytes" bigint DEFAULT 0 NOT NULL,
    "image_count" integer DEFAULT 0 NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "storage_usage_image_count_check" CHECK (("image_count" >= 0)),
    CONSTRAINT "storage_usage_total_bytes_check" CHECK (("total_bytes" >= 0))
);


ALTER TABLE "public"."storage_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sun_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "sunrise_utc" timestamp with time zone,
    "sunset_utc" timestamp with time zone,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sun_times_source_check" CHECK (("source" = ANY (ARRAY['open-meteo'::"text", 'computed'::"text"])))
);


ALTER TABLE "public"."sun_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."surfline_shadow_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "forecast_ts" timestamp with time zone NOT NULL,
    "wave_height_min_m" numeric(4,2),
    "wave_height_max_m" numeric(4,2),
    "surfline_spot_id" "text" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."surfline_shadow_forecasts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ten_day_enhanced_forecasts" WITH ("security_invoker"='true') AS
 SELECT "enhanced_forecasts"."id",
    "enhanced_forecasts"."beach_id",
    "enhanced_forecasts"."forecast_at",
    "enhanced_forecasts"."forecast_date",
    "enhanced_forecasts"."forecast_time",
    "enhanced_forecasts"."wave_height",
    "enhanced_forecasts"."wave_period",
    "enhanced_forecasts"."wave_direction",
    "enhanced_forecasts"."swell_1_height",
    "enhanced_forecasts"."swell_1_period",
    "enhanced_forecasts"."swell_1_direction",
    "enhanced_forecasts"."swell_2_height",
    "enhanced_forecasts"."swell_2_period",
    "enhanced_forecasts"."swell_2_direction",
    "enhanced_forecasts"."wind_wave_height",
    "enhanced_forecasts"."wind_wave_period",
    "enhanced_forecasts"."wind_wave_direction",
    "enhanced_forecasts"."water_temp",
    "enhanced_forecasts"."air_temperature",
    "enhanced_forecasts"."wind_speed",
    "enhanced_forecasts"."wind_direction",
    "enhanced_forecasts"."weather_condition",
    "enhanced_forecasts"."tide_status",
    "enhanced_forecasts"."tide_height",
    "enhanced_forecasts"."next_tide_time",
    "enhanced_forecasts"."next_tide_type",
    "enhanced_forecasts"."next_tide_height",
    "enhanced_forecasts"."next_tide_at",
    "enhanced_forecasts"."coops_station_id",
    "enhanced_forecasts"."confidence_score",
    "enhanced_forecasts"."data_source",
    "enhanced_forecasts"."raw_forecast",
    "enhanced_forecasts"."created_at",
    "enhanced_forecasts"."updated_at"
   FROM "public"."enhanced_forecasts"
  WHERE (("enhanced_forecasts"."forecast_date" >= CURRENT_DATE) AND ("enhanced_forecasts"."forecast_date" <= (CURRENT_DATE + '10 days'::interval)))
  ORDER BY "enhanced_forecasts"."beach_id", "enhanced_forecasts"."forecast_at";


ALTER TABLE "public"."ten_day_enhanced_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tide_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "ts" timestamp with time zone NOT NULL,
    "tide_height_m" numeric,
    "tide_phase" "text",
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ts_utc" timestamp with time zone GENERATED ALWAYS AS ("ts") STORED,
    "tide_ft" real GENERATED ALWAYS AS (
CASE
    WHEN ("tide_height_m" IS NULL) THEN NULL::real
    ELSE (("tide_height_m" * 3.28084))::real
END) STORED,
    CONSTRAINT "tide_forecasts_source_check" CHECK (("source" = ANY (ARRAY['open-meteo'::"text", 'noaa'::"text", 'noaa_hilo_interpolated'::"text"])))
);


ALTER TABLE "public"."tide_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trial_ending_push_log" (
    "user_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."trial_ending_push_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."trial_ending_push_log" IS 'Day-12 trial-ending push idempotency log. One row per user = one push ever for this trial cycle.';



CREATE OR REPLACE VIEW "public"."unified_wave_observations" WITH ("security_invoker"='true') AS
 SELECT 'ioos'::"text" AS "source",
    "o"."station_id",
    "o"."observed_at",
    "o"."wave_height_m",
    "o"."wave_period_s",
    "o"."wave_direction_deg",
    "o"."water_temp_c",
    "s"."latitude",
    "s"."longitude",
    "s"."nearest_beach_id",
    "s"."distance_to_beach_km",
    "s"."source_network"
   FROM ("public"."ioos_observations" "o"
     JOIN "public"."ioos_stations" "s" USING ("station_id"))
  WHERE (("s"."active" = true) AND ("o"."wave_height_m" IS NOT NULL))
UNION ALL
 SELECT 'ndbc_direct'::"text" AS "source",
    "o"."station_id",
    "o"."observed_at",
    "o"."wave_height_m",
    "o"."wave_period_s",
    "o"."wave_direction_deg",
    "o"."water_temp_c",
    "s"."latitude",
    "s"."longitude",
    "s"."nearest_beach_id",
    "s"."distance_to_beach_km",
    'NDBC'::"text" AS "source_network"
   FROM ("public"."ndbc_direct_observations" "o"
     JOIN "public"."ndbc_direct_stations" "s" USING ("station_id"))
  WHERE (("s"."active" = true) AND ("o"."wave_height_m" IS NOT NULL) AND (("s"."ioos_station_id" IS NULL) OR (NOT (EXISTS ( SELECT 1
           FROM "public"."ioos_stations" "iss"
          WHERE (("iss"."station_id" = "s"."ioos_station_id") AND ("iss"."active" = true)))))));


ALTER TABLE "public"."unified_wave_observations" OWNER TO "postgres";


COMMENT ON VIEW "public"."unified_wave_observations" IS 'Unified view of wave observations from IOOS and NDBC direct sources for ML training. NDBC direct observations are only included for stations not actively covered by IOOS (dedup via ioos_station_id cross-reference).';



CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_slug" "text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_beach_affinity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "beach_id" "uuid" NOT NULL,
    "session_count" integer DEFAULT 0 NOT NULL,
    "last_surfed_at" timestamp with time zone,
    "affinity_score" numeric(5,2) DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_beach_affinity_affinity_score_check" CHECK ((("affinity_score" >= (0)::numeric) AND ("affinity_score" <= (100)::numeric)))
);


ALTER TABLE "public"."user_beach_affinity" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_beach_affinity" IS 'Tracks user familiarity with beaches based on surf history';



COMMENT ON COLUMN "public"."user_beach_affinity"."affinity_score" IS 'Computed score (0-100) based on session count, recency, and frequency';



CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "device_token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_version" "text",
    "os_version" "text",
    "expo_sdk" "text",
    "timezone" "text",
    "build_number" "text",
    CONSTRAINT "user_devices_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_devices"."timezone" IS 'Optional IANA timezone captured from the registering browser or native device.';



COMMENT ON COLUMN "public"."user_devices"."build_number" IS 'Optional native binary build number captured from iOS CFBundleVersion or Android versionCode.';



CREATE TABLE IF NOT EXISTS "public"."user_email_prefs" (
    "user_id" "uuid" NOT NULL,
    "email_frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "min_good_score" numeric DEFAULT 6.0 NOT NULL,
    "skill_level" "text" DEFAULT 'beginner'::"text" NOT NULL,
    "pref_time_bucket" "text" DEFAULT 'dawn'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'America/Los_Angeles'::"text" NOT NULL,
    "home_beach_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_email_prefs_email_frequency_check" CHECK (("email_frequency" = ANY (ARRAY['daily'::"text", 'only_good'::"text", 'off'::"text"]))),
    CONSTRAINT "user_email_prefs_pref_time_bucket_check" CHECK (("pref_time_bucket" = ANY (ARRAY['dawn'::"text", 'after_work'::"text", 'weekends'::"text"]))),
    CONSTRAINT "user_email_prefs_skill_level_check" CHECK (("skill_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."user_email_prefs" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_email_prefs" IS 'User preferences for email notifications';



CREATE TABLE IF NOT EXISTS "public"."user_entitlements" (
    "user_id" "uuid" NOT NULL,
    "is_pro" boolean DEFAULT false NOT NULL,
    "is_trialing" boolean DEFAULT false NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "product_id" "text",
    "will_renew" boolean DEFAULT false NOT NULL,
    "billing_issue" boolean DEFAULT false NOT NULL,
    "lapsed_at" timestamp with time zone,
    "previous_product_id" "text",
    "rc_raw" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_entitlements_failed_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text",
    "payload" "jsonb" NOT NULL,
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_retried_at" timestamp with time zone
);


ALTER TABLE "public"."user_entitlements_failed_webhooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_implicit_preferences" (
    "user_id" "uuid" NOT NULL,
    "inferred_wave_min_ft" numeric(4,1),
    "inferred_wave_max_ft" numeric(4,1),
    "break_type_weights" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "time_slot_weights" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "location_centroid_lat" numeric(10,7),
    "location_centroid_lon" numeric(10,7),
    "typical_travel_radius_miles" numeric(6,2),
    "top_engaged_beach_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "confidence" numeric(3,2) DEFAULT 0.0 NOT NULL,
    "event_count" integer DEFAULT 0 NOT NULL,
    "last_computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "computed_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "computed_to" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_implicit_preferences_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "user_implicit_preferences_inferred_wave_max_ft_check" CHECK ((("inferred_wave_max_ft" >= (0)::numeric) AND ("inferred_wave_max_ft" <= (50)::numeric))),
    CONSTRAINT "user_implicit_preferences_inferred_wave_min_ft_check" CHECK ((("inferred_wave_min_ft" >= (0)::numeric) AND ("inferred_wave_min_ft" <= (50)::numeric))),
    CONSTRAINT "wave_range_valid" CHECK (((("inferred_wave_min_ft" IS NULL) AND ("inferred_wave_max_ft" IS NULL)) OR ("inferred_wave_min_ft" <= "inferred_wave_max_ft")))
);


ALTER TABLE "public"."user_implicit_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_implicit_preferences" IS 'Aggregated preferences computed from user behavioral signals. Updated by scheduled function.';



COMMENT ON COLUMN "public"."user_implicit_preferences"."inferred_wave_min_ft" IS 'Inferred minimum wave height preference from engagement patterns';



COMMENT ON COLUMN "public"."user_implicit_preferences"."inferred_wave_max_ft" IS 'Inferred maximum wave height preference from engagement patterns';



COMMENT ON COLUMN "public"."user_implicit_preferences"."break_type_weights" IS 'Normalized weights for break types: {beach: 0.6, point: 0.3, reef: 0.1}';



COMMENT ON COLUMN "public"."user_implicit_preferences"."time_slot_weights" IS 'Normalized weights for time slots: {morning: 0.7, afternoon: 0.2, evening: 0.1}';



COMMENT ON COLUMN "public"."user_implicit_preferences"."location_centroid_lat" IS 'Centroid latitude of user typical surf area (computed from location_update events)';



COMMENT ON COLUMN "public"."user_implicit_preferences"."location_centroid_lon" IS 'Centroid longitude of user typical surf area (computed from location_update events)';



COMMENT ON COLUMN "public"."user_implicit_preferences"."typical_travel_radius_miles" IS 'Typical travel radius computed from location variance';



COMMENT ON COLUMN "public"."user_implicit_preferences"."top_engaged_beach_ids" IS 'Array of most-engaged beach UUIDs (sorted by engagement score)';



COMMENT ON COLUMN "public"."user_implicit_preferences"."confidence" IS 'Confidence score 0-1 based on event count and recency. 0.3+ is meaningful.';



COMMENT ON COLUMN "public"."user_implicit_preferences"."event_count" IS 'Total behavioral events used for this preference computation';



CREATE TABLE IF NOT EXISTS "public"."user_surf_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wave_min_ft" numeric(3,1),
    "wave_max_ft" numeric(3,1),
    "wave_period_min_s" numeric(3,1),
    "wave_period_max_s" numeric(3,1),
    "max_wind_mph" numeric(4,1),
    "preferred_wind_directions" integer[],
    "preferred_tide_statuses" "text"[],
    "confidence" numeric(3,2) DEFAULT 0 NOT NULL,
    "sample_size" integer DEFAULT 0 NOT NULL,
    "last_computed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "validated_at" timestamp with time zone,
    "manual_override" boolean DEFAULT false,
    "eligible_session_count" integer DEFAULT 0 NOT NULL,
    "avoidance_by_beach" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "user_surf_preferences_check" CHECK (("wave_max_ft" >= "wave_min_ft")),
    CONSTRAINT "user_surf_preferences_check1" CHECK (("wave_period_max_s" >= "wave_period_min_s")),
    CONSTRAINT "user_surf_preferences_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "user_surf_preferences_max_wind_mph_check" CHECK (("max_wind_mph" >= (0)::numeric)),
    CONSTRAINT "user_surf_preferences_preferred_tide_statuses_check" CHECK ((("array_length"("preferred_tide_statuses", 1) IS NULL) OR ("array_length"("preferred_tide_statuses", 1) <= 6))),
    CONSTRAINT "user_surf_preferences_preferred_wind_directions_check" CHECK ((("array_length"("preferred_wind_directions", 1) IS NULL) OR ("array_length"("preferred_wind_directions", 1) <= 8))),
    CONSTRAINT "user_surf_preferences_sample_size_check" CHECK (("sample_size" >= 0)),
    CONSTRAINT "user_surf_preferences_wave_min_ft_check" CHECK (("wave_min_ft" >= (0)::numeric)),
    CONSTRAINT "user_surf_preferences_wave_period_min_s_check" CHECK (("wave_period_min_s" >= (0)::numeric))
);


ALTER TABLE "public"."user_surf_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_surf_preferences" IS 'Learned surf preferences from user session history. Updated by preference learning service (Workpath 5.2). Requires minimum 5 rated sessions (rating >= 3).';



COMMENT ON COLUMN "public"."user_surf_preferences"."wave_min_ft" IS 'Minimum preferred wave height in feet (10th percentile of good sessions)';



COMMENT ON COLUMN "public"."user_surf_preferences"."wave_max_ft" IS 'Maximum preferred wave height in feet (90th percentile of good sessions)';



COMMENT ON COLUMN "public"."user_surf_preferences"."wave_period_min_s" IS 'Minimum preferred wave period in seconds (10th percentile)';



COMMENT ON COLUMN "public"."user_surf_preferences"."wave_period_max_s" IS 'Maximum preferred wave period in seconds (90th percentile)';



COMMENT ON COLUMN "public"."user_surf_preferences"."max_wind_mph" IS 'Maximum tolerable wind speed in mph (90th percentile)';



COMMENT ON COLUMN "public"."user_surf_preferences"."preferred_wind_directions" IS 'Array of preferred wind directions in degrees (0-360). Up to 8 cardinal directions (N, NE, E, SE, S, SW, W, NW). Computed via mode detection with 15% frequency threshold.';



COMMENT ON COLUMN "public"."user_surf_preferences"."preferred_tide_statuses" IS 'Preferred tide statuses (e.g., ["rising", "high"]) from good sessions. Computed via mode detection with 20% frequency threshold.';



COMMENT ON COLUMN "public"."user_surf_preferences"."confidence" IS 'Confidence score (0-1) based on sample size using sigmoid function: 1 / (1 + exp(-0.3 * (n - 10))). Examples: 5 sessions = 0.5 confidence, 20+ sessions = 0.95 confidence.';



COMMENT ON COLUMN "public"."user_surf_preferences"."sample_size" IS 'Number of rated sessions (rating >= 3) used to compute preferences. Minimum 5 required for preference computation.';



COMMENT ON COLUMN "public"."user_surf_preferences"."last_computed_at" IS 'Timestamp of last preference computation. Updated nightly by preference learning cron job (Workpath 5.3).';



COMMENT ON COLUMN "public"."user_surf_preferences"."validated_at" IS 'Timestamp when user confirmed their learned preferences match their style';



COMMENT ON COLUMN "public"."user_surf_preferences"."manual_override" IS 'Flag indicating user has manually overridden learned preference values';



COMMENT ON COLUMN "public"."user_surf_preferences"."eligible_session_count" IS 'Number of clean completed real sessions considered for learned preference activation, including sessions without usable forecast snapshots.';



COMMENT ON COLUMN "public"."user_surf_preferences"."avoidance_by_beach" IS 'Per-beach negative learned preference patterns from low-rated or low-wave-quality sessions. Used as a soft penalty for alerts and scoring.';



CREATE TABLE IF NOT EXISTS "public"."user_xp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "xp_total" integer DEFAULT 0 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_xp_level_check" CHECK ((("level" >= 1) AND ("level" <= 9))),
    CONSTRAINT "user_xp_xp_total_check" CHECK (("xp_total" >= 0))
);


ALTER TABLE "public"."user_xp" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_enhanced_forecast_latest" WITH ("security_invoker"='true') AS
 SELECT "b"."id" AS "beach_id",
    "ef"."updated_at",
    "ef"."data_source"
   FROM ("public"."beaches" "b"
     CROSS JOIN LATERAL ( SELECT "ef_1"."updated_at",
            "ef_1"."data_source"
           FROM "public"."enhanced_forecasts" "ef_1"
          WHERE (("ef_1"."beach_id" = "b"."id") AND ("ef_1"."updated_at" IS NOT NULL))
          ORDER BY "ef_1"."updated_at" DESC
         LIMIT 1) "ef");


ALTER TABLE "public"."v_enhanced_forecast_latest" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_marine_forecast_latest" WITH ("security_invoker"='true') AS
 SELECT "b"."id" AS "beach_id",
    "mf"."created_at",
    "mf"."ts",
    "mf"."source",
    "mf"."is_observed"
   FROM ("public"."beaches" "b"
     CROSS JOIN LATERAL (( SELECT "m"."created_at",
            "m"."ts",
            "m"."source",
            "m"."is_observed"
           FROM "public"."marine_forecasts" "m"
          WHERE (("m"."beach_id" = "b"."id") AND ("m"."is_observed" = true) AND ("m"."created_at" > ("now"() - '06:00:00'::interval)))
          ORDER BY "m"."created_at" DESC
         LIMIT 1)
        UNION ALL
        ( SELECT "m"."created_at",
            "m"."ts",
            "m"."source",
            "m"."is_observed"
           FROM "public"."marine_forecasts" "m"
          WHERE ("m"."beach_id" = "b"."id")
          ORDER BY "m"."created_at" DESC
         LIMIT 1)
 LIMIT 1) "mf");


ALTER TABLE "public"."v_marine_forecast_latest" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_sun_times_latest" WITH ("security_invoker"='true') AS
 SELECT "b"."id" AS "beach_id",
    "st"."created_at",
    "st"."date",
    "st"."source"
   FROM ("public"."beaches" "b"
     CROSS JOIN LATERAL ( SELECT "s"."created_at",
            "s"."date",
            "s"."source"
           FROM "public"."sun_times" "s"
          WHERE ("s"."beach_id" = "b"."id")
          ORDER BY "s"."created_at" DESC
         LIMIT 1) "st");


ALTER TABLE "public"."v_sun_times_latest" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_tide_forecast_latest" WITH ("security_invoker"='true') AS
 SELECT "b"."id" AS "beach_id",
    "tf"."created_at",
    "tf"."ts",
    "tf"."source"
   FROM ("public"."beaches" "b"
     CROSS JOIN LATERAL ( SELECT "t"."created_at",
            "t"."ts",
            "t"."source"
           FROM "public"."tide_forecasts" "t"
          WHERE ("t"."beach_id" = "b"."id")
          ORDER BY "t"."created_at" DESC
         LIMIT 1) "tf");


ALTER TABLE "public"."v_tide_forecast_latest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wq_monitoring_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "station_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "org_id" "text",
    "org_name" "text",
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "geog" "public"."geography"(Point,4326) GENERATED ALWAYS AS (("public"."st_setsrid"("public"."st_makepoint"("lon", "lat"), 4326))::"public"."geography") STORED,
    "county" "text",
    "state" "text",
    "nearest_beach_id" "uuid",
    "distance_to_beach_m" double precision,
    "active" boolean DEFAULT true NOT NULL,
    "last_sample_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wq_monitoring_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wq_samples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "station_id" "uuid" NOT NULL,
    "sample_date" "date" NOT NULL,
    "characteristic" "text" NOT NULL,
    "value" double precision,
    "unit" "text" DEFAULT 'MPN/100mL'::"text",
    "detection_condition" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wq_samples" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."xp_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "xp_amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "related_entity_id" "uuid",
    "related_entity_type" "text",
    CONSTRAINT "xp_events_action_check" CHECK (("length"("action") <= 100)),
    CONSTRAINT "xp_events_related_entity_type_check" CHECK (("related_entity_type" = ANY (ARRAY['session'::"text", 'board'::"text", 'intel_post'::"text", 'review'::"text", 'invite'::"text", 'photo'::"text"]))),
    CONSTRAINT "xp_events_xp_amount_check" CHECK (("xp_amount" > 0))
);


ALTER TABLE "public"."xp_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."dev_session_mutation_audit" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dev_session_mutation_audit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."email_click_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."email_click_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."email_send_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."email_send_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."email_suppression_list" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."email_suppression_list_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ioos_observations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ioos_observations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ndbc_direct_observations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ndbc_direct_observations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."saved_windows" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."saved_windows_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."session_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."session_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_deletions"
    ADD CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activation_push_log"
    ADD CONSTRAINT "activation_push_log_pkey" PRIMARY KEY ("user_id", "nudge_type");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_deliveries"
    ADD CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_queue"
    ADD CONSTRAINT "alert_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badge_definitions"
    ADD CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("badge_slug");



ALTER TABLE ONLY "public"."beach_amenity_sources"
    ADD CONSTRAINT "beach_amenity_sources_beach_id_ccc_location_id_key" UNIQUE ("beach_id", "ccc_location_id");



ALTER TABLE ONLY "public"."beach_amenity_sources"
    ADD CONSTRAINT "beach_amenity_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_daily_intel"
    ADD CONSTRAINT "beach_daily_intel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_daily_intel"
    ADD CONSTRAINT "beach_daily_intel_unique" UNIQUE ("beach_id", "forecast_date", "generation_time");



ALTER TABLE ONLY "public"."beach_dioramas"
    ADD CONSTRAINT "beach_dioramas_beach_id_condition_key_key" UNIQUE ("beach_id", "condition_key");



ALTER TABLE ONLY "public"."beach_dioramas"
    ADD CONSTRAINT "beach_dioramas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_editorial_content"
    ADD CONSTRAINT "beach_editorial_content_beach_id_content_type_key" UNIQUE ("beach_id", "content_type");



ALTER TABLE ONLY "public"."beach_editorial_content"
    ADD CONSTRAINT "beach_editorial_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_forecast_accuracy"
    ADD CONSTRAINT "beach_forecast_accuracy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_height_offsets"
    ADD CONSTRAINT "beach_height_offsets_pkey" PRIMARY KEY ("beach_id", "source");



ALTER TABLE ONLY "public"."beach_photos"
    ADD CONSTRAINT "beach_photos_beach_id_source_source_id_key" UNIQUE ("beach_id", "source", "source_id");



ALTER TABLE ONLY "public"."beach_photos_history"
    ADD CONSTRAINT "beach_photos_history_pkey" PRIMARY KEY ("history_id");



ALTER TABLE ONLY "public"."beach_photos"
    ADD CONSTRAINT "beach_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_recommendation_calibration"
    ADD CONSTRAINT "beach_recommendation_calibration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_review_id_user_id_key" UNIQUE ("review_id", "user_id");



ALTER TABLE ONLY "public"."beach_reviews_history"
    ADD CONSTRAINT "beach_reviews_history_pkey" PRIMARY KEY ("history_id");



ALTER TABLE ONLY "public"."beach_reviews"
    ADD CONSTRAINT "beach_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beach_sources"
    ADD CONSTRAINT "beach_sources_pkey" PRIMARY KEY ("beach_id");



ALTER TABLE ONLY "public"."beach_water_quality"
    ADD CONSTRAINT "beach_water_quality_beach_id_key" UNIQUE ("beach_id");



ALTER TABLE ONLY "public"."beach_water_quality"
    ADD CONSTRAINT "beach_water_quality_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beaches"
    ADD CONSTRAINT "beaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buoys"
    ADD CONSTRAINT "buoys_pkey" PRIMARY KEY ("buoy_uuid");



ALTER TABLE ONLY "public"."ccc_access_locations"
    ADD CONSTRAINT "ccc_access_locations_ccc_id_key" UNIQUE ("ccc_id");



ALTER TABLE ONLY "public"."ccc_access_locations"
    ADD CONSTRAINT "ccc_access_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_editorial_content"
    ADD CONSTRAINT "city_editorial_content_intent_unique" UNIQUE ("city_slug", "state_slug", "country_slug", "intent");



ALTER TABLE ONLY "public"."city_editorial_content"
    ADD CONSTRAINT "city_editorial_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corrected_forecasts"
    ADD CONSTRAINT "corrected_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cron_runs"
    ADD CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_spots"
    ADD CONSTRAINT "custom_spots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_cleanup_audit"
    ADD CONSTRAINT "data_cleanup_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_notes_queue"
    ADD CONSTRAINT "dev_notes_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_session_mutation_audit"
    ADD CONSTRAINT "dev_session_mutation_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digest_run_stats"
    ADD CONSTRAINT "digest_run_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_click_events"
    ADD CONSTRAINT "email_click_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_suppression_list"
    ADD CONSTRAINT "email_suppression_list_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."email_suppression_list"
    ADD CONSTRAINT "email_suppression_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embed_impressions"
    ADD CONSTRAINT "embed_impressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_beach_forecast_at_unique" UNIQUE ("beach_id", "forecast_at");



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_unique" UNIQUE ("beach_id", "forecast_date", "forecast_time");



ALTER TABLE ONLY "public"."fallback_events"
    ADD CONSTRAINT "fallback_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_accuracy_votes"
    ADD CONSTRAINT "forecast_accuracy_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_alert_deliveries"
    ADD CONSTRAINT "forecast_alert_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_alert_deliveries"
    ADD CONSTRAINT "forecast_alert_deliveries_user_id_beach_id_alert_type_key" UNIQUE ("user_id", "beach_id", "alert_type");



ALTER TABLE ONLY "public"."forecast_feedback_contexts"
    ADD CONSTRAINT "forecast_feedback_contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_intel_post_id_user_id_key" UNIQUE ("intel_post_id", "user_id");



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_posts"
    ADD CONSTRAINT "intel_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_reports"
    ADD CONSTRAINT "intel_reports_intel_post_id_user_id_key" UNIQUE ("intel_post_id", "user_id");



ALTER TABLE ONLY "public"."intel_reports"
    ADD CONSTRAINT "intel_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_votes"
    ADD CONSTRAINT "intel_votes_intel_post_id_user_id_key" UNIQUE ("intel_post_id", "user_id");



ALTER TABLE ONLY "public"."intel_votes"
    ADD CONSTRAINT "intel_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ioos_observations"
    ADD CONSTRAINT "ioos_observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ioos_stations"
    ADD CONSTRAINT "ioos_stations_pkey" PRIMARY KEY ("station_id");



ALTER TABLE ONLY "public"."marine_forecasts"
    ADD CONSTRAINT "marine_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marine_forecasts"
    ADD CONSTRAINT "marine_forecasts_unique" UNIQUE ("beach_id", "ts", "source");



ALTER TABLE ONLY "public"."ml_calibration_versions"
    ADD CONSTRAINT "ml_calibration_versions_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."ml_model_registry"
    ADD CONSTRAINT "ml_model_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ml_model_registry"
    ADD CONSTRAINT "ml_model_registry_version_key" UNIQUE ("version");



ALTER TABLE ONLY "public"."ml_predictions_log"
    ADD CONSTRAINT "ml_predictions_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndbc_direct_observations"
    ADD CONSTRAINT "ndbc_direct_observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndbc_direct_stations"
    ADD CONSTRAINT "ndbc_direct_stations_pkey" PRIMARY KEY ("station_id");



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_send_log"
    ADD CONSTRAINT "notification_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_send_log"
    ADD CONSTRAINT "notification_send_log_user_id_beach_id_notification_type_lo_key" UNIQUE ("user_id", "beach_id", "notification_type", "local_forecast_date");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."npc_content_templates"
    ADD CONSTRAINT "npc_content_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_alert_captures"
    ADD CONSTRAINT "pending_alert_captures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalization_milestones"
    ADD CONSTRAINT "personalization_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalization_milestones"
    ADD CONSTRAINT "personalization_milestones_user_id_milestone_key_key" UNIQUE ("user_id", "milestone_key");



ALTER TABLE ONLY "public"."posting_config"
    ADD CONSTRAINT "posting_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posting_config"
    ADD CONSTRAINT "posting_config_post_type_key" UNIQUE ("post_type");



ALTER TABLE ONLY "public"."posting_log"
    ADD CONSTRAINT "posting_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_unique_referee" UNIQUE ("referee_id");



ALTER TABLE ONLY "public"."roadmap_item_submissions"
    ADD CONSTRAINT "roadmap_item_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_items"
    ADD CONSTRAINT "roadmap_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_items"
    ADD CONSTRAINT "roadmap_items_title_unique" UNIQUE ("title");



ALTER TABLE ONLY "public"."roadmap_votes"
    ADD CONSTRAINT "roadmap_votes_pkey" PRIMARY KEY ("item_id", "user_id");



ALTER TABLE ONLY "public"."saved_windows"
    ADD CONSTRAINT "saved_windows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_unique_session_invitee_email" UNIQUE ("session_id", "invitee_email");



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_unique_session_invitee_id" UNIQUE ("session_id", "invitee_id");



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_media_history"
    ADD CONSTRAINT "session_media_history_pkey" PRIMARY KEY ("history_id");



ALTER TABLE ONLY "public"."session_media"
    ADD CONSTRAINT "session_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_share_links"
    ADD CONSTRAINT "session_share_links_pkey" PRIMARY KEY ("share_id");



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_wave_observation_candidates"
    ADD CONSTRAINT "session_wave_observation_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_wave_observation_candidates"
    ADD CONSTRAINT "session_wave_observation_candidates_session_unique" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spot_feedback"
    ADD CONSTRAINT "spot_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_bucket_docs"
    ADD CONSTRAINT "storage_bucket_docs_pkey" PRIMARY KEY ("bucket_name");



ALTER TABLE ONLY "public"."storage_usage"
    ADD CONSTRAINT "storage_usage_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."sun_times"
    ADD CONSTRAINT "sun_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sun_times"
    ADD CONSTRAINT "sun_times_unique" UNIQUE ("beach_id", "date", "source");



ALTER TABLE ONLY "public"."surfline_shadow_forecasts"
    ADD CONSTRAINT "surfline_shadow_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tide_forecasts"
    ADD CONSTRAINT "tide_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tide_forecasts"
    ADD CONSTRAINT "tide_forecasts_unique" UNIQUE ("beach_id", "ts", "source");



ALTER TABLE ONLY "public"."trial_ending_push_log"
    ADD CONSTRAINT "trial_ending_push_log_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."beach_forecast_accuracy"
    ADD CONSTRAINT "unique_beach_accuracy" UNIQUE ("beach_id");



ALTER TABLE ONLY "public"."corrected_forecasts"
    ADD CONSTRAINT "unique_beach_forecast_ts" UNIQUE ("beach_id", "forecast_ts");



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "unique_session_forecast_snapshot" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."surfline_shadow_forecasts"
    ADD CONSTRAINT "unique_surfline_beach_forecast_ts" UNIQUE ("beach_id", "forecast_ts");



ALTER TABLE ONLY "public"."user_beach_affinity"
    ADD CONSTRAINT "unique_user_beach_affinity" UNIQUE ("user_id", "beach_id");



ALTER TABLE ONLY "public"."forecast_accuracy_votes"
    ADD CONSTRAINT "unique_user_forecast_vote" UNIQUE ("user_id", "forecast_id");



ALTER TABLE ONLY "public"."user_activities"
    ADD CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_slug_key" UNIQUE ("user_id", "badge_slug");



ALTER TABLE ONLY "public"."user_beach_affinity"
    ADD CONSTRAINT "user_beach_affinity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_device_token_key" UNIQUE ("user_id", "device_token");



ALTER TABLE ONLY "public"."user_email_prefs"
    ADD CONSTRAINT "user_email_prefs_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_entitlements_failed_webhooks"
    ADD CONSTRAINT "user_entitlements_failed_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_implicit_preferences"
    ADD CONSTRAINT "user_implicit_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_surf_preferences"
    ADD CONSTRAINT "user_surf_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_surf_preferences"
    ADD CONSTRAINT "user_surf_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_xp"
    ADD CONSTRAINT "user_xp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_xp"
    ADD CONSTRAINT "user_xp_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."wq_monitoring_stations"
    ADD CONSTRAINT "wq_monitoring_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wq_monitoring_stations"
    ADD CONSTRAINT "wq_monitoring_stations_station_id_key" UNIQUE ("station_id");



ALTER TABLE ONLY "public"."wq_samples"
    ADD CONSTRAINT "wq_samples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wq_samples"
    ADD CONSTRAINT "wq_samples_station_id_sample_date_characteristic_key" UNIQUE ("station_id", "sample_date", "characteristic");



ALTER TABLE ONLY "public"."xp_events"
    ADD CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "account_deletions_requested_idx" ON "public"."account_deletions" USING "btree" ("requested_at" DESC);



CREATE INDEX "account_deletions_user_idx" ON "public"."account_deletions" USING "btree" ("user_id");



CREATE INDEX "alert_delivery_attempts_queue_idx" ON "public"."alert_delivery_attempts" USING "btree" ("queue_id");



CREATE INDEX "alert_delivery_attempts_rule_sent_idx" ON "public"."alert_delivery_attempts" USING "btree" ("rule_id", "attempted_at" DESC) WHERE ("status" = 'sent'::"text");



CREATE INDEX "alert_delivery_attempts_user_sent_idx" ON "public"."alert_delivery_attempts" USING "btree" ("user_id", "attempted_at" DESC) WHERE ("status" = 'sent'::"text");



CREATE UNIQUE INDEX "alert_queue_one_similarity_per_user_day" ON "public"."alert_queue" USING "btree" ("user_id", "alert_date") WHERE (("conditions_snapshot" ->> 'alert_type'::"text") = 'similarity_match'::"text");



COMMENT ON INDEX "public"."alert_queue_one_similarity_per_user_day" IS 'Dedupe rail for similarity_match alert_queue rows: at most one per (user_id, alert_date). Inferred by try_insert_similarity_alert via ON CONFLICT (user_id, alert_date) WHERE (conditions_snapshot->>''alert_type'')=''similarity_match''.';



CREATE INDEX "beach_amenity_sources_beach_id_idx" ON "public"."beach_amenity_sources" USING "btree" ("beach_id");



CREATE INDEX "beach_amenity_sources_ccc_location_id_idx" ON "public"."beach_amenity_sources" USING "btree" ("ccc_location_id");



CREATE INDEX "beach_review_likes_review_id_idx" ON "public"."beach_review_likes" USING "btree" ("review_id");



CREATE INDEX "beach_review_likes_user_id_idx" ON "public"."beach_review_likes" USING "btree" ("user_id");



CREATE INDEX "beach_reviews_beach_id_idx" ON "public"."beach_reviews" USING "btree" ("beach_id");



CREATE INDEX "beach_reviews_created_at_idx" ON "public"."beach_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "beach_reviews_helpful_count_idx" ON "public"."beach_reviews" USING "btree" ("helpful_count" DESC);



CREATE INDEX "beach_reviews_overall_rating_idx" ON "public"."beach_reviews" USING "btree" ("overall_rating");



CREATE INDEX "beach_reviews_user_id_idx" ON "public"."beach_reviews" USING "btree" ("user_id");



CREATE INDEX "beach_water_quality_active_status_idx" ON "public"."beach_water_quality" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['advisory'::"text", 'closure'::"text"]));



CREATE INDEX "beach_water_quality_status_changed_at_idx" ON "public"."beach_water_quality" USING "btree" ("status_changed_at");



CREATE UNIQUE INDEX "beaches_name_unique" ON "public"."beaches" USING "btree" ("lower"("name"));



CREATE INDEX "ccc_access_locations_geog_gist" ON "public"."ccc_access_locations" USING "gist" ("geog");



CREATE INDEX "content_reports_status_idx" ON "public"."content_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "content_reports_target_idx" ON "public"."content_reports" USING "btree" ("target_type", "target_id");



CREATE INDEX "cron_runs_route_started_idx" ON "public"."cron_runs" USING "btree" ("route", "started_at" DESC);



CREATE INDEX "custom_spots_active_idx" ON "public"."custom_spots" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "custom_spots_created_at_idx" ON "public"."custom_spots" USING "btree" ("created_at" DESC);



CREATE INDEX "custom_spots_nearest_beach_id_idx" ON "public"."custom_spots" USING "btree" ("nearest_beach_id") WHERE ("nearest_beach_id" IS NOT NULL);



CREATE INDEX "custom_spots_public_location_idx" ON "public"."custom_spots" USING "btree" ("lat", "lon") WHERE ("visibility" = 'public'::"text");



CREATE INDEX "custom_spots_user_id_idx" ON "public"."custom_spots" USING "btree" ("user_id");



CREATE UNIQUE INDEX "favorite_beaches_unique" ON "public"."favorite_beaches" USING "btree" ("user_id", "beach_id");



CREATE UNIQUE INDEX "favorite_beaches_unique_beach" ON "public"."favorite_beaches" USING "btree" ("user_id", "beach_id") WHERE ("beach_id" IS NOT NULL);



CREATE UNIQUE INDEX "favorite_beaches_unique_custom_spot" ON "public"."favorite_beaches" USING "btree" ("user_id", "custom_spot_id") WHERE ("custom_spot_id" IS NOT NULL);



CREATE INDEX "idx_activation_push_log_nudge_type" ON "public"."activation_push_log" USING "btree" ("nudge_type");



CREATE INDEX "idx_activation_push_log_sent_at" ON "public"."activation_push_log" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_admin_audit_log_admin_user_id" ON "public"."admin_audit_log" USING "btree" ("admin_user_id", "created_at" DESC);



CREATE INDEX "idx_admin_audit_log_created_at" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_audit_log_entity" ON "public"."admin_audit_log" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_alert_deliveries_dedup" ON "public"."alert_deliveries" USING "btree" ("user_id", "alert_date", "channel");



CREATE INDEX "idx_alert_queue_delivery" ON "public"."alert_queue" USING "btree" ("sent", "send_at") WHERE ("sent" = false);



CREATE UNIQUE INDEX "idx_alert_queue_rule_dedup" ON "public"."alert_queue" USING "btree" ("rule_id", "alert_date", "window_start");



CREATE INDEX "idx_alert_queue_user_date" ON "public"."alert_queue" USING "btree" ("user_id", "alert_date");



CREATE INDEX "idx_alert_rules_beach_id" ON "public"."alert_rules" USING "btree" ("beach_id");



CREATE INDEX "idx_alert_rules_enabled" ON "public"."alert_rules" USING "btree" ("user_id", "enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_alert_rules_user_id" ON "public"."alert_rules" USING "btree" ("user_id");



CREATE INDEX "idx_beach_daily_intel_cleanup" ON "public"."beach_daily_intel" USING "btree" ("created_at");



CREATE INDEX "idx_beach_daily_intel_latest" ON "public"."beach_daily_intel" USING "btree" ("beach_id", "generated_at" DESC);



COMMENT ON INDEX "public"."idx_beach_daily_intel_latest" IS 'Optimized for latest intel lookup per beach. Query pattern:
WHERE beach_id IN (...) ORDER BY generated_at DESC
WARNING: Application MUST add LIMIT clause to prevent scanning all intel records.';



CREATE INDEX "idx_beach_daily_intel_lookup" ON "public"."beach_daily_intel" USING "btree" ("beach_id", "forecast_date", "generation_time" DESC);



CREATE INDEX "idx_beach_editorial_beach_id" ON "public"."beach_editorial_content" USING "btree" ("beach_id");



CREATE INDEX "idx_beach_editorial_beach_type" ON "public"."beach_editorial_content" USING "btree" ("beach_id", "content_type");



CREATE INDEX "idx_beach_editorial_content_type" ON "public"."beach_editorial_content" USING "btree" ("content_type");



CREATE INDEX "idx_beach_height_offsets_source_computed_at" ON "public"."beach_height_offsets" USING "btree" ("source", "computed_at" DESC);



CREATE UNIQUE INDEX "idx_beach_ml_baseline_beach_id" ON "public"."beach_ml_performance_baseline" USING "btree" ("beach_id");



CREATE INDEX "idx_beach_ml_baseline_improvement" ON "public"."beach_ml_performance_baseline" USING "btree" ("improvement_rate_pct" DESC NULLS LAST) WHERE ("predictions_matched" >= 10);



CREATE INDEX "idx_beach_ml_baseline_last_prediction" ON "public"."beach_ml_performance_baseline" USING "btree" ("last_prediction_at" DESC NULLS LAST);



CREATE INDEX "idx_beach_ml_baseline_match_rate" ON "public"."beach_ml_performance_baseline" USING "btree" ("match_rate_pct" DESC NULLS LAST);



CREATE INDEX "idx_beach_photos_deleted_at" ON "public"."beach_photos" USING "btree" ("deleted_at");



CREATE INDEX "idx_beach_photos_history_changed_at" ON "public"."beach_photos_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_beach_photos_history_changed_by" ON "public"."beach_photos_history" USING "btree" ("changed_by");



CREATE INDEX "idx_beach_photos_history_id" ON "public"."beach_photos_history" USING "btree" ("id", "changed_at" DESC);



CREATE INDEX "idx_beach_recommendation_calibration_beach_id" ON "public"."beach_recommendation_calibration" USING "btree" ("beach_id");



CREATE INDEX "idx_beach_reviews_deleted_at" ON "public"."beach_reviews" USING "btree" ("deleted_at");



CREATE INDEX "idx_beach_reviews_history_changed_at" ON "public"."beach_reviews_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_beach_reviews_history_changed_by" ON "public"."beach_reviews_history" USING "btree" ("changed_by");



CREATE INDEX "idx_beach_reviews_history_id" ON "public"."beach_reviews_history" USING "btree" ("id", "changed_at" DESC);



CREATE INDEX "idx_beach_sources_beach_id" ON "public"."beach_sources" USING "btree" ("beach_id");



CREATE INDEX "idx_beaches_cdip_eligible_true" ON "public"."beaches" USING "btree" ("cdip_eligible") WHERE ("cdip_eligible" = true);



CREATE INDEX "idx_beaches_country" ON "public"."beaches" USING "btree" ("country") WHERE ("country" IS NOT NULL);



CREATE INDEX "idx_beaches_crowd_level" ON "public"."beaches" USING "btree" ("crowd_level");



CREATE INDEX "idx_beaches_deleted_at" ON "public"."beaches" USING "btree" ("deleted_at");



CREATE INDEX "idx_beaches_geog_gist" ON "public"."beaches" USING "gist" ("geog");



CREATE INDEX "idx_beaches_list_covering" ON "public"."beaches" USING "btree" ("name", "id", "lat", "lon", "city", "state") WHERE (("lat" IS NOT NULL) AND ("lon" IS NOT NULL));



CREATE INDEX "idx_beaches_location_hierarchy" ON "public"."beaches" USING "btree" ("country", "state", "city");



CREATE INDEX "idx_beaches_location_lookup" ON "public"."beaches" USING "btree" ("city", "state", "country") WHERE ("is_private" = false);



CREATE INDEX "idx_beaches_name_with_coords" ON "public"."beaches" USING "btree" ("name", "id", "lat", "lon") WHERE (("lat" IS NOT NULL) AND ("lon" IS NOT NULL));



CREATE INDEX "idx_beaches_owner_id_fkey" ON "public"."beaches" USING "btree" ("owner_id");



CREATE INDEX "idx_beaches_slug_exact" ON "public"."beaches" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_beaches_state" ON "public"."beaches" USING "btree" ("state") WHERE ("state" IS NOT NULL);



CREATE INDEX "idx_beaches_terrain_enabled" ON "public"."beaches" USING "btree" ("terrain_enabled") WHERE ("terrain_enabled" = true);



CREATE INDEX "idx_beaches_terrain_method_hash" ON "public"."beaches" USING "btree" ("terrain_method", "terrain_params_hash") WHERE ("terrain_method" IS NOT NULL);



CREATE INDEX "idx_beaches_terrain_rollout" ON "public"."beaches" USING "btree" ("terrain_enabled", "terrain_status", "terrain_analyzed_at");



CREATE INDEX "idx_beaches_terrain_status" ON "public"."beaches" USING "btree" ("terrain_status", "terrain_analyzed_at") WHERE ("terrain_status" IS NOT NULL);



CREATE INDEX "idx_bfa_beach_id" ON "public"."beach_forecast_accuracy" USING "btree" ("beach_id");



CREATE INDEX "idx_bfa_calc_date" ON "public"."beach_forecast_accuracy" USING "btree" ("calculation_date" DESC);



CREATE INDEX "idx_bfa_updated" ON "public"."beach_forecast_accuracy" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_buoys_active" ON "public"."buoys" USING "btree" ("active");



CREATE INDEX "idx_buoys_active_recent_data" ON "public"."buoys" USING "btree" ("active", "updated_at" DESC) WHERE ("active" = true);



CREATE INDEX "idx_buoys_conditions_lookup" ON "public"."buoys" USING "btree" ("active", "updated_at" DESC) WHERE (("active" = true) AND ("coordinates" IS NOT NULL));



CREATE INDEX "idx_buoys_coordinates_gist" ON "public"."buoys" USING "gist" ("coordinates");



CREATE INDEX "idx_buoys_updated_at" ON "public"."buoys" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_calibration_versions_fitted_at" ON "public"."ml_calibration_versions" USING "btree" ("fitted_at" DESC);



CREATE UNIQUE INDEX "idx_calibration_versions_one_active" ON "public"."ml_calibration_versions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_city_editorial_city_slug" ON "public"."city_editorial_content" USING "btree" ("city_slug");



CREATE INDEX "idx_city_editorial_intent" ON "public"."city_editorial_content" USING "btree" ("city_slug", "state_slug", "country_slug", "intent") WHERE ("intent" IS NOT NULL);



CREATE INDEX "idx_city_editorial_location" ON "public"."city_editorial_content" USING "btree" ("city_slug", "state_slug", "country_slug");



CREATE INDEX "idx_comments_session_id" ON "public"."comments" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_corrected_forecasts_beach_ts" ON "public"."corrected_forecasts" USING "btree" ("beach_id", "forecast_ts" DESC);



CREATE INDEX "idx_dev_notes_queue_unposted" ON "public"."dev_notes_queue" USING "btree" ("posted", "created_at") WHERE ("posted" = false);



CREATE INDEX "idx_digest_run_stats_started_at" ON "public"."digest_run_stats" USING "btree" ("run_started_at" DESC);



CREATE INDEX "idx_ef_beach_forecast_at" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "forecast_at");



CREATE INDEX "idx_email_click_events_clicked_at" ON "public"."email_click_events" USING "btree" ("clicked_at" DESC);



CREATE INDEX "idx_email_click_events_email_send_log_id" ON "public"."email_click_events" USING "btree" ("email_send_log_id");



CREATE INDEX "idx_email_click_events_resend_message_id" ON "public"."email_click_events" USING "btree" ("resend_message_id");



CREATE UNIQUE INDEX "idx_email_click_events_webhook_message_id" ON "public"."email_click_events" USING "btree" ("webhook_message_id") WHERE ("webhook_message_id" IS NOT NULL);



CREATE INDEX "idx_email_send_log_resend_message_id" ON "public"."email_send_log" USING "btree" ("resend_message_id") WHERE ("resend_message_id" IS NOT NULL);



CREATE INDEX "idx_email_send_log_type_date" ON "public"."email_send_log" USING "btree" ("email_type", "local_date");



CREATE INDEX "idx_embed_impressions_beach_slug" ON "public"."embed_impressions" USING "btree" ("beach_slug", "created_at" DESC);



CREATE INDEX "idx_embed_impressions_created_at" ON "public"."embed_impressions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_embed_impressions_expires" ON "public"."embed_impressions" USING "btree" ("expires_at");



CREATE INDEX "idx_embed_impressions_referrer" ON "public"."embed_impressions" USING "btree" ("referrer_domain") WHERE ("referrer_domain" IS NOT NULL);



CREATE INDEX "idx_enhanced_forecasts_beach_date_recent" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "forecast_date" DESC);



CREATE INDEX "idx_enhanced_forecasts_beach_updated_at_desc" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "updated_at" DESC);



CREATE INDEX "idx_enhanced_forecasts_coops_station_id" ON "public"."enhanced_forecasts" USING "btree" ("coops_station_id") WHERE ("coops_station_id" IS NOT NULL);



CREATE INDEX "idx_enhanced_forecasts_wind_update" ON "public"."enhanced_forecasts" USING "btree" ("beach_id", "forecast_at") WHERE (("wind_source" IS NULL) OR ("wind_source" <> ALL (ARRAY['HRRR'::"text", 'NWS'::"text"])));



CREATE INDEX "idx_fallback_events_domain_created" ON "public"."fallback_events" USING "btree" ("domain", "created_at" DESC);



CREATE INDEX "idx_fallback_events_severity_created" ON "public"."fallback_events" USING "btree" ("severity", "created_at" DESC);



CREATE INDEX "idx_favorite_beaches_alerts_enabled" ON "public"."favorite_beaches" USING "btree" ("user_id", "beach_id") WHERE ("alerts_enabled" = true);



CREATE INDEX "idx_favorite_beaches_beach_id" ON "public"."favorite_beaches" USING "btree" ("beach_id");



CREATE INDEX "idx_favorite_beaches_custom_spot_id" ON "public"."favorite_beaches" USING "btree" ("custom_spot_id") WHERE ("custom_spot_id" IS NOT NULL);



CREATE INDEX "idx_favorite_beaches_user_rank" ON "public"."favorite_beaches" USING "btree" ("user_id", "rank");



CREATE INDEX "idx_forecast_alert_deliveries_last_sent_at" ON "public"."forecast_alert_deliveries" USING "btree" ("last_sent_at" DESC);



CREATE INDEX "idx_forecast_alert_deliveries_user_beach_type" ON "public"."forecast_alert_deliveries" USING "btree" ("user_id", "beach_id", "alert_type");



CREATE INDEX "idx_forecast_feedback_contexts_beach_forecast_at" ON "public"."forecast_feedback_contexts" USING "btree" ("beach_id", "forecast_at");



CREATE INDEX "idx_forecast_feedback_contexts_contract_version" ON "public"."forecast_feedback_contexts" USING "btree" ("contract_version");



CREATE INDEX "idx_forecast_feedback_contexts_created_at" ON "public"."forecast_feedback_contexts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_forecast_feedback_contexts_session_id" ON "public"."forecast_feedback_contexts" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_forecast_feedback_contexts_user_id" ON "public"."forecast_feedback_contexts" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_forecast_votes_beach" ON "public"."forecast_accuracy_votes" USING "btree" ("beach_id");



CREATE INDEX "idx_forecast_votes_beach_created" ON "public"."forecast_accuracy_votes" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "idx_forecast_votes_created" ON "public"."forecast_accuracy_votes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_forecast_votes_forecast" ON "public"."forecast_accuracy_votes" USING "btree" ("forecast_id");



CREATE INDEX "idx_forecast_votes_user" ON "public"."forecast_accuracy_votes" USING "btree" ("user_id");



CREATE INDEX "idx_intel_confirmations_post_created" ON "public"."intel_post_confirmations" USING "btree" ("intel_post_id", "created_at" DESC);



CREATE INDEX "idx_intel_posts_beach_created" ON "public"."intel_posts" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "idx_intel_posts_emoji_rating" ON "public"."intel_posts" USING "btree" ("emoji_rating") WHERE ("emoji_rating" IS NOT NULL);



CREATE INDEX "idx_intel_posts_location_active" ON "public"."intel_posts" USING "gist" ("public"."st_setsrid"("public"."st_makepoint"(("longitude")::double precision, ("latitude")::double precision), 4326)) WHERE ("is_active" = true);



CREATE INDEX "idx_intel_posts_recent_activity" ON "public"."intel_posts" USING "btree" ("beach_id", "created_at") WHERE ("is_active" = true);



CREATE INDEX "idx_intel_posts_tag_active" ON "public"."intel_posts" USING "btree" ("tag", "is_active", "expires_at") WHERE ("is_active" = true);



CREATE INDEX "idx_intel_posts_user_created" ON "public"."intel_posts" USING "btree" ("user_id", "created_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_intel_reports_post_id" ON "public"."intel_reports" USING "btree" ("intel_post_id");



CREATE INDEX "idx_intel_reports_user_id" ON "public"."intel_reports" USING "btree" ("user_id");



CREATE INDEX "idx_ioos_obs_station_time" ON "public"."ioos_observations" USING "btree" ("station_id", "observed_at" DESC);



CREATE INDEX "idx_ioos_obs_time" ON "public"."ioos_observations" USING "btree" ("observed_at" DESC);



CREATE UNIQUE INDEX "idx_ioos_obs_unique" ON "public"."ioos_observations" USING "btree" ("station_id", "observed_at");



CREATE INDEX "idx_ioos_observations_source" ON "public"."ioos_observations" USING "btree" ("source");



CREATE INDEX "idx_ioos_stations_active" ON "public"."ioos_stations" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "idx_ioos_stations_beach" ON "public"."ioos_stations" USING "btree" ("nearest_beach_id");



CREATE INDEX "idx_ioos_stations_geo" ON "public"."ioos_stations" USING "gist" ("coordinates");



CREATE INDEX "idx_ioos_stations_network" ON "public"."ioos_stations" USING "btree" ("source_network");



CREATE INDEX "idx_ioos_stations_vars_synced" ON "public"."ioos_stations" USING "btree" ("variables_last_synced_at");



CREATE INDEX "idx_marine_forecasts_beach_created_desc" ON "public"."marine_forecasts" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "idx_marine_forecasts_beach_observed_created_desc" ON "public"."marine_forecasts" USING "btree" ("beach_id", "is_observed" DESC, "created_at" DESC);



CREATE INDEX "idx_marine_forecasts_beach_ts_utc" ON "public"."marine_forecasts" USING "btree" ("beach_id", "ts_utc");



CREATE INDEX "idx_marine_forecasts_nws_wind_mv_lookup" ON "public"."marine_forecasts" USING "btree" ("beach_id", "ts") INCLUDE ("wind_speed_ms", "wind_direction_deg") WHERE ("source" = 'nws_wind'::"text");



CREATE INDEX "idx_milestones_user_unshown" ON "public"."personalization_milestones" USING "btree" ("user_id") WHERE ("shown_at" IS NULL);



CREATE INDEX "idx_ml_model_registry_diagnostics" ON "public"."ml_model_registry" USING "gin" ("training_diagnostics");



CREATE INDEX "idx_ml_model_registry_status_deployed" ON "public"."ml_model_registry" USING "btree" ("deployed_at" DESC) WHERE ("status" = 'deployed'::"text");



CREATE INDEX "idx_ml_model_registry_version" ON "public"."ml_model_registry" USING "btree" ("version");



CREATE UNIQUE INDEX "idx_ml_predictions_beach_predicted_at_unique" ON "public"."ml_predictions_log" USING "btree" ("beach_id", "predicted_at");



CREATE INDEX "idx_ml_predictions_beach_ts" ON "public"."ml_predictions_log" USING "btree" ("beach_id", "predicted_at" DESC);



CREATE INDEX "idx_ml_predictions_candidate_version" ON "public"."ml_predictions_log" USING "btree" ("candidate_model_version") WHERE ("candidate_model_version" IS NOT NULL);



CREATE INDEX "idx_ml_predictions_log_beach_horizon" ON "public"."ml_predictions_log" USING "btree" ("beach_id", "forecast_horizon_hours") WHERE (("forecast_horizon_hours" IS NOT NULL) AND ("observed_m" IS NOT NULL));



CREATE INDEX "idx_ml_predictions_log_forecast_horizon" ON "public"."ml_predictions_log" USING "btree" ("forecast_horizon_hours") WHERE ("forecast_horizon_hours" IS NOT NULL);



CREATE INDEX "idx_ml_predictions_log_tide_state" ON "public"."ml_predictions_log" USING "btree" ("tide_state") WHERE ("tide_state" IS NOT NULL);



CREATE INDEX "idx_ml_predictions_pending_observation" ON "public"."ml_predictions_log" USING "btree" ("predicted_at") WHERE ("observed_m" IS NULL);



CREATE INDEX "idx_mpl_offset_window" ON "public"."ml_predictions_log" USING "btree" ("beach_id", "predicted_at" DESC) WHERE (("observed_m" IS NOT NULL) AND ("raw_display_height_m" IS NOT NULL));



CREATE INDEX "idx_mpl_v5_shadow_comparator" ON "public"."ml_predictions_log" USING "btree" ("predicted_at" DESC, "beach_id") WHERE (("observed_m" IS NOT NULL) AND ("wave_height_om" IS NOT NULL) AND ("v5_shadow_height_m" IS NOT NULL) AND ("offset_corrected_display_height_m" IS NOT NULL));



CREATE INDEX "idx_ndbc_direct_obs_station_time" ON "public"."ndbc_direct_observations" USING "btree" ("station_id", "observed_at" DESC);



CREATE INDEX "idx_ndbc_direct_obs_time" ON "public"."ndbc_direct_observations" USING "btree" ("observed_at" DESC);



CREATE UNIQUE INDEX "idx_ndbc_direct_obs_unique" ON "public"."ndbc_direct_observations" USING "btree" ("station_id", "observed_at");



CREATE INDEX "idx_ndbc_direct_stations_active" ON "public"."ndbc_direct_stations" USING "btree" ("active");



CREATE INDEX "idx_ndbc_direct_stations_beach" ON "public"."ndbc_direct_stations" USING "btree" ("nearest_beach_id");



CREATE INDEX "idx_ndbc_direct_stations_geo" ON "public"."ndbc_direct_stations" USING "gist" ("coordinates");



CREATE INDEX "idx_ndbc_direct_stations_ioos" ON "public"."ndbc_direct_stations" USING "btree" ("ioos_station_id");



CREATE UNIQUE INDEX "idx_notification_events_active_dedupe" ON "public"."notification_events" USING "btree" ("recipient_user_id", "type", "dedupe_key") WHERE (("dedupe_key" IS NOT NULL) AND ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"])));



CREATE INDEX "idx_notification_events_claimable" ON "public"."notification_events" USING "btree" ("next_attempt_at" NULLS FIRST, "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_notification_send_log_user_created" ON "public"."notification_send_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_npc_templates_freshness" ON "public"."npc_content_templates" USING "btree" ("use_count", "last_used_at") WHERE ("archived" = false);



CREATE INDEX "idx_npc_templates_lookup" ON "public"."npc_content_templates" USING "btree" ("content_type", "personality", "tag") WHERE ("archived" = false);



CREATE UNIQUE INDEX "idx_observable_beaches_beach_id" ON "public"."observable_beaches" USING "btree" ("beach_id");



CREATE INDEX "idx_posting_log_post_type" ON "public"."posting_log" USING "btree" ("post_type");



CREATE INDEX "idx_posting_log_posted_at" ON "public"."posting_log" USING "btree" ("posted_at" DESC);



CREATE INDEX "idx_posting_log_type_posted_at" ON "public"."posting_log" USING "btree" ("post_type", "posted_at" DESC);



CREATE INDEX "idx_profiles_allow_implicit_tracking" ON "public"."profiles" USING "btree" ("allow_implicit_tracking") WHERE ("allow_implicit_tracking" = true);



CREATE UNIQUE INDEX "idx_profiles_display_name" ON "public"."profiles" USING "btree" ("display_name") WHERE ("display_name" IS NOT NULL);



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_home_beach_id" ON "public"."profiles" USING "btree" ("home_beach_id");



CREATE INDEX "idx_profiles_is_admin" ON "public"."profiles" USING "btree" ("is_admin") WHERE ("is_admin" = true);



CREATE INDEX "idx_profiles_is_mock" ON "public"."profiles" USING "btree" ("is_mock") WHERE ("is_mock" = true);



CREATE INDEX "idx_profiles_npc_config" ON "public"."profiles" USING "btree" ("activity_level", "personality_type") WHERE ("is_mock" = true);



CREATE INDEX "idx_profiles_preferences_v2_shown" ON "public"."profiles" USING "btree" ("preferences_v2_shown_at") WHERE ("preferences_v2_shown_at" IS NULL);



COMMENT ON INDEX "public"."idx_profiles_preferences_v2_shown" IS 'Partial index to efficiently find users who have not yet seen the preferences v2 announcement popup.';



CREATE INDEX "idx_profiles_referral_code" ON "public"."profiles" USING "btree" ("referral_code") WHERE ("referral_code" IS NOT NULL);



CREATE UNIQUE INDEX "idx_profiles_referral_code_lower" ON "public"."profiles" USING "btree" ("lower"("referral_code")) WHERE ("referral_code" IS NOT NULL);



CREATE INDEX "idx_profiles_surf_styles" ON "public"."profiles" USING "gin" ("surf_styles") WHERE ("surf_styles" IS NOT NULL);



CREATE INDEX "idx_profiles_timezone" ON "public"."profiles" USING "btree" ("timezone") WHERE ("timezone" IS NOT NULL);



CREATE INDEX "idx_rc_dlq_received_at" ON "public"."user_entitlements_failed_webhooks" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_rc_dlq_user_id" ON "public"."user_entitlements_failed_webhooks" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_referrals_code_lower" ON "public"."referrals" USING "btree" ("lower"("referral_code"));



CREATE INDEX "idx_referrals_created_at" ON "public"."referrals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_referrals_referee_id" ON "public"."referrals" USING "btree" ("referee_id");



CREATE INDEX "idx_referrals_referrer_id" ON "public"."referrals" USING "btree" ("referrer_id");



CREATE INDEX "idx_referrals_referrer_status" ON "public"."referrals" USING "btree" ("referrer_id", "status");



CREATE INDEX "idx_referrals_source" ON "public"."referrals" USING "btree" ("source");



CREATE INDEX "idx_referrals_status" ON "public"."referrals" USING "btree" ("status");



CREATE INDEX "idx_saved_windows_user_created" ON "public"."saved_windows" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_session_invitations_idempotency_key" ON "public"."session_invitations" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_session_invitations_invitee_email_lower" ON "public"."session_invitations" USING "btree" ("lower"("invitee_email"));



CREATE INDEX "idx_session_invitations_invitee_email_status" ON "public"."session_invitations" USING "btree" ("invitee_email", "status", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_session_invitations_invitee_id" ON "public"."session_invitations" USING "btree" ("invitee_id");



CREATE INDEX "idx_session_invitations_invitee_id_status" ON "public"."session_invitations" USING "btree" ("invitee_id", "status", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_session_invitations_inviter_id" ON "public"."session_invitations" USING "btree" ("inviter_id");



CREATE INDEX "idx_session_invitations_seen_at_null" ON "public"."session_invitations" USING "btree" ("seen_at") WHERE ("seen_at" IS NULL);



CREATE INDEX "idx_session_invitations_session_id" ON "public"."session_invitations" USING "btree" ("session_id");



CREATE INDEX "idx_session_likes_session_id" ON "public"."session_likes" USING "btree" ("session_id");



CREATE INDEX "idx_session_likes_session_user" ON "public"."session_likes" USING "btree" ("session_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_session_likes_user_id" ON "public"."session_likes" USING "btree" ("user_id");



CREATE INDEX "idx_session_logs_rating_score" ON "public"."session_logs" USING "btree" ("rating", "predicted_score") WHERE ("predicted_score" IS NOT NULL);



CREATE INDEX "idx_session_logs_user_created" ON "public"."session_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_session_media_created_at" ON "public"."session_media" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_session_media_deleted_at" ON "public"."session_media" USING "btree" ("deleted_at");



CREATE INDEX "idx_session_media_history_changed_at" ON "public"."session_media_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_session_media_history_changed_by" ON "public"."session_media_history" USING "btree" ("changed_by");



CREATE INDEX "idx_session_media_history_id" ON "public"."session_media_history" USING "btree" ("id", "changed_at" DESC);



CREATE INDEX "idx_session_media_media_type" ON "public"."session_media" USING "btree" ("media_type");



CREATE INDEX "idx_session_media_photos_recent" ON "public"."session_media" USING "btree" ("media_type", "created_at" DESC) WHERE ("media_type" = ANY (ARRAY['photo'::"text", 'image'::"text"]));



COMMENT ON INDEX "public"."idx_session_media_photos_recent" IS 'Partial index for recent photo lookups. Reduces size by 40% (photos only).';



CREATE INDEX "idx_session_media_session_id" ON "public"."session_media" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_session_media_user_id" ON "public"."session_media" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_session_share_links_created_at" ON "public"."session_share_links" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_session_share_links_session_id" ON "public"."session_share_links" USING "btree" ("session_id");



CREATE INDEX "idx_session_share_links_user_id_created_at" ON "public"."session_share_links" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_session_shares_analytics" ON "public"."session_shares" USING "btree" ("platform", "variant", "aspect_ratio", "created_at" DESC);



CREATE INDEX "idx_session_shares_aspect_ratio" ON "public"."session_shares" USING "btree" ("aspect_ratio") WHERE ("aspect_ratio" IS NOT NULL);



CREATE INDEX "idx_session_shares_created_at" ON "public"."session_shares" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_session_shares_platform" ON "public"."session_shares" USING "btree" ("platform");



CREATE INDEX "idx_session_shares_session_id" ON "public"."session_shares" USING "btree" ("session_id");



CREATE INDEX "idx_session_shares_user_id" ON "public"."session_shares" USING "btree" ("user_id");



CREATE INDEX "idx_session_shares_variant" ON "public"."session_shares" USING "btree" ("variant") WHERE ("variant" IS NOT NULL);



CREATE INDEX "idx_session_wave_obs_candidates_beach_observed" ON "public"."session_wave_observation_candidates" USING "btree" ("beach_id", "observed_at" DESC);



CREATE INDEX "idx_session_wave_obs_candidates_ml_prediction" ON "public"."session_wave_observation_candidates" USING "btree" ("ml_prediction_id") WHERE ("ml_prediction_id" IS NOT NULL);



CREATE INDEX "idx_session_wave_obs_candidates_user" ON "public"."session_wave_observation_candidates" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_board_id" ON "public"."sessions" USING "btree" ("board_id");



CREATE INDEX "idx_sessions_conditions" ON "public"."sessions" USING "btree" ("beach_id", "wave_height_ft", "wind_speed_mph") WHERE (("wave_height_ft" IS NOT NULL) OR ("wind_speed_mph" IS NOT NULL));



CREATE INDEX "idx_sessions_deleted_at" ON "public"."sessions" USING "btree" ("deleted_at");



CREATE INDEX "idx_sessions_forecast_accuracy" ON "public"."sessions" USING "btree" ("forecast_accuracy") WHERE ("forecast_accuracy" IS NOT NULL);



CREATE INDEX "idx_sessions_session_decomposition_gin" ON "public"."sessions" USING "gin" ("session_decomposition");



CREATE INDEX "idx_sessions_share_count" ON "public"."sessions" USING "btree" ("share_count" DESC) WHERE ("share_count" > 0);



CREATE INDEX "idx_sessions_skill_ratings" ON "public"."sessions" USING "gin" ("skill_ratings");



CREATE INDEX "idx_sessions_user_rated_completed" ON "public"."sessions" USING "btree" ("user_id", "rating" DESC, "arrival_time" DESC) WHERE (("status" = 'completed'::"text") AND ("rating" IS NOT NULL) AND ("rating" >= 3));



CREATE INDEX "idx_sessions_wave_height" ON "public"."sessions" USING "btree" ("wave_height_ft") WHERE ("wave_height_ft" IS NOT NULL);



CREATE INDEX "idx_sessions_wind_speed" ON "public"."sessions" USING "btree" ("wind_speed_mph") WHERE ("wind_speed_mph" IS NOT NULL);



CREATE INDEX "idx_sfs_actual_gin" ON "public"."session_forecast_snapshots" USING "gin" ("actual_conditions");



CREATE INDEX "idx_sfs_beach_date" ON "public"."session_forecast_snapshots" USING "btree" ("beach_id", "session_date" DESC);



CREATE INDEX "idx_sfs_beach_id" ON "public"."session_forecast_snapshots" USING "btree" ("beach_id");



CREATE INDEX "idx_sfs_date" ON "public"."session_forecast_snapshots" USING "btree" ("session_date" DESC);



CREATE INDEX "idx_sfs_forecast_gin" ON "public"."session_forecast_snapshots" USING "gin" ("forecast_snapshot");



CREATE INDEX "idx_sfs_forecast_vs_actual_gin" ON "public"."session_forecast_snapshots" USING "gin" ("forecast_vs_actual");



CREATE INDEX "idx_sfs_session_id" ON "public"."session_forecast_snapshots" USING "btree" ("session_id");



CREATE INDEX "idx_sfs_user_id" ON "public"."session_forecast_snapshots" USING "btree" ("user_id");



CREATE INDEX "idx_spot_feedback_spot_accurate" ON "public"."spot_feedback" USING "btree" ("spot_id", "accurate", "created_at" DESC);



CREATE INDEX "idx_spot_feedback_user_recent" ON "public"."spot_feedback" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_storage_usage_last_updated" ON "public"."storage_usage" USING "btree" ("last_updated" DESC);



CREATE INDEX "idx_storage_usage_user_id" ON "public"."storage_usage" USING "btree" ("user_id");



CREATE INDEX "idx_sun_times_beach_created_desc" ON "public"."sun_times" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "idx_sun_times_beach_date" ON "public"."sun_times" USING "btree" ("beach_id", "date");



CREATE INDEX "idx_surfline_shadow_beach_ts" ON "public"."surfline_shadow_forecasts" USING "btree" ("beach_id", "forecast_ts" DESC);



CREATE INDEX "idx_tide_forecasts_beach_created_desc" ON "public"."tide_forecasts" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "idx_tide_forecasts_beach_ts_utc" ON "public"."tide_forecasts" USING "btree" ("beach_id", "ts_utc");



CREATE INDEX "idx_tide_forecasts_mv_lookup" ON "public"."tide_forecasts" USING "btree" ("beach_id", "ts") INCLUDE ("tide_height_m");



CREATE INDEX "idx_trial_ending_push_log_sent_at" ON "public"."trial_ending_push_log" USING "btree" ("sent_at" DESC);



CREATE UNIQUE INDEX "idx_unique_daily_share" ON "public"."session_shares" USING "btree" ("session_id", "user_id", "platform", "share_date");



CREATE INDEX "idx_user_activities_created_at" ON "public"."user_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_activities_entity" ON "public"."user_activities" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_user_activities_type_created_at" ON "public"."user_activities" USING "btree" ("activity_type", "created_at" DESC);



CREATE INDEX "idx_user_activities_user_id_created_at" ON "public"."user_activities" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_badges_badge_slug" ON "public"."user_badges" USING "btree" ("badge_slug");



CREATE INDEX "idx_user_badges_unlocked_at" ON "public"."user_badges" USING "btree" ("unlocked_at");



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_beach_affinity_score" ON "public"."user_beach_affinity" USING "btree" ("user_id", "affinity_score" DESC);



CREATE INDEX "idx_user_beach_affinity_user_beach_covering" ON "public"."user_beach_affinity" USING "btree" ("user_id", "beach_id") INCLUDE ("affinity_score", "session_count", "last_surfed_at");



COMMENT ON INDEX "public"."idx_user_beach_affinity_user_beach_covering" IS 'Composite index for personalized recommendations. Reduces query time from full scan to 
  index-only scan.';



CREATE INDEX "idx_user_devices_token" ON "public"."user_devices" USING "btree" ("device_token");



CREATE INDEX "idx_user_devices_user_id" ON "public"."user_devices" USING "btree" ("user_id");



CREATE INDEX "idx_user_email_prefs_frequency" ON "public"."user_email_prefs" USING "btree" ("email_frequency");



CREATE INDEX "idx_user_email_prefs_timezone" ON "public"."user_email_prefs" USING "btree" ("timezone");



CREATE INDEX "idx_user_entitlements_active" ON "public"."user_entitlements" USING "btree" ("user_id") WHERE ("is_pro" = true);



CREATE INDEX "idx_user_events_beach_id" ON "public"."user_events" USING "btree" ("beach_id", "created_at" DESC) WHERE ("beach_id" IS NOT NULL);



CREATE INDEX "idx_user_events_bot_flagged" ON "public"."user_events" USING "btree" ("bot_flagged") WHERE ("bot_flagged" = true);



CREATE INDEX "idx_user_events_event_type" ON "public"."user_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_user_events_expires_at" ON "public"."user_events" USING "btree" ("expires_at");



CREATE INDEX "idx_user_events_session_id" ON "public"."user_events" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_user_events_session_id_unlinked" ON "public"."user_events" USING "btree" ("session_id") WHERE (("session_id" IS NOT NULL) AND ("user_id" IS NULL));



CREATE INDEX "idx_user_events_user_id" ON "public"."user_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_follows_follower_created" ON "public"."user_follows" USING "btree" ("follower_id", "created_at" DESC);



CREATE INDEX "idx_user_follows_following_created" ON "public"."user_follows" USING "btree" ("following_id", "created_at" DESC);



CREATE INDEX "idx_user_implicit_preferences_beaches" ON "public"."user_implicit_preferences" USING "gin" ("top_engaged_beach_ids");



CREATE INDEX "idx_user_implicit_preferences_break_types" ON "public"."user_implicit_preferences" USING "gin" ("break_type_weights");



CREATE INDEX "idx_user_implicit_preferences_confidence" ON "public"."user_implicit_preferences" USING "btree" ("confidence" DESC) WHERE ("confidence" >= 0.3);



CREATE INDEX "idx_user_implicit_preferences_location" ON "public"."user_implicit_preferences" USING "btree" ("location_centroid_lat", "location_centroid_lon") WHERE (("location_centroid_lat" IS NOT NULL) AND ("location_centroid_lon" IS NOT NULL));



CREATE INDEX "idx_user_surf_preferences_confidence" ON "public"."user_surf_preferences" USING "btree" ("confidence" DESC);



CREATE INDEX "idx_user_surf_preferences_user" ON "public"."user_surf_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_xp_level" ON "public"."user_xp" USING "btree" ("level");



CREATE INDEX "idx_user_xp_user_id" ON "public"."user_xp" USING "btree" ("user_id");



CREATE INDEX "idx_xp_events_action" ON "public"."xp_events" USING "btree" ("action");



CREATE INDEX "idx_xp_events_created_at" ON "public"."xp_events" USING "btree" ("created_at");



CREATE INDEX "idx_xp_events_user_id" ON "public"."xp_events" USING "btree" ("user_id");



CREATE INDEX "intel_post_confirmations_post_id_idx" ON "public"."intel_post_confirmations" USING "btree" ("intel_post_id");



CREATE INDEX "intel_post_confirmations_user_id_idx" ON "public"."intel_post_confirmations" USING "btree" ("user_id");



CREATE INDEX "intel_posts_beach_id_idx" ON "public"."intel_posts" USING "btree" ("beach_id");



CREATE INDEX "intel_posts_confirmations_count_idx" ON "public"."intel_posts" USING "btree" ("confirmations_count" DESC);



CREATE INDEX "intel_posts_created_at_idx" ON "public"."intel_posts" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "intel_posts_daily_dedupe_idx" ON "public"."intel_posts" USING "btree" ("user_id", "dedupe_hash", ((("created_at" AT TIME ZONE 'UTC'::"text"))::"date")) WHERE ("dedupe_hash" IS NOT NULL);



CREATE INDEX "intel_posts_is_active_idx" ON "public"."intel_posts" USING "btree" ("is_active");



CREATE INDEX "intel_posts_location_idx" ON "public"."intel_posts" USING "gist" ("public"."st_point"(("longitude")::double precision, ("latitude")::double precision));



CREATE INDEX "intel_posts_tag_idx" ON "public"."intel_posts" USING "btree" ("tag");



CREATE INDEX "intel_posts_user_id_idx" ON "public"."intel_posts" USING "btree" ("user_id");



CREATE INDEX "intel_votes_intel_post_id_idx" ON "public"."intel_votes" USING "btree" ("intel_post_id");



CREATE INDEX "intel_votes_post_vote_type_idx" ON "public"."intel_votes" USING "btree" ("intel_post_id", "vote_type");



CREATE INDEX "intel_votes_user_id_idx" ON "public"."intel_votes" USING "btree" ("user_id");



CREATE UNIQUE INDEX "mv_beach_amenities_beach_id_uidx" ON "public"."mv_beach_amenities" USING "btree" ("beach_id");



CREATE INDEX "notification_delivery_attempts_channel_status_idx" ON "public"."notification_delivery_attempts" USING "btree" ("channel", "status", "created_at" DESC);



CREATE INDEX "notification_delivery_attempts_event_idx" ON "public"."notification_delivery_attempts" USING "btree" ("notification_event_id");



CREATE INDEX "notification_events_recipient_idx" ON "public"."notification_events" USING "btree" ("recipient_user_id", "created_at" DESC);



CREATE INDEX "pending_alert_captures_cleanup_idx" ON "public"."pending_alert_captures" USING "btree" ("expires_at") WHERE ("consumed_at" IS NULL);



CREATE INDEX "pending_alert_captures_pending_lookup_idx" ON "public"."pending_alert_captures" USING "btree" ("email", "expires_at") WHERE ("consumed_at" IS NULL);



CREATE INDEX "profiles_deleted_at_idx" ON "public"."profiles" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "roadmap_item_submissions_decision_idx" ON "public"."roadmap_item_submissions" USING "btree" ("decision") WHERE ("decision" = 'pending'::"public"."roadmap_submission_decision");



CREATE INDEX "roadmap_item_submissions_submitter_idx" ON "public"."roadmap_item_submissions" USING "btree" ("submitter_user_id");



CREATE INDEX "roadmap_items_shipped_at_idx" ON "public"."roadmap_items" USING "btree" ("shipped_at" DESC) WHERE ("status" = 'shipped'::"public"."roadmap_status");



CREATE INDEX "roadmap_items_status_idx" ON "public"."roadmap_items" USING "btree" ("status");



CREATE INDEX "roadmap_votes_user_id_idx" ON "public"."roadmap_votes" USING "btree" ("user_id");



CREATE INDEX "sessions_beach_idx" ON "public"."sessions" USING "btree" ("beach_id", "created_at" DESC);



CREATE INDEX "sessions_created_idx" ON "public"."sessions" USING "btree" ("created_at" DESC);



CREATE INDEX "sessions_custom_spot_id_idx" ON "public"."sessions" USING "btree" ("custom_spot_id") WHERE ("custom_spot_id" IS NOT NULL);



CREATE INDEX "sessions_user_idx" ON "public"."sessions" USING "btree" ("user_id", "arrival_time" DESC);



CREATE UNIQUE INDEX "uniq_email_per_user_per_type_per_day" ON "public"."email_send_log" USING "btree" ("user_id", "email_type", "local_date");



CREATE UNIQUE INDEX "uniq_saved_window" ON "public"."saved_windows" USING "btree" ("user_id", "beach_id", "start_ts", "end_ts");



CREATE INDEX "user_blocks_blocked_id_idx" ON "public"."user_blocks" USING "btree" ("blocked_id");



CREATE INDEX "wq_monitoring_stations_active_state_idx" ON "public"."wq_monitoring_stations" USING "btree" ("active", "state");



CREATE INDEX "wq_monitoring_stations_geog_gist" ON "public"."wq_monitoring_stations" USING "gist" ("geog");



CREATE INDEX "wq_monitoring_stations_nearest_beach_id_idx" ON "public"."wq_monitoring_stations" USING "btree" ("nearest_beach_id");



CREATE INDEX "wq_samples_station_id_sample_date_idx" ON "public"."wq_samples" USING "btree" ("station_id", "sample_date" DESC);



CREATE OR REPLACE TRIGGER "beach_editorial_content_updated_at" BEFORE UPDATE ON "public"."beach_editorial_content" FOR EACH ROW EXECUTE FUNCTION "public"."update_beach_editorial_updated_at"();



CREATE OR REPLACE TRIGGER "beach_review_likes_count_trigger" AFTER INSERT OR DELETE ON "public"."beach_review_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_helpful_count"();



CREATE OR REPLACE TRIGGER "city_editorial_content_updated_at" BEFORE UPDATE ON "public"."city_editorial_content" FOR EACH ROW EXECUTE FUNCTION "public"."update_city_editorial_updated_at"();



CREATE OR REPLACE TRIGGER "content_reports_notify_webhook" AFTER INSERT ON "public"."content_reports" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://vawdnbbgawichorsjiwe.supabase.co/functions/v1/notify-content-report', 'POST', '{"Content-Type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "custom_spots_lock_user_id_trigger" BEFORE UPDATE ON "public"."custom_spots" FOR EACH ROW EXECUTE FUNCTION "public"."custom_spots_lock_user_id"();



CREATE OR REPLACE TRIGGER "dev_trap_session_mutations" AFTER INSERT OR DELETE OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."dev_log_session_mutation"();



CREATE OR REPLACE TRIGGER "intel_post_confirmations_count_trigger" AFTER INSERT OR DELETE ON "public"."intel_post_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."update_intel_confirmations_count"();



CREATE OR REPLACE TRIGGER "intel_reports_count_trigger" AFTER INSERT OR DELETE ON "public"."intel_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_intel_report_count"();



CREATE OR REPLACE TRIGGER "log_beach_photos_changes" BEFORE DELETE OR UPDATE ON "public"."beach_photos" FOR EACH ROW EXECUTE FUNCTION "public"."log_revision"();



CREATE OR REPLACE TRIGGER "log_beach_reviews_changes" BEFORE DELETE OR UPDATE ON "public"."beach_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."log_revision"();



CREATE OR REPLACE TRIGGER "log_session_media_changes" BEFORE DELETE OR UPDATE ON "public"."session_media" FOR EACH ROW EXECUTE FUNCTION "public"."log_revision"();



CREATE OR REPLACE TRIGGER "ml_model_registry_updated_at" BEFORE UPDATE ON "public"."ml_model_registry" FOR EACH ROW EXECUTE FUNCTION "public"."update_ml_model_registry_updated_at"();



CREATE OR REPLACE TRIGGER "npc_templates_updated_at" BEFORE UPDATE ON "public"."npc_content_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_npc_template_updated_at"();



CREATE OR REPLACE TRIGGER "remove_custom_spot_favorite_on_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."custom_spots" FOR EACH ROW EXECUTE FUNCTION "public"."remove_custom_spot_favorite_on_soft_delete"();



CREATE OR REPLACE TRIGGER "set_alert_rules_updated_at" BEFORE UPDATE ON "public"."alert_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_intel_post_beach_id" BEFORE INSERT ON "public"."intel_posts" FOR EACH ROW EXECUTE FUNCTION "public"."assign_nearest_beach_to_intel_post"();



COMMENT ON TRIGGER "set_intel_post_beach_id" ON "public"."intel_posts" IS 'Auto-assigns nearest beach (within 2 miles) to intel posts on insert. Fixes Unknown Beach display issue for quick check-ins.';



CREATE OR REPLACE TRIGGER "set_roadmap_item_submissions_updated_at" BEFORE UPDATE ON "public"."roadmap_item_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_roadmap_items_updated_at" BEFORE UPDATE ON "public"."roadmap_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_entitlements_updated_at" BEFORE UPDATE ON "public"."user_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_forecast_alert_deliveries_set_updated_at" BEFORE UPDATE ON "public"."forecast_alert_deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notification_send_log_set_updated_at" BEFORE UPDATE ON "public"."notification_send_log" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_delete_profiles" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_delete_on_protected"();



CREATE OR REPLACE TRIGGER "trg_update_intel_vote_counts" AFTER INSERT OR DELETE OR UPDATE ON "public"."intel_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_intel_vote_counts"();



CREATE OR REPLACE TRIGGER "trigger_capture_board_snapshot" BEFORE INSERT OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."capture_board_snapshot"();



CREATE OR REPLACE TRIGGER "trigger_create_session_forecast_snapshot" AFTER INSERT OR UPDATE OF "status", "beach_id", "wave_quality", "water_temp", "crowd_level", "parking_ease", "rating", "notes", "duration_minutes", "arrival_time", "wave_height_ft", "wind_speed_mph", "wind_direction", "forecast_accuracy", "tide_height_ft", "tide_status" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."create_session_forecast_snapshot"();



CREATE OR REPLACE TRIGGER "trigger_decrement_share_count" AFTER DELETE ON "public"."session_shares" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_session_share_count"();



CREATE OR REPLACE TRIGGER "trigger_increment_share_count" AFTER INSERT ON "public"."session_shares" FOR EACH ROW EXECUTE FUNCTION "public"."increment_session_share_count"();



CREATE OR REPLACE TRIGGER "trigger_maintain_board_session_count" AFTER INSERT OR DELETE OR UPDATE OF "board_id" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_board_session_count"();



CREATE OR REPLACE TRIGGER "trigger_track_session_media_upload" AFTER INSERT OR DELETE ON "public"."session_media" FOR EACH ROW EXECUTE FUNCTION "public"."track_session_media_upload"();



CREATE OR REPLACE TRIGGER "trigger_update_ioos_station_coordinates" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."ioos_stations" FOR EACH ROW EXECUTE FUNCTION "public"."update_ioos_station_coordinates"();



CREATE OR REPLACE TRIGGER "trigger_update_ndbc_direct_station_coordinates" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."ndbc_direct_stations" FOR EACH ROW EXECUTE FUNCTION "public"."update_ndbc_direct_station_coordinates"();



CREATE OR REPLACE TRIGGER "trigger_update_ndbc_direct_station_updated_at" BEFORE UPDATE ON "public"."ndbc_direct_stations" FOR EACH ROW WHEN (((NOT ("old"."latitude" IS DISTINCT FROM "new"."latitude")) AND (NOT ("old"."longitude" IS DISTINCT FROM "new"."longitude")))) EXECUTE FUNCTION "public"."update_ndbc_direct_station_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_session_comments_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_comments_count"();



CREATE OR REPLACE TRIGGER "trigger_update_session_likes_count" AFTER INSERT OR DELETE ON "public"."session_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_likes_count"();



CREATE OR REPLACE TRIGGER "update_beach_affinity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_beach_affinity_on_session_change"();



COMMENT ON TRIGGER "update_beach_affinity_trigger" ON "public"."sessions" IS 'Maintains user_beach_affinity table in sync with session changes';



CREATE OR REPLACE TRIGGER "update_beach_daily_intel_updated_at_trigger" BEFORE UPDATE ON "public"."beach_daily_intel" FOR EACH ROW EXECUTE FUNCTION "public"."update_beach_daily_intel_updated_at"();



CREATE OR REPLACE TRIGGER "update_follow_counts_trigger" AFTER INSERT OR DELETE ON "public"."user_follows" FOR EACH ROW EXECUTE FUNCTION "public"."update_follow_counts"();



CREATE OR REPLACE TRIGGER "update_forecast_accuracy_votes_updated_at" BEFORE UPDATE ON "public"."forecast_accuracy_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_referrals_updated_at" BEFORE UPDATE ON "public"."referrals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_devices_updated_at" BEFORE UPDATE ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_xp_updated_at" BEFORE UPDATE ON "public"."user_xp" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_email_prefs_updated_at" BEFORE UPDATE ON "public"."user_email_prefs" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_email_prefs_updated_at"();



ALTER TABLE ONLY "public"."activation_push_log"
    ADD CONSTRAINT "activation_push_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_deliveries"
    ADD CONSTRAINT "alert_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."alert_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_queue"
    ADD CONSTRAINT "alert_queue_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_queue"
    ADD CONSTRAINT "alert_queue_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_queue"
    ADD CONSTRAINT "alert_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_amenity_sources"
    ADD CONSTRAINT "beach_amenity_sources_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_amenity_sources"
    ADD CONSTRAINT "beach_amenity_sources_ccc_location_id_fkey" FOREIGN KEY ("ccc_location_id") REFERENCES "public"."ccc_access_locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_daily_intel"
    ADD CONSTRAINT "beach_daily_intel_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_dioramas"
    ADD CONSTRAINT "beach_dioramas_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."beach_editorial_content"
    ADD CONSTRAINT "beach_editorial_content_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_forecast_accuracy"
    ADD CONSTRAINT "beach_forecast_accuracy_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_height_offsets"
    ADD CONSTRAINT "beach_height_offsets_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_photos"
    ADD CONSTRAINT "beach_photos_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_photos_history"
    ADD CONSTRAINT "beach_photos_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."beach_recommendation_calibration"
    ADD CONSTRAINT "beach_recommendation_calibration_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."beach_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_review_likes"
    ADD CONSTRAINT "beach_review_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_reviews"
    ADD CONSTRAINT "beach_reviews_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_reviews_history"
    ADD CONSTRAINT "beach_reviews_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."beach_reviews"
    ADD CONSTRAINT "beach_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_sources"
    ADD CONSTRAINT "beach_sources_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_water_quality"
    ADD CONSTRAINT "beach_water_quality_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beach_water_quality"
    ADD CONSTRAINT "beach_water_quality_monitoring_station_id_fkey" FOREIGN KEY ("monitoring_station_id") REFERENCES "public"."wq_monitoring_stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."beaches"
    ADD CONSTRAINT "beaches_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_target_owner_id_fkey" FOREIGN KEY ("target_owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corrected_forecasts"
    ADD CONSTRAINT "corrected_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_spots"
    ADD CONSTRAINT "custom_spots_nearest_beach_id_fkey" FOREIGN KEY ("nearest_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_spots"
    ADD CONSTRAINT "custom_spots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_notes_queue"
    ADD CONSTRAINT "dev_notes_queue_posting_log_id_fkey" FOREIGN KEY ("posting_log_id") REFERENCES "public"."posting_log"("id");



ALTER TABLE ONLY "public"."email_click_events"
    ADD CONSTRAINT "email_click_events_email_send_log_id_fkey" FOREIGN KEY ("email_send_log_id") REFERENCES "public"."email_send_log"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_best_beach_id_fkey" FOREIGN KEY ("best_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enhanced_forecasts"
    ADD CONSTRAINT "enhanced_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_custom_spot_id_fkey" FOREIGN KEY ("custom_spot_id") REFERENCES "public"."custom_spots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorite_beaches"
    ADD CONSTRAINT "favorite_beaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_accuracy_votes"
    ADD CONSTRAINT "forecast_accuracy_votes_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_accuracy_votes"
    ADD CONSTRAINT "forecast_accuracy_votes_forecast_id_fkey" FOREIGN KEY ("forecast_id") REFERENCES "public"."enhanced_forecasts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_accuracy_votes"
    ADD CONSTRAINT "forecast_accuracy_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_alert_deliveries"
    ADD CONSTRAINT "forecast_alert_deliveries_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_alert_deliveries"
    ADD CONSTRAINT "forecast_alert_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_intel_post_id_fkey" FOREIGN KEY ("intel_post_id") REFERENCES "public"."intel_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_post_confirmations"
    ADD CONSTRAINT "intel_post_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_posts"
    ADD CONSTRAINT "intel_posts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_posts"
    ADD CONSTRAINT "intel_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_reports"
    ADD CONSTRAINT "intel_reports_intel_post_id_fkey" FOREIGN KEY ("intel_post_id") REFERENCES "public"."intel_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_reports"
    ADD CONSTRAINT "intel_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_votes"
    ADD CONSTRAINT "intel_votes_intel_post_id_fkey" FOREIGN KEY ("intel_post_id") REFERENCES "public"."intel_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_votes"
    ADD CONSTRAINT "intel_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ioos_observations"
    ADD CONSTRAINT "ioos_observations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."ioos_stations"("station_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ioos_stations"
    ADD CONSTRAINT "ioos_stations_nearest_beach_id_fkey" FOREIGN KEY ("nearest_beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."marine_forecasts"
    ADD CONSTRAINT "marine_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ml_predictions_log"
    ADD CONSTRAINT "ml_predictions_log_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ndbc_direct_observations"
    ADD CONSTRAINT "ndbc_direct_observations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."ndbc_direct_stations"("station_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ndbc_direct_stations"
    ADD CONSTRAINT "ndbc_direct_stations_nearest_beach_id_fkey" FOREIGN KEY ("nearest_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_notification_event_id_fkey" FOREIGN KEY ("notification_event_id") REFERENCES "public"."notification_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_send_log"
    ADD CONSTRAINT "notification_send_log_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_send_log"
    ADD CONSTRAINT "notification_send_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_alert_captures"
    ADD CONSTRAINT "pending_alert_captures_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."pending_alert_captures"
    ADD CONSTRAINT "pending_alert_captures_consumed_user_id_fkey" FOREIGN KEY ("consumed_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."personalization_milestones"
    ADD CONSTRAINT "personalization_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_default_beach_id_fkey" FOREIGN KEY ("home_beach_id") REFERENCES "public"."beaches"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_home_beach_id_fkey" FOREIGN KEY ("home_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_item_submissions"
    ADD CONSTRAINT "roadmap_item_submissions_merged_into_item_id_fkey" FOREIGN KEY ("merged_into_item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_item_submissions"
    ADD CONSTRAINT "roadmap_item_submissions_submitter_user_id_fkey" FOREIGN KEY ("submitter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_votes"
    ADD CONSTRAINT "roadmap_votes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_votes"
    ADD CONSTRAINT "roadmap_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_windows"
    ADD CONSTRAINT "saved_windows_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_windows"
    ADD CONSTRAINT "saved_windows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_forecast_snapshots"
    ADD CONSTRAINT "session_forecast_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invitations"
    ADD CONSTRAINT "session_invitations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_likes"
    ADD CONSTRAINT "session_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_media_history"
    ADD CONSTRAINT "session_media_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_media"
    ADD CONSTRAINT "session_media_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_media"
    ADD CONSTRAINT "session_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_share_links"
    ADD CONSTRAINT "session_share_links_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_share_links"
    ADD CONSTRAINT "session_share_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_shares"
    ADD CONSTRAINT "session_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_wave_observation_candidates"
    ADD CONSTRAINT "session_wave_observation_candidates_ml_prediction_id_fkey" FOREIGN KEY ("ml_prediction_id") REFERENCES "public"."ml_predictions_log"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_wave_observation_candidates"
    ADD CONSTRAINT "session_wave_observation_candidates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_custom_spot_id_fkey" FOREIGN KEY ("custom_spot_id") REFERENCES "public"."custom_spots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_feedback"
    ADD CONSTRAINT "spot_feedback_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_feedback"
    ADD CONSTRAINT "spot_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_usage"
    ADD CONSTRAINT "storage_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sun_times"
    ADD CONSTRAINT "sun_times_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."surfline_shadow_forecasts"
    ADD CONSTRAINT "surfline_shadow_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tide_forecasts"
    ADD CONSTRAINT "tide_forecasts_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trial_ending_push_log"
    ADD CONSTRAINT "trial_ending_push_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_activities"
    ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_slug_fkey" FOREIGN KEY ("badge_slug") REFERENCES "public"."badge_definitions"("badge_slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_beach_affinity"
    ADD CONSTRAINT "user_beach_affinity_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_beach_affinity"
    ADD CONSTRAINT "user_beach_affinity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_email_prefs"
    ADD CONSTRAINT "user_email_prefs_home_beach_id_fkey" FOREIGN KEY ("home_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_email_prefs"
    ADD CONSTRAINT "user_email_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_beach_id_fkey" FOREIGN KEY ("beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_implicit_preferences"
    ADD CONSTRAINT "user_implicit_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_surf_preferences"
    ADD CONSTRAINT "user_surf_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_surf_preferences"
    ADD CONSTRAINT "user_surf_preferences_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_xp"
    ADD CONSTRAINT "user_xp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wq_monitoring_stations"
    ADD CONSTRAINT "wq_monitoring_stations_nearest_beach_id_fkey" FOREIGN KEY ("nearest_beach_id") REFERENCES "public"."beaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wq_samples"
    ADD CONSTRAINT "wq_samples_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."wq_monitoring_stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."xp_events"
    ADD CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete any beach" ON "public"."beaches" FOR DELETE USING ("public"."is_admin_user"());



CREATE POLICY "Admins can delete any intel post" ON "public"."intel_posts" FOR DELETE USING ("public"."is_admin_user"());



CREATE POLICY "Admins can delete any photo" ON "public"."beach_photos" FOR DELETE USING ("public"."is_admin_user"());



CREATE POLICY "Admins can delete any review" ON "public"."beach_reviews" FOR DELETE USING ("public"."is_admin_user"());



CREATE POLICY "Admins can insert beaches" ON "public"."beaches" FOR INSERT WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can insert photos" ON "public"."beach_photos" FOR INSERT WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can update any beach" ON "public"."beaches" FOR UPDATE USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can update any intel post" ON "public"."intel_posts" FOR UPDATE USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can update any photo" ON "public"."beach_photos" FOR UPDATE USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can update any review" ON "public"."beach_reviews" FOR UPDATE USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can view all beaches" ON "public"."beaches" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Admins can view all intel posts" ON "public"."intel_posts" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Admins can view all photos" ON "public"."beach_photos" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Admins can view all reviews" ON "public"."beach_reviews" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Admins can view audit logs" ON "public"."admin_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view media history" ON "public"."session_media_history" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Admins can view photos history" ON "public"."beach_photos_history" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Admins can view reviews history" ON "public"."beach_reviews_history" FOR SELECT USING ("public"."is_admin_user"());



CREATE POLICY "Allow anon read access to ndbc_direct_observations" ON "public"."ndbc_direct_observations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon read access to ndbc_direct_stations" ON "public"."ndbc_direct_stations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read access" ON "public"."beach_daily_intel" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."embed_impressions" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow read access to ioos_observations" ON "public"."ioos_observations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to ioos_stations" ON "public"."ioos_stations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to ndbc_direct_observations" ON "public"."ndbc_direct_observations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to ndbc_direct_stations" ON "public"."ndbc_direct_stations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow service role full access to ioos_observations" ON "public"."ioos_observations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to ioos_stations" ON "public"."ioos_stations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to ndbc_direct_observations" ON "public"."ndbc_direct_observations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to ndbc_direct_stations" ON "public"."ndbc_direct_stations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view badge definitions" ON "public"."badge_definitions" FOR SELECT USING (true);



CREATE POLICY "Delete own like" ON "public"."beach_review_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Insert own like" ON "public"."beach_review_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Intel confirmations are readable" ON "public"."intel_post_confirmations" FOR SELECT USING (true);



CREATE POLICY "Intel posts are publicly readable" ON "public"."intel_posts" FOR SELECT USING (true);



CREATE POLICY "Only service role can manage templates" ON "public"."npc_content_templates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Public profiles are viewable by all" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read beaches" ON "public"."beaches" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read calibration" ON "public"."beach_recommendation_calibration" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Read likes (auth)" ON "public"."beach_review_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role and users can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Service role can insert audit logs" ON "public"."admin_audit_log" FOR INSERT WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage alert deliveries" ON "public"."alert_deliveries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage alert queue" ON "public"."alert_queue" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage entitlements" ON "public"."user_entitlements" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can read all alert rules" ON "public"."alert_rules" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can read all predictions" ON "public"."ml_predictions_log" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can update alert rules" ON "public"."alert_rules" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."digest_run_stats" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role has full access to email logs" ON "public"."email_send_log" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role has full access to saved windows" ON "public"."saved_windows" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role has full access to session logs" ON "public"."session_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages activation push log" ON "public"."activation_push_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages rc DLQ" ON "public"."user_entitlements_failed_webhooks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages session wave observation candidates" ON "public"."session_wave_observation_candidates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages trial-ending push log" ON "public"."trial_ending_push_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can insert XP events" ON "public"."xp_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "System can insert user XP" ON "public"."user_xp" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "System can insert user badges" ON "public"."user_badges" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Templates are readable by authenticated users" ON "public"."npc_content_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create own session share links" ON "public"."session_share_links" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_share_links"."session_id") AND (("sessions"."is_public" = true) OR ("sessions"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can create private beaches" ON "public"."beaches" FOR INSERT TO "authenticated" WITH CHECK ((("is_private" = true) AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Users can create referrals for themselves" ON "public"."referrals" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "referee_id"));



CREATE POLICY "Users can create shares for sessions they can view" ON "public"."session_shares" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_shares"."session_id") AND (("sessions"."is_public" = true) OR ("sessions"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete own alert rules" ON "public"."alert_rules" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own private beaches" ON "public"."beaches" FOR DELETE TO "authenticated" USING ((("is_private" = true) AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Users can delete own reports" ON "public"."intel_reports" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own devices" ON "public"."user_devices" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own events" ON "public"."user_events" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own saved windows" ON "public"."saved_windows" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own shares" ON "public"."session_shares" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can follow others" ON "public"."user_follows" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Users can insert own alert rules" ON "public"."alert_rules" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own milestones" ON "public"."personalization_milestones" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can insert own storage usage" ON "public"."storage_usage" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own devices" ON "public"."user_devices" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own email prefs" ON "public"."user_email_prefs" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own events" ON "public"."user_events" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."allow_implicit_tracking" = true))))));



CREATE POLICY "Users can insert their own saved windows" ON "public"."saved_windows" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own session logs" ON "public"."session_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark own milestones shown" ON "public"."personalization_milestones" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own activation push log" ON "public"."activation_push_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own alert deliveries" ON "public"."alert_deliveries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own alert rules" ON "public"."alert_rules" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own entitlement" ON "public"."user_entitlements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own milestones" ON "public"."personalization_milestones" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own trial-ending push log" ON "public"."trial_ending_push_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can report posts" ON "public"."intel_reports" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can respond to invitations they received" ON "public"."session_invitations" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "invitee_id") OR ("lower"("invitee_email") = "lower"((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "invitee_id") OR ("lower"("invitee_email") = "lower"((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")))));



CREATE POLICY "Users can unfollow others" ON "public"."user_follows" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Users can update own XP" ON "public"."user_xp" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own alert rules" ON "public"."alert_rules" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own private beaches" ON "public"."beaches" FOR UPDATE TO "authenticated" USING ((("is_private" = true) AND ("owner_id" = "auth"."uid"()))) WITH CHECK ((("is_private" = true) AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own referrals as referee" ON "public"."referrals" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "referee_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "referee_id"));



CREATE POLICY "Users can update own storage usage" ON "public"."storage_usage" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own devices" ON "public"."user_devices" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own email prefs" ON "public"."user_email_prefs" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own preferences" ON "public"."user_surf_preferences" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own session logs" ON "public"."session_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view follow relationships" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "Users can view invitations they received" ON "public"."session_invitations" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "invitee_id") OR ("lower"("invitee_email") = "lower"((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")))));



CREATE POLICY "Users can view own XP" ON "public"."user_xp" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own XP events" ON "public"."xp_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own badges" ON "public"."user_badges" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own private beaches" ON "public"."beaches" FOR SELECT TO "authenticated" USING ((("is_private" = true) AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Users can view own referrals as referee" ON "public"."referrals" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "referee_id"));



CREATE POLICY "Users can view own referrals as referrer" ON "public"."referrals" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "referrer_id"));



CREATE POLICY "Users can view own reports" ON "public"."intel_reports" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own session share links" ON "public"."session_share_links" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own storage usage" ON "public"."storage_usage" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view shares for public sessions or own sessions" ON "public"."session_shares" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_shares"."session_id") AND ("sessions"."is_public" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_shares"."session_id") AND ("sessions"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own affinities" ON "public"."user_beach_affinity" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own devices" ON "public"."user_devices" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own email logs" ON "public"."email_send_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own email prefs" ON "public"."user_email_prefs" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own events" ON "public"."user_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own preferences" ON "public"."user_implicit_preferences" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own preferences" ON "public"."user_surf_preferences" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own saved windows" ON "public"."saved_windows" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own session forecast snapshots" ON "public"."session_forecast_snapshots" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own session logs" ON "public"."session_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."account_deletions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_deletions_service_only" ON "public"."account_deletions" USING (false);



ALTER TABLE "public"."activation_push_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_delivery_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alert_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated can insert reports" ON "public"."content_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."badge_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_amenity_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_amenity_sources_delete_service_role" ON "public"."beach_amenity_sources" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "beach_amenity_sources_insert_service_role" ON "public"."beach_amenity_sources" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "beach_amenity_sources_select_public" ON "public"."beach_amenity_sources" FOR SELECT USING (true);



CREATE POLICY "beach_amenity_sources_update_service_role" ON "public"."beach_amenity_sources" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."beach_daily_intel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_dioramas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_dioramas_public_read" ON "public"."beach_dioramas" FOR SELECT USING (true);



CREATE POLICY "beach_dioramas_service_role_all" ON "public"."beach_dioramas" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text")) WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



ALTER TABLE "public"."beach_editorial_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_editorial_content_admin_write" ON "public"."beach_editorial_content" USING (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR (("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "users"."email"
   FROM "auth"."users"
  WHERE (("users"."raw_app_meta_data" ->> 'is_admin'::"text") = 'true'::"text")))));



CREATE POLICY "beach_editorial_content_public_read" ON "public"."beach_editorial_content" FOR SELECT USING (true);



ALTER TABLE "public"."beach_forecast_accuracy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_forecast_accuracy_select" ON "public"."beach_forecast_accuracy" FOR SELECT USING (true);



CREATE POLICY "beach_forecast_accuracy_write" ON "public"."beach_forecast_accuracy" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



ALTER TABLE "public"."beach_height_offsets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_height_offsets_service_role" ON "public"."beach_height_offsets" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."beach_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_photos_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_photos_read_public" ON "public"."beach_photos" FOR SELECT USING ((("deleted_at" IS NULL) AND ("approved" = true)));



COMMENT ON POLICY "beach_photos_read_public" ON "public"."beach_photos" IS 'Public read access restricted to active (not soft-deleted) and approved photos only. This 
  prevents unauthorized access to deleted or unapproved content.';



ALTER TABLE "public"."beach_recommendation_calibration" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_review_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_reviews_delete_own" ON "public"."beach_reviews" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."beach_reviews_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_reviews_insert_own" ON "public"."beach_reviews" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "beach_reviews_select_all" ON "public"."beach_reviews" FOR SELECT USING (true);



CREATE POLICY "beach_reviews_update_own" ON "public"."beach_reviews" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."beach_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beach_water_quality" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beach_water_quality_delete_service_role" ON "public"."beach_water_quality" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "beach_water_quality_insert_service_role" ON "public"."beach_water_quality" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "beach_water_quality_select_public" ON "public"."beach_water_quality" FOR SELECT USING (true);



CREATE POLICY "beach_water_quality_update_service_role" ON "public"."beach_water_quality" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."beaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boards_delete_own" ON "public"."boards" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "boards_insert_own" ON "public"."boards" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "boards_select_own" ON "public"."boards" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "boards_update_own" ON "public"."boards" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."buoys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buoys_select_all" ON "public"."buoys" FOR SELECT USING (true);



CREATE POLICY "calibration_versions_authenticated_read" ON "public"."ml_calibration_versions" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "calibration_versions_service_role" ON "public"."ml_calibration_versions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."ccc_access_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ccc_access_locations_delete_service_role" ON "public"."ccc_access_locations" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "ccc_access_locations_insert_service_role" ON "public"."ccc_access_locations" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "ccc_access_locations_select_public" ON "public"."ccc_access_locations" FOR SELECT USING (true);



CREATE POLICY "ccc_access_locations_update_service_role" ON "public"."ccc_access_locations" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."city_editorial_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "city_editorial_content_admin_write" ON "public"."city_editorial_content" USING (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR (("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "users"."email"
   FROM "auth"."users"
  WHERE (("users"."raw_app_meta_data" ->> 'is_admin'::"text") = 'true'::"text")))));



CREATE POLICY "city_editorial_content_public_read" ON "public"."city_editorial_content" FOR SELECT USING (true);



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete_own" ON "public"."comments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "comments_insert_own" ON "public"."comments" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "comments_select_all" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "comments_update_own" ON "public"."comments" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corrected_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "corrected_forecasts_select_all" ON "public"."corrected_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."cron_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_spots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "custom_spots_delete_own" ON "public"."custom_spots" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "custom_spots_insert_own" ON "public"."custom_spots" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "custom_spots_select_own_or_public" ON "public"."custom_spots" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("visibility" = 'public'::"text")));



CREATE POLICY "custom_spots_update_own" ON "public"."custom_spots" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."data_cleanup_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dev_notes_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dev_session_mutation_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dev_session_mutation_audit_service_role_all" ON "public"."dev_session_mutation_audit" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text")) WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



ALTER TABLE "public"."digest_run_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_click_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_send_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_suppression_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."embed_impressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enhanced_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enhanced_forecasts_select_all" ON "public"."enhanced_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."fallback_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorite_beaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorite_beaches_delete_mock" ON "public"."favorite_beaches" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "favorite_beaches_delete_own" ON "public"."favorite_beaches" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "favorite_beaches_insert_mock" ON "public"."favorite_beaches" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "favorite_beaches_insert_own" ON "public"."favorite_beaches" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "favorite_beaches_select_own" ON "public"."favorite_beaches" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "favorite_beaches_update_own" ON "public"."favorite_beaches" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."forecast_accuracy_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forecast_alert_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_alert_deliveries_service_role_all" ON "public"."forecast_alert_deliveries" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."forecast_feedback_contexts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_votes_delete_policy" ON "public"."forecast_accuracy_votes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "forecast_votes_insert_policy" ON "public"."forecast_accuracy_votes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "forecast_votes_select_policy" ON "public"."forecast_accuracy_votes" FOR SELECT USING (true);



CREATE POLICY "forecast_votes_update_policy" ON "public"."forecast_accuracy_votes" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."intel_post_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intel_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intel_posts_delete_mock" ON "public"."intel_posts" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "intel_posts_insert_mock" ON "public"."intel_posts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "intel_posts_insert_own" ON "public"."intel_posts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "intel_posts_update_mock" ON "public"."intel_posts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."intel_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intel_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intel_votes_delete_own" ON "public"."intel_votes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "intel_votes_insert_own" ON "public"."intel_votes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "intel_votes_select_public" ON "public"."intel_votes" FOR SELECT USING (true);



CREATE POLICY "intel_votes_update_own" ON "public"."intel_votes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ioos_observations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ioos_stations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marine_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marine_forecasts_select_all" ON "public"."marine_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."ml_calibration_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ml_model_registry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ml_model_registry_service_role" ON "public"."ml_model_registry" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



COMMENT ON POLICY "ml_model_registry_service_role" ON "public"."ml_model_registry" IS 'Only service_role can access model registry. Used by cron jobs and retrain pipeline.';



ALTER TABLE "public"."ml_predictions_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ndbc_direct_observations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ndbc_direct_stations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_send_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_send_log_service_role_all" ON "public"."notification_send_log" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."npc_content_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "npc_templates_select_all" ON "public"."npc_content_templates" FOR SELECT USING (true);



ALTER TABLE "public"."pending_alert_captures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personalization_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posting_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posting_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_update_own_home_beach" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reporter can view own reports" ON "public"."content_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."roadmap_item_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roadmap_items_public_read" ON "public"."roadmap_items" FOR SELECT USING (true);



CREATE POLICY "roadmap_submissions_own_insert" ON "public"."roadmap_item_submissions" FOR INSERT WITH CHECK (("auth"."uid"() = "submitter_user_id"));



CREATE POLICY "roadmap_submissions_own_read" ON "public"."roadmap_item_submissions" FOR SELECT USING (("auth"."uid"() = "submitter_user_id"));



ALTER TABLE "public"."roadmap_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roadmap_votes_own_delete" ON "public"."roadmap_votes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "roadmap_votes_own_insert" ON "public"."roadmap_votes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "roadmap_votes_public_read" ON "public"."roadmap_votes" FOR SELECT USING (true);



ALTER TABLE "public"."saved_windows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_all" ON "public"."beach_sources" FOR SELECT USING (true);



ALTER TABLE "public"."session_forecast_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_likes_delete_own" ON "public"."session_likes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "session_likes_insert_own" ON "public"."session_likes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "session_likes_select_all" ON "public"."session_likes" FOR SELECT USING (true);



ALTER TABLE "public"."session_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_media_delete_owner_or_admin" ON "public"."session_media" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."session_media_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_media_insert_owner" ON "public"."session_media" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "session_media_select_public_owner_or_admin" ON "public"."session_media" FOR SELECT USING (((("deleted_at" IS NULL) AND (("session_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_media"."session_id") AND COALESCE("sessions"."is_public", false) AND ("sessions"."deleted_at" IS NULL)))))) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "session_media_update_owner_or_admin" ON "public"."session_media" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true)))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."session_share_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_wave_observation_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_delete_owner_or_admin" ON "public"."sessions" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "sessions_insert_owner_or_admin" ON "public"."sessions" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "sessions_select_owner_public_or_admin" ON "public"."sessions" FOR SELECT USING ((COALESCE("is_public", false) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "sessions_update_owner_or_admin" ON "public"."sessions" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true)))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."spot_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "spot_feedback_insert_own" ON "public"."spot_feedback" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "spot_feedback_select_own" ON "public"."spot_feedback" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."storage_bucket_docs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "storage_bucket_docs_public_read" ON "public"."storage_bucket_docs" FOR SELECT USING (true);



ALTER TABLE "public"."storage_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sun_times" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sun_times_select_all" ON "public"."sun_times" FOR SELECT USING (true);



ALTER TABLE "public"."surfline_shadow_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "surfline_shadow_select_all" ON "public"."surfline_shadow_forecasts" FOR SELECT USING (true);



CREATE POLICY "surfline_shadow_service_role_delete" ON "public"."surfline_shadow_forecasts" FOR DELETE USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "surfline_shadow_service_role_insert" ON "public"."surfline_shadow_forecasts" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "surfline_shadow_service_role_update" ON "public"."surfline_shadow_forecasts" FOR UPDATE USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."tide_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tide_forecasts_select_all" ON "public"."tide_forecasts" FOR SELECT USING (true);



ALTER TABLE "public"."trial_ending_push_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user can delete own blocks" ON "public"."user_blocks" FOR DELETE TO "authenticated" USING (("blocker_id" = "auth"."uid"()));



CREATE POLICY "user can insert own blocks" ON "public"."user_blocks" FOR INSERT TO "authenticated" WITH CHECK (("blocker_id" = "auth"."uid"()));



CREATE POLICY "user can view own blocks" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING (("blocker_id" = "auth"."uid"()));



ALTER TABLE "public"."user_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_activities_insert_own" ON "public"."user_activities" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_activities_select_all" ON "public"."user_activities" FOR SELECT USING (true);



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_beach_affinity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_can_update_own_onboarding" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_email_prefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_entitlements_failed_webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_implicit_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_surf_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_xp" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users read own notification events" ON "public"."notification_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_user_id"));



ALTER TABLE "public"."wq_monitoring_stations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wq_monitoring_stations_delete_service_role" ON "public"."wq_monitoring_stations" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "wq_monitoring_stations_insert_service_role" ON "public"."wq_monitoring_stations" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "wq_monitoring_stations_select_public" ON "public"."wq_monitoring_stations" FOR SELECT USING (true);



CREATE POLICY "wq_monitoring_stations_update_service_role" ON "public"."wq_monitoring_stations" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."wq_samples" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wq_samples_delete_service_role" ON "public"."wq_samples" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "wq_samples_insert_service_role" ON "public"."wq_samples" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "wq_samples_select_public" ON "public"."wq_samples" FOR SELECT USING (true);



CREATE POLICY "wq_samples_update_service_role" ON "public"."wq_samples" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."xp_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."enhanced_forecasts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."intel_post_confirmations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."intel_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."intel_votes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."marine_forecasts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tide_forecasts";






GRANT USAGE ON SCHEMA "posthog_export" TO "posthog_readonly";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "claude_migrator";



GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("path") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_invite_for_user"("inviter" "uuid", "invitee" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invite_for_user"("inviter" "uuid", "invitee" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_for_user"("inviter" "uuid", "invitee" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."addauth"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_nearest_beach_to_intel_post"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_nearest_beach_to_intel_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_ml_observations"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_ml_observations"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_ml_observations"("batch_size" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."backfill_ml_observations_batch"("batch_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."backfill_ml_observations_batch"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "service_role";



REVOKE ALL ON FUNCTION "public"."capture_board_snapshot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capture_board_snapshot"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_database_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_ml_drift"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_ml_drift"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_ml_ground_truth_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_ml_ground_truth_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_daily_forecast_notification_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_notification_type" "text", "p_local_forecast_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_daily_forecast_notification_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_notification_type" "text", "p_local_forecast_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_forecast_delivery_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_alert_type" "text", "p_dedupe_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_forecast_delivery_slot"("p_user_id" "uuid", "p_beach_id" "uuid", "p_alert_type" "text", "p_dedupe_hours" integer) TO "service_role";



GRANT ALL ON TABLE "public"."notification_events" TO "anon";
GRANT ALL ON TABLE "public"."notification_events" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_events" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_notification_events"("p_batch_size" integer, "p_lease_seconds" integer, "p_claim_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_notification_events"("p_batch_size" integer, "p_lease_seconds" integer, "p_claim_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_expired_events"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_expired_events"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_inactive_buoys"("inactive_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_beach_intel"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_beach_intel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_beach_intel"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_forecasts"("retention_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_ml_predictions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_ml_predictions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_orphan_smoke_profiles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_orphan_smoke_profiles"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_orphaned_session_media"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_orphaned_session_media"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_session_media_storage"("media_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_session_media_storage"("media_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_stale_enhanced_forecasts"("retention_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_all_affinities_initial"() TO "anon";
GRANT ALL ON FUNCTION "public"."compute_all_affinities_initial"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_all_affinities_initial"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_beach_affinity"("_user_id" "uuid", "_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_beach_affinity"("_user_id" "uuid", "_beach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_beach_affinity"("_user_id" "uuid", "_beach_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."compute_implicit_preferences"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_implicit_preferences"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."compute_user_match_score"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_user_match_score"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."compute_user_match_score"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."compute_user_match_score_batch"("p_user_id" "uuid", "p_beach_id" "uuid", "p_slots" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_user_match_score_batch"("p_user_id" "uuid", "p_beach_id" "uuid", "p_slots" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."compute_user_match_score_batch"("p_user_id" "uuid", "p_beach_id" "uuid", "p_slots" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."concat_text_array"("vals" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."concat_text_array"("vals" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."concat_text_array"("vals" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "service_role";



REVOKE ALL ON FUNCTION "public"."count_auth_apple_orphan_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."count_auth_apple_orphan_users"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_activity"("p_user_id" "uuid", "p_activity_type" character varying, "p_entity_type" character varying, "p_entity_id" "uuid", "p_metadata" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_custom_spot_guarded"("p_name" "text", "p_lat" double precision, "p_lon" double precision, "p_break_type" "text", "p_visibility" "text", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_custom_spot_guarded"("p_name" "text", "p_lat" double precision, "p_lon" double precision, "p_break_type" "text", "p_visibility" "text", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_custom_spot_guarded"("p_name" "text", "p_lat" double precision, "p_lon" double precision, "p_break_type" "text", "p_visibility" "text", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_session_forecast_snapshot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_session_forecast_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."custom_spots_lock_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."custom_spots_lock_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."custom_spots_lock_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."decrement_session_share_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decrement_session_share_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_account"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_account"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dev_log_session_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dev_log_session_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_anon_alert_capture"("p_user_id" "uuid", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_anon_alert_capture"("p_user_id" "uuid", "p_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."finalize_anon_alert_capture"("p_user_id" "uuid", "p_email" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."find_cities_by_pattern"("search_pattern" "text", "state_filter" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_cities_by_pattern"("search_pattern" "text", "state_filter" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."find_cities_by_pattern"("search_pattern" "text", "state_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_cities_by_pattern"("search_pattern" "text", "state_filter" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."ioos_stations" TO "anon";
GRANT ALL ON TABLE "public"."ioos_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."ioos_stations" TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearby_ioos_stations"("p_lat" numeric, "p_lon" numeric, "p_radius_km" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearby_ioos_stations"("p_lat" numeric, "p_lon" numeric, "p_radius_km" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearby_ioos_stations"("p_lat" numeric, "p_lon" numeric, "p_radius_km" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearest_beach_id"("post_lat" numeric, "post_lon" numeric, "max_distance_meters" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearest_beach_id"("post_lat" numeric, "post_lon" numeric, "max_distance_meters" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearest_beach_id"("post_lat" numeric, "post_lon" numeric, "max_distance_meters" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_orphaned_session_media"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_orphaned_session_media"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."follow_user_with_notification"("p_target_user_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."follow_user_with_notification"("p_target_user_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."follow_user_with_notification"("p_target_user_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."generate_referral_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "service_role";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_all_beach_locations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_all_beach_locations"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_all_beach_locations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_beach_locations"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beach_ml_performance"("p_beach_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beach_observation_station"("p_beach_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beach_review_stats"("target_beach_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_beach_reviews"("target_beach_id" "uuid", "offset_count" integer, "limit_count" integer, "min_rating" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beaches_by_location_with_scores"("p_city" "text", "p_state" "text", "p_country" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_beaches_by_metro_with_scores"("p_cities" "text"[], "p_state" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beaches_by_metro_with_scores"("p_cities" "text"[], "p_state" "text", "p_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_beaches_by_metro_with_scores"("p_cities" "text"[], "p_state" "text", "p_country" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_beaches_near"("_lat" double precision, "_lon" double precision, "_radius_km" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_best_times"("p_beach" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bulk_current_forecasts"("p_beach_ids" "uuid"[], "p_target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_bulk_current_forecasts"("p_beach_ids" "uuid"[], "p_target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bulk_current_forecasts"("p_beach_ids" "uuid"[], "p_target_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_cities_with_beach_skills"("min_beaches" integer) TO "authenticated";



GRANT ALL ON TABLE "public"."city_editorial_content" TO "anon";
GRANT ALL ON TABLE "public"."city_editorial_content" TO "authenticated";
GRANT ALL ON TABLE "public"."city_editorial_content" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_city_editorial"("p_city" "text", "p_state" "text", "p_country" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_city_editorial"("p_city" "text", "p_state" "text", "p_country" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_city_editorial"("p_city" "text", "p_state" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_city_editorial"("p_city" "text", "p_state" "text", "p_country" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_picks"("_beach_id" "uuid", "_radius_km" numeric) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_conditions_alert_candidates"("p_min_score" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_conditions_alert_candidates"("p_min_score" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_conversion_funnel"("days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_conversion_funnel"("days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_current_production_model"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_production_model"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_current_production_model"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_production_model"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_entity_history"("table_name" "text", "entity_id" "uuid", "limit_rows" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_entity_history"("table_name" "text", "entity_id" "uuid", "limit_rows" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_forecast_vs_observation_pairs"("p_days_back" integer, "p_max_distance_km" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_forecast_vs_observation_pairs"("p_days_back" integer, "p_max_distance_km" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_forecast_vs_observation_pairs"("p_days_back" integer, "p_max_distance_km" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_intel_confirmations"("target_post_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_location_stats"("p_city" "text", "p_state" "text", "p_country" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_metro_stats"("p_cities" "text"[], "p_state" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_metro_stats"("p_cities" "text"[], "p_state" "text", "p_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metro_stats"("p_cities" "text"[], "p_state" "text", "p_country" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_ml_health_metrics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ml_health_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ml_weekly_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_ml_weekly_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ml_weekly_metrics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_most_visited_beach"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_most_visited_beach"("user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_most_visited_beach"("user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_beaches"("input_lat" double precision, "input_lng" double precision, "max_distance_meters" integer, "limit_count" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_buoys"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer, "result_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_intel_posts"("center_lat" double precision, "center_lng" double precision, "limit_count" integer, "radius_miles" double precision, "tag_filter" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearest_buoy_with_conditions"("target_lat" double precision, "target_lng" double precision, "max_distance_m" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nowcast_anchors"("max_age_hours" numeric) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_observations_for_beach"("p_beach_id" "uuid", "p_hours_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_observations_for_beach"("p_beach_id" "uuid", "p_hours_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_observations_for_beach"("p_beach_id" "uuid", "p_hours_back" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_popular_beaches"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_popular_beaches"("p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_popular_beaches"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_popular_beaches"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_profile_stats"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_profile_stats"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_profile_stats"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_reengagement_email_candidates"("p_inactive_days" integer, "p_min_score" integer, "p_dedupe_hours" integer, "p_global_cooldown_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_reengagement_email_candidates"("p_inactive_days" integer, "p_min_score" integer, "p_dedupe_hours" integer, "p_global_cooldown_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_referral_leaderboard"("max_results" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_referral_leaderboard"("max_results" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_referral_leaderboard"("max_results" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_session_prompt_candidates"("p_min_score" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_session_prompt_candidates"("p_min_score" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_session_share_stats"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_session_share_stats"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_session_wave_observation_analytics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_session_wave_observation_analytics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_board_deck_stats"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_board_deck_stats"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_board_deck_stats"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_match_candidates"("p_user_id" "uuid", "p_exclude_beach_id" "uuid", "p_device_lat" double precision, "p_device_lon" double precision, "p_radius_km" double precision, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_match_candidates"("p_user_id" "uuid", "p_exclude_beach_id" "uuid", "p_device_lat" double precision, "p_device_lon" double precision, "p_radius_km" double precision, "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_match_candidates"("p_user_id" "uuid", "p_exclude_beach_id" "uuid", "p_device_lat" double precision, "p_device_lon" double precision, "p_radius_km" double precision, "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_referral_stats"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_referral_stats"("user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_referral_stats"("user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_session_match_comparison"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_session_match_comparison"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_session_match_comparison"("p_user_id" "uuid", "p_beach_id" "uuid", "p_wave_height" "text", "p_wave_period" "text", "p_wind_speed" "text", "p_wind_direction" "text", "p_tide_height" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_viral_coefficient"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_viral_coefficient"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_welcome_email_candidates"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_welcome_email_candidates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_worst_performing_beaches"("limit_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_worst_performing_beaches"("limit_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_yesterday_accuracy"("p_beach_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "postgres";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_session_share_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_session_share_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_session_share_count"("session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_session_share_count"("session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_station_discovery_misses"("seen_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_station_discovery_misses"("seen_ids" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "service_role";



REVOKE ALL ON FUNCTION "public"."like_session_with_notification"("p_session_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."like_session_with_notification"("p_session_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."like_session_with_notification"("p_session_id" "uuid", "p_actor_id" "uuid", "p_dedupe_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."link_anonymous_events"("p_session_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_anonymous_events"("p_session_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_revision"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "postgres";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."maintain_board_session_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."maintain_board_session_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."nightly_forecast_maintenance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."nightly_forecast_maintenance"() TO "service_role";



GRANT ALL ON TABLE "public"."user_activities" TO "anon";
GRANT ALL ON TABLE "public"."user_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activities" TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_session_invite"("p_actor_id" "uuid", "p_recipient_id" "uuid", "p_session_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_session_invite"("p_actor_id" "uuid", "p_recipient_id" "uuid", "p_session_id" "uuid", "p_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."notify_session_invite"("p_actor_id" "uuid", "p_recipient_id" "uuid", "p_session_id" "uuid", "p_payload" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_numeric_from_text"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_numeric_from_text"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_numeric_from_text"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preset_default_conditions"("p_preset" "text", "p_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."preset_default_conditions"("p_preset" "text", "p_beach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preset_default_conditions"("p_preset" "text", "p_beach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."preset_default_name"("p_preset" "text", "p_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."preset_default_name"("p_preset" "text", "p_beach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preset_default_name"("p_preset" "text", "p_beach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_delete_on_protected"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_delete_on_protected"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_delete_on_protected"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_forecasts_retention"("keep_days_raw" integer, "keep_days_enhanced" integer, "batch_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_forecasts_retention"("keep_days_raw" integer, "keep_days_enhanced" integer, "batch_size" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_implicit_history"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_implicit_history"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_referral_attribution"("referrer" "uuid", "referee" "uuid", "source" "text", "referral_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_referral_attribution"("referrer" "uuid", "referee" "uuid", "source" "text", "referral_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_referral_attribution"("referrer" "uuid", "referee" "uuid", "source" "text", "referral_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_beach_ml_baseline"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_beach_ml_baseline"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_enhanced_forecasts_for_active_beaches"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_mv_beach_amenities"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_mv_beach_amenities"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_observable_beaches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_observable_beaches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_custom_spot_favorite_on_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."remove_custom_spot_favorite_on_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_custom_spot_favorite_on_soft_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_entity"("table_name" "text", "entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_entity"("table_name" "text", "entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_database_maintenance"("cleanup_forecasts" boolean, "cleanup_buoys" boolean, "update_stats" boolean, "forecast_retention_days" integer, "buoy_inactive_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_audit_triggers_enabled"("enabled" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_audit_triggers_enabled"("enabled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_entity"("table_name" "text", "entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_entity"("table_name" "text", "entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("json") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("json") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("json") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" "json") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" "json") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."swell_windows_overlap"("p_min1" numeric, "p_max1" numeric, "p_min2" numeric, "p_max2" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."swell_windows_overlap"("p_min1" numeric, "p_max1" numeric, "p_min2" numeric, "p_max2" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_session_wave_observation_candidate"("p_session_id" "uuid", "p_user_id" "uuid", "p_beach_id" "uuid", "p_arrival_time" timestamp with time zone, "p_status" "text", "p_wave_height_ft" numeric, "p_source_created_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_session_wave_observation_candidate"("p_session_id" "uuid", "p_user_id" "uuid", "p_beach_id" "uuid", "p_arrival_time" timestamp with time zone, "p_status" "text", "p_wave_height_ft" numeric, "p_source_created_by" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_favorite_beach_guarded"("p_beach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_favorite_spot_guarded"("p_beach_id" "uuid", "p_custom_spot_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_favorite_spot_guarded"("p_beach_id" "uuid", "p_custom_spot_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_favorite_spot_guarded"("p_beach_id" "uuid", "p_custom_spot_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."track_session_media_upload"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_session_media_upload"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_manual_maintenance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_manual_maintenance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."try_insert_similarity_alert"("p_user_id" "uuid", "p_rule_id" "uuid", "p_beach_id" "uuid", "p_alert_date" "date", "p_send_at" timestamp with time zone, "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_best_hour" timestamp with time zone, "p_conditions_snapshot" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_insert_similarity_alert"("p_user_id" "uuid", "p_rule_id" "uuid", "p_beach_id" "uuid", "p_alert_date" "date", "p_send_at" timestamp with time zone, "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_best_hour" timestamp with time zone, "p_conditions_snapshot" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_beach_affinity_on_session_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_beach_affinity_on_session_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_beach_coordinates"("p_beach_id" "uuid", "p_longitude" double precision, "p_latitude" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_beach_coordinates"("p_beach_id" "uuid", "p_longitude" double precision, "p_latitude" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_beach_daily_intel_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_beach_daily_intel_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_beach_daily_intel_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_beach_editorial_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_beach_editorial_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_city_editorial_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_city_editorial_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_city_editorial_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."custom_spots" TO "anon";
GRANT ALL ON TABLE "public"."custom_spots" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_spots" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_custom_spot_fingerprint"("p_spot_id" "uuid", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_custom_spot_fingerprint"("p_spot_id" "uuid", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_custom_spot_fingerprint"("p_spot_id" "uuid", "p_facing_direction_deg" numeric, "p_swell_window_min_deg" numeric, "p_swell_window_max_deg" numeric, "p_offshore_direction_deg" numeric, "p_exposure_level" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_follow_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_forecast_table_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_forecast_table_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_intel_confirmations_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_intel_confirmations_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_intel_confirmations_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_intel_report_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_intel_report_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_intel_vote_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_intel_vote_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ioos_station_coordinates"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ioos_station_coordinates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ioos_station_coordinates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ml_model_registry_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ml_model_registry_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ml_model_registry_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ndbc_direct_station_coordinates"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ndbc_direct_station_coordinates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ndbc_direct_station_coordinates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ndbc_direct_station_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ndbc_direct_station_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ndbc_direct_station_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_npc_template_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_npc_template_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_npc_template_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_comments_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_session_likes_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_session_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_email_prefs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_email_prefs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_email_prefs_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_user_storage_usage"("p_user_id" "uuid", "p_bytes_to_add" integer, "p_images_to_add" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_user_storage_usage"("p_user_id" "uuid", "p_bytes_to_add" integer, "p_images_to_add" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "service_role";















GRANT ALL ON TABLE "public"."beaches" TO "anon";
GRANT ALL ON TABLE "public"."beaches" TO "authenticated";
GRANT ALL ON TABLE "public"."beaches" TO "service_role";



GRANT SELECT ON TABLE "posthog_export"."beaches" TO "posthog_readonly";



GRANT ALL ON TABLE "public"."email_send_log" TO "anon";
GRANT ALL ON TABLE "public"."email_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "claude_migrator";



GRANT SELECT ON TABLE "posthog_export"."email_send_log" TO "posthog_readonly";



GRANT SELECT ON TABLE "posthog_export"."profiles" TO "posthog_readonly";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT SELECT ON TABLE "posthog_export"."sessions" TO "posthog_readonly";



GRANT ALL ON TABLE "public"."user_events" TO "anon";
GRANT ALL ON TABLE "public"."user_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_events" TO "service_role";



GRANT SELECT ON TABLE "posthog_export"."user_events" TO "posthog_readonly";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT SELECT ON TABLE "posthog_export"."user_follows" TO "posthog_readonly";



GRANT ALL ON TABLE "public"."account_deletions" TO "anon";
GRANT ALL ON TABLE "public"."account_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."account_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."activation_push_log" TO "anon";
GRANT ALL ON TABLE "public"."activation_push_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activation_push_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."alert_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."alert_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."alert_delivery_attempts" TO "anon";
GRANT ALL ON TABLE "public"."alert_delivery_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_delivery_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."alert_queue" TO "anon";
GRANT ALL ON TABLE "public"."alert_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_queue" TO "service_role";



GRANT ALL ON TABLE "public"."alert_rules" TO "anon";
GRANT ALL ON TABLE "public"."alert_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_rules" TO "service_role";



GRANT ALL ON TABLE "public"."auth_apple_orphan_users" TO "service_role";



GRANT ALL ON TABLE "public"."badge_definitions" TO "anon";
GRANT ALL ON TABLE "public"."badge_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."badge_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."beach_amenity_sources" TO "anon";
GRANT ALL ON TABLE "public"."beach_amenity_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_amenity_sources" TO "service_role";



GRANT ALL ON TABLE "public"."beach_daily_intel" TO "anon";
GRANT ALL ON TABLE "public"."beach_daily_intel" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_daily_intel" TO "service_role";



GRANT ALL ON TABLE "public"."beach_dioramas" TO "service_role";
GRANT SELECT ON TABLE "public"."beach_dioramas" TO "anon";
GRANT SELECT ON TABLE "public"."beach_dioramas" TO "authenticated";



GRANT ALL ON TABLE "public"."beach_editorial_content" TO "anon";
GRANT ALL ON TABLE "public"."beach_editorial_content" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_editorial_content" TO "service_role";



GRANT ALL ON TABLE "public"."beach_forecast_accuracy" TO "anon";
GRANT ALL ON TABLE "public"."beach_forecast_accuracy" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_forecast_accuracy" TO "service_role";



GRANT ALL ON TABLE "public"."beach_height_offsets" TO "anon";
GRANT ALL ON TABLE "public"."beach_height_offsets" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_height_offsets" TO "service_role";



GRANT ALL ON TABLE "public"."beach_location_audit" TO "anon";
GRANT ALL ON TABLE "public"."beach_location_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_location_audit" TO "service_role";



GRANT ALL ON TABLE "public"."beach_location_audit_summary" TO "anon";
GRANT ALL ON TABLE "public"."beach_location_audit_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_location_audit_summary" TO "service_role";



GRANT ALL ON TABLE "public"."ml_predictions_log" TO "anon";
GRANT ALL ON TABLE "public"."ml_predictions_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ml_predictions_log" TO "service_role";



GRANT ALL ON TABLE "public"."beach_ml_performance_baseline" TO "service_role";



GRANT ALL ON TABLE "public"."beach_photos" TO "anon";
GRANT ALL ON TABLE "public"."beach_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_photos" TO "service_role";



GRANT ALL ON TABLE "public"."beach_photos_featured" TO "anon";
GRANT ALL ON TABLE "public"."beach_photos_featured" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_photos_featured" TO "service_role";



GRANT ALL ON TABLE "public"."beach_photos_history" TO "anon";
GRANT ALL ON TABLE "public"."beach_photos_history" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_photos_history" TO "service_role";



GRANT ALL ON TABLE "public"."beach_recommendation_calibration" TO "anon";
GRANT ALL ON TABLE "public"."beach_recommendation_calibration" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_recommendation_calibration" TO "service_role";



GRANT ALL ON TABLE "public"."beach_review_likes" TO "anon";
GRANT ALL ON TABLE "public"."beach_review_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_review_likes" TO "service_role";



GRANT ALL ON TABLE "public"."beach_reviews" TO "anon";
GRANT ALL ON TABLE "public"."beach_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."beach_reviews_history" TO "anon";
GRANT ALL ON TABLE "public"."beach_reviews_history" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_reviews_history" TO "service_role";



GRANT ALL ON TABLE "public"."beach_sources" TO "anon";
GRANT ALL ON TABLE "public"."beach_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_sources" TO "service_role";



GRANT ALL ON TABLE "public"."beach_water_quality" TO "anon";
GRANT ALL ON TABLE "public"."beach_water_quality" TO "authenticated";
GRANT ALL ON TABLE "public"."beach_water_quality" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_user_ids" TO "anon";
GRANT ALL ON TABLE "public"."blocked_user_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_user_ids" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."buoys" TO "anon";
GRANT ALL ON TABLE "public"."buoys" TO "authenticated";
GRANT ALL ON TABLE "public"."buoys" TO "service_role";



GRANT ALL ON TABLE "public"."ccc_access_locations" TO "anon";
GRANT ALL ON TABLE "public"."ccc_access_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."ccc_access_locations" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."content_reports" TO "anon";
GRANT ALL ON TABLE "public"."content_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."content_reports" TO "service_role";



GRANT ALL ON TABLE "public"."corrected_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."corrected_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."corrected_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."cron_runs" TO "anon";
GRANT ALL ON TABLE "public"."cron_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."cron_runs" TO "service_role";



GRANT ALL ON TABLE "public"."data_cleanup_audit" TO "service_role";



GRANT ALL ON TABLE "public"."dev_notes_queue" TO "anon";
GRANT ALL ON TABLE "public"."dev_notes_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_notes_queue" TO "service_role";



GRANT ALL ON TABLE "public"."dev_session_mutation_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dev_session_mutation_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dev_session_mutation_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dev_session_mutation_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."digest_run_stats" TO "anon";
GRANT ALL ON TABLE "public"."digest_run_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."digest_run_stats" TO "service_role";



GRANT ALL ON TABLE "public"."email_click_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_click_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_click_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_click_events_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_send_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_send_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_send_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."email_suppression_list" TO "anon";
GRANT ALL ON TABLE "public"."email_suppression_list" TO "authenticated";
GRANT ALL ON TABLE "public"."email_suppression_list" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_suppression_list_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_suppression_list_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_suppression_list_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."embed_impressions" TO "anon";
GRANT ALL ON TABLE "public"."embed_impressions" TO "authenticated";
GRANT ALL ON TABLE "public"."embed_impressions" TO "service_role";



GRANT ALL ON TABLE "public"."enhanced_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."enhanced_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."enhanced_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."fallback_events" TO "anon";
GRANT ALL ON TABLE "public"."fallback_events" TO "authenticated";
GRANT ALL ON TABLE "public"."fallback_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fallback_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fallback_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fallback_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."favorite_beaches" TO "anon";
GRANT ALL ON TABLE "public"."favorite_beaches" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_beaches" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_accuracy_votes" TO "anon";
GRANT ALL ON TABLE "public"."forecast_accuracy_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_accuracy_votes" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_alert_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."forecast_alert_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_alert_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_feedback_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."intel_post_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."intel_post_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_post_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."intel_posts" TO "anon";
GRANT ALL ON TABLE "public"."intel_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_posts" TO "service_role";



GRANT ALL ON TABLE "public"."intel_reports" TO "anon";
GRANT ALL ON TABLE "public"."intel_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_reports" TO "service_role";



GRANT ALL ON TABLE "public"."intel_votes" TO "anon";
GRANT ALL ON TABLE "public"."intel_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_votes" TO "service_role";



GRANT ALL ON TABLE "public"."ioos_observations" TO "anon";
GRANT ALL ON TABLE "public"."ioos_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."ioos_observations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ioos_observations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ioos_observations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ioos_observations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."marine_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."marine_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."marine_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."ml_calibration_versions" TO "anon";
GRANT ALL ON TABLE "public"."ml_calibration_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."ml_calibration_versions" TO "service_role";



GRANT ALL ON TABLE "public"."ml_model_registry" TO "anon";
GRANT ALL ON TABLE "public"."ml_model_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."ml_model_registry" TO "service_role";



GRANT ALL ON TABLE "public"."mv_beach_amenities" TO "service_role";



GRANT ALL ON TABLE "public"."ndbc_direct_observations" TO "anon";
GRANT ALL ON TABLE "public"."ndbc_direct_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."ndbc_direct_observations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ndbc_direct_observations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ndbc_direct_observations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ndbc_direct_observations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ndbc_direct_stations" TO "anon";
GRANT ALL ON TABLE "public"."ndbc_direct_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."ndbc_direct_stations" TO "service_role";



GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "anon";
GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."notification_send_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."npc_content_templates" TO "anon";
GRANT ALL ON TABLE "public"."npc_content_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."npc_content_templates" TO "service_role";



GRANT ALL ON TABLE "public"."observable_beaches" TO "service_role";



GRANT ALL ON TABLE "public"."pending_alert_captures" TO "anon";
GRANT ALL ON TABLE "public"."pending_alert_captures" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_alert_captures" TO "service_role";



GRANT ALL ON TABLE "public"."personalization_milestones" TO "anon";
GRANT ALL ON TABLE "public"."personalization_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."personalization_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."posting_config" TO "anon";
GRANT ALL ON TABLE "public"."posting_config" TO "authenticated";
GRANT ALL ON TABLE "public"."posting_config" TO "service_role";



GRANT ALL ON TABLE "public"."posting_log" TO "anon";
GRANT ALL ON TABLE "public"."posting_log" TO "authenticated";
GRANT ALL ON TABLE "public"."posting_log" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_with_home_beach" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_with_home_beach" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_item_submissions" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_item_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_item_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_items" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_items" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_items" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_votes" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_votes" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_items_with_vote_count" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_items_with_vote_count" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_items_with_vote_count" TO "service_role";



GRANT ALL ON TABLE "public"."saved_windows" TO "anon";
GRANT ALL ON TABLE "public"."saved_windows" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_windows" TO "service_role";



GRANT ALL ON SEQUENCE "public"."saved_windows_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."saved_windows_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."saved_windows_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."session_forecast_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."session_forecast_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."session_forecast_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."session_invitations" TO "anon";
GRANT ALL ON TABLE "public"."session_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."session_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."session_likes" TO "anon";
GRANT ALL ON TABLE "public"."session_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."session_likes" TO "service_role";



GRANT ALL ON TABLE "public"."session_logs" TO "anon";
GRANT ALL ON TABLE "public"."session_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."session_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."session_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."session_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."session_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."session_media" TO "anon";
GRANT ALL ON TABLE "public"."session_media" TO "authenticated";
GRANT ALL ON TABLE "public"."session_media" TO "service_role";



GRANT ALL ON TABLE "public"."session_media_history" TO "anon";
GRANT ALL ON TABLE "public"."session_media_history" TO "authenticated";
GRANT ALL ON TABLE "public"."session_media_history" TO "service_role";



GRANT ALL ON TABLE "public"."session_share_links" TO "authenticated";
GRANT ALL ON TABLE "public"."session_share_links" TO "service_role";



GRANT ALL ON TABLE "public"."session_shares" TO "anon";
GRANT ALL ON TABLE "public"."session_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."session_shares" TO "service_role";



GRANT ALL ON TABLE "public"."session_wave_observation_candidates" TO "anon";
GRANT ALL ON TABLE "public"."session_wave_observation_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."session_wave_observation_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."spot_feedback" TO "anon";
GRANT ALL ON TABLE "public"."spot_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."spot_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."storage_bucket_docs" TO "anon";
GRANT ALL ON TABLE "public"."storage_bucket_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_bucket_docs" TO "service_role";



GRANT ALL ON TABLE "public"."storage_usage" TO "anon";
GRANT ALL ON TABLE "public"."storage_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_usage" TO "service_role";



GRANT ALL ON TABLE "public"."sun_times" TO "anon";
GRANT ALL ON TABLE "public"."sun_times" TO "authenticated";
GRANT ALL ON TABLE "public"."sun_times" TO "service_role";



GRANT ALL ON TABLE "public"."surfline_shadow_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."surfline_shadow_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."surfline_shadow_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."ten_day_enhanced_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."ten_day_enhanced_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."ten_day_enhanced_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."tide_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."tide_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."tide_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."trial_ending_push_log" TO "anon";
GRANT ALL ON TABLE "public"."trial_ending_push_log" TO "authenticated";
GRANT ALL ON TABLE "public"."trial_ending_push_log" TO "service_role";



GRANT ALL ON TABLE "public"."unified_wave_observations" TO "anon";
GRANT ALL ON TABLE "public"."unified_wave_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_wave_observations" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_beach_affinity" TO "anon";
GRANT ALL ON TABLE "public"."user_beach_affinity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_beach_affinity" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."user_email_prefs" TO "anon";
GRANT ALL ON TABLE "public"."user_email_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_email_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."user_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."user_entitlements_failed_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements_failed_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements_failed_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."user_implicit_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_implicit_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_implicit_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_surf_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_surf_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_surf_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_xp" TO "anon";
GRANT ALL ON TABLE "public"."user_xp" TO "authenticated";
GRANT ALL ON TABLE "public"."user_xp" TO "service_role";



GRANT ALL ON TABLE "public"."v_enhanced_forecast_latest" TO "anon";
GRANT ALL ON TABLE "public"."v_enhanced_forecast_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."v_enhanced_forecast_latest" TO "service_role";



GRANT ALL ON TABLE "public"."v_marine_forecast_latest" TO "anon";
GRANT ALL ON TABLE "public"."v_marine_forecast_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."v_marine_forecast_latest" TO "service_role";



GRANT ALL ON TABLE "public"."v_sun_times_latest" TO "anon";
GRANT ALL ON TABLE "public"."v_sun_times_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sun_times_latest" TO "service_role";



GRANT ALL ON TABLE "public"."v_tide_forecast_latest" TO "anon";
GRANT ALL ON TABLE "public"."v_tide_forecast_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tide_forecast_latest" TO "service_role";



GRANT ALL ON TABLE "public"."wq_monitoring_stations" TO "anon";
GRANT ALL ON TABLE "public"."wq_monitoring_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."wq_monitoring_stations" TO "service_role";



GRANT ALL ON TABLE "public"."wq_samples" TO "anon";
GRANT ALL ON TABLE "public"."wq_samples" TO "authenticated";
GRANT ALL ON TABLE "public"."wq_samples" TO "service_role";



GRANT ALL ON TABLE "public"."xp_events" TO "anon";
GRANT ALL ON TABLE "public"."xp_events" TO "authenticated";
GRANT ALL ON TABLE "public"."xp_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "posthog_export" GRANT SELECT ON TABLES  TO "posthog_readonly";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























