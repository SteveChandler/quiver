import {
  Apple,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CloudOff,
  Heart,
  Navigation,
  Smartphone,
  Sparkles,
  Waves,
} from "lucide-react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";

import { FoundingAccessCta } from "@/components/pricing/founding-access-cta";
import { RevenueCatWebCheckoutCta } from "@/components/pricing/revenuecat-web-checkout-cta";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  QuiverSticker,
  type QuiverStickerProps,
  ZineSurface,
} from "@/components/zine";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
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
  const barrelWaveFigure = (
    <figure
      data-testid="plans-barrel-wave"
      className="mt-4 max-w-3xl border-2 border-[#11100D] bg-[#F0E5CC] p-2 shadow-[4px_5px_0_rgba(17,16,13,0.2)] sm:mt-6 sm:p-3"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <Image
          src="/images/hero/hero-2-barrel-wave.webp"
          alt="A surfer in a bright pink rash guard carving through the wall of a turquoise barrel wave."
          width={1920}
          height={1080}
          sizes="(min-width: 1024px) 768px, calc(100vw - 2rem)"
          className="h-full w-full object-cover"
        />
      </div>
    </figure>
  );

  return (
    <ZineSurface
      sectionLabel="Get the app"
      editionLabel="14 days free on iPhone"
      data-testid="founding-offer-zine-surface"
    >
      <section>
        <header className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <QuiverSticker
              sticker="halftoneCircle"
              className="absolute -left-10 -top-6 w-36 -rotate-12 opacity-40 sm:left-2 sm:w-44"
              sizes="11rem"
            />
            <QuiverSticker
              sticker="breakingWave"
              className="absolute -right-16 top-2 hidden w-72 rotate-6 opacity-30 md:block"
              sizes="18rem"
            />
          </div>

          <ScrollReveal>
            <div className="relative max-w-3xl">
              <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                Get Quiver
              </h1>
              <p className="mt-4 max-w-2xl text-xl leading-relaxed text-[#11100D]/75 sm:mt-6 sm:text-2xl">
                Start the iPhone app with 14 days free. Android beta is open
                through Google Play closed testing.
              </p>
              <a
                href={IOS_APP_STORE_WEB_REDIRECT_PATH}
                className="mt-6 inline-flex min-h-12 w-full max-w-2xl items-center justify-center gap-2 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-6 font-semibold text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.35)] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D] sm:hidden"
              >
                {IOS_APP_STORE_CTA}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <div className="mt-5 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65 sm:mt-7">
                <span>14 days free</span>
                <span aria-hidden>/</span>
                <span>Cancel anytime</span>
              </div>
              {barrelWaveFigure}
            </div>
          </ScrollReveal>
        </header>

        <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <ScrollReveal>
            <section
              className="torn torn-tb relative border-2 border-[#11100D] bg-[#FBF6E8]"
              aria-labelledby="plans-trial-heading"
            >
              <QuiverSticker
                sticker="creamTornStrip"
                className="pointer-events-none absolute -right-4 -top-6 w-28 rotate-6 opacity-90"
                sizes="7rem"
              />
              <div className="mb-4 flex items-center gap-2 font-display text-lg font-black uppercase text-[#11100D]">
                <Sparkles className="h-5 w-5 text-[#F78E42]" aria-hidden />
                Pro
              </div>
              <h2
                id="plans-trial-heading"
                className="max-w-xl font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
              >
                Get surf essentials that keep learning from your sessions
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#11100D]/74">
                14 days free. After that, the App Store shows the current plan
                before you subscribe.
              </p>

              <div
                className="mt-6 space-y-3 sm:space-y-4"
                aria-label="Quiver Pro trial timeline"
              >
                {TRIAL_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="circled bg-[#F78E42]/35">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        {step.label !== "Day 14" ? (
                          <div className="mt-1 h-4 w-[2px] bg-[#11100D]/25 sm:h-5" />
                        ) : null}
                      </div>
                      <p className="pt-1.5 text-sm leading-6 text-[#11100D]/74">
                        <span className="font-semibold text-[#11100D]">
                          {step.label}:
                        </span>{" "}
                        {step.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              <a
                href={IOS_APP_STORE_WEB_REDIRECT_PATH}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-6 font-semibold text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D] sm:max-w-sm"
              >
                {IOS_APP_STORE_CTA}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <p className="mt-3 text-center text-xs font-medium text-[#11100D]/64 sm:max-w-sm">
                Cancel anytime in Apple subscriptions.
              </p>

              <RevenueCatWebCheckoutCta />

              <div className="mt-6 border-t-2 border-dashed border-[#11100D]/30 pt-5 sm:max-w-sm">
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border-2 border-[#11100D] bg-[#FFF7E6] px-3 py-2 shadow-[2px_2px_0_rgba(17,16,13,0.18)]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#11100D]">
                      <Apple className="h-4 w-4 text-[#F78E42]" aria-hidden />
                      iPhone
                    </div>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#252D6B]">
                      Available
                    </p>
                  </div>
                  <div className="rounded-full border-2 border-[#11100D] bg-[#FFF7E6] px-3 py-2 shadow-[2px_2px_0_rgba(17,16,13,0.18)]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#11100D]">
                      <Smartphone
                        className="h-4 w-4 text-[#252D6B]"
                        aria-hidden
                      />
                      Android
                    </div>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#252D6B]">
                      Beta open
                    </p>
                  </div>
                </div>
                <FoundingAccessCta className="mt-3" variant="compact" />
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <section
              className="relative border-2 border-[#11100D] bg-[#F0E5CC] p-6 shadow-[3px_4px_0_rgba(17,16,13,0.18)] sm:p-8"
              aria-labelledby="plans-included-heading"
            >
              <QuiverSticker
                sticker="navyLightning"
                className="pointer-events-none absolute -right-3 -top-4 w-20 rotate-12 opacity-40"
                sizes="5rem"
              />
              <p id="plans-included-heading" className="typewriter mb-1">
                Pro membership includes
              </p>
              <div className="mt-5 divide-y-2 divide-dashed divide-[#11100D]/20">
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
                        <Icon
                          className="relative z-10 h-6 w-6 text-[#252D6B]"
                          aria-hidden
                        />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-black uppercase leading-tight text-[#11100D] sm:text-lg">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-[#11100D]/70">
                          {feature.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </ScrollReveal>
        </div>
      </section>
    </ZineSurface>
  );
}
