#!/usr/bin/env node
/**
 * Production Mock Users Seeding Script for Quiver
 * 
 * This script safely creates mock users for development and community features testing.
 * It uses the Supabase Admin API to create auth users and corresponding profile records.
 * 
 * SAFETY FEATURES:
 * - Uses @example.invalid emails (non-deliverable)
 * - Creates auth users with email_confirmed=true for immediate E2E testing login
 * - Marks profiles with is_mock=true for easy identification
 * - Idempotent operations (safe to run multiple times)
 * - Never deletes real users
 * - Comprehensive error handling and logging
 * 
 * REQUIREMENTS:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 * - NEXT_PUBLIC_SUPABASE_URL environment variable must be set
 * - is_mock column must exist in profiles table (run migration first)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// Mock user personas with realistic data
const mockUsers = [
  {
    name: 'Solid Snake',
    email: 'solid.snake@example.invalid',
    yearsExperience: 2,
    experienceLevel: 'advanced', // Persona: Tactical
    board: {
      name: 'High Performance',
      type: 'shortboard',
      dimensions: '5\'10" x 18.25" x 2.2"',
      description: 'Precision board for critical sections and barrels'
    }
  },
  {
    name: 'Liquid Snake',
    email: 'liquid.snake@example.invalid', 
    yearsExperience: 1.5,
    board: {
      name: 'High Performance',
      type: 'shortboard', 
      dimensions: '5\'10" x 18.25" x 2.2"',
      description: 'Twin to Solid\'s board - built for performance'
    }
  },
  {
    name: 'Big Boss',
    email: 'big.boss@example.invalid',
    yearsExperience: 3,
    board: {
      name: 'Classic Gun',
      type: 'gun',
      dimensions: '7\'6" x 19" x 2.75"',
      description: 'The legendary gun for serious waves'
    }
  },
  {
    name: 'Riley R.',
    email: 'riley.r@example.invalid',
    yearsExperience: 0.5,
    experienceLevel: 'beginner', // Persona: Rookie
    board: {
      name: 'Beginner Longboard',
      type: 'longboard',
      dimensions: '9\'0" x 22" x 3"',
      description: 'Perfect learning board - stable and forgiving'
    }
  },
  {
    name: 'Local Larry',
    email: 'local.larry@example.invalid',
    yearsExperience: 5,
    experienceLevel: 'expert', // Persona: Local
    board: {
      name: 'Daily Driver Shortboard',
      type: 'shortboard',
      dimensions: '6\'2" x 19" x 2.5"',
      description: 'Trusty everyday board for all conditions'
    }
  },
  {
    name: 'Tina C.',
    email: 'tina.c@example.invalid',
    yearsExperience: 3,
    experienceLevel: 'intermediate', // Persona: Traveler
    board: {
      name: 'Travel Board',
      type: 'shortboard',
      dimensions: '6\'4" x 19.5" x 2.6"',
      description: 'Versatile travel companion for different breaks'
    }
  },
  {
    name: 'P. Martinez',
    email: 'p.martinez@example.invalid',
    yearsExperience: 4,
    experienceLevel: 'intermediate', // Persona: Photographer
    board: {
      name: 'Performance Thruster',
      type: 'shortboard',
      dimensions: '6\'0" x 18.5" x 2.3"',
      description: 'High-performance board for action shots'
    }
  },
  {
    name: 'Dawn Patrol',
    email: 'dawnpatrol@example.invalid',
    yearsExperience: 6,
    board: {
      name: 'Dawn Session Board',
      type: 'shortboard',
      dimensions: '6\'1" x 19" x 2.4"',
      description: 'Built for early morning sessions'
    }
  },
  {
    name: 'NorCal Jake',
    email: 'norcal.jake@example.invalid',
    yearsExperience: 7,
    board: {
      name: 'All-Around Shortboard',
      type: 'shortboard',
      dimensions: '6\'2" x 19.25" x 2.5"',
      description: 'NorCal tested, cold water approved'
    }
  },
  {
    name: 'SoCal Sofia',
    email: 'socal.sofia@example.invalid',
    yearsExperience: 4,
    board: {
      name: 'Longboard',
      type: 'longboard',
      dimensions: '9\'2" x 22.5" x 3"',
      description: 'Classic SoCal longboard for point breaks'
    }
  },
  {
    name: 'M. Johnson',
    email: 'm.johnson@example.invalid',
    yearsExperience: 2,
    board: {
      name: 'All-Around Shortboard',
      type: 'shortboard',
      dimensions: '6\'2" x 19.25" x 2.5"',
      description: 'Handles East Coast beach breaks'
    }
  },
  {
    name: 'Kai N.',
    email: 'kai.n@example.invalid',
    yearsExperience: 10,
    experienceLevel: 'expert', // Persona: Competitor
    board: {
      name: 'Gun',
      type: 'gun',
      dimensions: '8\'0" x 19.5" x 3"',
      description: 'Hawaiian gun for serious North Shore waves'
    }
  },
  {
    name: 'Emma F.',
    email: 'emma.f@example.invalid',
    yearsExperience: 1,
    board: {
      name: 'All-Around Shortboard',
      type: 'shortboard',
      dimensions: '6\'2" x 19.25" x 2.5"',
      description: 'Perfect for forecast validation sessions'
    }
  },
  {
    name: 'Ryan K.',
    email: 'ryan.k@example.invalid',
    yearsExperience: 2,
    board: {
      name: 'All-Around Shortboard',
      type: 'shortboard',
      dimensions: '6\'2" x 19.25" x 2.5"',
      description: 'Data-driven board selection'
    }
  },
  {
    name: 'Mia R.',
    email: 'mia.r@example.invalid',
    yearsExperience: 3,
    board: {
      name: 'All-Around Shortboard',
      type: 'shortboard',
      dimensions: '6\'2" x 19.25" x 2.5"',
      description: 'Safety-first approach to surfing'
    }
  }
];

/**
 * Create a single mock user with auth and profile
 */
