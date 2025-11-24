#!/usr/bin/env node
/**
 * Check Beach Schema
 *
 * This script checks what columns exist in the beaches table.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🔍 Checking beach table schema...\n');

  // Query for any beach to see what columns are returned
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error fetching beaches:', error);
    process.exit(1);
  }

  if (!beaches || beaches.length === 0) {
    console.log('⚠️ No beaches found in database');
    return;
  }

  console.log('✅ Beach table columns:');
  const beach = beaches[0];
  Object.keys(beach).sort().forEach((key) => {
    const value = beach[key];
    const type = typeof value;
    const preview = value === null ? 'null' :
                   type === 'string' ? `"${value.substring(0, 50)}"` :
                   type === 'number' ? value :
                   type === 'object' ? JSON.stringify(value).substring(0, 50) :
                   String(value);
    console.log(`  - ${key}: ${type} = ${preview}`);
  });

  // Also fetch a specific beach by ID to check
  const testHomeBeachId = '65809772-20bc-4009-b9b2-89c8ef3c4127';
  console.log(`\n🔍 Checking specific beach (${testHomeBeachId})...`);

  const { data: specificBeach, error: specificError } = await supabase
    .from('beaches')
    .select('*')
    .eq('id', testHomeBeachId)
    .single();

  if (specificError) {
    console.error('❌ Error fetching specific beach:', specificError);
  } else if (specificBeach) {
    console.log('✅ Found beach:', specificBeach.name);
    console.log('   Coordinate fields:');
    ['lat', 'lon', 'lng', 'latitude', 'longitude', 'center_lat', 'center_lng', 'coordinates'].forEach(field => {
      if (field in specificBeach) {
        console.log(`   - ${field}: ${specificBeach[field]}`);
      }
    });
  }
}

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
