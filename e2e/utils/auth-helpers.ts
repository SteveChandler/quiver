import { Page } from '@playwright/test';

/**
 * Authentication Helper Utilities
 *
 * These utilities help verify and debug Supabase authentication state
 * in Playwright tests. They check for auth tokens in both cookies and
 * localStorage, which are used by Supabase SSR.
 */

export interface AuthTokens {
  cookies: string[];
  storage: Array<{ key: string; value: string | null }>;
}

export interface AuthCheckResult {
  hasAuthCookie: boolean;
  hasAuthStorage: boolean;
  cookieCount: number;
  storageCount: number;
}

/**
 * Verify that Supabase authentication tokens exist
 *
 * Checks both cookies and localStorage for Supabase auth tokens.
 * Supabase SSR uses chunked cookies in the format:
 * - sb-{project-ref}-auth-token.0
 * - sb-{project-ref}-auth-token.1 (if needed)
 *
 * @param page - Playwright page object
 * @returns Promise<boolean> - true if auth tokens are found
 */
export async function verifySupabaseAuth(page: Page): Promise<boolean> {
  const debugAuth = process.env.DEBUG_AUTH === 'true';

  // Check cookies using Playwright API (can see HTTP-only cookies)
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  );

  // Check localStorage
  // Note: This may fail due to cross-origin security restrictions on external domains.
  // If localStorage access is blocked, we gracefully fall back to cookie-based auth only.
  const storageResult = await page.evaluate(() => {
    try {
      const localStorageKeys = Object.keys(localStorage);
      const hasAuthStorage = localStorageKeys.some(key =>
        key.startsWith('sb-') && key.includes('auth-token')
      );
      const authStorage = localStorageKeys.filter(k => k.startsWith('sb-'));

      return {
        hasAuthStorage,
        storageCount: authStorage.length,
        error: null
      };
    } catch (error) {
      // localStorage access denied (cross-domain security restriction)
      // This is expected when running against external domains like dev.quiversurf.app
      return {
        hasAuthStorage: false,
        storageCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  const result = {
    hasAuthCookie,
    hasAuthStorage: storageResult.hasAuthStorage,
    cookieCount: cookies.filter(c => c.name.startsWith('sb-')).length,
    storageCount: storageResult.storageCount
  };

  if (debugAuth) {
    console.log('[Auth Check]', result);
    if (storageResult.error) {
      console.log('[Auth Check] localStorage access blocked:', storageResult.error);
      console.log('[Auth Check] Relying on cookie-based authentication only');
    }
  }

  // Return true if cookies are present (reliable cross-domain method)
  // OR if localStorage indicates auth (works on localhost)
  return result.hasAuthCookie || result.hasAuthStorage;
}

/**
 * Get authentication tokens for debugging
 *
 * Returns all Supabase-related cookies and localStorage entries.
 * Useful for debugging authentication issues.
 *
 * @param page - Playwright page object
 * @returns Promise<AuthTokens> - Object containing cookies and storage
 */
export async function getAuthTokens(page: Page): Promise<AuthTokens> {
  // Get cookies using Playwright API (can see HTTP-only cookies)
  const playwrightCookies = await page.context().cookies();
  const cookies = playwrightCookies
    .filter(c => c.name.startsWith('sb-'))
    .map(c => `${c.name}=${c.value}`);

  // Get localStorage entries
  // Note: This may fail due to cross-origin security restrictions on external domains
  const storage = await page.evaluate(() => {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .map(k => ({ key: k, value: localStorage.getItem(k) }));
    } catch (error) {
      // localStorage access blocked - return empty array with warning
      console.warn('[Auth] localStorage access blocked, using cookies only');
      return [];
    }
  });

  return { cookies, storage };
}

/**
 * Wait for authentication to complete after login submission
 *
 * Polls the page for Supabase auth tokens until they appear or timeout.
 * This is necessary because PKCE flow authentication involves redirects
 * and URL parameter parsing that may take time to complete.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 * @throws Error if authentication does not complete within timeout
 */
export async function waitForAuthCompletion(page: Page, timeout = 10000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  console.log('[Auth] Waiting for authentication to complete...');

  while (Date.now() - startTime < timeout) {
    const isAuthed = await verifySupabaseAuth(page);

    if (isAuthed) {
      const elapsed = Date.now() - startTime;
      console.log(`[Auth] ✓ Authentication completed successfully in ${elapsed}ms`);
      return;
    }

    await page.waitForTimeout(pollInterval);
  }

  // Authentication failed - get debug info
  const tokens = await getAuthTokens(page);
  console.error('[Auth] Authentication timeout - no tokens found:', tokens);

  throw new Error(
    `Authentication did not complete within ${timeout}ms. ` +
    `Found ${tokens.cookies.length} cookies and ${tokens.storage.length} storage entries.`
  );
}

/**
 * Check if the current page has authentication
 *
 * Simple wrapper around verifySupabaseAuth for readability in tests.
 *
 * @param page - Playwright page object
 * @returns Promise<boolean> - true if authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await verifySupabaseAuth(page);
}

/**
 * Log authentication state for debugging
 *
 * Prints detailed information about current authentication state,
 * including all cookies and localStorage entries.
 *
 * @param page - Playwright page object
 * @param label - Optional label for the log message
 */
export async function logAuthState(page: Page, label = 'Auth State'): Promise<void> {
  const tokens = await getAuthTokens(page);
  const isAuth = await verifySupabaseAuth(page);

  console.log(`\n[${label}]`);
  console.log(`  Authenticated: ${isAuth}`);
  console.log(`  Cookies (${tokens.cookies.length}):`);
  tokens.cookies.forEach(cookie => {
    // Mask the token value for security
    const [name] = cookie.split('=');
    console.log(`    - ${name}=[REDACTED]`);
  });
  console.log(`  Storage (${tokens.storage.length}):`);
  tokens.storage.forEach(({ key }) => {
    console.log(`    - ${key}=[REDACTED]`);
  });
  console.log('');
}

/**
 * Wait for Supabase session to be established
 *
 * Checks for the presence of a valid Supabase session in localStorage.
 * This is more thorough than just checking for auth tokens, as it
 * verifies that the session object is properly structured.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 * @throws Error if session is not established within timeout
 */
export async function waitForSupabaseSession(page: Page, timeout = 10000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  console.log('[Auth] Waiting for Supabase session to be established...');

  while (Date.now() - startTime < timeout) {
    // Try localStorage first, but gracefully fall back to cookie check if blocked
    const hasSession = await page.evaluate(() => {
      try {
        // Check for Supabase session in localStorage
        const keys = Object.keys(localStorage);
        const sessionKey = keys.find(k => k.startsWith('sb-') && k.includes('auth-token'));

        if (!sessionKey) return false;

        try {
          const sessionData = localStorage.getItem(sessionKey);
          if (!sessionData) return false;

          const parsed = JSON.parse(sessionData);
          return parsed && parsed.access_token && parsed.refresh_token;
        } catch {
          return false;
        }
      } catch (error) {
        // localStorage blocked - this is OK, cookies are sufficient
        // Return false here to allow cookie-based verification below
        return false;
      }
    });

    // If localStorage check passed, we're good
    if (hasSession) {
      const elapsed = Date.now() - startTime;
      console.log(`[Auth] ✓ Supabase session established in ${elapsed}ms`);
      return;
    }

    // If localStorage is blocked, rely on cookie-based auth verification
    const hasAuthCookies = await verifySupabaseAuth(page);
    if (hasAuthCookies) {
      const elapsed = Date.now() - startTime;
      console.log(`[Auth] ✓ Authentication verified via cookies in ${elapsed}ms (localStorage unavailable)`);
      return;
    }

    await page.waitForTimeout(pollInterval);
  }

  throw new Error(`Supabase session was not established within ${timeout}ms`);
}

/**
 * Ensure user is authenticated, throw error if not
 *
 * Use this in test beforeEach hooks to ensure tests that require
 * authentication fail fast with a clear error message.
 *
 * @param page - Playwright page object
 * @throws Error if user is not authenticated
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  const isAuth = await isAuthenticated(page);

  if (!isAuth) {
    throw new Error(
      'Test requires authentication but user is not authenticated. ' +
      'The auth state may be invalid or expired. ' +
      'Run: npm run test:e2e:auth:reset && npm run test:e2e:setup'
    );
  }
}

/**
 * Get Supabase project reference from auth tokens
 *
 * Extracts the project reference from Supabase auth token cookie names.
 * This is useful for debugging environment-specific issues.
 *
 * @param page - Playwright page object
 * @returns Promise<string | null> - Project reference or null if not found
 */
export async function getSupabaseProjectRef(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('sb-') && c.includes('auth-token'));

    if (!authCookie) return null;

    // Extract project ref from cookie name: sb-{project-ref}-auth-token.0
    const match = authCookie.match(/^sb-([^-]+)-auth-token/);
    return match ? match[1] : null;
  });
}
