export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

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

export function currentPlatform(): "ios" | "android" | "desktop" {
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

export function trackPushPermission(permission?: NotificationPermission) {
  const p = permission || (typeof Notification !== "undefined" ? Notification.permission : undefined);
  if (!p) return;
  track("enable_push", { permission: p });
}

