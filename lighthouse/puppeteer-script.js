/**
 * Puppeteer script for Lighthouse CI authenticated testing
 *
 * Uses programmatic Supabase API authentication + cookie injection
 * instead of fragile UI-based login. This is deterministic, fast,
 * and eliminates all UI interaction fragility.
 *
 * Required environment variables:
 * - LIGHTHOUSE_TEST_EMAIL: Test user email
 * - LIGHTHOUSE_TEST_PASSWORD: Test user password
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon/publishable key
 */

const BASE_URL = 'http://localhost:3000';
const MAX_CHUNK_SIZE = 3180;

/**
 * Mirrors @supabase/ssr createChunks() — splits a cookie value into
 * chunks that fit within browser cookie size limits.
 */
function createChunks(key, value) {
  let encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= MAX_CHUNK_SIZE) {
    return [{ name: key, value }];
  }
  const chunks = [];
  while (encodedValue.length > 0) {
    let encodedChunkHead = encodedValue.slice(0, MAX_CHUNK_SIZE);
    const lastEscapePos = encodedChunkHead.lastIndexOf('%');
    if (lastEscapePos > MAX_CHUNK_SIZE - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }
    let valueHead = '';
    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunkHead.at(-3) === '%' &&
          encodedChunkHead.length > 3
        ) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
        } else {
          throw error;
        }
      }
    }
    chunks.push(valueHead);
    encodedValue = encodedValue.slice(encodedChunkHead.length);
  }
  return chunks.map((v, i) => ({ name: `${key}.${i}`, value: v }));
}

/**
 * @param {import('puppeteer').Browser} browser
 * @param {{url: string, options: object}} context
 */
