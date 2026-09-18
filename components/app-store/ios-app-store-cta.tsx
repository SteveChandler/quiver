"use client";

import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
} from "@/lib/constants/app-store";
import { createClientAppHandoffLink } from "@/lib/analytics/app-handoff-link";
import { buildAppHandoffUrl } from "@/lib/constants/app-handoff";

interface IosAppStoreCtaProps {
  source: string;
  surface: string;
  placement: string;
  className?: string;
  children?: ReactNode;
}

const IOS_APP_HANDOFF_URL = buildAppHandoffUrl({
  source: "ios_app_cta",
  surface: "web",
  placement: "app_store_cta",
});

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
        destination_url: IOS_APP_HANDOFF_URL,
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
      href={IOS_APP_HANDOFF_URL}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        const handoff = createClientAppHandoffLink({
          source,
          surface,
          placement,
        });
        event.currentTarget.href = handoff.url;
        trackIosAppCtaClick({
          source,
          surface,
          placement,
          cta_text: IOS_APP_STORE_CTA,
          destination_url: handoff.url,
          handoff_id: handoff.handoffId,
        });
      }}
    >
      {children ?? IOS_APP_STORE_CTA}
    </a>
  );
}
