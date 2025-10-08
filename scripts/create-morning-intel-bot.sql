-- Create Morning Intel Bot User
-- This user will post automated daily morning surf intel for Ocean Beach, San Diego
-- Run this script using Supabase SQL Editor or via CLI

DO $$
DECLARE
    bot_user_id UUID;
    bot_email TEXT := 'morning.intel@quiversurf.app';
    bot_password TEXT := 'QuiverMorningIntel2025!'; -- Change this in production
    ocean_beach_id UUID;
BEGIN
    -- Find Ocean Beach, San Diego beach_id
    SELECT id INTO ocean_beach_id
    FROM public.beaches
    WHERE name ILIKE '%Ocean Beach%'
      AND (location ILIKE '%San Diego%' OR location ILIKE '%California%')
      AND latitude BETWEEN 32.74 AND 32.76
      AND longitude BETWEEN -117.26 AND -117.24
    LIMIT 1;

    IF ocean_beach_id IS NULL THEN
        RAISE EXCEPTION 'Ocean Beach, San Diego not found in beaches table. Please seed beaches first.';
    END IF;

    RAISE NOTICE 'Ocean Beach ID found: %', ocean_beach_id;

    -- Check if user already exists
    SELECT id INTO bot_user_id
    FROM auth.users
    WHERE email = bot_email;

    IF bot_user_id IS NOT NULL THEN
        RAISE NOTICE 'Morning Intel Bot user already exists with ID: %', bot_user_id;
        RAISE NOTICE 'Updating profile...';
        
        -- Update existing profile
        UPDATE public.profiles
        SET 
            full_name = 'Morning Intel Bot',
            bio = 'Automated daily morning surf reports for Ocean Beach, San Diego. Posted every morning at 6:00 AM PT with current conditions, tides, swell, and wind analysis.',
            is_mock = true,
            updated_at = now()
        WHERE id = bot_user_id;
        
        RETURN;
    END IF;

    -- Create the auth user
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        bot_email,
        crypt(bot_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Morning Intel Bot"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO bot_user_id;

    RAISE NOTICE 'Created Morning Intel Bot user with ID: %', bot_user_id;

    -- Create profile
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        bio,
        is_mock,
        created_at,
        updated_at
    ) VALUES (
        bot_user_id,
        bot_email,
        'Morning Intel Bot',
        'Automated daily morning surf reports for Ocean Beach, San Diego. Posted every morning at 6:00 AM PT with current conditions, tides, swell, and wind analysis.',
        true,
        now(),
        now()
    );

    RAISE NOTICE 'Created profile for Morning Intel Bot';
    RAISE NOTICE '';
    RAISE NOTICE '=== SETUP COMPLETE ===';
    RAISE NOTICE 'User Email: %', bot_email;
    RAISE NOTICE 'User ID: %', bot_user_id;
    RAISE NOTICE 'Ocean Beach ID: %', ocean_beach_id;
    RAISE NOTICE '';
    RAISE NOTICE 'Add these to your GitHub Secrets:';
    RAISE NOTICE 'MORNING_INTEL_USER_EMAIL=%', bot_email;
    RAISE NOTICE 'MORNING_INTEL_USER_PASSWORD=%', bot_password;
    RAISE NOTICE 'MORNING_INTEL_SPOT_ID=%', ocean_beach_id;

END $$;
