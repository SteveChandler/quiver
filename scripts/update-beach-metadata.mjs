#!/usr/bin/env node
/**
 * Update beach metadata (break_type, skill_level, hazards)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Clean up contentReference artifacts from the data
function cleanText(text) {
  if (!text) return text;
  return text
    .replace(/:contentReference\[oaicite:\d+\]\{index:\d+\}/g, "")
    .trim();
}

// Parse hazards into an array
function parseHazards(hazardsText) {
  if (!hazardsText) return [];
  const cleaned = cleanText(hazardsText);
  // Split by common separators and clean up
  return cleaned
    .split(/[,;]/)
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

// Normalize break type
function normalizeBreakType(breakType) {
  const cleaned = cleanText(breakType).toLowerCase();

  if (cleaned.includes("beach")) return "beach";
  if (cleaned.includes("reef")) return "reef";
  if (cleaned.includes("point")) return "point";
  if (cleaned.includes("pier")) return "pier";
  if (cleaned.includes("jetty")) return "jetty";

  return "beach"; // default
}

// Normalize skill level
function normalizeSkillLevel(skillLevel) {
  const cleaned = cleanText(skillLevel).toLowerCase();

  if (cleaned.includes("beginner") && cleaned.includes("intermediate")) {
    return "beginner-intermediate";
  }
  if (cleaned.includes("intermediate") && cleaned.includes("advanced")) {
    return "intermediate-advanced";
  }
  if (cleaned.includes("advanced")) return "advanced";
  if (cleaned.includes("intermediate")) return "intermediate";
  if (cleaned.includes("beginner")) return "beginner";

  return "intermediate"; // default
}

const beachData = [
  {
    name: "Pacific Beach",
    break_type: "Beach break:contentReference[oaicite:0]{index=0}",
    skill_level: "Beginner to intermediate",
    hazards: "Pier, rocks, rip currents:contentReference[oaicite:1]{index=1}",
  },
  {
    name: "Windansea",
    break_type: "Reef break:contentReference[oaicite:2]{index=2}",
    skill_level: "Advanced",
    hazards: "Shallow reef, localism:contentReference[oaicite:3]{index=3}",
  },
  {
    name: "Torrey Pines State Beach",
    break_type: "Beach break:contentReference[oaicite:4]{index=4}",
    skill_level: "Intermediate:contentReference[oaicite:5]{index=5}",
    hazards:
      "Strong rip currents and closeouts on large swells:contentReference[oaicite:6]{index=6}",
  },
  {
    name: "Del Mar",
    break_type:
      "Beach break (sandy bottom):contentReference[oaicite:7]{index=7}",
    skill_level:
      "Beginner to intermediate:contentReference[oaicite:8]{index=8}",
    hazards: "Rip currents, stingrays (common in warm shallows)",
  },
  {
    name: "Del Mar Rivermouth",
    break_type: "River-mouth sandbar (beach break)",
    skill_level: "Intermediate to advanced",
    hazards:
      "Polluted water (urban runoff) and sharks:contentReference[oaicite:9]{index=9}",
  },
  {
    name: "Solana Beach",
    break_type: "Beach break (with some reef)",
    skill_level: "Intermediate",
    hazards: "Rip currents, stingrays (shuffle feet to avoid)",
  },
  {
    name: "San Elijo State Beach",
    break_type: "Rocky reef break:contentReference[oaicite:10]{index=10}",
    skill_level: "Beginner to intermediate",
    hazards:
      "Reef (shallow at low tide), crowds on weekends:contentReference[oaicite:11]{index=11}",
  },
  {
    name: "Forster St. Oceanside",
    break_type: "Beach break",
    skill_level: "Intermediate",
    hazards: "Runoff pollution after rain, strong rip currents",
  },
  {
    name: "Oceanside Pier",
    break_type: "Beach break:contentReference[oaicite:12]{index=12}",
    skill_level: "Beginner to intermediate",
    hazards:
      "Pollution after rain, strong currents:contentReference[oaicite:13]{index=13}; heavy crowds near pier",
  },
  {
    name: "Imperial Beach Pier",
    break_type: "Beach break",
    skill_level: "Intermediate",
    hazards:
      "Severe water pollution (sewage):contentReference[oaicite:14]{index=14}:contentReference[oaicite:15]{index=15}, powerful rip currents",
  },
  {
    name: "Upper Trestles",
    break_type:
      "Point break (cobblestone):contentReference[oaicite:16]{index=16}",
    skill_level: "Intermediate",
    hazards:
      "Crowded lineup, cobblestone rocks:contentReference[oaicite:17]{index=17}",
  },
  {
    name: "Cottons",
    break_type: "Point break (cobblestone)",
    skill_level: "Intermediate",
    hazards: "Cobblestones on shore/reef, crowd factor",
  },
  {
    name: "Church",
    break_type: "Reef/point break",
    skill_level: "Intermediate",
    hazards: "Cobblestone reef, crowds on good days",
  },
  {
    name: "Middles",
    break_type: "Reef break",
    skill_level: "Intermediate",
    hazards: "Uneven cobblestone bottom, crowds",
  },
  {
    name: "Trails",
    break_type: "Reef break",
    skill_level: "Intermediate",
    hazards: "Rocky reef, occasional shark sightings",
  },
  {
    name: "San Onofre State Beach",
    break_type: "Reef break:contentReference[oaicite:18]{index=18}",
    skill_level:
      "Beginner (very forgiving longboard wave):contentReference[oaicite:19]{index=19}",
    hazards:
      "Submerged rocks on reef:contentReference[oaicite:20]{index=20}, very crowded lineup",
  },
];

async function updateBeaches() {
  console.log("🏖️  Updating beach metadata...\n");

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const beach of beachData) {
    const breakType = normalizeBreakType(beach.break_type);
    const skillLevel = normalizeSkillLevel(beach.skill_level);
    const hazards = parseHazards(beach.hazards);

    console.log(`\n📍 ${beach.name}`);
    console.log(`   Break Type: ${breakType}`);
    console.log(`   Skill Level: ${skillLevel}`);
    console.log(`   Hazards: [${hazards.join(", ")}]`);

    // Find beach by name (case-insensitive)
    const { data: existingBeach, error: findError } = await supabase
      .from("beaches")
      .select("id, name")
      .ilike("name", beach.name)
      .single();

    if (findError || !existingBeach) {
      console.log(`   ❌ Beach not found: ${beach.name}`);
      notFound++;
      continue;
    }

    // Update beach
    const { error: updateError } = await supabase
      .from("beaches")
      .update({
        break_type: breakType,
        skill_level: skillLevel,
        hazards: hazards,
      })
      .eq("id", existingBeach.id);

    if (updateError) {
      console.log(`   ❌ Error updating: ${updateError.message}`);
      errors++;
    } else {
      console.log(`   ✅ Updated successfully`);
      updated++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ❌ Not found: ${notFound}`);
  console.log(`  ⚠️  Errors: ${errors}`);
  console.log(`  📝 Total processed: ${beachData.length}`);
}

updateBeaches().catch(console.error);
