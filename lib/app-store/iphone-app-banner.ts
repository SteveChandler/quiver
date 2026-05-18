export const IPHONE_APP_BANNER_SOURCE = "iphone-app-banner";
export const IPHONE_APP_BANNER_DISMISSAL_STORAGE_KEY =
  "quiver_iphone_app_banner_dismissed_at";
export const IPHONE_APP_BANNER_DISMISSAL_DAYS = 14;

export type IphoneAppBannerBrowser =
  | "safari"
  | "chrome_ios"
  | "firefox_ios"
  | "edge_ios"
  | "duckduckgo_ios"
  | "google_ios"
  | "facebook_ios"
  | "instagram_ios"
  | "in_app_ios"
  | "unknown_ios";

export type IphoneAppBannerSuppressionReason =
  | "not_iphone"
  | "excluded_route"
  | "standalone"
  | "dismissed"
  | "safari_native_banner";

export interface IphoneAppBannerDecisionInput {
  userAgent: string;
  pathname: string;
  isStandalone: boolean;
  dismissedAt: string | null;
  now?: Date;
}

export interface IphoneAppBannerDecision {
  browser: IphoneAppBannerBrowser;
  isIphone: boolean;
  isEligible: boolean;
  shouldShow: boolean;
  suppressionReason?: IphoneAppBannerSuppressionReason;
}

const EXCLUDED_PATH_PREFIXES = ["/auth", "/embed", "/welcome", "/admin"];

export function isIphoneUserAgent(userAgent: string): boolean {
  return /iPhone|iPod/.test(userAgent);
}

export function classifyIphoneBrowser(
  userAgent: string
): IphoneAppBannerBrowser {
  if (/CriOS/i.test(userAgent)) return "chrome_ios";
  if (/FxiOS/i.test(userAgent)) return "firefox_ios";
  if (/EdgiOS/i.test(userAgent)) return "edge_ios";
  if (/DuckDuckGo/i.test(userAgent)) return "duckduckgo_ios";
  if (/\bGSA\b/i.test(userAgent)) return "google_ios";
  if (/Instagram/i.test(userAgent)) return "instagram_ios";
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return "facebook_ios";
  if (/Version\/[\d.]+.*Mobile\/\w+.*Safari/i.test(userAgent)) {
    return "safari";
  }
  if (/Mobile\/\w+.*Safari/i.test(userAgent)) return "in_app_ios";

  return "unknown_ios";
}

export function isIphoneAppBannerExcludedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isDismissedWithinWindow(
  dismissedAt: string | null,
  now: Date = new Date(),
  durationDays: number = IPHONE_APP_BANNER_DISMISSAL_DAYS
): boolean {
  if (!dismissedAt) return false;

  const dismissedDate = new Date(dismissedAt);
  if (Number.isNaN(dismissedDate.getTime())) return false;
  if (dismissedDate > now) return false;

  const durationMs = durationDays * 24 * 60 * 60 * 1000;
  return now.getTime() - dismissedDate.getTime() < durationMs;
}

export function getIphoneAppBannerDecision({
  userAgent,
  pathname,
  isStandalone,
  dismissedAt,
  now = new Date(),
}: IphoneAppBannerDecisionInput): IphoneAppBannerDecision {
  const isIphone = isIphoneUserAgent(userAgent);
  const browser = classifyIphoneBrowser(userAgent);

  if (!isIphone) {
    return {
      browser,
      isIphone: false,
      isEligible: false,
      shouldShow: false,
      suppressionReason: "not_iphone",
    };
  }

  if (isIphoneAppBannerExcludedPath(pathname)) {
    return {
      browser,
      isIphone: true,
      isEligible: false,
      shouldShow: false,
      suppressionReason: "excluded_route",
    };
  }

  if (isStandalone) {
    return {
      browser,
      isIphone: true,
      isEligible: false,
      shouldShow: false,
      suppressionReason: "standalone",
    };
  }

  if (isDismissedWithinWindow(dismissedAt, now)) {
    return {
      browser,
      isIphone: true,
      isEligible: true,
      shouldShow: false,
      suppressionReason: "dismissed",
    };
  }

  if (browser === "safari") {
    return {
      browser,
      isIphone: true,
      isEligible: true,
      shouldShow: false,
      suppressionReason: "safari_native_banner",
    };
  }

  return {
    browser,
    isIphone: true,
    isEligible: true,
    shouldShow: true,
  };
}
