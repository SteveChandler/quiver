"use client";

import { useEffect, useState, type ReactElement } from "react";

import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";
import { iphoneBannerOwnsInstallAsk } from "@/lib/app-store/beach-subpage-install-cta";

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
 * user agent. Non-Safari iPhone gets IphoneAppBanner instead, so the section is
 * suppressed there to keep one install ask; everyone else gets it after mount.
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
      iphoneBannerOwnsInstallAsk({ userAgent: navigator.userAgent, pathname }),
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
