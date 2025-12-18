export type NativePlatform = "ios" | "android" | "web";

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => NativePlatform;
    };
  }
}

const CAPACITOR_UA_FRAGMENT = "Capacitor";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const maybeCapacitor = window.Capacitor;
  if (maybeCapacitor?.isNativePlatform?.()) {
    return true;
  }

  const ua = window.navigator?.userAgent || "";
  return ua.includes(CAPACITOR_UA_FRAGMENT);
}

export function getNativePlatform(): NativePlatform {
  if (typeof window === "undefined") {
    return "web";
  }

  const maybeCapacitor = window.Capacitor;
  const reportedPlatform = maybeCapacitor?.getPlatform?.();
  if (reportedPlatform === "ios" || reportedPlatform === "android") {
    return reportedPlatform;
  }

  const ua = window.navigator?.userAgent?.toLowerCase() || "";
  if (ua.includes("android")) {
    return "android";
  }
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
    return "ios";
  }

  return "web";
}

export function canUseCapacitorPlugin(): boolean {
  return isNativeApp();
}

/**
 * Detect current platform for analytics and feature detection
 * Simple UA-based detection for tracking purposes
 * 
 * @returns "ios" | "android" | "desktop"
 */
export function currentPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "desktop";
}
