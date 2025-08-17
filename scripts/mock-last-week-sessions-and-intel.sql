-- =============================================================
-- Last-Week Sessions (100) + Intel Posts Seed
-- Purpose: Populate realistic sessions and intel posts for the
--          past 7 days using existing personas and nearest
--          enhanced forecast rows to minimize repetition and
--          maximize realism.
--
-- Safe to run multiple times:
-- - Uses randomized timestamps and content; duplicate likelihood is low
-- - Uses IF NOT EXISTS for schema compatibility and guard checks
-- - Creates sessions as planned then updates to completed to fire
--   the forecast snapshot trigger defined in
--   supabase/migrations/028_forecast_calibration_tables.sql
-- =============================================================

-- Ensure intel_posts surf condition columns exist (compat)
ALTER TABLE intel_posts
  ADD COLUMN IF NOT EXISTS wave_height DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wind_speed DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wind_direction TEXT,
  ADD COLUMN IF NOT EXISTS water_temp INTEGER,
  ADD COLUMN IF NOT EXISTS crowd_level INTEGER,
  ADD COLUMN IF NOT EXISTS wave_types TEXT[],
  ADD COLUMN IF NOT EXISTS forecast_accuracy TEXT;

DO $$
DECLARE
  -- Personas (must exist in auth.users & profiles)
  liquid_snake_id UUID;
  big_boss_id     UUID;
  solid_snake_id  UUID;
  rookie_riley_id UUID;
  local_larry_id  UUID;
  travel_tina_id  UUID;
  photo_paul_id   UUID;
  dawn_dana_id    UUID;

  user_ids UUID[];

  -- Common San Diego beaches
  ob_id UUID; pb_id UUID; mission_id UUID; shores_id UUID;
  windansea_id UUID; blacks_id UUID; swamis_id UUID; cliffs_id UUID;
  any_beach_ids UUID[];

  -- Loop vars
  i INT; day_offset INT; hour_block TEXT; rnd_minutes INT;
  picked_user UUID; picked_beach UUID;
  arrival_ts TIMESTAMPTZ;
  s_id UUID; s_beach_id UUID; s_profile_id UUID; s_user_id UUID;

  -- Forecast mapping
  ef RECORD;
  f_wave_height DECIMAL(5,2);
  f_wind_speed DECIMAL(5,2);
  f_wind_direction TEXT;
  f_water_temp INTEGER;

  -- Derived session details
  v_duration INT;
  v_wave_quality INT;
  v_crowd_level INT;
  v_rating INT;
  v_notes TEXT;

  -- Note templates (minimize repetition)
  note_templates TEXT[] := ARRAY[
    'Glass-off window with playful shoulders',
    'Punchy peaks; quick takeoffs between lulls',
    'Clean early then light texture; still fun',
    'Crowded but respectful lineup; sets every 8–10 min',
    'Inside reforms super fun on the push',
    'Tide swing changed the banks but still workable',
    'Wind backed off near sunrise; clean faces',
    'Long walls; best on the sets; patience rewarded',
    'Steep drops on the bigger ones; hold your line',
    'Sketchy current on the north end; stayed centered'
  ];

  -- Intel text templates
  intel_titles TEXT[] := ARRAY[
    'Dawn patrol gold',
    'Midday shape holding',
    'Tide push turned it on',
    'Better than expected',
    'Wind cooperating for once',
    'Crowd manageable early',
    'Lines at the point'
  ];
  intel_desc TEXT[] := ARRAY[
    'Clean walls with light offshore; consistent chest-high sets.',
    'Peaky A-frames; short lulls, then flurries of fun sets.',
    'North end a hair cleaner; runners if you sit inside.',
    'Great learner conditions; forgiving takeoffs, long rides.',
    'Punchy and fast; watch the sections near the inside.',
    'Glass early; bumps later but still very workable.'
  ];

  -- Guard counts
  persona_count INT;
  -- Beach coordinate holders
  b_lat NUMERIC; 
  b_lng NUMERIC;
