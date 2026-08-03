"use client";

import { useEffect, useState, type ReactElement } from "react";

import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import {
  getFirstTouchPlatform,
  type FirstTouchPlatform,
} from "@/lib/analytics/web-context";

interface InstallAppCtaSectionProps {
  source: string;
  surface: string;
  placement: string;
  /** Personalizes the heading, e.g. "Check Blacks from the lineup". */
  beachName?: string;
}

/**
 * In-content install section for SEO/long-form surfaces (Plan 063 T1).
 * Device-aware via NativeAppFunnelCta: iOS → App Store, Android → beta
 * waitlist, desktop → send-to-phone. Rendered client-side only so the
 * platform decision never mismatches SSR output.
 */
export function InstallAppCtaSection({
  source,
  surface,
  placement,
  beachName,
}: InstallAppCtaSectionProps): ReactElement | null {
  const [platform, setPlatform] = useState<FirstTouchPlatform | null>(null);

  useEffect(() => {
    setPlatform(getFirstTouchPlatform());
  }, []);

  if (!platform) return null;

  const heading = beachName
    ? `Check ${beachName} from the app`
    : "Check the surf from the app";

  return (
    <section
      aria-label="Get the Quiver app"
      className="my-6 -rotate-1 rounded-lg rounded-tr-3xl border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[3px_4px_0_rgba(17,16,13,0.25)]"
    >
      <h2 className="font-heading text-xl font-bold tracking-tight text-[#11100D]">
        {heading}
      </h2>
      <p className="mt-1 mb-4 text-sm text-[#11100D]/80">
        Dawn-patrol calls, session logging, and swell alerts — free in the app.
      </p>
      <NativeAppFunnelCta
        platform={platform}
        source={source}
        surface={surface}
        placement={placement}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#F78E42] px-6 py-3 font-sans text-sm font-bold text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
      />
    </section>
  );
}
