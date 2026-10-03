import { iphoneBannerOwnsInstallAsk } from "@/lib/app-store/beach-subpage-install-cta";
import {
  isIphoneAppBannerExcludedPath,
  isIphoneUserAgent,
} from "@/lib/app-store/iphone-app-banner";
import { isInstallBarEnabled } from "@/lib/flags/install-bar";

/*
 * Install bar: every iPhone visitor (any browser) on beach detail, city
 * water-temp and city hub pages gets one fixed-bottom install ask when
 * NEXT_PUBLIC_INSTALL_BAR_ENABLED=true. There is no split test; it is read
 * before/after (see components/app-store/ARCHITECTURE.md):
 *   - taps: `cta_click` rows with `placement = 'install_bar'`, by surface;
 *   - corroboration: App Store Connect web-referrer first-time downloads;
 *   - rule: a tap lift with no movement in those downloads stays
 *     `shipped_unvalidated`. Apple's Smart App Banner (Safari) is not ours to
 *     suppress and its taps are invisible to us, so the bar can absorb them.
 */

export type InstallBarSurface = "beach_detail" | "water_temp" | "city_hub";

export const INSTALL_BAR_PLACEMENT = "install_bar";
export const INSTALL_BAR_DISMISSAL_KEY = "install_bar_v1";
export const INSTALL_BAR_DISMISSAL_DAYS = 14;

/** The bar shows once the visitor has scrolled past this share of the viewport. */
export const INSTALL_BAR_SCROLL_THRESHOLD_VH = 0.6;

/** An in-flow install ask this much in view hides the bar (one ask at a time). */
const INSTALL_ASK_VISIBLE_RATIO = 0.35;

/**
 * Stable hooks of in-flow install asks that cannot be suppressed ahead of time.
 * Matched by selector so the bar edits neither component.
 */
export const INSTALL_ASK_SELECTORS = [
  'section[aria-label="Get the Quiver app"]',
  '[data-testid^="content-page-app-handoff-cta"]',
] as const;

const SURFACE_PATTERNS: ReadonlyArray<readonly [InstallBarSurface, RegExp]> = [
  ["water_temp", /^\/water-temp\/[^/]+\/?$/],
  ["city_hub", /^\/beaches\/[^/]+\/[^/]+\/[^/]+\/?$/],
  ["beach_detail", /^\/[a-z]{2}\/[^/]+\/[^/]+\/?$/],
];

/** Which bar surface a pathname is, or null when the bar never runs there. */
export function getInstallBarSurface(pathname: string): InstallBarSurface | null {
  for (const [surface, pattern] of SURFACE_PATTERNS) {
    if (pattern.test(pathname)) return surface;
  }

  return null;
}

interface InstallBarOwnershipInput {
  userAgent: string;
  pathname: string;
  isStandalone?: boolean;
  /** Defaults to the build-time flag. */
  enabled?: boolean;
}

/**
 * The surface the bar owns for this visitor, or null. Any iPhone browser,
 * not an installed home-screen app, on a bar surface, flag on.
 */
export function getInstallBarOwnedSurface({
  userAgent,
  pathname,
  isStandalone = false,
  enabled = isInstallBarEnabled(),
}: InstallBarOwnershipInput): InstallBarSurface | null {
  if (!enabled) return null;
  if (!isIphoneUserAgent(userAgent)) return null;
  if (isStandalone) return null;
  if (isIphoneAppBannerExcludedPath(pathname)) return null;

  return getInstallBarSurface(pathname);
}

export function installBarOwnsInstallAsk(input: InstallBarOwnershipInput): boolean {
  return getInstallBarOwnedSurface(input) !== null;
}

/**
 * Shared client-side predicate for "this visitor's in-page install ask belongs
 * to someone else": the bar when it owns the page, otherwise the iPhone banner
 * (non-Safari). Used by the beach-detail install section.
 */
export function iphoneInstallAskOwnedElsewhere(
  input: InstallBarOwnershipInput,
): boolean {
  return (
    installBarOwnsInstallAsk(input) ||
    iphoneBannerOwnsInstallAsk({
      userAgent: input.userAgent,
      pathname: input.pathname,
    })
  );
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    navigatorWithStandalone.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

interface InstallBarCopyInput {
  surface: InstallBarSurface;
  placeName: string;
  /** The figure the page already shows: wave height, or water temperature. */
  valueLabel: string | null;
  isTomorrow?: boolean;
}

interface InstallBarCopy {
  headline: string;
  subline: string;
  cta: string;
}

const CTA = "Get the app";

export function buildInstallBarCopy({
  surface,
  placeName,
  valueLabel,
  isTomorrow = false,
}: InstallBarCopyInput): InstallBarCopy {
  if (!valueLabel) {
    return {
      headline: `Forecast and alerts for ${placeName}`,
      subline: "Free in the app",
      cta: CTA,
    };
  }

  if (surface === "water_temp") {
    return {
      headline: `${placeName} water: ${valueLabel}`,
      subline: "Hourly forecast and alerts in the app",
      cta: CTA,
    };
  }

  return {
    headline: `${isTomorrow ? "Tomorrow" : "Now"} at ${placeName}: ${valueLabel}`,
    subline: "Hourly forecast and alerts in the app",
    cta: CTA,
  };
}

/** True when any in-flow install ask is at least `ratio` inside the viewport. */
export function isInstallAskInView(
  doc: Document = document,
  viewportHeight: number = window.innerHeight,
  ratio: number = INSTALL_ASK_VISIBLE_RATIO,
): boolean {
  const asks = doc.querySelectorAll(INSTALL_ASK_SELECTORS.join(","));

  for (const ask of Array.from(asks)) {
    const { top, bottom, height } = ask.getBoundingClientRect();
    if (height <= 0) continue;

    const visible = Math.min(bottom, viewportHeight) - Math.max(top, 0);
    if (visible / Math.min(height, viewportHeight) >= ratio) return true;
  }

  return false;
}
