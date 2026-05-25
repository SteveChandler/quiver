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

function FeatureIcon({ icon: Icon }: { icon: LucideIcon }): ReactElement {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#F78E42]/35 bg-[#F78E42]/12 text-[#FDB84B]">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export default function FeaturesPage(): ReactElement {
  return (
    <main className="min-h-screen bg-[#0D1020] text-white">
      <section className="relative overflow-hidden px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#7BDCB5]/45 bg-[#7BDCB5]/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#7BDCB5]">
              <Waves className="h-4 w-4" aria-hidden="true" />
              Native app features
            </div>
            <h1 className="font-heading text-5xl font-black leading-[0.94] tracking-normal text-white sm:text-6xl md:text-7xl">
              A surf app that gets personal.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-[#B8C7E0] md:text-xl">
              Quiver turns forecast checks, saved spots, session logs, and
              alerts into a surf call that is built around the way you actually
              paddle out.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <IosAppStoreCta
                source="features-hero-app-store"
                surface="features-page"
                placement="hero_primary"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F78E42] px-5 py-3 text-base font-black text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]"
              >
                {IOS_APP_STORE_CTA}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </IosAppStoreCta>
              <AndroidWaitlistCta
                source="features-hero-android-waitlist"
                surface="features-page"
                placement="hero_secondary"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 px-5 py-3 text-base font-black text-white transition hover:border-[#7BDCB5] hover:text-[#7BDCB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BDCB5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]"
              >
                Android waitlist
              </AndroidWaitlistCta>
            </div>

            <div className="mt-9 grid max-w-2xl gap-3">
              {HERO_POINTS.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#E6F0FF]"
                >
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#7BDCB5]"
                    aria-hidden="true"
                  />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-3 sm:gap-4 lg:max-w-none">
            {APP_SCREENS.map((screen, index) => (
              <figure
                key={screen.src}
                className="relative min-w-0 overflow-visible bg-transparent"
              >
                <div className="relative aspect-[9/19.5] overflow-hidden rounded-[30px] border border-[#7BDCB5]/55 bg-[#11100D] shadow-[0_0_0_4px_rgba(13,16,32,0.9),0_0_0_5px_rgba(123,220,181,0.2),0_28px_60px_rgba(0,0,0,0.5)]">
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
                <figcaption className="pt-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#B8C7E0]">
                  {screen.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F4EBD8] px-4 py-16 text-[#11100D] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#9E5010]">
              The loop
            </p>
            <h2 className="mt-3 font-heading text-4xl font-black leading-tight tracking-normal md:text-5xl">
              Every session you log dials in the next call.
            </h2>
            <p className="mt-4 text-lg font-semibold leading-8 text-[#34415E]">
              Every surf app can show the ocean model. Quiver closes the loop:
              what you checked, where you went, and how the session actually
              felt.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {LOOP_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="rounded-md border-2 border-[#11100D] bg-[#FFF8E8] p-5 shadow-[5px_5px_0_rgba(17,16,13,0.16)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#252D6B] text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-sm font-black text-[#9E5010]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 font-heading text-2xl font-black">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#4B5567]">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#121832] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#7BDCB5]">
                Built for the app
              </p>
              <h2 className="mt-3 font-heading text-4xl font-black leading-tight tracking-normal text-white md:text-5xl">
                Not a report. A forecast that knows your breaks.
              </h2>
            </div>
            <p className="max-w-md text-sm font-semibold leading-6 text-[#9AABC6]">
              This is why Quiver isn&apos;t another surf report you check and
              forget.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {NATIVE_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-md border border-white/12 bg-white/[0.045] p-5 shadow-xl shadow-black/20"
                >
                  <div className="flex items-center gap-3">
                    <FeatureIcon icon={Icon} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FDB84B]">
                        {feature.eyebrow}
                      </p>
                      <h3 className="mt-1 font-heading text-2xl font-black text-white">
                        {feature.title}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-5 min-h-[112px] text-base font-semibold leading-7 text-[#B8C7E0]">
                    {feature.body}
                  </p>
                  <div className="relative mx-auto mt-8 w-full max-w-[346px] lg:max-w-[286px]">
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-8 -bottom-5 h-12 rounded-full bg-black/45 blur-xl"
                    />
                    <div className="relative rounded-[44px] bg-[#F4EBD8] p-2 shadow-[0_0_0_2px_rgba(253,184,75,0.34),0_0_44px_rgba(253,184,75,0.32),0_34px_86px_rgba(0,0,0,0.66)]">
                      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[36px] border-2 border-[#FDB84B] bg-[#080B18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
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
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#0D1020] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 border-y border-white/12 py-12 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)] md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FDB84B]">
              Get the app
            </p>
            <h2 className="mt-3 font-heading text-4xl font-black leading-tight tracking-normal text-white md:text-5xl">
              Make tomorrow&apos;s forecast about your surfing.
            </h2>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-[#B8C7E0]">
              Install Quiver, save the spots you care about, set the alerts you
              actually want, and start feeding your sessions back into the loop.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <IosAppStoreCta
              source="features-final-app-store"
              surface="features-page"
              placement="final_cta"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F78E42] px-5 py-3 text-base font-black text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]"
            >
              {IOS_APP_STORE_CTA}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </IosAppStoreCta>
            <AndroidWaitlistCta
              source="features-final-android-waitlist"
              surface="features-page"
              placement="final_secondary"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 px-5 py-3 text-base font-black text-white transition hover:border-[#7BDCB5] hover:text-[#7BDCB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BDCB5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]"
            >
              Join Android waitlist
            </AndroidWaitlistCta>
          </div>
        </div>
      </section>
    </main>
  );
}
