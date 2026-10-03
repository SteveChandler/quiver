import { track } from "@/lib/analytics";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";
import {
  INSTALL_BAR_PLACEMENT,
  type InstallBarSurface,
} from "@/lib/app-store/install-bar";

interface InstallBarTrackingBase {
  surface: InstallBarSurface;
  pathname: string;
}

export function trackInstallBarView({
  surface,
  pathname,
}: InstallBarTrackingBase): void {
  track("install_bar_view", {
    cta_family: "install_bar",
    surface,
    pathname,
  });
}

export function trackInstallBarDismiss({
  surface,
  pathname,
}: InstallBarTrackingBase): void {
  track("install_bar_dismiss", {
    cta_family: "install_bar",
    surface,
    pathname,
  });
}

interface InstallBarClickInput extends InstallBarTrackingBase {
  source: string;
  ctaText: string;
  destinationUrl: string;
  handoffId: string;
}

/**
 * Goes through the shared iOS CTA click path (PostHog plus a keepalive
 * `cta_click` row in user_events), so bar taps land beside every other install
 * tap and can be read by `placement = 'install_bar'` and `surface`.
 */
export function trackInstallBarClick({
  surface,
  pathname,
  source,
  ctaText,
  destinationUrl,
  handoffId,
}: InstallBarClickInput): void {
  trackIosAppCtaClick({
    source,
    surface,
    placement: INSTALL_BAR_PLACEMENT,
    cta_text: ctaText,
    destination_url: destinationUrl,
    handoff_id: handoffId,
    link_kind: "handoff",
    pathname,
  });
}
