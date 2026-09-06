BEGIN;

WITH city_rows (
  city_slug,
  city_name,
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist,
  editorial_sources,
  seo_intro,
  seo_local_guidance
) AS (
  VALUES
    (
      'trinidad',
      'Trinidad',
      ARRAY[
        'Trinidad sits on a headland-cut section of the Humboldt County coast where exposed beaches, protected coves, river-mouth sandbars, and rocky points sit within a few miles of one another. Moonstone Beach offers the area''s most established public surf access, while Houda Point and Trinidad State Beach add more directional shelter and tide-sensitive terrain. College Cove remains listed for closure awareness, not as a current surf option, while its official erosion closure is active.',
        'This coastline is cold, powerful, and changeable. Northwest Pacific swell supplies most of the energy, but the headlands around Trinidad can block or redirect parts of the swell spectrum. A spot that looks manageable from town can be much larger around the next point. Check the actual beach, wind, tide, and marine forecast together, and expect strong currents, sneaker waves, submerged rocks, and limited rescue access.',
        'Public access varies by beach. Humboldt County manages Moonstone Beach, Trinidad Coastal Land Trust maintains the Houda Point access area, and California State Parks manages Trinidad State Beach and College Cove. Use signed parking and trails, keep clear of bluff edges, and treat posted closures as hard access restrictions. Quiver''s city view compares the open locations without overriding official notices or on-site judgment.'
      ]::text[],
      '[{"icon":"sun","title":"Today","summary":"Compare the exposed Moonstone shoreline with the more sheltered coves before choosing a spot; swell direction can change conditions over a short distance."},{"icon":"clock","title":"Now","summary":"Check wind, tide, and the beach from a safe viewpoint. Lower-tide access and exposed rock can materially change Houda Point and nearby coves."},{"icon":"calendar","title":"Weekend","summary":"Recheck official access notices before driving. College Cove remains closed for trail erosion and should not be treated as an alternate."}]'::jsonb,
      '[{"label":"Trinidad surf map","href":"/map?search=Trinidad"},{"label":"Northern California forecast","href":"/forecast/northern-california"}]'::jsonb,
      ARRAY['tide', 'water-temp', 'dawn-patrol']::text[],
      ARRAY[
        'Check the Humboldt County and California State Parks access pages for current notices.',
        'Use a cold-water wetsuit appropriate for Northern California and account for limited rescue access.',
        'Watch from shore for current channels, sneaker waves, and changing swell exposure before paddling out.'
      ]::text[],
      '[{"url":"https://humboldtgov.org/Facilities/Facility/Details/Moonstone-Beach-14","publisher":"Humboldt County","retrievedAt":"2026-09-02"},{"url":"https://www.trinidadcoastallandtrust.org/houda-point.html","publisher":"Trinidad Coastal Land Trust","retrievedAt":"2026-09-02"},{"url":"https://www.parks.ca.gov/?page_id=418","publisher":"California State Parks","retrievedAt":"2026-09-02"},{"url":"https://parks.ca.gov/post/52","publisher":"California State Parks","retrievedAt":"2026-09-02"}]'::jsonb,
      'Trinidad surf forecasts, tide context, access notes, and spot comparisons for the Moonstone-to-College Cove coastline.',
      'Treat posted closures as authoritative. College Cove is not a current surf option while its erosion-related access closure remains active, and every Trinidad-area beach requires cold-water and sneaker-wave awareness.'
    ),
    (
      'samoa',
      'Samoa',
      ARRAY[
        'Samoa''s surf zone occupies the exposed ocean side of the North Spit at Humboldt Bay. The Samoa Dunes Recreation Area provides public coastal access near broad sand beaches and a jetty-influenced sandbar system. Open-ocean exposure means the surf can carry substantially more power than protected Humboldt Bay, with shifting peaks and channels that change as storms move sand along the spit.',
        'This is an advanced setting rather than a general beach recommendation. Long-period northwest swell, strong lateral current, rip channels, cold water, and the working harbor entrance all raise the consequence of a mistake. The North Jetty itself is unsafe for recreation: stay off the structure and do not use it as a viewing platform or access route. Observe from stable ground and leave room for sneaker waves.',
        'BLM manages recreation access at Samoa Dunes, but it does not manage the North Jetty structure. Confirm current BLM notices and marine conditions before visiting, keep vehicles in authorized areas, and separate off-highway-vehicle activity from shoreline access. Quiver can show the forecast and map location, but it cannot make an exposed jetty session suitable for a surfer who lacks the required experience.'
      ]::text[],
      '[{"icon":"sun","title":"Today","summary":"Treat any substantial northwest swell as an advanced-water event and compare the marine forecast with a shore inspection."},{"icon":"clock","title":"Now","summary":"Stay on stable beach access, remain clear of the harbor entrance, and do not stand or travel on the North Jetty."},{"icon":"calendar","title":"Weekend","summary":"Check BLM access notices and expect recreation traffic in the dunes; use only designated parking and routes."}]'::jsonb,
      '[{"label":"Samoa surf map","href":"/map?search=Samoa"},{"label":"Northern California forecast","href":"/forecast/northern-california"}]'::jsonb,
      ARRAY['tide', 'water-temp']::text[],
      ARRAY[
        'Confirm BLM recreation-area access and marine advisories before departure.',
        'Stay off the North Jetty and away from the active harbor entrance.',
        'Use cold-water equipment and paddle out only with advanced exposed-beach experience.'
      ]::text[],
      '[{"url":"https://www.blm.gov/visit/samoa-dunes","publisher":"Bureau of Land Management","retrievedAt":"2026-09-02"},{"url":"https://www.weather.gov/media/eka/Beach_Safety_Brochure_2022.pdf","publisher":"National Weather Service Eureka","retrievedAt":"2026-09-02"}]'::jsonb,
      'Samoa surf forecasts and safety guidance for the exposed North Spit shoreline beside Humboldt Bay.',
      'Samoa Dunes is an advanced, exposed surf area. Stay off the North Jetty, avoid the active harbor entrance, and account for cold water, rip currents, lateral current, and sneaker waves.'
    ),
    (
      'mckinleyville',
      'McKinleyville',
      ARRAY[
        'McKinleyville''s public ocean access is centered on Clam Beach County Park, a broad, exposed sand beach north of the Mad River. Humboldt County documents day-use and campground access, making it a useful coastal reference point for travelers moving between Arcata and Trinidad. The shoreline is open to Pacific swell and can change quickly as sandbars, river influence, wind, and tide interact.',
        'Quiver currently treats Clam Beach as a forecast-reference location rather than a positive surf recommendation. Public access is verified, but local validation of skill suitability and tide behavior is still pending. That distinction matters on a featureless-looking beach where rip channels, shorebreak, sneaker waves, and cold water may not be obvious from the parking area.',
        'Use the county''s designated access and verify any seasonal or emergency notices before visiting. Inspect the shoreline from a safe distance, avoid creek or river outflow after storms, and do not infer safety from an empty lineup. The McKinleyville city page provides access context and forecast visibility while preserving Clam Beach''s recommendation and individual-page SEO gate until validation is complete.'
      ]::text[],
      '[{"icon":"sun","title":"Today","summary":"Use the forecast as a reference only and confirm the actual sandbars, currents, and shorebreak from the beach."},{"icon":"clock","title":"Now","summary":"Do not treat an empty lineup as proof of safe conditions; exposed Humboldt beaches can carry strong current and sneaker-wave risk."},{"icon":"calendar","title":"Weekend","summary":"Check Humboldt County notices for Clam Beach access and campground conditions before traveling."}]'::jsonb,
      '[{"label":"McKinleyville surf map","href":"/map?search=McKinleyville"},{"label":"Northern California forecast","href":"/forecast/northern-california"}]'::jsonb,
      ARRAY['tide', 'water-temp']::text[],
      ARRAY[
        'Check Humboldt County access information and posted notices.',
        'Treat Clam Beach forecasts as reference data pending local surf-suitability validation.',
        'Watch for rip channels, shorebreak, sneaker waves, and cold-water exposure.'
      ]::text[],
      '[{"url":"https://www.humboldtgov.org/Facilities/Facility/Details/Clam-Beach-4","publisher":"Humboldt County","retrievedAt":"2026-09-02"},{"url":"https://www.weather.gov/media/eka/Beach_Safety_Brochure_2022.pdf","publisher":"National Weather Service Eureka","retrievedAt":"2026-09-02"}]'::jsonb,
      'McKinleyville coastal access and forecast context for Clam Beach on Humboldt County''s exposed Pacific shoreline.',
      'Clam Beach remains forecast-reference only. Its public access is verified, but Quiver will not issue positive recommendations or index the individual beach page until local suitability and tide behavior are validated.'
    )
)
INSERT INTO public.city_editorial_content (
  city_slug,
  state_slug,
  country_slug,
  city_name,
  region_label,
  intent,
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist,
  seo_indexable,
  editorial_reviewed_at,
  editorial_sources,
  seo_intro,
  seo_local_guidance
)
SELECT
  city_slug,
  'ca',
  'usa',
  city_name,
  'Humboldt County, California',
  'general',
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist,
  true,
  TIMESTAMPTZ '2026-09-02 00:00:00+00',
  editorial_sources,
  seo_intro,
  seo_local_guidance
