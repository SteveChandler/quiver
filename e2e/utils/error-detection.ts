import { Page, expect, BrowserContext } from '@playwright/test';

/**
 * Error Detection Utilities for E2E Tests
 *
 * These utilities ensure tests FAIL when errors are visible on screen,
 * rather than passing silently while users see broken pages.
 */

export interface ErrorCapture {
  consoleErrors: string[];
  networkErrors: { url: string; status: number; statusText: string }[];
  visibleErrors: string[];
}

/**
 * Error selectors that indicate something went wrong on the page
 * Add more selectors as you discover new error patterns
 */
const ERROR_SELECTORS = [
  // Generic error indicators
  '[data-testid="error"]',
  '[data-testid="error-message"]',
  '[data-testid="error-boundary"]',
  '[role="alert"]',

  // Toast/notification errors
  '[data-sonner-toast][data-type="error"]',
  '.toast-error',
  '.Toastify__toast--error',

  // Error text patterns (use carefully - these can match false positives)
  // Note: Avoid overly broad patterns like "Unable to load" - they catch graceful degradation
  'text=/Something went wrong/i',
  'text=/Error:/i',
  'text=/An error occurred/i',
  'text=/500 Internal Server Error/i',
  'text=/404 Not Found/i',
  'text=/503 Service Unavailable/i',

  // Next.js error overlay
  '#nextjs__container_errors_label',
  '[data-nextjs-dialog]',
];

/**
 * Set up error detection for a page
 * Call this in beforeEach to automatically capture errors throughout the test
 */
export function setupErrorDetection(page: Page): ErrorCapture {
  const capture: ErrorCapture = {
    consoleErrors: [],
    networkErrors: [],
    visibleErrors: [],
  };

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out noisy errors that aren't real problems
      if (!isIgnorableConsoleError(text)) {
        capture.consoleErrors.push(text);
      }
    }
  });

  // Capture unhandled page errors (apply same ignorable filter as console errors)
  page.on('pageerror', (error) => {
    const errorText = `Uncaught: ${error.message}`;
    if (!isIgnorableConsoleError(errorText)) {
      capture.consoleErrors.push(errorText);
    }
  });

  // Capture network errors (4xx, 5xx responses)
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    // Skip assets and expected 404s for optional resources
    if (status >= 400 && !isIgnorableNetworkError(url, status)) {
      capture.networkErrors.push({
        url,
        status,
        statusText: response.statusText(),
      });
    }
  });

  return capture;
}

/**
 * Check for visible errors on the page
 * Returns array of visible error messages
 */
export async function getVisibleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  for (const selector of ERROR_SELECTORS) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const isVisible = await element.isVisible().catch(() => false);

        if (isVisible) {
          const text = await element.textContent().catch(() => null);
          if (text?.trim()) {
            // Filter out false positives - [role="alert"] that are just page titles/headings
            const textContent = text.trim();

            // Skip if it's just a page title (contains " | Quiver" or is very short)
            if (textContent.includes(' | Quiver') || textContent.length < 15) {
              continue;
            }

            // Skip if it doesn't contain error-indicating words
            const errorWords = /error|failed|unable|problem|issue|wrong|invalid|denied|unauthorized|forbidden|not found|unavailable|timeout/i;
            if (selector === '[role="alert"]' && !errorWords.test(textContent)) {
              continue;
            }

            // Skip rate-limiting (429) alerts — infrastructure protection, not application bugs.
            // These appear when test workers saturate API rate limits during parallel test runs.
            if (selector === '[role="alert"]' && /429/.test(textContent)) {
              continue;
            }

            errors.push(`[${selector}]: ${textContent.substring(0, 200)}`);
          }
        }
      }
    } catch {
      // Selector might not be valid for this page, skip
    }
  }

  return errors;
}

/**
 * Assert no errors are present
 * Call this after actions to ensure no errors appeared
 */
