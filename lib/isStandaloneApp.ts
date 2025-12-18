/**
 * Detects if the app is running in standalone/app mode:
 * - PWA installed (display-mode: standalone)
 * - iOS "Add to Home Screen" (navigator.standalone)
 * - Capacitor native app
 *
 * SSR-safe: returns false on server
 */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false

  // Check PWA standalone mode via media query
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true

  // Check iOS Safari "Add to Home Screen" mode
  if ((navigator as any).standalone === true) return true

  // Check Capacitor native platform
  const maybeCapacitor = (window as any).Capacitor
  if (maybeCapacitor?.isNativePlatform?.()) return true

  return false
}
