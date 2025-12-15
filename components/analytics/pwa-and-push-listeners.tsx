"use client";

import { useEffect } from "react";
import { trackInstallPWA } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

export default function PWAAndPushListeners() {
  const { user } = useAuth();

  // Service Worker registration for PWA
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // DEV/LOCAL SAFETY:
    // Never register the PWA service worker on localhost (even if NODE_ENV=production),
    // because it can cache old Next.js chunks and cause hydration failures.
    // In dev, also proactively unregister any existing /sw.js registrations.
    const host =
      // eslint-disable-next-line no-restricted-properties
      window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isDev = process.env.NODE_ENV !== "production";

    const unregisterQuiverSwIfPresent = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs
            .filter((reg) => reg.active?.scriptURL?.includes("/sw.js"))
            .map((reg) => reg.unregister())
        );

        // Clear caches to prevent stale HTML/chunk mismatches lingering locally
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        if (process.env.NODE_ENV === "development") {
          console.info(
            "[Quiver] Unregistered PWA service worker for dev/localhost"
          );
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[Quiver] Unable to unregister dev service worker:",
            (error as Error)?.message || error
          );
        }
      }
    };

    if (isLocalhost || isDev) {
      void unregisterQuiverSwIfPresent();
      return;
    }

    const isSecureContext =
      // eslint-disable-next-line no-restricted-properties
      window.location.protocol === "https:";
    if (!isSecureContext) return;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (process.env.NODE_ENV !== "production") {
          console.info(
            "[Quiver] Service worker registered",
            registration.scope
          );
        }
      } catch (error) {
        console.error("[Quiver] Failed to register service worker", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    const onLoad = () => {
      void registerServiceWorker();
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // PWA install tracking
  useEffect(() => {
    const onInstalled = () => {
      try {
        trackInstallPWA();
      } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // Mobile push notifications setup
  useEffect(() => {
    if (!user) return;

    // Dynamically import mobile push notifications
    // This won't load on web, only on native mobile platforms
    import("@/lib/mobile/push-notifications")
      .then(({ setupPushNotificationListeners, registerPushNotifications }) => {
        // Set up listeners once
        setupPushNotificationListeners();

        // Register for push notifications
        void registerPushNotifications();

        if (process.env.NODE_ENV !== "production") {
          console.info("[Quiver] Mobile push notifications initialized");
        }
      })
      .catch((error) => {
        // Silent fail - mobile modules may not be available on web
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            "[Quiver] Mobile push notifications not available:",
            error.message
          );
        }
      });
  }, [user]);

  // Web push notifications setup
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    // Check if running on web (not Capacitor mobile app)
    const isWebPlatform = !window.Capacitor;
    if (!isWebPlatform) return;

    // Dynamically import web push notifications
    // This won't load on mobile, only in web browsers
    import("@/lib/web/push-notifications")
      .then(({ setupWebPushListeners, registerWebPushNotifications }) => {
        // Set up listeners once
        setupWebPushListeners();

        // Register for push notifications
        void registerWebPushNotifications();

        if (process.env.NODE_ENV !== "production") {
          console.info("[Quiver] Web push notifications initialized");
        }
      })
      .catch((error) => {
        // Silent fail - web push may not be available
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            "[Quiver] Web push notifications not available:",
            error.message
          );
        }
      });
  }, [user]);

  return null;
}
