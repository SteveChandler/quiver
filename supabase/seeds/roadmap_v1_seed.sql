-- supabase/seeds/roadmap_v1_seed.sql
--
-- v1 seed content for the roadmap. Idempotent — safe to replay.
-- Apply with: psql ... -f supabase/seeds/roadmap_v1_seed.sql
-- OR via the Supabase MCP execute_sql tool on prod.

BEGIN;

-- Deduplicate on title — safe because titles are short unique-ish product
-- names at this scale. Use DO block for idempotent add-if-not-exists
-- because ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS in Postgres 15.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roadmap_items_title_unique'
  ) THEN
    ALTER TABLE public.roadmap_items
      ADD CONSTRAINT roadmap_items_title_unique UNIQUE (title);
  END IF;
END $$;

-- SHIPPED (8)
INSERT INTO public.roadmap_items (title, description, category, status, shipped_at)
VALUES
  ('Custom user-created spots',
   'Long-press the map or use the Add Spot button to save any break — secret reef, local wedge, anywhere. Sessions log to your custom spot.',
   'logging', 'shipped', '2026-04-24T00:00:00Z'),
  ('Map-center placement mode for custom spots',
   'Drag the map to position the pin exactly where you want it. Optional when your GPS is off or you are not at the beach.',
   'logging', 'shipped', '2026-04-24T00:00:00Z'),
  ('Pre-sunset hero dead zone fix',
   'The home hero no longer goes blank in the window before sunset on the same day.',
   'forecasts', 'shipped', '2026-04-23T00:00:00Z'),
  ('Similarity redesign — preference peak + aversion penalty',
   'Match scoring now finds your sweet spot AND penalizes the conditions you actively avoid, not just a single weighted average.',
   'forecasts', 'shipped', '2026-04-21T00:00:00Z'),
  ('ml_skipped signal in forecasts',
   'Per-row flag tells you whether a forecast value came from the ML model or the physical taper — transparency baked in.',
   'forecasts', 'shipped', '2026-04-20T00:00:00Z'),
  ('Post-signup activation fixes',
   'Confirmation email + callback flow now work reliably — no more "confirmed but still logged out" loops.',
   'other', 'shipped', '2026-04-19T00:00:00Z'),
  ('Native home hero discovery gate',
   'Home screen loader waits for discovery resolution before picking a hero — no more empty states mid-load.',
   'forecasts', 'shipped', '2026-04-17T00:00:00Z'),
  ('Regime-aware model training + wave_direction fix',
   'Training now weights conditions by regime (swell vs. windswell vs. mix) and the wave_direction feature is fixed end-to-end.',
   'forecasts', 'shipped', '2026-04-15T00:00:00Z')
ON CONFLICT (title) DO NOTHING;

-- IN PROGRESS (2)
INSERT INTO public.roadmap_items (title, description, category, status, eta_label)
VALUES
  ('More beaches with diorama videos',
   'Shipping ~10 new beach diorama videos per week.',
   'forecasts', 'in_progress', 'Rolling weekly'),
  ('Friends feed + invite deep links',
   'Segmented Friends / Nearby / Roadmap feed, working invite share-links, and the follow-you notifications surface.',
   'community', 'in_progress', 'This month')
ON CONFLICT (title) DO NOTHING;

-- UNDER CONSIDERATION (8)
INSERT INTO public.roadmap_items (title, description, category, status)
VALUES
  ('Auto-log sessions from your watch',
   'Wave count, paddle distance, ride distance from the wrist. HealthKit''s Surfing workout is the fast path; full IMU wave detection is the ambitious version.',
   'logging', 'under_consideration'),
  ('Apple Watch forecast glance',
   'Quick-check your favorite beaches from the wrist — complications, today''s call, tide curve. No session tracking in v1.',
   'forecasts', 'under_consideration'),
  ('Restore deleted sessions',
   'Undo an accidental delete. Sessions are already soft-deleted server-side; this exposes the button and a recent-deletions view.',
   'logging', 'under_consideration'),
  ('Offline session save',
   'Log a session on spotty LTE and have it sync when you''re back in range. No lost sessions.',
   'logging', 'under_consideration'),
  ('In-app explainers (period, tide, wind)',
   'Tap any stat on a forecast for a plain-English explanation. Built for first-day beginners who haven''t learned to read a swell map yet.',
   'forecasts', 'under_consideration'),
  ('Discipline-aware match scoring',
   'Longboarders score well on small long-period days; foilers on bumpy light-wind days. Your discipline should shape your match, not just your skill.',
   'forecasts', 'under_consideration'),
  ('International buoy coverage',
   'Close the Australia / UK / East Coast US buoy gaps so forecasts work outside the Pacific.',
   'forecasts', 'under_consideration'),
  ('Crew group chat',
   'A small space to coordinate with the 3–5 people you actually surf with. Not a public forum — just your people.',
   'community', 'under_consideration')
ON CONFLICT (title) DO NOTHING;

COMMIT;
