export const IOS_APP_STORE_APP_ID = "6759300320";

export const IOS_APP_STORE_URL =
  "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320";

export const IOS_APP_STORE_CAMPAIGNS = {
  WEB: "web",
  WEB_BANNER: "web_banner",
  WEB_APP_LINKS: "web_app_links",
  WEB_PAGE: "web_page",
  EMAIL: "email",
  PARTNER_QR: "partner_qr",
  SHARE: "share",
} as const;

export type IosAppStoreCampaign =
  (typeof IOS_APP_STORE_CAMPAIGNS)[keyof typeof IOS_APP_STORE_CAMPAIGNS];

/** Canonical campaign label for the default web -> native funnel. */
export const APP_FIRST_CAMPAIGN = "app_first_v1";

const IOS_APP_STORE_REDIRECT_PATH = "/app-store";

interface IosAppStoreCampaignSignals {
  campaign?: string;
  medium?: string;
  placement?: string;
  source?: string;
  surface?: string;
}

const EXPLICIT_CAMPAIGNS = new Set<string>([
  IOS_APP_STORE_CAMPAIGNS.EMAIL,
  IOS_APP_STORE_CAMPAIGNS.PARTNER_QR,
  IOS_APP_STORE_CAMPAIGNS.SHARE,
  IOS_APP_STORE_CAMPAIGNS.WEB_BANNER,
  IOS_APP_STORE_CAMPAIGNS.WEB_APP_LINKS,
  IOS_APP_STORE_CAMPAIGNS.WEB_PAGE,
]);

// Surfaces that name a route rather than the page the visitor tapped from.
const NON_PAGE_SURFACES = new Set(["app_store", "app_handoff", "web"]);

function isExplicitCampaign(value: string): value is IosAppStoreCampaign {
  return EXPLICIT_CAMPAIGNS.has(value);
}

/**
 * Apple only reports a campaign once it reaches five first-time downloads in
 * the selected date range, so web installs are split by how the visitor
 * reached the App Store (Safari banner, App Links from another app, or a
 * button on one of our pages), not by page type: per-page buckets would stay
 * under that threshold. Source and surface are matched by prefix because some
 * apps JSON-escape or truncate the App Links and banner URLs they open.
 */
export function resolveIosAppStoreCampaign({
  campaign,
  medium,
  placement,
  source,
  surface,
}: IosAppStoreCampaignSignals): IosAppStoreCampaign {
  if (campaign && isExplicitCampaign(campaign)) return campaign;

  if (source === "email" || medium === "email" || medium === "app_link") {
    return IOS_APP_STORE_CAMPAIGNS.EMAIL;
  }
  if (
    source === "partner_qr" ||
    surface === "partner_landing" ||
    placement === "desktop_partner_qr"
  ) {
    return IOS_APP_STORE_CAMPAIGNS.PARTNER_QR;
  }
  if (
    source?.startsWith("ios_smart_app_banner") ||
    source === "iphone-app-banner" ||
    placement === "apple_smart_banner" ||
    surface === "smart_banner"
  ) {
    return IOS_APP_STORE_CAMPAIGNS.WEB_BANNER;
  }
  if (
    source?.startsWith("app_links") ||
    placement === "ios_app_link" ||
    surface === "metadata"
  ) {
    return IOS_APP_STORE_CAMPAIGNS.WEB_APP_LINKS;
  }
  if (surface && !NON_PAGE_SURFACES.has(surface)) {
    return IOS_APP_STORE_CAMPAIGNS.WEB_PAGE;
  }

  return IOS_APP_STORE_CAMPAIGNS.WEB;
}

/** Apple App Store campaign attribution. `ct` is our free-form campaign label;
 *  `pt` is set only when IOS_APP_STORE_PROVIDER_TOKEN is configured in App
 *  Store Connect. `mt=8` marks the link as an app link. */
export function iosAppStoreUrlWithCampaign(
  campaign: IosAppStoreCampaign,
  providerToken?: string,
): string {
  const search = new URLSearchParams();
  const normalizedProviderToken =
    normalizeIosAppStoreProviderToken(providerToken);
  if (normalizedProviderToken) search.set("pt", normalizedProviderToken);
  search.set("ct", campaign);
  search.set("mt", "8");
  return `${IOS_APP_STORE_URL}?${search.toString()}`;
}

export function buildIosAppStoreRedirectPath(
  campaign: IosAppStoreCampaign,
): string {
  const search = new URLSearchParams({ ct: campaign });
  return `${IOS_APP_STORE_REDIRECT_PATH}?${search.toString()}`;
}

export const IOS_APP_STORE_WEB_REDIRECT_PATH = buildIosAppStoreRedirectPath(
  IOS_APP_STORE_CAMPAIGNS.WEB,
);

function normalizeIosAppStoreProviderToken(
  providerToken?: string,
): string | undefined {
  const normalized = providerToken?.trim();
  return normalized && /^\d+$/.test(normalized) ? normalized : undefined;
}

export function buildIosSmartAppBannerContent(providerToken?: string): string {
  const parts = [`app-id=${IOS_APP_STORE_APP_ID}`];
  const normalizedProviderToken =
    normalizeIosAppStoreProviderToken(providerToken);
  if (normalizedProviderToken) {
    parts.push(
      `affiliate-data=pt=${normalizedProviderToken}&ct=${IOS_APP_STORE_CAMPAIGNS.WEB_BANNER}`,
    );
  }
  parts.push(`app-argument=${IOS_APP_STORE_SMART_BANNER_ARGUMENT}`);
  return parts.join(", ");
}

export const IOS_APP_STORE_CTA = "Open App Store";

export const IOS_APP_STORE_DESTINATION_STATUS = "app_store_live";

export const IOS_APP_STORE_SMART_BANNER_ARGUMENT = `https://go.quiversurf.app/app/handoff?source=ios_smart_app_banner&surface=smart_banner&placement=apple_smart_banner&utm_source=ios_safari&utm_medium=smart_banner&utm_campaign=${APP_FIRST_CAMPAIGN}`;

export const ANDROID_BETA_LANDING_PATH = "/android-beta";

export const ANDROID_BETA_LANDING_URL = `https://www.quiversurf.app${ANDROID_BETA_LANDING_PATH}`;

export const ANDROID_BETA_GROUP_URL =
  "https://groups.google.com/g/quiver-android-testers";

export const ANDROID_BETA_CONTACT_EMAIL = "steven@quiversurf.app";

export const ANDROID_BETA_CONTACT_MAILTO = `mailto:${ANDROID_BETA_CONTACT_EMAIL}`;

export const ANDROID_BETA_PLAY_URL: string | null =
  "https://play.google.com/apps/testing/app.quiversurf.surf";

export const ANDROID_PLAY_STORE_LISTING_URL =
  "https://play.google.com/store/apps/details?id=app.quiversurf.surf";
