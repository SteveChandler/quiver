#!/usr/bin/env node
/**
 * Verify Home Beach for Test User
 *
 * This script verifies the test user's home beach and checks if it has valid coordinates.
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
  console.log('🔍 Verifying home beach for test user...');
  console.log(`📧 Test user email: ${testUserEmail}\n`);

  // Get user profile with home beach details
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id,
      display_name,
      email,
      home_beach_id,
      home_beach:beaches!profiles_home_beach_id_fkey (
        id,
        name,
        latitude,
        longitude,
        coordinates
      )
    `)
    .eq('email', testUserEmail)
    .single();

  if (error) {
    console.error('❌ Error fetching profile:', error);
    process.exit(1);
  }

  console.log('📊 Profile Information:');
  console.log('  User ID:', profile.id);
  console.log('  Display Name:', profile.display_name || '(not set)');
  console.log('  Email:', profile.email);
  console.log('  Home Beach ID:', profile.home_beach_id || '(not set)');

  if (profile.home_beach) {
    const beach = profile.home_beach as any;
    console.log('\n🏖️ Home Beach Details:');
    console.log('  Name:', beach.name);
    console.log('  Latitude:', beach.latitude);
    console.log('  Longitude:', beach.longitude);
    console.log('  Has Coordinates:', beach.coordinates ? 'Yes' : 'No');

    if (beach.latitude && beach.longitude) {
      console.log('\n✅ Home beach has valid coordinates!');
      console.log('   The Best Conditions section should be working.');
      console.log('   If it\'s not showing, check:');
      console.log('   1. Client-side logic for displaying Best Conditions');
      console.log('   2. API endpoint for fetching best conditions');
      console.log('   3. Browser console for any errors');
    } else {
      console.log('\n⚠️ Home beach is missing coordinates!');
      console.log('   This could be why Best Conditions is not showing.');
    }
  } else if (profile.home_beach_id) {
    console.log('\n⚠️ Home beach ID is set but beach not found in join!');
    console.log('   This could indicate a data integrity issue.');
  } else {
    console.log('\n⚠️ No home beach is set.');
    console.log('   Best Conditions section will not appear.');
  }
}

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
