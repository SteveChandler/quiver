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

describe("point marine forecast response caching", () => {
  it("overrides the blanket API cache with no-store", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    const { default: wrappedConfig } = await import("../../next.config.mjs");
    const config = typeof wrappedConfig === "function"
      ? await wrappedConfig("phase-production-build", { defaultConfig: {} })
      : wrappedConfig;
    const rules = await config.headers();
    const rule = rules.find((candidate) => candidate.source === "/api/forecasts/point");

    expect(rule).toEqual({
      source: "/api/forecasts/point",
      headers: [{
        key: "Cache-Control",
        value: "private, no-store, no-cache, must-revalidate",
      }],
    });
  });
});
