BEGIN;

-- Populate camera URLs for beaches missing live cam coverage.
-- Sources: HDOnTap (auto-converts to /embed/ via cam-embed.ts),
--          YouTube Live (auto-converts to embed via cam-embed.ts),
--          SurfOutlook (iframe fallback, already used for other beaches).
--
-- Note: YouTube live stream IDs (especially Explore.org) are generally stable
-- but may change if the stream is restarted. HDOnTap URLs are stable long-term.

INSERT INTO beach_sources (beach_id, camera_url)
SELECT b.id, urls.camera_url
FROM (VALUES
  -- === CALIFORNIA – SoCal (San Diego) ===
  ('pacific-beach',                          'https://hdontap.com/stream/186699/pacific-beach-live-surf-webcam/'),
  ('crystal-pier',                           'https://hdontap.com/stream/186699/pacific-beach-live-surf-webcam/'),
  ('hotel-del-coronado',                     'https://hdontap.com/stream/550159/hotel-del-coronado-4k-fixed-live-cam/'),
  ('coronado-north-jetty',                   'https://hdontap.com/stream/327869/hotel-del-coronado-north-roaming-live-cam/'),
  ('ocean-beach-pier',                       'https://www.youtube.com/watch?v=cvP_F-c2Upw'),
  ('torrey-pines-state-beach',               'https://hdontap.com/stream/399483/del-mar-beach-south-roaming-live-webcam/'),
  ('scripps',                                'https://hdontap.com/stream/449923/la-jolla-shores-overlook-live-webcam/'),

  -- === CALIFORNIA – SoCal (North County SD) ===
  ('del-mar',                                'https://hdontap.com/stream/399483/del-mar-beach-south-roaming-live-webcam/'),
  ('del-mar-rivermouth',                     'https://hdontap.com/stream/160362/del-mars-dog-beach-river-mouth-live-webcam/'),
  ('carlsbad-state-beach',                   'https://hdontap.com/stream/155380/carlsbad-beach-surf-live-webcam/'),
  ('terramar-point',                         'https://hdontap.com/stream/177276/terramar-point-surf-live-webcam/'),

  -- === CALIFORNIA – SoCal (Orange County / Dana Point) ===
  ('salt-creek',                             'https://hdontap.com/stream/621213/monarch-bay-beach-club-live-webcam/'),

  -- === CALIFORNIA – SoCal (LA / South Bay) ===
  ('manhattan-beach-pier-manhattan-beach-ca', 'https://hdontap.com/stream/126730/manhattan-beach-pier-ultra-hd-live-webcam/'),
  ('hermosa-beach-pier-hermosa-beach-ca',    'https://hdontap.com/stream/732858/hermosa-beach-pier-south-live-webcam/'),
  ('hermosa-beach-south-hermosa-beach-ca',   'https://hdontap.com/stream/417105/hermosa-beach-south-live-surf-cam/'),
  ('venice-beach-venice-ca',                 'https://hdontap.com/stream/322247/venice-beach-live-surf-cam/'),
  ('venice-breakwater-los-angeles-ca',       'https://hdontap.com/stream/322247/venice-beach-live-surf-cam/'),

  -- === CALIFORNIA – Malibu ===
  ('malibu-surfrider-first-point-malibu-ca', 'https://hdontap.com/stream/190972/malibu-point-live-surf-cam/'),
  ('malibu-second-point-malibu-ca',          'https://hdontap.com/stream/190972/malibu-point-live-surf-cam/'),
  ('malibu-third-point-malibu-ca',           'https://hdontap.com/stream/204757/malibu-pier-live-webcam/'),

  -- === CALIFORNIA – Central Coast / Big Sur ===
  ('carmel-river-state-beach-carmel-ca',     'https://hdontap.com/stream/269629/carmel-by-the-sea-live-webcam/'),

  -- === CALIFORNIA – Ventura / Santa Barbara ===
  ('c-street-ventura-ca',                    'https://www.surfoutlook.com/surfcam/ventura'),
  ('leadbetter-santa-barbara-ca',            'https://www.surfoutlook.com/surfcam/santa-barbara'),

  -- === CALIFORNIA – Santa Cruz ===
  ('steamer-lane-santa-cruz-ca',             'https://www.surfoutlook.com/surfcam/santacruz/steamer-lane'),
  ('pleasure-point-santa-cruz-ca',           'https://www.surfoutlook.com/surfcam/santacruz/pleasure-point'),
  ('capitola-capitola-ca',                   'https://www.surfoutlook.com/surfcam/santacruz/capitola'),

  -- === CALIFORNIA – Bay Area ===
  ('linda-mar-pacifica-ca',                  'https://www.youtube.com/watch?v=HR2kPpiYaWQ'),
  ('rockaway-beach-pacifica-ca',             'https://www.youtube.com/watch?v=P79O4t4r6dU'),
  ('ocean-beach-north-san-francisco-ca',     'https://www.surfoutlook.com/surfcam/sanfrancisco/ocean-beach'),
  ('ocean-beach-middle-san-francisco-ca',    'https://www.surfoutlook.com/surfcam/sanfrancisco/ocean-beach'),
  ('ocean-beach-sloat-san-francisco-ca',     'https://www.surfoutlook.com/surfcam/sanfrancisco/ocean-beach'),

  -- === HAWAII ===
  ('pipeline',                               'https://www.youtube.com/watch?v=VI8Wj5EwoRM'),
  ('waimea-bay',                             'https://www.youtube.com/watch?v=6ykvQrPUxwc'),
  ('ala-moana-bowls',                        'https://www.youtube.com/watch?v=zkKMuhqJKUo'),
  ('waikiki-canoes',                         'https://www.youtube.com/watch?v=yW0OOEO9usE'),
  ('waikiki-queens',                         'https://www.youtube.com/watch?v=yW0OOEO9usE'),

  -- === OREGON ===
  ('short-sands-manzanita-or',               'https://www.youtube.com/watch?v=S0NxfZOdG2Q'),

  -- === TEXAS ===
  ('south-padre-island-isla-blanca-park-south-padre-island-tx', 'https://www.youtube.com/watch?v=0Y9Du5nVWWA')
) AS urls(slug, camera_url)
JOIN beaches b ON b.slug = urls.slug
ON CONFLICT (beach_id) DO UPDATE SET camera_url = EXCLUDED.camera_url
WHERE beach_sources.camera_url IS NULL OR beach_sources.camera_url = '';

COMMIT;
