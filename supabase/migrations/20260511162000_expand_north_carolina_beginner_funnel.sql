BEGIN;

UPDATE public.beaches
SET
  timezone = 'America/New_York',
  break_type = 'beach',
  skill_level = 'beginner-intermediate',
  description = 'Wrightsville Beach is one of North Carolina''s easiest places to build beginner surf reps thanks to its reliable summer beachbreak, easy public access, and soft enough shoulders on smaller swells to keep early sessions fun instead of overwhelming.',
  parking_tips = 'Use the public access lots or paid street parking and aim for an early arrival. Summer fills fast after mid-morning.',
  access_tips = 'Most public accesses are a short walk over the dune line. Staying away from the pier keeps the takeoff zone friendlier for learners.',
  wave_tips = 'Look for knee- to waist-high sandbar peaks on light-wind mornings. Beginners usually do best on the shoulder rather than right by the pier.',
  crowd_tips = 'Dawn patrol and weekday mornings are the easiest windows for space. When the pier gets busy, walk a little farther down the beach.',
  best_conditions_prose = 'Small summer swell, light offshore or calm wind, and a mid-morning glass-off window.',
  warnings = ARRAY['Rip currents pulse around the pier on bigger days', 'Wind chop builds quickly after lunch', 'Summer crowds spike near the main accesses'],
  local_etiquette = 'Keep wide of the pier crowd, give surf-school groups room, and treat this as a reps beach rather than a battle-for-position lineup.',
  real_takeaways = ARRAY['🏄 Soft summer peaks are beginner friendly', '🚗 Easy public access makes quick checks simple', '🌬️ Go early before the sea breeze turns it choppy']
WHERE id = '4b88f10a-c794-4144-b17a-133af9fee9f9';

