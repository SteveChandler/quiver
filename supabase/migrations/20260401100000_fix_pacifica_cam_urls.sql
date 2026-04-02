BEGIN;

-- @ChamberlinNature moved both Pacifica streams to new video IDs.
-- Old: HR2kPpiYaWQ ("Beach stream MOVED"), P79O4t4r6dU ("Mori stream MOVED")
-- New streams found via pacificaview.net/livecam/ embeds.

-- Linda Mar -> "Pacifica Pier and Beach, Pacifica CA 4k Live"
UPDATE beach_sources
SET camera_url = 'https://www.youtube.com/watch?v=Ge6yH7p5vw0',
    youtube_stream_title_hint = 'Pacifica Pier',
    youtube_last_resolved_at = NOW()
WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'linda-mar-pacifica-ca');

-- Rockaway Beach -> "Mori Point, Pacifica CA 4K Live"
UPDATE beach_sources
SET camera_url = 'https://www.youtube.com/watch?v=UYu-TjvAVFs',
    youtube_stream_title_hint = 'Mori Point',
    youtube_last_resolved_at = NOW()
WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'rockaway-beach-pacifica-ca');

COMMIT;
