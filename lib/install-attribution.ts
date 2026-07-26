import {
  ANDROID_BETA_LANDING_PATH,
  APP_FIRST_CAMPAIGN,
} from "@/lib/constants/app-store";

export const INSTALL_ATTRIBUTION_SOURCES = [
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
] as const;

export const INSTALL_ATTRIBUTION_SURFACES = [
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
] as const;

export const INSTALL_ATTRIBUTION_PLACEMENTS = [
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
] as const;

export const INSTALL_ATTRIBUTION_CAMPAIGNS = [
  APP_FIRST_CAMPAIGN,
  "pbsc_2026",
  "partner_access",
  "invite_access",
] as const;

export type InstallAttributionSource =
  (typeof INSTALL_ATTRIBUTION_SOURCES)[number];
export type InstallAttributionSurface =
  (typeof INSTALL_ATTRIBUTION_SURFACES)[number];
export type InstallAttributionPlacement =
  (typeof INSTALL_ATTRIBUTION_PLACEMENTS)[number];
export type InstallAttributionCampaign =
  (typeof INSTALL_ATTRIBUTION_CAMPAIGNS)[number];

export interface InstallAttribution {
  source: InstallAttributionSource;
  surface: InstallAttributionSurface;
  placement: InstallAttributionPlacement;
  campaign: InstallAttributionCampaign;
}

const DEFAULT_ATTRIBUTION: InstallAttribution = {
  source: "android_beta_page",
  surface: "android_beta",
  placement: "direct",
  campaign: APP_FIRST_CAMPAIGN,
};

function allowedValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && allowed.includes(value)
    ? (value as T[number])
    : fallback;
}

export function normalizeInstallAttribution(
  input: Record<string, unknown>,
): InstallAttribution {
  return {
    source: allowedValue(
      input.source,
      INSTALL_ATTRIBUTION_SOURCES,
      DEFAULT_ATTRIBUTION.source,
    ),
    surface: allowedValue(
      input.surface,
      INSTALL_ATTRIBUTION_SURFACES,
      DEFAULT_ATTRIBUTION.surface,
    ),
    placement: allowedValue(
      input.placement,
      INSTALL_ATTRIBUTION_PLACEMENTS,
      DEFAULT_ATTRIBUTION.placement,
    ),
    campaign: allowedValue(
      input.campaign,
      INSTALL_ATTRIBUTION_CAMPAIGNS,
      DEFAULT_ATTRIBUTION.campaign,
    ),
  };
}

export function buildAndroidBetaHandoffPath(
  input: Record<string, unknown>,
): string {
  const attribution = normalizeInstallAttribution(input);
  const search = new URLSearchParams(Object.entries(attribution));
  return `${ANDROID_BETA_LANDING_PATH}?${search.toString()}`;
}

export function toCoarseDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}
