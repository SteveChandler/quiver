"use client";

import type { ReactElement } from "react";

import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

interface PlatformStatusStripProps {
  platform: FirstTouchPlatform;
}

const PLATFORM_STRIP_CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[12px_5px_14px_6px] bg-ocean-blue-decorative px-5 py-2.5 font-heading text-sm font-bold text-background shadow-[0_3px_0_rgba(0,0,0,0.28)] transition hover:bg-[#D57835] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue-decorative focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-[#C06A25]";

export function PlatformStatusStrip({
  platform,
}: PlatformStatusStripProps): ReactElement {
  return (
    <section className="border-y border-white/10 bg-card/70 px-5 py-4 text-foreground">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="font-heading text-lg font-bold">
            iPhone is live. Android beta is open.
          </p>
          <p className="mt-1 max-w-2xl font-sans text-sm leading-6 text-muted-foreground">
            {platform === "desktop"
              ? "Scan the QR or send the link above when you are ready to move Quiver to your phone."
              : platform === "android"
                ? "Install today for personalized surf decisions and a clear best window before you paddle out."
                : "You are on the right path for this device. Keep the surf call close before you paddle out."}
          </p>
        </div>

        {platform === "desktop" ? null : (
          <NativeAppFunnelCta
            platform={platform}
            source="landing_platform_strip"
            surface="landing-page"
            placement="platform_strip"
            variant="app_first"
            cohort="app_first"
            className={PLATFORM_STRIP_CTA_CLASS}
          />
        )}
      </div>
    </section>
  );
}
