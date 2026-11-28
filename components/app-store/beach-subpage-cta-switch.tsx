"use client";

import {
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";
import { StickyInstallAsk } from "@/components/app-store/sticky-install-ask";
import { shouldShowBeachSubPageInstallCta } from "@/lib/app-store/beach-subpage-install-cta";
import {
  installBarOwnsInstallAsk,
  isStandaloneDisplay,
} from "@/lib/app-store/install-bar";

interface BeachSubPageCtaSwitchProps {
  beachName: string;
  /** Optional wrapped content; the sub-page below-fold sections were removed. */
  children?: ReactNode;
  installCtaEnabled: boolean;
  placement: string;
  pathname: string;
  proof?: { value: string; label: string };
  searchReferralCta: { ctaText: string; supportingText: string };
  source: string;
  stickyCtaText: string;
  stickySupportingText: string;
}

export function BeachSubPageCtaSwitch({
  beachName,
  children,
  installCtaEnabled,
  placement,
  pathname,
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

    const userAgent = navigator.userAgent;
    // One ask at a time: where the install bar owns the page (beach tides, every
    // iPhone browser) the bar is the ask and this section stays out.
    const barOwnsPage = installBarOwnsInstallAsk({
      userAgent,
      pathname,
      isStandalone: isStandaloneDisplay(),
    });
    setShouldRenderInstallCta(
      !barOwnsPage &&
        shouldShowBeachSubPageInstallCta({
          enabled: installCtaEnabled,
          pathname,
          userAgent,
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
      ) : null}

      {children}

      {shouldRenderInstallCta ? null : (
        <StickyInstallAsk
          stickySignup={{
            source,
            ctaText: stickyCtaText,
            supportingText: stickySupportingText,
            searchReferralCta,
          }}
          bar={{ placeName: beachName, source }}
        />
      )}
    </>
  );
}
