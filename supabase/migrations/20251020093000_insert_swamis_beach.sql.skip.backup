-- Seed Swami's beach with full metadata for landing and recommendations

BEGIN;

-- Ensure required beach metadata columns exist (supports older databases)
DO $$
BEGIN
  IF to_regclass('public.beaches') IS NULL THEN
    RAISE EXCEPTION 'public.beaches table is required before seeding Swami''s.';
  END IF;

  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS region text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS country text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS lat double precision;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS lon double precision;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS break_type text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS hazards text[] DEFAULT '{}'::text[];
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS skill_level text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS shoreline_aspect_deg smallint;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS swell_window_min_deg smallint;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS swell_window_max_deg smallint;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wind_offshore_deg smallint;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wind_offshore_tol_deg smallint DEFAULT 30;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wind_cross_shore_ok_kt smallint DEFAULT 10;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wind_onshore_bad_kt smallint DEFAULT 8;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS preferred_tide_ft_min numeric;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS preferred_tide_ft_max numeric;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS preference_model jsonb;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS aspect_deg int;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS offshore_deg int;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS swell_window_center_deg int;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS swell_window_halfwidth_deg int;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS tide_min_ft numeric;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS tide_max_ft numeric;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wind_cross_ok_kts int DEFAULT 8;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wind_onshore_bad_kts int DEFAULT 10;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS region_id uuid;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}'::text[];
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS parking_tips text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS access_tips text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS wave_tips text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS crowd_tips text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS best_conditions_prose text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS warnings text[] DEFAULT '{}'::text[];
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS local_etiquette text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS crowd_level text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS real_takeaways text[] DEFAULT '{}'::text[];
  ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS best_months integer[] DEFAULT '{}'::integer[];

  BEGIN
    ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS coordinates geography(Point,4326);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Skipping coordinates column add: %', SQLERRM;
  END;
END;
$$;

