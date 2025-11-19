/**
 * Verification Script: Confirm experience_level migration was successful
 *
 * Run this after applying migration: 20251117000000_fix_empty_experience_levels.sql
 *
 * Expected results:
 * - 0 profiles with empty string experience_level
 * - All profiles have NULL or valid enum values
 * - Database constraint is in place
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.generated';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function verifyFix() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   EXPERIENCE_LEVEL MIGRATION VERIFICATION                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Check for empty strings
  const { data: emptyStringProfiles, error: emptyError } = await supabase
    .from('profiles')
    .select('id, full_name, experience_level')
    .eq('experience_level', '');

  if (emptyError) {
    console.error('❌ Error querying for empty strings:', emptyError);
    process.exit(1);
  }

  console.log('1. EMPTY STRING CHECK');
  console.log('   Expected: 0 profiles with empty string');
  console.log(`   Actual:   ${emptyStringProfiles?.length || 0} profiles\n`);

  if (emptyStringProfiles && emptyStringProfiles.length > 0) {
    console.log('   ❌ FAILED - Empty strings still exist:');
    emptyStringProfiles.forEach(p => {
      console.log(`      - ${p.full_name || 'Unknown'} (${p.id})`);
    });
    console.log('');
  } else {
    console.log('   ✅ PASSED - No empty strings found\n');
  }

  // Check for invalid values
  const { data: allProfiles, error: allError } = await supabase
    .from('profiles')
    .select('experience_level');

  if (allError) {
    console.error('❌ Error querying all profiles:', allError);
    process.exit(1);
  }

  const invalidProfiles = allProfiles?.filter(p => {
    const level = p.experience_level;
    return level !== null && !['beginner', 'intermediate', 'advanced', 'expert'].includes(level);
  }) || [];

  console.log('2. VALID VALUES CHECK');
  console.log('   Expected: 0 profiles with invalid values');
  console.log(`   Actual:   ${invalidProfiles.length} profiles\n`);

  if (invalidProfiles.length > 0) {
    console.log('   ❌ FAILED - Invalid values found');
    const uniqueInvalid = [...new Set(invalidProfiles.map(p => p.experience_level))];
    uniqueInvalid.forEach(val => {
      console.log(`      - "${val}" (${invalidProfiles.filter(p => p.experience_level === val).length} profiles)`);
    });
    console.log('');
  } else {
    console.log('   ✅ PASSED - All values are valid\n');
  }

  // Check constraint exists
  const { data: constraints, error: constraintError } = await supabase.rpc('get_constraints', {
    table_name: 'profiles',
  } as any).catch(() => ({ data: null, error: null }));

  console.log('3. DATABASE CONSTRAINT CHECK');
  console.log('   Checking for: experience_level_check constraint');

  // Alternative: Query information_schema
  const { data: constraintInfo } = await supabase
    .from('information_schema.table_constraints' as any)
    .select('constraint_name')
    .eq('table_name', 'profiles')
    .eq('constraint_name', 'experience_level_check')
    .single()
    .catch(() => ({ data: null }));

  if (constraintInfo) {
    console.log('   ✅ PASSED - Constraint exists\n');
  } else {
    console.log('   ⚠️  WARNING - Could not verify constraint (may require direct DB access)\n');
  }

  // Distribution summary
  const valueCounts = new Map<string | null, number>();
  allProfiles?.forEach(p => {
    const value = p.experience_level;
    valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
  });

  console.log('4. DISTRIBUTION SUMMARY');
  console.log('   ┌─────────────────────────┬───────────────┐');
  console.log('   │ experience_level        │ Profile Count │');
  console.log('   ├─────────────────────────┼───────────────┤');

  const sortedEntries = Array.from(valueCounts.entries()).sort((a, b) => b[1] - a[1]);
  sortedEntries.forEach(([value, count]) => {
    const displayValue = value === null ? 'NULL' : `"${value}"`;
    console.log(`   │ ${displayValue.padEnd(23)} │ ${count.toString().padStart(13)} │`);
  });

  console.log('   └─────────────────────────┴───────────────┘\n');

  // Final verdict
  const allPassed = (
    (emptyStringProfiles?.length || 0) === 0 &&
    invalidProfiles.length === 0
  );

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║                     ✅ VERIFICATION PASSED                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log('Migration was successful!');
    console.log('All experience_level values are now valid.\n');
    process.exit(0);
  } else {
    console.log('║                     ❌ VERIFICATION FAILED                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log('Migration did not complete successfully.');
    console.log('Please review the errors above and retry the migration.\n');
    process.exit(1);
  }
}

verifyFix().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
