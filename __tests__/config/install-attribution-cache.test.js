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

describe("install attribution response caching", () => {
  it("overrides the blanket API cache for every install attribution response", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    const { default: wrappedConfig } = await import("../../next.config.mjs");
    const config =
      typeof wrappedConfig === "function"
        ? await wrappedConfig("phase-production-build", {
            defaultConfig: {},
          })
        : wrappedConfig;
    const rules = await config.headers();
    const rule = rules.find(
      (candidate) => candidate.source === "/api/install-attribution/:path*",
    );

    expect(rule).toEqual({
      source: "/api/install-attribution/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store, no-cache, must-revalidate",
        },
      ],
    });
  });
});
