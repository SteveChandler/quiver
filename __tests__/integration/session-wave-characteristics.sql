\set ON_ERROR_STOP on
-- Run only in a disposable local database; no production schema/data required.
CREATE TABLE public.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL, wave_characteristics text[], beach_id uuid);
CREATE TABLE public.session_forecast_snapshots (
  session_id uuid, user_id uuid, actual_conditions jsonb,
  forecast_snapshot jsonb, created_at timestamptz DEFAULT '2026-01-01Z', beach_id uuid
);
INSERT INTO public.sessions VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', ARRAY['glassy','closeouts']);
INSERT INTO public.session_forecast_snapshots VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '{"notes":"preserved"}', '{"wind_speed":"5 mph"}', DEFAULT);
\ir ../../supabase/migrations/20260909050000_preserve_session_wave_characteristics.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE actual_conditions->'wave_characteristics' = '["glassy","closeouts"]') THEN RAISE EXCEPTION 'backfill lost independent dimensions'; END IF;
END $$;
UPDATE public.session_forecast_snapshots SET actual_conditions = '{"rating":4}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE actual_conditions->'wave_characteristics' = '["glassy","closeouts"]' AND actual_conditions->>'rating' = '4') THEN RAISE EXCEPTION 'manual snapshot writer lost tags'; END IF;
END $$;
UPDATE public.sessions SET wave_characteristics = ARRAY[]::text[];
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE actual_conditions->'wave_characteristics' = '[]') THEN RAISE EXCEPTION 'clear to empty lost'; END IF;
END $$;
UPDATE public.sessions SET wave_characteristics = NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE actual_conditions->'wave_characteristics' = 'null' AND forecast_snapshot = '{"wind_speed":"5 mph"}' AND created_at = '2026-01-01Z') THEN RAISE EXCEPTION 'unknown or historical forecast mutated'; END IF;
END $$;
UPDATE public.sessions SET wave_characteristics = ARRAY['choppy','reform'];
INSERT INTO public.session_forecast_snapshots VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '{}', '{"new":true}', DEFAULT);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_forecast_snapshots WHERE forecast_snapshot = '{"new":true}' AND actual_conditions->'wave_characteristics' = '["choppy","reform"]') THEN RAISE EXCEPTION 'new snapshot missed original observations'; END IF;
END $$;
