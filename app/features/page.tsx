import type { Metadata } from "next";
import Image from "next/image";
import type { ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ListChecks,
  MapPinned,
  Route,
  Sparkles,
  Waves,
} from "lucide-react";

import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { IOS_APP_STORE_CTA } from "@/lib/constants/app-store";
import { buildPageMetadata } from "@/lib/seo/meta";

const FEATURES_DESCRIPTION =
  "Get Quiver's iPhone surf forecast app for personal forecasts, the forecast-log feedback loop, custom spots, and custom surf alerts.";

export const metadata: Metadata = buildPageMetadata({
  title: "Quiver App Features | Personal Surf Forecasts",
  description: FEATURES_DESCRIPTION,
  path: "/features",
  image: "/images/hero/quiver-landing-hero-social.jpg",
  keywords: [
    "surf forecast app",
    "personal surf forecast",
    "custom surf alerts",
    "custom surf spots",
    "surf session log app",
    "iPhone surf app",
    "Quiver app features",
  ],
});

type Feature = {
  title: string;
  body: string;
  icon: LucideIcon;
  eyebrow: string;
  imageSrc: string;
  imageAlt: string;
};

type LoopStep = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const HERO_POINTS = [
  "Personal forecasts tuned to how and where you surf",
  "A forecast-log loop that learns from real sessions",
  "Custom spots and custom alerts for the days worth chasing",
] as const;

const LOOP_STEPS: LoopStep[] = [
  {
    title: "Check",
    body: "Open one clear call for your spot before you drive.",
    icon: Waves,
  },
  {
    title: "Surf",
    body: "Paddle out with the context behind the call.",
    icon: Route,
  },
  {
    title: "Log",
    body: "Save what actually happened: board, rating, notes, and conditions.",
    icon: ListChecks,
  },
  {
    title: "Tune",
    body: "Quiver turns your session history into a sharper next forecast.",
    icon: Sparkles,
  },
] as const;

const NATIVE_FEATURES: Feature[] = [
  {
    title: "Personal forecasting and the loop",
    body: "Quiver does not stop at a generic surf report. You check a forecast, log the session, and the app builds a better read on what works for you.",
    icon: Sparkles,
    eyebrow: "Forecast -> log -> learn",
    imageSrc: "/images/app-screenshots/native-features/beach-detail-personal.png",
    imageAlt:
      "Quiver beach detail screen showing a personal match prompt and forecast feedback controls.",
  },
  {
    title: "Custom spots",
    body: "Save the breaks and tucked-away zones you actually care about, then compare them without rebuilding your dawn patrol from scratch.",
    icon: MapPinned,
    eyebrow: "Your coast, saved",
    imageSrc: "/images/app-screenshots/native-features/save-custom-spot.png",
    imageAlt:
      "Quiver custom spot editor with name, break type, visibility, and local rules map.",
  },
  {
    title: "Custom alerts",
    body: "Set alerts for the setup you are waiting on: swell, wind, tide, and the kind of session Quiver knows you want to repeat.",
    icon: BellRing,
    eyebrow: "Conditions, not spam",
    imageSrc: "/images/app-screenshots/native-features/alerts.png",
    imageAlt: "Quiver alerts screen with a small clean longboard wave preset.",
  },
] as const;

const APP_SCREENS = [
  {
    src: "/images/app-screenshots/native-features/home-loop.png",
    alt: "Quiver home screen showing a session logging prompt and surf conditions.",
    label: "Loop",
  },
  {
    src: "/images/app-screenshots/native-features/explore-beaches.png",
    alt: "Quiver explore screen showing 300 beaches and saved beach cards.",
    label: "Explore",
  },
  {
    src: "/images/app-screenshots/native-features/alerts.png",
    alt: "Quiver alerts screen showing condition alert controls.",
    label: "Alerts",
  },
] as const;