INSERT INTO public.beaches (
  id,
  name,
  city,
  state,
  country,
  timezone,
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
  preference_model,
  aspect_deg,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  best_months,
  slug,
  region,
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
  is_private
) VALUES
  (
    '23554d2f-cf2b-487c-8e38-45d19ec785b5',
    'Carolina Beach',
    'Carolina Beach',
    'NC',
    'USA',
    'America/New_York',
    34.0359,
    -77.8936,
    'beach',
    'beginner-intermediate',
    ARRAY['rip currents', 'shorebreak', 'jellyfish'],
    ARRAY['Public parking', 'Restrooms', 'Showers', 'Surf schools nearby'],
    70,
    165,
    300,
    40,
    12,
    10,
    0.5,
    3.0,
    '{"tide":"mid","primary_swell":{"dir_deg":110,"period_s":8},"notes":"Soft summer windswell and smaller tropical leftovers are the sweet spot for beginner sessions."}'::jsonb,
    110,
    118,
    48,
    ARRAY[5,6,7,8,9],
    'carolina-beach-carolina-beach-nc',
    'Cape Fear',
    'Carolina Beach is one of the most approachable beginner surf zones in North Carolina, with a gently sloping beach, forgiving summer surf, and enough room to spread out away from the busiest peaks.',
    'Paid public lots and street parking are closest to the boardwalk. Arrive before 9am on warm weekends.',
    'Pick a lifeguarded access and walk a little off the boardwalk crowd to find a softer sandbar with more room.',
    'Focus on knee- to waist-high mornings with light wind. The best beginner rides usually come on clean inside reforms instead of the steeper first peak.',
    'The boardwalk zone gets busy fast, so walk north or south for more space once you park.',
    'Small summer swell, light morning wind, and a mid tide that keeps the sandbars soft.',
    ARRAY['Rip currents show up on bigger south swells', 'Afternoon sea breeze can turn the lineup choppy', 'Stormier days push this out of true-beginner range'],
    'Stay clear of the most crowded peak, keep your takeoffs predictable, and give surf lessons room to run.',
    'high',
    ARRAY['🌊 Gentler summer surf than the Outer Banks', '🅿️ Easy first-session logistics', '⏰ Morning glass is the move'],
    false
  ),
  (
    '49edc438-1e29-47e4-a66f-d8d68cd4e7fe',
    'Kure Beach',
    'Kure Beach',
    'NC',
    'USA',
    'America/New_York',
    33.9968,
    -77.9072,
    'beach',
    'beginner-intermediate',
    ARRAY['rip currents', 'shorebreak', 'jellyfish'],
    ARRAY['Public parking', 'Restrooms', 'Showers', 'Wide beach'],
    70,
    165,
    300,
    40,
    12,
    10,
    0.5,
    3.0,
    '{"tide":"mid","primary_swell":{"dir_deg":110,"period_s":8},"notes":"Best as a quieter Pleasure Island alternative when Carolina Beach feels packed."}'::jsonb,
    110,
    118,
    48,
    ARRAY[5,6,7,8,9],
    'kure-beach-kure-beach-nc',
    'Cape Fear',
    'Kure Beach gives beginners a quieter, less hectic version of the same soft summer surf that makes southern North Carolina so usable for first sessions.',
    'Public lots near the oceanfront park and pier area are the easiest starts. Parking is simpler than Carolina Beach if you go early.',
    'Short beach accesses make carrying a foam board easy. Use a peak away from the pier when the main lineup is active.',
    'Smaller clean days are the goal here. Beginners can usually find mellow reform sections when the outside peak looks a little too steep.',
    'This beach stays calmer than Carolina Beach, but the pier zone still attracts the heaviest crowd.',
    'Small swell, light wind, and enough tide to keep the shorebreak from dumping.',
    ARRAY['Bigger days can close out fast', 'Rip currents form near the pier and access channels', 'Wind turns it messy quickly after late morning'],
    'Give the pier lineup extra room and keep your paddling predictable around families and surf-school groups.',
    'moderate',
    ARRAY['😌 Quieter than Carolina Beach', '🏄 Good for confidence-building reps', '🌅 Early small windows work best'],
    false
  ),
  (
    'fd6522df-caf5-4d78-bb35-8b53ce603db2',
    'Surf City',
    'Surf City',
    'NC',
    'USA',
    'America/New_York',
    34.4271,
    -77.5463,
    'beach',
    'beginner-intermediate',
    ARRAY['rip currents', 'shorebreak', 'fishing lines near the pier'],
    ARRAY['Public parking', 'Restrooms', 'Boardwalk access', 'Surf schools nearby'],
    65,
    160,
    295,
    40,
    12,
    10,
    0.5,
    3.0,
    '{"tide":"mid","primary_swell":{"dir_deg":105,"period_s":8},"notes":"Great for small summer surf and progression sessions when wind stays light."}'::jsonb,
    105,
    113,
    48,
    ARRAY[5,6,7,8,9],
    'surf-city-surf-city-nc',
    'Topsail Island',
    'Surf City is a reliable Topsail Island option for new surfers who want soft beachbreak peaks, approachable crowd levels outside the pier, and a simple beach day without Outer Banks punch.',
    'Use the public lots near the main accesses and get there early on Saturdays. Most beginner windows happen before beach traffic peaks.',
    'The easiest carry-ins are from the numbered public accesses. Start away from the pier if you want more forgiving takeoffs.',
    'Look for small lines with a slower shoulder. Even when the outside section looks weak, the inside reforms can be ideal for first pop-ups.',
    'The beach spreads people out well, but the pier area stays busiest on clean swell.',
    'Light wind, waist-high or smaller surf, and a morning tide window that keeps the faces soft.',
    ARRAY['Currents pulse around the pier', 'Summer afternoons get windy', 'Tropical swell can jump from mellow to too much quickly'],
    'Share the easy inside waves, avoid snaking the pier regulars, and leave extra space for beginners drifting wide.',
    'moderate',
    ARRAY['🧭 Easy to read sandbars', '🏖️ Plenty of room outside the pier zone', '📈 Great progression beach in summer'],
    false
  ),
  (
    '885440f6-10c2-4c70-aa40-b7b71044cda3',
    'Corolla',
    'Corolla',
    'NC',
    'USA',
    'America/New_York',
    36.3761,
    -75.8306,
    'beach',
    'beginner-intermediate',
    ARRAY['rip currents', 'shorebreak', 'strong winter sweep'],
    ARRAY['Beach parking', 'Wide beach', 'Long sandbars', 'Space to spread out'],
    55,
    140,
    280,
    40,
    12,
    10,
    0.5,
    2.5,
    '{"tide":"mid","primary_swell":{"dir_deg":95,"period_s":8},"notes":"Summer surf is mellow enough for beginners when the Outer Banks as a whole is quiet and winds stay light."}'::jsonb,
    95,
    98,
    43,
    ARRAY[5,6,7,8,9],
    'corolla-corolla-nc',
    'Outer Banks',
    'Corolla is the most beginner-friendly Outer Banks call when you want the broad, sandy feel of the northern beaches without the punchier setups farther south.',
    'Use public beach accesses or 4x4 zone parking where permitted. Distances can be longer than southern NC towns, so keep the load light.',
    'Wide sand and long, flat bars make entry straightforward. Pick a clean smaller day rather than trying to force it on a storm swell.',
    'Wait for knee- to waist-high summer peaks and plenty of shoulder. Corolla works best for learners when the forecast looks almost too mellow for advanced surfers.',
    'There is usually more room here than at the famous OBX performance spots, but summer vacation traffic still stacks up near the easiest accesses.',
    'Tiny to small summer swell, calm wind, and enough tide to keep the bars from going dry.',
    ARRAY['Outer Banks storm days are not beginner days', 'Wind ramps up quickly in open north-facing sections', 'Long walks and heat wear beginners down faster than expected'],
    'Treat it as a mellow beach day with surf, not a competitive lineup. Space is the advantage here.',
    'moderate',
    ARRAY['🐣 Softest true beginner option in the Outer Banks', '📏 Long sandbars help first rides', '🌤️ Best when the forecast looks small and clean'],
    false
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  timezone = EXCLUDED.timezone,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  break_type = EXCLUDED.break_type,
  skill_level = EXCLUDED.skill_level,
  hazards = EXCLUDED.hazards,
  features = EXCLUDED.features,
  swell_window_min_deg = EXCLUDED.swell_window_min_deg,
  swell_window_max_deg = EXCLUDED.swell_window_max_deg,
  wind_offshore_deg = EXCLUDED.wind_offshore_deg,
  wind_offshore_tol_deg = EXCLUDED.wind_offshore_tol_deg,
  wind_cross_shore_ok_kt = EXCLUDED.wind_cross_shore_ok_kt,
  wind_onshore_bad_kt = EXCLUDED.wind_onshore_bad_kt,
  preferred_tide_ft_min = EXCLUDED.preferred_tide_ft_min,
  preferred_tide_ft_max = EXCLUDED.preferred_tide_ft_max,
  preference_model = EXCLUDED.preference_model,
  aspect_deg = EXCLUDED.aspect_deg,
  swell_window_center_deg = EXCLUDED.swell_window_center_deg,
  swell_window_halfwidth_deg = EXCLUDED.swell_window_halfwidth_deg,
  best_months = EXCLUDED.best_months,
  slug = EXCLUDED.slug,
  region = EXCLUDED.region,
  description = EXCLUDED.description,
  parking_tips = EXCLUDED.parking_tips,
  access_tips = EXCLUDED.access_tips,
  wave_tips = EXCLUDED.wave_tips,
  crowd_tips = EXCLUDED.crowd_tips,
  best_conditions_prose = EXCLUDED.best_conditions_prose,
  warnings = EXCLUDED.warnings,
  local_etiquette = EXCLUDED.local_etiquette,
  crowd_level = EXCLUDED.crowd_level,
  real_takeaways = EXCLUDED.real_takeaways,
  is_private = EXCLUDED.is_private;

INSERT INTO city_editorial_content (
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
  planning_checklist
) VALUES
  (
    'wrightsville-beach',
    'nc',
    'usa',
    'Wrightsville Beach',
    'New Hanover County, North Carolina',
    'beginner',
    ARRAY[
      'Wrightsville Beach is the cleanest all-around beginner funnel in North Carolina when you want reliable surf, easy parking, and enough infrastructure to make first sessions low-friction. The beach works best for learners on small summer swell when the morning winds stay light and the sandbars have a soft shoulder.',
      'This is a great page to use when the main question is whether the drive is worth it. If Quiver shows knee- to waist-high surf, light wind, and a cleaner-looking bar away from the pier, that is usually enough for a productive beginner session.'
    ],
    '[
      {"icon":"sun","title":"Today","summary":"Bias toward first light through mid-morning. Wrightsville gets choppy fast once the sea breeze fills in."},
      {"icon":"clock","title":"Right Now","summary":"If the pier zone looks crowded, walk down the beach and find a softer shoulder instead of forcing the main peak."},
      {"icon":"calendar","title":"This Weekend","summary":"Parking and crowds get much harder after breakfast. Go early or plan a weekday rep session if possible."}
    ]'::jsonb,
    '[
      {"label":"Scan the map","href":"/map?search=wrightsville%20beach"},
      {"label":"Best time windows","href":"/best-time-to-surf/wrightsville-beach"},
      {"label":"Beginner checklist","href":"#checklist"}
    ]'::jsonb,
    ARRAY['beginner'],
    ARRAY[
      'Look for knee- to waist-high surf before you care about any app score.',
      'Choose a peak away from the pier when you want a calmer lineup.',
      'Plan for an early session before the wind turns it bumpy.',
      'Bring more water and sunscreen than you think you need; beach days here add up fast.'
    ]
  ),
  (
    'carolina-beach',
    'nc',
    'usa',
    'Carolina Beach',
    'New Hanover County, North Carolina',
    'beginner',
    ARRAY[
      'Carolina Beach is one of the best true-beginner calls in the state because the beach stays approachable on smaller summer surf and gives you multiple easy public accesses if one peak looks too steep or too crowded.',
      'Use this page when you want a mellow first session, a reasonable drive decision, or a place where learning matters more than finding the best surfer''s wave in town.'
    ],
    '[
      {"icon":"sun","title":"Today","summary":"Soft morning surf is the target. Once the wind gets into it, the beginner advantage drops fast."},
      {"icon":"clock","title":"Right Now","summary":"If the boardwalk peak looks hectic, move a few accesses away and look for cleaner reform sections."},
      {"icon":"calendar","title":"This Weekend","summary":"Expect more beach traffic than lineup pressure. The win is arriving early enough to keep both easy."}
    ]'::jsonb,
    '[
      {"label":"Open the NC map","href":"/map?search=carolina%20beach"},
      {"label":"Beach conditions nearby","href":"/beaches/usa/nc"},
      {"label":"Beginner checklist","href":"#checklist"}
    ]'::jsonb,
    ARRAY['beginner'],
    ARRAY[
      'Smaller clean surf beats a higher score with wind or crowd problems.',
      'Pick a lifeguarded access for the easiest first-day logistics.',
      'Walk off the boardwalk cluster before you judge the whole beach.',
      'If the outside peak feels too punchy, stay patient and use the inside reforms.'
    ]
  ),
  (
    'kure-beach',
    'nc',
    'usa',
    'Kure Beach',
    'New Hanover County, North Carolina',
    'beginner',
    ARRAY[
      'Kure Beach is the quieter Pleasure Island beginner option. It keeps the same small-swell usefulness as Carolina Beach but usually with a little less noise, a little less crowding, and a little more room to settle into your session.',
      'If you want a lower-pressure day to get comfortable paddling, popping up, and reading soft sandbar peaks, this is one of the better North Carolina pages to trust.'
    ],
    '[
      {"icon":"sun","title":"Today","summary":"Early small windows are best. This beach loses its mellow edge once the wind and shorebreak build together."},
      {"icon":"clock","title":"Right Now","summary":"Stay away from the pier when it gets punchy and use the quieter beachbreak sections for cleaner reps."},
      {"icon":"calendar","title":"This Weekend","summary":"You can still find space here if you arrive early, even when nearby Carolina Beach feels hectic."}
    ]'::jsonb,
    '[
      {"label":"Open the map","href":"/map?search=kure%20beach"},
      {"label":"More NC beginner spots","href":"/beginner/nc"},
      {"label":"Beginner checklist","href":"#checklist"}
    ]'::jsonb,
    ARRAY['beginner'],
    ARRAY[
      'Treat Kure as a confidence-building session beach, not a place to push big conditions.',
      'Go early enough to beat the wind and the family beach rush.',
      'Use the quieter sections away from the pier if the main peak feels too steep.',
      'Short sessions are fine; quality reps matter more than staying out forever.'
    ]
  ),
  (
    'surf-city',
    'nc',
    'usa',
    'Surf City',
    'Topsail Island, North Carolina',
    'beginner',
    ARRAY[
      'Surf City is a strong North Carolina progression page because it balances accessible beachbreak surf with enough room to move away from the pier and find a more forgiving shoulder. On smaller summer days, it gives beginners a clean read on whether a session is worth making happen.',
      'This page is most useful when you want an easy yes-or-no decision: light wind, waist-high or smaller surf, and a visible shoulder usually means go.'
    ],
    '[
      {"icon":"sun","title":"Today","summary":"The easiest beginner window is usually early. Afternoon texture shows up fast on Topsail."},
      {"icon":"clock","title":"Right Now","summary":"Skip the pier crowd if you can. The usable beginner surf is often a little farther down the beach."},
      {"icon":"calendar","title":"This Weekend","summary":"Surf City stays more manageable than some busier beach towns, but parking and clean wind still reward the early crew."}
    ]'::jsonb,
    '[
      {"label":"Open the map","href":"/map?search=surf%20city"},
      {"label":"Compare NC beaches","href":"/beaches/usa/nc"},
      {"label":"Beginner checklist","href":"#checklist"}
    ]'::jsonb,
    ARRAY['beginner'],
    ARRAY[
      'Go when the forecast looks small and clean rather than exciting.',
      'Use the beach to your advantage and move off the busiest takeoff.',
      'Look for soft inside reforms if the outside looks steeper than expected.',
      'Treat light wind as a stronger signal than a slightly bigger wave number.'
    ]
  ),
  (
    'corolla',
    'nc',
    'usa',
    'Corolla',
    'Outer Banks, North Carolina',
    'beginner',
    ARRAY[
      'Corolla is the most believable beginner page in the Outer Banks when the region is on its mellower summer setting. It gives you wide beach, long sandbars, and far less of the heavy-performance feel that defines the punchier southern Outer Banks breaks.',
      'The call here is simple: if the forecast looks almost too small for advanced surfers, Corolla can be perfect for a learner. If it looks stormy, skip it.'
    ],
    '[
      {"icon":"sun","title":"Today","summary":"Corolla works for beginners when the forecast looks small, clean, and unremarkable. That is the point."},
      {"icon":"clock","title":"Right Now","summary":"Use the extra beach width to find a sandbar with room. The best learner sessions here feel spacious, not crowded."},
      {"icon":"calendar","title":"This Weekend","summary":"Vacation traffic matters more than lineup pressure. Plan around access, heat, and longer beach carries."}
    ]'::jsonb,
    '[
      {"label":"Open the map","href":"/map?search=corolla"},
      {"label":"More NC beginner spots","href":"/beginner/nc"},
      {"label":"Beginner checklist","href":"#checklist"}
    ]'::jsonb,
    ARRAY['beginner'],
    ARRAY[
      'Only trust Corolla for beginner sessions on genuinely small surf.',
      'Bring less gear and more patience; the accesses can be longer than southern NC towns.',
      'Use the room on the beach to find space instead of forcing the first peak you see.',
      'If the forecast looks stormy, choose another city rather than trying to make Corolla work.'
    ]
  )
