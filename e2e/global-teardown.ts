import fs from 'fs';
import { FullConfig } from '@playwright/test';

/**
 * Global teardown runs once after all tests complete
 * Validates authentication state and provides debugging information
 */
async function globalTeardown(config: FullConfig) {
  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Validating test execution state');
  console.log('[Global Teardown] ============================================\n');

  const statePath = 'e2e/.auth/state.json';

  try {
    // Check if auth state file exists
    if (!fs.existsSync(statePath)) {
      console.warn(`[Global Teardown] ⚠️  Auth state file not found: ${statePath}`);
      console.warn('[Global Teardown] This is expected if only guest tests ran');
      return;
    }

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

  console.log('\n[Global Teardown] ============================================');
  console.log('[Global Teardown] Teardown complete');
  console.log('[Global Teardown] ============================================\n');
}

export default globalTeardown;
