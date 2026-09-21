-- Add the Hawaiian beaches surfaced by the "kua" search audit.
-- These rows are searchable catalog entries; recommendation/SEO promotion stays
-- disabled until live access, spot-level surf inputs, terrain, and media pass review.

BEGIN;

CREATE TEMP TABLE _hawaii_kua_beaches (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  hazards text[] NOT NULL,
  description text NOT NULL,
  access_tips text NOT NULL,
  sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _hawaii_kua_beaches VALUES
  ('945bb965-e088-50e9-b72f-f64c029734ea', 'Maniniʻōwali Beach (Kua Bay)', 'maniniowali-beach-kua-bay', 'Kailua-Kona', 'Big Island', 19.8076655, -156.0103709,
   ARRAY['dangerous rip currents','pounding shorebreak','no lifeguard'],
   'Maniniʻōwali, commonly called Kua Bay, is a white-sand beach in the Maniniʻōwali section of Kekaha Kai State Park.',
   'Check the current State Parks notice before travel. Remote access and ocean conditions can change; surf over three feet is for experts only.',
   '[{"url":"https://dlnr.hawaii.gov/dsp/parks/hawaii/kekaha-kai-kona-coast-state-park/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["identity","access","hazards","skill"]},{"url":"https://www.topozone.com/hawaii/hawaii-hi/beach/maniniowali-beach/","publisher":"TopoZone / USGS GNIS","retrievedAt":"2026-09-03","fields":["coordinates"]}]'),
  ('a8c5307b-65d6-57c9-899b-a9b2a7eb81d7', 'Makalawena Beach', 'makalawena-beach-hawaii', 'Kailua-Kona', 'Big Island', 19.7915293, -156.0282826,
   ARRAY[]::text[],
   'Makalawena is a remote North Kona beach between the Maniniʻōwali and Mahaiʻula sections of Kekaha Kai State Park.',
   'Access crosses a remote coastal area that includes privately owned land. Verify current legal routes and park notices before travel.',
   '[{"url":"https://dlnr.hawaii.gov/wp-content/uploads/2017/04/K-1.pdf","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["identity","land_status","access_context"]},{"url":"https://topoquest.com/place/hawaii/beach/makalawena-beach/1905510","publisher":"TopoQuest / USGS GNIS","retrievedAt":"2026-09-03","fields":["coordinates"]}]'),
  ('51f201a3-4975-5842-8025-492d1a0a559c', 'Mahaiʻula Bay (Mahaiula)', 'mahaiula-bay-hawaii', 'Kailua-Kona', 'Big Island', 19.782004, -156.037381,
   ARRAY[]::text[],
   'Mahaiʻula Bay is the southern beach section of Kekaha Kai State Park on the North Kona coast.',
   'Check current State Parks notices, road conditions, and posted ocean warnings before travel.',
   '[{"url":"https://dlnr.hawaii.gov/dsp/parks/hawaii/kekaha-kai-kona-coast-state-park/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["identity","access"]},{"url":"https://topoquest.com/place/hawaii/beach/makalawena-beach/1905510","publisher":"TopoQuest / USGS GNIS","retrievedAt":"2026-09-03","fields":["coordinates"]}]'),
  ('1358dcf1-59a1-5040-a4c9-a856026a72dc', 'Kualoa Regional Park Beach', 'kualoa-regional-park-beach', 'Kāneʻohe', 'Windward Oahu', 21.514211, -157.836136,
   ARRAY[]::text[],
   'Kualoa Regional Park Beach is the public shoreline at Kualoa on windward Oʻahu, also listed as Hokuleʻa Beach Park by the Hawaiʻi Film Office.',
   'Follow current City and County park notices and posted water-safety guidance.',
   '[{"url":"https://health.hawaii.gov/cwb/files/2013/06/SampleSite_Oahu208.pdf","publisher":"Hawaiʻi Department of Health","retrievedAt":"2026-09-03","fields":["identity","coordinates"]},{"url":"https://filmoffice.hawaii.gov/locations/openaccessible-sites/open-and-accessible-sites-oahu/","publisher":"Hawaiʻi Film Office","retrievedAt":"2026-09-03","fields":["identity","alias"]}]'),
  ('c3b12b5b-cba6-5ad7-be34-dc3fb410076f', 'Kaʻaʻawa Beach Park (Kaaawa)', 'kaaawa-beach-park', 'Kaʻaʻawa', 'Windward Oahu', 21.5498167, -157.84655,
   ARRAY[]::text[],
   'Kaʻaʻawa Beach Park is a windward Oʻahu shoreline access between Kualoa and Kahana Bay.',
   'Follow current county notices and posted water-safety guidance.',
   '[{"url":"https://health.hawaii.gov/cwb/files/2013/06/SampleSite_Oahu179.pdf","publisher":"Hawaiʻi Department of Health","retrievedAt":"2026-09-03","fields":["identity","coordinates"]}]'),
  ('a4b380d0-da3a-55b1-a873-b03effdcbe5c', 'Kahana Bay Beach', 'kahana-bay-beach-oahu', 'Kaʻaʻawa', 'Windward Oahu', 21.555917, -157.872694,
   ARRAY['frequent rain'],
   'Kahana Bay Beach is the bay shoreline within Ahupuaʻa ʻO Kahana State Park on windward Oʻahu.',
   'Check current State Parks, weather, stream, and ocean notices before travel.',
   '[{"url":"https://dlnr.hawaii.gov/dsp/parks/oahu/ahupuaa-o-kahana-state-park/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["identity","access","weather"]},{"url":"https://health.hawaii.gov/cwb/files/2013/06/SampleSite_Oahu230.pdf","publisher":"Hawaiʻi Department of Health","retrievedAt":"2026-09-03","fields":["identity","coordinates"]}]'),
  ('755b71d6-74d5-50f8-b44b-08154ce50401', 'Mākua Beach (Makua, Oʻahu)', 'makua-beach-oahu', 'Waiʻanae', 'West Oahu', 21.5299767, -158.2293892,
   ARRAY['remote coast','limited facilities'],
   'Mākua Beach is the remote west-facing beach south of Kaʻena Point on Oʻahu.',
   'Check current State Parks and emergency notices. Do not confuse this beach with Mākua, or Tunnels, on Kauaʻi.',
   '[{"url":"https://dlnr.hawaii.gov/dsp/parks/oahu/kaena-point-state-park/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["access_context","hazards"]},{"url":"https://www.topozone.com/hawaii/honolulu-hi/beach/makua-beach/","publisher":"TopoZone / USGS GNIS","retrievedAt":"2026-09-03","fields":["identity","coordinates"]}]'),
  ('323e6269-4e83-571b-8d2e-111851d53949', 'Keawaʻula Beach (Keawaula / Yokohama Bay)', 'keawaula-beach-yokohama-bay', 'Waiʻanae', 'West Oahu', 21.552819, -158.246375,
   ARRAY['powerful surf','rip currents','remote coast','extreme heat','no drinking water'],
   'Keawaʻula Beach, commonly called Yokohama Bay, is the western beach section of Kaʻena Point State Park.',
   'Check current State Parks notices. Swimming is appropriate only during calm conditions; surfing and bodyboarding are expert activities here.',
   '[{"url":"https://dlnr.hawaii.gov/dsp/parks/oahu/kaena-point-state-park/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["identity","alias","access","hazards","skill"]},{"url":"https://www.waterqualitydata.us/provider/STORET/21HI/21HI-000215/","publisher":"Water Quality Portal / Hawaiʻi DOH","retrievedAt":"2026-09-03","fields":["coordinates"]}]'),
  ('33905812-2c50-5c48-af2b-d71623a93bfc', 'Hāʻena Beach Park (Haena / Maniniholo)', 'haena-beach-park-kauai', 'Hanalei', 'Kauai', 22.220583, -159.566833,
   ARRAY['powerful shorebreak','rip currents','large winter surf'],
   'Hāʻena Beach Park is the beach at Maniniholo Bay on Kauaʻi’s north shore, east of Mākua/Tunnels.',
   'Check current county and ocean-safety notices. Winter and spring shorebreak and currents can be dangerous.',
   '[{"url":"https://www.waterqualitydata.us/provider/STORET/21HI/21HI-000803/","publisher":"Water Quality Portal / Hawaiʻi DOH","retrievedAt":"2026-09-03","fields":["identity","coordinates"]},{"url":"https://www.gohawaii.com/islands/kauai/things-to-do/beaches/haena-beach-park-kauai","publisher":"Hawaiʻi Tourism Authority","retrievedAt":"2026-09-03","fields":["identity","hazards"]},{"url":"https://dlnr.hawaii.gov/dar/regulated-areas/haena-community-based-subsistence-fishing-area/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["regulated_area"]}]'),
  ('e73e1aa8-7d90-5a3c-956f-5d64fc90cac1', 'Kēʻē Beach (Kee)', 'kee-beach-kauai', 'Hanalei', 'Kauai', 22.22149, -159.58294,
   ARRAY[]::text[],
   'Kēʻē Beach is the north-shore beach at the end of Kūhiō Highway within Hāʻena State Park.',
   'Nonresident entry and parking require advance reservations. Check current State Parks and ocean-safety notices before travel.',
   '[{"url":"https://dlnr.hawaii.gov/dsp/parks/kauai/haena-state-park/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["identity","access","reservations"]},{"url":"https://www.mindat.org/feature-5849129.html","publisher":"Mindat / USGS GNIS","retrievedAt":"2026-09-03","fields":["coordinates"]},{"url":"https://dlnr.hawaii.gov/dar/regulated-areas/haena-community-based-subsistence-fishing-area/","publisher":"Hawaiʻi DLNR","retrievedAt":"2026-09-03","fields":["regulated_area"]}]');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _hawaii_kua_beaches proposed
    JOIN public.beaches existing
      ON existing.id <> proposed.id
     AND (lower(existing.name) = lower(proposed.name) OR lower(existing.slug) = lower(proposed.slug))
  ) THEN
    RAISE EXCEPTION 'Hawaii beach import conflicts with an existing name or slug';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _hawaii_kua_beaches proposed
    JOIN public.beaches existing USING (id)
    WHERE lower(existing.name) <> lower(proposed.name)
       OR lower(existing.slug) <> lower(proposed.slug)
  ) THEN
    RAISE EXCEPTION 'Hawaii beach import UUID conflicts with another catalog row';
  END IF;
