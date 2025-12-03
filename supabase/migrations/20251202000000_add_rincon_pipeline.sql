-- Add Rincon and Pipeline beaches to the database
-- These are two of the world's most iconic surf breaks
-- Uses idempotent upsert pattern to safely handle re-runs

BEGIN;

-- Insert Rincon (California) - "Queen of the Coast"
INSERT INTO public.beaches (
  name,
  region,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  swell_window_min_deg,
  swell_window_max_deg,
  wind_offshore_deg,
  best_months,
  description
)
VALUES (
  'Rincon',
  'Carpinteria, CA',
  'USA',
  34.3722,
  -119.4511,
  'point',
  'intermediate-advanced',
  270,
  315,
  45,
  ARRAY[11, 12, 1, 2, 3],
  'Known as the "Queen of the Coast," Rincon is one of California''s most iconic surf spots. Located at the Ventura/Santa Barbara County line, this world-class right point break produces long, well-formed waves during winter swells. The break is divided into three sections: the Cove, Rivermouth, and Indicator, each offering unique surfing experiences. Best surfed at low tide with west to northwest swells.'
)
ON CONFLICT (lower(name)) DO UPDATE SET
  region = EXCLUDED.region,
  country = EXCLUDED.country,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  break_type = EXCLUDED.break_type,
  skill_level = EXCLUDED.skill_level,
  swell_window_min_deg = EXCLUDED.swell_window_min_deg,
  swell_window_max_deg = EXCLUDED.swell_window_max_deg,
  wind_offshore_deg = EXCLUDED.wind_offshore_deg,
  best_months = EXCLUDED.best_months,
  description = EXCLUDED.description;

-- Insert Pipeline (Hawaii) - Banzai Pipeline
INSERT INTO public.beaches (
  name,
  region,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  swell_window_min_deg,
  swell_window_max_deg,
  wind_offshore_deg,
  best_months,
  description
)
VALUES (
  'Pipeline',
  'North Shore, Oahu, HI',
  'USA',
  21.6644,
  -158.0517,
  'reef',
  'expert',
  315,
  30,
  180,
  ARRAY[11, 12, 1, 2, 3],
  'Home to the famous Banzai Pipeline, one of the world''s most powerful and dangerous waves. Located on Oahu''s North Shore at Ehukai Beach Park, Pipeline produces heavy, barreling lefts that break over a shallow reef. The wave also features "Backdoor" rights. Only expert surfers should attempt this break due to the dangerous conditions. Best during winter months with north to northwest swells.'
)
ON CONFLICT (lower(name)) DO UPDATE SET
  region = EXCLUDED.region,
  country = EXCLUDED.country,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  break_type = EXCLUDED.break_type,
  skill_level = EXCLUDED.skill_level,
  swell_window_min_deg = EXCLUDED.swell_window_min_deg,
  swell_window_max_deg = EXCLUDED.swell_window_max_deg,
  wind_offshore_deg = EXCLUDED.wind_offshore_deg,
  best_months = EXCLUDED.best_months,
  description = EXCLUDED.description;

COMMIT;

