const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/test-utils/",
    "<rootDir>/e2e/",
    "<rootDir>/__tests__/setup/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Mock Supabase entirely for problematic component tests
    "^@/lib/supabase/client$": "<rootDir>/__tests__/setup/mock-supabase.ts",
    "^@/lib/supabase/server$": "<rootDir>/__tests__/setup/mock-supabase.ts",
    "^@/lib/supabase$": "<rootDir>/__tests__/setup/mock-supabase.ts",
  },
  // Add transformIgnorePatterns to handle ESM modules
  transformIgnorePatterns: [
    "node_modules/(?!(@supabase|jose|@supabase/.*|uuid)/)",
  ],
  // Add module file extensions
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],
  // Handle dynamic imports and async code better
  preset: undefined,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
