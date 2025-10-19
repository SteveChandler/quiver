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

export function track(event: string, params: Record<string, any> = {}) {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  try {
    window.gtag("event", event, params);
  } catch (e) {
    // Swallow analytics errors to avoid disrupting UX
  }
}

export function slugify(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function currentPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "desktop";
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

export function trackSignupCTAView(source: string, ctaTitle: string) {
  track("signup_cta_view", {
    source,
    cta_title: ctaTitle,
    platform: currentPlatform(),
  });
}

export function trackSignupCTAClick(source: string, ctaTitle: string) {
  track("signup_cta_click", {
    source,
    cta_title: ctaTitle,
    platform: currentPlatform(),
  });
}

export function trackPublicConversion(source: string, method: "signup" | "signin") {
  track("public_conversion", {
    source,
    method,
    platform: currentPlatform(),
  });
}
