"use client";

import { useRoutePathname } from "@/hooks/use-route-pathname";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import {
  installBarOwnsInstallAsk,
  isStandaloneDisplay,
} from "@/lib/app-store/install-bar";

/**
 * Wraps an in-page install ask that is rendered into CDN-shared HTML. It renders
 * normally on the server and before mount, then drops out for iPhone visitors
 * the install bar owns, so the bar is the only install ask they see. Used
 * instead of editing the wrapped CTA, whose click handling lives elsewhere.
 */
export function HideWhenInstallBarOwns({
  children,
}: {
  children: ReactNode;
}): ReactElement | null {
  const pathname = useRoutePathname() ?? "";
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    setSuppressed(
      installBarOwnsInstallAsk({
        userAgent: navigator.userAgent,
        pathname,
        isStandalone: isStandaloneDisplay(),
      }),
    );
  }, [pathname]);

  return suppressed ? null : <>{children}</>;
}