async function createMockUser(userData: typeof mockUsers[0]) {
  console.log(`🔄 Processing user: ${userData.name}`);
  
  try {
    // Check if auth user already exists
    const { data: existingAuthUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error(`❌ Error listing users: ${listError.message}`);
      return false;
    }

    const existingAuthUser = existingAuthUsers.users.find(user => user.email === userData.email);
    
    let authUserId: string;
    
    if (existingAuthUser) {
      console.log(`   ℹ️  Auth user already exists: ${userData.email}`);
      authUserId = existingAuthUser.id;
    } else {
      // Create auth user with Supabase Admin API
      // Password is required - must be set via PERSONA_PASSWORD environment variable
      const mockPassword = process.env.PERSONA_PASSWORD;
      if (!mockPassword) {
        console.error(`❌ PERSONA_PASSWORD environment variable is required to create mock users.`);
        console.error(`   Set it in your .env file or export it before running this script.`);
        return false;
      }

      // Only confirm email if explicitly allowed (for E2E testing in dev/test environments)
      const allowEmailConfirm = process.env.ALLOW_MOCK_EMAIL_CONFIRM === 'true';

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: mockPassword,
        email_confirm: allowEmailConfirm, // Only confirm if explicitly allowed
        user_metadata: {
          full_name: userData.name,
          is_mock_user: true,
          years_experience: userData.yearsExperience,
          created_by: 'seed-script'
        }
      });

      if (authError) {
        console.error(`❌ Error creating auth user ${userData.name}: ${authError.message}`);
        return false;
      }

      if (!authUser.user) {
        console.error(`❌ No user returned for ${userData.name}`);
        return false;
      }

      authUserId = authUser.user.id;
      console.log(`   ✅ Created auth user: ${userData.email}`);
    }

    // Check if profile already exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle();

    if (profileCheckError) {
      console.error(`❌ Error checking profile for ${userData.name}: ${profileCheckError.message}`);
      return false;
    }

    if (!existingProfile) {
      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUserId,
          full_name: userData.name,
          display_name: userData.name,
          is_mock: true,
          experience_level: userData.experienceLevel,
          email_session_invites: true,
          inapp_session_invites: true,
          digest_session_invites: false,
          followers_count: Math.floor(Math.random() * 200) + 10,
          following_count: Math.floor(Math.random() * 150) + 5,
          created_at: new Date(Date.now() - (userData.yearsExperience * 365 * 24 * 60 * 60 * 1000)).toISOString()
        });

      if (profileError) {
        console.error(`❌ Error creating profile for ${userData.name}: ${profileError.message}`);
        return false;
      }

      console.log(`   ✅ Created profile: ${userData.name}`);
    } else {
      console.log(`   ℹ️  Profile already exists: ${userData.name}`);
    }

    // Check if board already exists
    const { data: existingBoards, error: boardCheckError } = await supabase
      .from('boards')
      .select('id')
      .eq('user_id', authUserId);

    if (boardCheckError) {
      console.error(`❌ Error checking boards for ${userData.name}: ${boardCheckError.message}`);
      return false;
    }

    if (!existingBoards || existingBoards.length === 0) {
      // Create board record
      const { error: boardError } = await supabase
        .from('boards')
        .insert({
          user_id: authUserId,
          name: userData.board.name,
          board_type: userData.board.type,
          dimensions: userData.board.dimensions,
          description: userData.board.description,
          session_count: Math.floor(Math.random() * (userData.yearsExperience * 50)) + 5,
          created_at: new Date(Date.now() - (Math.random() * userData.yearsExperience * 365 * 24 * 60 * 60 * 1000)).toISOString()
        });

      if (boardError) {
        console.error(`❌ Error creating board for ${userData.name}: ${boardError.message}`);
        return false;
      }

      console.log(`   ✅ Created board: ${userData.board.name}`);
    } else {
      console.log(`   ℹ️  Board already exists for: ${userData.name}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Unexpected error processing ${userData.name}:`, error);
    return false;
  }
}

