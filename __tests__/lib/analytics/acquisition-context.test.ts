/** @jest-environment jsdom */

import {
  buildWebSignupMetadata,
  parseSignupContextV2,
  parseSignupMetadata,
} from "@/lib/analytics/acquisition-context";

describe("acquisition context", () => {
  it("builds a v2 web signup context with nested first-touch attribution", () => {
    const metadata = buildWebSignupMetadata({
      method: "google",
      entrypoint: "landing_hero",
      pathname: "/ca/san-diego/blacks",
      referrer: "https://www.google.com/search?q=surf",
      attribution: {
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: "summer",
        utm_content: null,
        utm_term: "surf forecast",
      },
      timezone: "Pacific/Honolulu",
      locale: "en-US",
      deviceKind: "mobile",
      capturedAt: "2026-07-25T18:00:00.000Z",
      legalAcceptedAt: "2026-07-25T18:00:00.000Z",
      location: null,
    });

    expect(metadata.signup_context).toEqual({
      schema_version: 2,
      signup_surface: "web",
      method: "google",
      entrypoint: "landing_hero",
      landing_path: "/ca/san-diego/blacks",
      referrer: "https://www.google.com/search",
      referrer_domain: "www.google.com",
      utm: {
        source: "google",
        medium: "organic",
        campaign: "summer",
        content: null,
        term: "surf forecast",
      },
      source_capture_status: "captured",
      tz: "Pacific/Honolulu",
      locale: "en-US",
      device: { kind: "mobile" },
      captured_at: "2026-07-25T18:00:00.000Z",
    });
  });

  it("records a captured direct visit without converting missing capture to direct", () => {
    const direct = buildWebSignupMetadata({
      method: "email",
      entrypoint: "app_header",
      pathname: "/",
      referrer: "",
      attribution: {},
      timezone: null,
      locale: null,
      deviceKind: "desktop",
      capturedAt: "2026-07-25T18:00:00.000Z",
      legalAcceptedAt: "2026-07-25T18:00:00.000Z",
      location: null,
    });

    expect(direct.signup_context.referrer).toBe("direct");
    expect(direct.signup_context.referrer_domain).toBeUndefined();
    expect(direct.signup_context.source_capture_status).toBe("captured");

    expect(
      parseSignupMetadata({
        signup_context: {
          schema_version: 2,
          signup_surface: "web",
          method: "unknown",
          entrypoint: "unknown",
          source_capture_status: "missing",
          captured_at: "2026-07-25T18:00:00.000Z",
        },
      }).signup_context.source_capture_status,
    ).toBe("missing");
  });

  it("rejects non-web signup surfaces at the web metadata boundary", () => {
    expect(() =>
      parseSignupMetadata({
        signup_context: {
          schema_version: 2,
          signup_surface: "native_ios",
          method: "apple",
          entrypoint: "welcome_gate",
          source_capture_status: "captured",
          captured_at: "2026-07-25T18:00:00.000Z",
        },
      }),
    ).toThrow();
  });

  it("accepts canonical native context at the shared v2 boundary", () => {
    expect(
      parseSignupContextV2({
        schema_version: 2,
        signup_surface: "native_ios",
        method: "apple",
        entrypoint: "welcome_gate",
        source_capture_status: "missing",
        captured_at: "2026-07-25T18:00:00.000Z",
      }),
    ).toMatchObject({
      signup_surface: "native_ios",
      source_capture_status: "missing",
    });
  });

  it("rejects oversized untrusted metadata and bounds builder output", () => {
    expect(() =>
      parseSignupMetadata({
        signup_context: {
          schema_version: 2,
          signup_surface: "web",
          method: "google",
          entrypoint: "x".repeat(121),
          source_capture_status: "captured",
          captured_at: "2026-07-25T18:00:00.000Z",
        },
      }),
    ).toThrow();

    const metadata = buildWebSignupMetadata({
      method: "google",
      entrypoint: "x".repeat(200),
      pathname: `/${"p".repeat(800)}`,
      referrer: `https://example.com/${"r".repeat(1_500)}?secret=yes`,
      attribution: {
        utm_source: "u".repeat(400),
      },
      timezone: "Pacific/Honolulu",
      locale: "en-US",
      deviceKind: "mobile",
      capturedAt: "2026-07-25T18:00:00.000Z",
      legalAcceptedAt: "2026-07-25T18:00:00.000Z",
      location: null,
    });

    expect(metadata.signup_context.entrypoint).toHaveLength(120);
    expect(metadata.signup_context.landing_path).toHaveLength(512);
    expect(metadata.signup_context.referrer?.length).toBeLessThanOrEqual(1_024);
    expect(metadata.signup_context.utm?.source).toHaveLength(256);
  });

  it("drops unapproved referrer paths that could contain identifiers", () => {
    const metadata = buildWebSignupMetadata({
      method: "google",
      entrypoint: "landing_hero",
      pathname: "/",
      referrer:
        "https://partner.example/users/private-id/orders/123?token=secret",
      attribution: {},
      timezone: null,
      locale: null,
      deviceKind: "desktop",
      capturedAt: "2026-07-25T18:00:00.000Z",
      legalAcceptedAt: "2026-07-25T18:00:00.000Z",
      location: null,
    });

    expect(metadata.signup_context.referrer).toBe("https://partner.example");
    expect(metadata.signup_context.referrer_domain).toBe("partner.example");
  });
});
