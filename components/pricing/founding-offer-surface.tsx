import Link from "next/link";
import {
  Apple,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CloudOff,
  Heart,
  MapPinned,
  Navigation,
  Smartphone,
  Sparkles,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { FoundingAccessCta } from "@/components/pricing/founding-access-cta";
import { Button } from "@/components/ui/button";
import { QuiverSticker, type QuiverStickerProps } from "@/components/zine";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";

const TRIAL_STEPS = [
  {
    icon: CheckCircle2,
    label: "Today",
    body: "Start your free trial in the App Store.",
  },
  {
    icon: BellRing,
    label: "Day 12",
    body: "Get a trial reminder before it ends.",
  },
  {
    icon: CalendarClock,
    label: "Day 14",
    body: "Your Apple-managed plan begins unless you cancel.",
  },
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  label: string;
  body: string;
}>;

const PRO_FEATURES = [
  {
    icon: Sparkles,
    title: "Personal forecasting",
    body: "Saved beaches and session feedback help Quiver tune the call around how you surf.",
    sticker: "goldTape",
  },
  {
    icon: Navigation,
    title: "Best spot + paddle window",
    body: "See the nearby move and the timing that looks most worth chasing.",
    sticker: "tealTape",
  },
  {
    icon: Waves,
    title: "Board-aware picks",
    body: "Get recommendations that account for the boards in your quiver.",
    sticker: "creamTornStrip",
  },
  {
    icon: BellRing,
    title: "Similarity alerts",
    body: "Get nudged when a setup starts matching your best logged sessions.",
    sticker: "tealTape",
  },
  {
    icon: MapPinned,
    title: "Custom spots",
    body: "Create and forecast the tucked-away breaks you actually care about.",
    sticker: "creamTornStrip",
  },
  {
    icon: Heart,
    title: "Unlimited favorites",
    body: "Save more than the free tier's three beaches and keep your coast organized.",
    sticker: "goldTape",
  },
  {
    icon: CloudOff,
    title: "Offline session saving",
    body: "Log sessions when signal drops, then sync them when you're back online.",
    sticker: "tealTape",
  },
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  title: string;
  body: string;
  sticker: QuiverStickerProps["sticker"];
}>;

export function FoundingOfferSurface() {
  return (
    <div
      className="zine-tab bg-[#0D1020] text-white"
      data-testid="founding-offer-zine-surface"
    >
      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(37,45,107,0.92),rgba(13,16,32,0.98)_62%)]"
        />
        <div
          aria-hidden
          className="noise-texture-subtle absolute inset-0 opacity-45"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <QuiverSticker
            sticker="halftoneCircle"
            className="absolute -left-10 top-24 w-40 -rotate-12 opacity-45 mix-blend-screen sm:left-8 sm:w-52"
            sizes="13rem"
          />
          <QuiverSticker
            sticker="breakingWave"
            className="absolute -right-24 top-20 hidden w-80 rotate-6 opacity-35 mix-blend-screen md:block"
            sizes="20rem"
          />
          <QuiverSticker
            sticker="blackBrushScrap"
            className="absolute bottom-4 left-[48%] hidden w-28 -rotate-6 opacity-30 mix-blend-multiply md:block"
            sizes="7rem"
          />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <div className="relative mb-5 inline-flex items-center gap-2 border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#11100D] shadow-[3px_4px_0_rgba(247,142,66,0.55)]">
              <QuiverSticker
                sticker="orangeTape"
                className="absolute -left-8 -top-5 w-24 -rotate-12 opacity-85"
                sizes="6rem"
              />
              <Waves className="h-4 w-4" />
              App Store live
            </div>
            <h1 className="max-w-4xl font-heading text-3xl font-bold leading-tight tracking-normal text-white sm:text-5xl md:text-6xl">
              Get Quiver
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#B8C7E0] sm:mt-6 sm:text-lg sm:leading-8">
              Start the iPhone app with 14 days free. Android is coming soon,
              and the waitlist is open.
            </p>
          </div>

          <div className="mt-8 grid overflow-hidden rounded-[24px] border-2 border-[#11100D] bg-[#F4EBD8] text-[#11100D] shadow-[8px_10px_0_rgba(247,142,66,0.32)] sm:mt-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
            <div className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
              <QuiverSticker
                sticker="orangeTape"
                className="pointer-events-none absolute right-6 top-5 w-24 rotate-12 opacity-70"
                sizes="6rem"
              />
              <div className="mb-5 flex items-center gap-2 font-heading text-lg font-bold">
                <Sparkles className="h-5 w-5 text-[#F78E42]" />
                Pro
              </div>
              <h2 className="max-w-xl font-heading text-2xl font-bold leading-tight tracking-normal text-[#11100D] sm:text-4xl">
                Get surf essentials that keep learning from your sessions
              </h2>
              <p className="mt-4 text-base leading-7 text-[#4B4030]">
                14 days free. After that, the App Store shows the current plan
                before you subscribe.
              </p>

              <div
                className="mt-5 space-y-3 sm:mt-6 sm:space-y-4"
                aria-label="Quiver Pro trial timeline"
              >
                {TRIAL_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DFE9FF] text-[#252D6B] sm:h-9 sm:w-9">
                          <Icon className="h-4 w-4" />
                        </div>
                        {step.label !== "Day 14" ? (
                          <div className="h-4 w-1 bg-[#DFE9FF] sm:h-5" />
                        ) : null}
                      </div>
                      <p className="pt-1 text-sm leading-6 text-[#4B4030]">
                        <span className="font-semibold text-[#11100D]">
                          {step.label}:
                        </span>{" "}
                        {step.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              <Button
                asChild
                size="lg"
                className="mt-7 min-h-14 w-full rounded-full bg-[#11100D] px-6 font-semibold text-[#F4EBD8] hover:bg-[#252D6B] focus-visible:ring-[#F78E42] focus-visible:ring-offset-[#F4EBD8] sm:max-w-sm"
              >
                <Link href={IOS_APP_STORE_URL}>
                  {IOS_APP_STORE_CTA}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-4 text-center text-xs font-medium text-[#4B4030] sm:max-w-sm">
                Cancel anytime in Apple subscriptions.
              </p>

              <div className="mt-6 border-t-2 border-[#11100D]/15 pt-5 sm:max-w-sm">
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-[#11100D]/20 bg-[#FFF7E6] px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Apple className="h-4 w-4 text-[#F78E42]" />
                      iPhone
                    </div>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#252D6B]">
                      App Store live
                    </p>
                  </div>
                  <div className="rounded-full border border-[#11100D]/20 bg-[#FFF7E6] px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Smartphone className="h-4 w-4 text-[#7BDCB5]" />
                      Android
                    </div>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#252D6B]">
                      Coming soon
                    </p>
                  </div>
                </div>
                <FoundingAccessCta className="mt-3" variant="compact" />
              </div>
            </div>

            <div className="relative border-t-2 border-[#11100D] bg-[#FFF9EA] p-6 sm:p-8 lg:border-l-2 lg:border-t-0 lg:p-10">
              <QuiverSticker
                sticker="navyLightning"
                className="pointer-events-none absolute right-5 top-5 w-20 rotate-12 opacity-35"
                sizes="5rem"
              />
              <p className="text-sm font-medium uppercase tracking-widest text-[#6B6256]">
                Pro membership includes
              </p>
              <div className="mt-5 divide-y divide-[#11100D]/12">
                {PRO_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 py-4 first:pt-0 sm:grid-cols-[4rem_minmax(0,1fr)]"
                      data-testid="plans-pro-feature"
                    >
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border-2 border-[#11100D] bg-[#D9EEF4] shadow-[3px_4px_0_rgba(17,16,13,0.16)] sm:h-14 sm:w-14">
                        <QuiverSticker
                          sticker={feature.sticker}
                          className="absolute -right-6 -top-4 w-20 rotate-12 opacity-55"
                          sizes="5rem"
                        />
                        <Icon className="relative z-10 h-6 w-6 text-[#252D6B]" />
                      </div>
                      <div>
                        <h3 className="font-heading text-base font-bold tracking-normal text-[#11100D] sm:text-lg">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-[#4B4030]">
                          {feature.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