ON CONFLICT (city_slug, state_slug, country_slug, intent)
DO UPDATE SET
  city_name = EXCLUDED.city_name,
  region_label = EXCLUDED.region_label,
  description = EXCLUDED.description,
  session_timing = EXCLUDED.session_timing,
  quick_links = EXCLUDED.quick_links,
  featured_intents = EXCLUDED.featured_intents,
  planning_checklist = EXCLUDED.planning_checklist,
  updated_at = now();

WITH beach_editorial_seed (slug, content) AS (
  VALUES
    (
      'wrightsville-beach-wrightsville-beach-nc',
      $${
        "why_beginners_love_it": [
          "Reliable summer beachbreak with softer shoulders on small days",
          "Easy public access and a low-friction pre-session check",
          "Enough room to move away from the pier crowd",
          "Warm-season consistency makes it good for building reps"
        ],
        "logistics": {
          "parking": "Paid public parking and street spots nearby; easiest before 8:30am in summer.",
          "walk_distance": "Short beach-access walk from most public lots.",
          "lifeguards": true,
          "best_hours": "Sunrise through mid-morning before the sea breeze fills in.",
          "facilities": "Restrooms, showers, rentals, and coffee nearby."
        },
        "description": "Wrightsville Beach is one of the best North Carolina spots for beginners who want a real surf town with easy logistics. The sweet spot is a small clean morning where you can paddle out away from the pier and spend the session getting comfortable instead of surviving.",
        "what_to_expect": {
          "wave_size": "1-3 ft is ideal for beginners",
          "wave_type": "Soft beachbreak peaks with reform sections",
          "bottom": "Sand",
          "hazards": ["Rip currents around the pier", "Afternoon wind chop"],
          "water_temp": "Upper 50s in winter to upper 70s in summer",
          "skill_level": "Beginner to lower intermediate on small clean days"
        },
        "seasonal_guide": {
          "summer": "Best true-beginner season thanks to small surf and warmer water.",
          "fall": "Great when tropical swell stays modest; skip the bigger storm windows.",
          "winter": "Can be surfable but often colder, windier, and more advanced.",
          "spring": "Fun progression season when sandbars settle and the wind behaves."
        },
        "important_note": "If the pier peak looks crowded or punchy, walking a little farther is usually the better beginner move."
      }$$::jsonb
    ),
    (
      'carolina-beach-carolina-beach-nc',
      $${
        "why_beginners_love_it": [
          "Gentler summer surf than most punchier Outer Banks beaches",
          "Wide beach with multiple public accesses",
          "Easy to find softer inside reforms on smaller days",
          "Good choice when you want a low-pressure first surf"
        ],
        "logistics": {
          "parking": "Paid boardwalk lots and street parking; easier before the late-morning beach rush.",
          "walk_distance": "Usually a short walk over the dune line.",
          "lifeguards": true,
          "best_hours": "Early morning through mid-morning.",
          "facilities": "Restrooms, showers, food, rentals, and surf schools nearby."
        },
        "description": "Carolina Beach is one of the clearest beginner wins in North Carolina because you can keep the session simple: park, walk a short access, and hunt for a soft peak away from the busiest boardwalk crowd. When it is small and clean, it is the kind of place where beginners can actually relax enough to learn.",
        "what_to_expect": {
          "wave_size": "1-3 ft is best for new surfers",
          "wave_type": "Soft beachbreak with mellow reform sections",
          "bottom": "Sand",
          "hazards": ["Rip currents on stronger south swell", "Afternoon chop", "Occasional dumpy shorebreak"],
          "water_temp": "Upper 50s in winter to upper 70s in summer",
          "skill_level": "Beginner to lower intermediate on small clean surf"
        },
        "seasonal_guide": {
          "summer": "Prime beginner season with smaller surf and friendlier weather.",
          "fall": "Still useful if the swell stays modest; bigger tropical surf stops being beginner-friendly.",
          "winter": "Often colder, windier, and more frustrating for first sessions.",
          "spring": "Can be really good for progression when clean weather lines up."
        },
        "important_note": "If the main boardwalk peak looks crowded, a short walk usually finds a much friendlier beginner section."
      }$$::jsonb
    ),
    (
      'kure-beach-kure-beach-nc',
      $${
        "why_beginners_love_it": [
          "Quieter feel than Carolina Beach",
          "Soft summer surf on the right days",
          "Plenty of room to focus on basics instead of lineup stress",
          "Short access walks keep first sessions easy"
        ],
        "logistics": {
          "parking": "Public lots near the oceanfront park and side streets; easier than Carolina Beach if you arrive early.",
          "walk_distance": "Short walk from most accesses.",
          "lifeguards": true,
          "best_hours": "Sunrise to late morning before wind builds.",
          "facilities": "Restrooms, showers, playground, and shops nearby."
        },
        "description": "Kure Beach is a strong beginner confidence beach. It is not about headline surf; it is about finding a mellow window, staying relaxed, and getting repetitions in water that feels manageable.",
        "what_to_expect": {
          "wave_size": "1-3 ft works best",
          "wave_type": "Gentle beachbreak with inside reform runners",
          "bottom": "Sand",
          "hazards": ["Pier currents", "Steeper shorebreak on bigger tides", "Wind chop after lunch"],
          "water_temp": "Upper 50s in winter to upper 70s in summer",
          "skill_level": "Beginner to lower intermediate on smaller days"
        },
        "seasonal_guide": {
          "summer": "Best season for first sessions and mellow progression.",
          "fall": "Good when surf stays modest; skip the more energetic tropical pulses.",
          "winter": "Usually too cold or too reactive for a true beginner recommendation.",
          "spring": "Useful progression season if the weather stays clean."
        },
        "important_note": "Treat Kure as a small-day learning beach and it will usually make more sense than trying to force it on bigger surf."
      }$$::jsonb
    ),
    (
      'surf-city-surf-city-nc',
      $${
        "why_beginners_love_it": [
          "Friendly beachbreak outside the pier zone",
          "Soft small-swell windows that reward patience",
          "Good progression option once you are past day-one nerves",
          "Enough beach to spread out and find a calmer peak"
        ],
        "logistics": {
          "parking": "Public lots and access parking near the beach; easiest before the beach traffic ramps up.",
          "walk_distance": "Short walk from most numbered accesses.",
          "lifeguards": true,
          "best_hours": "Early morning through mid-morning.",
          "facilities": "Restrooms, showers, rentals, and food nearby."
        },
        "description": "Surf City is a practical progression beach for North Carolina beginners because it lets you compare multiple accessible sandbars quickly and choose the one that looks manageable. The best sessions here usually come from small, clean, almost-underwhelming forecasts.",
        "what_to_expect": {
          "wave_size": "1-3 ft for beginners, occasionally 3-4 ft for progression days",
          "wave_type": "Beachbreak peaks with softer shoulders away from the pier",
          "bottom": "Sand",
          "hazards": ["Rip currents near the pier", "Fishing lines", "Afternoon wind chop"],
          "water_temp": "Upper 50s in winter to upper 70s in summer",
          "skill_level": "Beginner to intermediate depending on swell size"
        },
        "seasonal_guide": {
          "summer": "Best beginner season with warm water and manageable surf.",
          "fall": "Great for progression if the surf stays under control; tropical spikes change the equation fast.",
          "winter": "Colder and less forgiving for new surfers.",
          "spring": "Often clean and useful for building confidence."
        },
        "important_note": "The pier is the easiest visual landmark, not the best beginner takeoff zone."
      }$$::jsonb
    ),
    (
      'corolla-corolla-nc',
      $${
        "why_beginners_love_it": [
          "Wide sandy beach with room to stay out of the way",
          "Long sandbars soften small summer surf",
          "Most approachable true beginner option in the Outer Banks",
          "Better for mellow confidence-building than chasing heavier OBX waves"
        ],
        "logistics": {
          "parking": "Public access parking and some longer carries depending on where you start.",
          "walk_distance": "Can be longer than southern NC beach towns, especially near quieter accesses.",
          "lifeguards": true,
          "best_hours": "Early clean mornings on genuinely small surf.",
          "facilities": "Public beach access, seasonal lifeguards, and nearby shops."
        },
        "description": "Corolla only belongs on a beginner list when the forecast is small and clean, but when that happens it can be the easiest way to surf the Outer Banks without stepping into the heavier, faster setups farther south. Think mellow beach day with waves, not performance surf mission.",
        "what_to_expect": {
          "wave_size": "1-2 ft for true beginners, maybe 3 ft for confident learners",
          "wave_type": "Soft beachbreak with long rolling shoulders on the right sandbars",
          "bottom": "Sand",
          "hazards": ["Wind exposure", "Rip currents on bigger days", "Longer beach carries"],
          "water_temp": "Mid 50s in winter to upper 70s in summer",
          "skill_level": "Beginner on small days only"
        },
        "seasonal_guide": {
          "summer": "Best and most believable beginner season.",
          "fall": "Can stay useful on tiny days but turns advanced quickly on storm swell.",
          "winter": "Generally not a first-session recommendation.",
          "spring": "Works when the forecast is clean and tame."
        },
        "important_note": "If the surf looks punchy enough to impress experienced surfers, it is not the right Corolla day for beginners."
      }$$::jsonb
    )
)
INSERT INTO beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  b.id,
  'beginner_notes',
  seed.content