/**
 * Validate database schema requirements
 */
async function validateSchema() {
  console.log('🔍 Validating database schema...');
  
  try {
    // Check if profiles table has is_mock column
    const { error } = await supabase
      .from('profiles')
      .select('is_mock')
      .limit(1);

    if (error) {
      console.error('❌ Schema validation failed: is_mock column missing from profiles table');
      console.error('   Please run the migration: 20250827000001_add_is_mock_to_profiles.sql');
      return false;
    }

    console.log('✅ Schema validation passed');
    return true;
  } catch (error) {
    console.error('❌ Schema validation error:', error);
    return false;
  }
}

/**
 * Clean up any orphaned mock auth users (safety function)
 */
async function cleanupOrphanedAuthUsers() {
  console.log('🧹 Checking for orphaned mock auth users...');
  
  try {
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error(`❌ Error listing auth users: ${listError.message}`);
      return;
    }

    const mockAuthUsers = authUsers.users.filter(user => 
      user.email?.endsWith('@example.invalid') || 
      user.user_metadata?.is_mock_user === true
    );

    let cleanedUp = 0;

    for (const authUser of mockAuthUsers) {
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error(`❌ Error checking profile for ${authUser.email}: ${profileError.message}`);
        continue;
      }

      if (!profile) {
        // Profile doesn't exist, this is an orphaned auth user
        console.log(`🗑️  Removing orphaned auth user: ${authUser.email}`);
        
        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);
        
        if (deleteError) {
          console.error(`❌ Error deleting orphaned user ${authUser.email}: ${deleteError.message}`);
        } else {
          cleanedUp++;
        }
      }
    }

    if (cleanedUp > 0) {
      console.log(`✅ Cleaned up ${cleanedUp} orphaned auth users`);
    } else {
      console.log('✅ No orphaned auth users found');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🏄‍♂️ Quiver Mock Users Seeding Script');
  console.log('=====================================');
  console.log('');

  // Validate environment and schema
  if (!(await validateSchema())) {
    process.exit(1);
  }

  // Clean up orphaned users first
  await cleanupOrphanedAuthUsers();

  console.log('');
  console.log('🌱 Seeding mock users...');
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  // Process each user
  for (const userData of mockUsers) {
    const success = await createMockUser(userData);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    console.log(''); // Add spacing between users
  }

  // Summary
  console.log('📊 Seeding Summary');
  console.log('==================');
  console.log(`✅ Successfully processed: ${successCount} users`);
  console.log(`❌ Errors: ${errorCount} users`);
  console.log(`📁 Total mock users attempted: ${mockUsers.length}`);

  if (errorCount === 0) {
    console.log('');
    console.log('🎉 All mock users seeded successfully!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - Mock users are marked with is_mock=true in profiles');
    console.log(`   - Email confirmed: ${process.env.ALLOW_MOCK_EMAIL_CONFIRM === 'true' ? 'YES (E2E login ready)' : 'NO (set ALLOW_MOCK_EMAIL_CONFIRM=true for E2E)'}`);
    console.log('   - All emails use @example.invalid domain (non-deliverable)');
    console.log('   - You can query mock users with: SELECT * FROM profiles WHERE is_mock = true');
  } else {
    console.log('');
    console.log('⚠️  Some users had errors. Please check the logs above.');
    process.exit(1);
  }
}

// Execute the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}