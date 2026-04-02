/**
 * Database setup script for personalization E2E tests
 *
 * Creates test data required for personalization features:
 * - Multiple rated sessions across different beaches
 * - Triggers beach affinity calculation
 * - Triggers preference learning
 * - Verifies all personalization tables populated
 *
 * Run with: npx tsx e2e/scripts/setup-personalization-db.ts
 *
 * Prerequisites:
 * - Local Supabase running (supabase start)
 * - User authenticated in e2e/.auth/state.json
 * - Development server running (yarn dev)
 *
 * Expected outcome:
 * - 12 sessions created across 3 beaches (Blacks: 6, Swamis: 4, Birdrock: 2)
 * - session_forecast_snapshots: 12 records
 * - user_beach_affinity: 3 records (one per beach)
 * - user_surf_preferences: 1 record (confidence > 0.5)
 */

import { chromium, Page } from "@playwright/test";
import { createTestSession } from "../utils/session-test-data";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.playwright', override: true });
dotenv.config();

/**
 * Beach distribution for sessions
 * Creates varying affinity levels for testing
 */
const SESSION_PLAN = [
  // High affinity beach: Blacks (6 sessions)
  { beachName: 'Blacks', rating: 5, withPhotos: false },
  { beachName: 'Blacks', rating: 4, withPhotos: true },
  { beachName: 'Blacks', rating: 5, withPhotos: false },
  { beachName: 'Blacks', rating: 4, withPhotos: false },
  { beachName: 'Blacks', rating: 5, withPhotos: true },
  { beachName: 'Blacks', rating: 4, withPhotos: false },

  // Medium affinity beach: Swamis (4 sessions)
  { beachName: 'Swamis', rating: 4, withPhotos: false },
  { beachName: 'Swamis', rating: 3, withPhotos: true },
  { beachName: 'Swamis', rating: 4, withPhotos: false },
  { beachName: 'Swamis', rating: 5, withPhotos: false },

  // Low affinity beach: Birdrock (2 sessions)
  { beachName: 'Birdrock', rating: 3, withPhotos: false },
  { beachName: 'Birdrock', rating: 4, withPhotos: false },
];

