"use client";

import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { createClientAppHandoffLink } from "@/lib/analytics/app-handoff-link";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  buildAppHandoffUrl,
  type HandoffParams,
} from "@/lib/constants/app-handoff";
import {
  IOS_APP_STORE_CAMPAIGNS,
  IOS_APP_STORE_CTA,
} from "@/lib/constants/app-store";

const SHARE_LANDING_SOURCE = "share_landing";
const EXACT_CALL_RETRY_SOURCE = "app_spot_handoff";
const SHARE_LANDING_SURFACE = "app_spot";
const SHARE_LANDING_PLACEMENT = "app_store_fallback";

interface ShareLandingStoreCtaProps {
  shareId: string | null;
  /** False for exact-call retries from our own handoff, which stay on the web campaign. */
  isShareLink: boolean;
  className?: string;
  children?: ReactNode;
}

type ShareLandingTrackingFields = HandoffParams & {
  source: string;
  surface: string;
  placement: string;
  share_id?: string;
};

function buildTrackingFields(
  isShareLink: boolean,
  shareId: string | null,
): ShareLandingTrackingFields {
  if (!isShareLink) {
    return {
      source: EXACT_CALL_RETRY_SOURCE,
      surface: SHARE_LANDING_SURFACE,
      placement: SHARE_LANDING_PLACEMENT,
    };
  }
  return {
    source: SHARE_LANDING_SOURCE,
    surface: SHARE_LANDING_SURFACE,
    placement: SHARE_LANDING_PLACEMENT,
    utm_source: "share",
    utm_medium: "link",
    utm_campaign: IOS_APP_STORE_CAMPAIGNS.SHARE,
    ...(shareId ? { utm_content: shareId, share_id: shareId } : {}),
  };
}

/**
 * Store CTA for shared beach and window links. The tap is the existing
 * cta_click row (utm_campaign=share, utm_content=<share id>); the handoff
 * route then redirects with ct=share.
 */
export function ShareLandingStoreCta({
  shareId,
  isShareLink,
  className,
  children,
}: ShareLandingStoreCtaProps): ReactElement {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hasTrackedView = useRef(false);
  const trackingFields = buildTrackingFields(isShareLink, shareId);
  const { share_id: _shareId, ...handoffParams } = trackingFields;
  const handoffUrl = buildAppHandoffUrl(handoffParams);

  useEffect(() => {
    const link = linkRef.current;
    if (!link || hasTrackedView.current) return;

    const trackView = (): void => {
      if (hasTrackedView.current) return;
      hasTrackedView.current = true;
      trackIosAppCtaView({ ...trackingFields, destination_url: handoffUrl });
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
    // trackingFields is derived from the same inputs handoffUrl encodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffUrl]);

  return (
    <a
      ref={linkRef}
      href={handoffUrl}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        const handoff = createClientAppHandoffLink(handoffParams);
        event.currentTarget.href = handoff.url;
        trackIosAppCtaClick({
          ...trackingFields,
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
