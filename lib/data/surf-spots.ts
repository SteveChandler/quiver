export type SurfCitySlug = "san-diego" | "orange-county";

export type SurfIntentSlug =
  | "beginner"
  | "least-crowded"
  | "tide"
  | "water-temp";

export interface SurfIntentDefinition {
  slug: SurfIntentSlug;
  label: string;
  titleTemplate: (args: { cityName: string }) => string;
  heading: (args: { cityName: string }) => string;
  metaDescription: (args: { cityName: string; topSpots: string[] }) => string;
  intro: (args: { cityName: string }) => string;
  focusPoints: string[];
}

export const SURF_INTENTS: Record<SurfIntentSlug, SurfIntentDefinition> = {
  beginner: {
    slug: "beginner",
    label: "Beginner Friendly",
    titleTemplate: ({ cityName }) =>
      `${cityName} Beginner Surf Spots, Lessons & Safety Tips`,
    heading: ({ cityName }) =>
      `${cityName} beginner surf guide and mellow waves`,
    metaDescription: ({ cityName, topSpots }) =>
      `Find the safest beginner surf spots in ${cityName}, including ${topSpots
        .slice(0, 3)
        .join(
          ", "
        )}. Get coaching tips, mellow wave forecasts, and session planning advice designed for new surfers.`,
    intro: ({ cityName }) =>
      `${cityName} has a long season of approachable peelers, surf schools, and forgiving sandbars. This guide highlights where new surfers can practice, how to pick a window with manageable tides, and what to expect from parking to post-surf snacks.`,
    focusPoints: [
      "Soft wave takeoff zones and sand-bottom channels",
      "Typical crowd patterns and local school schedules",
      "Weather, tide, and swell ranges that keep waves manageable",
      "Nearby shops for rentals, foamies, and lessons",
    ],
  },
  "least-crowded": {
    slug: "least-crowded",
    label: "Less Crowded",
    titleTemplate: ({ cityName }) =>
      `${cityName} Least Crowded Surf Spots & Backup Plans`,
    heading: ({ cityName }) =>
      `Where to surf in ${cityName} when the crowd packs the peak`,
    metaDescription: ({ cityName, topSpots }) =>
      `Skip the pack and score cleaner sessions in ${cityName}. Explore lower-profile spots like ${topSpots
        .slice(0, 3)
        .join(
          ", "
        )}, learn the best tide swings for stealth windows, and get quick pivot options if the lot is full.`,
    intro: ({ cityName }) =>
      `${cityName} can get claustrophobic on swell pulses, but shifting a few blocks or timing the tide flip often unlocks empty shoulders. Use this playbook to pivot quickly with backup spots, parking intel, and crowd-aware forecasting.`,
    focusPoints: [
      "Secondary peaks and tide windows that thin crowds",
      "Parking tricks and walk-in trails most visitors skip",
      "Forecast cues that trigger locals-only surges",
      "Nearby alternates when the primary target turns into a zoo",
    ],
  },
  tide: {
    slug: "tide",
    label: "Tide Timing",
    titleTemplate: ({ cityName }) =>
      `${cityName} Tide Chart & Best Tidal Windows for Surfing`,
    heading: ({ cityName }) =>
      `${cityName} tide guide for faster wave selection`,
    metaDescription: ({ cityName, topSpots }) =>
      `Dial in the tide for ${cityName} surf spots like ${topSpots
        .slice(0, 3)
        .join(
          ", "
        )}. See optimal tide heights, upcoming swings, and how changing water levels reshuffle sandbars and reefs.`,
    intro: ({ cityName }) =>
      `Tides dictate which banks fire in ${cityName}. This breakdown maps upcoming highs and lows to the sandbars, reefs, and piers that flip on with just a foot of variance.`,
    focusPoints: [
      "Annotated tide windows tied to specific breaks",
      "How lunar cycles reshape sandbars through the season",
      "Safety notes for rip-prone outbound tides",
      "Session planning tips for dawn patrol versus sunset",
    ],
  },
  "water-temp": {
    slug: "water-temp",
    label: "Water Temperature",
    titleTemplate: ({ cityName }) =>
      `${cityName} Water Temperature & Wetsuit Guide`,
    heading: ({ cityName }) =>
      `Live water temps and wetsuit planner for ${cityName}`,
    metaDescription: ({ cityName, topSpots }) =>
      `Stay warm and surf longer in ${cityName}. Track water temperatures, upwelling events, and recommended wetsuit thickness for breaks like ${topSpots
        .slice(0, 3)
        .join(", ")}.`,
    intro: ({ cityName }) =>
      `From spring upwelling chills to balmy south-swell summers, ${cityName} water temps fluctuate more than the forecast suggests. Use this guide to pick the right rubber and understand when sudden drops are coming.`,
    focusPoints: [
      "Weekly temperature trends and seasonal averages",
      "Gear recommendations for dawn patrol versus midday",
      "Upwelling signals that drop temps overnight",
      "Health and recovery tips for long cold sessions",
    ],
  },
};

export interface SurfCity {
  slug: SurfCitySlug;
  name: string;
  regionLabel: string;
  hero: string;
  summary: string;
  description: string[];
  highlights: string[];
  topSpots: string[];
  featuredIntents: SurfIntentSlug[];
  quickLinks: { label: string; href: string }[];
}

export const SURF_CITIES: Record<SurfCitySlug, SurfCity> = {
  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    regionLabel: "San Diego County, California",
    hero:
      "San Diego blends canyon-fed power with user-friendly beachbreaks, so you can chase hollow reefs at dawn and still sneak a log session before lunch.",
    summary:
      "From Torrey Pines to Imperial Beach, San Diego delivers a 70-mile mix of reefs, points, and playful sandbars. Local surfers juggle marine layer mornings, relentless sunshine, and canyon bathymetry that supercharges winter swells.",
    description: [
      "San Diego surf culture is a rhythm of dawn patrols, parking lot burritos, and checking canyon buoys more often than work email. North County reefs translate long-period northwest lines into running walls, while Mission Bay sandbars stay approachable for crews still dialing their pop-up.",
      "Seasonality matters. Autumn brings glassy peaks with combo swells, winter lights up submarine canyons like Blacks, and spring favors wind-sensitive windows with south pulses. Summer stays playful along La Jolla Shores and the Coronado sandbars with warm water and forgiving tides.",
      "Whether you're logging sessions for bragging rights or tracking progression in the Quiver journal, San Diego gives you enough spot diversity to chase goals year-round. The key is pairing the right tide with the right bank and having a backup when the lot is full.",
    ],
    highlights: [
      "North County reefs that stay consistent through winter",
      "Mission Beach, PB, and La Jolla Shores for mellow practice days",
      "Daily tide swings over six feet reshape sandbars overnight",
      "Local forecast knowledge rooted in canyon bathymetry",
    ],
    topSpots: [
      "blacks-beach",
      "swamis",
      "windansea",
      "la-jolla-shores",
      "mission-beach",
      "pacific-beach",
      "ocean-beach",
      "sunset-cliffs",
      "cardiff-reef",
      "pipes",
      "del-mar",
      "torrey-pines",
      "san-elijo",
      "silver-strand",
      "imperial-beach",
    ],
    featuredIntents: ["beginner", "least-crowded", "tide", "water-temp"],
    quickLinks: [
      { label: "San Diego surf map", href: "/map?city=san-diego" },
      { label: "Today’s tide chart", href: "/tide/san-diego" },
      { label: "Beginner-friendly breaks", href: "/beginner/san-diego" },
      { label: "Session log templates", href: "/app" },
    ],
  },
  "orange-county": {
    slug: "orange-county",
    name: "Orange County",
    regionLabel: "Orange County, California",
    hero:
      "Orange County pairs cobblestone points with high-tide beachies, delivering performance peaks, longboard playgrounds, and dependable Santa Ana offshore mornings.",
    summary:
      "The stretch from San Onofre to Seal Beach stacks up classic California energy. Cobblestone points like Trestles reward cardio with machine-like walls, while Bolsa Chica and Huntington Pier keep the contest vibe alive year-round.",
    description: [
      "Orange County’s surf scene revolves around tides and traffic. Dawn patrol still wins, but late-morning Santa Ana winds can polish shoulders midweek. South swells wake up the points while combo windswell keeps beachies rippable even when long-period energy fades.",
      "San Clemente is the training ground for pros for a reason. Consistent energy, organized lineups, and cobblestone reefs reward rail-to-rail surfing. Newport and Huntington bring punchy sandbars with localism focused near the pier peaks, leaving outer sandbars approachable.",
      "Families, longboard crews, and beginners flock to Doheny and Old Man’s for predictable rollers that stay fun through higher tides. When the pack stacks up, shifting north to Bolsa or Seal Beach can save the session with less competitive peaks.",
    ],
    highlights: [
      "World-class points at Lower and Upper Trestles",
      "Reliable south swell magnets with Santa Ana offshores",
      "Dedicated beginner zones at Doheny and San Onofre State Beach",
      "Night-lighted sessions near Huntington Pier during summer events",
    ],
    topSpots: [
      "lowers-trestles",
      "uppers-trestles",
      "churches",
      "san-onofre",
      "old-mans",
      "doheny-state-beach",
      "huntington-pier",
      "newport-56th-street",
      "bolsa-chica",
      "seal-beach",
    ],
    featuredIntents: ["beginner", "least-crowded", "tide", "water-temp"],
    quickLinks: [
      { label: "Orange County surf camera list", href: "/map?city=orange-county" },
      { label: "Weekend crowd forecast", href: "/least-crowded/orange-county" },
      { label: "Warm-water breaks", href: "/water-temp/orange-county" },
      { label: "Plan a Trestles strike mission", href: "/spots/lowers-trestles" },
    ],
  },
};

