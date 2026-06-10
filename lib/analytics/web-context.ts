import { getAttributionFromCookies } from "@/lib/attribution";
import { getBrowserSessionId } from "@/lib/utils/browser-session-id";

export type FirstTouchPlatform = "ios" | "android" | "desktop";
export type CamFamily = "cams-directory" | "surf-cams-seo";
export type SeoPageType =
  | "city_water_temp"
  | "beach_water_temp"
  | "best_time"
  | "surf_report"
  | "other";
export type SeoQueryIntent =
  | "water_temp"
  | "best_time"
  | "surf_report"
  | "app_store"
  | "other";

export interface SeoPageContext {
  page_type: SeoPageType;
  query_intent: SeoQueryIntent;
  seo_landing_page: boolean;
}

export interface WebAnalyticsContext {
  pathname: string;
  page: string;
  surface: string;
  source_group: string;
  browser_session_id?: string;
  platform: "web";
  first_touch_platform: FirstTouchPlatform;
  first_touch_landing_page?: string;
  first_touch_referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  cam_family?: CamFamily;
  page_type: SeoPageType;
  query_intent: SeoQueryIntent;
  seo_landing_page: boolean;
  signup_channel?: "web_app";
  signup_channel_source?: "web_auth";
}

const STATE_SLUGS = new Set([
  "ca",
  "or",
  "wa",
  "me",
  "nh",
  "ma",
  "ri",
  "ny",
  "nj",
  "nc",
  "sc",
  "ga",
  "fl",
  "tx",
  "hi",
  "pr",
]);

function getWindowPathname(): string {
  if (typeof window === "undefined") return "";
  // eslint-disable-next-line no-restricted-properties -- Analytics snapshot only; no navigation decision is made here.
  return window.location.pathname;
}

function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || navigator.vendor || "";
}

export function getFirstTouchPlatform(userAgent = getUserAgent()): FirstTouchPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  return "desktop";
}

function normalizePathname(pathname?: string | null): string {
  const raw = (pathname ?? getWindowPathname()) || "/";
  return raw.replace(/\/+$/, "") || "/";
}

export function getCamFamily(pathname?: string | null): CamFamily | undefined {
  const path = normalizePathname(pathname);
  if (path === "/cams" || path.startsWith("/cams/")) return "cams-directory";
  if (path.startsWith("/surf-cams/")) return "surf-cams-seo";
  return undefined;
}

export function deriveSeoPageContextFromPath(
  pathname?: string | null
): SeoPageContext {
  const path = normalizePathname(pathname);
  const segments = path.split("/").filter(Boolean);

  if (path === "/water-temp" || path.startsWith("/water-temp/")) {
    return {
      page_type: "city_water_temp",
      query_intent: "water_temp",
      seo_landing_page: true,
    };
  }

  const isHierarchicalBeachWaterTemp =
    segments.length >= 4 &&
    STATE_SLUGS.has(segments[0]) &&
    segments[3] === "water-temp";
  const isLegacyBeachWaterTemp =
    segments.length === 3 &&
    segments[0] === "beach" &&
    segments[2] === "water-temp";
  const isMexicoBeachWaterTemp =
    segments.length >= 5 &&
    segments[0] === "mexico" &&
    segments[segments.length - 1] === "water-temp";

  if (
    isHierarchicalBeachWaterTemp ||
    isLegacyBeachWaterTemp ||
    isMexicoBeachWaterTemp
  ) {
    return {
      page_type: "beach_water_temp",
      query_intent: "water_temp",
      seo_landing_page: true,
    };
  }

  if (
    path === "/best-time-to-surf" ||
    path.startsWith("/best-time-to-surf/")
  ) {
    return {
      page_type: "best_time",
      query_intent: "best_time",
      seo_landing_page: true,
    };
  }

  if (path === "/surf-report" || path.startsWith("/surf-report/")) {
    return {
      page_type: "surf_report",
      query_intent: "surf_report",
      seo_landing_page: true,
    };
  }

  return {
    page_type: "other",
    query_intent: "other",
    seo_landing_page: false,
  };
}

export function deriveSurfaceFromPath(pathname?: string | null): string {
  if (pathname == null && typeof window === "undefined") return "server";

  const path = normalizePathname(pathname);

  if (path === "/") return "landing-page";
  if (path === "/home" || path === "/dashboard") return "home";
  if (path === "/discover" || path === "/explore") return "discover";
  if (path === "/about") return "about-page";
  if (path === "/features" || path.startsWith("/features/")) return "features-page";
  if (path === "/map" || path.startsWith("/map/")) return "map";
  if (path === "/guides" || path.startsWith("/guides/")) return "guides-page";
  if (path === "/tools" || path.startsWith("/tools/")) return "tools-page";
  if (path === "/cams" || path.startsWith("/cams/")) return "cams-directory";
  if (path.startsWith("/surf-cams/")) return "surf-cams-seo";
  if (path === "/water-temp" || path.startsWith("/water-temp/")) return "water-temp";
  if (path === "/tide" || path.startsWith("/tide/")) return "tide";
  if (path === "/forecast" || path.startsWith("/forecast/")) return "forecast";
  if (path === "/best-time-to-surf" || path.startsWith("/best-time-to-surf/")) return "best-time";
  if (path === "/surf-report" || path.startsWith("/surf-report/")) return "surf-report";

  if (path === "/profile" || path.startsWith("/profile/")) return "auth-gated";
  if (path === "/settings" || path.startsWith("/settings/")) return "auth-gated";
  if (path === "/account" || path.startsWith("/account/")) return "auth-gated";

  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "beaches" && segments[1] === "usa" && segments[2]) {
    return "state-hub";
  }
  if (segments.length >= 1 && STATE_SLUGS.has(segments[0])) {
    if (segments.length >= 3) return "beach-detail";
    if (segments.length === 2) return "city-hub";
    return "state-hub";
  }

  return "other";
}

