/**
 * @jest-environment node
 */

describe("environment validation", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("throws when required public Supabase env vars are missing", async () => {
    const { validateEnvironment } = await import("../../config/environment-validation.mjs");

    expect(() => validateEnvironment({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL is required/,
    );
    expect(() => validateEnvironment({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY is required/,
    );
  });

  it("passes when required env vars are present", async () => {
    const { validateEnvironment } = await import("../../config/environment-validation.mjs");

    expect(() =>
      validateEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).not.toThrow();
  });

  it("throws when CRON_SECRET is missing from Vercel production", async () => {
    const { validateEnvironment } = await import("../../config/environment-validation.mjs");

    expect(() =>
      validateEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/CRON_SECRET is required for Vercel production cron authentication/);
  });

  it("does not require CRON_SECRET outside Vercel production", async () => {
    const { validateEnvironment } = await import("../../config/environment-validation.mjs");

    expect(() =>
      validateEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        VERCEL_ENV: "preview",
      }),
    ).not.toThrow();
  });

  it("keeps optional env vars as warnings", async () => {
    const { validateEnvironment } = await import("../../config/environment-validation.mjs");

    validateEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "⚠️  Environment Configuration Warnings:",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY not set"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("NEXT_PUBLIC_SITE_URL not set"),
    );
  });
});