FROM city_rows
ON CONFLICT (city_slug, state_slug, country_slug, intent) DO UPDATE SET
  city_name = EXCLUDED.city_name,
  region_label = EXCLUDED.region_label,
  description = EXCLUDED.description,
  session_timing = EXCLUDED.session_timing,
  quick_links = EXCLUDED.quick_links,
  featured_intents = EXCLUDED.featured_intents,
  planning_checklist = EXCLUDED.planning_checklist,
  seo_indexable = EXCLUDED.seo_indexable,
  editorial_reviewed_at = EXCLUDED.editorial_reviewed_at,
  editorial_sources = EXCLUDED.editorial_sources,
  seo_intro = EXCLUDED.seo_intro,
  seo_local_guidance = EXCLUDED.seo_local_guidance,
  updated_at = now();

DO $$
DECLARE
  reviewed_count integer;
BEGIN
  SELECT count(*)
  INTO reviewed_count
  FROM public.city_editorial_content
  WHERE city_slug IN ('trinidad', 'samoa', 'mckinleyville')
    AND state_slug = 'ca'
    AND country_slug = 'usa'
    AND intent = 'general'
    AND seo_indexable
    AND editorial_reviewed_at IS NOT NULL
    AND jsonb_array_length(editorial_sources) >= 2
    AND COALESCE(array_length(description, 1), 0) >= 3
    AND NULLIF(trim(seo_intro), '') IS NOT NULL
    AND NULLIF(trim(seo_local_guidance), '') IS NOT NULL;

  IF reviewed_count <> 3 THEN
    RAISE EXCEPTION 'Humboldt city editorial validation failed: reviewed %', reviewed_count;
  END IF;
END
$$;

COMMIT;
