"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";
import {
  getIphoneAppBannerDecision,
  IPHONE_APP_BANNER_DISMISSAL_STORAGE_KEY,
  IPHONE_APP_BANNER_SOURCE,
  type IphoneAppBannerDecision,
} from "@/lib/app-store/iphone-app-banner";

function getIsStandalone(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    navigatorWithStandalone.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

function getDismissedAt(): string | null {
  try {
    return window.localStorage.getItem(IPHONE_APP_BANNER_DISMISSAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setDismissedAt(): void {
  try {
    window.localStorage.setItem(
      IPHONE_APP_BANNER_DISMISSAL_STORAGE_KEY,
      new Date().toISOString(),
    );
  } catch {
    // Ignore storage failures so private browsing modes do not break the page.
  }
}

export function IphoneAppBanner() {
  const pathname = usePathname();
  const trackedKeysRef = useRef<Set<string>>(new Set());
  const [decision, setDecision] = useState<IphoneAppBannerDecision | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  const analyticsProps = useMemo(() => {
    if (!decision) return null;

    return {
      source: IPHONE_APP_BANNER_SOURCE,
      platform: "ios",
      cta_family: "ios_app",
      cta_text: IOS_APP_STORE_CTA,
      destination_type: "app_store",
      destination_status: IOS_APP_STORE_DESTINATION_STATUS,
      destination_url: IOS_APP_STORE_WEB_REDIRECT_PATH,
      browser: decision.browser,
      pathname,
      ...(decision.suppressionReason
        ? { suppression_reason: decision.suppressionReason }
        : {}),
    };
  }, [decision, pathname]);

  const trackOnce = useCallback(
    (event: string, props: Record<string, unknown>) => {
      const key = `${event}:${pathname}:${props.suppression_reason ?? "shown"}`;
      if (trackedKeysRef.current.has(key)) return;
      trackedKeysRef.current.add(key);
      track(event, props);
    },
    [pathname],
  );

  useEffect(() => {
    const nextDecision = getIphoneAppBannerDecision({
      userAgent: window.navigator.userAgent,
      pathname,
      isStandalone: getIsStandalone(),
      dismissedAt: getDismissedAt(),
    });

    setDecision(nextDecision);
    setDismissed(false);
  }, [pathname]);

  useEffect(() => {
    if (!decision || !analyticsProps) return;
    if (!decision.isIphone) return;

    if (decision.isEligible) {
      trackOnce("iphone_app_banner_eligible", analyticsProps);
    }

    if (decision.shouldShow) {
      trackOnce("iphone_app_banner_view", analyticsProps);
      return;
    }

    if (decision.suppressionReason) {
      trackOnce("iphone_app_banner_suppressed", analyticsProps);
    }
  }, [analyticsProps, decision, trackOnce]);

  if (!decision?.shouldShow || dismissed || !analyticsProps) return null;

  const handleDismiss = () => {
    setDismissedAt();
    setDismissed(true);
    track("iphone_app_banner_dismiss", analyticsProps);
  };

  const handleClick = () => {
    track("iphone_app_banner_click", analyticsProps);
  };

  return (
    <aside
      aria-label="Quiver iPhone app"
      data-testid="iphone-app-banner"
      className="border-b border-white/10 bg-[#111B46] px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Image
          src="/quiver-app-icon-128.png"
          alt=""
          width={44}
          height={44}
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-[10px] shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold leading-5">
            Quiver for iPhone
          </p>
          <p className="truncate text-xs leading-5 text-white/70">
            Surf calls, alerts, and session logs in the app.
          </p>
        </div>
        <a
          href={IOS_APP_STORE_WEB_REDIRECT_PATH}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="shrink-0 rounded-full bg-[#F78E42] px-4 py-2 text-xs font-semibold text-[#252D6B] transition hover:bg-[#FFAA63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111B46]"
        >
          {IOS_APP_STORE_CTA}
        </a>
        <button
          type="button"
          aria-label="Dismiss iPhone app banner"
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
