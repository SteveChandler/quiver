\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() NOT LIKE 'quiver_character_full_test_%' THEN
    RAISE EXCEPTION 'Use only an isolated full-schema test clone';
  END IF;
  IF (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') < 160 THEN
    RAISE EXCEPTION 'Full application schema required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.sessions'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.session_forecast_snapshots'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Ownership checks require real enabled RLS';
  END IF;
END $$;

-- Synthetic identities only. Keep all application session triggers and policies active.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('10000000-0000-0000-0000-000000000001', 'character-a@example.invalid', '{"full_name":"Character A"}'),
 ('10000000-0000-0000-0000-000000000002', 'character-b@example.invalid', '{"full_name":"Character B"}');
INSERT INTO public.profiles (id, full_name, is_admin) VALUES
 ('10000000-0000-0000-0000-000000000001', 'Character A', false),
 ('10000000-0000-0000-0000-000000000002', 'Character B', false)
ON CONFLICT (id) DO UPDATE SET is_admin = false;
INSERT INTO public.beaches (id, name, lat, lon) VALUES
 ('20000000-0000-0000-0000-000000000001', 'Character audit A', 32.8, -117.2),
 ('20000000-0000-0000-0000-000000000002', 'Character audit B', 32.9, -117.3);
INSERT INTO public.sessions (id, user_id, beach_id, status, is_public, arrival_time, wave_characteristics)
SELECT ('30000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
 '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 'planned', false, '2026-08-01T15:00:00Z',
 CASE i % 4 WHEN 0 THEN NULL WHEN 1 THEN ARRAY[]::text[] WHEN 2 THEN ARRAY['glassy','closeouts'] ELSE ARRAY['barreling','fat','powerful'] END
FROM generate_series(1, 100) i;
INSERT INTO public.sessions (id, user_id, beach_id, status, is_public, arrival_time, wave_characteristics) VALUES
 ('30000000-0000-0000-0000-000000000900', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'planned', false, '2026-08-01T15:00:00Z', ARRAY['closeouts']),
 ('30000000-0000-0000-0000-000000000901', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'planned', false, '2026-08-01T15:00:00Z', ARRAY['clean']);
INSERT INTO public.session_forecast_snapshots (session_id, user_id, beach_id, forecast_snapshot, actual_conditions, session_date, created_at)
SELECT id, user_id, beach_id, '{"wave_height":"3 ft","forecast_at":"2026-08-01T15:00:00Z","created_at":"2026-07-31T10:00:00Z","updated_at":"2026-07-31T10:00:00Z"}',
 '{"notes":"preserve me"}', '2026-08-01', '2026-08-01T17:00:00Z'
FROM public.sessions WHERE user_id = '10000000-0000-0000-0000-000000000001' AND id <> '30000000-0000-0000-0000-000000000901';
CREATE TEMP TABLE history_before AS SELECT id, forecast_snapshot, created_at FROM public.session_forecast_snapshots;

-- Baseline proof: the existing owner-only INSERT policy does not bind session ownership.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
INSERT INTO public.session_forecast_snapshots (session_id,user_id,beach_id,forecast_snapshot,actual_conditions,session_date)
VALUES ('30000000-0000-0000-0000-000000000900','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','{}','{}','2026-08-01');
DELETE FROM public.session_forecast_snapshots WHERE session_id = '30000000-0000-0000-0000-000000000900';
RESET ROLE;

\ir ../../supabase/migrations/20260909050000_preserve_session_wave_characteristics.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.session_forecast_snapshots f JOIN public.sessions s ON s.id=f.session_id
      WHERE f.actual_conditions->'wave_characteristics' IS NOT DISTINCT FROM COALESCE(to_jsonb(s.wave_characteristics),'null'::jsonb)
      AND f.actual_conditions->>'notes' = 'preserve me') <> 100 THEN
    RAISE EXCEPTION 'Representative backfill mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM history_before h JOIN public.session_forecast_snapshots f USING(id)
      WHERE h.forecast_snapshot IS DISTINCT FROM f.forecast_snapshot OR h.created_at IS DISTINCT FROM f.created_at) THEN
    RAISE EXCEPTION 'Backfill changed forecast history';
  END IF;
  IF has_function_privilege('authenticated','public.sync_session_wave_characteristics()','EXECUTE')
    OR has_function_privilege('anon','public.sync_session_wave_characteristics()','EXECUTE') THEN
    RAISE EXCEPTION 'Trigger function exposed through default function grants';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.session_forecast_snapshots;
  IF n <> 0 THEN RAISE EXCEPTION 'Foreign snapshots visible'; END IF;
  UPDATE public.sessions SET wave_characteristics = ARRAY['choppy'] WHERE user_id = '10000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Foreign session updated'; END IF;
  UPDATE public.session_forecast_snapshots SET actual_conditions = '{}' WHERE user_id = '10000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Foreign snapshot updated'; END IF;
