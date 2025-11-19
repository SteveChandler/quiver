#!/usr/bin/env node
/**
 * Set Home Beach for Test User Script
 *
 * This script updates the home_beach_id for the test user (stcha0004@gmail.com)
 * so that the Best Conditions section appears on the home page.
 *
 * REQUIREMENTS:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 * - NEXT_PUBLIC_SUPABASE_URL environment variable must be set
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testUserEmail = process.env.TEST_USER_EMAIL || 'stcha0004@gmail.com';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🏄 Setting home beach for test user...');
  console.log(`📧 Test user email: ${testUserEmail}`);

  // Step 1: Find the test user
  console.log('\n📍 Step 1: Finding test user profile...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, email, home_beach_id')
    .eq('email', testUserEmail);

  if (profileError) {
    console.error('❌ Error finding user:', profileError);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.error('❌ Test user not found with email:', testUserEmail);
    process.exit(1);
  }

  const profile = profiles[0];
  console.log('✅ Found user:', {
    id: profile.id,
    display_name: profile.display_name || '(no display name)',
    email: profile.email,
    home_beach_id: profile.home_beach_id || '(null)',
  });

  // Step 2: Find Pacific Beach
  console.log('\n📍 Step 2: Finding Pacific Beach...');
  const { data: beaches, error: beachError } = await supabase
    .from('beaches')
    .select('id, name, center_lat, center_lng')
    .ilike('name', '%Pacific Beach%')
    .not('center_lat', 'is', null)
    .not('center_lng', 'is', null)
    .limit(5);

  if (beachError) {
    console.error('❌ Error finding beaches:', beachError);
    process.exit(1);
  }

  if (!beaches || beaches.length === 0) {
    console.error('❌ No beaches found matching "Pacific Beach" with valid coordinates');
    console.log('\n🔍 Searching for any beaches to use...');

    const { data: anyBeaches, error: anyBeachError } = await supabase
      .from('beaches')
      .select('id, name, center_lat, center_lng')
      .not('center_lat', 'is', null)
      .not('center_lng', 'is', null)
      .limit(10);

    if (anyBeachError || !anyBeaches || anyBeaches.length === 0) {
      console.error('❌ No beaches found with valid coordinates');
      process.exit(1);
    }

    console.log('Available beaches:');
    anyBeaches.forEach((beach, index) => {
      console.log(`  ${index + 1}. ${beach.name} (${beach.center_lat}, ${beach.center_lng})`);
    });

    process.exit(1);
  }

  console.log(`✅ Found ${beaches.length} matching beach(es):`);
  beaches.forEach((beach, index) => {
    console.log(`  ${index + 1}. ${beach.name} (${beach.center_lat}, ${beach.center_lng})`);
  });

  const selectedBeach = beaches[0];
  console.log(`\n🎯 Using: ${selectedBeach.name}`);

  // Step 3: Update the profile
  console.log('\n📍 Step 3: Updating profile...');
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ home_beach_id: selectedBeach.id })
    .eq('id', profile.id);

  if (updateError) {
    console.error('❌ Error updating profile:', updateError);
    process.exit(1);
  }

  console.log('✅ Successfully updated profile!');

  // Step 4: Verify the update
  console.log('\n📍 Step 4: Verifying update...');
  const { data: updatedProfile, error: verifyError } = await supabase
    .from('profiles')
    .select(`
      id,
      display_name,
      email,
      home_beach_id,
      home_beach:beaches!profiles_home_beach_id_fkey (
        id,
        name,
        center_lat,
        center_lng
      )
    `)
    .eq('id', profile.id)
    .single();

  if (verifyError) {
    console.error('❌ Error verifying update:', verifyError);
    process.exit(1);
  }

  console.log('✅ Verification successful!');
  console.log('\n📊 Final Profile State:');
  console.log('  User ID:', updatedProfile.id);
  console.log('  Display Name:', updatedProfile.display_name || '(no display name)');
  console.log('  Email:', updatedProfile.email);
  console.log('  Home Beach ID:', updatedProfile.home_beach_id);
  if (updatedProfile.home_beach) {
    console.log('  Home Beach Name:', (updatedProfile.home_beach as any).name);
    console.log('  Home Beach Coordinates:', `${(updatedProfile.home_beach as any).center_lat}, ${(updatedProfile.home_beach as any).center_lng}`);
  }

  console.log('\n🎉 Done! The Best Conditions section should now appear on the home page.');
}

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
