import 'dotenv/config';
import { config } from 'dotenv';
import { defineConfig, devices } from "@playwright/test";

// Load Playwright-specific env file if it exists
config({ path: '.env.playwright', override: true });

// Minimal fresh Playwright configuration
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: "./e2e",
  timeout: 120 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL:  "http://localhost:3000",
    extraHTTPHeaders: (!process.env.BASE_URL || process.env.BASE_URL.includes("localhost"))
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
  webServer: (!process.env.BASE_URL || process.env.BASE_URL.includes("localhost"))
    ? {
        command: "npm run dev",
        url: process.env.BASE_URL || "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
