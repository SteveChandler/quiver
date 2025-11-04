/**
 * Create Test User Script
 *
 * Creates a test user account directly in the local Supabase database
 * using the admin API. This is used for E2E test setup.
 *
 * Usage:
 *   npx tsx e2e/scripts/create-test-user.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const TEST_USER = {
  email: 'testuser@quiver.surf',
  password: 'testpassword123',
  name: 'Test User',
  displayName: 'testuser',
};

async function createTestUser() {
  console.log('🔧 Creating test user for E2E tests...\n');

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
    // Step 1: Check if user already exists
    console.log(`📧 Checking for existing user: ${TEST_USER.email}`);
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingUser = existingUsers?.users?.find(
      (u) => u.email === TEST_USER.email
    );

    if (existingUser) {
      console.log(`✅ User already exists with ID: ${existingUser.id}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Created: ${existingUser.created_at}`);

      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingUser.id)
        .single();

      if (profileError || !profile) {
        console.log('⚠️  Profile missing, creating...');
        await createProfile(supabase, existingUser.id);
      } else {
        console.log(`✅ Profile exists`);
        console.log(`   Display Name: ${profile.display_name || '(not set)'}`);
        console.log(`   Name: ${profile.full_name || '(not set)'}`);
      }

      console.log('\n✅ Test user ready for use!');
      console.log('\nCredentials:');
      console.log(`  Email: ${TEST_USER.email}`);
      console.log(`  Password: ${TEST_USER.password}`);
      return;
    }

    // Step 2: Create new user with admin API
    console.log(`🆕 Creating new user: ${TEST_USER.email}`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true, // Auto-confirm email for testing
      user_metadata: {
        full_name: TEST_USER.name,
      },
    });

    if (createError || !newUser.user) {
      throw new Error(`Failed to create user: ${createError?.message}`);
    }

    console.log(`✅ User created with ID: ${newUser.user.id}`);

    // Step 3: Create profile (should be created by trigger, but ensure it exists)
    console.log('👤 Creating user profile...');
    await createProfile(supabase, newUser.user.id);

    // Step 4: Verify user can authenticate
    console.log('🔐 Verifying authentication...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (authError || !authData.user) {
      throw new Error(`Authentication verification failed: ${authError?.message}`);
    }

    console.log('✅ Authentication verified successfully!');

    // Summary
    console.log('\n✅ Test user created successfully!');
    console.log('\nUser Details:');
    console.log(`  ID: ${newUser.user.id}`);
    console.log(`  Email: ${newUser.user.email}`);
    console.log(`  Email Confirmed: ${newUser.user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`  Created: ${newUser.user.created_at}`);
    console.log('\nCredentials:');
    console.log(`  Email: ${TEST_USER.email}`);
    console.log(`  Password: ${TEST_USER.password}`);
    console.log('\n🎯 You can now run: npx tsx e2e/scripts/setup-personalization-db.ts');

  } catch (error) {
    console.error('\n❌ Failed to create test user');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function createProfile(supabase: any, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: TEST_USER.displayName,
      full_name: TEST_USER.name,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError) {
    // Profile might already exist from trigger, check if it's a unique constraint error
    if (profileError.code === '23505') {
      console.log('✅ Profile already exists (created by trigger)');
      return;
    }
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  console.log('✅ Profile created successfully');
}

// Run the script
createTestUser().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
