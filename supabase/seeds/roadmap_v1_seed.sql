-- supabase/seeds/roadmap_v1_seed.sql
--
-- v1 seed content for the roadmap. Idempotent — safe to replay.
-- Apply with: psql ... -f supabase/seeds/roadmap_v1_seed.sql
-- OR via the Supabase MCP execute_sql tool on prod.
--
-- This is a faithful snapshot of the live prod roadmap_items table. Because the
-- inserts use ON CONFLICT (title) DO NOTHING, replaying this only affects fresh
-- environments — it never mutates existing prod rows. Keep it in sync with prod
-- when roadmap items ship or change status.

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

-- SHIPPED (25) — newest first
INSERT INTO public.roadmap_items (title, description, category, status, shipped_at, founder_reply)
VALUES
  ('Week Scout — plan your week across spots',
   'Scout the whole week across all your spots at once. Day strip, best windows per break, confidence bands, and a one-tap share to send the call to your crew.',
   'forecasts', 'shipped', '2026-06-18T00:00:00Z',
   'Live — scout the whole week across your spots and share the call with your crew.'),
  ('Get the app — device-aware handoff',
   'The website now hands you straight to the app for your device — desktop shows a QR or sends a link to your phone, mobile opens the store.',
   'other', 'shipped', '2026-06-17T00:00:00Z', NULL),
  ('Water quality on every beach',
   'Clean / advisory / closed water-quality status now shows on beach pages.',
   'forecasts', 'shipped', '2026-06-15T00:00:00Z', NULL),
  ('Monterey, Big Sur & Puerto Rico spots',
   'New breaks across the Monterey Peninsula, Big Sur, and the San Juan metro.',
   'forecasts', 'shipped', '2026-06-14T00:00:00Z', NULL),
  ('Daily conditions email',
   'A brand-built morning email with your beaches'' call — rip risk, rideable waves, confidence, and the day''s window. Quiet-hours aware.',
   'notifications', 'shipped', '2026-06-13T00:00:00Z', NULL),
  ('Discipline-aware match scoring',
   'Longboarders score well on small long-period days; foilers on bumpy light-wind days. Your discipline should shape your match, not just your skill.',
   'forecasts', 'shipped', '2026-06-12T00:00:00Z',
   'Shipped — match scores now read your skill and your board, not a beginner default.'),
  ('Founder Lifetime Pro',
   'A one-time lifetime Pro option for early supporters — every Pro feature, forever, no subscription.',
   'subscription', 'shipped', '2026-06-11T00:00:00Z', NULL),
  ('Richer session logging',
   'Every session log now captures wave character, an automatic tide snapshot, and rip-current notes.',
   'logging', 'shipped', '2026-06-11T00:00:00Z', NULL),
  ('Premium surf map with live swell field',
   'An animated swell-field map: watch the swell advect across the coast, tap clusters to zoom, and drop custom spots right on the map.',
   'forecasts', 'shipped', '2026-06-09T00:00:00Z', NULL),
  ('Surf condition alerts',
   'Set a rule for the conditions you actually want and get pinged when a window lines up at your beach. Skip-the-flat-days built in.',
   'notifications', 'shipped', '2026-06-09T00:00:00Z',
   'Live — set a condition alert and we''ll ping you when your window lines up.'),
  ('Replace generated diorama loops with real surf media',
   'Users can read the looping generated dioramas as artificial. Prefer real beach photos, real surf clips, or approved user-submitted media for spot heroes instead of always-looping animated dioramas.',
   'other', 'shipped', '2026-06-06T00:00:00Z',
   'Done — beach heroes now use live Surfline cams and animated surf media instead of generated loops.'),
  ('Session photos',
   'Add photos to your logged sessions and share them. Uploads sync reliably and are moderated before they go public.',
   'logging', 'shipped', '2026-06-02T00:00:00Z', NULL),
  ('Surf windows timeline',
   'See the rideable windows for the day laid out on a timeline — when it turns on, when it backs off, and how confident we are.',
   'notifications', 'shipped', '2026-05-30T00:00:00Z', NULL),
  ('Apple Sign-In',
   'Sign in with Apple, including account linking so your existing Quiver profile carries over.',
   'other', 'shipped', '2026-05-25T00:00:00Z', NULL),
  ('Friends feed + invite deep links',
   'Segmented Friends / Nearby / Roadmap feed, working invite share-links, and the follow-you notifications surface.',
   'community', 'shipped', '2026-05-22T00:00:00Z',
   'Live — invite links now carry your crew connection through sign-up.'),
  ('Push notifications + deep links',
   'Real push notifications that open straight to the right beach, profile, or alert — follows, water-quality flags, and forecast windows included.',
   'notifications', 'shipped', '2026-05-10T00:00:00Z', NULL),
  ('Block & report accounts',
   'Block accounts and report content from any profile or session. Blocked users drop out of your feeds and reads automatically.',
   'community', 'shipped', '2026-05-01T00:00:00Z', NULL),
  ('Custom user-created spots',
   'Long-press the map or use the Add Spot button to save any break — secret reef, local wedge, anywhere. Sessions log to your custom spot.',
   'logging', 'shipped', '2026-04-24T00:00:00Z', NULL),
  ('Map-center placement mode for custom spots',
   'Drag the map to position the pin exactly where you want it. Optional when your GPS is off or you are not at the beach.',
   'logging', 'shipped', '2026-04-24T00:00:00Z', NULL),
  ('Pre-sunset hero dead zone fix',
   'The home hero no longer goes blank in the window before sunset on the same day.',
   'forecasts', 'shipped', '2026-04-23T00:00:00Z', NULL),
  ('Similarity redesign — preference peak + aversion penalty',
   'Match scoring now finds your sweet spot AND penalizes the conditions you actively avoid, not just a single weighted average.',
   'forecasts', 'shipped', '2026-04-21T00:00:00Z', NULL),
  ('ml_skipped signal in forecasts',
   'Per-row flag tells you whether a forecast value came from the ML model or the physical taper — transparency baked in.',
   'forecasts', 'shipped', '2026-04-20T00:00:00Z', NULL),
  ('Post-signup activation fixes',
   'Confirmation email + callback flow now work reliably — no more "confirmed but still logged out" loops.',
   'other', 'shipped', '2026-04-19T00:00:00Z', NULL),
  ('Native home hero discovery gate',
   'Home screen loader waits for discovery resolution before picking a hero — no more empty states mid-load.',
   'forecasts', 'shipped', '2026-04-17T00:00:00Z', NULL),
  ('Regime-aware model training + wave_direction fix',
   'Training now weights conditions by regime (swell vs. windswell vs. mix) and the wave_direction feature is fixed end-to-end.',
   'forecasts', 'shipped', '2026-04-15T00:00:00Z', NULL)