FROM beach_editorial_seed AS seed
JOIN public.beaches AS b
  ON b.slug = seed.slug
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id, content_type)
DO UPDATE SET
  content = EXCLUDED.content,
  generated_at = now();

WITH photo_candidates (
  slug,
  source_id,
  image_url,
  thumb_url,
  title,
  creator_name,
  creator_url,
  license_code,
  license_url,
  attribution_html
) AS (
  VALUES
    (
      'carolina-beach-carolina-beach-nc',
      'File:Surf at Carolina Beach, NC IMG 4434.JPG',
      'https://upload.wikimedia.org/wikipedia/commons/f/ff/Surf_at_Carolina_Beach%2C_NC_IMG_4434.JPG',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Surf_at_Carolina_Beach%2C_NC_IMG_4434.JPG/1280px-Surf_at_Carolina_Beach%2C_NC_IMG_4434.JPG',
      'Surf at Carolina Beach, NC IMG 4434',
      'Billy Hathorn',
      'https://commons.wikimedia.org/wiki/User:Billy_Hathorn',
      'CC BY 3.0',
      'https://creativecommons.org/licenses/by/3.0',
      'Photo by Billy Hathorn, licensed CC BY 3.0 via Wikimedia Commons.'
    ),
    (
      'kure-beach-kure-beach-nc',
      'File:Sea grasses at Kure Beach.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/a/a7/Sea_grasses_at_Kure_Beach.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Sea_grasses_at_Kure_Beach.jpg/1280px-Sea_grasses_at_Kure_Beach.jpg',
      'Sea grasses at Kure Beach',
      'Patrick Reynolds',
      'https://commons.wikimedia.org/wiki/User:Dukepiki',
      'CC BY-SA 4.0',
      'https://creativecommons.org/licenses/by-sa/4.0',
      'Photo by Patrick Reynolds, licensed CC BY-SA 4.0 via Wikimedia Commons.'
    ),
    (
      'surf-city-surf-city-nc',
      'File:Public Beach Access 16, Surf City (May 2023) 02.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/c/c2/Public_Beach_Access_16%2C_Surf_City_%28May_2023%29_02.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Public_Beach_Access_16%2C_Surf_City_%28May_2023%29_02.jpg/1280px-Public_Beach_Access_16%2C_Surf_City_%28May_2023%29_02.jpg',
      'Public Beach Access 16, Surf City (May 2023) 02',
      'DiscoA340',
      'https://commons.wikimedia.org/wiki/User:DiscoA340',
      'CC BY-SA 4.0',
      'https://creativecommons.org/licenses/by-sa/4.0',
      'Photo by DiscoA340, licensed CC BY-SA 4.0 via Wikimedia Commons.'
    ),
    (
      'corolla-corolla-nc',
      'File:Corolla, North Carolina view from the lighthouse.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/0/00/Corolla%2C_North_Carolina_view_from_the_lighthouse.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Corolla%2C_North_Carolina_view_from_the_lighthouse.jpg/1280px-Corolla%2C_North_Carolina_view_from_the_lighthouse.jpg',
      'Corolla, North Carolina view from the lighthouse',
      'ryaninc',
      'https://www.flickr.com/photos/93086051@N00',
      'CC BY 2.0',
      'https://creativecommons.org/licenses/by/2.0',
      'Photo by ryaninc, licensed CC BY 2.0 via Wikimedia Commons.'
    )
)
INSERT INTO public.beach_photos (
  beach_id,
  source,
  source_id,
  image_url,
  thumb_url,
  title,
  creator_name,
  creator_url,
  license_code,
  license_url,
  attribution_html,
  approved,
  deleted_at
)
SELECT
  b.id,
  'wikimedia',
  photo.source_id,
  photo.image_url,
  photo.thumb_url,
  photo.title,
  photo.creator_name,
  photo.creator_url,
  photo.license_code,
  photo.license_url,
  photo.attribution_html,
  true,
  NULL::timestamptz
FROM photo_candidates AS photo
JOIN public.beaches AS b
  ON b.slug = photo.slug
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id, source, source_id)
DO UPDATE SET
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

COMMIT;