BEGIN
  -- Resolve persona IDs from profiles by name
  SELECT id INTO liquid_snake_id FROM profiles WHERE full_name = 'Liquid Snake' LIMIT 1;
  SELECT id INTO big_boss_id     FROM profiles WHERE full_name = 'Big Boss' LIMIT 1;
  SELECT id INTO solid_snake_id  FROM profiles WHERE full_name = 'Solid Snake' LIMIT 1;
  SELECT id INTO rookie_riley_id FROM profiles WHERE full_name = 'Riley "Rookie" Rodriguez' LIMIT 1;
  SELECT id INTO local_larry_id  FROM profiles WHERE full_name = 'Larry "Local" Thompson' LIMIT 1;
  SELECT id INTO travel_tina_id  FROM profiles WHERE full_name = 'Tina "Travel" Chen' LIMIT 1;
  SELECT id INTO photo_paul_id   FROM profiles WHERE full_name = 'Paul "PhotoPro" Martinez' LIMIT 1;
  SELECT id INTO dawn_dana_id    FROM profiles WHERE full_name = 'Dana "Dawn Patrol" Wilson' LIMIT 1;

  -- Build preferred persona list; fallback to any profiles if missing
  SELECT array_agg(id) INTO user_ids FROM profiles
  WHERE full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake',
    'Riley "Rookie" Rodriguez', 'Larry "Local" Thompson', 'Tina "Travel" Chen',
    'Paul "PhotoPro" Martinez', 'Dana "Dawn Patrol" Wilson'
  );
  IF user_ids IS NULL OR array_length(user_ids, 1) < 4 THEN
    RAISE NOTICE 'Preferred personas missing; falling back to any available profiles';
    SELECT array_agg(id) INTO user_ids FROM (
      SELECT id FROM profiles ORDER BY created_at LIMIT 12
    ) s;
  END IF;
  persona_count := COALESCE(array_length(user_ids, 1), 0);
  IF persona_count = 0 THEN
    RAISE NOTICE 'Skipping: no profiles available to seed sessions/intel.';
    RETURN;
  END IF;

  -- Resolve beach IDs (fall back to any beaches if named beaches missing)
  SELECT id INTO ob_id      FROM beaches WHERE name = 'Ocean Beach' LIMIT 1;
  SELECT id INTO pb_id      FROM beaches WHERE name = 'Pacific Beach' LIMIT 1;
  SELECT id INTO mission_id FROM beaches WHERE name = 'Mission Beach' LIMIT 1;
  SELECT id INTO shores_id  FROM beaches WHERE name = 'La Jolla Shores' LIMIT 1;
  SELECT id INTO windansea_id FROM beaches WHERE name = 'Windansea Beach' LIMIT 1;
  SELECT id INTO blacks_id  FROM beaches WHERE name = 'Blacks Beach' LIMIT 1;
  SELECT id INTO swamis_id  FROM beaches WHERE name = 'Swami''s Beach' LIMIT 1;
  SELECT id INTO cliffs_id  FROM beaches WHERE name = 'Sunset Cliffs' LIMIT 1;
  -- Fallback beach pool if some are null
  SELECT array_agg(id) INTO any_beach_ids FROM (
    SELECT id FROM beaches ORDER BY created_at LIMIT 12
  ) s;

  RAISE NOTICE 'Seeding 100 sessions over last 7 days...';

  -- Create 100 sessions spread across last week
  FOR i IN 1..100 LOOP
    -- Bias toward last 3 days but spread across full week
    day_offset := (CASE
      WHEN RANDOM() < 0.6 THEN FLOOR(RANDOM() * 3) -- last 3 days
      ELSE FLOOR(RANDOM() * 7) -- otherwise last 7
    END);

    -- Choose user & beach with slight bias to OB / Shores / PB
    picked_user := user_ids[(1 + FLOOR(RANDOM() * GREATEST(array_length(user_ids, 1), 1)))::int];
    picked_beach := COALESCE(
      (ARRAY[
        ob_id, shores_id, pb_id, mission_id, windansea_id, blacks_id, swamis_id, cliffs_id,
        ob_id, shores_id, pb_id -- bias entries
      ])[1 + FLOOR(RANDOM() * 11)],
      any_beach_ids[(1 + FLOOR(RANDOM() * GREATEST(array_length(any_beach_ids,1),1)))::int]
    );

    -- Morning vs afternoon windows + random minutes
    hour_block := (CASE WHEN RANDOM() < 0.55 THEN '06:00:00' ELSE '15:00:00' END);
    rnd_minutes := FLOOR(RANDOM() * 120);
    arrival_ts := (NOW() - (day_offset || ' days')::interval)
                  + hour_block::time
                  + (rnd_minutes || ' minutes')::interval;

    -- Find nearest forecast row for this beach/time (if present)
    ef := NULL;
    SELECT * INTO ef FROM enhanced_forecasts efc
    WHERE efc.beach_id::uuid = picked_beach::uuid
    ORDER BY
      ABS(EXTRACT(EPOCH FROM (
        (efc.forecast_date::date + efc.forecast_time::time)
        - arrival_ts
      ))) ASC
    LIMIT 1;

    -- Map forecast → session fields with sensible fallbacks
    f_wave_height := COALESCE((ef.wave_height)::numeric, ROUND((2.0 + RANDOM() * 4.0)::numeric, 1));
    f_wind_speed  := COALESCE((ef.wind_speed)::numeric,  ROUND((3.0 + RANDOM() * 15.0)::numeric, 1));
    f_wind_direction := COALESCE((ef.wind_direction)::text, (ARRAY['N','NE','E','SE','S','SW','W','NW','OFFSHORE','ONSHORE','CROSS'])[1 + FLOOR(RANDOM() * 11)]);
    f_water_temp  := COALESCE(ROUND((ef.water_temp)::numeric)::INT, (63 + FLOOR(RANDOM() * 6))::INT);

    -- Derive additional details to minimize repetition
    v_duration := 60 + (15 * FLOOR(RANDOM() * 7)); -- 60–165 minutes
    v_wave_quality := LEAST(5, GREATEST(1, CEIL(GREATEST(f_wave_height, 0.1) / 1.2)::INT + (CASE WHEN f_wind_speed < 6 THEN 1 ELSE 0 END)));
    v_crowd_level := 1 + FLOOR(RANDOM() * 5);
    v_rating := LEAST(5, GREATEST(2, v_wave_quality + (CASE WHEN f_wind_speed < 8 THEN 1 ELSE 0 END)));
    v_notes := note_templates[1 + FLOOR(RANDOM() * array_length(note_templates, 1))];

    -- Insert as planned first
    INSERT INTO sessions (
      user_id, profile_id, beach_id, status,
      arrival_time, duration_minutes,
      water_temp, wave_quality, crowd_level, rating, notes, is_public
    ) VALUES (
      picked_user, picked_user, picked_beach, 'planned',
      arrival_ts, v_duration,
      f_water_temp, v_wave_quality, v_crowd_level, v_rating, v_notes, TRUE
    ) RETURNING id, user_id, beach_id INTO s_id, s_user_id, s_beach_id;

    -- Update to completed to trigger snapshot
    UPDATE sessions SET status = 'completed' WHERE id = s_id;
  END LOOP;

  RAISE NOTICE 'Seeded 100 sessions. Creating intel posts (≈30)...';

  -- Intel posts: mix of conditions + hazard/parking across beaches
  PERFORM 1;
  FOR i IN 1..30 LOOP
    picked_user := user_ids[(1 + FLOOR(RANDOM() * GREATEST(array_length(user_ids, 1), 1)))::int];
    picked_beach := COALESCE(
      (ARRAY[ob_id, shores_id, pb_id, mission_id, windansea_id, blacks_id, swamis_id, cliffs_id])[1 + FLOOR(RANDOM() * 8)],
      any_beach_ids[(1 + FLOOR(RANDOM() * GREATEST(array_length(any_beach_ids,1),1)))::int]
    );
    day_offset := FLOOR(RANDOM() * 7);
    hour_block := (CASE WHEN RANDOM() < 0.6 THEN '06:00:00' ELSE '15:00:00' END);
    rnd_minutes := FLOOR(RANDOM() * 120);
    arrival_ts := (NOW() - (day_offset || ' days')::interval)
                  + hour_block::time
                  + (rnd_minutes || ' minutes')::interval;

    ef := NULL;
    SELECT * INTO ef FROM enhanced_forecasts efc
    WHERE efc.beach_id::uuid = picked_beach::uuid
    ORDER BY
      ABS(EXTRACT(EPOCH FROM (
        (efc.forecast_date::date + efc.forecast_time::time)
        - arrival_ts
      ))) ASC
    LIMIT 1;

    f_wave_height := COALESCE((ef.wave_height)::numeric, ROUND((2.0 + RANDOM() * 4.0)::numeric, 1));
    f_wind_speed  := COALESCE((ef.wind_speed)::numeric,  ROUND((3.0 + RANDOM() * 15.0)::numeric, 1));
    f_wind_direction := COALESCE((ef.wind_direction)::text, (ARRAY['N','NE','E','SE','S','SW','W','NW','OFFSHORE','ONSHORE','CROSS'])[1 + FLOOR(RANDOM() * 11)]);
    f_water_temp  := COALESCE(ROUND((ef.water_temp)::numeric)::INT, (63 + FLOOR(RANDOM() * 6))::INT);

    -- Coordinates from beaches table if available
    SELECT latitude, longitude INTO b_lat, b_lng FROM beaches WHERE id = picked_beach;

    INSERT INTO intel_posts (
      user_id, latitude, longitude,
      tag, title, description, confirmations_count, is_active,
      expires_at, created_at,
      wave_height, wind_speed, wind_direction, water_temp,
      crowd_level, wave_types, forecast_accuracy
    ) VALUES (
      picked_user,
      b_lat, b_lng,
      ((ARRAY['conditions','conditions','conditions','hazard','parking','conditions'])[1 + FLOOR(RANDOM() * 6)])::intel_post_tag,
      intel_titles[1 + FLOOR(RANDOM() * array_length(intel_titles, 1))],
      intel_desc[1 + FLOOR(RANDOM() * array_length(intel_desc, 1))],
      FLOOR(RANDOM() * 12)::INT,
      TRUE,
      NOW() + INTERVAL '6 hours',
      arrival_ts,
      f_wave_height, f_wind_speed, f_wind_direction, f_water_temp,
      1 + FLOOR(RANDOM() * 5),
      ARRAY[(ARRAY['clean','peaky','mushy','reform','powerful'])[(1 + FLOOR(RANDOM() * 5))::int]],
      (ARRAY['accurate','somewhat','inaccurate'])[1 + FLOOR(RANDOM() * 3)]
    );
  END LOOP;

  -- Light confirmations for variety
  INSERT INTO intel_post_confirmations (intel_post_id, user_id, created_at)
  SELECT ip.id, u_id, NOW() - INTERVAL '1 hour' * (1 + FLOOR(RANDOM() * 6))
  FROM (
    SELECT id, user_id FROM intel_posts
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 25
  ) ip
  CROSS JOIN LATERAL (
    SELECT unnest(user_ids) AS u_id
  ) u
  WHERE ip.user_id <> u.u_id
  AND RANDOM() < 0.18
  ON CONFLICT (intel_post_id, user_id) DO NOTHING;

  -- Recompute confirmation counts for recent posts
  UPDATE intel_posts SET confirmations_count = (
    SELECT COUNT(*) FROM intel_post_confirmations c WHERE c.intel_post_id = intel_posts.id
  )
  WHERE created_at > NOW() - INTERVAL '7 days';

  -- Quick checks
  RAISE NOTICE 'Sessions (last 7 days): %', (SELECT COUNT(*) FROM sessions WHERE arrival_time > NOW() - INTERVAL '7 days');
  RAISE NOTICE 'Intel posts (last 7 days): %', (SELECT COUNT(*) FROM intel_posts WHERE created_at > NOW() - INTERVAL '7 days');
  RAISE NOTICE 'Forecast snapshots total: %', (SELECT COUNT(*) FROM session_forecast_snapshots);
END $$;

-- Optional manual verifications:
-- SELECT beach_id, COUNT(*) FROM sessions WHERE arrival_time > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 2 DESC;
-- SELECT tag, COUNT(*) FROM intel_posts WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1;
-- SELECT COUNT(*) FROM session_forecast_snapshots;