async function verifyPersonalizationData(page: Page) {
  console.log('\n📊 Verifying personalization data...\n');

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  try {
    // Get auth token from page context
    const cookies = await page.context().cookies();
    const authToken = cookies.find(c => c.name === 'sb-access-token')?.value;

    if (!authToken) {
      console.warn('⚠️  No auth token found - cannot verify data');
      return;
    }

    // Check beach affinity data
    console.log('Checking beach affinity...');
    const affinityResponse = await fetch(`${baseURL}/api/debug/beach-affinity`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (affinityResponse.ok) {
      const affinityData = await affinityResponse.json();
      console.log(`✓ Beach affinity records: ${affinityData.count || 'unknown'}`);
    } else {
      console.log('  (API endpoint not available - check manually in Supabase)');
    }

    // Check user preferences
    console.log('Checking learned preferences...');
    const prefsResponse = await fetch(`${baseURL}/api/debug/user-preferences`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (prefsResponse.ok) {
      const prefsData = await prefsResponse.json();
      console.log(`✓ User preferences: ${prefsData.exists ? 'found' : 'not found'}`);
      if (prefsData.confidence) {
        console.log(`  Confidence: ${(prefsData.confidence * 100).toFixed(0)}%`);
      }
    } else {
      console.log('  (API endpoint not available - check manually in Supabase)');
    }

    // Check session forecast snapshots
    console.log('Checking session forecast snapshots...');
    const snapshotsResponse = await fetch(`${baseURL}/api/debug/session-snapshots`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (snapshotsResponse.ok) {
      const snapshotsData = await snapshotsResponse.json();
      console.log(`✓ Session snapshots: ${snapshotsData.count || 'unknown'}`);
    } else {
      console.log('  (API endpoint not available - check manually in Supabase)');
    }

  } catch (error) {
    console.warn('⚠️  Could not verify data via API:', error instanceof Error ? error.message : 'Unknown error');
    console.log('   Manual verification: Check Supabase tables directly');
  }
}

async function runAffinityComputation() {
  console.log('\n🔄 Running beach affinity computation...');

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'compute-initial-affinities.ts');
    const { execSync } = require('child_process');

    execSync(`npx tsx ${scriptPath}`, {
      stdio: 'inherit',
      env: { ...process.env }
    });

    console.log('✅ Beach affinity computation complete');
  } catch (error) {
    console.error('❌ Beach affinity computation failed:', error);
    console.log('   Try running manually: yarn affinity:compute');
  }
}

async function runPreferenceLearning(page: Page) {
  console.log('\n🧠 Running preference learning...');

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  try {
    // Get user ID from page context (if available)
    const userId = await page.evaluate(() => {
      const user = localStorage.getItem('sb-user');
      return user ? JSON.parse(user).id : null;
    });

    if (!userId) {
      console.warn('⚠️  Could not get user ID - skipping preference learning');
      return;
    }

    // Call preference learning service directly via API
    const response = await fetch(`${baseURL}/api/cron/update-user-preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userIds: [userId]
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Preference learning complete');
      console.log(`   Processed: ${result.processed || 1} user(s)`);
    } else {
      console.log('⚠️  Preference learning API not available');
      console.log('   Preferences will be computed by nightly cron (3AM UTC)');
      console.log('   Or run manually via Supabase function');
    }
  } catch (error) {
    console.log('⚠️  Could not trigger preference learning:', error instanceof Error ? error.message : 'Unknown error');
    console.log('   Preferences will be computed by nightly cron (3AM UTC)');
  }
}

async function main() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  console.log('🏄 Personalization Database Setup');
  console.log('==================================\n');
  console.log(`Environment: ${baseURL}`);
  console.log(`Auth state: e2e/.auth/state.json`);
  console.log(`Sessions to create: ${SESSION_PLAN.length}`);
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: "e2e/.auth/state.json",
    baseURL,
  });
  const page = await context.newPage();

  try {
    // Step 1: Create sessions
    console.log('📝 Creating sessions...\n');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < SESSION_PLAN.length; i++) {
      const session = SESSION_PLAN[i];
      const sessionNum = i + 1;

      process.stdout.write(`   [${sessionNum}/${SESSION_PLAN.length}] ${session.beachName} (${session.rating}⭐)`);

      try {
        const sessionId = await createTestSession(page, session);

        if (sessionId) {
          console.log(' ✓');
          successCount++;
        } else {
          console.log(' ✗ (failed to create)');
          failCount++;
        }

        // Small delay between sessions to avoid rate limiting
        if (i < SESSION_PLAN.length - 1) {
          // eslint-disable-next-line playwright/no-wait-for-timeout -- rate limit backoff between session creations
          await page.waitForTimeout(1500);
        }
      } catch (error) {
        console.log(` ✗ (error: ${error instanceof Error ? error.message : 'Unknown'})`);
        failCount++;
      }
    }

    console.log(`\n✅ Sessions created: ${successCount}/${SESSION_PLAN.length}`);
    if (failCount > 0) {
      console.log(`⚠️  Failed sessions: ${failCount}`);
    }

    // Step 2: Run beach affinity computation
    await runAffinityComputation();

    // Step 3: Run preference learning
    await runPreferenceLearning(page);

    // Step 4: Verify data
    await verifyPersonalizationData(page);

    console.log('\n✅ Personalization database setup complete!');
    console.log('\n📖 Next steps:');
    console.log('   1. Run personalization tests: npx playwright test personalization.spec.ts');
    console.log('   2. Verify data in Supabase:');
    console.log('      - session_forecast_snapshots (should have ~12 records)');
    console.log('      - user_beach_affinity (should have 3 records)');
    console.log('      - user_surf_preferences (should have 1 record)');
    console.log('   3. Check logs for any errors or warnings');

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.error('\nTroubleshooting:');
    console.error('   - Ensure Supabase is running: supabase status');
    console.error('   - Ensure dev server is running: yarn dev');
    console.error('   - Check e2e/.auth/state.json exists');
    console.error('   - Verify user has completed onboarding');
    process.exit(1);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

main();
