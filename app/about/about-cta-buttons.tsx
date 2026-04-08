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
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="bg-[#F78E42] text-[#252D6B] hover:bg-[#F78E42]/90 px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            asChild
          >
            <Link
              href={primaryHref}
              onClick={() => fireCtaClick("swell_analyzer", primaryHref)}
            >
              {primaryLabel}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-heading font-semibold rounded-full transition-all duration-300"
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
            className="text-sm text-medium hover:text-high underline underline-offset-4 transition-colors"
          >
            {tertiaryLabel}
          </a>
        </div>
      </SectionFadeUp>
    </>
  );
}
