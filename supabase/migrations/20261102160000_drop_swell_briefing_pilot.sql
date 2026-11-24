-- Retire the swell briefing / Week Scout notes pilot storage.
-- Week Scout story (week_scout_story_editions) replaced both pilots; the last
-- notes edition was published 2026-10-30. The app code that read and wrote
-- these objects is removed in #1289, and the prod code still deployed reads
-- them only behind try/catch that falls back to no briefing.
-- No views, triggers, cron jobs or other functions reference them.

DROP FUNCTION IF EXISTS public.publish_swell_briefing_edition(
  text, uuid, text, date, text, timestamptz, timestamptz, text, text, jsonb, jsonb
);
DROP TABLE IF EXISTS public.swell_briefing_editions;
DROP TABLE IF EXISTS public.swell_briefing_inputs;