INSERT INTO public.beaches (
  id,
  name,
  city,
  is_private,
  owner_id,
  created_at,
  state,
  country,
  lat,
  lon,
  break_type,
  hazards,
  skill_level,
  shoreline_aspect_deg,
  swell_window_min_deg,
  swell_window_max_deg,
  wind_offshore_deg,
  wind_offshore_tol_deg,
  wind_cross_shore_ok_kt,
  wind_onshore_bad_kt,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  preference_model,
  aspect_deg,
  offshore_deg,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  tide_min_ft,
  tide_max_ft,
  wind_cross_ok_kts,
  wind_onshore_bad_kts,
  region_id,
  features,
  parking_tips,
  access_tips,
  wave_tips,
  crowd_tips,
  best_conditions_prose,
  warnings,
  local_etiquette,
  crowd_level,
  description,
  real_takeaways,
  best_months
)
VALUES (
  'b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0',
  'Swami''s',
  'Encinitas',
  FALSE,
  NULL,
  '2025-10-20T11:00:00-07:00',
  'California',
  'United States',
  33.0350423,
  -117.291704,
  'Right point over reef/rock with adjacent reef/beach sections',
  ARRAY[
    'Shallow reef/rocks',
    'Bluff collapse zones',
    'Strong currents on bigger swells',
    'Crowds/localism',
    'Seasonal stingrays'
  ],
  'Intermediate to advanced (inside reforms can be easier on small days)',
  270,
  240,
  310,
  90,
  30,
  12,
  15,
  1.5,
  4.5,
  '{
    "aspect_deg": 270,
    "offshore_deg": 90,
    "swell_window_center_deg": 275,
    "swell_window_halfwidth_deg": 35,
    "tide_min_ft": 1.5,
    "tide_max_ft": 4.5,
    "wind_cross_ok_kts": 12,
    "wind_onshore_bad_kts": 15
  }'::jsonb,
  270,
  90,
  275,
  35,
  1.5,
  4.5,
  12,
  15,
  NULL,
  ARRAY[
    'Iconic right point',
    'Lifeguard coverage (City of Encinitas)',
    'Wooden staircase access',
    'Small bluff-top lot + Hwy 101 street parking',
    'Tide pools on lower tides',
    'Within Swami''s SMCA (MPA)'
  ],
  'Small lot at Swami''s Seaside Park often fills; overflow along Hwy 101 and nearby streets. Expect a stair descent to the beach.',
  'Enter from Swami''s Seaside Park; long wooden staircase down the bluff. Check tides - beach narrows at higher tides.',
  'Best on W-WNW groundswells with light E/NE offshore winds. Long, peeling rights with defined walls; works from waist-high to DOH+. Mid-tide is a sweet spot; watch the inside reef on lower tides.',
  'Extremely popular and can be tense on good winter swells. Follow etiquette, expect dense packs; consider off-peak hours or smaller days.',
  'WNW groundswell, light to moderate easterly/offshore winds, mid tide.',
  ARRAY[
    'Unstable coastal bluffs - heed closures',
    'Shallow rock/reef inside',
    'Seasonal stingrays - shuffle feet',
    'Heavy crowd dynamics'
  ],
  'Classic point-break rotation; do not drop in, communicate on the paddle-out, yield to the rider, and be respectful of locals.',
  'Very crowded when working',
  'World-famous Encinitas right point with a reef setup below Swami''s Seaside Park and Self-Realization Fellowship. Long, rippable walls in winter WNW swells; scenic bluff, stairs, small lot, tide pools on lower tides.',
  ARRAY[
    '🅿️ Small lot; plan for Hwy 101 street parking',
    '🪜 Long wooden stairs - pack light',
    '🌊 Shines on W-WNW groundswells, mid tide',
    '🪨 Shallow reef - mind the inside at lower tides',
    '👥 Packed lineup - strict etiquette'
  ],
  ARRAY[11, 12, 1, 2, 3, 4]
)
ON CONFLICT (id) DO UPDATE
SET
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  break_type = EXCLUDED.break_type,
  hazards = EXCLUDED.hazards,
  skill_level = EXCLUDED.skill_level,
  shoreline_aspect_deg = EXCLUDED.shoreline_aspect_deg,
  swell_window_min_deg = EXCLUDED.swell_window_min_deg,
  swell_window_max_deg = EXCLUDED.swell_window_max_deg,
  wind_offshore_deg = EXCLUDED.wind_offshore_deg,
  wind_offshore_tol_deg = EXCLUDED.wind_offshore_tol_deg,
  wind_cross_shore_ok_kt = EXCLUDED.wind_cross_shore_ok_kt,
  wind_onshore_bad_kt = EXCLUDED.wind_onshore_bad_kt,
  preferred_tide_ft_min = EXCLUDED.preferred_tide_ft_min,
  preferred_tide_ft_max = EXCLUDED.preferred_tide_ft_max,
  preference_model = EXCLUDED.preference_model,
  aspect_deg = EXCLUDED.aspect_deg,
  offshore_deg = EXCLUDED.offshore_deg,
  swell_window_center_deg = EXCLUDED.swell_window_center_deg,
  swell_window_halfwidth_deg = EXCLUDED.swell_window_halfwidth_deg,
  tide_min_ft = EXCLUDED.tide_min_ft,
  tide_max_ft = EXCLUDED.tide_max_ft,
  wind_cross_ok_kts = EXCLUDED.wind_cross_ok_kts,
  wind_onshore_bad_kts = EXCLUDED.wind_onshore_bad_kts,
  region_id = EXCLUDED.region_id,
  features = EXCLUDED.features,
  parking_tips = EXCLUDED.parking_tips,
  access_tips = EXCLUDED.access_tips,
  wave_tips = EXCLUDED.wave_tips,
  crowd_tips = EXCLUDED.crowd_tips,
  best_conditions_prose = EXCLUDED.best_conditions_prose,
  warnings = EXCLUDED.warnings,
  local_etiquette = EXCLUDED.local_etiquette,
  crowd_level = EXCLUDED.crowd_level,
  description = EXCLUDED.description,
  real_takeaways = EXCLUDED.real_takeaways,
  best_months = EXCLUDED.best_months;

COMMIT;
