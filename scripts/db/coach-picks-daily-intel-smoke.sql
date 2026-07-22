\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE coach_picks_fixture_ids (
  fixture text PRIMARY KEY,
  id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO coach_picks_fixture_ids (fixture, id)
VALUES
  ('origin', gen_random_uuid()),
  ('near_high', gen_random_uuid()),
  ('near_low', gen_random_uuid()),
  ('far_high', gen_random_uuid()),
  ('private_high', gen_random_uuid()),
  ('deleted_high', gen_random_uuid());

INSERT INTO public.beaches (id, name, lat, lon, is_private, deleted_at)
SELECT id, 'Coach Picks Origin', 0.0000, 0.0000, false, NULL::timestamptz
FROM coach_picks_fixture_ids WHERE fixture = 'origin'
UNION ALL
SELECT id, 'Coach Picks Near High', 0.0100, 0.0000, false, NULL::timestamptz
FROM coach_picks_fixture_ids WHERE fixture = 'near_high'
UNION ALL
SELECT id, 'Coach Picks Near Low', 0.0200, 0.0000, false, NULL::timestamptz
FROM coach_picks_fixture_ids WHERE fixture = 'near_low'
UNION ALL
SELECT id, 'Coach Picks Far High', 2.0000, 0.0000, false, NULL::timestamptz
FROM coach_picks_fixture_ids WHERE fixture = 'far_high'
UNION ALL
SELECT id, 'Coach Picks Private High', 0.0050, 0.0000, true, NULL::timestamptz
FROM coach_picks_fixture_ids WHERE fixture = 'private_high'
UNION ALL
SELECT id, 'Coach Picks Deleted High', 0.0070, 0.0000, false, now()
FROM coach_picks_fixture_ids WHERE fixture = 'deleted_high';

INSERT INTO public.beach_daily_intel (
  beach_id,
  generated_at,
  generation_time,
  forecast_date,
  confidence,
  conditions_score
)
SELECT id, now() - interval '2 hours', '06:00', current_date, 'High', 90
FROM coach_picks_fixture_ids WHERE fixture = 'near_high'
UNION ALL
SELECT id, now() - interval '3 hours', '06:00', current_date, 'High', 95
FROM coach_picks_fixture_ids WHERE fixture = 'near_low'
UNION ALL
SELECT id, now() - interval '1 hour', '14:00', current_date, 'High', 30
FROM coach_picks_fixture_ids WHERE fixture = 'near_low'
UNION ALL
SELECT id, now(), '06:00', current_date, 'High', 100
FROM coach_picks_fixture_ids WHERE fixture = 'far_high'
UNION ALL
SELECT id, now(), '06:00', current_date, 'High', 100
FROM coach_picks_fixture_ids WHERE fixture = 'private_high'
UNION ALL
SELECT id, now(), '06:00', current_date, 'High', 100
FROM coach_picks_fixture_ids WHERE fixture = 'deleted_high';

CREATE TEMP TABLE coach_picks_actual ON COMMIT DROP AS
SELECT *
FROM public.get_coach_picks(
  (SELECT id FROM coach_picks_fixture_ids WHERE fixture = 'origin'),
  80
);

GRANT SELECT ON coach_picks_fixture_ids TO anon;
SET LOCAL ROLE anon;
CREATE TEMP TABLE coach_picks_anon_actual ON COMMIT DROP AS
SELECT *
FROM public.get_coach_picks(
  (SELECT id FROM coach_picks_fixture_ids WHERE fixture = 'origin'),
  80
);
RESET ROLE;

DO $fixture$
DECLARE
  v_near_high uuid := (
    SELECT id FROM coach_picks_fixture_ids WHERE fixture = 'near_high'
  );
  v_near_low uuid := (
    SELECT id FROM coach_picks_fixture_ids WHERE fixture = 'near_low'
  );
BEGIN
  IF (SELECT count(*) FROM coach_picks_actual) <> 2 THEN
    RAISE EXCEPTION 'coach_picks_fixture_unexpected_row_count';
  END IF;

  IF (SELECT count(*) FROM coach_picks_anon_actual) <> 2 THEN
    RAISE EXCEPTION 'coach_picks_fixture_anon_contract_failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM coach_picks_actual
    WHERE pick_rank = 1 AND beach_id = v_near_high AND score = 90
  ) THEN
    RAISE EXCEPTION 'coach_picks_fixture_high_score_not_ranked_first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM coach_picks_actual
    WHERE pick_rank = 2 AND beach_id = v_near_low AND score = 30
  ) THEN
    RAISE EXCEPTION 'coach_picks_fixture_latest_score_not_used';
  END IF;

  IF EXISTS (SELECT 1 FROM coach_picks_actual WHERE distance_km > 80) THEN
    RAISE EXCEPTION 'coach_picks_fixture_radius_not_strict';
  END IF;
END
$fixture$;

ROLLBACK;
