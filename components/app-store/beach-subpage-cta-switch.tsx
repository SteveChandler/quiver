"use client";

import {
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";
import { AlertCaptureCta } from "@/components/seo/alert-capture-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { shouldShowBeachSubPageInstallCta } from "@/lib/app-store/beach-subpage-install-cta";

interface BeachSubPageCtaSwitchProps {
  beachId: string;
  beachName: string;
  children: ReactNode;
  installCtaEnabled: boolean;
  placement: string;
  pathname: string;
  pageType: "tides" | "water-temp";
  proof?: { value: string; label: string };
  searchReferralCta: { ctaText: string; supportingText: string };
  source: string;
  stickyCtaText: string;
  stickySupportingText: string;
}

export function BeachSubPageCtaSwitch({
  beachId,
  beachName,
  children,
  installCtaEnabled,
  placement,
  pathname,
  pageType,
  proof,
  searchReferralCta,
  source,
  stickyCtaText,
  stickySupportingText,
}: BeachSubPageCtaSwitchProps): ReactElement {
  // Match the static HTML during hydration; platform detection enhances this
  // path after mount without introducing a server/client markup mismatch.
  const [shouldRenderInstallCta, setShouldRenderInstallCta] = useState(false);

  useEffect(() => {
    if (!installCtaEnabled) {
      setShouldRenderInstallCta(false);
      return;
    }

    setShouldRenderInstallCta(
      shouldShowBeachSubPageInstallCta({
        enabled: installCtaEnabled,
        pathname,
        userAgent: navigator.userAgent,
      }),
    );
  }, [installCtaEnabled, pathname]);

  return (
    <>
      {shouldRenderInstallCta ? (
        <div className="container mx-auto px-4">
          <InstallAppCtaSection
            platform="ios"
            source={source}
            surface="beach-subpage"
            placement={placement}
            beachName={beachName}
            proof={proof}
          />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <AlertCaptureCta
            pageContext={pageType}
            beachId={beachId}
            beachName={beachName}
            source={`${source}-inline`}
            variant="paper"
          />
        </div>
      )}

      {children}

      {shouldRenderInstallCta ? null : (
        <StickySignupBar
          source={source}
          ctaText={stickyCtaText}
          supportingText={stickySupportingText}
          searchReferralCta={searchReferralCta}
        />
      )}
    </>
  );
}
