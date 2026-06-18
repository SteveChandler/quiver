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

export interface ServerSessionCheckResult {
  ok: boolean;
  status: number;
  hasSession: boolean;
  body: unknown | null;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }

  return String(error);
}

function isTransientSessionCheckError(error: unknown): boolean {
  return /\b(ECONNRESET|ECONNREFUSED|ECONNABORTED|socket hang up|connection reset|timeout|net::ERR_)/i.test(
    getErrorText(error)
  );
}

async function waitForRetryDelay(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
}

function isCheckSessionBody(
  body: unknown
): body is { hasSession?: boolean } {
  return typeof body === 'object' && body !== null && 'hasSession' in body;
}

function parseStoredAccessToken(value: string | null): string | null {
  if (!value) return null;

  try {
    const raw = value.startsWith('base64-')
      ? Buffer.from(value.slice('base64-'.length), 'base64').toString('utf8')
      : value;
    const parsed = JSON.parse(raw) as {
      access_token?: unknown;
      currentSession?: { access_token?: unknown };
    };
    const token = parsed.access_token ?? parsed.currentSession?.access_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function getStoredAccessToken(page: Page): Promise<string | null> {
  const state = await page.context().storageState();
  for (const origin of state.origins) {
    for (const item of origin.localStorage) {
      if (!item.name.startsWith('sb-') || !item.name.includes('auth-token')) {
        continue;
      }

      const token = parseStoredAccessToken(item.value);
      if (token) return token;
    }
  }

  return null;
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
 * Server-validated session check (authoritative).
 *
 * This calls our Next.js API route which validates the current cookies against
 * Supabase Auth via `supabase.auth.getUser()`. This catches stale/rotated tokens
 * that may still exist in cookies but are no longer accepted by Supabase/middleware.
 */
export async function checkServerSession(
  page: Page,
  options: { baseUrl?: string } = {}
): Promise<ServerSessionCheckResult> {
  const baseUrl = options.baseUrl?.replace(/\/$/, '');
  const url = baseUrl ? `${baseUrl}/api/auth/check-session` : '/api/auth/check-session';
  const accessToken = await getStoredAccessToken(page);
  const requestOptions = {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
  };

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.request.get(url, requestOptions);

      let body: unknown | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      const hasSession =
        response.ok() && isCheckSessionBody(body) && body.hasSession === true;

      return {
        ok: response.ok(),
        status: response.status(),
        hasSession,
        body,
      };
    } catch (error) {
      lastError = error;

      if (!isTransientSessionCheckError(error)) {
        throw error;
      }

      if (attempt < 2) {
        await waitForRetryDelay(attempt);
      }
    }
  }

  return {
    ok: false,
    status: 0,
    hasSession: false,
    body: { error: getErrorText(lastError) },
  };
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

    // eslint-disable-next-line playwright/no-wait-for-timeout -- polling interval for auth state verification
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

export async function loginAs(
  page: Page,
  email: string,
  password: string,
  baseURL: string
): Promise<void> {
  const baseUrlString = baseURL.replace(/\/$/, '');

  await page.goto(baseUrlString, { waitUntil: 'domcontentloaded', timeout: 30000 });

  try {
    await page.waitForSelector('body.js-loaded, body.authenticated', { timeout: 15000 });
  } catch {
    await page.waitForLoadState('load', { timeout: 15000 });
  }

  const isAlreadyAuth = await verifySupabaseAuth(page);
  if (isAlreadyAuth) {
    const serverCheck = await checkServerSession(page, { baseUrl: baseUrlString });
    if (serverCheck.hasSession) return;
  }

  const loginButton = page.getByRole('button', { name: /log in/i });
  let authDialogVisible = false;

  try {
    await loginButton.waitFor({ state: 'visible', timeout: 15000 });
    await loginButton.click({ force: true });
  } catch {
    await page.goto(`${baseUrlString}/auth/sign-in`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    authDialogVisible = true;
  }

  if (!authDialogVisible) {
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  }

  const emailButton = page
    .getByRole('button', { name: /continue with email|sign in with email/i })
    .first();
  const emailButtonVisible = await emailButton.isVisible().catch(() => false);

  if (emailButtonVisible) {
    await emailButton.click();
    await page.getByPlaceholder(/email/i).waitFor({ state: 'visible', timeout: 5000 });
  }

  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).last().click();

  await waitForAuthCompletion(page, 15000);

  const serverCheck = await checkServerSession(page, { baseUrl: baseUrlString });
  if (!serverCheck.hasSession) {
    const bodyPreview =
      serverCheck.body == null
        ? 'null'
        : JSON.stringify(serverCheck.body).slice(0, 500);
    throw new Error(
      `Server session validation failed after login. status=${serverCheck.status} body=${bodyPreview}`
    );
  }

  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 })
    .catch(() => undefined);
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

    // eslint-disable-next-line playwright/no-wait-for-timeout -- polling interval for auth state verification
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

  // Server-validate session (authoritative). Cookie presence alone is not enough.
  const serverCheck = await checkServerSession(page);
  if (!serverCheck.hasSession) {
    const bodyPreview =
      serverCheck.body == null ? 'null' : JSON.stringify(serverCheck.body).slice(0, 500);

    throw new Error(
      'Test requires authentication but the server session is invalid (stale/rotated tokens). ' +
        `check-session status=${serverCheck.status}. ` +
        `body=${bodyPreview}. ` +
        'Fix: npm run test:e2e:auth:reset && npm run test:e2e:setup'
    );
  }
}

/**
 * Read the authenticated user's id from the page context.
 *
 * Tries localStorage first (works on localhost). Falls back to decoding the
 * Supabase auth cookie via Playwright's cookie API — necessary when running
 * against external domains like dev.quiversurf.app where localStorage is blocked.
 *
 * Supabase SSR splits the session JSON across two chunked cookies:
 *   sb-{ref}-auth-token.0  → "base64-" + first half of base64(sessionJSON)
 *   sb-{ref}-auth-token.1  → second half of base64(sessionJSON)
 * Reassemble → base64-decode → parse → read user.id.
 */
export async function getCurrentUserId(page: Page): Promise<string | null> {
  // 1. Try localStorage (works on localhost)
  const fromStorage = await page.evaluate((): string | null => {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('sb-') && k.includes('auth-token')
      );
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const sub = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
          if (typeof sub === 'string') return sub;
        } catch {
          // continue
        }
      }
    } catch {
      // localStorage blocked — fall through to cookie method
    }
    return null;
  });

  if (fromStorage) return fromStorage;

  // 2. Decode the Supabase SSR chunked cookie (works cross-domain via Playwright API).
  const cookies = await page.context().cookies();
  const authCookies = cookies
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name)); // .0 before .1

  if (authCookies.length === 0) return null;

  try {
    // Strip the "base64-" prefix from chunk 0, concatenate remaining chunks.
    const raw = authCookies
      .map((c, i) => (i === 0 ? c.value.replace(/^base64-/, '') : c.value))
      .join('');
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    const sub = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
    if (typeof sub === 'string') return sub;
  } catch {
    // Could not decode
  }

  return null;
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
