"use client";

import { useEffect, useState, type ReactElement } from "react";

import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";
import {
  iphoneInstallAskOwnedElsewhere,
  isStandaloneDisplay,
} from "@/lib/app-store/install-bar";

interface BeachDetailInstallCtaProps {
  pathname: string;
  source: string;
  beachName: string;
  proof?: { value: string; label: string };
}

/**
 * Beach detail's after-tabs install section, decided in the browser.
 *
 * The page HTML is shared through the CDN, so it cannot depend on the request's
 * user agent. Non-Safari iPhone gets IphoneAppBanner instead, and every iPhone
 * gets the install bar when it is on, so the section is suppressed there to keep
 * one install ask; everyone else gets it after mount.
 */
export function BeachDetailInstallCta({
  pathname,
  source,
  beachName,
  proof,
}: BeachDetailInstallCtaProps): ReactElement | null {
  // null until mounted, so server and hydration markup match.
  const [bannerOwnsInstallAsk, setBannerOwnsInstallAsk] = useState<boolean | null>(null);

  useEffect(() => {
    setBannerOwnsInstallAsk(
      iphoneInstallAskOwnedElsewhere({
        userAgent: navigator.userAgent,
        pathname,
        isStandalone: isStandaloneDisplay(),
      }),
    );
  }, [pathname]);

  if (bannerOwnsInstallAsk !== false) return null;

  return (
    <div className="mt-10">
      <InstallAppCtaSection
        source={source}
        surface="beach-detail"
        placement="after-tabs"
        beachName={beachName}
        proof={proof}
      />
    </div>
  );
}
