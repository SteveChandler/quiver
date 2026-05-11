-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Three coordinated changes to make condition-alert-deliver safe for the
-- ALERTS_DELIVERY_ENABLED=true rollout. Each is independent and reversible.
--
-- See supabase/migrations/20260503043000_alerts_skipped_no_email_and_profile_email_repair.sql
-- for full background and rationale.

-- 1. Add 'skipped_no_email' to the alert_delivery_attempts status CHECK.
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
UPDATE public.profiles p
SET email = u.email,
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND NULLIF(btrim(p.email), '') IS NULL
  AND NULLIF(btrim(u.email), '') IS NOT NULL;

-- 3. Self-heal trigger.
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
