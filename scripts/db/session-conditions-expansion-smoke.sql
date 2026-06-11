-- Local smoke test for session conditions expansion triggers.
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 \
--     -f scripts/db/session-conditions-expansion-smoke.sql
--
-- This script intentionally rolls back all rows it creates.

BEGIN;

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-00000000f101',
  'authenticated',
  'authenticated',
  'session-conditions-smoke@example.test',
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

INSERT INTO public.beaches (
  id,
  name,
  lat,
  lon,
  timezone,
  nws_forecast_zone,
  nws_office
)
VALUES (
  '00000000-0000-0000-0000-00000000b101',
  'Session Conditions Smoke Beach',
  32.7500,
  -117.2500,
  'America/Los_Angeles',
  'CAZ043',
  'SGX'
);

INSERT INTO public.tide_forecasts (
  beach_id,
  ts,
  tide_height_m,
  tide_phase,
  source
)
VALUES
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-10 22:00:00+00',
    0.0,
    NULL,
    'noaa_hilo_interpolated'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-10 23:00:00+00',
    1.0,
    NULL,
    'noaa_hilo_interpolated'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 00:00:00+00',
    2.0,
    NULL,
    'noaa_hilo_interpolated'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 01:00:00+00',
    1.0,
    NULL,
    'noaa_hilo_interpolated'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 02:00:00+00',
    0.0,
    NULL,
    'noaa_hilo_interpolated'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 08:00:00+00',
    0.0,
    NULL,
    'noaa'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 09:00:00+00',
    1.0,
    NULL,
    'noaa'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 10:00:00+00',
    2.0,
    NULL,
    'noaa'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 12:00:00+00',
    0.0,
    NULL,
    'noaa'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 13:00:00+00',
    2.0,
    NULL,
    'noaa'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 14:00:00+00',
    0.0,
    NULL,
    'noaa'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 15:00:00+00',
    -1.0,
    NULL,
    'noaa'
  );

INSERT INTO public.rip_current_risks (
  beach_id,
  valid_date,
  risk_level,
  source,
  raw_zone
)
VALUES
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-10',
    'high',
    'srf',
    'CAZ043'
  ),
  (
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11',
    'low',
    'srf',
    'CAZ043'
  );

INSERT INTO public.sessions (
  id,
  user_id,
  beach_id,
  arrival_time,
  duration_minutes,
  wave_characteristics,
  rip_current_observed
)
VALUES (
  '00000000-0000-0000-0000-00000000a101',
  '00000000-0000-0000-0000-00000000f101',
  '00000000-0000-0000-0000-00000000b101',
  '2026-06-10 23:30:00+00',
  60,
  ARRAY['clean','fat','closeouts']::text[],
  'strong'
);

DO $$
DECLARE
  inserted public.sessions%ROWTYPE;
  updated public.sessions%ROWTYPE;
  unchanged_tide_update public.sessions%ROWTYPE;
  exact_high public.sessions%ROWTYPE;
  manual public.sessions%ROWTYPE;
BEGIN
  SELECT *
  INTO inserted
  FROM public.sessions
  WHERE id = '00000000-0000-0000-0000-00000000a101';

  IF inserted.tide_data_source <> 'noaa' THEN
    RAISE EXCEPTION 'expected noaa source, got %', inserted.tide_data_source;
  END IF;

  IF inserted.tide_status <> 'high' THEN
    RAISE EXCEPTION 'expected high tide status from sign flip, got %', inserted.tide_status;
  END IF;

  IF inserted.tide_height_ft <> 4.92 THEN
    RAISE EXCEPTION 'expected interpolated height 4.92, got %', inserted.tide_height_ft;
  END IF;

  IF inserted.tide_rate_ft_per_hr <> 3.28 THEN
    RAISE EXCEPTION 'expected rate 3.28, got %', inserted.tide_rate_ft_per_hr;
  END IF;

  IF inserted.rip_current_risk <> 'high' THEN
    RAISE EXCEPTION 'expected local-date rip risk high, got %', inserted.rip_current_risk;
  END IF;

  IF inserted.wave_characteristics <> ARRAY['clean','fat','closeouts']::text[] THEN
    RAISE EXCEPTION 'wave_characteristics did not persist: %', inserted.wave_characteristics;
  END IF;

  IF inserted.rip_current_observed <> 'strong' THEN
    RAISE EXCEPTION 'rip_current_observed did not persist: %', inserted.rip_current_observed;
  END IF;

  UPDATE public.sessions
  SET arrival_time = '2026-06-11 08:30:00+00'
  WHERE id = '00000000-0000-0000-0000-00000000a101'
  RETURNING * INTO updated;

  IF updated.tide_data_source <> 'noaa' THEN
    RAISE EXCEPTION 'expected noaa source after update recompute, got %',
      updated.tide_data_source;
  END IF;

  IF updated.tide_status <> 'rising' THEN
    RAISE EXCEPTION 'expected rising after update recompute, got %', updated.tide_status;
  END IF;

  IF updated.rip_current_risk <> 'low' THEN
    RAISE EXCEPTION 'expected local-date rip risk low after update, got %',
      updated.rip_current_risk;
  END IF;

  UPDATE public.sessions
  SET
    tide_height_ft = tide_height_ft,
    tide_status = tide_status
  WHERE id = '00000000-0000-0000-0000-00000000a101'
  RETURNING * INTO unchanged_tide_update;

  IF unchanged_tide_update.tide_data_source <> 'noaa' THEN
    RAISE EXCEPTION 'unchanged tide update should preserve noaa source, got %',
      unchanged_tide_update.tide_data_source;
  END IF;

  INSERT INTO public.sessions (
    id,
    user_id,
    beach_id,
    arrival_time,
    duration_minutes
  )
  VALUES (
    '00000000-0000-0000-0000-00000000a103',
    '00000000-0000-0000-0000-00000000f101',
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-11 13:00:00+00',
    60
  )
  RETURNING * INTO exact_high;

  IF exact_high.tide_status <> 'high' THEN
    RAISE EXCEPTION 'expected exact-hour sign flip to classify high, got %',
      exact_high.tide_status;
  END IF;

  IF exact_high.tide_rate_ft_per_hr <> 0.00 THEN
    RAISE EXCEPTION 'expected exact-hour central-difference rate 0.00, got %',
      exact_high.tide_rate_ft_per_hr;
  END IF;

  INSERT INTO public.sessions (
    id,
    user_id,
    beach_id,
    arrival_time,
    duration_minutes,
    tide_height_ft,
    tide_status
  )
  VALUES (
    '00000000-0000-0000-0000-00000000a102',
    '00000000-0000-0000-0000-00000000f101',
    '00000000-0000-0000-0000-00000000b101',
    '2026-06-10 23:30:00+00',
    60,
    2.50,
    'falling'
  )
  RETURNING * INTO manual;

  IF manual.tide_data_source <> 'user' THEN
    RAISE EXCEPTION 'expected manual tide source user, got %', manual.tide_data_source;
  END IF;

  IF manual.tide_height_ft <> 2.50 OR manual.tide_status <> 'falling' THEN
    RAISE EXCEPTION 'manual tide fields were overwritten: % %',
      manual.tide_height_ft,
      manual.tide_status;
  END IF;

  IF manual.tide_rate_ft_per_hr <> 3.28 THEN
    RAISE EXCEPTION 'expected computed manual tide rate 3.28, got %',
      manual.tide_rate_ft_per_hr;
  END IF;
END $$;

ROLLBACK;
