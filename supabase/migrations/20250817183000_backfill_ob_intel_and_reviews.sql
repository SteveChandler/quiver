-- Backfill Ocean Beach intel posts and reviews (idempotent)
-- Seeds a handful of high-signal entries so Local Intel and Reviews render

BEGIN;

DO $$
DECLARE
  ob_id uuid;
  author_ids uuid[];
  now_ts timestamptz := now();
BEGIN
  SELECT id INTO ob_id FROM public.beaches WHERE name = 'Ocean Beach' LIMIT 1;
  IF ob_id IS NULL THEN
    RAISE NOTICE 'Ocean Beach not found, skipping backfill';
    RETURN;
  END IF;

  -- Gather some authors (any existing profiles)
  SELECT ARRAY(
    SELECT id FROM public.profiles ORDER BY created_at NULLS LAST LIMIT 20
  ) INTO author_ids;

  -- Intel posts (insert if not exists by unique (beach_id,title) semantic)
  -- Titles chosen to be unique and human-readable
  INSERT INTO public.intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at)
  SELECT
    author_ids[1], ob_id, 32.7493, -117.2511, 'conditions',
    'OB firing early – offshore til 10am',
    'Clean 3-4 ft with light offshore. Best between 7–10am near the pier.',
    jsonb_build_object('wave_height_ft','3-4','wind','offshore','time','morning'),
    7, true, now_ts + interval '10 days', now_ts - interval '1 day'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.intel_posts WHERE beach_id = ob_id AND title = 'OB firing early – offshore til 10am'
  );

  INSERT INTO public.intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at)
  SELECT
    author_ids[2], ob_id, 32.7493, -117.2511, 'parking',
    'Lot fills before 8:30am – street after',
    'Main lot fills quickly on weekdays around 8–8:30. Street parking north side is better.',
    jsonb_build_object('parking_difficulty','high','recommendation','arrive_early'),
    5, true, now_ts + interval '14 days', now_ts - interval '2 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.intel_posts WHERE beach_id = ob_id AND title = 'Lot fills before 8:30am – street after'
  );

  INSERT INTO public.intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at)
  SELECT
    author_ids[3], ob_id, 32.7493, -117.2511, 'hazard',
    'Strong rip north of pier at mid tide',
    'Noticed a gnarly rip just north of the pier during mid tide push. Watch beginners.',
    jsonb_build_object('hazard_type','rip','severity','high'),
    6, true, now_ts + interval '12 days', now_ts - interval '4 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.intel_posts WHERE beach_id = ob_id AND title = 'Strong rip north of pier at mid tide'
  );

  INSERT INTO public.intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at)
  SELECT
    author_ids[4], ob_id, 32.7493, -117.2511, 'access',
    'Best access is south stairs by the pier',
    'Quicker in/out via south stairs near the pier. Showers working.',
    jsonb_build_object('facilities', jsonb_build_array('showers','restrooms')),
    3, true, now_ts + interval '9 days', now_ts - interval '6 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.intel_posts WHERE beach_id = ob_id AND title = 'Best access is south stairs by the pier'
  );

  INSERT INTO public.intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at)
  SELECT
    author_ids[5], ob_id, 32.7493, -117.2511, 'crowd',
    'Locals heavy at main peak – keep it respectful',
    'Main peak near the pier is local. Sit wide or paddle north if new to OB.',
    jsonb_build_object('local_vibe','heavy','respect_required',true),
    10, true, now_ts + interval '11 days', now_ts - interval '3 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.intel_posts WHERE beach_id = ob_id AND title = 'Locals heavy at main peak – keep it respectful'
  );

  INSERT INTO public.intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at)
  SELECT
    author_ids[6], ob_id, 32.7493, -117.2511, 'other',
    'Best on mid–high tide with west swell',
    'OB really comes alive on mid to high tide with a solid W/WNW swell.',
    jsonb_build_object('optimal_tide','mid_to_high','swell','W/WNW'),
    4, true, now_ts + interval '8 days', now_ts - interval '5 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.intel_posts WHERE beach_id = ob_id AND title = 'Best on mid–high tide with west swell'
  );

  -- Reviews for Ocean Beach
  INSERT INTO public.beach_reviews (beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating, title, content, visit_date, helpful_count, created_at)
  SELECT ob_id, author_ids[7], 5, 5, 4, 1, 3,
    'World‑class when it''s on',
    'Pier section throws legit barrels on the right W swell. Heavy but worth it.',
    (now_ts - interval '7 days')::date, 12, now_ts - interval '7 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.beach_reviews WHERE beach_id = ob_id AND title = 'World‑class when it''s on'
  );

  INSERT INTO public.beach_reviews (beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating, title, content, visit_date, helpful_count, created_at)
  SELECT ob_id, author_ids[8], 4, 4, 3, 1, 3,
    'Challenging but rewarding',
    'Currents and rips can be tough; pick your windows. Rewards strong paddlers.',
    (now_ts - interval '15 days')::date, 8, now_ts - interval '15 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.beach_reviews WHERE beach_id = ob_id AND title = 'Challenging but rewarding'
  );

  INSERT INTO public.beach_reviews (beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating, title, content, visit_date, helpful_count, created_at)
  SELECT ob_id, author_ids[9], 3, 4, 3, 1, 2,
    'Classic OB character',
    'Heavy lineup etiquette at the main peak. North side mellower. Parking is rough.',
    (now_ts - interval '20 days')::date, 6, now_ts - interval '20 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.beach_reviews WHERE beach_id = ob_id AND title = 'Classic OB character'
  );

END $$;

COMMIT;


