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

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
