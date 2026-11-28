import { iphoneBannerOwnsInstallAsk } from "@/lib/app-store/beach-subpage-install-cta";
import {
  isIphoneAppBannerExcludedPath,
  isIphoneUserAgent,
} from "@/lib/app-store/iphone-app-banner";
import {
  buildSpotAskCopy,
  FREE_ALERTS_CTA,
  HOME_BREAK_BODY,
  HOME_BREAK_HEADLINE,
  type SpotAskVariant,
} from "@/lib/app-store/spot-ask-copy";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";

/*
 * Install bar: every iPhone visitor (any browser) on beach detail, beach
 * tides, city water-temp, city hub, surf-cam region, forecast region and best
 * time pages gets one fixed-bottom install ask. There is no split test; it is read
 * before/after (see components/app-store/ARCHITECTURE.md):
 *   - taps: `cta_click` rows with `placement = 'install_bar'`, by surface;
 *   - corroboration: App Store Connect web-referrer first-time downloads;
 *   - rule: a tap lift with no movement in those downloads stays
 *     `shipped_unvalidated`. Apple's Smart App Banner (Safari) is not ours to
 *     suppress and its taps are invisible to us, so the bar can absorb them.
 */

export type InstallBarSurface =
  | "beach_detail"
  | "beach_tides"
  | "water_temp"
  | "city_hub"
  | "surf_cams"
  | "forecast_region"
  | "best_time";

/** Surfaces about one spot; the rest are about a place with many spots. */
const SPOT_SURFACES: ReadonlySet<InstallBarSurface> = new Set([
  "beach_detail",
  "beach_tides",
]);

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

// Static pages under a state slug that are not city hubs and mount no bar.
const NON_HUB_STATE_PATHS: ReadonlySet<string> = new Set([
  "/hi/waimea-kauai",
  "/hi/waimea-big-island",
]);

function stateSegments(pathname: string, count: number): string[] | null {
  const segments = pathname.replace(/\/+$/, "").split("/").slice(1);
  if (segments.length !== count) return null;
  if (segments.some((segment) => segment === "")) return null;
  return isValidStateSlug(segments[0]) ? segments : null;
}

// Visitors see the short US city hub URL (/ca/san-diego); proxy.ts rewrites it
// to /beaches/usa/{state}/{city}, so both forms are the city hub. Only real
// state slugs count, so /vs/surfline and intent routes (/beginner/ca) do not.
const SURFACE_MATCHERS: ReadonlyArray<
  readonly [InstallBarSurface, (pathname: string) => boolean]
> = [
  ["water_temp", (path) => /^\/water-temp\/[^/]+\/?$/.test(path)],
  ["surf_cams", (path) => /^\/surf-cams\/[^/]+\/?$/.test(path)],
  ["forecast_region", (path) => /^\/forecast\/[^/]+\/?$/.test(path)],
  ["best_time", (path) => /^\/best-time-to-surf\/[^/]+\/?$/.test(path)],
  [
    "city_hub",
    (path) =>
      /^\/beaches\/[^/]+\/[^/]+\/[^/]+\/?$/.test(path) ||
      (stateSegments(path, 2) !== null &&
        !NON_HUB_STATE_PATHS.has(path.replace(/\/+$/, "").toLowerCase())),
  ],
  ["beach_detail", (path) => stateSegments(path, 3) !== null],
  [
    "beach_tides",
    (path) => stateSegments(path, 4)?.[3] === "tides",
  ],
];

/** Which bar surface a pathname is, or null when the bar never runs there. */
export function getInstallBarSurface(pathname: string): InstallBarSurface | null {
  for (const [surface, matches] of SURFACE_MATCHERS) {
    if (matches(pathname)) return surface;
  }

  return null;
}

interface InstallBarOwnershipInput {
  userAgent: string;
  pathname: string;
  isStandalone?: boolean;
}

/**
 * The surface the bar owns for this visitor, or null. Any iPhone browser,
 * not an installed home-screen app, on a bar surface.
 */
export function getInstallBarOwnedSurface({
  userAgent,
  pathname,
  isStandalone = false,
}: InstallBarOwnershipInput): InstallBarSurface | null {
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

function isSpotInstallBarSurface(surface: InstallBarSurface): boolean {
  return SPOT_SURFACES.has(surface);
}

interface InstallBarCopyInput {
  surface: InstallBarSurface;
  /** Spot name on spot surfaces, place name on place surfaces. */
  placeName: string;
  /** Tomorrow's height when it is bigger than today's (see spot-ask-copy). */
  tomorrowHeight?: string | null;
}

interface InstallBarCopy {
  headline: string;
  subline: string;
  cta: string;
  variant: SpotAskVariant | "place";
}

export function buildInstallBarCopy({
  surface,
  placeName,
  tomorrowHeight = null,
}: InstallBarCopyInput): InstallBarCopy {
  const place = placeName.trim();

  if (isSpotInstallBarSurface(surface) && place) {
    const ask = buildSpotAskCopy({ spotName: place, tomorrowHeight });
    return ask.variant === "b"
      ? { headline: ask.headline, subline: "Dawn ping", cta: ask.cta, variant: "b" }
      : { headline: ask.headline, subline: "Free alerts", cta: ask.cta, variant: "a" };
  }

  return {
    headline: HOME_BREAK_HEADLINE,
    subline: place
      ? `Pick a spot near ${place}. We ping you when it turns on.`
      : HOME_BREAK_BODY,
    cta: FREE_ALERTS_CTA,
    variant: "place",
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
