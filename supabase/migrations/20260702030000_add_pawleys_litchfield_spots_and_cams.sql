-- Add Pawleys Island and South Litchfield forecast anchors and validated owner cams.

BEGIN;

WITH new_spots (
  id,
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  hazards,
  features,
  swell_window_min_deg,
  swell_window_max_deg,
  wind_offshore_deg,
  wind_offshore_tol_deg,
  wind_cross_shore_ok_kt,
  wind_onshore_bad_kt,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  preferred_tide_direction,
  preference_model,
  aspect_deg,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  best_months,
  slug,
  region,
  timezone,
  description,
  parking_tips,
  access_tips,
  wave_tips,
  crowd_tips,
  best_conditions_prose,
  warnings,
  local_etiquette,
  crowd_level,
  real_takeaways,
  is_private,
  cdip_eligible,
  persona,
  deepwater_decay_factor
) AS (
  VALUES
    (
      'ee7239d5-8e40-4385-b60c-288aff0d4706'::uuid,
      'Pawleys Island Pier',
      'Pawleys Island',
      'SC',
      'USA',
      33.432308,
      -79.119119,
      'pier',
      'lower-intermediate',
      ARRAY['rip currents', 'pier pilings', 'jellyfish', 'private pier access']::text[],
      ARRAY['Pawleys Island beachbreak', 'pier-adjacent sandbar peaks', 'validated live beach cam', 'useful tropical-swell exposure']::text[],
      45,
      170,
      315,
      45,
      12,
      10,
      1.0,
      4.5,
      'rising',
      '{"tide": "mid rising", "primary_swell": {"dir_deg": 105, "period_s": 9}, "notes": "Seeded as the closest public forecast anchor for Pawleys Island Pier-area custom spots. The pier itself is private/resident or guest access, so Quiver should present this as a beach forecast anchor rather than a public pier-access promise. Public cam evidence comes from Pawleys Island Realty / Pawleys Pier Village via Brownrice."}'::jsonb,
      105,
      108,
      63,
      ARRAY[8, 9, 10, 11, 3, 4],
      'pawleys-island-pier-pawleys-island-sc',
      'Grand Strand',
      'America/New_York',
      'Pawleys Island Pier is the closest named forecast anchor for private Pawleys Island pier-area custom spots. The surf is still an Atlantic-facing sandbar read, with pier-adjacent peaks and tropical-season windows, but the pier and immediate access are private/resident or guest controlled. Use this anchor for nearby custom-spot forecast matching without implying public pier access.',
      'Use legal public Pawleys Island beach access and parking, then walk only where public access allows. Do not route surfers through private pier, rental, or resort access.',
      'Treat the pier as a visual landmark and forecast anchor. Check local signs and use public beach accesses rather than the private pier or private walkway system.',
      'Look for organized east to southeast swell, especially tropical-season lines, with northwest to west-northwest wind. Mid to rising tide helps keep the sandbar setup from getting too drained.',
      'Generally lighter than the core Myrtle Beach breaks, but rental traffic and private-access users can cluster near the pier area when the surf is obvious.',
      'East to southeast swell, light northwest wind, and mid to rising tide are the starting read. Late summer and fall tropical windows are the highest-upside season, with useful smaller windows in spring.',
      ARRAY['Pier and immediate access are private', 'Rip currents are possible on stronger swell', 'Keep clear of pier pilings and swimmers', 'No lifeguard coverage should be assumed']::text[],
      'Respect private property, use public access only, and give local residents and guests space near constrained access points.',
      'moderate',
      ARRAY['Adds a Pawleys Island forecast anchor within a tenth of a mile of Landon''s The pier custom spots', 'Public owner cam available through Pawleys Island Realty and Brownrice HLS', 'Private pier/access caveat must stay visible in copy and routing']::text[],
      false,
      false,
      'exposed_beach_break'::beach_persona,
      1.0
    ),
    (
      '19313c94-11c9-431e-9f0b-9cc9e89628aa'::uuid,
      'South Litchfield',
      'Litchfield Beach',
      'SC',
      'USA',
      33.463113,
      -79.102090,
      'beach',
      'beginner-intermediate',
      ARRAY['rip currents', 'jellyfish', 'shorebreak', 'inlet currents']::text[],
      ARRAY['South Litchfield beachbreak', 'nearby Litchfield By The Sea cam', 'sandbar peaks', 'short drive to Pawleys Island']::text[],
      70,
      180,
      305,
      45,
      12,
      10,
      0.5,
      4.0,
      'either',
      '{"tide": "mid", "primary_swell": {"dir_deg": 125, "period_s": 8}, "notes": "Seeded as the closest forecast anchor for the South Litchfield custom spot. The cam is an owner/player embed from MyrtleBeachSurfCams / IPCamLive for South Beach at Litchfield By The Sea, so treat it as nearby visual evidence rather than a NOAA forecast input."}'::jsonb,
      110,
      125,
      55,
      ARRAY[8, 9, 10, 11, 3, 4],
      'south-litchfield-litchfield-beach-sc',
      'Grand Strand',
      'America/New_York',
      'South Litchfield is the closest forecast anchor for South Litchfield custom spots north of Pawleys Island. It is a mellow Atlantic-facing beachbreak read with sandbar-dependent peaks, better odds on organized east and southeast swell, and enough local variation that nearby cam evidence is useful before sending a surfer there.',
      'Use legal public beach parking or approved guest parking where posted. Avoid routing through private Litchfield By The Sea access unless the surfer has access rights.',
      'Use signed public access points and check the beach from the dune crossover before paddling. Inlet current and sandbar changes can make one block look different from the next.',
      'Look for small to moderate east or southeast swell with light west to northwest wind. Mid tide is the safest starting read, with room to adjust by sandbar and current.',
      'Often quieter than central Myrtle Beach, though vacation weeks and resort access points can concentrate beach traffic.',
      'East to southeast swell, light west or northwest wind, and mid tide are the starting read. Late summer and fall tropical windows are the main upside, with smaller spring surf possible.',
      ARRAY['Rip currents are possible', 'Inlet current can matter near sandspits', 'Shorebreak can get punchy on stronger swell', 'Respect private resort access boundaries']::text[],
      'Use public access, do not crowd small peaks, and keep clear of swimmers and resort beach setups.',
      'light',
      ARRAY['Adds a South Litchfield forecast anchor at Landon''s saved custom spot coordinate', 'Nearby owner/player cam is available through MyrtleBeachSurfCams and IPCamLive', 'Use as a beachbreak forecast anchor, not a guaranteed public resort-access route']::text[],
      false,
      false,
      'exposed_beach_break'::beach_persona,
      1.0
    )
)
INSERT INTO public.beaches (
  id,
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  hazards,
  features,
  swell_window_min_deg,
  swell_window_max_deg,
  wind_offshore_deg,
  wind_offshore_tol_deg,
  wind_cross_shore_ok_kt,
  wind_onshore_bad_kt,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  preferred_tide_direction,
  preference_model,
  aspect_deg,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  best_months,
  slug,
  region,
  timezone,
  description,
  parking_tips,
  access_tips,
  wave_tips,
  crowd_tips,
  best_conditions_prose,
  warnings,
  local_etiquette,
  crowd_level,
  real_takeaways,
  is_private,
  cdip_eligible,
  persona,
  deepwater_decay_factor
)
SELECT
  spot.id,
  spot.name,
  spot.city,
  spot.state,
  spot.country,
  spot.lat,
  spot.lon,
  spot.break_type,
  spot.skill_level,
  spot.hazards,
  spot.features,
  spot.swell_window_min_deg,
  spot.swell_window_max_deg,
  spot.wind_offshore_deg,
  spot.wind_offshore_tol_deg,
  spot.wind_cross_shore_ok_kt,
  spot.wind_onshore_bad_kt,
  spot.preferred_tide_ft_min,
  spot.preferred_tide_ft_max,
  spot.preferred_tide_direction,
  spot.preference_model,
  spot.aspect_deg,
  spot.swell_window_center_deg,
  spot.swell_window_halfwidth_deg,
  spot.best_months,
  spot.slug,
  spot.region,
  spot.timezone,
  spot.description,
  spot.parking_tips,
  spot.access_tips,
  spot.wave_tips,
  spot.crowd_tips,
  spot.best_conditions_prose,
  spot.warnings,
  spot.local_etiquette,
  spot.crowd_level,
  spot.real_takeaways,
  spot.is_private,
  spot.cdip_eligible,
  spot.persona,
  spot.deepwater_decay_factor
