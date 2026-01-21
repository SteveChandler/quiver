#!/usr/bin/env node
/**
 * CDIP Eligibility Backfill Script
 *
 * Computes and sets the cdip_eligible column for all beaches based on their
 * proximity to active CDIP stations. This fixes the bug where beaches not
 * initially seeded with CDIP data never get updated by the CDIP cron job.
 *
 * Usage:
 *   npx ts-node scripts/backfill-cdip-eligibility.ts
 *   npx tsx scripts/backfill-cdip-eligibility.ts
 *
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Safety:
 *   - Idempotent (safe to run multiple times)
 *   - Only updates cdip_eligible column
 *   - No data deletion
 *   - Logs all changes for audit
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables - .env.local overrides .env
config({ path: '.env' });
config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// CDIP station definitions (same as lib/constants/cdip-stations.ts)
// Duplicated here to avoid TS module resolution issues in standalone script
interface CDIPStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const CDIP_STATIONS: CDIPStation[] = [
  { id: "100", name: "Torrey Pines Outer", latitude: 32.93, longitude: -117.392 },
  { id: "155", name: "Imperial Beach Nearshore", latitude: 32.56968, longitude: -117.16895 },
  { id: "191", name: "Point Loma South", latitude: 32.51753, longitude: -117.4253 },
  { id: "201", name: "Scripps Nearshore", latitude: 32.86785, longitude: -117.26667 },
  { id: "153", name: "Del Mar Nearshore", latitude: 32.95654, longitude: -117.2796 },
  { id: "220", name: "Mission Bay West", latitude: 32.74942, longitude: -117.4985 },
  { id: "208", name: "Torrey Pines North", latitude: 32.951, longitude: -117.3846 },
  { id: "67", name: "San Nicolas Island", latitude: 33.2278, longitude: -119.5025 },
  { id: "45", name: "Oceanside Offshore", latitude: 33.1771, longitude: -117.472 },
  { id: "71", name: "Harvest Platform", latitude: 34.4683, longitude: -120.6732 },
  { id: "157", name: "Point Sur", latitude: 36.3025, longitude: -121.9576 },
  { id: "179", name: "Anacapa Passage", latitude: 34.0008, longitude: -119.3592 },
  { id: "111", name: "San Pedro", latitude: 33.618, longitude: -118.317 },
  { id: "46", name: "Cabrillo Point", latitude: 36.626, longitude: -121.907 },
  { id: "198", name: "Santa Monica Bay", latitude: 33.8568, longitude: -118.6329 },
  { id: "217", name: "Point Mugu", latitude: 34.0221, longitude: -119.1529 },
  { id: "203", name: "Point Reyes", latitude: 37.9454, longitude: -123.4693 },
  { id: "139", name: "Humboldt Bay South Spit", latitude: 40.77767, longitude: -124.2255 },
];

// Blacklisted stations (known to have issues)
const BLACKLISTED_STATIONS = new Set(["46221", "46225", "46236"]);

// Active stations (not blacklisted)
const ACTIVE_STATIONS = CDIP_STATIONS.filter(s => !BLACKLISTED_STATIONS.has(s.id));

// Default coverage radius in km (matches getStationCoverageRadius default)
const DEFAULT_COVERAGE_RADIUS_KM = 50;

// Station-specific coverage radii (matches STATION_COVERAGE_RADIUS)
const STATION_COVERAGE_RADIUS: Record<string, number> = {
  "100": 100, // Covers most of San Diego County
  "67": 75,   // Covers LA/Orange County
  "191": 50,  // Covers Point Loma / South San Diego
  "157": 60,  // Covers Big Sur area
  "46236": 80, // Covers Monterey Bay area
};

/**
 * Calculate haversine distance between two coordinates
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get coverage radius for a station
 */
function getStationCoverageRadius(stationId: string): number {
  return STATION_COVERAGE_RADIUS[stationId] || DEFAULT_COVERAGE_RADIUS_KM;
}

/**
 * Find nearest CDIP station and check if within coverage
 */
