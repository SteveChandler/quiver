import { getIphoneAppBannerDecision } from "@/lib/app-store/iphone-app-banner";
import { getFirstTouchPlatform } from "@/lib/analytics/web-context";
import { isBeachSubPageInstallCtaEnabled } from "@/lib/flags/beach-subpage-install-cta";

export interface BeachSubPageInstallCtaInput {
  userAgent: string;
  pathname: string;
}

export function iphoneBannerOwnsInstallAsk({
  userAgent,
  pathname,
}: {
  userAgent: string;
  pathname: string;
}): boolean {
  return getIphoneAppBannerDecision({
    userAgent,
    pathname,
    isStandalone: false,
    dismissedAt: null,
  }).shouldShow;
}

/**
 * True when this visitor has no other in-page install ask from us.
 *
 * `IphoneAppBanner` is our in-page banner for non-Safari iPhone. Deriving this
 * decision from its browser rules keeps the two surfaces mutually exclusive if
 * those rules change; Safari relies on Apple's unmeasurable native banner.
 *
 * Standalone and dismissal state are unavailable during SSR, so this checks a
 * fresh visit. A non-Safari visitor who dismissed the banner sees neither ask,
 * failing toward fewer prompts.
 */
export function shouldShowBeachSubPageInstallCta({
  userAgent,
  pathname,
}: BeachSubPageInstallCtaInput): boolean {
  if (!isBeachSubPageInstallCtaEnabled()) return false;
  if (getFirstTouchPlatform(userAgent) !== "ios") return false;

  return !iphoneBannerOwnsInstallAsk({ userAgent, pathname });
}
