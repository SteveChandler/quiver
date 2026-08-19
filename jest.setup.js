// Import Jest DOM matchers
import "@testing-library/jest-dom";
import "jest-axe/extend-expect";
// Import whatwg-fetch for fetch polyfill
import "whatwg-fetch";

// Polyfill TextEncoder and TextDecoder
if (typeof TextEncoder === "undefined") {
  global.TextEncoder = require("util").TextEncoder;
}

if (typeof TextDecoder === "undefined") {
  global.TextDecoder = require("util").TextDecoder;
}

// Polyfill crypto.randomUUID for Node.js < 19
if (typeof crypto !== "undefined" && !crypto.randomUUID) {
  const nodeCrypto = require("crypto");
  crypto.randomUUID = nodeCrypto.randomUUID;
}

// Create a more robust mock for next/navigation
jest.mock("next/navigation", () => {
  const router = {
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    push: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
  };

  return {
    useRouter: () => router,
    usePathname: () => "/",
    useSearchParams: () => ({
      get: jest.fn((param) => null),
      getAll: jest.fn(() => []),
      has: jest.fn(() => false),
      forEach: jest.fn(),
      entries: jest.fn(() => []),
      keys: jest.fn(() => []),
      values: jest.fn(() => []),
      toString: jest.fn(() => ""),
    }),
    useParams: jest.fn(() => ({})),
    useSelectedLayoutSegment: jest.fn(() => null),
    useSelectedLayoutSegments: jest.fn(() => []),
    // Server navigation helpers used by App Router pages.
    // We throw with the same `digest` markers Next uses so tests can assert behavior.
    redirect: jest.fn((url) => {
      const err = new Error(`NEXT_REDIRECT: ${url}`);
      err.digest = "NEXT_REDIRECT";
      throw err;
    }),
    permanentRedirect: jest.fn((url) => {
      const err = new Error(`NEXT_REDIRECT: ${url}`);
      err.digest = "NEXT_REDIRECT";
      throw err;
    }),
    notFound: jest.fn(() => {
      const err = new Error("NEXT_NOT_FOUND");
      err.digest = "NEXT_NOT_FOUND";
      throw err;
    }),
  };
});

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Provide a default mock for fs/promises.readFile so tests can control with mockResolvedValue
// Provide a default mock for fs/promises.readFile so tests can control with mockResolvedValue
// Intentionally not mocking fs/promises here; individual tests control it

// Mock Auth Context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  })),
}));

// Mock RealtimeClient globally to prevent initialization errors
jest.mock("@supabase/realtime-js", () => ({
  RealtimeClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  })),
}));

// Mock for server actions
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true, data: {} }),
    text: () => Promise.resolve(JSON.stringify({ success: true, data: {} })),
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Map(),
  })
);

// Some tests intentionally `delete global.fetch` (eg. to simulate environments without fetch).
// Ensure later tests don't inherit a missing fetch implementation.
const __mockedFetch = global.fetch;
afterEach(() => {
  if (typeof global.fetch === "undefined") {
    global.fetch = __mockedFetch;
  }
});

// Polyfill Request and Response for Node.js environment
if (typeof Request === "undefined") {
  global.Request = class Request {
    constructor(url, options = {}) {
      this._url = url;
      this.method = options.method || "GET";
      this.headers = new Map(Object.entries(options.headers || {}));
      this.body = options.body || null;
    }

    get url() {
      return this._url;
    }

    async json() {
      return JSON.parse(this.body);
    }
  };
}

if (typeof Response === "undefined") {
  global.Response = class Response {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Map(Object.entries(options.headers || {}));
    }

    async json() {
      return JSON.parse(this.body);
    }

    async text() {
      return String(this.body);
    }

    static json(body, options = {}) {
      const str = typeof body === "string" ? body : JSON.stringify(body);
      return new global.Response(str, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
    }
  };
}

// Polyfill for IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Polyfill for ResizeObserver (needed by Radix UI components)
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Polyfill for matchMedia used by responsive hooks/components
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Polyfill for hasPointerCapture (needed by Radix UI components)
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();

  // Polyfill for scrollIntoView (needed by Radix UI components)
  Element.prototype.scrollIntoView = jest.fn();
}

// Mock scrollTo to prevent jsdom warnings
if (typeof window !== "undefined") {
  window.scrollTo = jest.fn();
}