export function getPageName(pathname?: string | null): string {
  const path = normalizePathname(pathname);
  const surface = deriveSurfaceFromPath(path);

  if (path === "/home" || path === "/dashboard") return "home";
  if (path === "/discover" || path === "/explore") return "discover";
  if (path === "/beach" || path.startsWith("/beach/")) return "beach_detail";
  if (surface === "beach-detail") return "beach_detail";
  if (surface === "state-hub") return "state_hub";
  if (surface === "city-hub") return "city_hub";
  if (path.startsWith("/beaches/")) return "beaches";
  if (surface === "map") return "map";
  if (path === "/profile" || path.startsWith("/profile/")) return "profile";
  if (path === "/settings" || path.startsWith("/settings/")) return "settings";
  if (path.startsWith("/session")) return "session";
  if (surface === "forecast") return "forecast";
  if (surface === "best-time") return "best_time";
  if (surface === "surf-report") return "surf_report";
  if (surface === "cams-directory") return "cams";
  if (surface === "surf-cams-seo") return "surf_cams";
  if (surface === "water-temp") return "water_temp";
  if (surface === "tide") return "tide";
  if (path === "/plans" || path === "/pricing") return "plans";
  if (path === "/blog") return "blog_index";
  if (path.startsWith("/blog/")) return "blog_post";
  if (path.startsWith("/onboarding")) return "onboarding";
  if (path === "/login" || path === "/signup" || path === "/auth") return "auth";
  if (path === "/") return "landing";

  const segment = path.split("/").filter(Boolean)[0];
  return segment || "unknown";
}

export function deriveSourceGroup(source?: unknown, pathname?: string | null): string {
  const sourceText = typeof source === "string" ? source : "";
  const pathSurface = deriveSurfaceFromPath(pathname);

  if (sourceText.startsWith("seo-funnel-surf-cams") || sourceText.includes("surf-cams")) {
    return "surf-cams-seo";
  }
  if (sourceText === "cams-hub" || sourceText === "cams-hub-inline" || sourceText.startsWith("cams-")) {
    return "cams-directory";
  }
  if (sourceText.startsWith("state-hub-")) return "state-hub";
  if (sourceText.startsWith("landing-") || sourceText === "landing") return "landing";
  if (
    sourceText.includes("beach") ||
    sourceText.includes("forecast-teaser") ||
    sourceText.includes("home-break")
  ) {
    return "beach-detail";
  }
  if (sourceText.startsWith("app-header-")) return sourceText.replace("app-header-", "app-header-");

  if (pathSurface === "landing-page") return "landing";
  return pathSurface;
}

export function getWebAnalyticsContext(options: {
  pathname?: string | null;
  source?: unknown;
  includeSignupChannel?: boolean;
} = {}): WebAnalyticsContext {
  const pathname = normalizePathname(options.pathname);
  const attribution = getAttributionFromCookies();
  const browserSessionId = getBrowserSessionId();
  const camFamily = getCamFamily(pathname);
  const seoPageContext = deriveSeoPageContextFromPath(pathname);

  return {
    pathname,
    page: getPageName(pathname),
    surface: deriveSurfaceFromPath(pathname),
    source_group: deriveSourceGroup(options.source, pathname),
    ...seoPageContext,
    ...(browserSessionId ? { browser_session_id: browserSessionId } : {}),
    platform: "web",
    first_touch_platform: getFirstTouchPlatform(),
    ...(attribution.landing_page ? { first_touch_landing_page: attribution.landing_page } : {}),
    ...(attribution.referrer ? { first_touch_referrer: attribution.referrer } : {}),
    ...(attribution.utm_source ? { utm_source: attribution.utm_source } : {}),
    ...(attribution.utm_medium ? { utm_medium: attribution.utm_medium } : {}),
    ...(attribution.utm_campaign ? { utm_campaign: attribution.utm_campaign } : {}),
    ...(attribution.utm_content ? { utm_content: attribution.utm_content } : {}),
    ...(attribution.utm_term ? { utm_term: attribution.utm_term } : {}),
    ...(camFamily ? { cam_family: camFamily } : {}),
    ...(options.includeSignupChannel
      ? {
          signup_channel: "web_app" as const,
          signup_channel_source: "web_auth" as const,
        }
      : {}),
  };
}

export function enrichWithWebAnalyticsContext<T extends Record<string, unknown>>(
  params: T,
  options: { includeSignupChannel?: boolean; pathname?: string | null } = {}
): T & WebAnalyticsContext & Record<string, unknown> {
  const context = getWebAnalyticsContext({
    pathname: options.pathname,
    source: params.source,
    includeSignupChannel: options.includeSignupChannel,
  });

  return {
    ...context,
    ...params,
    pathname: typeof params.pathname === "string" && params.pathname.length > 0 ? params.pathname : context.pathname,
    page: typeof params.page === "string" && params.page.length > 0 ? params.page : context.page,
    surface:
      typeof params.surface === "string" && params.surface.length > 0
        ? params.surface
        : context.surface,
    source_group:
      typeof params.source_group === "string" && params.source_group.length > 0
        ? params.source_group
        : context.source_group,
  };
}
