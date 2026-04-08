const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  globalSetup: "<rootDir>/jest.tz-setup.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  // Increase default test timeout to reduce flakiness with async/rendering tests
  testTimeout: 15000,
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/test-utils/",
    "<rootDir>/e2e/",
    // Exclude git worktrees - they have their own test runs
    "<rootDir>/.worktrees/",
    "<rootDir>/.claude/worktrees/",
    // Ignore internal mock modules stored next to tests
    "<rootDir>/__tests__/__mocks__/",
    "<rootDir>/__tests__/setup/",
    // Fixture modules are imported by tests but are not test suites
    "<rootDir>/__tests__/fixtures/",
    "/__fixtures__/",
    // Example-only test docs (not part of the suite)
    "<rootDir>/components/session/wizard/__tests__/",
    "<rootDir>/__tests__/performance/helpers/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Mock Supabase entirely for problematic component tests
    "^@/lib/supabase/client$": "<rootDir>/__tests__/setup/mock-supabase.ts",
    "^@/lib/supabase/server$": "<rootDir>/__tests__/setup/mock-supabase.ts",
    "^@/lib/supabase$": "<rootDir>/__tests__/setup/mock-supabase.ts",
    // Mock the realtime module specifically
    "^@supabase/realtime-js$": "<rootDir>/__tests__/setup/mock-supabase.ts",
    // Mock canvas module that jsdom tries to require
    "^canvas$": "<rootDir>/__tests__/setup/mock-canvas.js",
    // Mock supercluster (ESM-only module)
    "^supercluster$": "<rootDir>/__tests__/__mocks__/supercluster.ts",
    // Mock jose (ESM-only module)
    "^jose$": "<rootDir>/__tests__/__mocks__/jose.ts",
    // Mock http-proxy-agent to avoid @tootallnate/once ESM incompatibility in jsdom
    "^http-proxy-agent$": "<rootDir>/__tests__/__mocks__/http-proxy-agent.ts",
  },
  // Add transformIgnorePatterns to handle ESM modules
  transformIgnorePatterns: [
    "node_modules/(?!(@supabase|@supabase/.*/?|jose|uuid|date-fns|supercluster|kdbush|@vercel/speed-insights)/)",
  ],
  // Add module file extensions
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],
  // Handle dynamic imports and async code better
  preset: undefined,
  // Cap workers in CI to match GitHub runner vCPUs (2) and reduce contention
  ...(process.env.CI ? { maxWorkers: 2 } : {}),
  // Coverage configuration
  coverageProvider: "v8",
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json", "html"],
  collectCoverageFrom: [
    "actions/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "context/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/index.{ts,tsx}",
    "!**/*.stories.{ts,tsx}",
    "!**/__tests__/**",
    "!**/setup/**",
    "!**/test-utils/**",
    "!**/migrations/**",
    "!types/**",
    "!app/**/page.tsx",
    "!app/**/layout.tsx",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "<rootDir>/e2e/",
    "<rootDir>/__tests__/setup/",
    "<rootDir>/test-utils/",
  ],
  coverageThreshold: {
    global: {
      lines: 54,
      statements: 54,
      functions: 61,
      branches: 72,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