export default function FeaturesPage(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="App features"
      editionLabel="Built for the loop"
      data-testid="features-zine-surface"
    >
      <main>
        <header className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <ScrollReveal>
            <div className="relative">
              <QuiverSticker
                sticker="orangeTape"
                className="absolute -top-8 left-4 hidden w-36 -rotate-6 opacity-85 sm:block"
              />
              <p className="label-black mb-5">Native app features</p>
              <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                A surf app that gets personal.
              </h1>
              <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
                Quiver turns forecast checks, saved spots, session logs, and
                alerts into a surf call that is built around the way you actually
                paddle out.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <IosAppStoreCta
                  source="features-hero-app-store"
                  surface="features-page"
                  placement="hero_primary"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
                >
                  {IOS_APP_STORE_CTA}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </IosAppStoreCta>
                <AndroidWaitlistCta
                  source="features-hero-android-waitlist"
                  surface="features-page"
                  placement="hero_secondary"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
                >
                  Android waitlist
                </AndroidWaitlistCta>
              </div>

              <div className="mt-9 grid max-w-2xl gap-3">
                {HERO_POINTS.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 text-sm leading-6 text-[#11100D]/78"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#B56A2B]"
                      aria-hidden="true"
                    />
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-3 sm:gap-4 lg:max-w-none">
              {APP_SCREENS.map((screen, index) => (
                <figure key={screen.src} className="relative min-w-0">
                  <div className="relative aspect-[9/19.5] overflow-hidden rounded-[24px] border-2 border-[#11100D] bg-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.3)]">
                    <Image
                      src={screen.src}
                      alt={screen.alt}
                      fill
                      priority={index === 0}
                      loading={index === 0 ? undefined : "eager"}
                      sizes="(min-width: 1024px) 170px, 28vw"
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="pt-3 text-center font-mono text-xs uppercase tracking-[0.18em] text-[#11100D]/65">
                    {screen.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </ScrollReveal>
        </header>

        <section className="mt-14" aria-labelledby="loop-heading">
          <ScrollReveal>
            <div className="relative">
              <QuiverSticker
                sticker="forecastWaveMark"
                className="absolute -top-10 right-2 hidden w-20 rotate-6 drop-shadow-sm sm:block"
              />
              <p className="typewriter mb-2">The loop</p>
              <h2
                id="loop-heading"
                className="max-w-3xl font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl"
              >
                Every session you log dials in the next call.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
                Every surf app can show the ocean model. Quiver closes the loop:
                what you checked, where you went, and how the session actually
                felt.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {LOOP_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.title} delay={index * 60}>
                  <div className="torn torn-tb min-h-[12rem] border-2 border-[#11100D] bg-[#FBF6E8]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="circled bg-[#F78E42]/35">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-sm font-bold text-[#B56A2B]">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#11100D]/70">
                      {step.body}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="native-heading">
          <ScrollReveal>
            <div className="mb-8 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
              <div className="max-w-3xl">
                <p className="typewriter mb-2">Built for the app</p>
                <h2
                  id="native-heading"
                  className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl"
                >
                  Not a report. A forecast that knows your breaks.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-[#11100D]/70">
                  This is why Quiver isn&apos;t another surf report you check and
                  forget.
                </p>
              </div>
              <QuiverSticker
                sticker="goldRightArrow"
                className="hidden w-20 rotate-6 drop-shadow-sm lg:block"
              />
            </div>
          </ScrollReveal>

          <div className="grid gap-5 lg:grid-cols-3">
            {NATIVE_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <ScrollReveal key={feature.title} delay={index * 60}>
                  <article className="torn flex h-full flex-col border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[2px_3px_0_rgba(17,16,13,0.22)]">
                    <div className="flex items-center gap-3">
                      <span className="circled bg-[#252D6B]/12">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#B56A2B]">
                          {feature.eyebrow}
                        </p>
                        <h3 className="mt-1 font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                          {feature.title}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-5 min-h-[112px] text-sm leading-relaxed text-[#11100D]/70">
                      {feature.body}
                    </p>
                    <div className="relative mx-auto mt-auto w-full max-w-[286px] pt-6">
                      <div className="polaroid rot-2">
                        <div className="photo aspect-[9/19.5]">
                          <Image
                            src={feature.imageSrc}
                            alt={feature.imageAlt}
                            fill
                            loading="eager"
                            sizes="(min-width: 1024px) 270px, 82vw"
                            className="object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        <ScrollReveal>
          <section className="torn torn-tb rot-neg mt-16 border-2 border-[#11100D] bg-[#F0E5CC]">
            <div className="grid gap-6 lg:grid-cols-[0.92fr_0.55fr] lg:items-center">
              <div>
                <p className="label-black mb-5">Get the app</p>
                <h2 className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
                  Make tomorrow&apos;s forecast about your surfing.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
                  Install Quiver, save the spots you care about, set the alerts
                  you actually want, and start feeding your sessions back into
                  the loop.
                </p>
              </div>
              <div className="relative flex flex-col gap-3 lg:items-end">
                <QuiverSticker
                  sticker="creamTape"
                  className="absolute -top-9 right-2 hidden w-32 rotate-6 opacity-90 lg:block"
                />
                <IosAppStoreCta
                  source="features-final-app-store"
                  surface="features-page"
                  placement="final_cta"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
                >
                  {IOS_APP_STORE_CTA}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </IosAppStoreCta>
                <AndroidWaitlistCta
                  source="features-final-android-waitlist"
                  surface="features-page"
                  placement="final_secondary"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
                >
                  Join Android waitlist
                </AndroidWaitlistCta>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>
    </ZineSurface>
  );
}
