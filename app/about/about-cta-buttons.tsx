"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";
import { Button } from "@/components/ui/button";
import { SectionFadeUp } from "@/components/shared/section-fade-up";

type AboutCtaButtonsProps = {
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  tertiaryLabel: string;
  tertiaryHref: string;
};

type AboutCtaAction = "swell_analyzer" | "home_break" | "contact";

const SOURCE = "about-tools-cta";

function fireCtaClick(action: AboutCtaAction, destination: string) {
  if (typeof window === "undefined") return;

  // GA4 (rich attribution via the existing track helper)
  track("cta_click", {
    source: SOURCE,
    action,
    destination,
  });

  // user_events (dashboard measurement)
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "cta_click",
        metadata: {
          source: SOURCE,
          action,
          destination,
        },
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never break navigation
  }
}

export function AboutCtaButtons({
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  tertiaryLabel,
  tertiaryHref,
}: AboutCtaButtonsProps) {
  return (
    <>
      <SectionFadeUp delay={0.3}>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="min-h-12 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-7 py-3 text-base font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42]"
            asChild
          >
            <Link
              href={primaryHref}
              onClick={() => fireCtaClick("swell_analyzer", primaryHref)}
            >
              {primaryLabel}
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="min-h-12 rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-7 py-3 text-base font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#FBF6E8]"
            asChild
          >
            <Link
              href={secondaryHref}
              onClick={() => fireCtaClick("home_break", secondaryHref)}
            >
              {secondaryLabel}
            </Link>
          </Button>
        </div>
      </SectionFadeUp>
      <SectionFadeUp delay={0.45}>
        <div className="mt-6 text-center">
          <a
            href={tertiaryHref}
            onClick={() => fireCtaClick("contact", tertiaryHref)}
            className="text-sm font-medium text-[#11100D]/65 underline underline-offset-4 transition-colors hover:text-[#B56A2B]"
          >
            {tertiaryLabel}
          </a>
        </div>
      </SectionFadeUp>
    </>
  );
}
