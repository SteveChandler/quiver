#!/usr/bin/env node

/**
 * Update beaches from surf_spots_next20.json with fuzzy matching
 * 
 * Features:
 * - Fuzzy name matching (90%+ similarity)
 * - Coordinate proximity search (150m tolerance)
 * - Only updates NULL/empty fields (preserves existing data)
 * - Generates detailed match report
 * - Dry-run mode for safe preview
 * 
 * Usage:
 *   # Dry run (preview changes)
 *   npx tsx scripts/update-beaches-from-surf-spots-next20.ts --dry-run
 * 
 *   # Execute updates
 *   npx tsx scripts/update-beaches-from-surf-spots-next20.ts
 * 
 *   # Custom JSON file
 *   npx tsx scripts/update-beaches-from-surf-spots-next20.ts --file ./docs/custom.json
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
interface JSONBeach {
  id: string; // Slug ID (not UUID)
  name: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
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
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
  preference_model?: any;
  aspect_deg?: number;
  offshore_deg?: number;
  swell_window_center_deg?: number;
  swell_window_halfwidth_deg?: number;
  tide_min_ft?: number | null;
  tide_max_ft?: number | null;
  wind_cross_ok_kts?: number;
  wind_onshore_bad_kts?: number;
  region_id?: string | null;
  coordinates?: any;
}

interface DBBeach {
  id: string;
  name: string;
  location?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lon?: number | null;
  [key: string]: any;
}

interface MatchResult {
  jsonBeach: JSONBeach;
  dbBeach: DBBeach | null;
  matchType: 'name' | 'coordinates' | 'none';
  matchConfidence: number; // 0-100
  matchDetails: string;
  fieldsToUpdate: string[];
  updatePreview: Record<string, any>;
}

interface UpdateStats {
  total: number;
  matched: number;
  notMatched: number;
  nameMatches: number;
  coordinateMatches: number;
  updated: number;
  skipped: number;
  errors: number;
  fieldsUpdated: Record<string, number>;
}

// Parse CLI args
function parseArgs(argv: string[]) {
  const args = {
    file: path.join(__dirname, '..', 'docs', 'surf_spots_next20.json'),
    dryRun: false,
  };
  
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
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

// Levenshtein distance for string similarity
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Calculate string similarity (0-100)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

// Calculate distance between coordinates in meters (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

// Normalize beach name for comparison
function normalizeBeachName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Find matching beach by fuzzy name
async function findBeachByName(
  supabase: ReturnType<typeof createSupabaseClient>,
  jsonBeach: JSONBeach,
  minSimilarity: number = 85 // Lowered from 90 to 85 for better matching
): Promise<{ beach: DBBeach | null; confidence: number; details: string }> {
  // Get all beaches - we'll do fuzzy matching in-memory
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('*');
  
  if (error || !beaches || beaches.length === 0) {
    return { beach: null, confidence: 0, details: 'No beaches found in database' };
  }
  
  // Calculate similarity for each beach
  let bestMatch: DBBeach | null = null;
  let bestSimilarity = 0;
  let bestDetails = '';
  
  for (const dbBeach of beaches) {
    // Calculate name similarity
    const nameSimilarity = calculateSimilarity(jsonBeach.name, dbBeach.name);
    
    // Calculate region/location similarity if available
    let regionSimilarity = 0;
    if (jsonBeach.region && dbBeach.region) {
      regionSimilarity = calculateSimilarity(jsonBeach.region, dbBeach.region);
    } else if (jsonBeach.location && dbBeach.location) {
      regionSimilarity = calculateSimilarity(jsonBeach.location, dbBeach.location);
    }
    
    // Combined similarity (weighted: 80% name, 20% region)
    const combinedSimilarity = nameSimilarity * 0.8 + regionSimilarity * 0.2;
    
    if (combinedSimilarity > bestSimilarity) {
      bestSimilarity = combinedSimilarity;
      bestMatch = dbBeach;
      bestDetails = `Name: ${nameSimilarity}%, Region: ${regionSimilarity}%`;
    }
  }
  
  // Only return match if above threshold
  if (bestSimilarity >= minSimilarity) {
    return {
      beach: bestMatch,
      confidence: Math.round(bestSimilarity),
      details: `Fuzzy match - ${bestDetails}`,
    };
  }
  
  return {
    beach: null,
    confidence: Math.round(bestSimilarity),
    details: `Best match only ${Math.round(bestSimilarity)}% similar`,
  };
}

// Find matching beach by coordinates
async function findBeachByCoordinates(
  supabase: ReturnType<typeof createSupabaseClient>,
  jsonBeach: JSONBeach,
  maxDistanceMeters: number = 2000 // Increased from 150m to 2km for better matching
): Promise<{ beach: DBBeach | null; confidence: number; details: string }> {
  if (!jsonBeach.latitude || !jsonBeach.longitude) {
    return { beach: null, confidence: 0, details: 'No coordinates in JSON' };
  }
  
  // Get all beaches (we'll filter by distance)
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  
  if (error || !beaches || beaches.length === 0) {
    return { beach: null, confidence: 0, details: 'No beaches with coordinates found' };
  }
  
  // Find closest beach within tolerance
  let closestBeach: DBBeach | null = null;
  let closestDistance = Infinity;
  
  for (const dbBeach of beaches) {
    const dbLat = dbBeach.latitude;
    const dbLon = dbBeach.longitude;
    
    if (!dbLat || !dbLon) continue;
    
    const distance = calculateDistance(
      jsonBeach.latitude,
      jsonBeach.longitude,
      dbLat,
      dbLon
    );
    
    if (distance < closestDistance && distance <= maxDistanceMeters) {
      closestDistance = distance;
      closestBeach = dbBeach;
    }
  }
  
  if (closestBeach) {
    // Calculate confidence based on distance (closer = higher confidence)
    // Within 100m = 95%+, 500m = 80%+, 1km = 70%+, 2km = 60%+
    let confidence: number;
    if (closestDistance < 100) {
      confidence = 95;
    } else if (closestDistance < 500) {
      confidence = 80 + Math.round((500 - closestDistance) / 500 * 15);
    } else if (closestDistance < 1000) {
      confidence = 70 + Math.round((1000 - closestDistance) / 500 * 10);
    } else {
      confidence = 60 + Math.round((2000 - closestDistance) / 1000 * 10);
    }
    
    return {
      beach: closestBeach,
      confidence: Math.max(60, confidence),
      details: `${Math.round(closestDistance)}m away from "${closestBeach.name}"`,
    };
  }
  
  return {
    beach: null,
    confidence: 0,
    details: `No beaches within ${maxDistanceMeters}m (${(maxDistanceMeters/1000).toFixed(1)}km)`,
  };
}

// Find matching beach (try name first, then coordinates)
async function findMatchingBeach(
  supabase: ReturnType<typeof createSupabaseClient>,
  jsonBeach: JSONBeach
): Promise<{ beach: DBBeach | null; matchType: 'name' | 'coordinates' | 'none'; confidence: number; details: string }> {
  // Try fuzzy name match first (85% threshold)
  const nameMatch = await findBeachByName(supabase, jsonBeach, 85);
  
  if (nameMatch.beach) {
    return {
      beach: nameMatch.beach,
      matchType: 'name',
      confidence: nameMatch.confidence,
      details: nameMatch.details,
    };
  }
  
  // Try coordinate match (2km tolerance)
  const coordMatch = await findBeachByCoordinates(supabase, jsonBeach, 2000);
  
  if (coordMatch.beach) {
    return {
      beach: coordMatch.beach,
      matchType: 'coordinates',
      confidence: coordMatch.confidence,
      details: coordMatch.details,
    };
  }
  
  // No match found
  return {
    beach: null,
    matchType: 'none',
    confidence: 0,
    details: `Name match: ${nameMatch.details}; Coordinate match: ${coordMatch.details}`,
  };
}

// Check if value is null or empty
function isNullOrEmpty(value: any): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

// Build update object (only null/empty fields)
function buildUpdateObject(
  dbBeach: DBBeach,
  jsonBeach: JSONBeach,
  stats: UpdateStats
): Record<string, any> {
  const updateObj: Record<string, any> = {};
  
  // Field mappings (JSON field -> DB field)
  // Note: Database uses 'latitude'/'longitude' (not 'lat'/'lon')
  const fieldMappings: Array<[string, string, (val: any) => any]> = [
    ['location', 'location', (v) => v],
    ['latitude', 'latitude', (v) => v],
    ['longitude', 'longitude', (v) => v],
    ['region', 'region', (v) => v],
    ['country', 'country', (v) => v],
    ['break_type', 'break_type', (v) => v],
    ['hazards', 'hazards', (v) => v],
    ['skill_level', 'skill_level', (v) => v],
    ['shoreline_aspect_deg', 'shoreline_aspect_deg', (v) => v],
    ['swell_window_min_deg', 'swell_window_min_deg', (v) => v],
    ['swell_window_max_deg', 'swell_window_max_deg', (v) => v],
    ['wind_offshore_deg', 'wind_offshore_deg', (v) => v],
    ['wind_offshore_tol_deg', 'wind_offshore_tol_deg', (v) => v],
    ['wind_cross_shore_ok_kt', 'wind_cross_shore_ok_kt', (v) => v],
    ['wind_cross_shore_ok_kt', 'wind_cross_ok_kts', (v) => v],
    ['wind_onshore_bad_kt', 'wind_onshore_bad_kt', (v) => v],
    ['wind_onshore_bad_kt', 'wind_onshore_bad_kts', (v) => v],
    ['preferred_tide_ft_min', 'preferred_tide_ft_min', (v) => v],
    ['preferred_tide_ft_min', 'tide_min_ft', (v) => v],
    ['preferred_tide_ft_max', 'preferred_tide_ft_max', (v) => v],
    ['preferred_tide_ft_max', 'tide_max_ft', (v) => v],
    ['preference_model', 'preference_model', (v) => v],
    ['aspect_deg', 'aspect_deg', (v) => v],
    ['offshore_deg', 'offshore_deg', (v) => v],
    ['swell_window_center_deg', 'swell_window_center_deg', (v) => v],
    ['swell_window_halfwidth_deg', 'swell_window_halfwidth_deg', (v) => v],
  ];
  
  // Check each field
  for (const [jsonField, dbField, transform] of fieldMappings) {
    const jsonValue = (jsonBeach as any)[jsonField];
    const currentValue = dbBeach[dbField];
    
    // Only update if:
    // 1. JSON has a value (not null/undefined)
    // 2. Current DB value is null/empty
    // 3. Haven't already set this DB field in this update
    if (
      jsonValue !== undefined &&
      jsonValue !== null &&
      isNullOrEmpty(currentValue) &&
      !(dbField in updateObj)
    ) {
      updateObj[dbField] = transform(jsonValue);
      stats.fieldsUpdated[dbField] = (stats.fieldsUpdated[dbField] || 0) + 1;
    }
  }
  
  return updateObj;
}

// Process a single beach
async function processBeach(
  supabase: ReturnType<typeof createSupabaseClient>,
  jsonBeach: JSONBeach,
  stats: UpdateStats,
  dryRun: boolean
): Promise<MatchResult> {
  // Find matching beach
  const match = await findMatchingBeach(supabase, jsonBeach);
  
  const result: MatchResult = {
    jsonBeach,
    dbBeach: match.beach,
    matchType: match.matchType,
    matchConfidence: match.confidence,
    matchDetails: match.details,
    fieldsToUpdate: [],
    updatePreview: {},
  };
  
  if (!match.beach) {
    stats.notMatched++;
    return result;
  }
  
  stats.matched++;
  if (match.matchType === 'name') stats.nameMatches++;
  if (match.matchType === 'coordinates') stats.coordinateMatches++;
  
  // Build update object
  const updateObj = buildUpdateObject(match.beach, jsonBeach, stats);
  result.fieldsToUpdate = Object.keys(updateObj);
  result.updatePreview = updateObj;
  
  // Execute update if not dry run
  if (!dryRun && Object.keys(updateObj).length > 0) {
    const { error } = await supabase
      .from('beaches')
      .update(updateObj)
      .eq('id', match.beach.id);
    
    if (error) {
      console.error(`❌ Error updating ${jsonBeach.name}:`, error.message);
      stats.errors++;
    } else {
      stats.updated++;
    }
  } else if (Object.keys(updateObj).length === 0) {
    stats.skipped++;
  }
  
  return result;
}

// Generate detailed report
function generateReport(
  results: MatchResult[],
  stats: UpdateStats,
  dryRun: boolean
): string {
  const report = {
    summary: {
      totalBeaches: stats.total,
      matched: stats.matched,
      notMatched: stats.notMatched,
      nameMatches: stats.nameMatches,
      coordinateMatches: stats.coordinateMatches,
      updated: dryRun ? 'N/A (dry run)' : stats.updated,
      skipped: stats.skipped,
      errors: dryRun ? 'N/A (dry run)' : stats.errors,
      dryRun,
    },
    fieldsUpdated: stats.fieldsUpdated,
    matches: results.filter(r => r.dbBeach !== null).map(r => ({
      jsonBeach: {
        name: r.jsonBeach.name,
        id: r.jsonBeach.id,
        location: r.jsonBeach.location || r.jsonBeach.region,
        coordinates: r.jsonBeach.latitude && r.jsonBeach.longitude
          ? `${r.jsonBeach.latitude}, ${r.jsonBeach.longitude}`
          : 'none',
      },
      dbBeach: {
        id: r.dbBeach!.id,
        name: r.dbBeach!.name,
        location: r.dbBeach!.location || r.dbBeach!.region,
      },
      matchType: r.matchType,
      matchConfidence: r.matchConfidence,
      matchDetails: r.matchDetails,
      fieldsToUpdate: r.fieldsToUpdate,
      updatePreview: r.updatePreview,
    })),
    noMatches: results.filter(r => r.dbBeach === null).map(r => ({
      name: r.jsonBeach.name,
      id: r.jsonBeach.id,
      location: r.jsonBeach.location || r.jsonBeach.region,
      coordinates: r.jsonBeach.latitude && r.jsonBeach.longitude
        ? `${r.jsonBeach.latitude}, ${r.jsonBeach.longitude}`
        : 'none',
      reason: r.matchDetails,
    })),
  };
  
  return JSON.stringify(report, null, 2);
}

// Print console summary
function printSummary(stats: UpdateStats, dryRun: boolean) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Beaches:           ${stats.total}`);
  console.log(`✅ Matched:              ${stats.matched} (${Math.round(stats.matched / stats.total * 100)}%)`);
  console.log(`   - By Name:            ${stats.nameMatches}`);
  console.log(`   - By Coordinates:     ${stats.coordinateMatches}`);
  console.log(`❌ Not Matched:          ${stats.notMatched}`);
  
  if (!dryRun) {
    console.log(`📝 Updated:              ${stats.updated}`);
    console.log(`⏭️  Skipped:              ${stats.skipped} (no empty fields)`);
    console.log(`❌ Errors:               ${stats.errors}`);
  } else {
    console.log(`📝 Would Update:         ${stats.matched - stats.skipped}`);
    console.log(`⏭️  Would Skip:           ${stats.skipped} (no empty fields)`);
  }
  
  console.log('\n📊 Fields That Would Be Updated:');
  const sortedFields = Object.entries(stats.fieldsUpdated)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedFields.length > 0) {
    for (const [field, count] of sortedFields) {
      console.log(`   ${field.padEnd(35)} ${count} beaches`);
    }
  } else {
    console.log('   (none - all fields already populated)');
  }
  
  console.log('\n' + '='.repeat(70));
}

// Main function
async function main() {
  const args = parseArgs(process.argv);
  
  console.log('🏖️  Beach Update Script - Fuzzy Matching Edition');
  console.log('='.repeat(70));
  console.log(`📁 JSON File:            ${path.basename(args.file)}`);
  console.log(`🧪 Mode:                 ${args.dryRun ? 'DRY RUN (preview only)' : 'LIVE UPDATE'}`);
  console.log(`🔍 Name Match:           85%+ similarity required`);
  console.log(`📍 Coordinate Match:     2km (2000m) tolerance`);
  console.log(`📝 Update Strategy:      Only NULL/empty fields`);
  console.log('='.repeat(70));
  
  // Read JSON file
  if (!fs.existsSync(args.file)) {
    throw new Error(`JSON file not found: ${args.file}`);
  }
  
  const jsonContent = fs.readFileSync(args.file, 'utf-8');
  const beaches: JSONBeach[] = JSON.parse(jsonContent);
  
  console.log(`\n📊 Found ${beaches.length} beaches in JSON file\n`);
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  // Initialize stats
  const stats: UpdateStats = {
    total: beaches.length,
    matched: 0,
    notMatched: 0,
    nameMatches: 0,
    coordinateMatches: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    fieldsUpdated: {},
  };
  
  // Process beaches
  const results: MatchResult[] = [];
  
  for (let i = 0; i < beaches.length; i++) {
    const beach = beaches[i];
    const progress = `[${(i + 1).toString().padStart(2)}/${beaches.length}]`;
    
    process.stdout.write(`${progress} Processing: ${beach.name.padEnd(30)} `);
    
    const result = await processBeach(supabase, beach, stats, args.dryRun);
    results.push(result);
    
    if (result.matchType === 'none') {
      console.log(`❌ No match`);
    } else {
      const icon = result.matchType === 'name' ? '📝' : '📍';
      const updates = result.fieldsToUpdate.length;
      console.log(`${icon} Matched (${result.matchConfidence}%) - ${updates} fields to update`);
    }
  }
  
  // Print summary
  printSummary(stats, args.dryRun);
  
  // Generate detailed report
  const reportPath = path.join(
    __dirname,
    '..',
    'docs',
    `beach-update-report-${new Date().toISOString().split('T')[0]}.json`
  );
  
  const reportContent = generateReport(results, stats, args.dryRun);
  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  
  console.log(`\n📄 Detailed report saved: ${path.basename(reportPath)}`);
  
  if (args.dryRun) {
    console.log('\n💡 This was a DRY RUN. No changes were made to the database.');
    console.log('   To execute updates, run without --dry-run flag:');
    console.log(`   npx tsx scripts/update-beaches-from-surf-spots-next20.ts`);
  } else {
    console.log('\n✅ Update complete!');
  }
}

// Run
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
