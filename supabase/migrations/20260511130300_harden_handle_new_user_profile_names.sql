BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates or self-heals a profile when an auth user signs up. Normalizes display_name, full_name, and name metadata without overwriting user-set names.';

COMMIT;
