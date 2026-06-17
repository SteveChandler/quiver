"use client";

import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  APP_FIRST_CAMPAIGN,
  IOS_APP_STORE_CTA,
  iosAppStoreUrlWithCampaign,
} from "@/lib/constants/app-store";

interface IosAppStoreCtaProps {
  source: string;
  surface: string;
  placement: string;
  className?: string;
  children?: ReactNode;
}

const IOS_APP_STORE_CAMPAIGN_URL =
  iosAppStoreUrlWithCampaign(APP_FIRST_CAMPAIGN);

export function IosAppStoreCta({
  source,
  surface,
  placement,
  className,
  children,
}: IosAppStoreCtaProps): ReactElement {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    const link = linkRef.current;
    if (!link || hasTrackedView.current) return;

    const trackView = (): void => {
      if (hasTrackedView.current) return;
      hasTrackedView.current = true;
      trackIosAppCtaView({
        source,
        surface,
        placement,
        destination_url: IOS_APP_STORE_CAMPAIGN_URL,
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      trackView();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        trackView();
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(link);

    return () => observer.disconnect();
  }, [placement, source, surface]);

  return (
    <a
      ref={linkRef}
      href={IOS_APP_STORE_CAMPAIGN_URL}
      className={className}
      onClick={() => {
        trackIosAppCtaClick({
          source,
          surface,
          placement,
          cta_text: IOS_APP_STORE_CTA,
          destination_url: IOS_APP_STORE_CAMPAIGN_URL,
        });
      }}
    >
      {children ?? IOS_APP_STORE_CTA}
    </a>
  );
}
