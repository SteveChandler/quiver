-- Swell story switches (lib/flags/swell-story.ts). Two rows in the existing
-- app_runtime_flags table, both OFF, so this migration changes nothing that a
-- user sees. swell_story_card sends the story sentence on the swell-events and
-- big-swells routes; swell_story_push uses it in the swell push. Each flip is a
-- production write and needs Steven's approval.
--
-- Additive only: no table, grant or function changes. A row that already
-- exists keeps its value.
--
-- Rollback: set enabled = false on either row (today's text in 60 seconds), or
-- DELETE FROM public.app_runtime_flags WHERE key IN ('swell_story_card', 'swell_story_push');
-- (a missing row reads as off).

BEGIN;

INSERT INTO public.app_runtime_flags (key, enabled, note)
VALUES
  (
    'swell_story_card',
    false,
    'Swell story sentence on the swell-events and big-swells routes (story / storySource). Production flips need Steven''s approval.'
  ),
  (
    'swell_story_push',
    false,
    'Swell story name, title and body in the swell push. Production flips need Steven''s approval.'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
