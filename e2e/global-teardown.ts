import * as fs from 'fs';
import { FullConfig } from '@playwright/test';
import {
  cleanupAllTestData,
  cleanupEphemeralSmokeUsers,
  createServiceClient,
} from './utils/test-data-cleanup';

/**
 * Global teardown runs once after all tests complete
 * Validates authentication state, cleans up test data, and provides debugging information
 */
async function globalTeardown(config: FullConfig) {
  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Validating test execution state');
  console.log('[Global Teardown] ============================================\n');

  const statePath = 'e2e/.auth/state.json';

  // Auth-state validation is best-effort and only relevant when authenticated
  // tests ran. Skip it for guest-only runs but keep going to the cleanup block —
  // the smoke-user sweep must run regardless of which projects executed.
  if (!fs.existsSync(statePath)) {
    console.warn(`[Global Teardown] ⚠️  Auth state file not found: ${statePath}`);
    console.warn('[Global Teardown] This is expected if only guest tests ran');
  } else {
   try {
    // Read and validate auth state
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    const state = JSON.parse(stateContent);

    // Count authentication artifacts
    const cookieCount = state.cookies?.length || 0;
    const originCount = state.origins?.length || 0;

    console.log('[Global Teardown] Auth state summary:');
    console.log(`  - Cookies: ${cookieCount}`);
    console.log(`  - Origins: ${originCount}`);

    // Check for Supabase auth cookies
    const supabaseCookies = state.cookies?.filter((cookie: any) =>
      cookie.name?.startsWith('sb-') && cookie.name?.includes('auth-token')
    ) || [];

    console.log(`  - Supabase auth cookies: ${supabaseCookies.length}`);

    // Validate auth state quality
    if (cookieCount === 0 && originCount === 0) {
      console.error('\n[Global Teardown] ❌ WARNING: Auth state is empty!');
      console.error('[Global Teardown] This indicates authentication may have failed during setup.');
      console.error('[Global Teardown] Authenticated tests likely failed.');
      console.error('[Global Teardown] Run: npm run test:e2e:auth:reset && npm run test:e2e:setup');
    } else if (supabaseCookies.length === 0) {
      console.warn('\n[Global Teardown] ⚠️  WARNING: No Supabase auth cookies found!');
      console.warn('[Global Teardown] Auth state contains cookies, but none are Supabase auth tokens.');
      console.warn('[Global Teardown] This may indicate an authentication problem.');
    } else {
      console.log('\n[Global Teardown] ✓ Auth state appears valid');

      // Show cookie details (without values for security)
      console.log('\n[Global Teardown] Supabase cookies:');
      supabaseCookies.forEach((cookie: any) => {
        console.log(`  - ${cookie.name} (domain: ${cookie.domain})`);
      });
    }

    // Show storage state if present
    if (state.origins && state.origins.length > 0) {
      console.log('\n[Global Teardown] Storage origins:');
      state.origins.forEach((origin: any) => {
        const localStorageCount = origin.localStorage?.length || 0;
        console.log(`  - ${origin.origin}: ${localStorageCount} localStorage items`);
      });
    }

    // File size check
    const stats = fs.statSync(statePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`\n[Global Teardown] State file size: ${fileSizeKB} KB`);

    if (stats.size < 100) {
      console.warn('[Global Teardown] ⚠️  State file is very small, may be incomplete');
    }

   } catch (error) {
    console.error('[Global Teardown] ❌ Error validating auth state:', error);
    console.error('[Global Teardown] This may indicate corrupted state file');

    if (error instanceof SyntaxError) {
      console.error('[Global Teardown] State file contains invalid JSON');
      console.error('[Global Teardown] Run: npm run test:e2e:auth:reset to fix');
    }
   }
  }

  // ============================================
  // Clean up test data
  // ============================================
  // Two layers:
  //   1. Ephemeral smoke users — always-on. The matcher requires
  //      `app_metadata.is_ephemeral_smoke_test === true` (server-controlled,
  //      cannot be set by a real user), with a legacy email-pattern fallback
  //      for pre-marker accounts. Filter-safe enough to run on any env so
  //      developer machines self-heal.
  //   2. Sessions + intel posts — dev-only. These soft-delete content owned
  //      by `is_mock=true` profiles or the main TEST_USER_EMAIL, which on prod
  //      could touch real-user content via mis-tags. Stays gated.
  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Cleaning up test data...');
  console.log('[Global Teardown] ============================================\n');

  try {
    const testEnv = process.env.TEST_ENV || 'local';
    const baseURL = process.env.BASE_URL || '';
    const isDevEnvironment = testEnv === 'dev' || baseURL.includes('dev.quiversurf.app');

    // Layer 1: always-on ephemeral sweep.
    let ephemeralCount = 0;
    try {
      const serviceClient = createServiceClient();
      const ephemeralResult = await cleanupEphemeralSmokeUsers(serviceClient, false, true);
      ephemeralCount = ephemeralResult.count;
      if (ephemeralResult.error) {
        console.warn(`[Global Teardown] ⚠️  Ephemeral users cleanup warning: ${ephemeralResult.error}`);
      }
    } catch (err) {
      // Missing service-role env (e.g. local runs without .env.playwright.local)
      // is the common shape — log and continue rather than fail the run.
      console.warn('[Global Teardown] ⚠️  Skipping ephemeral sweep (service client unavailable):', err);
    }

    // Layer 2: dev-only session + intel-post cleanup.
    if (isDevEnvironment) {
      const result = await cleanupAllTestData({
        verbose: true,
        skipEphemeralSmokeUsers: true,
      });

      const totalCleaned = result.totalCleaned + ephemeralCount;
      if (totalCleaned > 0) {
        console.log(`[Global Teardown] ✓ Cleaned ${totalCleaned} test item(s)`);
        console.log(`  - Sessions: ${result.sessions.count}`);
        console.log(`  - Intel Posts: ${result.intelPosts.count}`);
        console.log(`  - Ephemeral smoke users: ${ephemeralCount}`);
      } else {
        console.log('[Global Teardown] ✓ No test data to clean up');
      }

      if (result.sessions.error) {
        console.warn(`[Global Teardown] ⚠️  Sessions cleanup warning: ${result.sessions.error}`);
      }
      if (result.intelPosts.error) {
        console.warn(`[Global Teardown] ⚠️  Intel posts cleanup warning: ${result.intelPosts.error}`);
      }
    } else {
      if (ephemeralCount > 0) {
        console.log(`[Global Teardown] ✓ Cleaned ${ephemeralCount} ephemeral smoke user(s)`);
      }
      console.log(
        `[Global Teardown] Skipping session/intel cleanup (env=${testEnv}, not dev environment)`
      );
    }
  } catch (error) {
    // Don't fail tests if cleanup fails - just log the warning
    console.warn('[Global Teardown] ⚠️  Test data cleanup failed (non-fatal):', error);
    console.warn('[Global Teardown] Tests completed but test data may remain in the database');
  }

  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Teardown complete');
  console.log('[Global Teardown] ============================================\n');
}

export default globalTeardown;
