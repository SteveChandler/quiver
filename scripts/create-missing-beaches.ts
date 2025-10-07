#!/usr/bin/env node

/**
 * Create missing beaches from JSON
 * 
 * This script:
 * - Creates 14 new beaches that don't exist in the database
 * - Skips "Windansea Beach" (already exists as "Windansea")
 * - Handles full beach data including preference models
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import type { Database } from '../types/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const localEnvPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}
loadEnv();

// Create Supabase client
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Parse hazards string to array
function parseHazards(hazards: string | string[]): string[] {
  if (Array.isArray(hazards)) return hazards;
  return hazards.split(/[,;]/).map(h => h.trim()).filter(h => h.length > 0);
}

// Parse tide range
function parseTideRange(rangeStr: string): { min: number; max: number } {
  const match = rangeStr.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if (match) {
    return {
      min: parseFloat(match[1]),
      max: parseFloat(match[2]),
    };
  }
  return { min: 0, max: 4 };
}

// Get skill level normalized value
function normalizeSkillLevel(skill: string): string {
  const lower = skill.toLowerCase();
  if (lower.includes('beginner')) return 'beginner';
  if (lower.includes('intermediate') && lower.includes('advanced')) return 'intermediate';
  if (lower.includes('advanced') || lower.includes('experienced')) return 'advanced';
  if (lower.includes('all levels')) return 'beginner';
  return 'intermediate';
}

// Normalize break type
function normalizeBreakType(breakType: string): string {
  const lower = breakType.toLowerCase();
  if (lower.includes('reef')) return 'reef';
  if (lower.includes('point')) return 'point';
  if (lower.includes('beach')) return 'beach';
  if (lower.includes('jetty')) return 'beach'; // Jetties are typically beach breaks
  if (lower.includes('pier')) return 'beach';
  return 'beach';
}

// Parse location from beach name
function extractLocation(name: string): string {
  // Extract location hints from name
  if (name.includes('Coronado')) return 'Coronado, San Diego, CA';
  if (name.includes('Sunset Cliffs')) return 'Sunset Cliffs, San Diego, CA';
  if (name.includes('Ocean Beach')) return 'Ocean Beach, San Diego, CA';
  if (name.includes('Mission')) return 'Mission Beach, San Diego, CA';
  if (name.includes('Pacific Beach')) return 'Pacific Beach, San Diego, CA';
  if (name.includes('Tourmaline')) return 'Pacific Beach, San Diego, CA';
  if (name.includes('Windansea')) return 'La Jolla, San Diego, CA';
  if (name.includes('Marine Street')) return 'La Jolla, San Diego, CA';
  if (name.includes('Tijuana')) return 'Imperial Beach, San Diego, CA';
  if (name.includes('Silver Strand')) return 'Coronado, San Diego, CA';
  return 'San Diego, CA';
}

// Beaches to create (excluding Windansea which already exists)
const beachesToCreate = [
  {
    id: 16,
    name: "Tijuana Sloughs",
    break_type: "exposed beach and reef break (pebbles and sand)",
    hazards: "water pollution, sharks and stingrays, strong rips; reef/rocks at take‑off zone",
    skill_level: "intermediate to advanced",
    lat: 32.5517,
    lon: -117.1271,
    swell_window: { min_deg: 250, max_deg: 290, center_deg: 270, half_width_deg: 20 },
    offshore_wind: { direction_deg: 67.5, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "1 – 4 ft" },
    shoreline_aspect: 310,
    preference_model: {
      provenance: ["Surf‑Forecast", "Surfspot.app", "Tijuana River location"],
      confidence: 0.71,
      notes: "Swell window derived from WSW–W through WNW; center at ~270°. Offshore wind from E‑ENE (67.5°) with ±45° tolerance."
    }
  },
  {
    id: 17,
    name: "Silver Strand State Beach",
    break_type: "gentle sandy beach break with shifting sandbars",
    hazards: "rip currents and occasional pollution",
    skill_level: "beginner to intermediate",
    lat: 32.6466,
    lon: -117.1479,
    swell_window: { min_deg: 190, max_deg: 240, center_deg: 215, half_width_deg: 25 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "1 – 4 ft" },
    shoreline_aspect: 310,
    preference_model: {
      provenance: ["Mission Beach Surfing School"],
      confidence: 0.63,
      notes: "Swell window approximated from S‑SW because the beach mainly faces NW and responds to summer south swells."
    }
  },
  {
    id: 18,
    name: "Coronado North Jetty",
    break_type: "exposed beach break with shifting sandbars",
    hazards: "occasional rips; sandbars shift seasonally",
    skill_level: "beginner to intermediate",
    lat: 32.6785,
    lon: -117.1720,
    swell_window: { min_deg: 220, max_deg: 250, center_deg: 235, half_width_deg: 15 },
    offshore_wind: { direction_deg: 0, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "2 – 5 ft" },
    shoreline_aspect: 320,
    preference_model: {
      provenance: ["Surf‑Forecast"],
      confidence: 0.56,
      notes: "Latitude approximated for the northern jetty near the Naval Base. Offshore wind from north."
    }
  },
  {
    id: 19,
    name: "Hotel Del Coronado",
    break_type: "fickle beach break over shifting sandbar",
    hazards: "shallow sandbar during hurricane swells; shorebreak; inconsistent currents",
    skill_level: "beginner",
    lat: 32.6809,
    lon: -117.1784,
    swell_window: { min_deg: 190, max_deg: 235, center_deg: 212.5, half_width_deg: 22.5 },
    offshore_wind: { direction_deg: 45, tolerance_deg: 45, max_cross_onshore_knots: 12 },
    tide_preference: { range_ft: "1 – 4 ft" },
    shoreline_aspect: 320,
    preference_model: {
      provenance: ["Go Surfing SD"],
      confidence: 0.66,
      notes: "Fickle beach break; during hurricane swells a fast left breaks off the sandbar for advanced surfers."
    }
  },
  {
    id: 20,
    name: "Sunset Cliffs (Garbage)",
    break_type: "reef break with kelp-coated reef",
    hazards: "long paddle‑out, strong currents, rocky reef and cliff access; localism",
    skill_level: "advanced",
    lat: 32.7195,
    lon: -117.2574,
    swell_window: { min_deg: 275, max_deg: 305, center_deg: 290, half_width_deg: 15 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "0 – 3 ft" },
    shoreline_aspect: 250,
    preference_model: {
      provenance: ["Go Surfing SD"],
      confidence: 0.71,
      notes: "Scenic reef break shining during winter NW swells. High tide swamps the reef."
    }
  },
  {
    id: 21,
    name: "Osprey Point",
    break_type: "reef/rocky point break producing barrels",
    hazards: "rocky reef, localism, strong currents; long paddle and cliff access",
    skill_level: "advanced",
    lat: 32.7362,
    lon: -117.2561,
    swell_window: { min_deg: 280, max_deg: 310, center_deg: 295, half_width_deg: 15 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "0 – 3 ft" },
    shoreline_aspect: 250,
    preference_model: {
      provenance: ["Go Visit San Diego", "da Surf Engine"],
      confidence: 0.78,
      notes: "Great break for experienced surfers; waves can rise up to 12 ft and produce barrels."
    }
  },
  {
    id: 22,
    name: "New Break (Nubes)",
    break_type: "reef point break producing long rights",
    hazards: "shallow reef with coral, long paddle and strong currents",
    skill_level: "advanced",
    lat: 32.7195,
    lon: -117.2574,
    swell_window: { min_deg: 280, max_deg: 320, center_deg: 300, half_width_deg: 20 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 60, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "0 – 3 ft" },
    shoreline_aspect: 245,
    preference_model: {
      provenance: ["Go Visit San Diego", "Surf Atlas"],
      confidence: 0.69,
      notes: "Coveted reef break producing spectacular right‑handers. Wind direction not critical due to swell wrapping."
    }
  },
  {
    id: 23,
    name: "Avalanche",
    break_type: "consistent sand‑bottom beach break at jetty",
    hazards: "rips around the jetty, occasional pollution, crowds",
    skill_level: "intermediate",
    lat: 32.7542,
    lon: -117.2539,
    swell_window: { min_deg: 260, max_deg: 305, center_deg: 282.5, half_width_deg: 22.5 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "0 – 3 ft" },
    shoreline_aspect: 260,
    preference_model: {
      provenance: ["Go Surfing SD", "Worldwide Surf Guide"],
      confidence: 0.76,
      notes: "Consistent beach break accessible from Dog Beach parking; works on any swell with west in it."
    }
  },
  {
    id: 24,
    name: "Big Jetty",
    break_type: "sand‑bottom and rock jetty break",
    hazards: "tight take‑off zone, rips near jetty, possible sewage spills from river mouth",
    skill_level: "advanced",
    lat: 32.7447,
    lon: -117.2518,
    swell_window: { min_deg: 260, max_deg: 300, center_deg: 280, half_width_deg: 20 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "0 – 3 ft" },
    shoreline_aspect: 265,
    preference_model: {
      provenance: ["Worldwide Surf Guide", "Go Surfing SD"],
      confidence: 0.61,
      notes: "Hollow right off the southern jetty of Mission Bay; critical and hollow."
    }
  },
  {
    id: 25,
    name: "Ocean Beach Pier",
    break_type: "sand‑bottom beach break near pier",
    hazards: "crowds, pier pylons, occasional pollution",
    skill_level: "intermediate",
    lat: 32.7500,
    lon: -117.2525,
    swell_window: { min_deg: 270, max_deg: 310, center_deg: 290, half_width_deg: 20 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "0 – 4 ft" },
    shoreline_aspect: 260,
    preference_model: {
      provenance: ["Worldwide Surf Guide"],
      confidence: 0.55,
      notes: "Mediocre peaks best at low to medium tide; sand bottom."
    }
  },
  {
    id: 26,
    name: "Mission Beach (Central)",
    break_type: "sandy beach break with shifting peaks",
    hazards: "rip currents, occasional pollution",
    skill_level: "beginner",
    lat: 32.7681,
    lon: -117.2520,
    swell_window: { min_deg: 260, max_deg: 300, center_deg: 280, half_width_deg: 20 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "1 – 4 ft" },
    shoreline_aspect: 260,
    preference_model: {
      provenance: ["General knowledge"],
      confidence: 0.49,
      notes: "Broad sandy beach adjacent to Big Jetty and Avalanche; shifting peaks."
    }
  },
  {
    id: 27,
    name: "Crystal Pier",
    break_type: "sandy beach break around pier",
    hazards: "crowds, pier, rip currents",
    skill_level: "beginner",
    lat: 32.7950,
    lon: -117.2570,
    swell_window: { min_deg: 255, max_deg: 295, center_deg: 275, half_width_deg: 20 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "1 – 5 ft" },
    shoreline_aspect: 260,
    preference_model: {
      provenance: ["Worldwide Surf Guide"],
      confidence: 0.45,
      notes: "Peaky sand‑bar waves; mid to high tide preferred."
    }
  },
  {
    id: 28,
    name: "Tourmaline Surf Park",
    break_type: "mellow reef and sand point break",
    hazards: "crowds, reef at low tide",
    skill_level: "beginner",
    lat: 32.8074,
    lon: -117.2598,
    swell_window: { min_deg: 255, max_deg: 295, center_deg: 275, half_width_deg: 20 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 15 },
    tide_preference: { range_ft: "2 – 5 ft" },
    shoreline_aspect: 250,
    preference_model: {
      provenance: ["Worldwide Surf Guide"],
      confidence: 0.56,
      notes: "Longboarder's reef and sand break; beginner friendly."
    }
  },
  {
    id: 30,
    name: "Marine Street Beach",
    break_type: "heavy shorebreak with sand/rock bottom",
    hazards: "dangerous shorebreak, strong rip currents, shallow bottom",
    skill_level: "advanced",
    lat: 32.8418,
    lon: -117.2793,
    swell_window: { min_deg: 220, max_deg: 280, center_deg: 250, half_width_deg: 30 },
    offshore_wind: { direction_deg: 90, tolerance_deg: 45, max_cross_onshore_knots: 10 },
    tide_preference: { range_ft: "0 – 3 ft" },
    shoreline_aspect: 240,
    preference_model: {
      provenance: ["Worldwide Surf Guide"],
      confidence: 0.54,
      notes: "Known for heavy shorebreak rather than surfable waves; more suited for bodyboarding."
    }
  },
];

async function createBeach(supabase: ReturnType<typeof createSupabaseClient>, beach: any) {
  const tide = parseTideRange(beach.tide_preference.range_ft);
  const location = extractLocation(beach.name);
  
  const insertData = {
    name: beach.name,
    location,
    latitude: beach.lat,
    longitude: beach.lon,
    region: 'San Diego, CA',
    country: 'USA',
    break_type: normalizeBreakType(beach.break_type),
    hazards: parseHazards(beach.hazards),
    skill_level: normalizeSkillLevel(beach.skill_level),
    shoreline_aspect_deg: beach.shoreline_aspect,
    swell_window_min_deg: beach.swell_window.min_deg,
    swell_window_max_deg: beach.swell_window.max_deg,
    swell_window_center_deg: Math.round(beach.swell_window.center_deg), // Round decimals
    swell_window_halfwidth_deg: Math.round(beach.swell_window.half_width_deg), // Round decimals
    wind_offshore_deg: Math.round(beach.offshore_wind.direction_deg), // Round decimals
    wind_offshore_tol_deg: beach.offshore_wind.tolerance_deg,
    wind_cross_shore_ok_kt: beach.offshore_wind.max_cross_onshore_knots,
    wind_onshore_bad_kt: 8,
    preferred_tide_ft_min: tide.min,
    preferred_tide_ft_max: tide.max,
    tide_min_ft: tide.min,
    tide_max_ft: tide.max,
    aspect_deg: beach.shoreline_aspect,
    offshore_deg: Math.round(beach.offshore_wind.direction_deg), // Round decimals
    wind_cross_ok_kts: beach.offshore_wind.max_cross_onshore_knots,
    wind_onshore_bad_kts: 8,
    preference_model: beach.preference_model,
    is_private: false,
  };
  
  const { data, error } = await supabase
    .from('beaches')
    .insert(insertData)
    .select('id, name')
    .single();
  
  if (error) throw error;
  return data;
}

async function main() {
  console.log('🏖️  Creating Missing Beaches\n');
  console.log('=' .repeat(80));
  console.log(`Total beaches to create: ${beachesToCreate.length}`);
  console.log('Note: Skipping "Windansea Beach" (already exists as "Windansea")');
  console.log('=' .repeat(80));
  
  const supabase = createSupabaseClient();
  
  const results = {
    created: [] as any[],
    errors: [] as any[],
  };
  
  for (const beach of beachesToCreate) {
    try {
      console.log(`\n🔨 Creating: ${beach.name}`);
      const created = await createBeach(supabase, beach);
      results.created.push(created);
      console.log(`   ✅ Created with UUID: ${created.id}`);
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      results.errors.push({ beach: beach.name, error: error.message });
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY\n');
  console.log(`✅ Successfully Created: ${results.created.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);
  
  if (results.created.length > 0) {
    console.log('\n✅ Created Beaches:');
    results.created.forEach(b => {
      console.log(`   - ${b.name} (${b.id})`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(e => {
      console.log(`   - ${e.beach}: ${e.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 Next Steps:');
  console.log('   1. Run the update script again to populate data from JSON:');
  console.log('      npx tsx scripts/update-beaches-from-json.ts');
  console.log('   2. Manually update "Windansea Beach" entry (ID 29) to use UUID:');
  console.log('      6f42d47d-215b-47cb-ac14-b83bf8c2a797');
}

main().catch(console.error);