ON CONFLICT (title) DO NOTHING;

-- IN PROGRESS (2)
INSERT INTO public.roadmap_items (title, description, category, status, eta_label, founder_reply)
VALUES
  ('Beach Passport — a badge for every break',
   'Collect a vintage badge for every break you surf, and stamp it on the session cards you share with your crew.',
   'community', 'in_progress', 'Soon',
   'Art''s done and the plan''s written — vote it up to help me prioritize the build.'),
  ('More beaches with live cams & video',
   'Expanding rich visual coverage to more breaks — live Surfline cams and animated hero media, rolling out weekly.',
   'forecasts', 'in_progress', 'Rolling weekly',
   'We pivoted from generated diorama loops to live cams + animated hero media — same goal (rich visuals per break), more beaches, faster.')
ON CONFLICT (title) DO NOTHING;

-- UNDER CONSIDERATION (7)
INSERT INTO public.roadmap_items (title, description, category, status)
VALUES
  ('Apple Watch forecast glance',
   'Quick-check your favorite beaches from the wrist — complications, today''s call, tide curve. No session tracking in v1.',
   'forecasts', 'under_consideration'),
  ('Auto-log sessions from your watch',
   'Wave count, paddle distance, ride distance from the wrist. HealthKit''s Surfing workout is the fast path; full IMU wave detection is the ambitious version.',
   'logging', 'under_consideration'),
  ('Crew group chat',
   'A small space to coordinate with the 3–5 people you actually surf with. Not a public forum — just your people.',
   'community', 'under_consideration'),
  ('In-app explainers (period, tide, wind)',
   'Tap any stat on a forecast for a plain-English explanation. Built for first-day beginners who haven''t learned to read a swell map yet.',
   'forecasts', 'under_consideration'),
  ('International buoy coverage',
   'Close the Australia / UK / East Coast US buoy gaps so forecasts work outside the Pacific.',
   'forecasts', 'under_consideration'),
  ('Offline session save',
   'Log a session on spotty LTE and have it sync when you''re back in range. No lost sessions.',
   'logging', 'under_consideration'),
  ('Restore deleted sessions',
   'Undo an accidental delete. Sessions are already soft-deleted server-side; this exposes the button and a recent-deletions view.',
   'logging', 'under_consideration')
ON CONFLICT (title) DO NOTHING;

COMMIT;
