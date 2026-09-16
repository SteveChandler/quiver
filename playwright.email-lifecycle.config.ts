import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Local-only HTTP contracts; no seeded users or production credentials required.
export default defineConfig({
  ...base,
  globalSetup: undefined,
  globalTeardown: undefined,
  testMatch: "email-core-loop/lifecycle-contract.spec.ts",
  projects: [{ name: "guest", use: { storageState: { cookies: [], origins: [] } } }],
  use: { ...base.use, baseURL: "http://localhost:3119" },
  webServer: {
    command: "yarn next dev --port 3119",
    url: "http://localhost:3119/api/cron/email-lifecycle",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "local-placeholder",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3119",
      CRON_SECRET: "lifecycle-local-cron-fixture",
      ALERT_EMAIL_SECRET: "lifecycle-local-unsubscribe-fixture",
      EMAIL_LIFECYCLE_ENABLED: "false",
      PRO_OFFERS_ENABLED: "false",
      EMAIL_GMAIL_REPLY_SYNC_ENABLED: "false",
      PLAYWRIGHT_TEST: "true",
      NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS: "true",
      RESEND_API_KEY: "",
      SENTRY_DSN: "",
    },
  },
});
