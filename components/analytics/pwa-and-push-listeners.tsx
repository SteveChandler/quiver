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

    const isSecureContext =
      window.location.protocol === "https:" || // eslint-disable-line no-restricted-properties
      window.location.hostname === "localhost"; // eslint-disable-line no-restricted-properties
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
