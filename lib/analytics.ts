/**
 * Analytics-only module.
 * No generic utilities should live here.
 */

import { getAttributionForAnalytics } from "@/lib/attribution";

/**
 * Detect current platform for analytics purposes based on user agent.
 * @returns "ios" | "android" | "desktop"
 */
function currentPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "desktop";
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

declare global {
  interface Window {
    gtag?: (
      command: string,
      eventNameOrConfig: string | object,
      params?: Record<string, any>
    ) => void;
  }
}

/**
 * Track an analytics event with automatic attribution data
 *
 * @param event - Event name (e.g., "sign_up", "session_log_submit")
 * @param params - Event parameters
 * @param options - Additional options
 * @param options.includeAttribution - Include UTM attribution data (default: true)
 *
 * @example
 * ```ts
 * // Basic event
 * track("button_click", { button_id: "signup" });
 *
 * // Conversion event with attribution (automatic)
 * track("sign_up", { method: "email" });
 *
 * // Disable attribution for specific event
 * track("internal_event", { data: "test" }, { includeAttribution: false });
 * ```
 */
export function track(
  event: string,
  params: Record<string, any> = {},
  options: { includeAttribution?: boolean } = {}
) {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;

  const { includeAttribution = true } = options;

  try {
    // Merge attribution data with event params
    const eventParams = includeAttribution
      ? { ...getAttributionForAnalytics(), ...params }
      : params;

    window.gtag("event", event, eventParams);
  } catch (e) {
    // Swallow analytics errors to avoid disrupting UX
  }
}

// Optional helpers for future wiring
export function trackInstallPWA() {
  track("install_pwa", { platform: currentPlatform() });
}

// Public conversion tracking helpers
export function trackPublicPageView(page: string, params: Record<string, any> = {}) {
  track("public_page_view", {
    page,
    platform: currentPlatform(),
    ...params,
  });
}
