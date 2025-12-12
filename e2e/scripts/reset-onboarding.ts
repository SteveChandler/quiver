/**
 * Reset Onboarding Script
 *
 * Resets the onboarding state for a test user in the local Supabase database.
 * This includes:
 * - Setting onboarding_completed_at to NULL in the profiles table
 * - Clearing preference data collected during onboarding (optional)
 *
 * Note: This only resets the database state. To fully reset onboarding, you also need to:
 * 1. Clear localStorage in the browser:
 *    - localStorage.removeItem('quiver-onboarding')
 *    - localStorage.removeItem('onboarding_dismissed')
 * 2. Or use the browser console script below:
 *    localStorage.removeItem('quiver-onboarding'); localStorage.removeItem('onboarding_dismissed'); location.reload();
 *
 * Usage:
 *   npx tsx e2e/scripts/reset-onboarding.ts [email]
 *
 * Example:
 *   npx tsx e2e/scripts/reset-onboarding.ts testuser@quiver.surf
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const DEFAULT_TEST_EMAIL = 'testuser@quiver.surf';

async function resetOnboarding() {
  const email = process.argv[2] || DEFAULT_TEST_EMAIL;

  console.log(`🔄 Resetting onboarding for: ${email}\n`);

  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('Required variables:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Find the user by email
    console.log(`📧 Looking up user by email...`);
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const user = users?.users?.find((u) => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.error('\nTip: Create the test user first with:');
      console.error('  npx tsx e2e/scripts/create-test-user.ts');
      process.exit(1);
    }

    console.log(`✅ Found user with ID: ${user.id}`);

    // Step 2: Check current onboarding status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    console.log('\n📊 Current Profile State:');
    console.log(`   Display Name: ${profile.display_name || '(not set)'}`);
    console.log(`   Full Name: ${profile.full_name || '(not set)'}`);
    console.log(`   Home Beach: ${profile.home_beach_id || '(not set)'}`);
    console.log(`   Onboarding Completed: ${profile.onboarding_completed_at || '(not completed)'}`);
    console.log(`   Experience Level: ${profile.experience_level || '(not set)'}`);
    console.log(`   Surf Styles: ${profile.surf_styles?.join(', ') || '(not set)'}`);
    console.log(`   Wave Size Pref: ${profile.preferred_wave_size || '(not set)'}`);
    console.log(`   Break Type Pref: ${profile.preferred_break_type || '(not set)'}`);
    console.log(`   Crowd Pref: ${profile.crowd_preference || '(not set)'}`);

    // Step 3: Reset onboarding state
    console.log('\n🔄 Resetting onboarding state...');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Failed to reset onboarding: ${updateError.message}`);
    }

    console.log('✅ Onboarding state reset in database');

    // Optional: Reset all preference data
    const shouldResetPreferences = process.argv.includes('--reset-preferences');

    if (shouldResetPreferences) {
      console.log('\n🔄 Resetting all preference data...');

      const { error: prefError } = await supabase
        .from('profiles')
        .update({
          experience_level: null,
          surf_styles: [],
          preferred_wave_size: null,
          preferred_break_type: null,
          crowd_preference: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (prefError) {
        throw new Error(`Failed to reset preferences: ${prefError.message}`);
      }

      console.log('✅ All preferences reset');
    }

    // Summary
    console.log('\n✅ Onboarding reset completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('\n1. Clear browser localStorage (choose one method):');
    console.log('   a) Open browser DevTools > Application > Local Storage > Clear');
    console.log('   b) Run in browser console:');
    console.log('      localStorage.removeItem("quiver-onboarding");');
    console.log('      localStorage.removeItem("onboarding_dismissed");');
    console.log('      location.reload();');
    console.log('   c) Use incognito/private browsing mode');
    console.log('\n2. Navigate to the app:');
    console.log('   http://localhost:3000');
    console.log('\n3. The onboarding flow should appear automatically');
    console.log('   (or add ?showOnboarding=1 to force it to appear)');

  } catch (error) {
    console.error('\n❌ Failed to reset onboarding');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
resetOnboarding().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
