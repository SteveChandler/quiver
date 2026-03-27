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
    // Check both NODE_ENV and VERCEL_ENV to properly detect preview deployments.
    // On Vercel, NODE_ENV is always "production" but VERCEL_ENV distinguishes preview from production.
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    const isDev =
      process.env.NODE_ENV !== "production" ||
      (vercelEnv && vercelEnv !== "production");

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
      } catch (error) {
        // Silent fail in development
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
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
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

  // Web push notifications setup
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    // Defer push registration by 2 seconds to avoid blocking page load
    // and give service worker time to initialize
    const timeoutId = setTimeout(() => {
      // Dynamically import web push notifications
      // This won't load on mobile, only in web browsers
      import("@/lib/web/push-notifications")
        .then(({ setupWebPushListeners, registerWebPushNotifications }) => {
          // Set up listeners once
          setupWebPushListeners();

          // Register for push notifications (non-blocking)
          registerWebPushNotifications().catch(() => {
            // Non-critical failure - log but don't block
            if (process.env.NODE_ENV === "development") {
              console.warn("Push registration failed (non-blocking)");
            }
          });
        })
        .catch(() => {
          // Silent fail - web push may not be available
        });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [user]);

  return null;
}