// --- Fail-on-unexpected-console strategy ---
// Instead of blanket suppression, track unexpected console.error/warn calls
// and fail tests that produce them.  Tests that intentionally trigger errors
// should use the `expectConsoleErrors` / `expectConsoleWarnings` helpers from
// test-utils.tsx.

const ALLOWED_CONSOLE_PATTERNS = [
  // ── jsdom / Node.js environment ──
  /Not implemented: navigation/,
  /The `punycode` module is deprecated/,
  /localStorage not available/,

  // ── React internals & DOM warnings ──
  /inside a test was not wrapped in act/,
  /React\.createElement is no longer supported/,
  /ReactDOM\.render is no longer supported/,
  /was passed to the .* attribute/,             // empty-string attribute warnings
  /for a non-boolean attribute/,                // non-boolean prop warnings
  /cannot be a descendant of/,                  // DOM nesting violations
  /Encountered two children with the same key/, // duplicate key warnings
  /requires a .* for the component to be accessible/, // Radix a11y warnings (DialogTitle etc.)
  /React does not recognize the .* prop on a DOM element/, // unknown DOM prop warnings
  /is unrecognized in this browser/,            // unrecognized HTML tag warnings
  /cannot contain a nested/,                    // HTML nesting warnings
  /ReactDOMTestUtils\.act.*is deprecated/,      // React test utils deprecation
  /suspended resource finished loading.*not wrapped in act/, // React suspense in tests

  // ── Radix UI / component library ──
  /Missing `Teleport` component context/,
  /Missing.*Description/,                        // Radix Dialog description warnings
  /Missing.*aria-describedby/,                   // Radix Dialog aria warnings

  // ── Error-handling test output (code under test logs before returning) ──
  // These cover the vast majority of intentional error-path tests.
  // Phase 2 should migrate each test to use `expectConsoleErrors([/pattern/])`
  // so these broad patterns can be removed.
  /Server action error:/,
  /Admin server action error:/,
  /API Error:/,
  /\[ForecastError\]/,
  /\[getSpotSurfReportPublic\]/,
  /\[CDIPApiClient\]/,
  /\[CDIP\] Failed/,
  /Error processing invitee/,
  /Error (creating|checking|fetching|getting|loading|updating|marking|refreshing|in )/,
  /Error (toggling|submitting|searching|removing|inserting|deleting|casting|analyzing)/,
  /Failed to fetch/,
  /Failed to (load|parse|update|save|log|credit|check|remove)/,
  /Error .* invitation/,
  /selectIntelVoteCounts/,
  /Stack trace: /,                              // error handler stack traces
  /supabase\.from\(.*\).*is not a function/,    // mock chain errors in error-path tests
  /writeClient\.from\(.*\).*is not a function/, // write client mock chain errors
  /serviceSupabase\.from\(.*\).*is not a function/,
  /Database error:/,
  /Device (token |upsert|deletion)/,
  /Supabase error in/,
  /Unhandled error type:/,
  /Unexpected error in/,
  /Tide data fetch error/,
  /Unauthorized preference update/,
  /\[AuthValidator\]/,
  /Service role client error/,
  /Scorer .* threw error/,
  /Profile update error/,
  /nearest_beaches RPC failed/,
  /Nearest beach lookup failed/,
  /Live NDBC fetch error/,
  /In-app notification records failed/,
  /Exception refreshing session/,
  /\[welcome-email\]/,
  /\[test-email\]/,
  /\[send-welcome-email\]/,
  /\[session-prompt-email\]/,
  /\[reengagement-email\]/,
  /\[conditions-alert-email\]/,
  /\[factory-tag\]/,
  /\[custom-context\]/,
  /\[RateLimit:/,
  /\[CRITICAL\] RPC/,
  /recovery-test:/,
  /Failed to query eligible users/,
  /\[getLocalDateString\]/,
  /failures encountered:/,
  /- User .+: /,                                // cron job per-user error logging

  // ── Warning-level output from error-path tests ──
  /\[SurfDiscoveryOrchestrator\]/,
  /Beach missing required URL components/,
  /\[FALLBACK:/,
  /\[useGeolocation\]/,
  /\[onboarding\]/,
  /\[Sentry Cron\]/,
  /\[cam-resolve\]/,
  /\[hls-proxy\]/,
  /\[LogDisplayPrediction\]/,
  /GoTrueClient.*Multiple GoTrueClient instances/,
  /limit exceeded/,
  /must be authenticated/,
  /No coordinates provided/,
  /Blocked duplicate/,
  /\[SEO Redirect\]/,
  /Profiles lookup failed/,
  /Wave height batch .* failed/,
  /Invalid coordinates provided/,
  /\[CDIPService\]/,
  /\[CDIPDataParser\]/,
  /\[NOAACOOPS\]/,
  /\[NOAA\]/,
  /\[IOOS\]/,
  /\[DataSourceManager\]/,
  /\[DEGRADED\]/,
  /\[getLocationPageData\]/,
  /\[resend-webhook\]/,
  /GoalsSection:.*undefined/,
  /get_beaches_by_location.*returned object/,
  /Error merging ML corrections/,
  /getFreshForecastFromCache/,
  /\[EnhancedForecastService\]/,
  /Network request returned null/,

  // ── Supabase client initialization (CI has no env vars) ──
  /\[createServerClient\] Supabase configuration missing/,
  /\[createServiceRoleClient\] Supabase service role configuration missing/,
  /Supabase URL or Anon Key is missing/,

  // ── v5 shadow calibration: in tests the global fetch mock returns
  //    {success: true, data: {}}, which the calibration loader correctly
  //    rejects as a malformed row. Production never hits this path.
  /\[CalibrationV5\] getActiveCalibration: active row is malformed/,
  /\[CalibrationV5\] getActiveCalibration: query failed/,
  /\[CalibrationV5\] getActiveCalibration: no active calibration version/,
  /\[CalibrationV5\] getActiveCalibration: unexpected error/,
  /\[CalibrationV5\] getActiveCalibration: SUPABASE_SERVICE_ROLE_KEY not configured/,
  /\[CalibrationV5\] computeV5Shadow: unexpected error/,
];

function isAllowed(args) {
  const message = args.map(String).join(" ");
  return ALLOWED_CONSOLE_PATTERNS.some((p) => p.test(message));
}

const _originalError = console.error;
const _originalWarn = console.warn;

// Expose tracking arrays globally so test-utils helpers can access them
globalThis.__quiverConsoleErrors = [];
globalThis.__quiverConsoleWarns = [];

beforeEach(() => {
  globalThis.__quiverConsoleErrors = [];
  globalThis.__quiverConsoleWarns = [];

  console.error = (...args) => {
    if (!isAllowed(args)) {
      globalThis.__quiverConsoleErrors.push(args.map(String).join(" "));
    }
    // Still print so developers see the output when debugging
    _originalError.apply(console, args);
  };

  console.warn = (...args) => {
    if (!isAllowed(args)) {
      globalThis.__quiverConsoleWarns.push(args.map(String).join(" "));
    }
    _originalWarn.apply(console, args);
  };
});

afterEach(() => {
  // Restore originals
  console.error = _originalError;
  console.warn = _originalWarn;

  // If a test used expectConsoleErrors/expectConsoleWarnings, it already
  // asserted and cleared these arrays.  Only fail on truly unexpected output.
  if (globalThis.__quiverConsoleErrors.length > 0) {
    const summary = globalThis.__quiverConsoleErrors.slice(0, 3).join("\n  ");
    throw new Error(
      `Test produced ${globalThis.__quiverConsoleErrors.length} unexpected console.error(s):\n  ${summary}\n` +
      `If intentional, use expectConsoleErrors([/pattern/]) from test-utils.`
    );
  }
  if (globalThis.__quiverConsoleWarns.length > 0) {
    const summary = globalThis.__quiverConsoleWarns.slice(0, 3).join("\n  ");
    throw new Error(
      `Test produced ${globalThis.__quiverConsoleWarns.length} unexpected console.warn(s):\n  ${summary}\n` +
      `If intentional, use expectConsoleWarnings([/pattern/]) from test-utils.`
    );
  }
});

// Note: date-fns mocking is now done per-test-file as needed
// Global mocking of date-fns causes issues with named exports like 'format'
// Tests that need formatDistanceToNow mocked should do it in their own file

// Mock canvas module that jsdom tries to require but isn't installed
jest.mock("canvas", () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
}), { virtual: true });
