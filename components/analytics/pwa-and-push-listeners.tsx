"use client";

import { useEffect } from "react";
import { trackInstallPWA } from "@/lib/analytics";

export default function PWAAndPushListeners() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isSecureContext =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost";
    if (!isSecureContext) return;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (process.env.NODE_ENV !== "production") {
          console.info("[Quiver] Service worker registered", registration.scope);
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

  useEffect(() => {
    const onInstalled = () => {
      try {
        trackInstallPWA();
      } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);
  return null;
}
