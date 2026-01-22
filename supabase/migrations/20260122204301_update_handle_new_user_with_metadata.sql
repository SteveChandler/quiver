-- Migration: Update handle_new_user to populate signup metadata in profiles
-- Extracts timezone, location, and context from raw_user_meta_data

/*
 * This migration updates the handle_new_user() trigger function to extract
 * useful metadata from raw_user_meta_data and populate profile fields:
 *
 * - location: Human-readable "City, Region" string
 * - home_region: Region code (e.g., "CA")
 * - timezone: IANA timezone string (e.g., "America/Los_Angeles")
 * - signup_context: Full signup context JSONB (UTM, device, method, etc.)
 * - signup_location: Full IP location JSONB (city, region, country, lat/lng)
 */

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
  -- Extract nested metadata objects
  v_location_data := NEW.raw_user_meta_data->'location_data';
  v_signup_context := NEW.raw_user_meta_data->'signup_context';
  
  -- Build human-readable location string: "City, Region"
  IF v_location_data IS NOT NULL AND 
     v_location_data->>'city' IS NOT NULL AND
     v_location_data->>'region' IS NOT NULL THEN
    v_location := v_location_data->>'city' || ', ' || v_location_data->>'region';
  END IF;
  
  -- Extract region code for home_region
  v_home_region := v_location_data->>'region';
  
  -- Extract timezone from signup context
  v_timezone := v_signup_context->>'tz';

  -- Insert profile with data from auth.users and raw_user_meta_data
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
    -- Extract full_name from metadata, default to empty string if not present
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    -- Extract avatar_url from metadata (common in OAuth signups)
    NEW.raw_user_meta_data->>'avatar_url',
    -- Human-readable location
    v_location,
    -- Region code
    v_home_region,
    -- Timezone
    v_timezone,
    -- Full signup context JSONB
    v_signup_context,
    -- Full location data JSONB
    v_location_data,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Preserve existing user-set values; only fill NULLs from new metadata
    location = COALESCE(profiles.location, EXCLUDED.location),
    home_region = COALESCE(profiles.home_region, EXCLUDED.home_region),
    timezone = COALESCE(profiles.timezone, EXCLUDED.timezone),
    signup_context = COALESCE(profiles.signup_context, EXCLUDED.signup_context),
    signup_location = COALESCE(profiles.signup_location, EXCLUDED.signup_location),
    updated_at = NOW();

  -- Always return NEW to allow the auth.users insert to proceed
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log warning but don't fail the auth.users creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.handle_new_user() IS
'Automatically creates a profile record when a new user signs up.
Runs with SECURITY DEFINER to bypass RLS INSERT policy.
Extracts user data from auth.users and raw_user_meta_data including:
- location (city, region)
- timezone
- signup_context (UTM, device, method, referrer, etc.)
- signup_location (IP-based geolocation)';