export interface SurfSpot {
  slug: string;
  name: string;
  citySlug: SurfCitySlug;
  region: string;
  coordinates: { lat: number; lng: number };
  overview: string;
  history: string;
  conditions: string;
  tideAdvice: string;
  swellAdvice: string;
  windAdvice: string;
  waterTemp: string;
  hazards: string[];
  skillLevel:
    | "Beginner friendly"
    | "Intermediate"
    | "Intermediate to expert"
    | "Advanced"
    | "Longboard friendly";
  bestSeason: string;
  crowdFactor: "Light" | "Moderate" | "Heavy";
  parking: string;
  amenities: string[];
  nearby: string[];
  faq: { question: string; answer: string }[];
  speakableSummary: string;
  beginnerNotes?: string;
  intentTags: SurfIntentSlug[];
}

export const SURF_SPOTS: Record<string, SurfSpot> = {
  "blacks-beach": {
    slug: "blacks-beach",
    name: "Blacks Beach",
    citySlug: "san-diego",
    region: "La Jolla, San Diego",
    coordinates: { lat: 32.8851, lng: -117.252 },
    overview:
      "Blacks Beach channels canyon energy into powerful wedges that break with more punch than any other San Diego beachbreak. Long-period northwest swells focus into double-up peaks, while south swells wrap in with surprising consistency.",
    history:
      "UC San Diego freesurfers popularized Blacks in the 1970s, ferrying boards down the cliffs before dawn. Despite the challenging hike, local chargers keep it orderly thanks to a blend of respect and a healthy fear of the rip.",
    conditions:
      "Expect steep takeoffs, shifting peaks, and strong currents that make keeping position critical. Shoulder-high days still pack a punch, with tubes on low tide mornings and longer walls through the mid tide push.",
    tideAdvice:
      "The canyon keeps it working through the tide cycle, but mid tide on the outgoing swing grooms the barrel sections and smooths the shoulder.",
    swellAdvice:
      "Picks up anything with west in it. Prime swell blend is WNW at 4-6 ft @ 16 seconds with a smaller SW reinforcing the lefts.",
    windAdvice:
      "Calm or light easterly winds groom the faces. Afternoon sea breeze can crumble the lip but the canyon keeps it rideable longer than neighboring spots.",
    waterTemp:
      "Winter swings from 56-58°F while late summer sees 68-70°F. Upwelling can drop temps five degrees overnight during south swell events.",
    hazards: [
      "Steep cliff trail with no quick exit",
      "Powerful rip currents near the submarine canyon",
      "Crowded takeoff zones with advanced surfers",
    ],
    skillLevel: "Intermediate to expert",
    bestSeason: "Late fall through spring, with south swells adding options in summer",
    crowdFactor: "Heavy",
    parking:
      "Park at the Glider Port lot or Torrey Pines State Beach. Expect a 10-15 minute hike down either the Goat Trail or the paved road.",
    amenities: ["No restrooms on the sand", "Closest showers at La Jolla Shores"],
    nearby: ["torrey-pines", "la-jolla-shores", "del-mar"],
    faq: [
      {
        question: "What tide is best for Blacks Beach?",
        answer:
          "Aim for mid tide on a fading high if you want makeable barrels. Low tide can get sketchy with double-ups, while full high tide mushes the shoulders unless the swell is overhead.",
      },
      {
        question: "Is Blacks Beach good for beginners?",
        answer:
          "No. The rip currents, steep drops, and crowded peaks make Blacks a better fit for confident shortboarders. Beginners should opt for La Jolla Shores or Mission Beach.",
      },
      {
        question: "How crowded does Blacks Beach get?",
        answer:
          "Expect a stacked dawn patrol whenever the canyon is lined up. Weekdays offer the best chance at a mellow pack, especially on smaller west swells.",
      },
    ],
    speakableSummary:
      "Blacks Beach offers powerful, canyon-fueled waves. Target a mid tide WNW swell for the cleanest barrels and be prepared for a demanding paddle.",
    intentTags: ["least-crowded", "tide", "water-temp"],
  },
  swamis: {
    slug: "swamis",
    name: "Swami's",
    citySlug: "san-diego",
    region: "Encinitas, San Diego",
    coordinates: { lat: 33.0356, lng: -117.2923 },
    overview:
      "Swami's is a reef point that peels with machine-like precision when combo swells line up. The right wraps around the kelp line, offering long walls for carves and noserides alike.",
    history:
      "Named after the Self-Realization Fellowship temple perched above the bluff, Swami's has been a pilgrimage spot for stylists since the longboard era. The walkway down the bluff funnels dawn patrollers into an orderly queue.",
    conditions:
      "Shoulder to head-high mornings deliver ruler-straight walls with a forgiving takeoff if you slot into the rotation. Kelp beds smooth the surface, and the inside section keeps rolling for lengthy rides.",
    tideAdvice:
      "Performs best from mid to high tide when the reef is covered enough to smooth the entry. Low tide exposes cobblestones and steepens the face.",
    swellAdvice:
      "Combo WNW and SW swells are ideal, helping the wave wrap and extend the shoulder. Pure south swells still work but shorten the ride.",
    windAdvice:
      "Light easterlies are a bonus, but Swami's often stays glassy longer than surrounding breaks thanks to bluff protection.",
    waterTemp:
      "Winter hovers around 57-59°F, climbing to 69°F in late summer. Kelp upwelling can chill the lineup during strong south swells.",
    hazards: [
      "Crowded lineups with strict order",
      "Submerged reef on extreme low tides",
      "Kelp drifts that snag leashes",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Fall and winter for combo swells, summer for smaller log sessions",
    crowdFactor: "Heavy",
    parking:
      "Limited bluff-top lot. Street parking along Highway 101 fills early; arrive before sunrise on swell pulses.",
    amenities: [
      "Restrooms and showers at the base of the stairs",
      "Healthy food spots within walking distance",
    ],
    nearby: ["pipes", "cardiff-reef", "san-elijo"],
    faq: [
      {
        question: "Is Swami's suitable for longboarding?",
        answer:
          "Yes. On waist to chest-high combo swells the wave is a longboard heaven with extended trimming sections. Bigger days favor shortboards.",
      },
      {
        question: "How do I avoid crowds at Swami's?",
        answer:
          "Aim for midweek mid-morning sessions when the first shift heads to work. Alternatively, surf tide swings when the takeoff narrows and some surfers tap out.",
      },
      {
        question: "What surfboard works best at Swami's?",
        answer:
          "Bring a board with glide—high volume shortboards, mid-lengths, or longboards excel. You want paddle power to slot into the rotation early.",
      },
    ],
    speakableSummary:
      "Swami's serves up long reef rights with a strict lineup rotation. Target mid tide combo swells and bring patience for the paddle back out.",
    intentTags: ["tide", "water-temp"],
  },
  windansea: {
    slug: "windansea",
    name: "Windansea",
    citySlug: "san-diego",
    region: "La Jolla, San Diego",
    coordinates: { lat: 32.8324, lng: -117.2806 },
    overview:
      "Windansea is a shallow reef that draws in west swells and unloads with punchy peaks and hollow pockets. The takeoff is steep, rewarding precise positioning.",
    history:
      "Made famous by the surf shack on the sand and the powerhouse locals of the 50s and 60s, Windansea remains a proving ground. The reef shifts subtly with sand movement, keeping locals sharp.",
    conditions:
      "Low tide mornings bring fast, tubing sections. When the swell direction shifts south, wrapping lefts offer a short but powerful ride. The inside shorebreak can be unforgiving.",
    tideAdvice:
      "Low to mid tide delivers the sharpest shape. High tide softens the wave and closes out near the rocks.",
    swellAdvice:
      "West to northwest swells provide the most hollow peaks. South swells still work but lean toward shorter, racing rights.",
    windAdvice:
      "Calm mornings or light east winds are best. Afternoon onshores degrade the face quickly because the wave is so exposed.",
    waterTemp:
      "Ranges from 57°F in winter to 69°F in late summer. Sudden upwelling during early summer can bring temps down into the low 60s overnight.",
    hazards: [
      "Shallow reef at the takeoff",
      "Strong local crew auditing etiquette",
      "Backwash and shorebreak at higher tides",
    ],
    skillLevel: "Intermediate to expert",
    bestSeason: "Fall and winter when west swells dominate",
    crowdFactor: "Heavy",
    parking:
      "Street parking along Neptune Place fills quickly. Check side streets and be prepared for a walk.",
    amenities: [
      "No restrooms on site",
      "Closest showers at La Jolla Cove",
    ],
    nearby: ["la-jolla-shores", "sunset-cliffs", "blacks-beach"],
    faq: [
      {
        question: "Is Windansea good for beginners?",
        answer:
          "No. The shallow reef, steep takeoff, and tight pack make Windansea best for experienced surfers. Beginners should opt for La Jolla Shores.",
      },
      {
        question: "When is Windansea at its best?",
        answer:
          "Aim for a 3-5 foot west swell with light offshore winds and a mid-morning low tide. Expect fast barrels and heavy lips.",
      },
      {
        question: "Can I surf Windansea during high tide?",
        answer:
          "High tide flattens the wave and causes backwash, but on overhead swells it can still produce makeable rights. Expect a shorter ride.",
      },
    ],
    speakableSummary:
      "Windansea breaks over a shallow reef and favors 3 to 5 foot west swells on a dropping tide. Bring experience, respect, and a board that handles steep drops.",
    intentTags: ["least-crowded", "tide"],
  },
  "la-jolla-shores": {
    slug: "la-jolla-shores",
    name: "La Jolla Shores",
    citySlug: "san-diego",
    region: "La Jolla, San Diego",
    coordinates: { lat: 32.8578, lng: -117.2561 },
    overview:
      "La Jolla Shores is San Diego's training ground, offering forgiving sandbars and a wide beach that disperses crowds. The gently sloping bathymetry keeps waves approachable.",
    history:
      "Surf schools and lifeguard training programs have used La Jolla Shores for decades because of its mellow profile. It's the go-to for first timers and longboard cruisers when other reefs are maxed.",
    conditions:
      "Expect soft peaks through most tides with occasional punchy corners near Scripps Pier. The inside reforms into long whitewater rides perfect for practice.",
    tideAdvice:
      "Handles all tides but prefers mid to high for smoother takeoffs. Extreme low tides expose sandbars and create shorebreak.",
    swellAdvice:
      "Picks up combo swells from the west and south. Large NW swells get blocked by La Jolla canyon, keeping things manageable even when other spots are firing.",
    windAdvice:
      "Morning glass is common. Afternoon onshores add texture but the wave remains surfable for foamies and soft-tops.",
    waterTemp:
      "Winter averages 58°F, summer ranges 68-70°F. Upwelling is less dramatic thanks to the protected bay.",
    hazards: [
      "Beginner crowds with rental boards",
      "Occasional rip currents near Scripps Pier",
      "Seasonal stingrays in the shallows",
    ],
    skillLevel: "Beginner friendly",
    bestSeason:
      "Year-round with reliable summer south swells and gentle winter waves",
    crowdFactor: "Moderate",
    parking:
      "Large beachside lot fills early on weekends. Additional street parking along Avenida De La Playa.",
    amenities: [
      "Restrooms and showers along the boardwalk",
      "Surf shops and cafes within two blocks",
    ],
    nearby: ["blacks-beach", "windansea", "mission-beach"],
    faq: [
      {
        question: "Is La Jolla Shores good for beginners?",
        answer:
          "Yes. Soft sand, gentle waves, and lifeguard coverage make it one of the best beginner beaches in Southern California.",
      },
      {
        question: "What is the best time to surf La Jolla Shores?",
        answer:
          "Mid-morning high tides with waist-high combo swells offer glassy peelers. For lesson bookings, target weekdays to avoid weekend crowds.",
      },
      {
        question: "Are there surf rentals at La Jolla Shores?",
        answer:
          "Multiple surf shops on Avenida De La Playa rent boards, wetsuits, and offer lessons. Reserve ahead during summer.",
      },
    ],
    speakableSummary:
      "La Jolla Shores delivers mellow, beginner-friendly surf on sandbars that work through most tides. Expect soft peaks, accessible parking, and a supportive lineup.",
    beginnerNotes:
      "Stick to the south end near the lifeguard towers for the softest rollers and the widest channels for paddling back out.",
    intentTags: ["beginner", "water-temp"],
  },
  "mission-beach": {
    slug: "mission-beach",
    name: "Mission Beach",
    citySlug: "san-diego",
    region: "Mission Beach, San Diego",
    coordinates: { lat: 32.7662, lng: -117.2529 },
    overview:
      "Mission Beach features sandbars that shift with every tide swing, creating fun peaks for longboards and fish when combo swells arrive.",
    history:
      "Adjacent to the boardwalk and Belmont Park, Mission Beach has long been the accessible surf option for visitors and locals who appreciate the post-surf burrito run.",
    conditions:
      "Expect punchy waist to chest-high peaks that reform on the inside. The south jetty can produce longer rides during big south swells.",
    tideAdvice:
      "Prefers mid tide. Low tide can become dumpy while high tide softens the wave and pushes it to shore.",
    swellAdvice:
      "Combo west and south swells keep the sandbars honest. Pure windswell is surfable but sectiony.",
    windAdvice:
      "Morning glass or light offshore winds keep the peaks defined. Afternoon sea breeze often kicks in around 11 a.m.",
    waterTemp:
      "Winter lows near 58°F, summer highs around 69°F. Occasionally warmer than nearby breaks because of the bay influence.",
    hazards: [
      "Rip currents near the jetty",
      "Heavy recreational beach traffic",
      "Seasonal stingrays in shallow water",
    ],
    skillLevel: "Beginner friendly",
    bestSeason: "Spring through fall with combo swells",
    crowdFactor: "Moderate",
    parking:
      "Street parking along Mission Boulevard plus a large lot near Belmont Park. Expect competition during summer.",
    amenities: [
      "Showers and restrooms along the boardwalk",
      "Restaurants, rentals, and bike shops on every block",
    ],
    nearby: ["pacific-beach", "ocean-beach", "sunset-cliffs"],
    faq: [
      {
        question: "Is Mission Beach good for beginners?",
        answer:
          "Yes. The gentle sandbars and forgiving whitewater make it a solid choice for first sessions, especially on smaller swells.",
      },
      {
        question: "Where should I park for Mission Beach?",
        answer:
          "Arrive early for the Belmont Park lot or use residential street parking north of Santa Clara Place.",
      },
      {
        question: "Does Mission Beach pick up south swells?",
        answer:
          "It loves combo energy, but strong south swells can light up the south jetty with longer lefts and rights.",
      },
    ],
    speakableSummary:
      "Mission Beach offers friendly sandbar waves with plenty of amenities steps away. Target mid tide with a combo swell to get the best shape.",
    beginnerNotes:
      "Try the stretch between Belmont Park and San Fernando Place for the softest rollers and attentive lifeguard coverage.",
    intentTags: ["beginner", "least-crowded", "water-temp"],
  },
  "pacific-beach": {
    slug: "pacific-beach",
    name: "Pacific Beach",
    citySlug: "san-diego",
    region: "Pacific Beach, San Diego",
    coordinates: { lat: 32.7946, lng: -117.2557 },
    overview:
      "Pacific Beach combines multiple sandbars with a pier that refracts swell, creating playful peaks and occasional barrels for quick turns.",
    history:
      "PB has a longboard-meets-party-town vibe. Local surf clubs host expression sessions, while early risers get glassy shoulders before the boardwalk wakes up.",
    conditions:
      "The pier adds structure on larger swells, producing long rights. Smaller days favor scattered peaks ideal for fish and longboards.",
    tideAdvice:
      "Mid tide balances power and shape. Low tide exposes dumpy closeouts along the north end.",
    swellAdvice:
      "West and northwest swells line up with the pier. South swells make the beach break playful but shorter.",
    windAdvice:
      "Morning calm is best. Afternoon winds increase texture quickly, especially during summer.",
    waterTemp:
      "Ranges from 58°F in winter to 70°F in late summer. The bay influence keeps temps slightly warmer than La Jolla.",
    hazards: [
      "Pier pilings during bigger swells",
      "Crowded summer lineups",
      "Occasional stingrays",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Fall for combo swells and consistent offshore mornings",
    crowdFactor: "Heavy",
    parking:
      "Street parking near Garnet Avenue fills quickly. Residential streets north of Loring Street offer additional spots.",
    amenities: [
      "Showers and restrooms at the foot of the pier",
      "Surf shops and cafes lining Garnet Avenue",
    ],
    nearby: ["mission-beach", "la-jolla-shores", "windansea"],
    faq: [
      {
        question: "What board should I ride at Pacific Beach?",
        answer:
          "Bring a board that paddles easily but can handle punchy peaks—fish, grovelers, and twin fins excel.",
      },
      {
        question: "How crowded does PB get?",
        answer:
          "Expect heavy crowds on weekends and during summer evenings. Dawn patrol offers the most space.",
      },
      {
        question: "Are there surf lessons at Pacific Beach?",
        answer:
          "Multiple surf schools operate along the boardwalk, offering group and private lessons year-round.",
      },
    ],
    speakableSummary:
      "Pacific Beach is a lively sandbar zone with pier-reflected peaks. Target mid tide west swells for the best shape and arrive early to beat the crowds.",
    intentTags: ["least-crowded", "water-temp"],
  },
  "ocean-beach": {
    slug: "ocean-beach",
    name: "Ocean Beach Pier",
    citySlug: "san-diego",
    region: "Ocean Beach, San Diego",
    coordinates: { lat: 32.7491, lng: -117.2523 },
    overview:
      "Ocean Beach offers a mix of pier bowls and outer sandbars that light up on west swells. The municipal pier refracts swell energy into wedgy peaks that entice shortboarders and body surfers alike.",
    history:
      "OB has always been San Diego’s counterculture surf hub. The pier opened in 1966, creating a focal point for contests, night fishing, and a rotating cast of locals who call the north side home.",
    conditions:
      "Expect peaky wedges on the north side and longer shoulders toward Avalanche. The current pushes hard on bigger days, so stay active between sets.",
    tideAdvice:
      "Works on most tides, but mid tide offers the longest rides. Low tide can get hollow yet close out, while high tide softens the shoulders unless the swell is overhead.",
    swellAdvice:
      "West and WNW swells turn the pier into a ramp. South swells wrap in but favor the south side with shorter rides.",
    windAdvice:
      "Morning offshores or calm winds are best. Afternoon sea breeze roughens the face quickly, though the pier provides minor wind block on the south side.",
    waterTemp:
      "Winter hovers near 58°F; late summer often reaches 70°F. Runoff after rains can lower clarity—check advisories before paddling out.",
    hazards: [
      "Strong currents sweeping toward the pier",
      "Pollution spikes after winter storms",
      "Crowded takeoff zones with mixed craft",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Fall and winter when west swells arrive regularly",
    crowdFactor: "Heavy",
    parking:
      "Lots at the foot of Newport Avenue fill before sunrise on swell days. Additional street parking inland along Niagara Avenue and Cable Street.",
    amenities: [
      "Restrooms and showers near the lifeguard station",
      "Cafes and taco shops within two blocks of the pier",
    ],
    nearby: ["sunset-cliffs", "mission-beach", "pacific-beach"],
    faq: [
      {
        question: "Which side of the OB pier breaks better?",
        answer:
          "North side is punchier on west swells, while the south side favors longer rights during combo swells. Check both before committing.",
      },
      {
        question: "Can beginners surf Ocean Beach?",
        answer:
          "Shoulder-high days can be manageable on the inside, but rip currents and shifting peaks make it better for confident intermediates.",
      },
      {
        question: "Is the water quality safe after rain?",
        answer:
          "Avoid the lineup for at least 72 hours after heavy rain. The San Diego River outflow impacts water quality around the pier.",
      },
    ],
    speakableSummary:
      "Ocean Beach Pier delivers wedgy peaks shaped by the pier pylons. Target mid tide west swells, watch the currents, and respect the locals holding position near the bowl.",
    intentTags: ["least-crowded", "tide", "water-temp"],
  },
  "sunset-cliffs": {
    slug: "sunset-cliffs",
    name: "Sunset Cliffs",
    citySlug: "san-diego",
    region: "Point Loma, San Diego",
    coordinates: { lat: 32.7263, lng: -117.2545 },
    overview:
      "Sunset Cliffs is a collection of reef bowls tucked beneath sandstone bluffs. Different coves switch on depending on swell direction, rewarding exploration and confident entries.",
    history:
      "Locals have rappelled down goat trails here since the 1950s. The dramatic cliffs keep crowds lighter than other city breaks, but access requires timing sets and using natural ledges.",
    conditions:
      "Expect hollow takeoffs with fast down-the-line sections. Inside bowls reform into playful shoulders, but many entrances require timing between sets.",
    tideAdvice:
      "Lower tides expose key ledges for entry and produce the most defined bowls. Extreme lows expose reef hazards; rising mid tides add push for longer rides.",
    swellAdvice:
      "West swells light up the main reefs, while south swells wake up tucked-away coves around Luscomb’s and Garbage.",
    windAdvice:
      "Offshore or calm mornings are critical. The cliffs offer minimal protection from onshore winds, and bump builds quickly once the breeze shifts.",
    waterTemp:
      "Ranges from 57°F in winter to 69°F in summer, with noticeable drops during upwelling events.",
    hazards: [
      "Rocky entries and exits with limited ladders",
      "Shallow reef close to the impact zone",
      "Powerful waves reflecting off the cliffs",
    ],
    skillLevel: "Intermediate to expert",
    bestSeason: "Late fall through spring with consistent west swell trains",
    crowdFactor: "Moderate",
    parking:
      "Street parking along Sunset Cliffs Boulevard. Arrive early for spots near your preferred access trail.",
    amenities: [
      "No facilities on the cliffs",
      "Closest restrooms at Sunset Cliffs Natural Park",
    ],
    nearby: ["ocean-beach", "blacks-beach", "mission-beach"],
    faq: [
      {
        question: "How do I get in and out at Sunset Cliffs?",
        answer:
          "Scout the entry before paddling out. Locals use carved steps and timing between sets. Booties help with footing on reef shelves.",
      },
      {
        question: "Which breaks work on south swells?",
        answer:
          "Garbage and Abs work best on south energy, while Luscomb’s favors west swells. Walk the cliffs to gauge which coves are firing.",
      },
      {
        question: "Is Sunset Cliffs beginner friendly?",
        answer:
          "No. The combination of rock entries, limited exit points, and heavy waves make it a zone for confident surfers only.",
      },
    ],
    speakableSummary:
      "Sunset Cliffs is a reef playground hidden beneath sandstone bluffs. Pick the right cove for the swell, nail your entry timing, and expect steep takeoffs with quick shoulders.",
    intentTags: ["least-crowded", "tide"],
  },
  "cardiff-reef": {
    slug: "cardiff-reef",
    name: "Cardiff Reef",
    citySlug: "san-diego",
    region: "Cardiff-by-the-Sea, San Diego",
    coordinates: { lat: 33.0207, lng: -117.2799 },
    overview:
      "Cardiff Reef is a mellow kelp-covered reef that turns combo swells into playful rights and cruisey lefts. The wave stands up softly, making it a haven for fish, mid-lengths, and logs.",
    history:
      "Local families have treated Cardiff as their backyard for generations. It’s home base for early-morning dawnie crews and post-work sunset sessions with the whole family down on the sand.",
    conditions:
      "Expect soft face walls with occasional steeper corners near the peak. The inside reform keeps rides going, and the channel offers an easy paddle out.",
    tideAdvice:
      "Best from mid to high tide. Low tide reveals kelp heads and makes the takeoff steeper than expected.",
    swellAdvice:
      "Combo west and south swells line up the rights. Pure south swells still deliver but shorten the rides slightly.",
    windAdvice:
      "Morning offshores or calm conditions keep the face smooth. The kelp helps hold the line when afternoon winds pick up.",
    waterTemp:
      "Winter averages 58°F, climbing into the upper 60s during late summer. Kelp beds can trigger sudden chilly currents.",
    hazards: [
      "Submerged reef on the inside",
      "Crowds with mixed craft and beginners",
      "Floating kelp that catches fins and leashes",
    ],
    skillLevel: "Longboard friendly",
    bestSeason: "Year-round, with peak consistency in fall and winter",
    crowdFactor: "Heavy",
    parking:
      "San Elijo State Beach lot or street parking along Highway 101. The lot fills before sunrise on good swells.",
    amenities: [
      "Showers and restrooms at the state beach campground",
      "Food trucks and coffee stands near the parking lot",
    ],
    nearby: ["pipes", "swamis", "san-elijo"],
    faq: [
      {
        question: "What board should I ride at Cardiff Reef?",
        answer:
          "Bring a board with glide—a longboard, mid-length, or fish will make the most of the rolling walls.",
      },
      {
        question: "Does Cardiff break on small swells?",
        answer:
          "Yes. Even two-foot days can be playful thanks to the reef setup, making it a go-to option when other reefs are flat.",
      },
      {
        question: "Is Cardiff Reef crowded?",
        answer:
          "Crowds are consistent, but the lineup is friendly. Sit wide or down the reef to find uncrowded peaks.",
      },
    ],
    speakableSummary:
      "Cardiff Reef delivers smooth, rolling walls that suit longboards and fun shapes. Mid tide combo swells offer the best trim and the kelp beds keep wind chop at bay.",
    intentTags: ["beginner", "tide", "water-temp"],
  },
  pipes: {
    slug: "pipes",
    name: "Pipes",
    citySlug: "san-diego",
    region: "Cardiff-by-the-Sea, San Diego",
    coordinates: { lat: 33.0324, lng: -117.2942 },
    overview:
      "Pipes is a high-tide favorite with playful peaks that run along a cobblestone bottom. The wave has more punch than Cardiff, attracting shortboarders and fish riders.",
    history:
      "Named for the water pipes that once ran down the bluff, Pipes has been a local favorite for decades. Dawn patrol regulars know which peak breaks best at each tide swing.",
    conditions:
      "Expect wedgy takeoffs with both lefts and rights. The inside often reforms, allowing multiple turns before kicking out.",
    tideAdvice:
      "Loves mid to high tide. Low tide exposes rocks and turns the wave into a fast, shallow takeoff.",
    swellAdvice:
      "Combo swells are ideal. WNW provides punch while a touch of south adds shape to the shoulders.",
    windAdvice:
      "Morning calm or offshore flow is ideal. Afternoon winds add bump quickly because the lineup sits exposed.",
    waterTemp:
      "Ranges from 58°F in winter to 69°F in summer. Upwelling on strong south swells can cool the water quickly.",
    hazards: [
      "Cobblestone bottom near the inside",
      "Crowded peaks with rotating packs",
      "Occasional longboard traffic on smaller days",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Fall through spring when combo swells are frequent",
    crowdFactor: "Moderate",
    parking:
      "Park along Highway 101 near the San Elijo State Beach entrance. Expect a short walk down the bluff trail.",
    amenities: [
      "Showers and restrooms at nearby San Elijo State Beach",
      "Food and coffee in Cardiff town center minutes away",
    ],
    nearby: ["cardiff-reef", "swamis", "san-elijo"],
    faq: [
      {
        question: "What tide works best at Pipes?",
        answer:
          "Mid to high tide offers the cleanest peaks. Low tide exposes rocks and makes the takeoff sketchy.",
      },
      {
        question: "Is Pipes crowded?",
        answer:
          "It draws a steady local crew, but walking a bit north or south finds space. Sharing peaks is part of the program.",
      },
      {
        question: "Does Pipes handle big swells?",
        answer:
          "It holds up to a few feet overhead before closing out. On larger swells, check nearby reefs like Swami’s or Cardiff.",
      },
    ],
    speakableSummary:
      "Pipes rewards a mid to high tide with playful, punchy peaks. Bring a shortboard or fish, stay light on your feet, and respect the rotating local packs.",
    intentTags: ["least-crowded", "tide"],
  },
  "del-mar": {
    slug: "del-mar",
    name: "Del Mar 15th Street",
    citySlug: "san-diego",
    region: "Del Mar, San Diego",
    coordinates: { lat: 32.9633, lng: -117.2648 },
    overview:
      "Del Mar’s main break features shifting sandbars anchored by subtle reefs, serving up forgiving shoulders that suit every craft. The sand replenishes every winter, keeping the banks fresh.",
    history:
      "The Del Mar lifeguard tower has watched over generations of surfers. Local grom contests and longboard meetups keep the beach family-friendly, even when the swell spikes.",
    conditions:
      "Expect soft peaks with enough face for wrap-around cutbacks. The north side near the river mouth can thump on larger swells, while the south end stays forgiving.",
    tideAdvice:
      "Performs best on mid tide pushing high. Low tide can introduce warbly closeouts near the rivermouth.",
    swellAdvice:
      "West and southwest swells give the wave shape. Windswell generates rideable peaks but shorter rides.",
    windAdvice:
      "Morning calm or light offshore winds create glassy faces. Afternoon sea breeze is common; aim for early or late sessions.",
    waterTemp:
      "Winter bottom-outs near 57°F, summer peaks around 69°F. The San Dieguito River can chill the water after heavy rains.",
    hazards: [
      "Seasonal rip currents near the rivermouth",
      "Crowds of mixed experience levels",
      "Occasional shorebreak on steep tides",
    ],
    skillLevel: "Beginner friendly",
    bestSeason: "Spring through fall for combo swells and warmer water",
    crowdFactor: "Moderate",
    parking:
      "Paid parking lots along Coast Boulevard plus residential street parking. Arrive early on weekends.",
    amenities: [
      "Restrooms and showers near the lifeguard tower",
      "Cafes and shops in downtown Del Mar steps from the beach",
    ],
    nearby: ["torrey-pines", "cardiff-reef", "la-jolla-shores"],
    faq: [
      {
        question: "Is Del Mar good for beginners?",
        answer:
          "Yes. The soft takeoffs and lifeguard presence make it a comfortable beach for new surfers, especially at mid tide.",
      },
      {
        question: "How does the river mouth affect surfing?",
        answer:
          "After rains the river creates a right-hand sandbar with extra power. Watch for stronger currents and colder water.",
      },
      {
        question: "Where is the best place to park?",
        answer:
          "Use the large lot at Seagrove Park for quick access, or find metered spots along Coast Boulevard if you’re arriving for dawn patrol.",
      },
    ],
    speakableSummary:
      "Del Mar offers forgiving sandbars anchored by subtle reefs. Aim for mid tide west swells, enjoy the mellow crowd, and keep an eye on rivermouth currents after storms.",
    beginnerNotes:
      "Stay south of the rivermouth on smaller days for the cleanest, longest reforms.",
    intentTags: ["beginner", "water-temp"],
  },
  "torrey-pines": {
    slug: "torrey-pines",
    name: "Torrey Pines",
    citySlug: "san-diego",
    region: "Torrey Pines, San Diego",
    coordinates: { lat: 32.9216, lng: -117.2603 },
    overview:
      "Torrey Pines State Beach stretches beneath dramatic cliffs, producing a variety of sandbars that favor combo swells. The north end near the river mouth offers the most consistent peaks.",
    history:
      "Lifeguards have patrolled Torrey Pines since the 1930s, and the glider port above provides a surreal soundtrack for surfers paddling out below the cliffs.",
    conditions:
      "Expect shifting peaks with ample room to spread out. The long beach offers both punchy corners and mellow reforms depending on the sandbar.",
    tideAdvice:
      "Mid tide brings the best balance of shape and power. Low tide can turn the wave into dumping closeouts, while high tide softens the face unless the swell is solid.",
    swellAdvice:
      "Picks up west swells with ease and holds up to a few feet overhead. South swells wrap into the northern stretches but lose steam farther south.",
    windAdvice:
      "Morning calm or light offshore flow is ideal. The cliffs offer some protection from light onshore winds near the north parking lot.",
    waterTemp:
      "Winter temps hit 57°F; summer warms to 69°F. Upwelling after strong south swells can make it feel cooler than neighboring beaches.",
    hazards: [
      "Rip currents near the rivermouth",
      "Long, soft sand trail to the beach",
      "Falling rock zones beneath the cliffs after rainstorms",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Fall and winter for solid west swells",
    crowdFactor: "Moderate",
    parking:
      "Paid parking lots at the North and South entrance plus limited free parking along Highway 101. Expect a walk from the bluff to the sand.",
    amenities: [
      "Restrooms at the North Beach lot",
      "Seasonal lifeguard towers along the shoreline",
    ],
    nearby: ["blacks-beach", "del-mar", "la-jolla-shores"],
    faq: [
      {
        question: "Where is the best peak at Torrey Pines?",
        answer:
          "The north end near the river mouth typically has the most defined sandbars. Walk south for emptier peaks if you have time.",
      },
      {
        question: "Is Torrey Pines good for beginners?",
        answer:
          "Small days near the south lot can be approachable, but strong currents and shifting peaks make it better for confident intermediates.",
      },
      {
        question: "How far is the walk to the beach?",
        answer:
          "From the parking lot, plan on a five to ten minute walk down the trail and across the sand. Pack light and wear sandals for the trek back.",
      },
    ],
    speakableSummary:
      "Torrey Pines offers long stretches of shifting sandbars. Target mid tide west swells, watch for rip currents, and enjoy the fewer crowds compared to neighboring Blacks.",
    intentTags: ["least-crowded", "tide"],
  },
  "san-elijo": {
    slug: "san-elijo",
    name: "San Elijo State Beach",
    citySlug: "san-diego",
    region: "Cardiff-by-the-Sea, San Diego",
    coordinates: { lat: 33.0194, lng: -117.2788 },
    overview:
      "San Elijo combines beachbreak peaks with a few rocky shelves that add extra punch. The campground above keeps dawn patrol lively as campers roll straight into the lineup.",
    history:
      "Since the 1960s, road-tripping surfers have camped at San Elijo for weeks at a time. The break remains a favorite for families who want consistent waves without leaving the campsite.",
    conditions:
      "Expect peaky beachbreak wedges that favor shortboards and grovelers. The inside reforms nicely for funboard riders and groms logging sessions.",
    tideAdvice:
      "Mid tide delivers the best shape. Low tide exposes rocks near the reef areas, while high tide softens the wave but keeps it cruiseable.",
    swellAdvice:
      "Combo west and south swells offer the most consistent shape. Steep north swells pass by without much impact.",
    windAdvice:
      "Morning calm or light northeast winds keep the faces smooth. Afternoon windswell creates a manageable crumble.",
    waterTemp:
      "Winter averages 58°F, summer tops out near 69°F. The shallow reef warms quickly on sunny days.",
    hazards: [
      "Rocky patches near the north end",
      "Crowds from the campground on weekends",
      "Rip currents during bigger south swells",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Spring through fall with combo swells",
    crowdFactor: "Moderate",
    parking:
      "Campground visitors have priority. Day-use parking is available at the south entrance, with overflow along Highway 101.",
    amenities: [
      "Showers and restrooms inside the campground",
      "Camp store with surf essentials and coffee",
    ],
    nearby: ["cardiff-reef", "pipes", "swamis"],
    faq: [
      {
        question: "Do I need a campsite to surf San Elijo?",
        answer:
          "No. Day-use parking is available, but it fills fast. Arrive early or plan to park along Highway 101 and walk in.",
      },
      {
        question: "Is San Elijo friendly for longboards?",
        answer:
          "On smaller swells the inside reforms suit longboards. Larger days favor shortboards and fish.",
      },
      {
        question: "Are there showers nearby?",
        answer:
          "Yes. Use the campground showers—bring quarters in summer when demand is high.",
      },
    ],
    speakableSummary:
      "San Elijo State Beach serves up consistent beachbreak peaks backed by a lively campground scene. Aim for mid tide combo swells and be ready to share the lineup with visiting campers.",
    intentTags: ["least-crowded", "water-temp"],
  },
  "silver-strand": {
    slug: "silver-strand",
    name: "Silver Strand",
    citySlug: "san-diego",
    region: "Coronado, San Diego",
    coordinates: { lat: 32.6223, lng: -117.1442 },
    overview:
      "Silver Strand is a military-adjacent stretch of beach that catches south swells and offers hollow peaks when sandbars align. The wide beach spreads surfers out, helping sessions feel relaxed.",
    history:
      "Naval Base Coronado borders the break, but civilians can access most stretches. It’s a go-to for locals seeking space when central county gets clogged.",
    conditions:
      "Expect punchy peaks with both lefts and rights. The shorebreak can detonate on bigger swells, rewarding precise positioning.",
    tideAdvice:
      "Mid tide is ideal. Low tide creates closeouts, while high tide softens the lip enough for longer shoulders.",
    swellAdvice:
      "South swells shine, especially with a westerly component. West swells remain fun but less organized.",
    windAdvice:
      "Morning offshore or calm winds are key. Afternoon winds blow onshore quickly across the open sandspit.",
    waterTemp:
      "Winter temps hover around 57°F; summer climbs toward 71°F. South swell upwelling can cause sudden drops.",
    hazards: [
      "Strong rip currents during bigger south swells",
      "Shorebreak closeouts on low tides",
      "Occasional stingrays in the shallows",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Summer and early fall south swell events",
    crowdFactor: "Light",
    parking:
      "Beachfront parking lots along Silver Strand Boulevard. The southern lots are less crowded than the main Coronado entrance.",
    amenities: [
      "Restrooms at Silver Strand State Beach",
      "Picnic tables and shaded areas for between-surf breaks",
    ],
    nearby: ["imperial-beach", "mission-beach", "ocean-beach"],
    faq: [
      {
        question: "Is Silver Strand open to the public?",
        answer:
          "Yes. Portions near the naval base are restricted, but the state beach offers broad public access.",
      },
      {
        question: "Does Silver Strand work on small swells?",
        answer:
          "It prefers chest-high and bigger south swells. On smaller days, check Imperial Beach or Mission Beach instead.",
      },
      {
        question: "Are there lifeguards on duty?",
        answer:
          "State beach lifeguards monitor the main swim zones during the day. Off-hours sessions require extra caution.",
      },
    ],
    speakableSummary:
      "Silver Strand spreads out south swell energy across wide sandbars. Catch it on a mid tide rise with light winds for hollow peaks and minimal crowds.",
    intentTags: ["least-crowded", "water-temp"],
  },
  "imperial-beach": {
    slug: "imperial-beach",
    name: "Imperial Beach Pier",
    citySlug: "san-diego",
    region: "Imperial Beach, San Diego",
    coordinates: { lat: 32.578, lng: -117.1303 },
    overview:
      "Imperial Beach is the southernmost surf town in California, offering sandbars that come alive on combo swells. The pier area produces punchy peaks, while the south end near the border stays playful.",
    history:
      "IB has hosted generations of working-class surf families and the Sun & Sea Festival sandcastle competition. Cross-border water quality challenges have made the community vigilant about forecasting clean windows.",
    conditions:
      "Expect quick peaks with workable shoulders. The south end reforms nicely for longboards when the main peak gets busy.",
    tideAdvice:
      "Mid tide rising delivers the best balance of push and makeable shoulders. Low tide drains the sandbars and produces dumpy closeouts.",
    swellAdvice:
      "Combo south and west swells keep it consistent. Tropical south swells can light up the pier with long, fast walls.",
    windAdvice:
      "Morning calm is essential. Afternoon winds blow onshore early, but evening glass-offs can surprise when the sea breeze dies.",
    waterTemp:
      "Winter averages 57°F; summer reaches 72°F. Water quality can dip after storms—monitor county advisories.",
    hazards: [
      "Water contamination after rain or south swells",
      "Rip currents, especially near the pier",
      "Crowded summer lineups near the contest zone",
    ],
    skillLevel: "Beginner friendly",
    bestSeason: "Summer south swells and early fall combo swells",
    crowdFactor: "Moderate",
    parking:
      "Street parking along Seacoast Drive plus municipal lots near the pier. Expect crowds during summer festivals.",
    amenities: [
      "Restrooms and showers at the pier",
      "Cafes and taquerias lining Seacoast Drive",
    ],
    nearby: ["silver-strand", "mission-beach", "ocean-beach"],
    faq: [
      {
        question: "Is Imperial Beach safe to surf after rain?",
        answer:
          "Wait at least 72 hours after heavy rain or south swells. Check the San Diego County water quality hotline for updates.",
      },
      {
        question: "Where should beginners surf in IB?",
        answer:
          "Head south of the pier near Palm Avenue for softer peaks and fewer crowds. Stay within sight of lifeguards.",
      },
      {
        question: "Does Imperial Beach pick up south swell?",
        answer:
          "Yes. South swells drive the best days and can deliver long rights along the pier and into the south end.",
      },
    ],
    speakableSummary:
      "Imperial Beach offers playful sandbars with warm summer water. Time your sessions around water quality reports, aim for mid tide, and enjoy the welcoming local scene.",
    beginnerNotes:
      "Surf south of the pier on waist-high days for mellow rollers and quicker access to parking.",
    intentTags: ["beginner", "water-temp"],
  },
  "doheny-state-beach": {
    slug: "doheny-state-beach",
    name: "Doheny State Beach",
    citySlug: "orange-county",
    region: "Dana Point, Orange County",
    coordinates: { lat: 33.4616, lng: -117.6902 },
    overview:
      "Doheny State Beach is Orange County’s most forgiving break, with rolling point-style waves created by cobblestone reefs and dredged sand. It’s a magnet for longboarders, surf schools, and families.",
    history:
      "Designated as California’s first state beach in 1931, Doheny has hosted longboard contests and surf festivals for decades. Its mellow vibe and easy access keep it packed with beginners year-round.",
    conditions:
      "Expect soft, waist-high peelers with the occasional chest-high set on south swells. The wave breaks in multiple sections, making it easy to find your own corner.",
    tideAdvice:
      "High tide keeps the wave rolling and forgiving. Low tide can expose cobblestones near the takeoff and shorten the ride.",
    swellAdvice:
      "South and southwest swells are the bread and butter. West swells still create playful peaks but lack length.",
    windAdvice:
      "Morning glass is the norm thanks to the harbor jetty. Afternoon winds can bump the face but the wave remains rideable for foamies and SUPs.",
    waterTemp:
      "Winter averages 58°F, summer peaks at 71°F. Dana Point Harbor keeps water clarity high except after heavy rain.",
    hazards: [
      "Crowded takeoff zones with mixed craft",
      "SUP traffic on weekends",
      "Submerged cobblestones near the point",
    ],
    skillLevel: "Beginner friendly",
    bestSeason: "May through October for consistent south swell energy",
    crowdFactor: "Heavy",
    parking:
      "Large state beach lot fills early; day-use fee required. Additional parking near Dana Point Harbor with a short walk.",
    amenities: [
      "Restrooms and showers throughout the park",
      "Rental shops and cafes at the harbor",
    ],
    nearby: ["old-mans", "san-onofre", "lowers-trestles"],
    faq: [
      {
        question: "Is Doheny good for surf lessons?",
        answer:
          "Yes. The wave is gentle, lifeguards cover the lineup, and several surf schools operate directly on the sand.",
      },
      {
        question: "What board should I bring to Doheny?",
        answer:
          "A longboard or soft-top is ideal. The wave is slow and rolling, favoring boards with glide.",
      },
      {
        question: "Does Doheny get crowded?",
        answer:
          "Absolutely. Plan for sunrise sessions or weekdays if you want breathing room.",
      },
    ],
    speakableSummary:
      "Doheny State Beach offers long, rolling waves perfect for longboards and beginners. South swells on a high tide deliver the classic Doheny glide.",
    beginnerNotes:
      "Stay north of the creek mouth for the longest rollers and easiest paddle channels.",
    intentTags: ["beginner", "water-temp"],
  },
  "san-onofre": {
    slug: "san-onofre",
    name: "San Onofre Trails",
    citySlug: "orange-county",
    region: "San Clemente, Orange County",
    coordinates: { lat: 33.3764, lng: -117.5725 },
    overview:
      "San Onofre is a sprawling surf zone with cobblestone reefs, mellow points, and beachbreak peaks stretching from the power plant to Trail 6. Long rides and retro equipment define the vibe.",
    history:
      "San Onofre has been a surfing landmark since the 1930s, with the iconic Old Man’s crew keeping the tradition alive. The base access road once limited crowds, but today it draws surfers from across SoCal.",
    conditions:
      "The points deliver soft, rolling walls. Trails picks up extra energy and offers wedgier peaks. Expect long paddles and even longer rides on bigger south swells.",
    tideAdvice:
      "Mid to high tide keeps waves connected across the cobblestones. Low tide can be tricky with exposed rocks at takeoff.",
    swellAdvice:
      "South swells drive the best days, while combo swells keep it fun year-round. NW swells back off due to shelter from Point La Jolla.",
    windAdvice:
      "Morning glass stretches late thanks to Camp Pendleton winds blocking the sea breeze. Afternoon onshores eventually add texture.",
    waterTemp:
      "Winter lows around 57°F, summer highs near 71°F. The shallow cobblestone shelf retains warmth in late summer.",
    hazards: [
      "Crowded lineups with longboards and SUPs",
      "Rocks just below the surface at low tide",
      "Long walks from the parking lot to the preferred peak",
    ],
    skillLevel: "Longboard friendly",
    bestSeason: "Late spring through early fall south swells",
    crowdFactor: "Heavy",
    parking:
      "State park entrance with limited spots; arrive before sunrise on weekends. Additional parking along the Trail access points.",
    amenities: [
      "Portable restrooms and showers near the parking lot",
      "Food trucks and coffee carts on summer weekends",
    ],
    nearby: ["old-mans", "churches", "lowers-trestles"],
    faq: [
      {
        question: "Which trail should I surf?",
        answer:
          "Trail 6 is the most exposed to south swells, while Trails 1-4 offer mixed peaks. Explore to find the sandbar that fits the day.",
      },
      {
        question: "Is San Onofre crowded?",
        answer:
          "Yes, but the coastline is long. Walk north or south for space, and be ready to share longboards, SUPs, and soft-tops.",
      },
      {
        question: "Can I camp at San Onofre?",
        answer:
          "Camping is available at the Bluffs campground overlooking the surf. Reserve early during summer.",
      },
    ],
    speakableSummary:
      "San Onofre offers classic point-style walls with a vintage vibe. South swells, mid tide, and patience in the lineup are the keys to scoring long rides.",
    intentTags: ["beginner", "tide", "water-temp"],
  },
  "old-mans": {
    slug: "old-mans",
    name: "Old Man's",
    citySlug: "orange-county",
    region: "San Clemente, Orange County",
    coordinates: { lat: 33.3846, lng: -117.5699 },
    overview:
      "Old Man’s is the heart of San Onofre, delivering soft, rolling rights and lefts that are tailor-made for logging and family sessions. The gentle takeoff makes it accessible for all ages.",
    history:
      "Named after the old-timers who held court there in the 1950s, Old Man’s remains a shrine to classic California surfing with wooden board racks, aloha shirts, and ukulele jams after sunset.",
    conditions:
      "Expect knee to chest-high peelers that run for long distances on south swells. The inside reforms allow multiple generations to share the same wave.",
    tideAdvice:
      "High tide keeps the wave soft and forgiving. Low tide exposes slippery cobblestones—booties help on early morning walks.",
    swellAdvice:
      "South swells are the ticket. Even a modest 2-3 foot pulse provides rideable peelers all day.",
    windAdvice:
      "Morning calm and light offshore breezes hold until midday. Afternoon winds add bump but rarely shut it down.",
    waterTemp:
      "Ranges from 58°F in winter to 72°F in late summer. The cobblestones soak up heat, making dawn patrol feel warmer than nearby breaks.",
    hazards: [
      "Tightly packed longboard lineups",
      "Soft-tops flying loose during wipeouts",
      "Cobblestone bottom that bruises toes at low tide",
    ],
    skillLevel: "Beginner friendly",
    bestSeason: "Summer and early fall during south swell season",
    crowdFactor: "Heavy",
    parking:
      "State beach lot fills at sunrise. Overflow parking along the bluff requires extra walking—bring wheels for heavy boards.",
    amenities: [
      "Restrooms, showers, and picnic tables next to the parking lot",
      "Food trucks, coffee, and surf rentals on busy weekends",
    ],
    nearby: ["doheny-state-beach", "san-onofre", "churches"],
    faq: [
      {
        question: "Is Old Man’s good for first-time surfers?",
        answer:
          "Yes. The wave is gentle, the community is welcoming, and lifeguards patrol peak hours. Lessons are available on-site.",
      },
      {
        question: "What board should I ride?",
        answer:
          "A longboard, mid-length, or soft-top with plenty of volume keeps you moving through the softer sections.",
      },
      {
        question: "How early should I arrive?",
        answer:
          "On summer weekends, arrive before sunrise. Locals often line up at the gate before it opens.",
      },
    ],
    speakableSummary:
      "Old Man’s is a gentle, rolling wave perfect for longboards and family sessions. Hit it on a south swell with a high tide and prepare to share the stoke with multi-generational crews.",
    beginnerNotes:
      "Stay near the lifeguard tower for the softest takeoffs and an easy channel to paddle back out.",
    intentTags: ["beginner", "water-temp"],
  },
  churches: {
    slug: "churches",
    name: "Churches",
    citySlug: "orange-county",
    region: "San Onofre, Orange County",
    coordinates: { lat: 33.3873, lng: -117.579 },
    overview:
      "Churches is the northernmost peak in the San Onofre State Beach stretch, delivering faster, more performance-friendly waves than its neighbors. The cobblestone reef shapes punchy rights with plenty of face.",
    history:
      "Named after the nearby beach chapel on Camp Pendleton, Churches has long been a favorite for shortboarders who want Trestles energy without the hike.",
    conditions:
      "Expect chest to head-high rights with sections for carves and the occasional tube. The inside reforms into ramps for airs when the swell is strong.",
    tideAdvice:
      "Mid tide rising is ideal, providing enough depth over the cobbles without flattening the takeoff.",
    swellAdvice:
      "South swells are prime, especially with a bit of west to hold the face. Combo swells keep it running even when south energy fades.",
    windAdvice:
      "Morning offshores or calm winds are best. Afternoon winds hit harder here than at Trestles, so plan early sessions.",
    waterTemp:
      "Winter averages 58°F, summer sits around 70°F. The cobblestone setup keeps temps consistent.",
    hazards: [
      "Rocks near the takeoff",
      "Crowds migrating from Trestles on big days",
      "Military security presence—be respectful of access rules",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Summer south swells through early fall",
    crowdFactor: "Moderate",
    parking:
      "Access via San Onofre State Beach. Park near Trail 6 and walk north along the beach to the lineup.",
    amenities: [
      "Restrooms at the parking area",
      "Showers near Old Man’s, a short walk south",
    ],
    nearby: ["lowers-trestles", "san-onofre", "old-mans"],
    faq: [
      {
        question: "Do I need a base pass to surf Churches?",
        answer:
          "No. Civilians can access it via San Onofre State Beach. Stay below the high tide line and respect signage.",
      },
      {
        question: "How does Churches compare to Trestles?",
        answer:
          "It’s slightly shorter and less perfect but far less crowded. Think of it as the accessible training ground for Trestles-level surfing.",
      },
      {
        question: "What board is best?",
        answer:
          "A performance shortboard or high-performance twin handles the speedy rights. Bring enough rocker for the bowly takeoff.",
      },
    ],
    speakableSummary:
      "Churches serves up fast cobblestone rights with fewer crowds than Trestles. Hit it on a mid tide south swell and bring a board that holds in steep pockets.",
    intentTags: ["least-crowded", "tide"],
  },
  "lowers-trestles": {
    slug: "lowers-trestles",
    name: "Lower Trestles",
    citySlug: "orange-county",
    region: "San Clemente, Orange County",
    coordinates: { lat: 33.384, lng: -117.5931 },
    overview:
      "Lower Trestles is Southern California’s high-performance playground, delivering ruler-straight rights and playful lefts over a meticulously shaped cobblestone reef.",
    history:
      "From the NSSA groms to World Surf League finals, Lowers has hosted every level of competition. The train track walk is a rite of passage for any surfer chasing a perfect point break.",
    conditions:
      "Expect long, perfectly paced walls with steep takeoffs and multiple sections. Priority is determined by patience and cardio more than anything.",
    tideAdvice:
      "Mid tide dropping delivers the cleanest canvas. Low tide can get racy but hollow, while high tide slows the face enough for longer wraps.",
    swellAdvice:
      "South swells and combo energy are essential. A touch of west fills the bowl and keeps the rights running to the inside.",
    windAdvice:
      "Morning offshores or glassy conditions are crucial. Even light onshores add bump noticeable in the face of such a precise wave.",
    waterTemp:
      "Winter lows hover around 58°F, while summer peaks near 72°F. Upwelling events after long south swell lines can drop temps quickly.",
    hazards: [
      "Crowded, competitive lineup",
      "Submerged cobblestones on the inside",
      "Long walk in and out with limited shade",
    ],
    skillLevel: "Intermediate to expert",
    bestSeason: "Summer and early fall south swells",
    crowdFactor: "Heavy",
    parking:
      "Park at Cristianitos Road and walk the trail along the train tracks. Bikes or e-bikes cut the commute in half.",
    amenities: [
      "No facilities on the beach",
      "Water refill stations at the trailhead parking lot",
    ],
    nearby: ["uppers-trestles", "churches", "san-onofre"],
    faq: [
      {
        question: "How long is the walk to Lowers?",
        answer:
          "Plan for a 15-minute walk from the Cristianitos parking lot. Pack light and bring water for the trek back.",
      },
      {
        question: "How do I get waves at Lowers?",
        answer:
          "Be patient, sit wide for insiders, and communicate clearly. Respect the established rotation and you’ll get your turn.",
      },
      {
        question: "What board works best?",
        answer:
          "Bring your favorite high-performance shortboard or twin. The wave rewards responsiveness and hold.",
      },
    ],
    speakableSummary:
      "Lower Trestles is the benchmark for performance surfing in California. Time a south swell with a mid tide, bring cardio for the paddle, and expect a world-class crowd.",
    intentTags: ["least-crowded", "tide", "water-temp"],
  },
  "uppers-trestles": {
    slug: "uppers-trestles",
    name: "Upper Trestles",
    citySlug: "orange-county",
    region: "San Clemente, Orange County",
    coordinates: { lat: 33.3854, lng: -117.5963 },
    overview:
      "Upper Trestles sits just north of Lowers and offers a punchier, more sectiony wave with fewer surfers. It’s a great alternative when Lowers is maxed or overcrowded.",
    history:
      "While Lowers grabbed the spotlight, local crews have cherished Uppers for decades thanks to its third reef takeoff and rippable inside bowl.",
    conditions:
      "Expect a defined peak that breaks both left and right. The right offers a quick wall with lip sections, while the left runs into the beach with room for multiple carves.",
    tideAdvice:
      "Mid tide keeps the face open. Low tide runs fast but offers tubes; high tide fattens the wave significantly.",
    swellAdvice:
      "South swells are primary, with combo west energy helping maintain shape. Windswell can create fun skatepark ramps when bigger swells fade.",
    windAdvice:
      "Morning glass or a light northeast breeze keeps it clean. Afternoon winds quickly add chop across the exposed face.",
    waterTemp:
      "Similar to Lowers, with winter temps around 58°F and summer highs in the low 70s.",
    hazards: [
      "Shallow cobblestone reef",
      "Strong current sweeping toward Lowers",
      "Occasional military or ranger patrols enforcing access rules",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Summer and early fall with consistent south swell energy",
    crowdFactor: "Moderate",
    parking:
      "Same as Lowers: Cristianitos parking lot and trail. Walk a bit farther north once you reach the beach.",
    amenities: [
      "No beach facilities—pack what you need",
      "Bike racks near the trailhead",
    ],
    nearby: ["lowers-trestles", "churches", "bolsa-chica"],
    faq: [
      {
        question: "Is Uppers less crowded than Lowers?",
        answer:
          "Yes. It still draws talent, but the pack is thinner and more laid-back than the main arena at Lowers.",
      },
      {
        question: "Can I surf Uppers on a shortboard?",
        answer:
          "Absolutely. The wave is shorter but punchier—perfect for snappy turns and airs.",
      },
      {
        question: "Does Uppers work on small swells?",
        answer:
          "It needs at least a chest-high south swell to light up. For tiny days, check Doheny or Old Man’s.",
      },
    ],
    speakableSummary:
      "Upper Trestles offers a punchier alternative to Lowers. Bring a responsive board, target mid tide south swells, and enjoy the lighter crowd.",
    intentTags: ["least-crowded", "tide"],
  },
  "huntington-pier": {
    slug: "huntington-pier",
    name: "Huntington Beach Pier",
    citySlug: "orange-county",
    region: "Huntington Beach, Orange County",
    coordinates: { lat: 33.6542, lng: -118.002 },
    overview:
      "Huntington Pier is the surf city epicenter, offering punchy beachbreak peaks amplified by the pier pilings. Contests, night sessions, and photogenic sunsets are part of the daily routine.",
    history:
      "Home of the US Open of Surfing, Huntington Pier has launched countless pro careers. The lights allow night surfing during events, keeping the lineup buzzing after dark.",
    conditions:
      "Expect peaky wedges with fast lefts on the north side and longer rights on the south side. The pier magnifies swell, making waist-high days rippable.",
    tideAdvice:
      "Mid tide dropping keeps the wave steep without closing out. Low tide offers barrels but increases the risk of hitting the bottom.",
    swellAdvice:
      "Combo swells from the west and south are ideal. Windswell keeps it active even on smaller days.",
    windAdvice:
      "Morning offshores or Santa Ana conditions are golden. Afternoon winds can be strong, but evening glass-offs happen frequently.",
    waterTemp:
      "Winter lows around 57°F, summer highs near 70°F. Upwelling during strong south swells can chill the water overnight.",
    hazards: [
      "Crowded lineups with competitive surfers",
      "Pier pilings during bigger sets",
      "Strong rip currents sweeping alongside the pier",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Year-round, with summer events and winter swells keeping it active",
    crowdFactor: "Heavy",
    parking:
      "Large pay lots at the pier plus street parking along PCH. Arrive early during contest weeks.",
    amenities: [
      "Restrooms, showers, and restaurants at the pier base",
      "Surf shops lining Main Street",
    ],
    nearby: ["bolsa-chica", "newport-56th-street", "seal-beach"],
    faq: [
      {
        question: "Which side of Huntington Pier is better?",
        answer:
          "North side feeds into faster lefts, while the south side offers longer rights. Check both before paddling out.",
      },
      {
        question: "Can beginners surf Huntington Pier?",
        answer:
          "The inside reforms can be manageable, but the main peaks are punchy. Beginners might prefer Bolsa Chica or Doheny.",
      },
      {
        question: "How do I avoid crowds?",
        answer:
          "Surf dawn patrol or late evening, and walk a block or two north or south from the pier to find less packed peaks.",
      },
    ],
    speakableSummary:
      "Huntington Pier is a high-energy beachbreak with contest-level surfers. Chase combo swells on a mid tide, respect the rotation, and watch the pilings on bigger sets.",
    intentTags: ["least-crowded", "tide", "water-temp"],
  },
  "newport-56th-street": {
    slug: "newport-56th-street",
    name: "Newport 56th Street",
    citySlug: "orange-county",
    region: "Newport Beach, Orange County",
    coordinates: { lat: 33.6118, lng: -117.9342 },
    overview:
      "Newport’s 56th Street jetty produces punchy, hollow waves when west swells stack up. The jetties sculpt peaks that favor advanced surfers ready for steep drops.",
    history:
      "The Wedge steals headlines, but 56th Street is where many Newport locals sharpen their shortboard game. Contest scaffolding pops up here during summer and fall events.",
    conditions:
      "Expect fast rights running along the jetty with a thumping left on bigger days. The inside is shallow, rewarding quick exits.",
    tideAdvice:
      "Low to mid tide keeps the wave hollow and fast. High tide slows it down and pushes the peak toward the beach.",
    swellAdvice:
      "West and northwest swells are essential. South swells wrap in but favor other jetties better suited to that direction.",
    windAdvice:
      "Morning offshores are critical. Afternoon onshores deteriorate the wave quickly due to the open beach exposure.",
    waterTemp:
      "Ranges from 57°F in winter to 70°F in summer. Upwelling during south swell events can drop temps significantly.",
    hazards: [
      "Shallow sand near the jetty",
      "Crowded packs of high-performance shortboarders",
      "Strong lateral current sweeping toward River Jetties",
    ],
    skillLevel: "Advanced",
    bestSeason: "Fall and winter west swell cycles",
    crowdFactor: "Heavy",
    parking:
      "Street parking along Seashore Drive plus small lots near 56th Street. Expect tight enforcement of parking regulations.",
    amenities: [
      "Outdoor showers at the end of 56th Street",
      "Coffee shops and breakfast spots a short walk inland",
    ],
    nearby: ["huntington-pier", "bolsa-chica", "seal-beach"],
    faq: [
      {
        question: "Is 56th Street good for beginners?",
        answer:
          "No. The wave is hollow, fast, and breaks in shallow water. Beginners should try Doheny or Bolsa Chica instead.",
      },
      {
        question: "Does 56th Street work on south swells?",
        answer:
          "It prefers west swells. For south swells, check the River Jetties or the Wedge.",
      },
      {
        question: "How do I avoid the crowd?",
        answer:
          "Surf during midweek dawn patrols or wait for tide transitions when the pack thins out.",
      },
    ],
    speakableSummary:
      "Newport’s 56th Street jetty fires on west swells with hollow, fast peaks. Aim for low to mid tide, bring your step-up shortboard, and watch the shallow inside.",
    intentTags: ["least-crowded", "tide"],
  },
  "bolsa-chica": {
    slug: "bolsa-chica",
    name: "Bolsa Chica",
    citySlug: "orange-county",
    region: "Huntington Beach, Orange County",
    coordinates: { lat: 33.6962, lng: -118.0454 },
    overview:
      "Bolsa Chica State Beach is Huntington’s laid-back counterpart, featuring long, rolling waves that welcome longboards, beginners, and surf campers.",
    history:
      "Once known for bonfires and VW surf vans, Bolsa Chica still hosts camping crews and surf schools that set up multi-day retreats on the sand.",
    conditions:
      "Expect mellow peaks with plenty of shoulder room. The wave reforms nicely, letting surfers work on footwork, trims, and turns without pressure.",
    tideAdvice:
      "Mid to high tide keeps the wave soft and rideable. Low tide makes it faster but riskier for new surfers.",
    swellAdvice:
      "Combo swells from the west and south keep it consistent. Pure windswell is still fun but shorter.",
    windAdvice:
      "Morning calm or light offshores are ideal. Afternoon sea breeze is common, but the wave remains manageable.",
    waterTemp:
      "Winter lows touch 57°F, while summer sees 70°F. The broad sandbar retains warmth during heat waves.",
    hazards: [
      "Occasional stingrays in summer—shuffle your feet",
      "Crowds of beginners on rented boards",
      "Cyclists and pedestrians crossing the parking lot road",
    ],
    skillLevel: "Beginner friendly",
    bestSeason: "Year-round for mellow sessions, summer for warm-water camps",
    crowdFactor: "Moderate",
    parking:
      "Large state beach lot with day-use fees. Arrive early on summer weekends to secure a spot near your preferred tower.",
    amenities: [
      "Restrooms, showers, and fire pits along the sand",
      "Food vendors and rental shacks during peak season",
    ],
    nearby: ["huntington-pier", "seal-beach", "doheny-state-beach"],
    faq: [
      {
        question: "Is Bolsa Chica good for first-time surfers?",
        answer:
          "Yes. Surf schools love the soft, rolling waves and consistent lifeguard coverage. Just stay clear of other learners when paddling out.",
      },
      {
        question: "Do I need a wetsuit in summer?",
        answer:
          "Water in August can sit near 70°F, so a spring suit or even trunks on hot days works. Bring a full suit for dawn patrol upwelling drops.",
      },
      {
        question: "Can I camp at Bolsa Chica?",
        answer:
          "While there’s no beachfront campground, RV camping is available across the street at Bolsa Chica State Beach.",
      },
    ],
    speakableSummary:
      "Bolsa Chica is Huntington’s mellow playground. High tide combo swells deliver long rides, easy paddles, and a relaxed lineup perfect for new surfers.",
    beginnerNotes:
      "Surf near lifeguard Tower 18 for the softest takeoffs and the quickest walk from the parking lot.",
    intentTags: ["beginner", "water-temp"],
  },
  "seal-beach": {
    slug: "seal-beach",
    name: "Seal Beach Pier",
    citySlug: "orange-county",
    region: "Seal Beach, Orange County",
    coordinates: { lat: 33.7414, lng: -118.1048 },
    overview:
      "Seal Beach offers a mix of pier peaks and river-mouth sandbars that love combo swells. The quiet town vibe makes it a solid fallback when nearby zones are slammed.",
    history:
      "Seal Beach has quietly produced world-class surfers while keeping its small-town charm. The NASA weapons station and the San Gabriel River shape the coastline.",
    conditions:
      "Expect playful beachbreak peaks with longer rides near the rivermouth. The pier refracts swell into punchy corners.",
    tideAdvice:
      "Mid tide rising adds push without closing out. Low tide creates fast barrels near the pier, while high tide softens the wave.",
    swellAdvice:
      "Combo south and west swells keep it consistent. Pure south swells favor the rivermouth, delivering lefts that race toward the jetty.",
    windAdvice:
      "Morning offshores or calm conditions are common. Afternoon sea breeze arrives later here than further south.",
    waterTemp:
      "Winter sits near 57°F, summer climbs into the upper 60s. River runoff can cool the water after storms.",
    hazards: [
      "Rip currents near the river outlet",
      "Crowds during summer blackball hours",
      "Shallow inside sandbars on low tide",
    ],
    skillLevel: "Intermediate",
    bestSeason: "Fall when combo swells and Santa Ana winds line up",
    crowdFactor: "Moderate",
    parking:
      "Metered parking near the pier with additional free parking a few blocks inland. Arrive early to beat the beach day rush.",
    amenities: [
      "Restrooms and showers at the pier",
      "Coffee shops and diners along Main Street",
    ],
    nearby: ["bolsa-chica", "huntington-pier", "newport-56th-street"],
    faq: [
      {
        question: "Is Seal Beach good for beginners?",
        answer:
          "The inside reforms can be manageable on smaller days, but currents near the river can be tricky. Beginners should stick near the pier with a buddy.",
      },
      {
        question: "Does Seal Beach have blackball rules?",
        answer:
          "Yes. During summer afternoons, certain zones are restricted to swimmers. Watch the flags and respect lifeguard instructions.",
      },
      {
        question: "Which peak breaks best?",
        answer:
          "The south side of the pier offers consistent rights, while the river mouth creates longer lefts when combo swells arrive.",
      },
    ],
    speakableSummary:
      "Seal Beach Pier features combo-swell peaks with fewer crowds than Huntington. Aim for mid tide, watch the river currents, and enjoy the small-town lineup energy.",
    intentTags: ["least-crowded", "tide", "water-temp"],
  },
};

export const SURF_CITY_SLUGS = Object.keys(SURF_CITIES) as SurfCitySlug[];
export type SurfSpotSlug = keyof typeof SURF_SPOTS;
export const SURF_SPOT_SLUGS = Object.keys(SURF_SPOTS) as SurfSpotSlug[];

export function getCityBySlug(slug: string): SurfCity | undefined {
  return SURF_CITIES[slug as SurfCitySlug];
}

export function getSpotBySlug(slug: string): SurfSpot | undefined {
  return SURF_SPOTS[slug];
}

export function getSpotsForCity(citySlug: SurfCitySlug): SurfSpot[] {
  return Object.values(SURF_SPOTS).filter(
    (spot) => spot.citySlug === citySlug
  );
}

export function getSpotsForIntent(
  citySlug: SurfCitySlug,
  intent: SurfIntentSlug
): SurfSpot[] {
  return getSpotsForCity(citySlug).filter((spot) =>
    spot.intentTags.includes(intent)
  );
}

export function getTopSpotsForIntent(intent: SurfIntentSlug): SurfSpot[] {
  return Object.values(SURF_SPOTS).filter((spot) =>
    spot.intentTags.includes(intent)
  );
}
