/**
 * @jest-environment node
 */

jest.mock("@ducanh2912/next-pwa", () => ({
  __esModule: true,
  default: () => (config) => config,
}));

jest.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config) => config,
}));

describe("community photo response caching", () => {
  it("overrides the blanket API cache for public, admin, and contributor routes", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const { default: wrappedConfig } = await import("../../next.config.mjs");
    const config =
      typeof wrappedConfig === "function"
        ? await wrappedConfig("phase-production-build", {
            defaultConfig: {},
          })
        : wrappedConfig;
    const rules = await config.headers();
    const expected = {
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store, no-cache, must-revalidate",
        },
      ],
    };

    for (const source of [
      "/api/community-photos/:path*",
      "/api/admin/community-photos/:path*",
      "/api/admin/community-photo-contributors/:path*",
      "/api/cron/community-photo-retention",
    ]) {
      expect(rules.find((candidate) => candidate.source === source)).toEqual({
        source,
        ...expected,
      });
    }
  });
});
