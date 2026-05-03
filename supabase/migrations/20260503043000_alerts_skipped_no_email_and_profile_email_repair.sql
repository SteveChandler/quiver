-- Three coordinated changes to make condition-alert-deliver safe for the
-- ALERTS_DELIVERY_ENABLED=true rollout. Each is independent and reversible.
--
-- Background: a 2026-04-27 live test (the only day delivery was on prior to
-- this migration) showed 6 successful email sends and 1 failed_provider error
-- with the literal Resend message "The `to` field must be a `string`.". An
-- audit on 2026-05-02 traced this to profiles.email being NULL for two of the
-- 12 users with enabled alert rules — auth.users.email was populated for the
-- same users, but the deliver worker reads from profiles.email (per the
-- "profiles.id is a 1:1 mirror of auth.users.id" comment at
-- app/api/cron/condition-alert-deliver/route.ts:141).
--
-- Companion code change adds a `skipped_no_email` guard before the provider
-- call. This migration:
--   1. Relaxes the alert_delivery_attempts.status CHECK to accept the new
--      enum value, so the guard's recordAttempt() insert doesn't 23514.
--   2. Backfills profiles.email from auth.users.email for every profile row
--      where the local copy diverges (NULL with auth.users non-null).
--   3. Patches handle_new_user() so the ON CONFLICT path self-heals null
--      emails on subsequent metadata-bearing signup events. Without this,
--      backfilled rows could re-null if a future trigger run misorders.

BEGIN;

-- 1. Add 'skipped_no_email' to the alert_delivery_attempts status CHECK.
--    Drop-and-recreate is the only path on Postgres for an inline CHECK.
ALTER TABLE public.alert_delivery_attempts
  DROP CONSTRAINT IF EXISTS alert_delivery_attempts_status_check;

ALTER TABLE public.alert_delivery_attempts
  ADD CONSTRAINT alert_delivery_attempts_status_check
  CHECK (status IN (
    'sent',
    'skipped_disabled',
    'skipped_allowlist',
    'skipped_cooldown',
    'skipped_user_cap',
    'skipped_no_device',
    'skipped_no_email',
    'skipped_channel_disabled',
    'skipped_dedup_collision',
    'failed_provider',
    'failed_internal'
  ));

-- 2. Backfill profiles.email from auth.users.email where missing.
--    Match the runtime guard exactly: the deliver worker treats a NULL or
--    whitespace-only email as missing (route.ts: "!profile.email ||
--    profile.email.trim() === ''"), so the data repair must too. Use
--    NULLIF(btrim(...), '') to coerce '' / '   ' to NULL for comparison.
--    Scoped to rows where the local copy is missing-by-that-definition and
--    auth.users has a real value, so it is idempotent and never overwrites
--    a user-set email.
UPDATE public.profiles p
SET email = u.email,
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND NULLIF(btrim(p.email), '') IS NULL
  AND NULLIF(btrim(u.email), '') IS NOT NULL;

-- 3. Self-heal trigger. The current ON CONFLICT clause in handle_new_user()
--    coalesces location/home_region/timezone/signup_context/signup_location
--    but does NOT touch email — so a profile row inserted with NULL email
--    stays null forever. Add COALESCE on email so a later trigger fire (or
--    a manual upsert from auth.users) repairs the field.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_location_data JSONB;
  v_signup_context JSONB;
  v_location TEXT;
  v_home_region TEXT;
  v_timezone TEXT;
BEGIN
  v_location_data := NEW.raw_user_meta_data->'location_data';
  v_signup_context := NEW.raw_user_meta_data->'signup_context';

  IF v_location_data IS NOT NULL AND
     v_location_data->>'city' IS NOT NULL AND
     v_location_data->>'region' IS NOT NULL THEN
    v_location := v_location_data->>'city' || ', ' || v_location_data->>'region';
  END IF;

  v_home_region := v_location_data->>'region';
  v_timezone := v_signup_context->>'tz';

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
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
    -- Self-heal: if the existing profile row has a missing email (NULL or
    -- whitespace-only — matches the deliver worker's runtime guard) and
    -- auth has one, adopt it. Never overwrite a non-blank user-set email.
    email = COALESCE(NULLIF(btrim(profiles.email), ''), EXCLUDED.email),
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

COMMIT;

-- Post-deploy verification (manual, run after rollout):
--   -- 0 expected: every profile with auth.users.email also has a usable
--   -- profiles.email (matches the deliver worker's runtime guard).
--   SELECT COUNT(*) FROM profiles p JOIN auth.users u ON u.id = p.id
--    WHERE NULLIF(btrim(p.email), '') IS NULL
--      AND NULLIF(btrim(u.email), '') IS NOT NULL;
--
--   -- 0 expected within the first 24h after the new code deploys, unless
--   -- a non-trigger writer creates a profile without email (audit if so).
--   SELECT COUNT(*) FROM alert_delivery_attempts
--    WHERE status = 'skipped_no_email'
--      AND attempted_at > now() - interval '24 hours';
