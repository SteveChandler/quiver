BEGIN;

-- Add pg_cron jobs to trigger the bluesky-auto-post Edge Function on schedule.
-- The function is deployed with verify_jwt=false; apikey header routes through the API gateway.
-- Schedules are in UTC; see PT equivalents in comments.
-- NOTE: If the Supabase anon key is rotated, these jobs must be updated.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Remove any existing jobs first (idempotent)
    PERFORM cron.unschedule(jobname)
      FROM cron.job
      WHERE jobname IN (
        'bluesky-go-no',
        'bluesky-weekend-wave',
        'bluesky-longboard-sunday',
        'bluesky-dev-notes'
      );

    -- Daily "Go/No" post: 14:00 UTC = ~6 AM PST / 7 AM PDT
    PERFORM cron.schedule(
      'bluesky-go-no',
      '0 14 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://vawdnbbgawichorsjiwe.supabase.co/functions/v1/bluesky-auto-post',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Njg0NDQsImV4cCI6MjA2MjI0NDQ0NH0.m2VoGJUzuXJPXOvgXO_eWwEi-uPnRZi-izdrVm3YAtQ"}'::jsonb,
        body := '{"post_type": "go_no"}'::jsonb
      ) AS request_id;
      $cron$
    );

    -- "Weekend Wave Check": Friday 01:00 UTC = Thursday ~5 PM PST / 6 PM PDT
    PERFORM cron.schedule(
      'bluesky-weekend-wave',
      '0 1 * * 5',
      $cron$
      SELECT net.http_post(
        url := 'https://vawdnbbgawichorsjiwe.supabase.co/functions/v1/bluesky-auto-post',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Njg0NDQsImV4cCI6MjA2MjI0NDQ0NH0.m2VoGJUzuXJPXOvgXO_eWwEi-uPnRZi-izdrVm3YAtQ"}'::jsonb,
        body := '{"post_type": "weekend_wave"}'::jsonb
      ) AS request_id;
      $cron$
    );

    -- Sunday "Longboard Sunday": Sun 14:00 UTC = ~6 AM PST / 7 AM PDT
    PERFORM cron.schedule(
      'bluesky-longboard-sunday',
      '0 14 * * 0',
      $cron$
      SELECT net.http_post(
        url := 'https://vawdnbbgawichorsjiwe.supabase.co/functions/v1/bluesky-auto-post',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Njg0NDQsImV4cCI6MjA2MjI0NDQ0NH0.m2VoGJUzuXJPXOvgXO_eWwEi-uPnRZi-izdrVm3YAtQ"}'::jsonb,
        body := '{"post_type": "longboard_sunday"}'::jsonb
      ) AS request_id;
      $cron$
    );

    -- Daily "Dev Notes" check: 16:00 UTC = ~8 AM PST / 9 AM PDT
    PERFORM cron.schedule(
      'bluesky-dev-notes',
      '0 16 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://vawdnbbgawichorsjiwe.supabase.co/functions/v1/bluesky-auto-post',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Njg0NDQsImV4cCI6MjA2MjI0NDQ0NH0.m2VoGJUzuXJPXOvgXO_eWwEi-uPnRZi-izdrVm3YAtQ"}'::jsonb,
        body := '{"post_type": "dev_notes"}'::jsonb
      ) AS request_id;
      $cron$
    );

  END IF;
END $$;

COMMIT;
