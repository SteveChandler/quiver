// Import Jest DOM matchers
import "@testing-library/jest-dom";

// Polyfill TextEncoder and TextDecoder
if (typeof TextEncoder === "undefined") {
  global.TextEncoder = require("util").TextEncoder;
}

if (typeof TextDecoder === "undefined") {
  global.TextDecoder = require("util").TextDecoder;
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

// Mock Auth Context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  })),
}));

// Mock for server actions
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true, data: {} }),
    ok: true,
  })
);

// Polyfill Request and Response for Node.js environment
if (typeof Request === "undefined") {
  global.Request = class Request {
    constructor(url, options = {}) {
      this.url = url;
      this.method = options.method || "GET";
      this.headers = new Map(Object.entries(options.headers || {}));
      this.body = options.body || null;
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

// Polyfill for hasPointerCapture (needed by Radix UI components)
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();

  // Polyfill for scrollIntoView (needed by Radix UI components)
  Element.prototype.scrollIntoView = jest.fn();
}

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
