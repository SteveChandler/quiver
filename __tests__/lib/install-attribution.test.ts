import {
  INSTALL_ATTRIBUTION_CAMPAIGNS,
  INSTALL_ATTRIBUTION_PLACEMENTS,
  INSTALL_ATTRIBUTION_SOURCES,
  INSTALL_ATTRIBUTION_SURFACES,
  buildAndroidBetaHandoffPath,
  normalizeInstallAttribution,
  toCoarseDate,
} from "@/lib/install-attribution";
import {
  buildPlayStoreInstallUrl,
  createOpaqueInstallToken,
  parseOpaqueInstallToken,
} from "@/lib/install-attribution-server";

describe("install attribution contract", () => {
  it("preserves only allowlisted Android handoff context", () => {
    expect(
      buildAndroidBetaHandoffPath({
        source: "landing-navbar",
        surface: "landing-page",
        placement: "navbar_primary",
        campaign: "app_first_v1",
      }),
    ).toBe(
      "/android-beta?source=landing-navbar&surface=landing-page&placement=navbar_primary&campaign=app_first_v1",
    );

    expect(
      buildAndroidBetaHandoffPath({
        source: "attacker-controlled",
        surface: "https://example.com",
        placement: "anything",
        campaign: "arbitrary-utm",
      }),
    ).toBe(
      "/android-beta?source=android_beta_page&surface=android_beta&placement=direct&campaign=app_first_v1",
    );
  });

  it("exports the complete bounded output vocabulary used by handoff producers", () => {
    expect(INSTALL_ATTRIBUTION_SOURCES).toEqual([
      "android_beta_page",
      "landing-navbar",
      "landing_hero",
      "landing_platform_strip",
      "landing_final_cta",
      "landing_final",
      "download_hero",
      "download_final",
      "features-hero-android-waitlist",
      "features-final-android-waitlist",
      "plans-android-waitlist",
      "partner_landing",
      "invite_landing",
      "post_session_log",
      "session_share",
      "app_handoff_route",
      "app_link_email",
      "pbsc-flyer",
      "share_card",
      "map_literacy_panel",
    ]);
    expect(INSTALL_ATTRIBUTION_SURFACES).toEqual([
      "android_beta",
      "landing-page",
      "landing",
      "download",
      "features-page",
      "plans-page",
      "partner_landing",
      "invite_landing",
      "session_log_success",
      "session_detail_fallback",
      "app_handoff",
      "pbsc-page",
      "og_session_card",
      "og_surf_call_card",
      "map",
    ]);
    expect(INSTALL_ATTRIBUTION_PLACEMENTS).toEqual([
      "direct",
      "navbar_primary",
      "navbar_mobile_primary",
      "hero_primary",
      "hero_secondary",
      "platform_strip",
      "final_cta",
      "final_secondary",
      "final",
      "hero",
      "plans_primary",
      "plans_compact",
      "plans_signed_in",
      "plans_compact_signed_in",
      "primary_android",
      "native_app_nudge",
      "primary_app_store",
      "handoff_page",
      "email",
      "bottom_primary",
      "desktop_partner_qr",
      "desktop_invite_qr",
      "instructions_qr",
      "field_guide_qr",
      "session_share_qr",
      "surf_call_share_qr",
    ]);
    expect(INSTALL_ATTRIBUTION_CAMPAIGNS).toEqual([
      "app_first_v1",
      "pbsc_2026",
      "partner_access",
      "invite_access",
    ]);
  });

  it("normalizes issuance input to bounded values without retaining arbitrary input", () => {
    expect(
      normalizeInstallAttribution({
        source: "partner_landing",
        surface: "partner_landing",
        placement: "primary_android",
        campaign: "app_first_v1",
        email: "surfer@example.com",
        coordinates: [32.7, -117.2],
      }),
    ).toEqual({
      source: "partner_landing",
      surface: "partner_landing",
      placement: "primary_android",
      campaign: "app_first_v1",
    });
  });

  it("builds a public Play listing URL with only the opaque referrer token", () => {
    const token = "A".repeat(43);
    const url = new URL(buildPlayStoreInstallUrl(token));

    expect(url.origin).toBe("https://play.google.com");
    expect(url.pathname).toBe("/store/apps/details");
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      id: "app.quiversurf.surf",
      referrer: token,
    });
  });

  it("accepts only strict 32-byte base64url token material", () => {
    expect(parseOpaqueInstallToken("A".repeat(43))).toBe("A".repeat(43));
    expect(parseOpaqueInstallToken("A".repeat(42))).toBeNull();
    expect(parseOpaqueInstallToken("A".repeat(44))).toBeNull();
    expect(parseOpaqueInstallToken(`${"A".repeat(42)}=`)).toBeNull();
    expect(parseOpaqueInstallToken(`${"A".repeat(42)}+`)).toBeNull();
  });

  it("generates distinct 32-byte base64url tokens", () => {
    const first = createOpaqueInstallToken();
    const second = createOpaqueInstallToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("returns date-only attribution metadata", () => {
    expect(toCoarseDate("2026-07-25T23:59:59.999Z")).toBe("2026-07-25");
  });
});
