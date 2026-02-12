BEGIN;

-- Populate camera URLs for East Coast beaches.
-- Sources: YouTube Live, Surfchex HLS streams, HDOnTap.
--
-- Note: Surfchex HLS (.m3u8) streams render as "Open camera" fallback
-- since CamsSection doesn't have an inline HLS player yet.
-- YouTube and HDOnTap URLs embed directly as iframes.

INSERT INTO beach_sources (beach_id, camera_url)
SELECT b.id, urls.camera_url
FROM (VALUES
  -- === FLORIDA ===
  ('deerfield-beach-pier-deerfield-beach-fl',          'https://www.youtube.com/watch?v=EmulKlmaXrQ'),
  ('new-smyrna-beach-nsb-inlet-new-smyrna-beach-fl',   'https://www.youtube.com/watch?v=kB2PZC-ow68'),
  ('ponce-inlet-ponce-inlet-fl',                        'https://www.youtube.com/watch?v=3Z97TxN9qQ8'),
  ('jacksonville-beach-pier-jacksonville-beach-fl',     'https://www.youtube.com/watch?v=F0wIc9WYYyU'),

  -- === NORTH CAROLINA (Surfchex HLS) ===
  ('wrightsville-beach-wrightsville-beach-nc',          'https://streams.surfchex.com:8443/live/wb3.stream/playlist.m3u8'),
  ('nags-head-nags-head-nc',                            'https://streams.surfchex.com:8443/live/nh1.stream/playlist.m3u8'),
  ('s-turns-rodanthe-nc',                               'https://streams.surfchex.com:8443/live/rodanthe.stream/playlist.m3u8'),
  ('cape-hatteras-lighthouse-buxton-nc',                'https://streams.surfchex.com:8443/live/hatteras1.stream/playlist.m3u8'),

  -- === NEW JERSEY (Surfchex HLS) ===
  ('manasquan-inlet-manasquan-nj',                      'https://streams.surfchex.com:8443/live/squan.stream/playlist.m3u8'),

  -- === SOUTH CAROLINA (HLS) ===
  ('folly-beach-folly-beach-sc',                        'https://5a5f765a4fcc2.streamlock.net:1936/live/folly.stream/playlist.m3u8'),

  -- === MAINE (YouTube) ===
  ('higgins-beach-scarborough-me',                      'https://www.youtube.com/watch?v=Ae51VMpV6Z4'),
  ('scarborough-beach-scarborough-me',                  'https://www.youtube.com/watch?v=1X6oqGKHSZs'),
  ('ogunquit-beach-ogunquit-me',                        'https://www.youtube.com/watch?v=g77KkszFGgg'),

  -- === TEXAS (HDOnTap) ===
  ('port-aransas-horace-caldwell-pier-port-aransas-tx', 'https://hdontap.com/stream/259405/the-dunes-port-aransas-live-beach-cam/')
) AS urls(slug, camera_url)
JOIN beaches b ON b.slug = urls.slug
ON CONFLICT (beach_id) DO UPDATE SET camera_url = EXCLUDED.camera_url
WHERE beach_sources.camera_url IS NULL OR beach_sources.camera_url = '';

COMMIT;