module.exports = async (browser, context) => {
  const page = await browser.newPage();

  try {
    const testEmail = process.env.LIGHTHOUSE_TEST_EMAIL;
    const testPassword = process.env.LIGHTHOUSE_TEST_PASSWORD;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Validate all required env vars
    const missing = [];
    if (!testEmail) missing.push('LIGHTHOUSE_TEST_EMAIL');
    if (!testPassword) missing.push('LIGHTHOUSE_TEST_PASSWORD');
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (missing.length > 0) {
      throw new Error(
        `[Lighthouse Auth] FATAL: Missing environment variables: ${missing.join(', ')}. ` +
        'Cannot run authenticated Lighthouse tests without these.'
      );
    }

    // Mask email for security — only show domain in logs
    const emailDomain = testEmail.split('@')[1] || 'unknown';
    console.log(`[Lighthouse Auth] Test email: ***@${emailDomain}`);

    // Early-exit: check if existing cookies from a prior URL run are still valid.
    // LHCI calls this script once per URL (6 URLs), so this avoids redundant API calls.
    console.log('[Lighthouse Auth] Checking for existing auth session...');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {
      console.log('[Lighthouse Auth] Network idle timeout during session check, proceeding');
    });

    const currentUrl = page.url();
    if (!currentUrl.includes('/auth/sign-in') && !currentUrl.includes('/login')) {
      console.log('[Lighthouse Auth] ✅ Login successful (existing session still valid)');
      await page.close();
      return;
    }

    console.log('[Lighthouse Auth] No valid session found, authenticating via API...');

    // Parse Supabase URL once to normalize (handles trailing slashes)
    const parsedSupabaseUrl = new URL(supabaseUrl);
    const projectRef = parsedSupabaseUrl.hostname.split('.')[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const authEndpoint = new URL('/auth/v1/token?grant_type=password', parsedSupabaseUrl).href;

    // Authenticate via Supabase REST API with retry + exponential backoff
    let session = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(authEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ email: testEmail, password: testPassword }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        session = await response.json();
        console.log(`[Lighthouse Auth] API auth succeeded on attempt ${attempt}`);
        break;
      } catch (err) {
        console.log(`[Lighthouse Auth] API auth attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt === maxRetries) {
          throw new Error(`[Lighthouse Auth] AUTHENTICATION FAILED after ${maxRetries} attempts: ${err.message}`);
        }
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    // Encode session as base64url cookie value (matches @supabase/ssr v0.7.0 default cookieEncoding: "base64url")
    const sessionJson = JSON.stringify(session);
    const cookieValue = 'base64-' + Buffer.from(sessionJson, 'utf-8').toString('base64url');
    console.log(`[Lighthouse Auth] Cookie value length: ${cookieValue.length} chars`);

    // Self-check: verify the cookie can be decoded back to valid JSON with access_token
    try {
      const decoded = Buffer.from(cookieValue.replace('base64-', ''), 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (!parsed.access_token) {
        throw new Error('Decoded session is missing access_token');
      }
      console.log(`[Lighthouse Auth] Self-check passed: cookie decodes to valid session with access_token`);
    } catch (err) {
      throw new Error(`[Lighthouse Auth] Self-check FAILED: Cookie encoding is invalid (${err.message})`);
    }

    // Direct API verification: confirm the access_token is valid before relying on middleware
    try {
      const userEndpoint = new URL('/auth/v1/user', parsedSupabaseUrl).href;
      const userResponse = await fetch(userEndpoint, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!userResponse.ok) {
        const errorBody = await userResponse.text();
        throw new Error(`User verification failed: HTTP ${userResponse.status} ${errorBody}`);
      }
      const userData = await userResponse.json();
      const userDomain = userData.email?.split('@')[1] || 'unknown';
      console.log(`[Lighthouse Auth] Direct API verification passed: user ***@${userDomain}`);
    } catch (err) {
      throw new Error(`[Lighthouse Auth] Token verification FAILED: ${err.message}`);
    }

    // Chunk the cookie if it exceeds browser size limits (mirrors @supabase/ssr createChunks)
    const chunks = createChunks(cookieName, cookieValue);
    console.log(`[Lighthouse Auth] Chunked into ${chunks.length} piece(s): ${chunks.map(c => c.name).join(', ')}`);

    // Navigate to home page to establish the localhost origin before setting cookies.
    // page.setCookie() with domain:'localhost' can be unreliable in headless Chromium on Linux;
    // document.cookie from the correct origin is the most portable approach.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Set cookies via document.cookie in the browser context.
    // This is more reliable than page.setCookie() + domain:'localhost' in headless CI environments.
    for (const chunk of chunks) {
      await page.evaluate(({ name, value }) => {
        document.cookie = `${name}=${value}; path=/; samesite=lax; max-age=${400 * 24 * 60 * 60}`;
      }, { name: chunk.name, value: chunk.value });
    }

    // Verify cookies were actually stored in the browser
    const storedCookies = await page.cookies(BASE_URL);
    const authCookies = storedCookies.filter(c =>
      c.name === cookieName || c.name.startsWith(cookieName + '.')
    );
    console.log(`[Lighthouse Auth] Verified ${authCookies.length} auth cookie(s) in browser: ${authCookies.map(c => `${c.name} (${c.value.length} chars)`).join(', ')}`);

    if (authCookies.length === 0) {
      // Fallback: try page.setCookie() with url parameter
      console.log('[Lighthouse Auth] document.cookie failed, trying page.setCookie fallback...');
      for (const chunk of chunks) {
        await page.setCookie({
          name: chunk.name,
          value: chunk.value,
          url: BASE_URL,
          path: '/',
          sameSite: 'Lax',
          httpOnly: false,
        });
      }
      const fallbackCookies = await page.cookies(BASE_URL);
      const fallbackAuth = fallbackCookies.filter(c =>
        c.name === cookieName || c.name.startsWith(cookieName + '.')
      );
      console.log(`[Lighthouse Auth] Fallback: ${fallbackAuth.length} auth cookie(s) stored`);
    }

    // Verify: navigate to /profile and confirm no redirect to sign-in.
    // Capture the response to get HTTP status if auth fails.
    const verifyResponse = await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {
      console.log('[Lighthouse Auth] Network idle timeout during verification, proceeding');
    });

    const verifyUrl = page.url();
    // Middleware redirects unauthenticated users to /auth/sign-in; /login is a defensive fallback
    if (verifyUrl.includes('/auth/sign-in') || verifyUrl.includes('/login')) {
      // Debug: dump all cookies to help diagnose
      const debugCookies = await page.cookies(BASE_URL);
      const debugAuth = debugCookies.filter(c => c.name.startsWith('sb-'));
      console.log(`[Lighthouse Auth] Debug: ${debugAuth.length} sb-* cookies after redirect: ${debugAuth.map(c => c.name).join(', ')}`);

      const httpStatus = verifyResponse ? verifyResponse.status() : 'unknown';

      throw new Error(
        `[Lighthouse Auth] AUTHENTICATION FAILED: Redirected to sign-in page (${verifyUrl}) after cookie injection. ` +
        `HTTP Status: ${httpStatus}. ` +
        `Cookies found: ${debugAuth.length}. Cookie may not be in the expected format.`
      );
    }

    console.log('[Lighthouse Auth] ✅ Login successful, authenticated session ready');
    console.log(`[Lighthouse Auth] Current URL after auth: ${verifyUrl}`);
  } finally {
    await page.close();
  }
};
