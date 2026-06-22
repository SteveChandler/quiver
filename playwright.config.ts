import { config as dotenvConfig, parse as dotenvParse } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "fs";

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

const defaultBaseURL = process.env.BASE_URL ||
  `http://localhost:${process.env.E2E_PORT || "3100"}`;
const localWebServerPort = new URL(defaultBaseURL).port || "3000";
const nextFontGoogleMockPath = `${process.cwd()}/e2e/fixtures/next-font-google-mock.cjs`;
const shouldStartLocalWebServer =
  !process.env.BASE_URL ||
  process.env.BASE_URL.includes("localhost") ||
  process.env.BASE_URL.includes("127.0.0.1");

function readEnvFileValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;

  const parsed = dotenvParse(readFileSync(filePath));
  const value = parsed[key];
  return value && value.length > 0 ? value : undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const localCronSecret =
  process.env.CRON_SECRET ||
  readEnvFileValue(".env.local", "CRON_SECRET") ||
  readEnvFileValue(".env.production.local", "CRON_SECRET");
const localCronSecretEnv = localCronSecret
  ? ` CRON_SECRET=${shellQuote(localCronSecret)}`
  : "";

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
  workers: process.env.CI ? 5 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  // Grep to skip data-dependent tests in local dev (when SKIP_DATA_TESTS=true)
  grep: process.env.SKIP_DATA_TESTS === 'true' ? /^(?!.*@requires-data)/ : undefined,
  // Exclude @infra tests by default unless RUN_INFRA_TESTS=true
  grepInvert: process.env.RUN_INFRA_TESTS !== 'true' ? /@infra/ : undefined,
  use: {
    baseURL: defaultBaseURL,
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
    // Authenticated: storageState is supplied by e2e/fixtures/auth-fixture.ts
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
  webServer: shouldStartLocalWebServer
    ? {
        command: `env -u E2E_PROD_READ_URL -u E2E_PROD_READ_KEY PLAYWRIGHT_TEST=true NEXT_PUBLIC_PLAYWRIGHT_TEST=true NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS=true NEXT_PUBLIC_E2E_DISABLE_AUTH_REFRESH=true NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN= NEXT_PUBLIC_POSTHOG_HOST= POSTHOG_HOST=${localCronSecretEnv} NEXT_FONT_GOOGLE_MOCKED_RESPONSES="${nextFontGoogleMockPath}" E2E_PORT=${localWebServerPort} yarn e2e:serve`,
        // Use a deterministic health endpoint for readiness checks (homepage can legitimately error in dev)
        url: `${defaultBaseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 240_000,
      }
    : undefined,
});
