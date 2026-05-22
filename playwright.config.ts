import { config as dotenvConfig } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "fs";

/**
 * Env precedence for Playwright runs:
 * - CLI / OS env (highest)
 * - `.env.playwright.local`
 * - `.env.playwright`
 * - `.env` (lowest)
 *
 * We implement this explicitly so scripts like:
 *   BASE_URL=https://dev.quiversurf.app yarn test:e2e
 * are not overwritten by `.env.playwright`.
 */
const lockedEnv = new Map<string, string | undefined>(Object.entries(process.env));

// Load `.env` first (fallbacks)
dotenvConfig();

// Load `.env.playwright` next (overrides `.env`, but NOT CLI/OS env)
dotenvConfig({ path: ".env.playwright", override: true });

// Load `.env.playwright.local` last (developer override, but NOT CLI/OS env)
if (existsSync(".env.playwright.local")) {
  dotenvConfig({ path: ".env.playwright.local", override: true });
}

// Restore any pre-existing env (CLI/OS) values
for (const [key, value] of lockedEnv.entries()) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

// Minimal fresh Playwright configuration
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  testDir: "./e2e",
  timeout: 120 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1
    : (process.env.BASE_URL && !process.env.BASE_URL.includes("localhost")) ? 1 : 0,
  workers: process.env.CI ? 5 : 3,  // Reduced to 3 for local testing against prod to avoid rate limits
  reporter: [["list"], ["html", { open: "never" }]],
  // Grep to skip data-dependent tests in local dev (when SKIP_DATA_TESTS=true)
  grep: process.env.SKIP_DATA_TESTS === 'true' ? /^(?!.*@requires-data)/ : undefined,
  // Exclude @infra tests by default unless RUN_INFRA_TESTS=true
  grepInvert: process.env.RUN_INFRA_TESTS !== 'true' ? /@infra/ : undefined,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    locale: 'en-US',
    // Avoid bot-blocking heuristics that flag HeadlessChrome/Playwright UAs.
    // We still run headless, but present a standard Chrome UA.
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      // Required to pass bot detection (bots typically don't send Accept-Language)
      'Accept-Language': 'en-US,en;q=0.9',
      // Vercel protection bypass for non-localhost environments
      ...((process.env.BASE_URL && !process.env.BASE_URL.includes("localhost") &&
        (process.env.VERCEL_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_BYPASS))
        ? {
            'x-vercel-protection-bypass': String(
              process.env.VERCEL_BYPASS_TOKEN ||
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
                process.env.VERCEL_BYPASS
            ),
          }
        : {}),
    },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Enable WebGL in headless Chromium so Mapbox GL renders a canvas
    launchOptions: {
      args: ['--use-gl=angle'],
    },
  },
  projects: [
    // Guest-only: runs unauthenticated checks with cleared auth state
    {
      name: 'guest',
      testMatch: [
        'e2e/guest-*.spec.ts',
        'e2e/prod-readonly/guest-*.spec.ts',
        'e2e/invite-flow.spec.ts',
        'e2e/email-core-loop/**/*.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        // Clear any auth state for truly unauthenticated tests
        storageState: { cookies: [], origins: [] },
      },
    },
    // Authenticated: uses storageState produced by globalSetup
    {
      name: 'auth',
      testIgnore: [
        'e2e/guest-*.spec.ts',
        'e2e/prod-readonly/guest-*.spec.ts',
        'e2e/email-core-loop/**',
      ],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
    },
  ],
  webServer: (!process.env.BASE_URL || process.env.BASE_URL.includes("localhost"))
    ? {
        command: "npm run dev",
        // Use a deterministic health endpoint for readiness checks (homepage can legitimately error in dev)
        url: `${process.env.BASE_URL || "http://localhost:3000"}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