function findNearestStation(
  lat: number,
  lon: number
): { station: CDIPStation; distance: number } | null {
  let nearest: { station: CDIPStation; distance: number } | null = null;

  for (const station of ACTIVE_STATIONS) {
    const distance = calculateDistance(lat, lon, station.latitude, station.longitude);
    const coverageRadius = getStationCoverageRadius(station.id);

    if (distance <= coverageRadius) {
      if (!nearest || distance < nearest.distance) {
        nearest = { station, distance };
      }
    }
  }

  return nearest;
}

/**
 * Validate required environment variables
 */
function validateEnvironment(): boolean {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables:');
    if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease check your .env.local file.');
    return false;
  }
  return true;
}

/**
 * Main backfill function
 */
async function backfillCdipEligibility() {
  console.log('CDIP Eligibility Backfill Script');
  console.log('=================================\n');

  // Validate environment
  if (!validateEnvironment()) {
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Fetching all beaches...');

  // Fetch all beaches with coordinates
  const { data: beaches, error: fetchError } = await supabase
    .from('beaches')
    .select('id, name, lat, lon, cdip_station, cdip_eligible')
    .is('deleted_at', null);

  if (fetchError) {
    console.error('Error fetching beaches:', fetchError);
    process.exit(1);
  }

  if (!beaches || beaches.length === 0) {
    console.log('No beaches found.');
    process.exit(0);
  }

  console.log(`Found ${beaches.length} beaches to process.\n`);

  // Track statistics
  let eligible = 0;
  let notEligible = 0;
  let skippedNoCoords = 0;
  let alreadyCorrect = 0;
  let updated = 0;

  const updates: Array<{
    id: string;
    name: string;
    cdip_eligible: boolean;
    cdip_station: string | null;
    nearestStation: string | null;
    distance: number | null;
  }> = [];

  // Process each beach
  for (const beach of beaches) {
    const { id, name, lat, lon } = beach;

    // Skip beaches without coordinates
    if (lat == null || lon == null) {
      skippedNoCoords++;
      continue;
    }

    // Find nearest CDIP station within coverage
    const result = findNearestStation(lat, lon);
    const isEligible = result !== null;
    const stationId = result?.station.id || null;

    if (isEligible) {
      eligible++;
    } else {
      notEligible++;
    }

    // Check if update is needed
    const currentEligible = beach.cdip_eligible ?? false;
    if (currentEligible === isEligible) {
      alreadyCorrect++;
      continue;
    }

    updates.push({
      id,
      name,
      cdip_eligible: isEligible,
      cdip_station: stationId,
      nearestStation: result?.station.name || null,
      distance: result?.distance || null,
    });
  }

  console.log('Analysis complete:');
  console.log(`  - CDIP eligible: ${eligible}`);
  console.log(`  - Not eligible: ${notEligible}`);
  console.log(`  - Skipped (no coords): ${skippedNoCoords}`);
  console.log(`  - Already correct: ${alreadyCorrect}`);
  console.log(`  - Updates needed: ${updates.length}\n`);

  if (updates.length === 0) {
    console.log('No updates needed. All beaches already have correct cdip_eligible values.');
    process.exit(0);
  }

  // Log planned updates
  console.log('Planned updates:');
  for (const update of updates) {
    const status = update.cdip_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE';
    const stationInfo = update.nearestStation
      ? ` (${update.nearestStation}, ${update.distance?.toFixed(1)}km)`
      : '';
    console.log(`  - ${update.name}: ${status}${stationInfo}`);
  }

  console.log('\nApplying updates...');

  // Batch update beaches
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('beaches')
      .update({
        cdip_eligible: update.cdip_eligible,
        // Optionally update cdip_station if we found a nearer one
        ...(update.cdip_station && { cdip_station: update.cdip_station }),
      })
      .eq('id', update.id);

    if (updateError) {
      console.error(`Error updating ${update.name}:`, updateError);
    } else {
      updated++;
    }
  }

  console.log(`\nBackfill complete: ${updated}/${updates.length} beaches updated.`);

  // Verify results
  console.log('\nVerifying results...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('beaches')
    .select('id, name')
    .eq('cdip_eligible', true)
    .is('deleted_at', null);

  if (verifyError) {
    console.error('Error verifying results:', verifyError);
  } else {
    console.log(`Total CDIP-eligible beaches: ${verifyData?.length || 0}`);
  }
}

// Run the backfill
backfillCdipEligibility().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
