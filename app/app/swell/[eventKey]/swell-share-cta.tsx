"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone } from "lucide-react";

import { createClientAppHandoffLink } from "@/lib/analytics/app-handoff-link";
import {
  SWELL_SHARE_SURFACE,
  trackSwellShareCtaClick,
  trackSwellShareOpened,
  type SwellSharePlacement,
} from "@/lib/analytics/swell-share-tracking";
import {
  buildAppHandoffUrl,
  iosAppStoreUrlWithCampaign,
  type HandoffParams,
} from "@/lib/constants/app-handoff";
import {
  ANDROID_BETA_LANDING_PATH,
  IOS_APP_STORE_CAMPAIGNS,
} from "@/lib/constants/app-store";
import type { SwellKind } from "@/lib/notifications/copy/swell-card-headline";

// Long enough for the OS to background the page when the app opens.
const STORE_FALLBACK_DELAY_MS = 1600;

const STORE_HANDOFF_PARAMS: HandoffParams = {
  source: SWELL_SHARE_SURFACE,
  surface: SWELL_SHARE_SURFACE,
  placement: "store_fallback",
  utm_source: "share",
  utm_medium: "link",
  utm_campaign: IOS_APP_STORE_CAMPAIGNS.SHARE,
  utm_content: "swell",
};

const PRIMARY_CLASS =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-[#F78E42] px-5 py-3 text-lg font-black text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101436]";
const SECONDARY_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/25 bg-white/10 px-5 py-3 text-base font-black text-white transition hover:border-[#FDB84B]/70 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101436]";

interface SwellShareCtaProps {
  platform: "ios" | "android" | "desktop";
  kind: SwellKind;
  /** Null when the link did not resolve to a stored event. */
  eventKey: string | null;
  /** quiver://swell/... deep link; null when there is no event to open. */
  appUrl: string | null;
  /** This page's canonical URL, for the desktop QR code. */
  shareUrl: string;
}

/**
 * The install funnel for a shared swell. On a phone the main button tries the
 * app and falls through to the store when nothing takes over the page, so a
 * visitor without Quiver lands on the install screen from the same tap.
 */
export function SwellShareCta({
  platform,
  kind,
  eventKey,
  appUrl,
  shareUrl,
}: SwellShareCtaProps): ReactElement {
  const fallbackTimer = useRef<number | null>(null);
  const opened = useRef(false);
  const storeHandoffUrl = buildAppHandoffUrl(STORE_HANDOFF_PARAMS);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackSwellShareOpened({ kind, eventKey, platform });
  }, [eventKey, kind, platform]);

  useEffect(() => {
    const cancelFallback = (): void => {
      if (fallbackTimer.current === null) return;
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    };
    const onVisibilityChange = (): void => {
      if (document.hidden) cancelFallback();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", cancelFallback);
    return () => {
      cancelFallback();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", cancelFallback);
    };
  }, []);

  const trackClick = (placement: SwellSharePlacement, destinationUrl: string): void => {
    trackSwellShareCtaClick({ kind, eventKey, placement, platform, destinationUrl });
  };

  const freshStoreUrl = (): string => createClientAppHandoffLink(STORE_HANDOFF_PARAMS).url;

  const onOpenInApp = (): void => {
    if (!appUrl) return;
    trackClick("open_in_quiver", appUrl);
    if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(() => {
      fallbackTimer.current = null;
      if (document.hidden) return;
      // eslint-disable-next-line no-restricted-properties -- Leaves the site for the external store handoff; the router cannot navigate there.
      window.location.assign(freshStoreUrl());
    }, STORE_FALLBACK_DELAY_MS);
  };

  if (platform === "desktop") {
    const appStoreUrl = iosAppStoreUrlWithCampaign(IOS_APP_STORE_CAMPAIGNS.SHARE);
    return (
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="rounded-md bg-white p-3">
          <QRCodeSVG
            value={shareUrl}
            size={148}
            fgColor="#252D6B"
            title="Scan to open this swell on your phone"
          />
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FDB84B]">
            Scan with your phone
          </p>
          <a
            href={appStoreUrl}
            className={PRIMARY_CLASS}
            onClick={() => trackClick("desktop_app_store", appStoreUrl)}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Get Quiver for iPhone
          </a>
          <a
            href={ANDROID_BETA_LANDING_PATH}
            className={SECONDARY_CLASS}
            onClick={() => trackClick("desktop_android", ANDROID_BETA_LANDING_PATH)}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Get Quiver for Android
          </a>
        </div>
      </div>
    );
  }

  const storeLabel = platform === "ios" ? "Get Quiver on the App Store" : "Get Quiver for Android";

  return (
    <div className="flex flex-col gap-3">
      {appUrl ? (
        <a href={appUrl} className={PRIMARY_CLASS} onClick={onOpenInApp}>
          <Smartphone className="h-5 w-5" aria-hidden="true" />
          Open in Quiver
        </a>
      ) : null}
      <a
        href={storeHandoffUrl}
        className={appUrl ? SECONDARY_CLASS : PRIMARY_CLASS}
        onClick={(event) => {
          const url = freshStoreUrl();
          event.currentTarget.href = url;
          trackClick(appUrl ? "store_fallback" : "store_primary", url);
        }}
      >
        <Download className="h-5 w-5" aria-hidden="true" />
        {appUrl ? `No app yet? ${storeLabel}` : storeLabel}
      </a>
    </div>
  );
}
