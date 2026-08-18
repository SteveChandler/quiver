"use client";

import { useEffect, useState, type ReactElement } from "react";

import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import {
  getFirstTouchPlatform,
  type FirstTouchPlatform,
} from "@/lib/analytics/web-context";

interface InstallAppCtaSectionProps {
  platform?: FirstTouchPlatform;
  source: string;
  surface: string;
  placement: string;
  /** Personalizes the heading, e.g. "Check Blacks in the app". */
  beachName?: string;
  /**
   * One real, already-fetched figure from the page (water temp, next high tide).
   * Proof beats adjectives: a number the visitor can check against reality does
   * more than a list of claims. Omit rather than invent one.
   */
  proof?: { value: string; label: string };
}

const VALUE_CHIPS = ["Dawn patrol", "Session log", "Alerts"];

/**
 * In-content install section for SEO/long-form surfaces (Plan 063 T1).
 * Device-aware via NativeAppFunnelCta: iOS → App Store, Android → beta
 * waitlist, desktop → send-to-phone.
 *
 * Renders on the server when `platform` is supplied, which avoids the
 * client-only null flash; it falls back to client detection only when the
 * caller cannot resolve the platform itself.
 */
export function InstallAppCtaSection({
  platform,
  source,
  surface,
  placement,
  beachName,
  proof,
}: InstallAppCtaSectionProps): ReactElement | null {
  const [detectedPlatform, setDetectedPlatform] =
    useState<FirstTouchPlatform | null>(null);

  useEffect(() => {
    if (platform) return;

    setDetectedPlatform(getFirstTouchPlatform());
  }, [platform]);

  const resolvedPlatform = platform ?? detectedPlatform;

  if (!resolvedPlatform) return null;

  return (
    <section
      aria-label="Get the Quiver app"
      className="install-cta my-8 w-full -rotate-1 rounded-lg rounded-tr-3xl border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_5px_0_rgba(17,16,13,0.85)] md:rotate-0"
    >
      {beachName ? (
        <p className="install-cta-eyebrow truncate font-sans text-[11px] font-semibold tracking-wide text-[#11100D]/65 uppercase">
          {beachName}
        </p>
      ) : null}
      <h2 className="install-cta-heading font-heading text-lg font-bold tracking-tight text-[#11100D] md:text-xl">
        Check the surf in the app
      </h2>
      {proof ? (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-heading text-4xl leading-none font-bold text-[#11100D] tabular-nums md:text-5xl">
            {proof.value}
          </span>
          <span className="font-sans text-xs font-semibold tracking-wide text-[#11100D]/65 uppercase">
            {proof.label}
          </span>
        </p>
      ) : null}
      <p className="mt-3 mb-3 text-sm text-[#11100D]/80">
        Everything here, plus the parts that only work on your phone — free.
      </p>
      <ul className="mb-4 flex flex-wrap gap-1" aria-label="What you get">
        {VALUE_CHIPS.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-[#11100D]/50 px-2 py-1 font-sans text-[11px] font-semibold text-[#11100D]/75"
          >
            {chip}
          </li>
        ))}
      </ul>
      <NativeAppFunnelCta
        platform={resolvedPlatform}
        source={source}
        surface={surface}
        placement={placement}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#F78E42] px-6 py-3 font-sans text-sm font-bold text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
      />
    </section>
  );
}
