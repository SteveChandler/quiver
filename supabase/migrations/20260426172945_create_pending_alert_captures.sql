-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- pending_alert_captures: holds anonymous alert captures between the form
-- POST and the magic-link callback that finalizes them.
--
-- finalize_anon_alert_capture: SECURITY DEFINER function called from
-- /auth/callback to atomically claim pending rows, insert alert_rules,
-- and set home_beach_id from the first capture. Atomicity is required
-- because /auth/callback has no transaction boundary in TS.
--
-- preset_default_conditions / preset_default_name: SQL helpers that mirror
-- lib/alerts/presets.ts buildConditions() output. Parity is enforced by
-- a Jest test (__tests__/lib/alerts/rpc-preset-parity.test.ts).
--
-- Spec: docs/archive/superpowers/specs/2026-04-25-alerts-engine-fix-and-anon-capture-design.md sections 5 + 6.

BEGIN;

CREATE TABLE pending_alert_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  beach_id uuid NOT NULL REFERENCES beaches(id),
  preset_type text NOT NULL,
  return_path text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '24 hours',
  consumed_at timestamptz,
  consumed_user_id uuid REFERENCES profiles(id),
  CHECK (email = lower(email)),
  CHECK (preset_type IN ('glass_off', 'big_day', 'mellow_session'))
);

CREATE INDEX pending_alert_captures_pending_lookup_idx
  ON pending_alert_captures (email, expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX pending_alert_captures_cleanup_idx
  ON pending_alert_captures (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE pending_alert_captures ENABLE ROW LEVEL SECURITY;
-- service_role only.

-- ---------------------------------------------------------------------------
-- Helper: preset_default_conditions(preset_type, beach_id) -> jsonb
-- ---------------------------------------------------------------------------
-- Mirrors lib/alerts/presets.ts buildConditions() in SQL. Keep in sync via
-- the rpc-preset-parity Jest test.
--
-- Output JSONB must be byte-equivalent to TS PRESETS[type].buildConditions(beach)
-- for the 3 anon-capture presets:
--   glass_off:      { wind_direction: "offshore", wind_speed_max_kt: 5, swell_height_min: 2 }
--   big_day:        { swell_height_min: 6, swell_period_min: 10 }
--   mellow_session: { swell_height_min: 1, swell_height_max: 4, wind_speed_max_kt: 8,
--                     tide_height_min_ft?, tide_height_max_ft? }   -- tide fields only when non-null on the beach

CREATE OR REPLACE FUNCTION preset_default_conditions(p_preset text, p_beach_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tide_min numeric;
  v_tide_max numeric;
  v_result jsonb;
BEGIN
  CASE p_preset
    WHEN 'glass_off' THEN
      RETURN jsonb_build_object(
        'wind_direction', 'offshore',
        'wind_speed_max_kt', 5,
        'swell_height_min', 2
      );
    WHEN 'big_day' THEN
      RETURN jsonb_build_object(
        'swell_height_min', 6,
        'swell_period_min', 10
      );
    WHEN 'mellow_session' THEN
      SELECT b.preferred_tide_ft_min, b.preferred_tide_ft_max
        INTO v_tide_min, v_tide_max
      FROM beaches b WHERE b.id = p_beach_id;
      v_result := jsonb_build_object(
        'swell_height_min', 1,
        'swell_height_max', 4,
        'wind_speed_max_kt', 8
      );
      IF v_tide_min IS NOT NULL THEN
        v_result := v_result || jsonb_build_object('tide_height_min_ft', v_tide_min);
      END IF;
      IF v_tide_max IS NOT NULL THEN
        v_result := v_result || jsonb_build_object('tide_height_max_ft', v_tide_max);
      END IF;
      RETURN v_result;
    ELSE
      RAISE EXCEPTION 'Unknown preset_type: %', p_preset;
  END CASE;
END;
$$;

-- Helper: preset_default_name(preset_type, beach_id) -> text
CREATE OR REPLACE FUNCTION preset_default_name(p_preset text, p_beach_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_beach_name text;
  v_label text;
BEGIN
  SELECT name INTO v_beach_name FROM beaches WHERE id = p_beach_id;
  v_label := CASE p_preset
    WHEN 'glass_off'       THEN 'Glassy mornings'
    WHEN 'big_day'         THEN 'Big swells'
    WHEN 'mellow_session'  THEN 'Beginner-friendly'
    ELSE p_preset
  END;
  RETURN v_label || ' — ' || COALESCE(v_beach_name, 'beach');
END;
$$;

-- ---------------------------------------------------------------------------
-- finalize_anon_alert_capture(p_user_id, p_email)
-- ---------------------------------------------------------------------------
-- Atomically:
--   1. Claims all unconsumed, unexpired pending_alert_captures rows for the email.
--   2. Inserts alert_rules for each (one per capture).
--   3. Sets profiles.home_beach_id to the first capture's beach (only if currently NULL).
--   4. Stamps profiles.signup_context.entrypoint = 'anon_alert_capture'.
-- Returns one row per materialized capture, ordered by captured_at ASC.

CREATE OR REPLACE FUNCTION finalize_anon_alert_capture(
  p_user_id uuid,
  p_email   text
)
RETURNS TABLE (
  capture_id   uuid,
  beach_id     uuid,
  preset_type  text,
  return_path  text,
  captured_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_beach_id uuid;
BEGIN
  -- 1. Atomic claim. UPDATE...RETURNING in a CTE so the SELECT can ORDER.
  CREATE TEMP TABLE claimed_captures ON COMMIT DROP AS
  WITH claimed AS (
    UPDATE pending_alert_captures
       SET consumed_at      = now(),
           consumed_user_id = p_user_id
     WHERE email       = lower(p_email)
       AND consumed_at IS NULL
       AND expires_at  > now()
    RETURNING id, beach_id, preset_type, return_path, captured_at
  )
  SELECT * FROM claimed;

  -- 2. Insert one alert_rules row per claimed capture.
  INSERT INTO alert_rules (user_id, beach_id, name, preset_type, conditions, notify_email, notify_push, enabled)
  SELECT
    p_user_id,
    c.beach_id,
    preset_default_name(c.preset_type, c.beach_id),
    c.preset_type,
    preset_default_conditions(c.preset_type, c.beach_id),
    true,
    false,
    true
  FROM claimed_captures c;

  -- 3 + 4. Update profile if there was at least one capture.
  SELECT beach_id INTO v_first_beach_id
  FROM claimed_captures
  ORDER BY captured_at ASC
  LIMIT 1;

  IF v_first_beach_id IS NOT NULL THEN
    UPDATE profiles
       SET home_beach_id  = COALESCE(home_beach_id, v_first_beach_id),
           signup_context = jsonb_set(
             COALESCE(signup_context, '{}'::jsonb),
             '{entrypoint}',
             '"anon_alert_capture"'::jsonb
           )
     WHERE id = p_user_id;
  END IF;

  -- Return the materialized captures ordered by captured_at ASC for the
  -- caller to use as redirect/event metadata.
  RETURN QUERY
    SELECT id, beach_id, preset_type, return_path, captured_at
    FROM claimed_captures
    ORDER BY captured_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION finalize_anon_alert_capture(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_anon_alert_capture(uuid, text) TO service_role;

COMMIT;
