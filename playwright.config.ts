import { defineConfig, devices } from "@playwright/test";

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120 * 1000, // 2 minutes per test for performance issues
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 5 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["dot"], ["html"]],
  /* Global setup for authentication */
  globalSetup: require.resolve("./e2e/global-setup"),
  //maxFailures: 1,
  expect: {
    timeout: 5000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",

    /* Take screenshot only when test fails */
    screenshot: "only-on-failure",

    /* Use saved authentication state */
    storageState: ".auth/user.json",

    /* Set test mode flag for components to detect test environment */
    extraHTTPHeaders: {
      "X-Test-Mode": "true",
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "auth-tests",
      testMatch: [
        "**/auth.spec.ts",
        "**/forecast-card-unauthenticated.spec.ts",
        "**/comprehensive.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        // Don't use stored auth state for auth tests
        storageState: undefined,
      },
    },
    {
      name: "chromium",
      testIgnore: [
        "**/auth.spec.ts",
        "**/forecast-card.spec.ts",
        "**/forecast-card-unauthenticated.spec.ts",
        "**/comprehensive.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },

    //{
    //  name: "Mobile Safari",
    //  use: { ...devices["iPhone 12"] },
    //},

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: "npm run dev -- --port 3000 --hostname 0.0.0.0",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
