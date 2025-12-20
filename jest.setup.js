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

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Note: date-fns mocking is now done per-test-file as needed
// Global mocking of date-fns causes issues with named exports like 'format'
// Tests that need formatDistanceToNow mocked should do it in their own file

// Mock canvas module that jsdom tries to require but isn't installed
jest.mock("canvas", () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
}), { virtual: true });
