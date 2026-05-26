"use client";

import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";

interface IosAppStoreCtaProps {
  source: string;
  surface: string;
  placement: string;
  className?: string;
  children?: ReactNode;
}

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
      href={IOS_APP_STORE_URL}
      className={className}
      onClick={() => {
        trackIosAppCtaClick({
          source,
          surface,
          placement,
          cta_text: IOS_APP_STORE_CTA,
          destination_url: IOS_APP_STORE_URL,
        });
      }}
    >
      {children ?? IOS_APP_STORE_CTA}
    </a>
  );
}
