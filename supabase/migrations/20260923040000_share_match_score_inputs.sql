-- One set-based scorer for single-slot, batch and Week Scout callers.
-- Deploy separately from the application. Rollback: restore the core and batch
-- wrappers from 20260811183000 / 20260504023658 before dropping the new scorer.
BEGIN;
CREATE OR REPLACE FUNCTION public.compute_user_match_scores(
  p_user_id uuid, p_beach_ids uuid[], p_slots jsonb
)
RETURNS TABLE(slot_idx integer, beach_id uuid, forecast_at text, result jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $scores$
WITH history AS MATERIALIZED (
  -- Board tips intentionally include old/deleted completed sessions: preserve
  -- the existing scorer's broader board-tip population, not just its profile.
  SELECT s.rating, s.arrival_time, s.session_skill_fit, s.session_board_fit,
    s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL AND sfs.forecast_snapshot IS NOT NULL AS eligible,
    b.break_type,
    COALESCE(s.board_id::text, s.board_snapshot->>'name', s.board_snapshot->>'board_type') AS board_key,
    COALESCE(s.board_snapshot->>'board_type', boards.board_type) AS board_type,
    COALESCE(s.board_snapshot->>'name', boards.name) AS board_name,
    boards.id AS tip_board_id, boards.name AS tip_name, boards.dimensions AS tip_dimensions,
    public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS wave,
    public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS period,
    public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind,
    public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_direction_deg') AS wind_dir,
    public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') AS tide,
    CASE s.session_skill_fit WHEN 'dialed' THEN 1.0 WHEN 'over_my_head' THEN -1.0
      WHEN 'under' THEN -0.5 ELSE 0 END
      + CASE s.session_board_fit WHEN 'right' THEN 0.5
        WHEN 'too_small' THEN -0.5 WHEN 'too_much_board' THEN -0.5
        WHEN 'wrong_type' THEN -0.5 ELSE 0 END AS fit_value
  FROM public.sessions s
  LEFT JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  LEFT JOIN public.beaches b ON b.id = s.beach_id
  LEFT JOIN public.boards boards ON boards.id = s.board_id
  WHERE s.user_id = p_user_id AND s.status = 'completed' AND s.rating IS NOT NULL
), chosen_board AS (
WITH board_usage AS (
    SELECT board_key, board_type, board_name AS name,
      COUNT(*)::integer AS use_count, MAX(arrival_time) AS last_used_at
    FROM history WHERE eligible AND rating >= 4
    GROUP BY board_key, board_type, board_name
  ),
  board_keys AS (
    SELECT
      board_key,
      use_count,
      last_used_at,
      0 AS source_priority,
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(COALESCE(board_type, ''))), '[[:space:]_]+', '-', 'g'),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ) AS key
    FROM board_usage
    WHERE board_type IS NOT NULL AND trim(board_type) <> ''

    UNION ALL

    SELECT
      board_key,
      use_count,
      last_used_at,
      1 AS source_priority,
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(COALESCE(name, ''))), '[[:space:]_]+', '-', 'g'),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ) AS key
    FROM board_usage
    WHERE name IS NOT NULL AND trim(name) <> ''
  ),
  board_classes AS (
    SELECT
      board_key,
      use_count,
      last_used_at,
      source_priority,
      CASE
        WHEN key IN ('foamie', 'foam', 'foamboard', 'foam-board', 'soft', 'softboard', 'soft-board', 'softtop', 'soft-top', 'softtopboard', 'soft-top-board')
          OR replace(key, '-', '') IN ('foamie', 'foam', 'foamboard', 'soft', 'softboard', 'softtop', 'softtopboard')
        THEN 'foamie'
        WHEN key IN ('longboard', 'long-board', 'log', 'longboard-single-fin', 'longboard-2-plus-1')
          OR replace(key, '-', '') IN ('longboard', 'longboard21')
        THEN 'longboard'
        WHEN key IN ('midlength', 'mid-length', 'mini-mid', 'egg')
          OR replace(key, '-', '') = 'midlength'
        THEN 'mid-length'
        WHEN key IN ('funboard', 'fun-board', 'mini', 'minimal', 'mini-mal', 'mini-simmons')
          OR replace(key, '-', '') IN ('funboard', 'minisimmons')
        THEN 'funboard'
        WHEN key IN ('fish', 'twin', 'twin-pin', 'groveler')
          OR replace(key, '-', '') = 'twinpin'
        THEN 'fish'
        WHEN key IN ('shortboard', 'short-board')
          OR replace(key, '-', '') = 'shortboard'
        THEN 'shortboard'
        WHEN key IN ('step-up', 'stepup')
          OR replace(key, '-', '') = 'stepup'
        THEN 'step-up'
        WHEN key = 'gun' THEN 'gun'
        WHEN key IN ('sup', 'standuppaddle', 'standuppaddleboard', 'stand-up-paddle', 'stand-up-paddleboard', 'paddleboard', 'paddle-board')
          OR replace(key, '-', '') IN ('sup', 'standuppaddle', 'standuppaddleboard', 'paddleboard')
        THEN 'sup'
        WHEN key = 'foil' THEN 'foil'
        WHEN key IN ('bodyboard', 'body-board', 'boogie', 'boogieboard', 'boogie-board')
          OR replace(key, '-', '') IN ('bodyboard', 'boogieboard')
        THEN 'bodyboard'
        ELSE NULL
      END AS board_class
    FROM board_keys
    WHERE key <> ''
  )
  SELECT board_class
  FROM board_classes
  WHERE board_class IS NOT NULL
  ORDER BY use_count DESC, last_used_at DESC NULLS LAST, source_priority ASC, board_key
  LIMIT 1

), global_inputs AS MATERIALIZED (
  SELECT (SELECT count(*)::integer FROM history WHERE eligible) AS session_count,
    (SELECT lower(trim(experience_level)) FROM public.profiles WHERE id = p_user_id) AS profile_skill,
    (SELECT board_class FROM chosen_board) AS board_class,
    cap.samples,
    CASE WHEN cap.ceiling IS NOT NULL THEN
      GREATEST(0.5, cap.ceiling * (1.0 + 0.15 * COALESCE(cap.fit_net, 0))) END AS ceiling
  FROM (
    SELECT percentile_cont(0.85) WITHIN GROUP (ORDER BY wave)::numeric AS ceiling,
      count(*)::integer AS samples,
      avg(CASE session_skill_fit WHEN 'dialed' THEN 1.0 WHEN 'under' THEN -0.5
        WHEN 'over_my_head' THEN -1.0 ELSE 0 END) AS fit_net
    FROM history WHERE eligible AND rating >= 4 AND wave IS NOT NULL
  ) cap
), skill AS MATERIALIZED (
  SELECT g.*,
    CASE WHEN session_count >= 5 AND samples >= 5 AND ceiling IS NOT NULL THEN
      CASE WHEN ceiling <= 3 THEN 'beginner' WHEN ceiling <= 5 THEN 'intermediate'
        WHEN ceiling <= 8 THEN 'advanced' ELSE 'expert' END
      WHEN profile_skill IN ('beginner','intermediate','advanced','expert') THEN profile_skill
      WHEN board_class IN ('foamie','longboard','sup','foil') THEN 'beginner'
      WHEN board_class IN ('step-up','gun') THEN 'advanced' ELSE 'intermediate' END AS skill_used,
    CASE WHEN session_count >= 5 AND samples >= 5 AND ceiling IS NOT NULL THEN 'session_derived'
      WHEN profile_skill IN ('beginner','intermediate','advanced','expert') THEN 'profile'
      WHEN board_class IS NOT NULL THEN 'board_prior' ELSE 'default' END AS skill_source
  FROM global_inputs g
), raw_slots AS MATERIALIZED (
  SELECT (ordinality - 1)::integer AS slot_idx, (value->>'beach_id')::uuid AS beach_id,
    value->>'forecast_at' AS forecast_at,
    jsonb_build_array(value->'wave_height',value->'wave_period',value->'wind_speed',
      value->'wind_direction',value->'tide_height') AS conditions
  FROM jsonb_array_elements(p_slots) WITH ORDINALITY
), conditions AS MATERIALIZED (
  -- Parse shared condition strings once, even across beaches and timestamps.
  SELECT conditions,
    public.parse_numeric_from_text(conditions->>0) AS f_wave,
    public.parse_numeric_from_text(conditions->>1) AS f_period,
    public.parse_numeric_from_text(conditions->>2) AS f_wind,
    public.parse_numeric_from_text(conditions->>3) AS f_wind_dir,
    public.parse_numeric_from_text(conditions->>4) AS f_tide
  FROM (SELECT DISTINCT conditions FROM raw_slots) c
), slots AS MATERIALIZED (
  SELECT s.slot_idx,s.beach_id,s.forecast_at,c.f_wave,c.f_period,c.f_wind,c.f_wind_dir,c.f_tide
  FROM raw_slots s JOIN conditions c USING (conditions)
), scenarios AS MATERIALIZED (
  -- Repeated conditions share a result; timestamps and duplicate slots survive.
  SELECT min(slot_idx) AS scenario_id, beach_id, f_wave, f_period, f_wind, f_wind_dir, f_tide
  FROM slots GROUP BY beach_id, f_wave, f_period, f_wind, f_wind_dir, f_tide
), requested_beaches AS MATERIALIZED (
  SELECT ids.id, b.break_type, b.wind_offshore_deg,
    (b.preferred_tide_ft_min + b.preferred_tide_ft_max) / 2.0 AS spot_tide
  FROM (SELECT DISTINCT unnest(p_beach_ids) AS id) ids
  LEFT JOIN public.beaches b ON b.id = ids.id
), peaks AS MATERIALIZED (
  SELECT t.break_type,
    sum(h.wave * (h.rating - 3)) FILTER (WHERE h.rating >= 4) /
      NULLIF(sum(h.rating - 3) FILTER (WHERE h.rating >= 4), 0) AS p_wave,
    sum(h.period * (h.rating - 3)) FILTER (WHERE h.rating >= 4) /
      NULLIF(sum(h.rating - 3) FILTER (WHERE h.rating >= 4), 0) AS p_period,
    sum(h.wind * (h.rating - 3)) FILTER (WHERE h.rating >= 4) /
      NULLIF(sum(h.rating - 3) FILTER (WHERE h.rating >= 4), 0) AS p_wind,
    sum(h.wind_dir * (h.rating - 3)) FILTER (WHERE h.rating >= 4) /
      NULLIF(sum(h.rating - 3) FILTER (WHERE h.rating >= 4), 0) AS p_wind_dir,
    sum(h.tide * (h.rating - 3)) FILTER (WHERE h.rating >= 4) /
      NULLIF(sum(h.rating - 3) FILTER (WHERE h.rating >= 4), 0) AS p_tide,
    count(*) FILTER (WHERE h.rating >= 4)::integer AS p_count,
    sum(h.wave * (3 - h.rating)) FILTER (WHERE h.rating <= 2) /
      NULLIF(sum(3 - h.rating) FILTER (WHERE h.rating <= 2), 0) AS a_wave,
    sum(h.period * (3 - h.rating)) FILTER (WHERE h.rating <= 2) /
      NULLIF(sum(3 - h.rating) FILTER (WHERE h.rating <= 2), 0) AS a_period,
    sum(h.wind * (3 - h.rating)) FILTER (WHERE h.rating <= 2) /
      NULLIF(sum(3 - h.rating) FILTER (WHERE h.rating <= 2), 0) AS a_wind,
    sum(h.wind_dir * (3 - h.rating)) FILTER (WHERE h.rating <= 2) /
      NULLIF(sum(3 - h.rating) FILTER (WHERE h.rating <= 2), 0) AS a_wind_dir,
    sum(h.tide * (3 - h.rating)) FILTER (WHERE h.rating <= 2) /
      NULLIF(sum(3 - h.rating) FILTER (WHERE h.rating <= 2), 0) AS a_tide,
    count(*) FILTER (WHERE h.rating <= 2)::integer AS a_count
  FROM (SELECT DISTINCT break_type FROM requested_beaches) t
  LEFT JOIN history h ON h.eligible
    AND (t.break_type IS NULL OR h.break_type = t.break_type OR h.break_type IS NULL)
  GROUP BY t.break_type
), inputs AS MATERIALIZED (
  SELECT s.*, b.break_type, b.wind_offshore_deg, b.spot_tide, g.*, p.p_wave, p.p_period,
    p.p_wind, p.p_wind_dir, p.p_tide, p.p_count, p.a_wave, p.a_period, p.a_wind,
    p.a_wind_dir, p.a_tide, p.a_count
  FROM scenarios s
  JOIN requested_beaches b ON b.id IS NOT DISTINCT FROM s.beach_id
  JOIN peaks p ON p.break_type IS NOT DISTINCT FROM b.break_type
  CROSS JOIN skill g
), fit_targets AS MATERIALIZED (
  SELECT row_number() OVER () AS target_id, t.* FROM (
    SELECT DISTINCT break_type, f_wave, f_period, f_wind, f_wind_dir, f_tide
    FROM inputs WHERE session_count >= 5 AND p_count > 0
  ) t
), fit_pairs AS MATERIALIZED (
  SELECT t.target_id, h.fit_value, 1.0 - LEAST(
      0.35 * LEAST(ABS(h.wave - t.f_wave) / GREATEST(h.wave, 1), 1) +
      0.25 * LEAST(ABS(h.period - t.f_period) / GREATEST(h.period, 1), 1) +
      0.20 * LEAST(ABS(h.wind - t.f_wind) / GREATEST(h.wind, 5), 1) +
      0.10 * LEAST(ABS(h.tide - t.f_tide) / 3, 1) +
      0.10 * LEAST(LEAST(ABS(h.wind_dir - t.f_wind_dir),
        360 - ABS(h.wind_dir - t.f_wind_dir)) / 180, 1), 1.0) AS proximity
  FROM fit_targets t JOIN history h ON h.eligible AND h.fit_value <> 0
    AND (h.session_skill_fit IS NOT NULL OR h.session_board_fit IS NOT NULL)
    AND (t.break_type IS NULL OR h.break_type = t.break_type OR h.break_type IS NULL)
  WHERE h.wave IS NOT NULL AND h.period IS NOT NULL AND h.wind IS NOT NULL
    AND h.wind_dir IS NOT NULL AND h.tide IS NOT NULL
), fit AS MATERIALIZED (
  SELECT target_id, count(*)::integer AS fit_count,
    count(*) FILTER (WHERE fit_value > 0)::integer AS fit_positive,
    count(*) FILTER (WHERE fit_value < 0)::integer AS fit_negative,
    GREATEST(-1.0, LEAST(1.0, COALESCE(sum(fit_value * proximity) /
      NULLIF(sum(proximity), 0), 0))) AS fit_adjustment
  FROM fit_pairs WHERE proximity > 0.15 GROUP BY target_id
), tips AS MATERIALIZED (
  SELECT DISTINCT ON (w.f_wave) w.f_wave,
    CASE WHEN h.tip_dimensions IS NOT NULL AND h.tip_dimensions <> ''
      THEN h.tip_name || ' ' || h.tip_dimensions ELSE h.tip_name END AS board_tip
  FROM (SELECT DISTINCT f_wave FROM scenarios) w
  JOIN history h ON h.rating >= 4 AND h.tip_board_id IS NOT NULL AND abs(h.wave - w.f_wave) < 1.5
  GROUP BY w.f_wave, h.tip_board_id, h.tip_name, h.tip_dimensions
  -- Equal-count tips had unspecified ordering in the legacy implementation.
  ORDER BY w.f_wave, count(*) DESC, h.tip_board_id
), priors AS MATERIALIZED (
  SELECT i.*,
    CASE skill_used WHEN 'beginner' THEN 2.0 WHEN 'advanced' THEN 5.5
      WHEN 'expert' THEN 8.0 ELSE 3.5 END AS skill_wave,
    session_count::numeric / (session_count::numeric + 5.0) AS blend,
    CASE skill_used WHEN 'intermediate' THEN 2.0 WHEN 'advanced' THEN 3.0 WHEN 'expert' THEN 4.0 ELSE 1.0 END AS ideal_min,
    CASE skill_used WHEN 'intermediate' THEN 5.0 WHEN 'advanced' THEN 8.0 WHEN 'expert' THEN 12.0 ELSE 3.0 END AS ideal_max,
    CASE skill_used WHEN 'intermediate' THEN 1.0 WHEN 'advanced' THEN 2.0 WHEN 'expert' THEN 2.0 ELSE 0.5 END AS accept_min,
    CASE skill_used WHEN 'intermediate' THEN 6.0 WHEN 'advanced' THEN 12.0 WHEN 'expert' THEN 20.0 ELSE 4.0 END AS accept_max,
    CASE board_class WHEN 'foamie' THEN 0.5 WHEN 'longboard' THEN 0.5 WHEN 'mid-length' THEN 0.7
      WHEN 'funboard' THEN 0.6 WHEN 'fish' THEN 0.85 WHEN 'shortboard' THEN 1.15 WHEN 'step-up' THEN 1.4
      WHEN 'gun' THEN 1.6 WHEN 'sup' THEN 0.4 WHEN 'foil' THEN 0.2 WHEN 'bodyboard' THEN 1.0 END AS shape_lo,
    CASE board_class WHEN 'foamie' THEN 0.6 WHEN 'longboard' THEN 0.7 WHEN 'mid-length' THEN 0.85
      WHEN 'funboard' THEN 0.8 WHEN 'fish' THEN 0.95 WHEN 'shortboard' THEN 1.05 WHEN 'step-up' THEN 1.15
      WHEN 'gun' THEN 1.2 WHEN 'sup' THEN 0.6 WHEN 'foil' THEN 0.5 WHEN 'bodyboard' THEN 1.0 END AS shape_hi
  FROM inputs i
), bands AS MATERIALIZED (
  SELECT p.*,
    CASE WHEN p_count > 0 AND p_wave IS NOT NULL THEN blend * p_wave + (1.0-blend) * skill_wave ELSE skill_wave END AS prior_wave,
    CASE WHEN p_count > 0 AND p_wind_dir IS NOT NULL AND wind_offshore_deg IS NOT NULL THEN
      mod(blend * (p_wind_dir + CASE WHEN abs(p_wind_dir - wind_offshore_deg) > 180 AND p_wind_dir <= wind_offshore_deg THEN 360 ELSE 0 END)
        + (1.0-blend) * (wind_offshore_deg + CASE WHEN abs(p_wind_dir - wind_offshore_deg) > 180 AND p_wind_dir > wind_offshore_deg THEN 360 ELSE 0 END), 360)
      ELSE wind_offshore_deg END AS prior_wind,
    CASE WHEN p_count > 0 AND p_tide IS NOT NULL AND spot_tide IS NOT NULL THEN blend * p_tide + (1.0-blend) * spot_tide ELSE spot_tide END AS prior_tide,
    CASE WHEN board_class IS NOT NULL THEN greatest(0.3, round(ideal_min * shape_lo, 1)) END AS board_ideal_min,
    CASE WHEN board_class IS NOT NULL THEN greatest(0.3, round(accept_min * shape_lo, 1)) END AS board_accept_min
  FROM priors p
), distances AS MATERIALIZED (
  SELECT b.*,
    CASE WHEN board_class IS NOT NULL THEN greatest(board_ideal_min + 0.5, round(ideal_max * shape_hi, 1)) END AS board_ideal_max,
    CASE WHEN board_class IS NOT NULL THEN greatest(board_accept_min + 0.5, round(accept_max * shape_hi, 1)) END AS board_accept_max,
    (1.0 - LEAST(
      0.35 * LEAST(ABS(p_wave - f_wave) / GREATEST(p_wave, 1), 1) +
      0.25 * LEAST(ABS(p_period - f_period) / GREATEST(p_period, 1), 1) +
      0.20 * LEAST(ABS(p_wind - f_wind) / GREATEST(p_wind, 5), 1) +
      0.10 * LEAST(ABS(p_tide - f_tide) / 3, 1) +
      0.10 * LEAST(LEAST(ABS(p_wind_dir - f_wind_dir),
        360 - ABS(p_wind_dir - f_wind_dir)) / 180, 1), 1.0)) * 10.0 AS base_score,
    CASE WHEN a_count > 0 THEN (1.0 - LEAST(
      0.35 * LEAST(ABS(a_wave - f_wave) / GREATEST(a_wave, 1), 1) +
      0.25 * LEAST(ABS(a_period - f_period) / GREATEST(a_period, 1), 1) +
      0.20 * LEAST(ABS(a_wind - f_wind) / GREATEST(a_wind, 5), 1) +
      0.10 * LEAST(ABS(a_tide - f_tide) / 3, 1) +
      0.10 * LEAST(LEAST(ABS(a_wind_dir - f_wind_dir),
        360 - ABS(a_wind_dir - f_wind_dir)) / 180, 1), 1.0)) * 3.0 ELSE 0 END AS aversion_penalty,
    greatest(0, least(10, (1.0 - least((
      0.35 * least(abs(prior_wave - coalesce(f_wave, prior_wave)) / greatest(prior_wave, 1), 1)
      + CASE WHEN prior_wind IS NOT NULL AND f_wind_dir IS NOT NULL THEN
        0.10 * least(least(abs(prior_wind - f_wind_dir), 360-abs(prior_wind-f_wind_dir))/180, 1) ELSE 0 END
      + CASE WHEN prior_tide IS NOT NULL AND f_tide IS NOT NULL THEN
        0.10 * least(abs(prior_tide-f_tide)/3, 1) ELSE 0 END
    ) / (0.35 + CASE WHEN prior_wind IS NOT NULL AND f_wind_dir IS NOT NULL THEN 0.10 ELSE 0 END
      + CASE WHEN prior_tide IS NOT NULL AND f_tide IS NOT NULL THEN 0.10 ELSE 0 END), 1.0)) * 10.0)) AS prior_score,
    prior_wind IS NOT NULL AND f_wind_dir IS NOT NULL AS has_wind,
    prior_tide IS NOT NULL AND f_tide IS NOT NULL AS has_tide
  FROM bands b
), adjustments AS MATERIALIZED (
  SELECT d.*, coalesce(f.fit_count, 0) AS fit_count, coalesce(f.fit_positive, 0) AS fit_positive,
    coalesce(f.fit_negative, 0) AS fit_negative, coalesce(f.fit_adjustment, 0) AS fit_adjustment,
    tips.board_tip,
    CASE WHEN d.f_wave BETWEEN board_ideal_min AND board_ideal_max THEN 0.5
      WHEN d.f_wave < board_accept_min THEN -least(1.0, greatest(0.5, round((board_accept_min-d.f_wave)*0.5, 2)))
      WHEN d.f_wave > board_accept_max THEN -least(1.0, greatest(0.5, round((d.f_wave-board_accept_max)*0.5, 2)))
      ELSE 0 END AS board_adjustment
  FROM distances d
  LEFT JOIN fit_targets t ON t.break_type IS NOT DISTINCT FROM d.break_type
    AND (t.f_wave,t.f_period,t.f_wind,t.f_wind_dir,t.f_tide) = (d.f_wave,d.f_period,d.f_wind,d.f_wind_dir,d.f_tide)
  LEFT JOIN fit f USING (target_id)
  LEFT JOIN tips ON tips.f_wave = d.f_wave
), scored AS MATERIALIZED (
  SELECT a.*, greatest(0, least(10, base_score-aversion_penalty+fit_adjustment+board_adjustment)) AS score
  FROM adjustments a
), results AS MATERIALIZED (
  SELECT s.scenario_id, CASE
    WHEN session_count < 5 THEN jsonb_build_object(
      'state','starter', 'score',round(prior_score,1), 'session_count',session_count,
      'sessions_needed',5-session_count,
      'fit_label',CASE WHEN has_wind OR has_tide THEN 'Based on your skill + this spot' ELSE 'Based on your skill level' END,
      'body','A starter read from your skill' || CASE WHEN has_wind OR has_tide THEN ' and this spot''s setup' ELSE '' END || '. It gets more personal as you rate sessions.',
      'quality_band','starter',
      'prior_dimensions',jsonb_build_array('skill_wave') || CASE WHEN has_wind THEN '["spot_wind_direction"]'::jsonb ELSE '[]'::jsonb END
        || CASE WHEN has_tide THEN '["spot_tide"]'::jsonb ELSE '[]'::jsonb END,
      'skill_used',skill_used,'skill_source',skill_source,'board_class',board_class)
    WHEN p_count = 0 AND a_count = 0 THEN jsonb_build_object(
      'state','avoidance_learned','score',NULL,'fit_label','Need a few more ratings',
      'reason_bullets',jsonb_build_array('We know what you tend to avoid. Rate a few good sessions to sharpen your match.'),
      'board_tip',NULL,'sessions_in_profile',session_count,'profile_kind','neutral','quality_band','mixed_signal')
    WHEN p_count = 0 THEN jsonb_build_object(
      'state','avoidance_learned','session_count',session_count,'sessions_needed',0,
      'fit_label','Need a few more ratings',
      'reason_bullets',jsonb_build_array('We know what you tend to avoid. Rate a few good sessions to sharpen your match.'),
      'score',NULL,'quality_band','mixed_signal','reason','no_positive_sessions')
    ELSE jsonb_build_object(
      'state','learned','score',round(score,1),
      'label',CASE WHEN score >= 8.5 THEN 'EPIC' WHEN score >= 7 THEN 'GOOD' WHEN score >= 5.5 THEN 'FAIR' WHEN score >= 3.5 THEN 'RIDEABLE' ELSE 'MEH' END,
      'reason_bullets',jsonb_build_array(
        format('Wave height %s ft — profile peak %s ft',round(f_wave,1),round(p_wave,1)),
        format('Period %s s — profile peak %s s',round(f_period,0),round(p_period,0)),
        format('Wind %s mph — profile peak %s mph',round(f_wind,0),round(p_wind,0)))
        || CASE WHEN fit_count > 0 THEN jsonb_build_array(CASE WHEN fit_adjustment > 0.15 THEN 'Your session fit feedback lifts this window.'
          WHEN fit_adjustment < -0.15 THEN 'Similar sessions were flagged as a skill or board mismatch.'
          ELSE 'Your session fit feedback is neutral for this window.' END) ELSE '[]'::jsonb END
        || CASE WHEN board_class IS NOT NULL AND abs(board_adjustment) >= 0.15 THEN jsonb_build_array(
          CASE WHEN board_adjustment > 0 THEN format('Your %s band fits this wave height.',board_class)
          ELSE format('This wave height is outside your usual %s band.',board_class) END) ELSE '[]'::jsonb END,
      'board_tip',board_tip,
      'confidence',CASE WHEN session_count >= 25 THEN 'high' WHEN session_count >= 10 THEN 'medium' ELSE 'low' END,
      'sessions_in_profile',session_count,'profile_kind',CASE WHEN a_count > 0 THEN 'two_sided' ELSE 'preference_only' END,
      'quality_band',CASE WHEN session_count >= 15 THEN 'dense_signal' ELSE 'session_backed' END,
      'base_score',round(base_score,2),'aversion_penalty',round(aversion_penalty,2),'aversion_sample_count',a_count,
      'fit_signal_adjustment',round(fit_adjustment,2),'fit_signal_sample_count',fit_count,
      'fit_signal_positive_count',fit_positive,'fit_signal_negative_count',fit_negative,
      'skill_used',skill_used,'skill_source',skill_source,'board_class',board_class,
      'board_band_adjustment',round(board_adjustment,2),'board_ideal_wave_min_ft',board_ideal_min,'board_ideal_wave_max_ft',board_ideal_max)
    END AS result
  FROM scored s
)
SELECT s.slot_idx, s.beach_id, s.forecast_at, r.result
FROM slots s JOIN scenarios c ON c.beach_id IS NOT DISTINCT FROM s.beach_id
  AND (c.f_wave,c.f_period,c.f_wind,c.f_wind_dir,c.f_tide) = (s.f_wave,s.f_period,s.f_wind,s.f_wind_dir,s.f_tide)
