-- Setup Local E2E Test User
-- This script creates a test user in the local Supabase instance for E2E testing
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < scripts/setup-local-e2e-user.sql
--
-- Or via Supabase Studio SQL Editor:
--   1. Open http://127.0.0.1:54323
--   2. Go to SQL Editor
--   3. Paste and run this script

-- =============================================================================
-- STEP 1: Clean up existing test user (if exists)
-- =============================================================================

DO $$
BEGIN
  -- Delete existing test user (cascade will remove profile)
  DELETE FROM auth.users WHERE email = 'local-test@quiversurf.test';
  RAISE NOTICE 'Cleaned up existing test user (if any)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cleanup skipped: %', SQLERRM;
END $$;

-- =============================================================================
-- STEP 2: Create new test user
-- =============================================================================

DO $$
DECLARE
  test_user_id uuid;
  test_email text := 'local-test@quiversurf.test';
  test_password text := 'TestPassword123!';
  profile_count int;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Creating Local E2E Test User';
  RAISE NOTICE '============================================';

  -- Create auth user
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change_token_current,
    email_change_token_new
  ) VALUES (
    gen_random_uuid(),
    test_email,
    crypt(test_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'full_name', 'Local Test User',
      'avatar_url', null
    ),
    NOW(),
    NOW(),
    '',
    '',
    ''
  ) RETURNING id INTO test_user_id;

  RAISE NOTICE 'User created: % (ID: %)', test_email, test_user_id;

  -- Wait for trigger to create profile
  PERFORM pg_sleep(0.1);

  -- Verify profile was created by trigger
  SELECT COUNT(*) INTO profile_count
  FROM profiles
  WHERE id = test_user_id;

  IF profile_count = 1 THEN
    RAISE NOTICE 'Profile auto-created by trigger: SUCCESS';

    -- Display profile details
    DECLARE
      prof_email text;
      prof_name text;
    BEGIN
      SELECT email, full_name INTO prof_email, prof_name
      FROM profiles
      WHERE id = test_user_id;

      RAISE NOTICE 'Profile email: %', prof_email;
      RAISE NOTICE 'Profile name: %', prof_name;
    END;
  ELSE
    RAISE NOTICE 'WARNING: Profile not created by trigger!';
  END IF;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Test User Setup Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Email: %', test_email;
  RAISE NOTICE 'Password: %', test_password;
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Update your .env.playwright.local with:';
  RAISE NOTICE 'TEST_USER_EMAIL=%', test_email;
  RAISE NOTICE 'TEST_USER_PASSWORD=%', test_password;
  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- STEP 3: Verify setup
-- =============================================================================

SELECT
  'VERIFICATION' as status,
  au.id,
  au.email as auth_email,
  p.email as profile_email,
  p.full_name,
  CASE
    WHEN p.id IS NOT NULL AND p.email IS NOT NULL THEN 'READY FOR E2E TESTING'
    WHEN p.id IS NOT NULL AND p.email IS NULL THEN 'PROFILE MISSING EMAIL - TRIGGER MAY NOT BE DEPLOYED'
    ELSE 'PROFILE NOT FOUND - TRIGGER NOT WORKING'
  END as test_status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'local-test@quiversurf.test';
