-- Migration: Add Crystal Pier and Ocean Beach Pier beaches
-- Date: 2025-11-16
-- Purpose: Fix 500 errors for surf highlights beaches that exist in production but not in dev

BEGIN;

-- Add Crystal Pier (Pacific Beach area in San Diego)
-- Crystal Pier is a famous pier in Pacific Beach, San Diego
INSERT INTO public.beaches (
  id,
  name,
  slug,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  crowd_level,
  description,
  swell_window_min_deg,
  swell_window_max_deg,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  best_months
) VALUES (
  gen_random_uuid(),
  'Crystal Pier',
  'crystal-pier',
  'San Diego',
  'CA',
  'USA',
  32.7992,  -- Crystal Pier coordinates
  -117.2564,
  'beach break',
  'beginner_to_intermediate',
  'crowded',
  '**Crystal Pier** in Pacific Beach offers a classic San Diego beach break with multiple peaks. The pier creates unique wave dynamics, with peaks forming on both sides. Best on west to northwest swells with offshore east winds.',
  200,  -- Swell window min
  320,  -- Swell window max
  260,  -- Swell window center (W-NW)
  60,   -- Swell window halfwidth
  1.5,  -- Preferred tide min
  4.5,  -- Preferred tide max
  '{9, 10, 11, 3, 4, 5}'  -- Best months: Fall and Spring
)
ON CONFLICT (id) DO NOTHING;

-- Add Ocean Beach Pier (Ocean Beach area in San Diego)
-- Ocean Beach Pier is one of the longest piers on the West Coast
INSERT INTO public.beaches (
  id,
  name,
  slug,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  crowd_level,
  description,
  swell_window_min_deg,
  swell_window_max_deg,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  best_months,
  features
) VALUES (
  gen_random_uuid(),
  'Ocean Beach Pier',
  'ocean-beach-pier',
  'San Diego',
  'CA',
  'USA',
  32.7493,  -- Ocean Beach Pier coordinates
  -117.2511,
  'beach break',
  'intermediate_to_advanced',
  'very_crowded',
  '**Ocean Beach Pier** is one of San Diego''s most iconic surf spots. The pier creates powerful peaks on both sides, with the north side typically offering cleaner conditions. Strong currents and variable sandbars make this spot more suitable for experienced surfers. Best on west to northwest swells with light offshore winds.',
  200,  -- Swell window min
  320,  -- Swell window max
  260,  -- Swell window center (W-NW)
  60,   -- Swell window halfwidth
  2.0,  -- Preferred tide min
  5.0,  -- Preferred tide max
  '{9, 10, 11, 12, 1, 2, 3, 4}',  -- Best months: Fall through Spring
  '{"pier"}'  -- Has a pier feature
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
