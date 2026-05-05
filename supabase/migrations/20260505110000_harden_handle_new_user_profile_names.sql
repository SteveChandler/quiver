-- Harden handle_new_user() profile-name hydration for OAuth providers.
--
-- Native Apple only returns fullName once, and Google commonly sends `name`
-- instead of `full_name`. Email signup sends `display_name`. Normalize all
-- three metadata keys for future users and self-heal blank profile rows on
-- conflict without overwriting user-set names.

BEGIN;

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
  v_profile_name TEXT;
  v_display_name TEXT;
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
  v_profile_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), '')
  );
  v_display_name := v_profile_name;

  -- display_name is still unique in this schema. Do not let a common OAuth
  -- legal name collision make the profile insert fail.
  IF v_display_name IS NOT NULL AND EXISTS (
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

COMMENT ON FUNCTION public.handle_new_user() IS
'Automatically creates or self-heals a profile record when a new auth user signs up.
Runs with SECURITY DEFINER to bypass RLS INSERT policy.
Extracts user data from auth.users and raw_user_meta_data including:
- profile name from display_name, full_name, or name metadata
- location (city, region)
- timezone
- signup_context (UTM, device, method, referrer, etc.)
- signup_location (IP-based geolocation)';

COMMIT;
