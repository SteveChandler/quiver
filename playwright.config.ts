import 'dotenv/config';
import { config } from 'dotenv';
import { defineConfig, devices } from "@playwright/test";

// Load Playwright-specific env file if it exists
config({ path: '.env.playwright', override: true });

// IMPORTANT:
// Use a Playwright-specific base URL variable so local dev runs don't
// accidentally pick up a globally-exported BASE_URL (often set to dev/prod).
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
process.env.PLAYWRIGHT_BASE_URL = baseURL;

const isLocalBaseUrl =
  baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

// Minimal fresh Playwright configuration
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  testDir: "./e2e",
  timeout: 120 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 5 : 3,  // Reduced to 3 for local testing against prod to avoid rate limits
  reporter: [["list"], ["html", { open: "never" }]],
  // Grep to skip data-dependent tests in local dev (when SKIP_DATA_TESTS=true)
  grep: process.env.SKIP_DATA_TESTS === 'true' ? /^(?!.*@requires-data)/ : undefined,
  use: {
    baseURL,
    extraHTTPHeaders: isLocalBaseUrl
      ? undefined
      : (process.env.VERCEL_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_BYPASS)
      ? {
          'x-vercel-protection-bypass': String(
            process.env.VERCEL_BYPASS_TOKEN ||
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
              process.env.VERCEL_BYPASS
          ),
        }
      : undefined,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Guest-only: runs unauthenticated checks
    {
      name: 'guest',
      testMatch: ['e2e/guest-*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    // Authenticated: uses storageState produced by globalSetup
    {
      name: 'auth',
      testIgnore: ['e2e/guest-*.spec.ts'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
    },
  ],
  webServer: isLocalBaseUrl
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
