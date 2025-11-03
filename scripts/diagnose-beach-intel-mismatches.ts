#!/usr/bin/env tsx

/**
 * Diagnostic script to identify beach/intel post mismatches
 *
 * This script queries the production database to find intel posts where
 * the title mentions a different beach than the one they're associated with.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load production environment variables ONLY (don't load .env)
const result = dotenv.config({ path: '.env.production.local', override: true });

if (result.error) {
  console.error('❌ Failed to load .env.production.local:', result.error);
  process.exit(1);
}

console.log('✅ Loaded .env.production.local');

// Always use production URL (hardcoded to avoid env variable issues)
const SUPABASE_URL = 'https://vawdnbbgawichorsjiwe.supabase.co';

// Production service role key (from .env.production.local)
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY2ODQ0NCwiZXhwIjoyMDYyMjQ0NDQ0fQ.4rctfUxZrDgoc2Zu2Lzx1dxKKBwSRkYOxwc0wfGlPtM';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  console.error('Make sure .env.production.local exists and contains SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nLoaded from .env.production.local:');
  console.error(`  SUPABASE_SERVICE_ROLE_KEY exists: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  console.error(`  NEXT_PUBLIC_SUPABASE_ANON_KEY exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
  process.exit(1);
}

console.log(`📡 Connecting to: ${SUPABASE_URL}`);
console.log(`🔑 Using service role key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findMismatchedIntelPosts() {
  console.log('🔍 Querying intel posts for beach name mismatches...\n');

  // Get ALL intel posts with their associated beach names (fetch in batches to avoid limits)
  let allIntelPosts: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;
  let totalCount = 0;

  console.log('Fetching intel posts in batches...');

  while (hasMore) {
    const { data, error, count } = await supabase
      .from('intel_posts')
      .select(`
        id,
        title,
        description,
        beach_id,
        created_at,
        beaches!inner (
          id,
          name,
          city,
          state
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching intel posts:', error);
      return;
    }

    if (count !== null && totalCount === 0) {
      totalCount = count;
    }

    allIntelPosts = [...allIntelPosts, ...(data || [])];
    console.log(`  Fetched batch: ${from}-${from + (data?.length || 0)} (${allIntelPosts.length}/${totalCount} total)`);

    hasMore = (data?.length || 0) === batchSize;
    from += batchSize;
  }

  const intelPosts = allIntelPosts;
  const count = totalCount;

  console.log(`\n✅ Fetched ${intelPosts.length} intel posts (Total in DB: ${count})\n`);

  // Build a list of all beach names for cross-referencing
  const { data: allBeaches } = await supabase.from('beaches').select('id, name');
  const beachNames = new Set(allBeaches?.map(b => b.name.toLowerCase()) || []);

  // Find cross-beach mentions (intel mentioning a different beach)
  const crossBeachMismatches: any[] = [];
  const genericMismatches: any[] = [];

  for (const post of intelPosts) {
    const beach = post.beaches as any;
    const beachName = beach.name.toLowerCase();
    const titleLower = post.title.toLowerCase();
    const descLower = (post.description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    // Check if the intel mentions the associated beach
    const mentionsAssociatedBeach = combined.includes(beachName);

    // Check if it mentions "beach"
    const mentionsBeach = titleLower.includes('beach');

    if (mentionsBeach && !mentionsAssociatedBeach) {
      // Check if it mentions a DIFFERENT beach from our database
      let mentionsDifferentBeach = false;
      let mentionedBeach = '';

      for (const otherBeachName of beachNames) {
        if (otherBeachName !== beachName && combined.includes(otherBeachName)) {
          mentionsDifferentBeach = true;
          mentionedBeach = otherBeachName;
          break;
        }
      }

      const mismatchData = {
        id: post.id,
        title: post.title,
        description: post.description?.substring(0, 100),
        associatedBeach: beach.name,
        associatedCity: beach.city,
        beachId: post.beach_id,
        createdAt: post.created_at,
        mentionedBeach: mentionedBeach || 'none'
      };

      if (mentionsDifferentBeach) {
        crossBeachMismatches.push(mismatchData);
      } else {
        genericMismatches.push(mismatchData);
      }
    }
  }

  const mismatches = [...crossBeachMismatches, ...genericMismatches];

  console.log(`\n📊 RESULTS:\n`);
  console.log(`Total intel posts checked: ${intelPosts.length}`);
  console.log(`Cross-beach mismatches (mentions different beach): ${crossBeachMismatches.length}`);
  console.log(`Generic mismatches (doesn't mention beach name): ${genericMismatches.length}\n`);

  if (crossBeachMismatches.length > 0) {
    console.log('🚨 CRITICAL: CROSS-BEACH MISMATCHES (mentions a different beach):\n');
    console.log('═'.repeat(120));

    crossBeachMismatches.forEach((mismatch, index) => {
      console.log(`\n${index + 1}. Intel Post ID: ${mismatch.id}`);
      console.log(`   Title: "${mismatch.title}"`);
      console.log(`   Description: "${mismatch.description}..."`);
      console.log(`   🔴 Mentioned Beach: ${mismatch.mentionedBeach}`);
      console.log(`   ✅ Associated Beach: ${mismatch.associatedBeach} (${mismatch.associatedCity})`);
      console.log(`   Beach ID: ${mismatch.beachId}`);
      console.log(`   Created: ${new Date(mismatch.createdAt).toLocaleString()}`);
      console.log('   ' + '─'.repeat(118));
    });

    console.log('\n═'.repeat(120));
  } else {
    console.log('✅ No cross-beach mismatches found!');
  }

  if (genericMismatches.length > 0) {
    console.log(`\n\nℹ️  Generic Mismatches (first 10 of ${genericMismatches.length}):\n`);
    console.log('These are generic posts like "Easy Beach Access" that don\'t mention the specific beach name.');
    console.log('Not critical, but could be improved.');

    genericMismatches.slice(0, 10).forEach((mismatch, index) => {
      console.log(`\n${index + 1}. "${mismatch.title}" → ${mismatch.associatedBeach}`);
    });
  }
}

async function checkBeachDataIntegrity() {
  console.log('\n\n🔍 Checking beach data integrity...\n');

  // Check for duplicate beach names
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('id, name, city, state, lat, lon')
    .order('name');

  if (error) {
    console.error('❌ Error fetching beaches:', error);
    return;
  }

  console.log(`✅ Fetched ${beaches.length} beaches\n`);

  // Find duplicates
  const nameMap = new Map<string, any[]>();

  for (const beach of beaches) {
    const key = beach.name.toLowerCase();
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(beach);
  }

  const duplicates = Array.from(nameMap.entries()).filter(([_, beaches]) => beaches.length > 1);

  if (duplicates.length > 0) {
    console.log('⚠️  DUPLICATE BEACH NAMES FOUND:\n');
    console.log('═'.repeat(120));

    duplicates.forEach(([name, beachList]) => {
      console.log(`\n"${name}" appears ${beachList.length} times:`);
      beachList.forEach((beach, index) => {
        console.log(`   ${index + 1}. ID: ${beach.id} | City: ${beach.city}, ${beach.state} | Lat/Lon: ${beach.lat}, ${beach.lon}`);
      });
    });

    console.log('\n═'.repeat(120));
  } else {
    console.log('✅ No duplicate beach names found!');
  }

  // Check for beaches with suspicious coordinates
  console.log('\n\n🔍 Checking for geographic inconsistencies...\n');

  // Check Hapuna Beach (should be in Hawaii, ~19.9°N, -155.8°W)
  const hapunaBeaches = beaches.filter(b => b.name.toLowerCase().includes('hapuna'));

  if (hapunaBeaches.length > 0) {
    console.log('Hapuna Beach records found:');
    hapunaBeaches.forEach(beach => {
      const isInHawaii = beach.lat > 18 && beach.lat < 23 && beach.lon < -154 && beach.lon > -161;
      const status = isInHawaii ? '✅' : '❌';
      console.log(`${status} ID: ${beach.id} | ${beach.name} | ${beach.city}, ${beach.state} | Lat: ${beach.lat}, Lon: ${beach.lon}`);

      if (!isInHawaii) {
        console.log(`   ⚠️  WARNING: Coordinates don't match Hawaii location!`);
      }
    });
  }

  // Check Oceanside beaches (should be in California, ~33.2°N, -117.4°W)
  const oceansideBeaches = beaches.filter(b => b.name.toLowerCase().includes('oceanside'));

  if (oceansideBeaches.length > 0) {
    console.log('\nOceanside Beach records found:');
    oceansideBeaches.forEach(beach => {
      const isInSoCal = beach.lat > 32 && beach.lat < 34 && beach.lon < -116 && beach.lon > -118;
      const status = isInSoCal ? '✅' : '❌';
      console.log(`${status} ID: ${beach.id} | ${beach.name} | ${beach.city}, ${beach.state} | Lat: ${beach.lat}, Lon: ${beach.lon}`);

      if (!isInSoCal) {
        console.log(`   ⚠️  WARNING: Coordinates don't match Southern California location!`);
      }
    });
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Beach/Intel Mismatch Diagnostic Tool                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    await findMismatchedIntelPosts();
    await checkBeachDataIntegrity();

    console.log('\n\n✅ Diagnostic complete!\n');
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

main();
