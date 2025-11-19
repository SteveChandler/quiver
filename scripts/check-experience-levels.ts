/**
 * Script to check for invalid experience_level values in the profiles table
 *
 * Valid values:
 * - "beginner" | "intermediate" | "advanced" | "expert"
 * - "" (empty string)
 * - null
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
  console.error('Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const VALID_VALUES = ['beginner', 'intermediate', 'advanced', 'expert', '', null];

async function checkExperienceLevels() {
  console.log('Querying profiles table for all distinct experience_level values...\n');

  // Query all profiles with their experience_level and creation date
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, experience_level, created_at, full_name');

  if (error) {
    console.error('Error querying profiles:', error);
    process.exit(1);
  }

  if (!profiles) {
    console.log('No profiles found.');
    return;
  }

  // Group by experience_level and count
  const valueCounts = new Map<string | null, number>();

  for (const profile of profiles) {
    const value = profile.experience_level;
    valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
  }

  // Sort and display results
  const sortedEntries = Array.from(valueCounts.entries()).sort((a, b) => {
    // Sort by validity first (valid values first), then by count (descending)
    const aValid = VALID_VALUES.includes(a[0]);
    const bValid = VALID_VALUES.includes(b[0]);

    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;

    return b[1] - a[1]; // Sort by count descending
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('EXPERIENCE_LEVEL DISTRIBUTION IN PROFILES TABLE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let invalidCount = 0;
  let invalidProfiles = 0;

  for (const [value, count] of sortedEntries) {
    const isValid = VALID_VALUES.includes(value);
    const displayValue = value === null ? 'NULL' : value === '' ? '(empty string)' : `"${value}"`;
    const status = isValid ? '✓ VALID' : '✗ INVALID';
    const statusColor = isValid ? '' : '⚠️  ';

    console.log(`${statusColor}${displayValue.padEnd(25)} ${count.toString().padStart(6)} profiles  [${status}]`);

    if (!isValid) {
      invalidCount++;
      invalidProfiles += count;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Total unique values: ${valueCounts.size}`);
  console.log(`Total profiles: ${profiles.length}`);
  console.log(`Invalid values found: ${invalidCount}`);
  console.log(`Profiles with invalid values: ${invalidProfiles}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check for empty strings - these are valid in DB but invalid in Zod schema
  const emptyStringProfiles = profiles.filter(p => p.experience_level === '');

  if (emptyStringProfiles.length > 0) {
    console.log('⚠️  EMPTY STRING VALUES DETECTED (Valid in DB, Invalid in Zod schema)\n');
    console.log(`Found ${emptyStringProfiles.length} profile(s) with empty string experience_level:\n`);

    for (const profile of emptyStringProfiles) {
      console.log(`  ID: ${profile.id}`);
      console.log(`  Name: ${profile.full_name || '(no name)'}`);
      console.log(`  Created: ${profile.created_at}`);
      console.log('');
    }

    console.log('ISSUE:');
    console.log('  The Zod schema in profile-actions.ts and profile-preferences.tsx uses:');
    console.log('    z.enum(["beginner", "intermediate", "advanced", "expert"]).nullable().optional()');
    console.log('  This schema accepts: "beginner" | "intermediate" | "advanced" | "expert" | null | undefined');
    console.log('  But does NOT accept: "" (empty string)\n');

    console.log('RECOMMENDATION:');
    console.log('  Option 1 (Recommended): Update Zod schema to accept empty strings:');
    console.log('    z.union([');
    console.log('      z.enum(["beginner", "intermediate", "advanced", "expert"]),');
    console.log('      z.literal(""),');
    console.log('      z.null()');
    console.log('    ]).optional()');
    console.log('');
    console.log('  Option 2: Create migration to convert empty strings to NULL:');
    console.log('    UPDATE profiles SET experience_level = NULL WHERE experience_level = \'\';');
    console.log('');
  }

  if (invalidCount > 0) {
    console.log('⚠️  INVALID VALUES DETECTED!\n');
    console.log('Expected valid values:');
    console.log('  - "beginner"');
    console.log('  - "intermediate"');
    console.log('  - "advanced"');
    console.log('  - "expert"');
    console.log('  - "" (empty string)');
    console.log('  - null\n');

    console.log('RECOMMENDATION:');
    console.log('  A data migration is needed to fix invalid experience_level values.');
    console.log('  Create a migration to either:');
    console.log('  1. Set invalid values to NULL (safest option)');
    console.log('  2. Map invalid values to valid ones (if mapping is clear)');
    console.log('  3. Set invalid values to empty string ""');

    process.exit(1);
  } else if (emptyStringProfiles.length > 0) {
    console.log('Action required to fix Zod validation mismatch.');
    process.exit(1);
  } else {
    console.log('✓ All experience_level values are valid!');
    process.exit(0);
  }
}

checkExperienceLevels().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