FROM new_spots AS spot
WHERE NOT EXISTS (
  SELECT 1
  FROM public.beaches AS existing
  WHERE existing.slug = spot.slug
    AND existing.deleted_at IS NULL
);

WITH cam_updates (
  slug,
  city,
  state,
  camera_url,
  thumbnail_url
) AS (
  VALUES
    (
      'pawleys-island-pier-pawleys-island-sc',
      'Pawleys Island',
      'SC',
      'https://live5.brownrice.com:444/pawleys1/pawleys1.stream/playlist.m3u8',
      NULL
    ),
    (
      'south-litchfield-litchfield-beach-sc',
      'Litchfield Beach',
      'SC',
      'https://g1.ipcamlive.com/player/player.php?alias=southbeachcam&skin=white&autoplay=1',
      NULL
    )
)
INSERT INTO public.beach_sources (
  beach_id,
  camera_url,
  thumbnail_url
)
SELECT
  b.id,
  cam_updates.camera_url,
  cam_updates.thumbnail_url
FROM cam_updates
JOIN public.beaches AS b
  ON b.slug = cam_updates.slug
  AND b.city = cam_updates.city
  AND b.state = cam_updates.state
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id)
DO UPDATE SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = COALESCE(NULLIF(public.beach_sources.thumbnail_url, ''), EXCLUDED.thumbnail_url)
WHERE public.beach_sources.camera_url IS NULL
   OR public.beach_sources.camera_url = ''
   OR public.beach_sources.camera_url = EXCLUDED.camera_url;

UPDATE public.custom_spots AS cs
SET nearest_beach_id = b.id,
    updated_at = NOW()
FROM public.beaches AS b
WHERE b.slug = 'pawleys-island-pier-pawleys-island-sc'
  AND b.deleted_at IS NULL
  AND cs.id IN (
    'ea66c1be-ea12-4606-8430-d17271f053d3'::uuid,
    '7e65605a-d260-45d7-ba9b-59476ee1bfd8'::uuid
  )
  AND cs.deleted_at IS NULL
  AND cs.nearest_beach_id = 'd15efc29-c4cb-407c-99b8-be92914473f4'::uuid;

UPDATE public.custom_spots AS cs
SET nearest_beach_id = b.id,
    updated_at = NOW()
FROM public.beaches AS b
WHERE b.slug = 'south-litchfield-litchfield-beach-sc'
  AND b.deleted_at IS NULL
  AND cs.id = '99c8b745-a3d8-4248-be97-7691a31fafa3'::uuid
  AND cs.deleted_at IS NULL
  AND cs.nearest_beach_id = 'd15efc29-c4cb-407c-99b8-be92914473f4'::uuid;

COMMIT;