JOIN results r USING (scenario_id)
ORDER BY s.slot_idx;
$scores$;

CREATE OR REPLACE FUNCTION public.compute_user_match_score_core(
  p_user_id uuid, p_beach_id uuid, p_wave_height text, p_wave_period text,
  p_wind_speed text, p_wind_direction text, p_tide_height text
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $core$
  SELECT result FROM public.compute_user_match_scores(p_user_id, ARRAY[p_beach_id],
    jsonb_build_array(jsonb_build_object('beach_id',p_beach_id,'wave_height',p_wave_height,
      'wave_period',p_wave_period,'wind_speed',p_wind_speed,
      'wind_direction',p_wind_direction,'tide_height',p_tide_height)));
$core$;

-- Preserve the existing public RPC authorization and locked-result contracts.
CREATE OR REPLACE FUNCTION public.user_match_access_result(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $access$
DECLARE
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_caller IS NULL OR p_user_id <> v_caller THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Personal match unlocks with your account',
        'reason_bullets', jsonb_build_array('Sign in with the matching account to use personal match.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'forbidden'
      );
    END IF;

    SELECT
      COALESCE(ue.is_pro, false) OR COALESCE(ue.is_trialing, false),
      COALESCE(ue.billing_issue, false),
      ue.expires_at
    INTO v_is_paid, v_billing_issue, v_expires_at
    FROM public.user_entitlements ue
    WHERE ue.user_id = p_user_id
    LIMIT 1;

    IF v_billing_issue THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Update payment to use personal match',
        'reason_bullets', jsonb_build_array('Your forecast is still here. Update your payment method to turn personal match back on.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'billing_issue'
      );
    END IF;

    IF NOT COALESCE(v_is_paid, false) OR (v_expires_at IS NOT NULL AND v_expires_at < now()) THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Personal match unlocks with Pro',
        'reason_bullets', jsonb_build_array('Forecasts stay free. Pro adds your fit, reasons, ranked windows, and personal alerts.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'free'
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$access$;

CREATE OR REPLACE FUNCTION public.compute_user_match_score(
  p_user_id uuid, p_beach_id uuid, p_wave_height text, p_wave_period text,
  p_wind_speed text, p_wind_direction text, p_tide_height text
)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $single$
  SELECT coalesce(public.user_match_access_result(p_user_id),
    public.compute_user_match_score_core(p_user_id,p_beach_id,p_wave_height,
      p_wave_period,p_wind_speed,p_wind_direction,p_tide_height));
$single$;

CREATE OR REPLACE FUNCTION public.compute_user_match_score_batch(p_user_id uuid, p_beach_id uuid, p_slots jsonb)
RETURNS TABLE(slot_idx integer, forecast_at timestamptz, result jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $batch$
DECLARE v_locked jsonb;
BEGIN
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'compute_user_match_score_batch: p_slots must be a jsonb array (got: %)', coalesce(jsonb_typeof(p_slots), '<null>');
  END IF;
  IF jsonb_array_length(p_slots) = 0 THEN RETURN; END IF;
  v_locked := public.user_match_access_result(p_user_id);
  IF v_locked IS NOT NULL THEN
    RETURN QUERY SELECT (ordinality-1)::integer, (value->>'forecast_at')::timestamptz, v_locked
      FROM jsonb_array_elements(p_slots) WITH ORDINALITY;
    RETURN;
  END IF;
  RETURN QUERY SELECT m.slot_idx, m.forecast_at::timestamptz, m.result
    FROM public.compute_user_match_scores(p_user_id, ARRAY[p_beach_id],
      (SELECT coalesce(jsonb_agg(jsonb_build_object('beach_id',p_beach_id,
        'forecast_at',value->>'forecast_at','wave_height',value->>'wave_height',
        'wave_period',value->>'wave_period','wind_speed',value->>'wind_speed',
        'wind_direction',value->>'wind_direction','tide_height',value->>'tide_height') ORDER BY ordinality), '[]'::jsonb)
        FROM jsonb_array_elements(p_slots) WITH ORDINALITY)) m;
END;
$batch$;

REVOKE ALL ON FUNCTION public.compute_user_match_scores(uuid,uuid[],jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_match_access_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_user_match_scores(uuid,uuid[],jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_match_access_result(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score_core(uuid,uuid,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.compute_user_match_score(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compute_user_match_score_batch(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score(uuid,uuid,text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score_batch(uuid,uuid,jsonb) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
