-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Tune mellow_session preset: swell_height_min 1 -> 1.5
--
-- Keeps SQL preset_default_conditions() in lockstep with TS PRESETS.mellow_session
-- (lib/alerts/presets.ts). Parity is enforced by __tests__/lib/alerts/rpc-preset-parity.test.ts.
--
-- Rationale: 1ft floor was matching tiny-but-clean conditions and would have
-- produced low-value alerts. 1.5ft is the minimum height a beginner session
-- is actually rideable.

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
        'swell_height_min', 1.5,
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
