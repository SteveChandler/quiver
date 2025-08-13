-- Delete a specific Test Beach by ID, cleaning up dependent rows first
-- Safe to run multiple times; guards handle missing tables/rows

BEGIN;

DO $$
DECLARE
  v_beach_id uuid := '16ab1337-e8ac-4d7d-88dc-11609ee464af'::uuid;
BEGIN
  -- Delete session children first (defensive, in case FKs lack ON DELETE CASCADE)
  IF to_regclass('public.sessions') IS NOT NULL THEN
    -- Comments
    IF to_regclass('public.comments') IS NOT NULL THEN
      DELETE FROM public.comments c
      USING public.sessions s
      WHERE c.session_id = s.id AND s.beach_id = v_beach_id;
    END IF;

    -- Session media
    IF to_regclass('public.session_media') IS NOT NULL THEN
      DELETE FROM public.session_media m
      USING public.sessions s
      WHERE m.session_id = s.id AND s.beach_id = v_beach_id;
    END IF;

    -- Participants
    IF to_regclass('public.session_participants') IS NOT NULL THEN
      DELETE FROM public.session_participants p
      USING public.sessions s
      WHERE p.session_id = s.id AND s.beach_id = v_beach_id;
    END IF;

    -- Likes
    IF to_regclass('public.session_likes') IS NOT NULL THEN
      DELETE FROM public.session_likes l
      USING public.sessions s
      WHERE l.session_id = s.id AND s.beach_id = v_beach_id;
    END IF;

    -- Invitations
    IF to_regclass('public.session_invitations') IS NOT NULL THEN
      DELETE FROM public.session_invitations i
      USING public.sessions s
      WHERE i.session_id = s.id AND s.beach_id = v_beach_id;
    END IF;

    -- Forecast snapshots (if present)
    IF to_regclass('public.session_forecast_snapshots') IS NOT NULL THEN
      DELETE FROM public.session_forecast_snapshots fs
      USING public.sessions s
      WHERE fs.session_id = s.id AND s.beach_id = v_beach_id;
    END IF;

    -- Finally, delete sessions for this beach
    DELETE FROM public.sessions WHERE beach_id = v_beach_id;
  END IF;

  -- Clear dependent calibration rows (no ON DELETE CASCADE by default)
  IF to_regclass('public.beach_recommendation_calibration') IS NOT NULL THEN
    DELETE FROM public.beach_recommendation_calibration WHERE beach_id = v_beach_id;
  END IF;

  -- Favorites
  IF to_regclass('public.favorite_beaches') IS NOT NULL THEN
    DELETE FROM public.favorite_beaches WHERE beach_id = v_beach_id;
  END IF;

  -- Beach reviews
  IF to_regclass('public.beach_reviews') IS NOT NULL THEN
    DELETE FROM public.beach_reviews WHERE beach_id = v_beach_id;
  END IF;

  -- Legacy check-ins / consolidated condition reports
  IF to_regclass('public.check_ins') IS NOT NULL THEN
    DELETE FROM public.check_ins WHERE beach_id = v_beach_id;
  END IF;
  IF to_regclass('public.condition_reports') IS NOT NULL THEN
    DELETE FROM public.condition_reports WHERE beach_id = v_beach_id;
  END IF;

  -- Clear forecast rows (defensive even if ON DELETE CASCADE exists)
  IF to_regclass('public.marine_forecasts') IS NOT NULL THEN
    DELETE FROM public.marine_forecasts WHERE beach_id = v_beach_id;
  END IF;
  IF to_regclass('public.tide_forecasts') IS NOT NULL THEN
    DELETE FROM public.tide_forecasts WHERE beach_id = v_beach_id;
  END IF;
  IF to_regclass('public.sun_times') IS NOT NULL THEN
    DELETE FROM public.sun_times WHERE beach_id = v_beach_id;
  END IF;

  -- Null out profile references to avoid FK violations
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'default_beach_id'
  ) THEN
    UPDATE public.profiles SET default_beach_id = NULL WHERE default_beach_id = v_beach_id;
  END IF;

  -- Delete the beach itself
  IF to_regclass('public.beaches') IS NOT NULL THEN
    DELETE FROM public.beaches WHERE id = v_beach_id;
  END IF;
END $$;

COMMIT;


