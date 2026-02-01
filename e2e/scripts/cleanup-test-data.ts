#!/usr/bin/env npx tsx
/**
 * E2E Test Data Cleanup CLI Script
 *
 * Standalone script to clean up test data from dev environment.
 * Uses soft-delete patterns to avoid permanent data loss.
 *
 * Usage:
 *   yarn test:e2e:cleanup           # Actually soft-delete test data
 *   yarn test:e2e:cleanup:dry-run   # Preview what would be deleted
 *
 * Options:
 *   --dry-run   Show what would be deleted without actually deleting
 *   --verbose   Show detailed output (default: true)
 *   --yes       Skip confirmation prompt
 *
 * Environment:
 *   Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   Set TEST_USER_EMAIL to include main test user in cleanup
 *
 * @see e2e/utils/test-data-cleanup.ts - Core cleanup logic
 * @see e2e/global-teardown.ts - Automatic cleanup after test runs
 */

import * as readline from 'readline';
import { cleanupAllTestData, previewCleanup } from '../utils/test-data-cleanup';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = !args.includes('--quiet');
const SKIP_CONFIRM = args.includes('--yes') || args.includes('-y');

async function promptConfirmation(message: string): Promise<boolean> {
  if (SKIP_CONFIRM) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('=== E2E Test Data Cleanup Script ===\n');

  const testEnv = process.env.TEST_ENV || 'unknown';
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown';

  console.log(`Environment: ${testEnv}`);
  console.log(`Target URL: ${baseUrl}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will soft-delete)'}\n`);

  // Always do a preview first
  console.log('Scanning for test data...\n');

  const preview = await previewCleanup(VERBOSE);

  if (preview.testUserIds.length === 0) {
    console.log('No test users found. Nothing to clean up.\n');
    console.log('Test users are identified by:');
    console.log('  - TEST_USER_EMAIL environment variable');
    console.log('  - Profiles with is_mock = true');
    process.exit(0);
  }

  console.log(`\nFound ${preview.testUserIds.length} test user(s)`);
  console.log(`\nItems that ${DRY_RUN ? 'would be' : 'will be'} soft-deleted:`);
  console.log(`  - Sessions: ${preview.sessions.count}`);
  console.log(`  - Intel Posts: ${preview.intelPosts.count}`);
  console.log(`  - Total: ${preview.totalCleaned}\n`);

  if (preview.sessions.error) {
    console.warn(`Warning (sessions): ${preview.sessions.error}`);
  }
  if (preview.intelPosts.error) {
    console.warn(`Warning (intel_posts): ${preview.intelPosts.error}`);
  }

  if (preview.totalCleaned === 0) {
    console.log('No active test data found. Nothing to clean up.');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('DRY RUN complete. Run without --dry-run to perform cleanup.');
    process.exit(0);
  }

  // Confirm before actual deletion
  const confirmed = await promptConfirmation(
    `\nAre you sure you want to soft-delete ${preview.totalCleaned} item(s)? [y/N] `
  );

  if (!confirmed) {
    console.log('\nCancelled. No changes made.');
    process.exit(0);
  }

  // Execute the cleanup
  console.log('\nExecuting cleanup...\n');

  const result = await cleanupAllTestData({ dryRun: false, verbose: VERBOSE });

  console.log('\n=== Cleanup Summary ===\n');
  console.log(`Sessions soft-deleted: ${result.sessions.count}`);
  console.log(`Intel posts soft-deleted: ${result.intelPosts.count}`);
  console.log(`Total items cleaned: ${result.totalCleaned}`);
  console.log(`Duration: ${result.durationMs}ms\n`);

  if (result.sessions.error) {
    console.error(`Error (sessions): ${result.sessions.error}`);
  }
  if (result.intelPosts.error) {
    console.error(`Error (intel_posts): ${result.intelPosts.error}`);
  }

  console.log('Done!');
  console.log('\nNote: Data was soft-deleted (not permanently removed).');
  console.log('Use restore_entity() SQL function to recover if needed.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
