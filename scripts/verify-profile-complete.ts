#!/usr/bin/env node
/**
 * Verify Complete Profile State
 *
 * This script verifies the complete state of the test user's profile
 * to understand why Best Conditions might not be showing.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testUserEmail = process.env.TEST_USER_EMAIL || 'stcha0004@gmail.com';

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
  console.log('🔍 Complete Profile Verification');
  console.log(`📧 Test user email: ${testUserEmail}\n`);

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', testUserEmail)
    .single();

  if (profileError) {
    console.error('❌ Error fetching profile:', profileError);
    process.exit(1);
  }

  console.log('👤 Profile Data:');
  console.log(JSON.stringify(profile, null, 2));

  if (profile.home_beach_id) {
    console.log(`\n🏖️ Fetching home beach details (ID: ${profile.home_beach_id})...`);

    const { data: beach, error: beachError } = await supabase
      .from('beaches')
      .select('id, name, lat, lon, geog')
      .eq('id', profile.home_beach_id)
      .single();

    if (beachError) {
      console.error('❌ Error fetching beach:', beachError);
    } else if (beach) {
      console.log('✅ Home Beach Found:');
      console.log(`   Name: ${beach.name}`);
      console.log(`   Latitude: ${beach.lat}`);
      console.log(`   Longitude: ${beach.lon}`);
      console.log(`   Has Geography: ${beach.geog ? 'Yes' : 'No'}`);

      // Verify coordinates are valid
      if (beach.lat && beach.lon) {
        console.log('\n✅ HOME BEACH HAS VALID COORDINATES');
        console.log('   Best Conditions should be able to query based on this location.');
        console.log('\n📋 Summary for debugging:');
        console.log(`   - User ID: ${profile.id}`);
        console.log(`   - Email: ${profile.email}`);
        console.log(`   - Display Name: ${profile.display_name || '(not set)'}`);
        console.log(`   - Home Beach: ${beach.name}`);
        console.log(`   - Coordinates: ${beach.lat}, ${beach.lon}`);
        console.log('\n🔎 If Best Conditions is NOT showing, check:');
        console.log('   1. Frontend code: Does it check for home_beach_id?');
        console.log('   2. API endpoint: Is it receiving the user context?');
        console.log('   3. Best Conditions query: Is it using the correct coordinates?');
        console.log('   4. RLS policies: Can the user read best conditions data?');
        console.log('   5. Browser console: Any JavaScript errors?');
      } else {
        console.log('\n⚠️ HOME BEACH MISSING COORDINATES');
        console.log('   This is the problem! Need to update beach coordinates.');
      }
    } else {
      console.log('⚠️ Home beach ID is set but beach not found!');
    }
  } else {
    console.log('\n⚠️ No home_beach_id set in profile');
    console.log('   Best Conditions section will not appear.');
  }
}

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
