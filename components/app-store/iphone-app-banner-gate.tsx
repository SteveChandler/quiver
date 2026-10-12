"use client";

import { useRoutePathname } from "@/hooks/use-route-pathname";
import { useEffect, useState, type ReactElement } from "react";

import { IphoneAppBanner } from "@/components/app-store/iphone-app-banner";
import {
  installBarOwnsInstallAsk,
  isStandaloneDisplay,
} from "@/lib/app-store/install-bar";

/**
 * Mounts `IphoneAppBanner` unless the install bar owns this page for this
 * visitor. Waiting for the decision keeps the banner from mounting (and from
 * firing its eligibility events) on pages where the bar is the single ask.
 */
export function IphoneAppBannerGate(): ReactElement | null {
  const pathname = useRoutePathname() ?? "";
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setShowBanner(
      !installBarOwnsInstallAsk({
        userAgent: navigator.userAgent,
        pathname,
        isStandalone: isStandaloneDisplay(),
      }),
    );
  }, [pathname]);

  return showBanner ? <IphoneAppBanner /> : null;
}