END $$;

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.session_forecast_snapshots) THEN RAISE EXCEPTION 'Anonymous snapshot read'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.session_forecast_snapshots (session_id,user_id,beach_id,forecast_snapshot,actual_conditions,session_date)
    VALUES ('30000000-0000-0000-0000-000000000900','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','{}','{}','2026-08-01');
    RAISE EXCEPTION 'Cross-owner insert accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.session_forecast_snapshots (session_id,user_id,beach_id,forecast_snapshot,actual_conditions,session_date)
    VALUES ('30000000-0000-0000-0000-000000000901','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','{}','{}','2026-08-01');
    RAISE EXCEPTION 'Wrong-beach insert accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.session_forecast_snapshots SET session_id='30000000-0000-0000-0000-000000000900'
    WHERE session_id='30000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Cross-owner reassignment accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.sessions SET wave_characteristics = ARRAY['choppy','closeouts'] WHERE id='30000000-0000-0000-0000-000000000001';
UPDATE public.session_forecast_snapshots SET actual_conditions='{"wave_characteristics":["invented"]}' WHERE session_id='30000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE session_id='30000000-0000-0000-0000-000000000001' AND actual_conditions->'wave_characteristics'='["choppy","closeouts"]') THEN RAISE EXCEPTION 'Session authority lost'; END IF;
END $$;
UPDATE public.sessions SET wave_characteristics = ARRAY[]::text[] WHERE id='30000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE session_id='30000000-0000-0000-0000-000000000001' AND actual_conditions->'wave_characteristics'='[]') THEN RAISE EXCEPTION 'Empty clear lost'; END IF;
END $$;
UPDATE public.sessions SET wave_characteristics = NULL WHERE id='30000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE session_id='30000000-0000-0000-0000-000000000001' AND actual_conditions->'wave_characteristics'='null') THEN RAISE EXCEPTION 'Unknown clear lost'; END IF;
END $$;
RESET ROLE;

-- Required legacy date/time columns exist in this full local schema; forecast_at drives matching.
INSERT INTO public.enhanced_forecasts (beach_id,forecast_date,forecast_time,forecast_at,wave_height,wave_period,wind_speed,wind_direction,tide_height,tide_status,confidence_score)
VALUES ('20000000-0000-0000-0000-000000000001','2026-08-01','15:00','2026-08-01T15:00:00Z','3.8 ft','12s','4 mph','W','2 ft','Rising',80);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
INSERT INTO public.sessions (id,user_id,beach_id,status,is_public,arrival_time,wave_characteristics)
VALUES ('30000000-0000-0000-0000-000000000902','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','completed',false,'2026-08-01T15:00:00Z',ARRAY['glassy','barreling']);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE session_id='30000000-0000-0000-0000-000000000902'
    AND actual_conditions->'wave_characteristics'='["glassy","barreling"]') THEN RAISE EXCEPTION 'Real completed-session trigger missed tags'; END IF;
END $$;
RESET ROLE;
INSERT INTO history_before SELECT id,forecast_snapshot,created_at FROM public.session_forecast_snapshots WHERE session_id='30000000-0000-0000-0000-000000000902';
UPDATE public.enhanced_forecasts SET wave_height='9 ft' WHERE beach_id='20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
UPDATE public.sessions SET wave_characteristics=ARRAY['closeouts'],notes='Updated observation only' WHERE id='30000000-0000-0000-0000-000000000902';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM history_before h JOIN public.session_forecast_snapshots f USING(id)
    WHERE h.forecast_snapshot IS DISTINCT FROM f.forecast_snapshot OR h.created_at IS DISTINCT FROM f.created_at) THEN RAISE EXCEPTION 'Observation edit rematched forecast history'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE session_id='30000000-0000-0000-0000-000000000902'
    AND actual_conditions->'wave_characteristics'='["closeouts"]' AND actual_conditions->>'notes'='Updated observation only') THEN RAISE EXCEPTION 'Existing actuals writer lost tag sync'; END IF;
END $$;
SELECT 'PASS: full-schema backfill, owner/RLS, trigger grants, clearing, real writer and forecast-history invariants' AS result;