export async function assertNoErrors(
  page: Page,
  capture: ErrorCapture,
  options: {
    checkConsole?: boolean;
    checkNetwork?: boolean;
    checkVisible?: boolean;
    context?: string;
    /** HTTP status codes to ignore in network error checks (e.g., [400] for negative tests) */
    allowedStatuses?: number[];
  } = {}
): Promise<void> {
  const {
    checkConsole = true,
    checkNetwork = true,
    checkVisible = true,
    context = 'Page',
    allowedStatuses = [],
  } = options;

  const problems: string[] = [];

  const placeholderImageNetworkErrors = capture.networkErrors.filter((err) =>
    isPlaceholderImageProxyFailure(err.url, err.status)
  );
  const localAuthRefreshNetworkErrors = capture.networkErrors.filter((err) =>
    isLocalAuthRefreshFailure(err.url, err.status)
  );
  const filteredConsoleErrors = capture.consoleErrors.filter((err) => {
    // When placeholder images are blocked upstream, Chromium logs a generic
    // "Failed to load resource: ... <status>" console error without the URL.
    // Ignore it only if we can corroborate with a known placeholder image failure.
    if (
      placeholderImageNetworkErrors.length > 0 &&
      /^Failed to load resource: the server responded with a status of (400|403|424)/.test(err)
    ) {
      return false;
    }
    // Local Supabase can return a transient 504 from refresh-token requests
    // when auth workers are saturated. Suppress the URL-less Chromium console
    // duplicate only when the matching local network response is present.
    if (
      localAuthRefreshNetworkErrors.length > 0 &&
      /^Failed to load resource: the server responded with a status of 504/.test(err)
    ) {
      return false;
    }
    return true;
  });

  const filteredNetworkErrors = capture.networkErrors.filter((err) => {
    if (isIgnorableNetworkError(err.url, err.status)) return false;
    if (isPlaceholderImageProxyFailure(err.url, err.status)) return false;
    if (allowedStatuses.includes(err.status)) return false;
    return true;
  });

  // Check visible errors
  if (checkVisible) {
    const visibleErrors = await getVisibleErrors(page);
    if (visibleErrors.length > 0) {
      problems.push(`\n📍 Visible Errors on Page:`);
      visibleErrors.forEach((err) => problems.push(`   - ${err}`));
    }
  }

  // Check console errors
  if (checkConsole && filteredConsoleErrors.length > 0) {
    problems.push(`\n🔴 Console Errors:`);
    filteredConsoleErrors.forEach((err) =>
      problems.push(`   - ${err.substring(0, 300)}`)
    );
  }

  // Check network errors
  if (checkNetwork && filteredNetworkErrors.length > 0) {
    problems.push(`\n🌐 Network Errors:`);
    filteredNetworkErrors.forEach((err) =>
      problems.push(`   - ${err.status} ${err.statusText}: ${err.url.substring(0, 100)}`)
    );
  }

  if (problems.length > 0) {
    // Take screenshot for debugging
    const timestamp = Date.now();
    const screenshotPath = `test-results/error-detected-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const errorMessage = [
      `\n❌ ${context} has errors!\n`,
      `📸 Screenshot: ${screenshotPath}`,
      `🔗 URL: ${page.url()}`,
      ...problems,
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Wait for page to load and assert no errors
 * Combines waitForPageLoad with error checking
 */
export async function waitForPageLoadWithErrorCheck(
  page: Page,
  capture: ErrorCapture,
  options: { timeout?: number; context?: string } = {}
): Promise<void> {
  const { timeout = 30000, context = 'Page load' } = options;

  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForLoadState('load', { timeout });
  // Bounded settle so the error assertion runs after in-flight data requests
  // resolve, not just after the load event. networkidle can hang on pages with
  // long-polling/realtime, so cap it and swallow the timeout.
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

  // eslint-disable-next-line playwright/no-wait-for-timeout -- brief delay to let error UI render before assertion
  await page.waitForTimeout(500);

  await assertNoErrors(page, capture, { context });
}

/**
 * Navigate to URL and assert no errors
 */
export async function gotoWithErrorCheck(
  page: Page,
  capture: ErrorCapture,
  url: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  // Clear previous errors before navigating
  capture.consoleErrors = [];
  capture.networkErrors = [];

  await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
  await waitForPageLoadWithErrorCheck(page, capture, { context: `Navigate to ${url}` });
}

/**
 * Click element and assert no errors appear after
 */
export async function clickWithErrorCheck(
  page: Page,
  capture: ErrorCapture,
  selector: string,
  description: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await page.locator(selector).click({ timeout });

  // eslint-disable-next-line playwright/no-wait-for-timeout -- brief delay to let error UI render after click
  await page.waitForTimeout(500);

  await assertNoErrors(page, capture, { context: `After clicking ${description}` });
}

// Helper: Ignorable console errors (noisy but not real problems)
function isIgnorableConsoleError(text: string): boolean {
  // Mapbox GL error events can stringify to their minified internal event
  // constructor in headless Chromium even when the map keeps rendering.
  if (/^Map error:\s+[A-Za-z_$][\w$]{0,2}$/.test(text.trim())) {
    return true;
  }

  const ignorable = [
    // React development warnings
    'Warning: ReactDOM.render is no longer supported',
    'Warning: Each child in a list',
    'Warning: validateDOMNesting',

    // Browser extensions
    'chrome-extension://',
    'moz-extension://',

    // Third-party scripts and network issues
    'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT', // Ad blockers
    'Failed to load resource: net::ERR_FAILED', // Generic network failures (CORS, blocked, etc.)
    'googletagmanager',
    'analytics',
    '/ingest/static/',
    '_vercel/insights',
    '_vercel/speed-insights',
    'facebook',

    // Hot reload in dev
    'Fast Refresh',
    '[HMR]',
    'webpack-hmr',
    'Failed to load chunk /_next/static/chunks/',
    '[turbopack]/browser/dev/hmr-client',
    // Local Next dev server can reset HMR/chunk sockets while compiling dynamic
    // routes. Route status and visible assertions still prove page rendering.
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_INCOMPLETE_CHUNKED_ENCODING',
    // Chromium can emit these during local context teardown/network transitions
    // without a URL; response listeners still catch real status-coded failures.
    'Failed to load resource: net::ERR_INTERNET_DISCONNECTED',
    'Failed to load resource: net::ERR_NETWORK_CHANGED',
    // Local auth hydration can race optional FavoriteButton background fetches
    // under high worker counts. The matching 401 is filtered only for localhost
    // in isIgnorableNetworkError; this suppresses the URL-less console duplicate.
    'FavoriteButton: failed to fetch favorites: Authentication required',
    // Profile gamification is an optional panel and can briefly request before
    // local auth hydration has finished under high worker counts.
    'Failed to load XP data',

    // Sentry noise
    'Sentry',

    // Service worker registration failures (optional feature)
    'Failed to register a ServiceWorker',
    'Failed to register service worker',
    'sw.js',
    'A bad HTTP response code (404) was received when fetching the script',

    // React hydration errors - can occur in dev/staging due to SSR timing
    'Minified React error #418',
    'Minified React error #423',
    'Minified React error #425',
    'Hydration failed',
    'hydrating',
    'A tree hydrated but',

    // React DOM nesting warnings (dev-mode only, not production errors)
    'cannot be a descendant of',
    'cannot contain a nested',

    // Image loading (handled gracefully)
    'Image optimization',

    // De-duplicate: Chrome logs a generic "Failed to load resource: ..." console
    // error for every 4xx/5xx, but WITHOUT the URL. The actual status+URL is
    // already captured by the networkErrors array (via the 'response' listener).
    // We suppress the console duplicate here so it doesn't double-report.
    // The 4xx/5xx IS still caught as a network error and WILL fail the test
    // unless the URL appears in `gracefulApis` (see isIgnorableNetworkError).
    'Failed to load resource: the server responded with a status of 400',
    'Failed to load resource: the server responded with a status of 401',
    'Failed to load resource: the server responded with a status of 500',
    // 404 console noise from optional fallback images (e.g., placeholder.svg in UserAvatar).
    // The network 404 is already suppressed for known optional resources; suppress the
    // corresponding console duplicate too.
    'Failed to load resource: the server responded with a status of 404',

    // Rate limiting (429) - infrastructure protection, not bugs
    // These can appear in different formats depending on the API handler
    'status of 429',
    'API error: 429',
    ': 429',

    // Coast pulse API errors - background data fetch that doesn't affect core functionality
    'coast pulse',
    'Failed to fetch coast pulse',

    // Nearby-beaches fetch is a "near me" enhancement that degrades gracefully
    // (the map still renders all beaches). A transient/aborted fetch during search
    // navigation logs this (hooks/use-beach-search.ts); not a core-functionality failure.
    'Error loading nearby beaches',

    // Mapbox CORS errors - occur in test environments, not production issues
    // These happen when Mapbox API requests are blocked by CORS policy in headless browsers
    'api.mapbox.com',
    'CORS policy',
    'blocked by CORS',
    'mapbox',
    // WebGL initialization failures - headless Chromium may lack GPU support
    'Failed to initialize WebGL',
    'Map component error',

    // Framer Motion dev-mode warning thrown as pageerror in headless Chromium.
    // The spring animation on level buttons uses 3-keyframe shorthand (scale: [1,1.03,1])
    // which framer-motion logs as an error in dev but handles gracefully in production.
    // This does not affect component functionality or test validity.
    'Only two keyframes currently supported with spring and inertia animations',

    // Google Sign-In (GSI / Google One Tap) errors in headless CI environments.
    // No Google account is available in headless Chromium, so these are expected:
    // - "Provider's accounts list is empty." (no signed-in Google user)
    // - "[GSI_LOGGER]: FedCM get() rejects with NetworkError" (FedCM token fetch fails)
    // - "Error retrieving a token." (FedCM token fetch fails without an account)
    "Provider's accounts list is empty",
    'Not signed in with the identity provider.',
    'Error retrieving a token.',
    '[GSI_LOGGER]',
  ];

  return ignorable.some((pattern) => text.includes(pattern));
}

// Helper: Ignorable network errors
function isIgnorableNetworkError(url: string, status: number): boolean {
  // 429 (Rate Limit) errors are infrastructure protection, not application bugs
  // These occur when running multiple tests against rate-limited APIs
  if (status === 429) {
    return true;
  }

  if (isLocalAuthRefreshFailure(url, status)) {
    return true;
  }

  // Mapbox API errors - CORS issues in test environments are not production bugs
  // These occur when headless browsers have different CORS handling
  if (url.includes('api.mapbox.com') || url.includes('mapbox.com')) {
    return true;
  }

  // Google Sign-In status/FedCM endpoints can return 403 in headless browsers
  // without a signed-in Google account. Console GSI noise is filtered above;
  // keep the matching network response in the same expected-noise bucket.
  if (
    (status === 400 || status === 403) &&
    (url.includes('accounts.google.com/gsi') ||
      url.includes('accounts.google.com/o/fedcm'))
  ) {
    return true;
  }

  // 400/401 errors on graceful degradation APIs (personalization features)
  // These APIs fail gracefully when user is not authenticated or data is unavailable
  if (status === 400 || status === 401) {
    const gracefulApis = [
      '/api/beach/personalized-score',
      '/api/user/beach-affinity',
      '/api/alerts/rules', // BeachAlertCta is rendered as anon sign-up CTA; rules fetch is skip:!user-gated but a single fetch may surface before useAuth() hydrates
    ];
    if (gracefulApis.some(api => url.includes(api))) {
      return true;
    }

    if (status === 401 && isLocalhostUrl(url)) {
      const localAuthHydrationApis = [
        '/api/beaches/favorites',
        '/api/surf/call',
        '/api/surf/discover',
        '/api/gamification/xp-status',
        '/api/gamification/user-badges',
        '/api/gamification/badge-definitions',
      ];

      if (localAuthHydrationApis.some(api => url.includes(api))) {
        return true;
      }
    }
  }

  // Analytics/tracking API errors - background operations that don't affect user experience
  // These should never block tests as they're non-essential functionality
  if (
    url.includes('/api/events') ||
    url.includes('/api/embed-impressions') ||
    url.includes('/ingest/array') ||
    url.includes('/ingest/static/')
  ) {
    return true;
  }

  // 404s for optional resources
  if (status === 404) {
    const optional = [
      '/favicon.ico',
      '/manifest.json',
      '/robots.txt',
      '.map', // Source maps
      'analytics',
      '_vercel/insights',
      '_vercel/speed-insights',
      'gtm',
      'facebook',
      '/sw.js', // Service worker is optional
      'placeholder.svg', // UserAvatar fallback image — not a real resource
      '/api/hls-proxy/', // Optional live-cam HLS manifests can be unavailable in local fixtures
      'embed.cdn-surfline.com', // Optional third-party cam embeds can 404 in local/prod-like test fixtures
    ];
    return optional.some((pattern) => url.includes(pattern));
  }

  // 400 errors on root URL (no path) are often infrastructure-related
  // (e.g., Vercel edge requests, prefetch failures, etc.)
  if (status === 400) {
    try {
      const parsedUrl = new URL(url);
      // If the URL has no path (just origin + trailing slash) or is missing path info
      if (parsedUrl.pathname === '/' && !parsedUrl.search) {
        return true;
      }
    } catch {
      // If URL parsing fails, check if it's just a bare domain
      if (url.match(/^https?:\/\/[^/]+\/?$/)) {
        return true;
      }
    }
  }

  return false;
}

function isLocalAuthRefreshFailure(url: string, status: number): boolean {
  return (
    status === 504 &&
    isLocalhostUrl(url) &&
    url.includes('/auth/v1/token') &&
    url.includes('grant_type=refresh_token')
  );
}

function isLocalhostUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isPlaceholderImageProxyFailure(url: string, status: number): boolean {
  // External images are optional. Validation errors, failed dependencies, and
  // upstream timeouts all fall back to the product's placeholder treatment.
  if (status !== 400 && status !== 403 && status !== 424 && status !== 504) return false;

  const isNextImageOptimizer = url.includes('/_next/image?');
  const isImageProxyWrapped =
    url.includes('/api/image-proxy') || url.includes('api%2Fimage-proxy');

  // Ignore image proxy failures since they don't affect core functionality.
  // This includes:
  // - Placeholder images (placehold.co)
  // - External images that may be unavailable (Surfline, etc.)
  // These are graceful degradation scenarios, not test failures
  if (isNextImageOptimizer && isImageProxyWrapped) {
    return true;
  }

  // Also ignore direct image proxy requests that fail
  if (url.includes('/api/image-proxy')) {
    return true;
  }

  return false;
}

/**
 * Enhanced test setup hook
 * Use this to wrap your test.beforeEach
 *
 * @example
 * let errorCapture: ErrorCapture;
 *
 * test.beforeEach(async ({ page }) => {
 *   errorCapture = setupErrorDetection(page);
 * });
 *
 * test.afterEach(async ({ page }) => {
 *   await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
 * });
 */
