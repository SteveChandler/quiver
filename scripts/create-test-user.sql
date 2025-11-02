-- ================================================
-- Create E2E Test User
-- ================================================
-- This script creates a test user for Playwright E2E tests
-- Credentials match .env.playwright:
--   Email: testuser@quiver.surf
--   Password: testpassword123
-- ================================================

DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
BEGIN
    -- ================================================
    -- Create auth user
    -- ================================================
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        test_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'testuser@quiver.surf',
        crypt('testpassword123', gen_salt('bf')), -- Encrypted password
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Test User", "email": "testuser@quiver.surf"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (id) DO NOTHING;

    -- ================================================
    -- Create Profile
    -- ================================================
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        created_at,
        updated_at
    ) VALUES (
        test_user_id,
        'Test User',
        'testuser@quiver.surf',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Test user created successfully with ID: %', test_user_id;
    RAISE NOTICE 'Email: testuser@quiver.surf';
    RAISE NOTICE 'Password: testpassword123';
END $$;
