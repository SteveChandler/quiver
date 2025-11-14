/*
 * Migration: Add automatic profile creation for new users
 * Created: 2025-11-14
 *
 * PURPOSE:
 * Creates a trigger that automatically creates a profile record when a new user
 * signs up in auth.users. This ensures:
 * - Every auth.users record has a corresponding profiles record
 * - Email field is properly populated (fixes E2E test failures)
 * - No race conditions in manual profile creation
 * - OAuth signups get profile data from metadata
 *
 * CONTEXT:
 * Currently, users created in auth.users don't automatically get profiles.
 * The application has a fallback pattern but it doesn't populate the email field,
 * causing E2E tests to fail when querying profiles by email.
 *
 * CHANGES:
 * 1. Creates handle_new_user() trigger function with SECURITY DEFINER
 * 2. Adds trigger on auth.users AFTER INSERT
 * 3. Grants necessary permissions to service_role
 *
 * ROLLBACK PROCEDURE:
 * To rollback this migration:
 *
 * -- Drop the trigger
 * DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
 *
 * -- Drop the function
 * DROP FUNCTION IF EXISTS public.handle_new_user();
 *
 * TESTING:
 * After applying this migration, test:
 * 1. New email/password signup → profile created with email
 * 2. OAuth signup (Google) → profile created with avatar_url from metadata
 * 3. Existing user signup → ON CONFLICT handles gracefully
 * 4. Missing metadata → defaults apply correctly
 * 5. E2E tests can query profiles by email successfully
 */

-- ============================================================================
-- FUNCTION: handle_new_user()
-- ============================================================================
-- Creates a profile record automatically when a new user signs up.
-- Uses SECURITY DEFINER to bypass RLS INSERT policy that requires auth.uid() = id.
-- This is safe because the trigger only runs in the auth schema context.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with data from auth.users and raw_user_meta_data
  -- Uses ON CONFLICT to handle edge case of duplicate attempts
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
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
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Always return NEW to allow the auth.users insert to proceed
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log warning but don't fail the auth.users creation
    -- This ensures user signup succeeds even if profile creation fails
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- COMMENT: Document the function
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS
'Automatically creates a profile record when a new user signs up.
Runs with SECURITY DEFINER to bypass RLS INSERT policy.
Extracts user data from auth.users and raw_user_meta_data.
Safe to run - includes error handling and ON CONFLICT protection.';

-- ============================================================================
-- TRIGGER: on_auth_user_created
-- ============================================================================
-- Fires after a new user is inserted into auth.users
-- Calls handle_new_user() to create the corresponding profile
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PERMISSIONS: Grant execute to service_role
-- ============================================================================
-- The function runs as SECURITY DEFINER, so it executes with the permissions
-- of the function owner (postgres). We grant execute to service_role for
-- administrative operations if needed.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ============================================================================
-- VALIDATION: Verify the migration
-- ============================================================================
-- After migration, you can verify with:
--
-- 1. Check function exists:
-- SELECT routine_name, security_type, routine_definition
-- FROM information_schema.routines
-- WHERE routine_name = 'handle_new_user';
--
-- 2. Check trigger exists:
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
--
-- 3. Test profile creation:
-- -- Create a test user (in development only!)
-- -- Profile should be created automatically
-- ============================================================================
