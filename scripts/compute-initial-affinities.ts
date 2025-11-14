#!/usr/bin/env node
/**
 * Initial Beach Affinity Computation Script
 *
 * Backfills the user_beach_affinity table from existing session history.
 * Uses the compute_all_affinities_initial() database function to calculate
 * affinity scores for all user-beach pairs based on:
 * - Session count (base score: 10 points per session, max 50)
 * - Recency bonus (30 points max, exponential decay over 180 days)
 * - Frequency bonus (+20 if 5+ sessions)
 *
 * Usage:
 *   yarn affinity:compute
 *   tsx scripts/compute-initial-affinities.ts
 *
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Safety:
 *   - Idempotent (safe to run multiple times)
 *   - Uses ON CONFLICT to update existing records
 *   - No data deletion
 *   - Read-only impact on sessions table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Validate required environment variables
 */
function validateEnvironment(): boolean {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease check your .env.local file.');
    return false;
  }

  return true;
}

/**
 * Main execution function
 */
async function computeInitialAffinities() {
  console.log('🏄 Beach Affinity Initial Computation');
  console.log('====================================\n');

  // Validate environment
  if (!validateEnvironment()) {
    process.exit(1);
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  console.log('🔄 Computing beach affinities from session history...');
  console.log('   Algorithm: base (10*sessions, max 50) + recency (30*exp(-days/180)) + frequency (+20 if 5+ sessions)\n');

  try {
    // Call database function to compute all affinities
    const { data, error } = await supabase.rpc('compute_all_affinities_initial');

    if (error) {
      console.error('❌ Failed to compute affinities:', error.message);
      console.error('\nError Details:', error);

      // Provide helpful error messages
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.error('\n💡 Tip: Run migration first: supabase db push');
      }

      process.exit(1);
    }

    console.log('✅ Successfully computed affinities for all user-beach pairs\n');

    // Query and display summary statistics
    const { data: stats, error: statsError } = await supabase
      .from('user_beach_affinity')
      .select('user_id, beach_id, affinity_score', { count: 'exact' });

    if (!statsError && stats) {
      const totalRecords = stats.length;
      const uniqueUsers = new Set(stats.map(s => s.user_id)).size;
      const uniqueBeaches = new Set(stats.map(s => s.beach_id)).size;
      const avgScore = stats.reduce((sum, s) => sum + Number(s.affinity_score), 0) / totalRecords;

      console.log('📊 Computation Summary');
      console.log('=====================');
      console.log(`Total affinity records: ${totalRecords}`);
      console.log(`Unique users: ${uniqueUsers}`);
      console.log(`Unique beaches: ${uniqueBeaches}`);
      console.log(`Average affinity score: ${avgScore.toFixed(2)}/100`);
      console.log('\n💡 Next steps:');
      console.log('   - Affinity scores will auto-update as users log sessions');
      console.log('   - Use these scores for personalized recommendations');
      console.log('   - Query with: SELECT * FROM user_beach_affinity WHERE user_id = <uuid>');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  }
}

// Execute script
if (require.main === module) {
  computeInitialAffinities().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

// Export for testing
export { computeInitialAffinities };
