-- Fort Ebey (Whidbey Island, WA) and the Vancouver Island pilot beaches from
-- issue #717 (Cox Bay, North and South Chesterman, Long Beach in the Pacific
-- Rim National Park Reserve).
--
-- Catalog rows only, the same shape as the 2026-09-03 catalog-gap import:
-- not indexable, not recommendation eligible, no terrain, no scoring inputs.
-- Nothing here binds a tide station. The Canadian rows carry country
-- 'Canada' so lib/services/tides/tide-provider.ts keeps them off the NOAA
-- CO-OPS fallback until the CHS binding in #717 phase 1 exists; Fort Ebey is
-- US water and resolves to Port Townsend (9444900) through the station
-- resolver. Coordinates are nearshore-water pins placed on Esri World Imagery
-- beside the official reference points cited in editorial_sources.
BEGIN;

CREATE TEMP TABLE _pilot_beaches (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL,
  city text NOT NULL, state text NOT NULL, country text NOT NULL, region text NOT NULL,
  timezone text NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL,
  break_type text, description text NOT NULL, access_tips text NOT NULL,
  hazards text[], editorial_sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _pilot_beaches VALUES
  ('5cde00c1-a9a0-5a1e-ba31-62915c235c9a', 'Fort Ebey', 'fort-ebey-coupeville-wa', 'Coupeville', 'WA', 'USA', 'Whidbey Island', 'America/Los_Angeles', 48.2235, -122.7690, NULL,
   'Driftwood-strewn beach below the bluffs of Fort Ebey State Park on the west shore of Whidbey Island, just south of Point Partridge, facing the Strait of Juan de Fuca. One of the few surf spots inside Puget Sound; the surf depends on swell working down the strait.',
   'Enter through Fort Ebey State Park, 400 Hill Valley Drive, Coupeville. A Discover Pass is required and the park is open 8 a.m. to dusk. Walk down from the bluff to the beach.',
   ARRAY['Strong currents and tide rips along the west shore of Whidbey Island', 'Wind off the Strait of Juan de Fuca']::text[],
   '[{"url": "https://parks.wa.gov/find-parks/state-parks/fort-ebey-state-park", "publisher": "Washington State Parks", "retrievedAt": "2026-10-20", "fields": ["name", "city", "state", "description", "access_tips"]}, {"url": "https://www.wwta.org/sites/fort-ebey-sp/", "publisher": "Washington Water Trails Association", "retrievedAt": "2026-10-20", "fields": ["description", "hazards"], "verification": "Describes the site as a popular Puget Sound surfing spot on Point Partridge and warns of winds from the Strait of Juan de Fuca and dynamic tides and currents along the west coast of Whidbey Island."}, {"url": "https://en.wikipedia.org/wiki/Fort_Ebey_State_Park", "publisher": "Wikipedia (GNIS Point Partridge reference)", "retrievedAt": "2026-10-20", "fields": ["coordinate_reference"], "verification": "Point Partridge reference 48.2248207, -122.7701732; pin placed about 150 m south-southeast in nearshore water off the beach."}, {"url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-122.775%2C48.2195%2C-122.763%2C48.2275&bboxSR=4326&imageSR=4326&size=1000%2C667&format=png&f=image", "publisher": "Esri World Imagery", "retrievedAt": "2026-10-20", "fields": ["lat", "lon", "pin_meaning"], "verification": "Image centre is nearshore water about 80 m off the beach south of Point Partridge."}]'::jsonb),
  ('5b90f22c-68ac-50ed-bed2-3c0bbc549dec', 'North Chesterman Beach', 'north-chesterman-beach-tofino-bc', 'Tofino', 'BC', 'Canada', 'Clayoquot Sound', 'America/Vancouver', 49.1215, -125.8990, 'beach',
   'The northern half of Chesterman Beach, a 2.7 km stretch of white sand just south of Tofino, with the rocky point below the Wickaninnish Inn at its north end. At low tide a sand spit links the beach to Frank Island, which is privately owned and closed to visitors.',
   'Vehicle access from Lynn Road, or walk or bike in on the Multi-Use Path. Washrooms and showers at the access point. Beach pay parking is in effect. Beach fires are allowed subject to current restrictions.',
   ARRAY[]::text[],
   '[{"url": "https://tofino.ca/our-community/parks-natural-spaces/beaches/", "publisher": "District of Tofino", "retrievedAt": "2026-10-20", "fields": ["name", "city", "description", "access_tips"]}, {"url": "https://geogratis.gc.ca/services/geoname/en/geonames.json?q=Chesterman%20Beach&province=59", "publisher": "Natural Resources Canada, Canadian Geographical Names Database (JAKLJ)", "retrievedAt": "2026-10-20", "fields": ["coordinate_reference"], "verification": "Chesterman Beach 49.1191667, -125.8941667 (whole beach). North pin placed 300 m northwest of the reference in the surf zone below the Lynn Road access."}, {"url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-125.905%2C49.1175%2C-125.893%2C49.1255&bboxSR=4326&imageSR=4326&size=1000%2C667&format=png&f=image", "publisher": "Esri World Imagery", "retrievedAt": "2026-10-20", "fields": ["lat", "lon", "pin_meaning"], "verification": "Image centre is the surf zone off the north half of the beach, with the Wickaninnish Inn point to the northwest."}]'::jsonb),
  ('8be1065c-9428-55b8-b23f-e268634e4e62', 'South Chesterman Beach', 'south-chesterman-beach-tofino-bc', 'Tofino', 'BC', 'Canada', 'Clayoquot Sound', 'America/Vancouver', 49.1105, -125.8843, 'beach',
   'The southern half of Chesterman Beach, ending at the rocky point before Rosie Bay. It shares the same 2.7 km of white sand as North Chesterman but has its own access and its own surf.',
   'Vehicle access from Chesterman Beach Road, or walk or bike in on the Multi-Use Path. Washrooms and showers at the access point. Beach pay parking is in effect. Beach fires are allowed subject to current restrictions.',
   ARRAY[]::text[],
   '[{"url": "https://tofino.ca/our-community/parks-natural-spaces/beaches/", "publisher": "District of Tofino", "retrievedAt": "2026-10-20", "fields": ["name", "city", "description", "access_tips"]}, {"url": "https://geogratis.gc.ca/services/geoname/en/geonames.json?q=Chesterman%20Beach&province=59", "publisher": "Natural Resources Canada, Canadian Geographical Names Database (JAKLJ)", "retrievedAt": "2026-10-20", "fields": ["coordinate_reference"], "verification": "Chesterman Beach 49.1191667, -125.8941667 (whole beach). South pin placed 1.2 km southeast of the reference in the surf zone near the southern rocks."}, {"url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-125.8903%2C49.1065%2C-125.8783%2C49.1145&bboxSR=4326&imageSR=4326&size=1000%2C667&format=png&f=image", "publisher": "Esri World Imagery", "retrievedAt": "2026-10-20", "fields": ["lat", "lon", "pin_meaning"], "verification": "Image centre is the surf zone at the southeast end of the beach, rocky point to the southeast."}]'::jsonb),
  ('d30f16ed-f5b2-513d-852e-cf20092b1050', 'Cox Bay', 'cox-bay-tofino-bc', 'Tofino', 'BC', 'Canada', 'Clayoquot Sound', 'America/Vancouver', 49.1016, -125.8763, 'beach',
   'A 1.5 km beach at the south end of Tofino with fine sand and large driftwood. Its waves make it popular for surfing and storm watching; the District warns of a strong undertow. Beach fires are not allowed.',
   'A short boardwalk leads from the Cox Bay parking lot to the north end; a roughly five-minute trail from Maltby Road reaches the south end. Washrooms and showers available. Beach pay parking is in effect. Parks Canada posts rip current and no-go zone maps on site.',
   ARRAY['Strong undertow', 'Rip currents; check the Parks Canada hazard map on site']::text[],
   '[{"url": "https://tofino.ca/our-community/parks-natural-spaces/beaches/", "publisher": "District of Tofino", "retrievedAt": "2026-10-20", "fields": ["name", "city", "description", "access_tips", "hazards"]}, {"url": "https://parks.canada.ca/pn-np/bc/pacificrim/activ/surf", "publisher": "Parks Canada", "retrievedAt": "2026-10-20", "fields": ["hazards", "access_tips"], "verification": "Lists Cox Bay among the beaches with rip current and no-go zone hazard maps; no lifeguards or surf guards on duty."}, {"url": "https://geogratis.gc.ca/services/geoname/en/geonames.json?q=Cox%20Bay&province=59", "publisher": "Natural Resources Canada, Canadian Geographical Names Database (JAIPA)", "retrievedAt": "2026-10-20", "fields": ["coordinate_reference"], "verification": "Cox Bay 49.103611, -125.882778 (the bay). Pin placed 500 m southeast of the reference in the surf zone off the middle of the beach."}, {"url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-125.883%2C49.0976%2C-125.871%2C49.1056&bboxSR=4326&imageSR=4326&size=1000%2C667&format=png&f=image", "publisher": "Esri World Imagery", "retrievedAt": "2026-10-20", "fields": ["lat", "lon", "pin_meaning"], "verification": "Image centre is the surf zone off the middle of the beach, resort buildings at the north end to the northeast."}]'::jsonb),
  ('d9cbd2f3-bacf-5d3b-86a3-e3977e2a87ae', 'Long Beach (Pacific Rim)', 'long-beach-pacific-rim-tofino-bc', 'Tofino', 'BC', 'Canada', 'Pacific Rim', 'America/Vancouver', 49.0658, -125.7535, 'beach',
   'The long open-Pacific beach of the Pacific Rim National Park Reserve, on Wickaninnish Bay between Tofino and Ucluelet. Its consistent surf made it one of the earliest and most popular surf spots in British Columbia. The pin sits at the north end near Incinerator Rock. People surf year round; winter suits experienced surfers and summer is more moderate.',
   'The Pacific Rim Highway runs the length of the beach with park day-use lots. Check Parks Canada for current park pass requirements. There are no lifeguards or surf guards; Parks Canada posts rip current and no-go zone maps on site.',
   ARRAY['Rip currents, especially around the offshore rock islands', 'Logs shifting on the upper beach when swell runs at high tide', 'No lifeguards']::text[],
   '[{"url": "https://parks.canada.ca/pn-np/bc/pacificrim/activ/surf", "publisher": "Parks Canada", "retrievedAt": "2026-10-20", "fields": ["description", "access_tips", "hazards"], "verification": "Year-round surfing, winter for experienced surfers, no lifeguards, hazard maps for Long Beach and Cox Bay."}, {"url": "https://en.wikipedia.org/wiki/Long_Beach_(British_Columbia)", "publisher": "Wikipedia", "retrievedAt": "2026-10-20", "fields": ["description", "hazards", "coordinate_reference"], "verification": "Reference 49.05, -125.71667; rip currents around the offshore rock islands and shifting logs at high tide."}, {"url": "https://geogratis.gc.ca/services/geoname/en/geonames.json?q=Long%20Beach&province=59", "publisher": "Natural Resources Canada, Canadian Geographical Names Database (JASAT)", "retrievedAt": "2026-10-20", "fields": ["coordinate_reference"], "verification": "Long Beach, Clayoquot Land District, 49.05, -125.71667. Pin placed 3 km northwest at the north end of the beach."}, {"url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-125.7595%2C49.0618%2C-125.7475%2C49.0698&bboxSR=4326&imageSR=4326&size=1000%2C667&format=png&f=image", "publisher": "Esri World Imagery", "retrievedAt": "2026-10-20", "fields": ["lat", "lon", "pin_meaning"], "verification": "Image centre is nearshore water just outside the surf line, Incinerator Rock to the west-northwest, Tofino airport behind the beach."}]'::jsonb);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.beaches b JOIN _pilot_beaches p
      ON b.id <> p.id AND (lower(b.slug) = lower(p.slug) OR (lower(b.name) = lower(p.name) AND b.state = p.state))
  ) THEN RAISE EXCEPTION 'Pilot beach import conflicts with an existing name or slug'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.beaches b JOIN _pilot_beaches p ON b.id = p.id
    WHERE b.slug <> p.slug OR abs(b.lat - p.lat) > 0.001 OR abs(b.lon - p.lon) > 0.001
  ) THEN RAISE EXCEPTION 'Pilot beach import UUID identity or coordinate conflict'; END IF;
