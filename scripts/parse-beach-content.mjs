#!/usr/bin/env node

/**
 * Parse curated beach content into AllTrails-style structured data
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const curatedBeaches = [
  {
    name: "Pacific Beach",
    description:
      "Popular beachbreak near Crystal Pier with consistent waves year-round. Best for beginners and intermediates, with plenty of peaks to spread out. The crowd can be heavy with surf schools and rentals, especially on weekends. Parking is challenging but the easy access and amenities make it a go-to spot for many San Diego surfers.",
    features: [
      "Beginner friendly",
      "Sandy bottom",
      "Board rental nearby",
      "Lifeguard on duty",
      "Year-round surf",
      "Surf schools",
    ],
    takeaways: [
      "🅿️ Street parking tight; aim a few blocks inland after 7am",
      "🌊 Peaky beachbreak; best on combo swells at mid tide",
      "👥 Beginners + rentals = heavy crowd; spread north toward Law St",
      "⚠️ Rip by Crystal Pier pilings when sets stack",
    ],
    bestConditions: "Combo swells at mid tide with offshore winds",
    crowdLevel: "heavy",
    skillLevel: "beginner_to_intermediate",
    bestMonths: [8, 9, 10, 11, 12, 1, 2, 3],
  },
  {
    name: "Ocean Beach",
    description:
      "Powerful beachbreak near the OB Pier with shifting sandbars that can handle serious size. The pier creates banks that often produce the best waves in the area. Morning offshore winds during Santa Ana conditions make for epic sessions. Be mindful of the jetty and pier - both create strong rips when the swell is up.",
    features: [
      "Handles size",
      "Powerful waves",
      "Pier creates banks",
      "Parking lot",
      "Year-round surf",
    ],
    takeaways: [
      "🅿️ Big lots at Dog Beach/Voltaire fill by 8am weekends",
      "🌊 Sandbars near pier handle more size; kelp can clean up winds",
      "💨 Morning offshore on Santa Ana days = go time",
      "⚠️ Jetty rips + pier pull; be sharp on exits",
    ],
    bestConditions:
      "Morning offshore Santa Ana days, sandbars near pier handle size",
    crowdLevel: "moderate",
    skillLevel: "intermediate",
    bestMonths: [10, 11, 12, 1, 2, 3],
  },
  {
    name: "La Jolla Shores",
    description:
      "Gentle beachbreak perfect for beginners and longboarders. The inside reform provides soft, forgiving waves ideal for learning. Best on small days under 4ft. The large parking lot at Kellogg Park makes access easy, though it fills up quickly on sunny days. Watch for shifting channels that can create lateral drift.",
    features: [
      "Beginner friendly",
      "Longboard spot",
      "Sandy bottom",
      "Parking lot",
      "Lifeguard on duty",
      "Gentle waves",
    ],
    takeaways: [
      "🅿️ Large lot at Kellogg Park; gone early on sunny days",
      "🏄 Inside reform = beginner gold on <4 ft",
      "🌊 Mellow on high tide, soft/mushy; better push mid tide",
      "⚠️ Channels move—watch lateral drift near towers",
    ],
    bestConditions: "Mid tide, small waves <4ft, perfect for beginners",
    crowdLevel: "heavy",
    skillLevel: "beginner",
    bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    name: "Windansea",
    description:
      "Iconic reef break with a compact takeoff zone and powerful waves. Best on S/SSW swells at low to mid tide. This is not a beginner spot - the reef is uneven with urchins, and there's a strong local presence. Respect the lineup, wait your turn, and be prepared for the consequences if you don't. One of the most photogenic spots in San Diego.",
    features: [
      "Reef break",
      "Powerful waves",
      "Scenic",
      "Compact takeoff",
      "Strong etiquette",
    ],
    takeaways: [
      "🌊 Reef, compact takeoff zone; best low→mid tide on S/SSW",
      "👥 Localism-lite: strong etiquette matters",
      "🪨 Uneven reef + urchins; avoid fat high tides (backwash)",
      "📸 Scenic—but not a learner spot",
    ],
    bestConditions: "Low to mid tide on S/SSW swell, clean conditions",
    crowdLevel: "heavy",
    skillLevel: "intermediate_to_advanced",
    etiquette: "Strong etiquette expected, respect locals",
    bestMonths: [5, 6, 7, 8, 9, 10],
  },
  {
    name: "Blacks",
    description:
      "Legendary big-wave spot accessible via steep hike from the Gliderport. Canyon orientation focuses swell energy into powerful, hollow waves. Best on clean NE morning winds at low to mid tide. The crowd is heavy with experienced chargers - watch and learn before paddling out. Strong rips and longshore currents make this an advanced-only spot. Pack light for the hike and plan your exit strategy before going out.",
    features: [
      "Advanced only",
      "Powerful waves",
      "Canyon focus",
      "Steep hike access",
      "Clothing optional",
    ],
    takeaways: [
      "🥾 Steep hike (Gliderport); pack light, sandals bad idea",
      "🌊 Canyon power; best low→mid tide, clean NE mornings",
      "👥 Crowded with chargers; sit wide till you read it",
      "⚠️ Strong rip/longshore; commit to your exit plan",
    ],
    bestConditions: "Low to mid tide, clean NE morning winds, powerful waves",
    crowdLevel: "heavy",
    skillLevel: "advanced",
    etiquette: "Respect the chargers, watch and learn before paddling out",
    bestMonths: [11, 12, 1, 2, 3],
  },
  {
    name: "Scripps",
    description:
      "Consistent pier break near UCSD with the pier creating reliable sandbars. Mid tide is the sweet spot when the banks are working. Limited close parking means you'll often walk from La Jolla Shores lots. The UCSD crowd maintains tighter etiquette near the pier. Watch for weird rebounds and suckout from the pilings.",
    features: [
      "Pier break",
      "Consistent",
      "Sandy bottom",
      "University crowd",
      "Year-round surf",
    ],
    takeaways: [
      "🚶 Limited close parking; walk from Shores lots when packed",
      "🌊 Pier banks like a magnet; mid tide is the sweet spot",
      "👥 UCSD crowd; tighter etiquette near the pier",
      "⚠️ Pier pilings create weird rebound + suckout",
    ],
    bestConditions: "Mid tide, pier creates banks",
    crowdLevel: "moderate",
    skillLevel: "intermediate",
    bestMonths: [8, 9, 10, 11, 12, 1, 2, 3, 4],
  },
  {
    name: "Tourmaline",
    description:
      "Longboard and fish heaven with soft, rolling waves and cruisey shoulders. Best on mid to high tide with small W/NW or combo swells. The parking lot fills late morning but has decent turnover. Gentle vibe overall, though watch for drifting learners. Perfect spot for a mellow session on a small day.",
    features: [
      "Longboard spot",
      "Fish friendly",
      "Gentle waves",
      "Parking lot",
      "Relaxed vibe",
      "Good for learning",
    ],
    takeaways: [
      "🏄 Log/fish heaven; soft rollers, cruisey shoulders",
      "🌊 Likes mid→high tide on small W/NW or combo",
      "🅿️ Lot fills late morning; turnover after lunchtime",
      "👥 Gentle vibe; watch for drifting learners",
    ],
    bestConditions:
      "Mid to high tide on small W/NW or combo swells, longboard spot",
    crowdLevel: "moderate",
    skillLevel: "beginner_to_intermediate",
    etiquette: "Gentle vibe, longboard friendly",
    bestMonths: [9, 10, 11, 12, 1, 2, 3, 4],
  },
  {
    name: "Swami's",
    description:
      "Classic point break producing long right-handers on lined-up WNW swells in winter or long-period S swells in summer. Early paddle pays off as rotations form by 8am. Strict lineup etiquette - sit wide and wait your turn to snipe insiders. Kelp beds can slow boards, keep your rails clean. One of the most consistent and revered spots in North County.",
    features: [
      "Point break",
      "Right-handers",
      "Long rides",
      "Consistent",
      "Strict etiquette",
      "Advanced spot",
    ],
    takeaways: [
      "🌊 Point-rights; best on lined-up WNW (winter) or long-period S",
      "🕘 Early paddle pays—rotations form by 8am",
      "👥 Strict etiquette; sit wide to snipe insiders",
      "🪵 Kelp beds can slow boards—keep rails clean",
    ],
    bestConditions:
      "Lined-up WNW (winter) or long-period S swell, point break rights",
    crowdLevel: "heavy",
    skillLevel: "intermediate_to_advanced",
    etiquette: "Strict lineup etiquette, arrive early",
    bestMonths: [11, 12, 1, 2, 3, 6, 7, 8],
  },
  {
    name: "Cardiff Reef",
    description:
      "Playful reef break that excels on mid tide with fishes and logs. State lot and shoulder parking available (bring a pass or pay). Mixed craft lineups mean you'll see SUPs and foils - give them space. Watch for reef fingers and eelgrass on the inside. Fun, approachable reef for intermediates.",
    features: [
      "Reef break",
      "Fish friendly",
      "Longboard spot",
      "State park lot",
      "Mixed craft",
      "Playful waves",
    ],
    takeaways: [
      "🌊 Playful reef; mid tide, fishes/logs excel",
      "🅿️ State lot + shoulder parking; bring a pass or pay",
      "👥 Mixed craft lineups—give space to SUPs/foils",
      "⚠️ Reef fingers + eelgrass = watch the inside",
    ],
    bestConditions: "Mid tide, playful reef good for fish/logs",
    crowdLevel: "moderate",
    skillLevel: "intermediate",
    bestMonths: [9, 10, 11, 12, 1, 2, 3, 4],
  },
  {
    name: "Del Mar",
    description:
      "Beachbreak near 15th Street and the river mouth with peaks that work best on SSW/WNW combo swells. Mid tide provides the best shape. When the river is flowing, peaks can get rippy. The river mouth creates a strong rip that can be turbo on big tide swings. Parking via meters and neighborhood streets.",
    features: [
      "Beachbreak",
      "River mouth",
      "Sandy bottom",
      "Multiple peaks",
      "Consistent",
    ],
    takeaways: [
      "🅿️ 15th St meters + neighborhood shuffle",
      "🌊 Best on SSW/WNW combo; mid tide for shape",
      "👥 Peaks get rippy when the river's flowing",
      "⚠️ River mouth rip can be turbo on big tide swings",
    ],
    bestConditions: "SSW/WNW combo swells, mid tide",
    crowdLevel: "moderate",
    skillLevel: "intermediate",
    bestMonths: [8, 9, 10, 11, 12, 1, 2],
  },
  {
    name: "Oceanside Pier",
    description:
      "Peaky and punchy beachbreak that loves offshore Santa Ana mornings. The pier creates competitive packs directly underneath, but there's plenty of room north and south. Meters and lots available for parking - arrive early for civilized vibes, afternoons get hectic. Watch positioning around pier pilings and sneaker sets.",
    features: [
      "Pier break",
      "Peaky waves",
      "Parking lots",
      "Lifeguard on duty",
      "Year-round surf",
      "Plenty of peaks",
    ],
    takeaways: [
      "🅿️ Meters + lots; early is civilized, afternoons aren't",
      "🌊 Peaky and punchy; loves offshore Santa Ana mornings",
      "👥 Competitive pack under the pier; plenty of room north/south",
      "⚠️ Pier pilings + sneaker sets—mind positioning",
    ],
    bestConditions: "Offshore Santa Ana mornings, peaky and punchy",
    crowdLevel: "heavy",
    skillLevel: "intermediate",
    bestMonths: [8, 9, 10, 11, 12, 1, 2, 3],
  },
  {
    name: "Lower Trestles",
    description:
      "World-class high-performance wave producing perfect A-frames on long-period SSW swells. Requires 10-15 minute walk or bike (pack water, light leash). Wind sensitive - dawn patrol or evening glass-off are prime times. Alpha crowd with rotations - sit patient and pick the runners carefully. Worth every step of the walk.",
    features: [
      "World-class",
      "High-performance",
      "A-frame peaks",
      "Walk/bike access",
      "Consistent",
      "Advanced spot",
    ],
    takeaways: [
      "🚶 10–15 min walk/bike; pack water, light leash",
      "🌊 High-performance A-frames; best on long-period SSW",
      "💨 Wind sensitive—dawn patrol or late glass-off",
      "👥 Alpha crowd; sit patient and pick the runners",
    ],
    bestConditions: "Long-period SSW swell, dawn patrol or evening glass-off",
    crowdLevel: "very_heavy",
    skillLevel: "advanced",
    etiquette: "Alpha crowd, wait your turn and pick your waves carefully",
    bestMonths: [5, 6, 7, 8, 9, 10],
  },
  {
    name: "Sunset Cliffs",
    description:
      "Collection of reef breaks accessed via stairs and trails. Needs W/WNW energy to light up properly. Mid tide provides the best reef shape. Shallow rock and sea caves mean you need to check your exit before paddling out - don't get pinned on high tide. Respect locals and small takeoff zones. Advanced surfers only.",
    features: [
      "Reef breaks",
      "Multiple spots",
      "Scenic",
      "Trail access",
      "Advanced only",
      "Strong etiquette",
    ],
    takeaways: [
      "🚶 Access via stairs/trails; check your exit before paddling",
      "🌊 Needs W/WNW energy; mid tide for reef shape",
      "🪨 Shallow rock + sea caves—don't get pinned on high tide",
      "👥 Respect locals, small takeoff zones",
    ],
    bestConditions: "W/WNW swell, mid tide for reef shape",
    crowdLevel: "moderate",
    skillLevel: "advanced",
    etiquette: "Respect locals, small takeoff zones",
    bestMonths: [10, 11, 12, 1, 2, 3, 4],
  },
  {
    name: "Mission Beach",
    description:
      "Beachbreak at South Mission with a jetty that creates wedging waves. Big parking lot fills with volleyball crowds mid-day. Mid tide steadies the wave shape. Onshores wreck afternoons so go early for best conditions. The jetty rip runs hard on overhead pulses - keep eyes on the current.",
    features: [
      "Beachbreak",
      "Jetty wedges",
      "Parking lot",
      "Lifeguard on duty",
      "Sandy bottom",
      "Tourist area",
    ],
    takeaways: [
      "🅿️ Big lot at South Mission; volleyball crowds mid-day",
      "🌊 Jetty wedges; mid tide steadies the shape",
      "💨 Onshores wreck afternoons—go early",
      "⚠️ Jetty rip runs hard on overhead pulses",
    ],
    bestConditions:
      "Mid tide, early morning before onshores, jetty creates wedges",
    crowdLevel: "heavy",
    skillLevel: "intermediate",
    bestMonths: [8, 9, 10, 11, 12, 1, 2, 3],
  },
  {
    name: "Tamarack",
    description:
      "Family-friendly beachbreak in Carlsbad with jetty assistance creating reliable banks. Mid tide is money for shape. PCH shoulder parking turns over consistently. Family beach means swimmers - watch lifeguard flags and guarded zones. Jetty rip activates on bigger sets, keep an eye on downcoast drift.",
    features: [
      "Beachbreak",
      "Jetty breaks",
      "Family friendly",
      "Beginner friendly",
      "Lifeguard on duty",
      "Consistent",
    ],
    takeaways: [
      "🅿️ PCH shoulder parking; turns over consistently",
      "🌊 Beachbreak with jetty help; mid tide is money",
      "👥 Family beach = swimmers; watch flags + guarded zones",
      "⚠️ Jetty rip on bigger sets; keep an eye downcoast drift",
    ],
    bestConditions: "Mid tide, jetty creates banks",
    crowdLevel: "moderate",
    skillLevel: "beginner_to_intermediate",
    bestMonths: [8, 9, 10, 11, 12, 1, 2, 3],
  },
];

// Parse emoji-prefixed takeaways into structured tips
function parseTakeaways(takeaways) {
  const tips = {
    parking: [],
    access: [],
    wave: [],
    crowd: [],
    warnings: [],
  };

  takeaways.forEach((tip) => {
    const content = tip.substring(2).trim(); // Remove emoji and space
    if (tip.startsWith("🅿️")) tips.parking.push(content);
    else if (tip.startsWith("🚶") || tip.startsWith("🥾"))
      tips.access.push(content);
    else if (
      tip.startsWith("🌊") ||
      tip.startsWith("💨") ||
      tip.startsWith("🏄")
    )
      tips.wave.push(content);
    else if (tip.startsWith("👥")) tips.crowd.push(content);
    else if (tip.startsWith("⚠️") || tip.startsWith("🪨"))
      tips.warnings.push(content);
  });

  return tips;
}

async function importBeaches() {
  console.log("🏄 Importing AllTrails-style beach content...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const beach of curatedBeaches) {
    const parsedTips = parseTakeaways(beach.takeaways);

    const updateData = {
      description: beach.description,
      features: beach.features,
      parking_tips: parsedTips.parking.join(" "),
      access_tips: parsedTips.access.join(" "),
      wave_tips: parsedTips.wave.join(" "),
      crowd_tips: parsedTips.crowd.join(" "),
      warnings: parsedTips.warnings,
      best_conditions_prose: beach.bestConditions,
      crowd_level: beach.crowdLevel,
      local_etiquette: beach.etiquette || null,
      real_takeaways: beach.takeaways,
      best_months: beach.bestMonths || null,
    };

    const { error } = await supabase
      .from("beaches")
      .update(updateData)
      .ilike("name", `%${beach.name}%`);

    if (error) {
      console.error(`❌ Failed to update ${beach.name}:`, error.message);
      errorCount++;
    } else {
      console.log(`✅ Updated ${beach.name}`);
      successCount++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Successfully updated: ${successCount} beaches`);
  console.log(`❌ Failed: ${errorCount} beaches`);
  console.log("=".repeat(80));
}

importBeaches()
  .then(() => {
    console.log("\n✅ Import complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
