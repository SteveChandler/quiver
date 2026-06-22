ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_wave_size text,
  ADD COLUMN IF NOT EXISTS crowd_tolerance text,
  ADD COLUMN IF NOT EXISTS tide_comfort text,
  ADD COLUMN IF NOT EXISTS wind_comfort text,
  ADD COLUMN IF NOT EXISTS paywall_soft_prompt_shown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sound_effects_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_wave_size_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_wave_size_check
  CHECK (preferred_wave_size IS NULL OR preferred_wave_size IN
    ('knee_waist', 'waist_chest', 'chest_head', 'head_overhead', 'overhead_plus'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_crowd_tolerance_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_crowd_tolerance_check
  CHECK (crowd_tolerance IS NULL OR crowd_tolerance IN
    ('empty_only', 'mellow', 'social', 'crowd_ok'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tide_comfort_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tide_comfort_check
  CHECK (tide_comfort IS NULL OR tide_comfort IN ('low', 'medium', 'high'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_wind_comfort_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_wind_comfort_check
  CHECK (wind_comfort IS NULL OR wind_comfort IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.profiles.preferred_wave_size IS 'Surfer preferred wave-size bucket (learned-me calibration). Tokens: knee_waist|waist_chest|chest_head|head_overhead|overhead_plus.';
COMMENT ON COLUMN public.profiles.crowd_tolerance IS 'Crowd tolerance: empty_only|mellow|social|crowd_ok.';
COMMENT ON COLUMN public.profiles.tide_comfort IS 'Tide comfort level: low|medium|high.';
COMMENT ON COLUMN public.profiles.wind_comfort IS 'Wind comfort level: low|medium|high.';
COMMENT ON COLUMN public.profiles.paywall_soft_prompt_shown IS 'One-time soft paywall-prompt dedup flag (activation loop D1c).';
COMMENT ON COLUMN public.profiles.sound_effects_enabled IS 'In-app UI sound-effects toggle; off by default, silent-mode aware.';;
