-- ================================================
-- Mock Data: Solid Snake
-- ================================================
-- This script seeds mock data for the user “Solid Snake” to
-- exercise activity feeds and the new inbox notifications.
-- It is safe to re-run (idempotent checks included).
-- ================================================

DO $$
DECLARE
  -- Resolve Solid Snake by auth email; if auth user doesn't exist, fall back to email-only invites
  solid_snake_id UUID;
  solid_snake_email TEXT := 'saladfingers@duck.com';
  solid_snake_name TEXT := 'Solid Snake';

  -- Optional existing users to connect with if present
  big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;    -- From existing script
  liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID; -- From existing script

  beaches TEXT[] := ARRAY[
    'Blacks Beach',
    'Pacific Beach',
    'Swami''s Beach',
    'Windansea Beach',
    'Sunset Cliffs'
  ];

  bname TEXT;
  bid UUID;
  board_id UUID;
  i INTEGER;
  days_offset INTEGER;
  planned_dt TIMESTAMP WITH TIME ZONE;
  inviter_session_id UUID;
BEGIN
  -- ================================================
  -- Resolve/lookup auth user by email
  -- ================================================
  SELECT id INTO solid_snake_id FROM auth.users WHERE email = solid_snake_email LIMIT 1;

  -- ================================================
  -- Ensure profile exists
  -- ================================================
  IF solid_snake_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = solid_snake_id) THEN
      INSERT INTO profiles (
        id,
        full_name,
        email,
        avatar_url,
        bio,
        location,
        experience_level
      ) VALUES (
        solid_snake_id,
        solid_snake_name,
        solid_snake_email,
        '/placeholder.svg?height=200&width=200',
        'Legendary infiltrator. Prefers dawn patrols and tactical positioning.',
        'Shadow Moses',
        'advanced'
      );
    END IF;
  ELSE
    RAISE NOTICE 'Auth user % not found. Will seed email-only invitations. Sign up this user to enable full mock (sessions/boards/follows).', solid_snake_email;
  END IF;

  -- ================================================
  -- Ensure at least one board for Solid Snake
  -- ================================================
  IF solid_snake_id IS NOT NULL THEN
    SELECT id INTO board_id FROM boards WHERE user_id = solid_snake_id ORDER BY created_at ASC LIMIT 1;
    IF board_id IS NULL THEN
      INSERT INTO boards (user_id, name, brand, model, length_feet, volume_liters)
      VALUES (solid_snake_id, 'Stealth Blade', 'FOXHOUND', 'Shadow', 6.2, 31.5)
      RETURNING id INTO board_id;
    END IF;
  END IF;

  -- ================================================
  -- Planned sessions: 3 over next 3 days
  -- ================================================
  IF solid_snake_id IS NOT NULL THEN
    FOR i IN 1..3 LOOP
      bname := beaches[((i-1) % array_length(beaches,1)) + 1];
      SELECT id INTO bid FROM beaches WHERE name = bname;
      planned_dt := (CURRENT_DATE + (i || ' day')::interval) + make_interval(hours => 6 + (i*2)); -- 8am, 10am, 12pm-ish

      IF NOT EXISTS (
        SELECT 1 FROM sessions 
        WHERE user_id = solid_snake_id AND status = 'planned' AND beach_name = bname AND arrival_time::date = planned_dt::date
      ) THEN
        INSERT INTO sessions (
          user_id, beach_id, board_id, beach_name, status, arrival_time,
          duration_minutes, wave_quality, water_temp, crowd_level, parking_ease, notes
        ) VALUES (
          solid_snake_id, bid, board_id, bname, 'planned', planned_dt,
          120 + (i*10), NULL, NULL, NULL, NULL,
          'PLANNED: Covert approach at ' || bname || '. Optimize stealth entry and precision takeoffs.'
        );
      END IF;
    END LOOP;
  END IF;

  -- ================================================
  -- Completed sessions: 5 in the past 5 days
  -- ================================================
  IF solid_snake_id IS NOT NULL THEN
    FOR i IN 1..5 LOOP
      bname := beaches[((i-1) % array_length(beaches,1)) + 1];
      SELECT id INTO bid FROM beaches WHERE name = bname;
      days_offset := -i; -- -1..-5
      planned_dt := (CURRENT_DATE + (days_offset || ' day')::interval) + make_interval(hours => 6 + (i % 3));

      IF NOT EXISTS (
        SELECT 1 FROM sessions 
        WHERE user_id = solid_snake_id AND status = 'completed' AND beach_name = bname AND arrival_time::date = planned_dt::date
      ) THEN
        INSERT INTO sessions (
          user_id, beach_id, board_id, beach_name, status, arrival_time,
          duration_minutes, wave_quality, water_temp, crowd_level, parking_ease, notes
        ) VALUES (
          solid_snake_id, bid, board_id, bname, 'completed', planned_dt,
          90 + (i*12), 3 + ((i-1) % 3), 66, 2 + ((i-1) % 4), 3 + ((i-1) % 3),
          'Infiltration successful at ' || bname || '. Minimal detection. Maximum efficiency.'
        );
      END IF;
    END LOOP;
  END IF;

  -- ================================================
  -- Social graph: follow Big Boss / Liquid Snake if present
  -- ================================================
  IF solid_snake_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = big_boss_id) THEN
    INSERT INTO user_follows (follower_id, following_id)
    SELECT solid_snake_id, big_boss_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_follows WHERE follower_id = solid_snake_id AND following_id = big_boss_id
    );
  END IF;

  IF solid_snake_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = liquid_snake_id) THEN
    INSERT INTO user_follows (follower_id, following_id)
    SELECT solid_snake_id, liquid_snake_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_follows WHERE follower_id = solid_snake_id AND following_id = liquid_snake_id
    );
  END IF;

  -- ================================================
  -- Inbox testing: 2 pending invites for Solid Snake from Big Boss (if possible)
  -- ================================================
  IF EXISTS (SELECT 1 FROM profiles WHERE id = big_boss_id) THEN
    -- Use two of Big Boss's planned sessions if available
    FOR inviter_session_id IN
      SELECT id FROM sessions WHERE user_id = big_boss_id AND status = 'planned' ORDER BY arrival_time ASC LIMIT 2
    LOOP
      -- Insert invite if it doesn't already exist (by session + invitee)
      IF solid_snake_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM session_invitations 
          WHERE session_id = inviter_session_id 
            AND (invitee_id = solid_snake_id OR invitee_email = solid_snake_email)
        ) THEN
          INSERT INTO session_invitations (
            session_id, inviter_id, invitee_id, invitee_email, status, message, created_at
          ) VALUES (
            inviter_session_id, big_boss_id, solid_snake_id, NULL, 'pending',
            'Operational invite: sunrise coordination recommended.',
            NOW()
          );
        END IF;
      ELSE
        -- Email-only invite so inbox can still show for this email if user signs up later
        IF NOT EXISTS (
          SELECT 1 FROM session_invitations 
          WHERE session_id = inviter_session_id 
            AND invitee_email = solid_snake_email
        ) THEN
          INSERT INTO session_invitations (
            session_id, inviter_id, invitee_id, invitee_email, status, message, created_at
          ) VALUES (
            inviter_session_id, big_boss_id, NULL, solid_snake_email, 'pending',
            'Operational invite: sunrise coordination recommended.',
            NOW()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  RAISE NOTICE 'Solid Snake mock data seeded (profile if auth user exists, board/sessions/follows accordingly, and invitations).';
END $$;

-- ================================================
-- Verification Queries
-- ================================================

-- Profile (by email)
SELECT 'PROFILE' AS section;
SELECT id, full_name, email FROM profiles WHERE email = 'saladfingers@duck.com';

-- Sessions summary
SELECT 'SESSIONS SUMMARY' AS section;
SELECT 
  COUNT(*) AS total,
  COUNT(CASE WHEN status = 'planned' THEN 1 END) AS planned,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
FROM sessions WHERE user_id = (SELECT id FROM profiles WHERE email = 'saladfingers@duck.com' LIMIT 1);

-- Recent/pending invitations for Solid Snake
SELECT 'INVITATIONS (RECEIVED)' AS section;
SELECT status, session_id, inviter_id, invitee_id, invitee_email, created_at
FROM session_invitations
WHERE invitee_id = (SELECT id FROM profiles WHERE email = 'saladfingers@duck.com' LIMIT 1)
   OR invitee_email = 'saladfingers@duck.com'
ORDER BY created_at DESC;


