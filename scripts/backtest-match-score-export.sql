WITH eligible AS (
  SELECT s.*, f.forecast_snapshot
  FROM public.sessions s
  JOIN public.session_forecast_snapshots f ON f.session_id = s.id
  WHERE s.status = 'completed' AND s.rating IS NOT NULL
    AND s.deleted_at IS NULL AND s.arrival_time > now() - interval '12 months'
    AND f.forecast_snapshot IS NOT NULL
), cohort AS (
  SELECT user_id FROM eligible GROUP BY user_id HAVING count(*) >= 6
), selected AS (
  SELECT e.* FROM eligible e JOIN cohort c USING (user_id)
), session_rows AS (
  SELECT jsonb_build_object(
    'id', s.id, 'user_id', md5(s.user_id::text)::uuid,
    'beach_id', s.beach_id, 'board_id', s.board_id,
    'arrival_time', s.arrival_time, 'rating', s.rating,
    'session_skill_fit', s.session_skill_fit, 'session_board_fit', s.session_board_fit,
    'board_snapshot', jsonb_build_object(
      'board_type', CASE WHEN s.board_snapshot->>'board_type' IS NULL THEN NULL
        WHEN st.key = ANY (ARRAY['foamie','foam','foamboard','foam-board','soft','softboard','soft-board','softtop','soft-top','softtopboard','soft-top-board','longboard','long-board','log','longboard-single-fin','longboard-2-plus-1','midlength','mid-length','mini-mid','egg','funboard','fun-board','mini','minimal','mini-mal','mini-simmons','fish','twin','twin-pin','groveler','shortboard','short-board','thruster','step-up','stepup','gun','sup','standuppaddle','standuppaddleboard','stand-up-paddle','stand-up-paddleboard','paddleboard','paddle-board','foil','bodyboard','body-board','boogie','boogieboard','boogie-board']) THEN st.key
        ELSE 'type-' || substr(md5(s.board_snapshot->>'board_type'),1,16) END,
      'name', CASE WHEN s.board_snapshot->>'name' IS NULL THEN NULL
        WHEN sn.key = ANY (ARRAY['foamie','foam','foamboard','foam-board','soft','softboard','soft-board','softtop','soft-top','softtopboard','soft-top-board','longboard','long-board','log','longboard-single-fin','longboard-2-plus-1','midlength','mid-length','mini-mid','egg','funboard','fun-board','mini','minimal','mini-mal','mini-simmons','fish','twin','twin-pin','groveler','shortboard','short-board','thruster','step-up','stepup','gun','sup','standuppaddle','standuppaddleboard','stand-up-paddle','stand-up-paddleboard','paddleboard','paddle-board','foil','bodyboard','body-board','boogie','boogieboard','boogie-board']) THEN sn.key
        ELSE 'board-' || substr(md5(s.board_snapshot->>'name'),1,16) END
    ),
    'forecast_snapshot', jsonb_build_object(
      'wave_height', s.forecast_snapshot->>'wave_height',
      'wave_period', s.forecast_snapshot->>'wave_period',
      'wind_speed', s.forecast_snapshot->>'wind_speed',
      'wind_direction_deg', s.forecast_snapshot->>'wind_direction_deg',
      'tide_height', s.forecast_snapshot->>'tide_height',
      'tide_status', s.forecast_snapshot->>'tide_status'
    )
  ) AS value
  FROM selected s
  CROSS JOIN LATERAL (SELECT regexp_replace(lower(trim(s.board_snapshot->>'board_type')), '[[:space:]_]+', '-', 'g') AS key) st
  CROSS JOIN LATERAL (SELECT regexp_replace(lower(trim(s.board_snapshot->>'name')), '[[:space:]_]+', '-', 'g') AS key) sn
), beach_rows AS (
  SELECT jsonb_build_object('id', b.id, 'break_type', b.break_type,
    'wind_offshore_deg', b.wind_offshore_deg,
    'preferred_tide_ft_min', b.preferred_tide_ft_min,
    'preferred_tide_ft_max', b.preferred_tide_ft_max) AS value
  FROM public.beaches b WHERE b.id IN (SELECT beach_id FROM selected)
), board_rows AS (
  SELECT jsonb_build_object('id', b.id, 'board_type', CASE WHEN b.board_type IS NULL THEN NULL
      WHEN bt.key = ANY (ARRAY['foamie','foam','foamboard','foam-board','soft','softboard','soft-board','softtop','soft-top','softtopboard','soft-top-board','longboard','long-board','log','longboard-single-fin','longboard-2-plus-1','midlength','mid-length','mini-mid','egg','funboard','fun-board','mini','minimal','mini-mal','mini-simmons','fish','twin','twin-pin','groveler','shortboard','short-board','thruster','step-up','stepup','gun','sup','standuppaddle','standuppaddleboard','stand-up-paddle','stand-up-paddleboard','paddleboard','paddle-board','foil','bodyboard','body-board','boogie','boogieboard','boogie-board']) THEN bt.key
      ELSE 'type-' || substr(md5(b.board_type),1,16) END,
    'name', CASE WHEN b.name IS NULL THEN NULL
      WHEN bn.key = ANY (ARRAY['foamie','foam','foamboard','foam-board','soft','softboard','soft-board','softtop','soft-top','softtopboard','soft-top-board','longboard','long-board','log','longboard-single-fin','longboard-2-plus-1','midlength','mid-length','mini-mid','egg','funboard','fun-board','mini','minimal','mini-mal','mini-simmons','fish','twin','twin-pin','groveler','shortboard','short-board','thruster','step-up','stepup','gun','sup','standuppaddle','standuppaddleboard','stand-up-paddle','stand-up-paddleboard','paddleboard','paddle-board','foil','bodyboard','body-board','boogie','boogieboard','boogie-board']) THEN bn.key
      ELSE 'board-' || substr(md5(b.name),1,16) END,
    'dimensions', NULL) AS value
  FROM public.boards b
  CROSS JOIN LATERAL (SELECT regexp_replace(lower(trim(b.board_type)), '[[:space:]_]+', '-', 'g') AS key) bt
  CROSS JOIN LATERAL (SELECT regexp_replace(lower(trim(b.name)), '[[:space:]_]+', '-', 'g') AS key) bn
  WHERE b.id IN (SELECT board_id FROM selected)
), profile_rows AS (
  SELECT jsonb_build_object('id', md5(p.id::text)::uuid, 'experience_level', p.experience_level) AS value
  FROM public.profiles p JOIN cohort c ON c.user_id = p.id
)
SELECT jsonb_build_object(
  'cutoff', now(),
  'sessions', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM session_rows),
  'beaches', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM beach_rows),
  'boards', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM board_rows),
  'profiles', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM profile_rows)
);
