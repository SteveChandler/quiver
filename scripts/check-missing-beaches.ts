#!/usr/bin/env node

/**
 * Check for missing beaches and find similar names
 * 
 * This script checks which beaches from the JSON exist in the database
 * using fuzzy matching to catch name variations.
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

// The 15 missing beaches from the JSON
const missingBeaches = [
  { id: 16, name: "Tijuana Sloughs", lat: 32.5517, lon: -117.1271 },
  { id: 17, name: "Silver Strand State Beach", lat: 32.6466, lon: -117.1479 },
  { id: 18, name: "Coronado North Jetty (Coronado Beaches)", lat: 32.6785, lon: -117.1720 },
  { id: 19, name: "Hotel Del/Shipwreck (Coronado)", lat: 32.6809, lon: -117.1784 },
  { id: 20, name: "Sunset Cliffs – Garbage (North & South)", lat: 32.7195, lon: -117.2574 },
  { id: 21, name: "Osprey Point (Sunset Cliffs)", lat: 32.7362, lon: -117.2561 },
  { id: 22, name: "New Break (Nubes, Sunset Cliffs)", lat: 32.7195, lon: -117.2574 },
  { id: 23, name: "Avalanche Jetty (Ocean Beach)", lat: 32.7542, lon: -117.2539 },
  { id: 24, name: "Big Jetty (South Mission Jetty)", lat: 32.7447, lon: -117.2518 },
  { id: 25, name: "Ocean Beach Pier (OB Pier)", lat: 32.7500, lon: -117.2525 },
  { id: 26, name: "Mission Beach (main beach)", lat: 32.7681, lon: -117.2520 },
  { id: 27, name: "Pacific Beach/Crystal Pier", lat: 32.7950, lon: -117.2570 },
  { id: 28, name: "Tourmaline Surf Park", lat: 32.8074, lon: -117.2598 },
  { id: 29, name: "Windansea Beach", lat: 32.8376, lon: -117.2809 },
  { id: 30, name: "Marine Street Beach", lat: 32.8418, lon: -117.2793 },
];

// Simple string similarity (Levenshtein distance)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// Check if beach exists by exact match
async function findExactMatch(supabase: ReturnType<typeof createSupabaseClient>, name: string) {
  const { data, error } = await supabase
    .from('beaches')
    .select('id, name, latitude, longitude')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  
  return data;
}

// Find similar beaches
async function findSimilarBeaches(
  supabase: ReturnType<typeof createSupabaseClient>,
  targetName: string,
  lat: number,
  lon: number
) {
  // Get all beaches
  const { data: allBeaches } = await supabase
    .from('beaches')
    .select('id, name, latitude, longitude');
  
  if (!allBeaches) return [];
  
  // Calculate similarity scores
  const scored = allBeaches.map(beach => {
    const nameSim = similarity(targetName, beach.name || '');
    
    // Calculate distance if coordinates exist
    let distanceMiles = Infinity;
    if (beach.latitude && beach.longitude) {
      const R = 3959; // Earth radius in miles
      const dLat = (beach.latitude - lat) * Math.PI / 180;
      const dLon = (beach.longitude - lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat * Math.PI / 180) * Math.cos(beach.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distanceMiles = R * c;
    }
    
    return {
      ...beach,
      nameSimilarity: nameSim,
      distanceMiles,
      score: nameSim * 0.7 + (distanceMiles < 1 ? 0.3 : 0), // Weighted score
    };
  });
  
  // Return top 3 matches with >50% name similarity
  return scored
    .filter(b => b.nameSimilarity > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function main() {
  console.log('🔍 Checking for Missing Beaches\n');
  console.log('=' .repeat(80));
  
  const supabase = createSupabaseClient();
  
  const results = {
    exactMatches: [] as any[],
    similarMatches: [] as any[],
    notFound: [] as any[],
  };
  
  for (const beach of missingBeaches) {
    console.log(`\n📍 ${beach.name} (ID ${beach.id})`);
    
    // Check exact match
    const exact = await findExactMatch(supabase, beach.name);
    if (exact) {
      console.log(`   ✅ EXACT MATCH FOUND: ${exact.name} (${exact.id})`);
      results.exactMatches.push({ json: beach, db: exact });
      continue;
    }
    
    // Check similar names
    const similar = await findSimilarBeaches(supabase, beach.name, beach.lat, beach.lon);
    if (similar.length > 0) {
      console.log(`   🔎 Similar beaches found:`);
      similar.forEach(s => {
        console.log(`      - ${s.name}`);
        console.log(`        UUID: ${s.id}`);
        console.log(`        Name similarity: ${(s.nameSimilarity * 100).toFixed(1)}%`);
        console.log(`        Distance: ${s.distanceMiles.toFixed(2)} miles`);
      });
      results.similarMatches.push({ json: beach, similar });
    } else {
      console.log(`   ❌ No similar beaches found - needs to be created`);
      results.notFound.push(beach);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY\n');
  
  if (results.exactMatches.length > 0) {
    console.log(`✅ Exact Matches Found: ${results.exactMatches.length}`);
    results.exactMatches.forEach(m => {
      console.log(`   - "${m.json.name}" → ${m.db.id}`);
    });
    console.log('\n   💡 These can be updated by mapping integer ID → UUID in the JSON');
  }
  
  if (results.similarMatches.length > 0) {
    console.log(`\n🔎 Similar Matches Found: ${results.similarMatches.length}`);
    results.similarMatches.forEach(m => {
      console.log(`   - "${m.json.name}"`);
      console.log(`     Best match: "${m.similar[0].name}" (${(m.similar[0].nameSimilarity * 100).toFixed(1)}% similar)`);
      console.log(`     UUID: ${m.similar[0].id}`);
    });
    console.log('\n   💡 Review these matches - may need name corrections in JSON or database');
  }
  
  if (results.notFound.length > 0) {
    console.log(`\n❌ Not Found (need to create): ${results.notFound.length}`);
    results.notFound.forEach(m => {
      console.log(`   - ${m.name}`);
    });
    console.log('\n   💡 These beaches need to be added to the database');
  }
  
  // Save results to JSON
  const outputPath = path.join(__dirname, '..', 'docs', 'missing-beaches-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${outputPath}`);
  
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
