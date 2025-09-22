"use client";

import { useEffect } from "react";
import { trackInstallPWA } from "@/lib/analytics";

export default function PWAAndPushListeners() {
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

