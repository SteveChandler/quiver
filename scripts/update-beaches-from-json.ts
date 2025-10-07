#!/usr/bin/env node

/**
 * Update beaches table from JSON file
 * 
 * This script:
 * - Reads surf_spots.json with beach data
 * - Verifies beach UUIDs exist in database
 * - Only updates null/empty fields (non-destructive)
 * - Backfills coordinates geography from lat/lon
 * - Supports test mode (single beach) and full update
 * 
 * Usage:
 *   # Test mode (first beach only)
 *   npx tsx scripts/update-beaches-from-json.ts --test
 * 
 *   # Update all beaches
 *   npx tsx scripts/update-beaches-from-json.ts
 * 
 *   # Specify custom JSON file
 *   npx tsx scripts/update-beaches-from-json.ts --file ./docs/surf_spots.json
 * 
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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

// Types
interface JSONBeachV1 {
  id: string; // UUID
  name: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  is_private?: boolean;
  owner_id?: string | null;
  created_at?: string | null;
  region?: string;
  country?: string;
  break_type?: string;
  hazards?: string[];
  skill_level?: string;
  shoreline_aspect_deg?: number;
  swell_window_min_deg?: number;
  swell_window_max_deg?: number;
  wind_offshore_deg?: number;
  wind_offshore_tol_deg?: number;
  wind_cross_shore_ok_kt?: number;
  wind_onshore_bad_kt?: number;
  preferred_tide_ft_min?: number;
  preferred_tide_ft_max?: number;
  preference_model?: any;
  aspect_deg?: number;
  offshore_deg?: number;
  swell_window_center_deg?: number;
  swell_window_halfwidth_deg?: number;
  tide_min_ft?: number;
  tide_max_ft?: number;
  wind_cross_ok_kts?: number;
  wind_onshore_bad_kts?: number;
  region_id?: string | null;
  coordinates?: any;
}

interface JSONBeachV2 {
  id: number; // Integer ID (needs name lookup)
  name: string;
  break_type?: string;
  hazards?: string;
  skill_level?: string;
  lat?: number;
  lon?: number;
  swell_window?: {
    min_deg?: number;
    max_deg?: number;
    center_deg?: number;
    half_width_deg?: number;
    described_directions?: string;
  };
  offshore_wind?: {
    direction_deg?: number;
    tolerance_deg?: number;
    max_cross_onshore_knots?: number;
    described_direction?: string;
  };
  tide_preference?: {
    range_ft?: string;
    described_preference?: string;
  };
  shoreline_aspect?: number;
  preference_model?: any;
}

type JSONBeach = JSONBeachV1 | JSONBeachV2;

interface UpdateStats {
  total: number;
  verified: number;
  notFound: number;
  updated: number;
  skipped: number;
  errors: number;
  fieldsUpdated: Record<string, number>;
}

// Parse CLI args
function parseArgs(argv: string[]) {
  const args = {
    file: path.join(__dirname, '..', 'docs', 'surf_spots.json'),
    test: false,
  };
  
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (argv[i] === '--test') {
      args.test = true;
    }
  }
  
  return args;
}

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

// Check if value is null or empty
function isNullOrEmpty(value: any): boolean {
  return value === null || value === undefined || value === '';
}

// Parse hazards string to array
function parseHazards(hazards: string | string[] | undefined): string[] | undefined {
  if (!hazards) return undefined;
  if (Array.isArray(hazards)) return hazards;
  
  // Parse comma-separated string
  return hazards.split(/,|;/).map(h => h.trim()).filter(h => h.length > 0);
}

// Parse tide range string (e.g., "1 – 4 ft") to min/max
function parseTideRange(rangeStr: string | undefined): { min?: number; max?: number } {
  if (!rangeStr) return {};
  
  // Match patterns like "1 – 4 ft" or "0 - 3 ft"
  const match = rangeStr.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if (match) {
    return {
      min: parseFloat(match[1]),
      max: parseFloat(match[2]),
    };
  }
  
  return {};
}

// Determine if JSON beach is V1 (UUID) or V2 (integer)
function isV1Beach(beach: JSONBeach): beach is JSONBeachV1 {
  return typeof beach.id === 'string' && beach.id.includes('-');
}

// Normalize V2 beach to V1 format
function normalizeV2Beach(beach: JSONBeachV2): Partial<JSONBeachV1> {
  const normalized: Partial<JSONBeachV1> = {
    name: beach.name,
    break_type: beach.break_type,
    skill_level: beach.skill_level,
    latitude: beach.lat,
    longitude: beach.lon,
  };
  
  // Parse hazards string
  if (beach.hazards) {
    normalized.hazards = parseHazards(beach.hazards);
  }
  
  // Swell window
  if (beach.swell_window) {
    normalized.swell_window_min_deg = beach.swell_window.min_deg;
    normalized.swell_window_max_deg = beach.swell_window.max_deg;
    normalized.swell_window_center_deg = beach.swell_window.center_deg;
    normalized.swell_window_halfwidth_deg = beach.swell_window.half_width_deg;
  }
  
  // Offshore wind
  if (beach.offshore_wind) {
    normalized.wind_offshore_deg = beach.offshore_wind.direction_deg;
    normalized.wind_offshore_tol_deg = beach.offshore_wind.tolerance_deg;
    normalized.wind_cross_shore_ok_kt = beach.offshore_wind.max_cross_onshore_knots;
  }
  
  // Tide preference
  if (beach.tide_preference?.range_ft) {
    const { min, max } = parseTideRange(beach.tide_preference.range_ft);
    normalized.tide_min_ft = min;
    normalized.tide_max_ft = max;
    normalized.preferred_tide_ft_min = min;
    normalized.preferred_tide_ft_max = max;
  }
  
  // Shoreline aspect
  if (beach.shoreline_aspect !== undefined) {
    normalized.shoreline_aspect_deg = beach.shoreline_aspect;
    normalized.aspect_deg = beach.shoreline_aspect;
  }
  
  // Preference model
  if (beach.preference_model) {
    normalized.preference_model = beach.preference_model;
  }
  
  return normalized;
}

// Find beach UUID by name (for V2 beaches with integer IDs)
async function findBeachByName(
  supabase: ReturnType<typeof createSupabaseClient>,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('beaches')
    .select('id, name')
    .ilike('name', name)
    .limit(1)
    .single();
  
  if (error || !data) {
    console.log(`   ⚠️  Beach not found by name: "${name}"`);
    return null;
  }
  
  return data.id;
}

// Verify beach exists by UUID
async function verifyBeachExists(
  supabase: ReturnType<typeof createSupabaseClient>,
  beachId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('beaches')
    .select('id')
    .eq('id', beachId)
    .single();
  
  return !error && !!data;
}

// Get current beach data
async function getCurrentBeachData(
  supabase: ReturnType<typeof createSupabaseClient>,
  beachId: string
) {
  const { data, error } = await supabase
    .from('beaches')
    .select('*')
    .eq('id', beachId)
    .single();
  
  if (error) throw error;
  return data;
}

// Build update object (only null/empty fields)
function buildUpdateObject(
  current: any,
  updates: Partial<JSONBeachV1>,
  stats: UpdateStats
): Record<string, any> {
  const updateObj: Record<string, any> = {};
  
  // Fields to update
  const fieldMappings: Record<string, string> = {
    location: 'location',
    latitude: 'latitude',
    longitude: 'longitude',
    region: 'region',
    country: 'country',
    break_type: 'break_type',
    hazards: 'hazards',
    skill_level: 'skill_level',
    shoreline_aspect_deg: 'shoreline_aspect_deg',
    swell_window_min_deg: 'swell_window_min_deg',
    swell_window_max_deg: 'swell_window_max_deg',
    wind_offshore_deg: 'wind_offshore_deg',
    wind_offshore_tol_deg: 'wind_offshore_tol_deg',
    wind_cross_shore_ok_kt: 'wind_cross_shore_ok_kt',
    wind_onshore_bad_kt: 'wind_onshore_bad_kt',
    preferred_tide_ft_min: 'preferred_tide_ft_min',
    preferred_tide_ft_max: 'preferred_tide_ft_max',
    preference_model: 'preference_model',
    aspect_deg: 'aspect_deg',
    offshore_deg: 'offshore_deg',
    swell_window_center_deg: 'swell_window_center_deg',
    swell_window_halfwidth_deg: 'swell_window_halfwidth_deg',
    tide_min_ft: 'tide_min_ft',
    tide_max_ft: 'tide_max_ft',
    wind_cross_ok_kts: 'wind_cross_ok_kts',
    wind_onshore_bad_kts: 'wind_onshore_bad_kts',
  };
  
  // Check each field
  for (const [jsonField, dbField] of Object.entries(fieldMappings)) {
    const jsonValue = (updates as any)[jsonField];
    const currentValue = current[dbField];
    
    // Only update if:
    // 1. JSON has a value (not null/undefined)
    // 2. Current DB value is null/empty
    if (jsonValue !== undefined && jsonValue !== null && isNullOrEmpty(currentValue)) {
      updateObj[dbField] = jsonValue;
      stats.fieldsUpdated[dbField] = (stats.fieldsUpdated[dbField] || 0) + 1;
    }
  }
  
  return updateObj;
}

// Update coordinates geography from lat/lon
async function updateCoordinates(
  supabase: ReturnType<typeof createSupabaseClient>,
  beachId: string,
  current: any
): Promise<boolean> {
  // Check if coordinates already exist
  if (current.coordinates) {
    return false; // Skip, already has coordinates
  }
  
  // Get lat/lon from either field set
  const lat = current.lat || current.latitude;
  const lon = current.lon || current.longitude;
  
  if (!lat || !lon) {
    return false; // Can't backfill without coordinates
  }
  
  // Update using PostGIS ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  const { error } = await supabase.rpc('update_beach_coordinates', {
    p_beach_id: beachId,
    p_longitude: lon,
    p_latitude: lat,
  });
  
  if (error) {
    // If function doesn't exist, use raw SQL
    const { error: rawError } = await supabase
      .from('beaches')
      .update({
        coordinates: `SRID=4326;POINT(${lon} ${lat})` as any,
      })
      .eq('id', beachId);
    
    return !rawError;
  }
  
  return true;
}

// Update a single beach
async function updateBeach(
  supabase: ReturnType<typeof createSupabaseClient>,
  jsonBeach: JSONBeach,
  stats: UpdateStats
): Promise<void> {
  try {
    // Determine format and get beach ID
    let beachId: string | null = null;
    let updates: Partial<JSONBeachV1>;
    
    if (isV1Beach(jsonBeach)) {
      // V1: UUID format
      beachId = jsonBeach.id;
      updates = jsonBeach;
      console.log(`\n🔍 Processing: ${jsonBeach.name} (${beachId})`);
    } else {
      // V2: Integer ID format - need to find by name
      console.log(`\n🔍 Processing: ${jsonBeach.name} (integer ID ${jsonBeach.id}, looking up UUID...)`);
      beachId = await findBeachByName(supabase, jsonBeach.name);
      updates = normalizeV2Beach(jsonBeach);
    }
    
    // Verify beach exists
    if (!beachId) {
      console.log(`   ❌ Beach not found in database`);
      stats.notFound++;
      return;
    }
    
    const exists = await verifyBeachExists(supabase, beachId);
    if (!exists) {
      console.log(`   ❌ Beach UUID ${beachId} not found in database`);
      stats.notFound++;
      return;
    }
    
    stats.verified++;
    console.log(`   ✅ Beach verified in database`);
    
    // Get current beach data
    const current = await getCurrentBeachData(supabase, beachId);
    
    // Build update object (only null/empty fields)
    const updateObj = buildUpdateObject(current, updates, stats);
    
    // Update beach if there are changes
    if (Object.keys(updateObj).length > 0) {
      console.log(`   📝 Updating ${Object.keys(updateObj).length} fields:`, Object.keys(updateObj).join(', '));
      
      const { error } = await supabase
        .from('beaches')
        .update(updateObj)
        .eq('id', beachId);
      
      if (error) {
        console.error(`   ❌ Update error:`, error.message);
        stats.errors++;
        return;
      }
      
      stats.updated++;
      console.log(`   ✅ Updated successfully`);
    } else {
      console.log(`   ⏭️  No null/empty fields to update`);
      stats.skipped++;
    }
    
    // Backfill coordinates if needed
    const coordsUpdated = await updateCoordinates(supabase, beachId, current);
    if (coordsUpdated) {
      console.log(`   🗺️  Backfilled coordinates geography field`);
      stats.fieldsUpdated.coordinates = (stats.fieldsUpdated.coordinates || 0) + 1;
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error processing beach:`, error.message);
    stats.errors++;
  }
}

// Main function
async function main() {
  const args = parseArgs(process.argv);
  
  console.log('🏖️  Beach Data Update Script');
  console.log('=' .repeat(50));
  console.log(`📁 JSON File: ${args.file}`);
  console.log(`🧪 Test Mode: ${args.test ? 'YES (first beach only)' : 'NO (all beaches)'}`);
  console.log('=' .repeat(50));
  
  // Read JSON file
  if (!fs.existsSync(args.file)) {
    throw new Error(`JSON file not found: ${args.file}`);
  }
  
  let jsonContent = fs.readFileSync(args.file, 'utf-8');
  
  // Fix invalid JSON escape sequences (e.g., \' is not valid JSON)
  // In JSON, single quotes don't need escaping, so we remove the backslash
  jsonContent = jsonContent.replace(/\\'/g, "'");
  
  // The file contains two separate JSON arrays concatenated together
  // We need to parse them separately and combine them
  let beaches: JSONBeach[] = [];
  
  // Split by array boundaries - find all complete JSON arrays
  const arrayPattern = /\[\s*\{[\s\S]*?\}\s*\]/g;
  const matches = jsonContent.match(arrayPattern);
  
  if (!matches) {
    throw new Error('No valid JSON arrays found in file');
  }
  
  console.log(`\n🔍 Found ${matches.length} JSON array(s) in file`);
  
  // Parse each array and combine
  for (let i = 0; i < matches.length; i++) {
    try {
      const arrayBeaches = JSON.parse(matches[i]);
      beaches = beaches.concat(arrayBeaches);
      console.log(`   ✅ Parsed array ${i + 1}: ${arrayBeaches.length} beaches`);
    } catch (error: any) {
      console.error(`   ❌ Error parsing array ${i + 1}:`, error.message);
      throw error;
    }
  }
  
  console.log(`\n📊 Found ${beaches.length} beaches in JSON file`);
  
  // Test mode: only first beach
  const beachesToProcess = args.test ? beaches.slice(0, 1) : beaches;
  
  if (args.test) {
    console.log('⚠️  TEST MODE: Processing only first beach\n');
  }
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  // Initialize stats
  const stats: UpdateStats = {
    total: beachesToProcess.length,
    verified: 0,
    notFound: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    fieldsUpdated: {},
  };
  
  // Process beaches
  for (const beach of beachesToProcess) {
    await updateBeach(supabase, beach, stats);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 UPDATE SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Total Beaches:    ${stats.total}`);
  console.log(`✅ Verified:       ${stats.verified}`);
  console.log(`❌ Not Found:      ${stats.notFound}`);
  console.log(`📝 Updated:        ${stats.updated}`);
  console.log(`⏭️  Skipped:        ${stats.skipped} (no null fields)`);
  console.log(`❌ Errors:         ${stats.errors}`);
  
  console.log('\n📊 Fields Updated:');
  const sortedFields = Object.entries(stats.fieldsUpdated)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedFields.length > 0) {
    for (const [field, count] of sortedFields) {
      console.log(`   ${field.padEnd(30)} ${count}`);
    }
  } else {
    console.log('   (none)');
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (args.test) {
    console.log('\n💡 Test complete! To update all beaches, run without --test flag');
  } else {
    console.log('\n✅ All beaches processed!');
  }
}

// Run
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