END $$;

INSERT INTO public.beaches (
  id,name,slug,city,state,country,region,timezone,lat,lon,break_type,
  description,access_tips,hazards,warnings,editorial_sources,editorial_reviewed_at,
  seo_indexable,recommendation_eligible,is_private,terrain_enabled
)
SELECT id,name,slug,city,state,country,region,timezone,lat,lon,break_type,
  description,access_tips,hazards,hazards,editorial_sources,'2026-10-20T00:00:00Z',
  false,false,false,false
FROM _pilot_beaches p
WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id=p.id);

INSERT INTO public.beach_sources (beach_id,forecast_source_id)
SELECT id,'open_meteo' FROM _pilot_beaches
ON CONFLICT (beach_id) DO NOTHING;

DO $$
DECLARE n integer; source_n integer; canada_n integer;
BEGIN
  SELECT count(*) INTO n FROM public.beaches WHERE id IN (SELECT id FROM _pilot_beaches) AND deleted_at IS NULL
    AND seo_indexable = false AND recommendation_eligible = false AND terrain_enabled = false;
  SELECT count(*) INTO source_n FROM public.beach_sources WHERE beach_id IN (SELECT id FROM _pilot_beaches) AND forecast_source_id='open_meteo';
  SELECT count(*) INTO canada_n FROM public.beaches WHERE id IN (SELECT id FROM _pilot_beaches) AND country='Canada' AND state='BC' AND timezone='America/Vancouver';
  IF n <> 5 OR source_n <> 5 OR canada_n <> 4 THEN
    RAISE EXCEPTION 'Pilot beach import count mismatch: beaches %, sources %, canada %',n,source_n,canada_n;
  END IF;
END $$;
COMMIT;