END $$;

INSERT INTO public.beaches (
  id, name, slug, city, state, country, region, timezone, lat, lon,
  break_type, hazards, description, access_tips, warnings, editorial_sources,
  editorial_reviewed_at, seo_indexable, recommendation_eligible, is_private
)
SELECT id, name, slug, city, 'HI', 'USA', region, 'Pacific/Honolulu', lat, lon,
  'beach', hazards, description, access_tips, hazards, sources,
  '2026-09-03T00:00:00Z'::timestamptz, false, false, false
FROM _hawaii_kua_beaches proposed
WHERE NOT EXISTS (SELECT 1 FROM public.beaches existing WHERE existing.id = proposed.id);

WITH photo_candidates (
  beach_id, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html
) AS (
  VALUES
    ('945bb965-e088-50e9-b72f-f64c029734ea'::uuid, 'File:Kua Bay white sand beach Big island Hawaii (44459910590).jpg', 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Kua_Bay_white_sand_beach_Big_island_Hawaii_%2844459910590%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Kua_Bay_white_sand_beach_Big_island_Hawaii_%2844459910590%29.jpg/1280px-Kua_Bay_white_sand_beach_Big_island_Hawaii_%2844459910590%29.jpg', 'Kua Bay white sand beach Big island Hawaii', 'dronepicr', 'https://www.flickr.com/people/132646954@N02', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/', 'Photo by dronepicr, licensed CC BY 2.0 via Wikimedia Commons.'),
    ('a8c5307b-65d6-57c9-899b-a9b2a7eb81d7'::uuid, 'File:Rule of Thirds at Makalawena Beach. (6462723289).jpg', 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Rule_of_Thirds_at_Makalawena_Beach._%286462723289%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Rule_of_Thirds_at_Makalawena_Beach._%286462723289%29.jpg/1280px-Rule_of_Thirds_at_Makalawena_Beach._%286462723289%29.jpg', 'Rule of Thirds at Makalawena Beach', 'Eli Duke', 'https://www.flickr.com/people/80547277@N00', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/', 'Photo by Eli Duke, licensed CC BY-SA 2.0 via Wikimedia Commons.'),
    ('51f201a3-4975-5842-8025-492d1a0a559c'::uuid, 'File:Mahaiula beach Big island Hawaii (45364014255).jpg', 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Mahaiula_beach_Big_island_Hawaii_%2845364014255%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Mahaiula_beach_Big_island_Hawaii_%2845364014255%29.jpg/1280px-Mahaiula_beach_Big_island_Hawaii_%2845364014255%29.jpg', 'Mahaiula beach Big island Hawaii', 'dronepicr', 'https://www.flickr.com/people/132646954@N02', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/', 'Photo by dronepicr, licensed CC BY 2.0 via Wikimedia Commons.'),
    ('1358dcf1-59a1-5040-a4c9-a856026a72dc'::uuid, 'File:Beach at Kualoa Regional Park (16974457032).jpg', 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Beach_at_Kualoa_Regional_Park_%2816974457032%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Beach_at_Kualoa_Regional_Park_%2816974457032%29.jpg/1280px-Beach_at_Kualoa_Regional_Park_%2816974457032%29.jpg', 'Beach at Kualoa Regional Park', 'Daniel Ramirez', 'https://www.flickr.com/people/danramarch/', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/', 'Photo by Daniel Ramirez, licensed CC BY 2.0 via Wikimedia Commons.'),
    ('c3b12b5b-cba6-5ad7-be34-dc3fb410076f'::uuid, 'File:Kaaawa Beach walk.jpg', 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Kaaawa_Beach_walk.jpg', 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Kaaawa_Beach_walk.jpg', 'Kaaawa Beach walk', 'Eric Guinther', 'https://commons.wikimedia.org/wiki/User:Marshman', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/', 'Photo by Eric Guinther, licensed CC BY-SA 3.0 via Wikimedia Commons.'),
    ('a4b380d0-da3a-55b1-a873-b03effdcbe5c'::uuid, 'File:Kahana Bay.jpg', 'https://upload.wikimedia.org/wikipedia/commons/5/54/Kahana_Bay.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Kahana_Bay.jpg/1280px-Kahana_Bay.jpg', 'Kahana Bay', 'Hakilon', 'https://commons.wikimedia.org/wiki/User:Hakilon', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/', 'Photo by Hakilon, licensed CC BY-SA 3.0 via Wikimedia Commons.'),
    ('323e6269-4e83-571b-8d2e-111851d53949'::uuid, 'File:Keawaula Beach (27198349524).jpg', 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Keawaula_Beach_%2827198349524%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Keawaula_Beach_%2827198349524%29.jpg/1280px-Keawaula_Beach_%2827198349524%29.jpg', 'Keawaula Beach', 'Thomas Woodtli', 'https://www.flickr.com/people/21876032@N02', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/', 'Photo by Thomas Woodtli, licensed CC BY-SA 2.0 via Wikimedia Commons.'),
    ('33905812-2c50-5c48-af2b-d71623a93bfc'::uuid, 'File:2021-10-08 11 43 22 View northwest from Hāʻena Beach in Hāʻena, Kauai, Hawaii.jpg', 'https://upload.wikimedia.org/wikipedia/commons/1/14/2021-10-08_11_43_22_View_northwest_from_H%C4%81%CA%BBena_Beach_in_H%C4%81%CA%BBena%2C_Kauai%2C_Hawaii.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/2021-10-08_11_43_22_View_northwest_from_H%C4%81%CA%BBena_Beach_in_H%C4%81%CA%BBena%2C_Kauai%2C_Hawaii.jpg/1280px-2021-10-08_11_43_22_View_northwest_from_H%C4%81%CA%BBena_Beach_in_H%C4%81%CA%BBena%2C_Kauai%2C_Hawaii.jpg', 'View northwest from Hāʻena Beach in Hāʻena, Kauai, Hawaii', 'Famartin', 'https://commons.wikimedia.org/wiki/User:Famartin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 'Photo by Famartin, licensed CC BY-SA 4.0 via Wikimedia Commons.'),
    ('e73e1aa8-7d90-5a3c-956f-5d64fc90cac1'::uuid, 'File:Ke''e Beach (5342597062).jpg', 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Ke%27e_Beach_%285342597062%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Ke%27e_Beach_%285342597062%29.jpg/1280px-Ke%27e_Beach_%285342597062%29.jpg', 'Ke''e Beach', 'Alan Levine', 'https://www.flickr.com/people/cogdog/', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/', 'Photo by Alan Levine, licensed CC BY 2.0 via Wikimedia Commons.')
)
INSERT INTO public.beach_photos (
  beach_id, source, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html, approved, deleted_at
)
SELECT
  photo.beach_id, 'wikimedia', photo.source_id, photo.image_url, photo.thumb_url,
  photo.title, photo.creator_name, photo.creator_url, photo.license_code,
  photo.license_url, photo.attribution_html, true, NULL::timestamptz
FROM photo_candidates AS photo
ON CONFLICT (beach_id, source, source_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  thumb_url = EXCLUDED.thumb_url,
  title = EXCLUDED.title,
  creator_name = EXCLUDED.creator_name,
  creator_url = EXCLUDED.creator_url,
  license_code = EXCLUDED.license_code,
  license_url = EXCLUDED.license_url,
  attribution_html = EXCLUDED.attribution_html,
  approved = true,
  deleted_at = NULL,
  fetched_at = now();


INSERT INTO public.beach_sources (beach_id, forecast_source_id)
SELECT id, 'open_meteo' FROM _hawaii_kua_beaches
ON CONFLICT (beach_id) DO NOTHING;

DO $$
DECLARE
  catalog_count integer;
  source_count integer;
  photo_count integer;
  promoted_count integer;
BEGIN
  SELECT count(*) INTO catalog_count FROM public.beaches
  WHERE id IN (SELECT id FROM _hawaii_kua_beaches);
  SELECT count(*) INTO source_count FROM public.beach_sources
  WHERE beach_id IN (SELECT id FROM _hawaii_kua_beaches)
    AND forecast_source_id = 'open_meteo';
  SELECT count(*) INTO photo_count FROM public.beach_photos
  WHERE beach_id IN (SELECT id FROM _hawaii_kua_beaches)
    AND source = 'wikimedia' AND approved AND deleted_at IS NULL;
  SELECT count(*) INTO promoted_count FROM public.beaches
  WHERE id IN (SELECT id FROM _hawaii_kua_beaches)
    AND (recommendation_eligible OR seo_indexable);
  IF catalog_count <> 10 OR source_count <> 10 OR photo_count <> 9 OR promoted_count <> 0 THEN
    RAISE EXCEPTION 'Hawaii catalog validation failed: beaches %, sources %, photos %, promoted %', catalog_count, source_count, photo_count, promoted_count;
  END IF;
END $$;

COMMIT;
