import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import {
  ArrowRight,
  Clock3,
  MapPinned,
  Radio,
  ShieldCheck,
  Waves,
} from "lucide-react";

import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema, type FAQItem } from "@/components/seo/faq-schema";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 604800;

const PAGE_PATH = "/free-surf-reports";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const DATE_MODIFIED = "2026-06-21";

export const metadata: Metadata = buildPageMetadata({
  title: "Free Surf Reports, Forecasts & Conditions",
  description:
    "Free surf reports for 279+ beaches with wave height, swell period, wind, tide, water temp, crowd intel, and best surf windows.",
  path: PAGE_PATH,
  image: "/images/seo-scenes/la-jolla-scripps-clean.webp",
  keywords: [
    "free surf reports",
    "free surf report",
    "free surf forecast",
    "free surf forecast app",
    "best free surf forecast",
    "surf report app",
    "surf conditions free",
    "surfline alternative",
  ],
});

interface ReportFeature {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface ReportStep {
  label: string;
  title: string;
  description: string;
}

interface ReportLink {
  href: string;
  title: string;
  description: string;
}

const REPORT_FEATURES: ReportFeature[] = [
  {
    title: "Wave and swell read",
    description:
      "Height, period, direction, and secondary swell context so you know whether the number has push or just looks big.",
    icon: Waves,
  },
  {
    title: "Wind and tide timing",
    description:
      "Hourly windows pair wind direction with the tide curve, because a clean mid-tide hour beats a bigger blown-out headline.",
    icon: Clock3,
  },
  {
    title: "Beach-level calls",
    description:
      "Every spot has a different exposure window. Quiver turns open-ocean data into a local call for the beach you actually surf.",
    icon: MapPinned,
  },
  {
    title: "Transparent data sources",
    description:
      "Forecasts are built from public marine models, buoy observations, tide stations, and local correction layers where available.",
    icon: Radio,
  },
];

const REPORT_STEPS: ReportStep[] = [
  {
    label: "01",
    title: "Start with live marine data",
    description:
      "Quiver pulls swell, wind, tide, and water temp from public ocean sources — the raw ingredients, nothing hidden behind a paywall.",
  },
  {
    label: "02",
    title: "Score each beach locally",
    description:
      "The same west swell that fires one break can miss the one next door. Quiver weighs each spot's exposure, tide window, and wind shelter — not just the open-ocean number.",
  },
  {
    label: "03",
    title: "Show the surf call plainly",
    description:
      "You get the best window, what's helping it, what's hurting it, and whether it's worth the drive.",
  },
];

const INTERNAL_LINKS: ReportLink[] = [
  {
    href: "/best-surf-forecast-app#best-free-surf-forecast-app",
    title: "Best free surf forecast app",
    description:
      "Compare Quiver, Surfline, Surf-Forecast.com, Surf Captain, LazySurfer, Windy, and NDBC.",
  },
  {
    href: "/vs/surfline/free",
    title: "Surfline free alternative",
    description:
      "See how Quiver's free surf reports compare with Surfline's free tier.",
  },
  {
    href: "/features",
    title: "Quiver features",
    description: "Review the free and signup-powered tools across Quiver.",
  },
  {
    href: "/forecast",
    title: "Regional surf forecast",
    description: "Check the 7-day call for California, Hawaii, Florida, Puerto Rico, and more.",
  },
  {
    href: "/map",
    title: "Find surf spots near you",
    description: "Browse beaches by location and compare which breaks are catching the swell.",
  },
  {
    href: "/learn/how-to-read-surf-conditions",
    title: "How to read a surf report",
    description: "Learn the order: period, direction, wind, tide, then height.",
  },
  {
    href: "/vs/surfline",
    title: "Quiver vs Surfline",
    description: "Compare forecasts, cams, tide charts, session logs, and accuracy transparency.",
  },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Are Quiver surf reports really free?",
    answer:
      "Yes. Quiver shows surf reports, tide charts, swell details, water temperature, crowd intel, and best surf windows without a forecast paywall.",
  },
  {
    question: "What does a free surf report include?",
    answer:
      "A useful surf report should include wave height, swell period, swell direction, wind speed and direction, tide timing, water temperature, and a clear call on the best session window.",
  },
  {
    question: "How often are Quiver surf reports updated?",
    answer:
      "Quiver updates forecast conditions throughout the day as new model, buoy, tide, and weather data becomes available. Many surf-report surfaces refresh around 3-hour forecast windows.",
  },
  {
    question: "What areas does Quiver cover?",
    answer:
      "Quiver covers 279+ beaches across California, Hawaii, Florida, Oregon, Washington, New Jersey, New York, the Carolinas, New England, Texas, Puerto Rico, and Baja.",
  },
  {
    question: "What makes Quiver different from a basic surf report?",
    answer:
      "Quiver is built around beach-specific calls. It does not stop at raw height. It weighs period, direction, wind, tide, and local exposure so the report tells you whether the session is actually worth it.",
  },
];

export default function FreeSurfReportsPage(): ReactElement {
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Free Surf Reports", url: PAGE_URL },
  ];

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <FAQSchema items={FAQ_ITEMS} />
      <WebPageSchema
        name="Free Surf Reports, Forecasts & Conditions"
        description="Free surf reports for 279+ beaches with wave height, swell period, wind, tide, water temp, crowd intel, and best surf windows."
        url={PAGE_URL}
        dateModified={DATE_MODIFIED}
      />

      <ZineSurface
        sectionLabel="Free reports"
        editionLabel="No forecast paywall"
        data-testid="free-surf-reports-zine-surface"
      >
        <main>
          <header className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
            <ScrollReveal>
              <div className="relative">
                <QuiverSticker
                  sticker="orangeTape"
                  className="absolute -top-8 right-8 hidden w-36 rotate-6 opacity-85 sm:block"
                />
                <p className="label-black mb-5">Free surf reports</p>
                <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                  Free Surf Reports
                </h1>
                <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
                  Quiver gives you every surf report, tide chart, swell read,
                  and session window for 279+ beaches without a forecast
                  paywall.
                </p>
                <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
                  <span>279+ beaches</span>
                  <span aria-hidden>/</span>
                  <span>3-hour windows</span>
                  <span aria-hidden>/</span>
                  <span>$0 forecast paywall</span>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/forecast"
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
                  >
                    Check the forecast
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/map"
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
                  >
                    Browse beaches
                    <MapPinned className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <div className="polaroid rot-2">
                <div className="photo" style={{ aspectRatio: "16 / 10" }}>
                  <Image
                    src="/images/seo-scenes/la-jolla-scripps-clean.webp"
                    alt="Clean waves breaking near Scripps Pier in La Jolla"
                    fill
                    className="object-cover object-center saturate-[0.9]"
                    sizes="(min-width: 1024px) 440px, 100vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-[#252D6B]/5 mix-blend-multiply" />
                  <QuiverSticker
                    sticker="spotSwellMatch"
                    className="absolute -bottom-7 -right-5 w-28 rotate-6 drop-shadow-md"
                  />
                </div>
                <p className="cap">real surf, free report</p>
              </div>
            </ScrollReveal>
          </header>

          <ScrollReveal>
            <section className="torn torn-tb rot-neg mt-12 border-2 border-[#11100D] bg-[#F0E5CC]">
              <div className="grid gap-5 md:grid-cols-[0.92fr_1.08fr] md:items-center">
                <div>
                  <p className="typewriter mb-2">The short answer</p>
                  <h2 className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
                    A free surf report should still make the call.
                  </h2>
                </div>
                <p className="text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
                  A surf report is not just a wave-height number. The useful
                  call is the full combo: period for power, direction for
                  exposure, wind for surface quality, tide for shape, water temp
                  for gear, and crowd context for whether the spot is worth the
                  drive.
                </p>
              </div>
            </section>
          </ScrollReveal>

          <section className="mt-14" aria-labelledby="included-heading">
            <ScrollReveal>
              <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                <div>
                  <p className="typewriter mb-2">Included</p>
                  <h2
                    id="included-heading"
                    className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                  >
                    What you get in a Quiver surf report
                  </h2>
                </div>
                <QuiverSticker
                  sticker="spotWindRead"
                  className="hidden w-16 rotate-6 drop-shadow-sm sm:block"
                />
              </div>
            </ScrollReveal>

            <div className="grid gap-5 sm:grid-cols-2">
              {REPORT_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <ScrollReveal key={feature.title} delay={index * 60}>
                    <div className="torn torn-tb min-h-[13rem] border-2 border-[#11100D] bg-[#FBF6E8]">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="circled bg-[#F78E42]/35">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-sm leading-relaxed text-[#11100D]/70">
                        {feature.description}
                      </p>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </section>

          <ScrollReveal>
            <section className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="relative">
                <QuiverSticker
                  sticker="creamTape"
                  className="absolute -top-6 left-8 z-10 w-28 -rotate-6 opacity-90"
                />
                <div className="polaroid rot-neg">
                  <div className="photo">
                    <Image
                      src="/images/seo-scenes/san-onofre-clean.webp"
                      alt="Clean waves breaking with surfers in the lineup"
                      fill
                      className="object-cover object-center saturate-[0.9]"
                      sizes="(min-width: 1024px) 420px, 100vw"
                    />
                  </div>
                  <p className="cap">check the lineup first</p>
                </div>
              </div>

              <div>
                <p className="label-black mb-5">How it works</p>
                <div className="space-y-4">
                  {REPORT_STEPS.map((step) => (
                    <div
                      key={step.label}
                      className="notebook grid gap-3 sm:grid-cols-[3rem_1fr]"
                    >
                      <span className="font-mono text-sm font-bold text-[#B56A2B]">
                        {step.label}
                      </span>
                      <div>
                        <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#11100D]/70">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </ScrollReveal>

          <InlineSignupCta
            title="Save your home break"
            description="Pick your local beach and Quiver will surface the cleanest surf windows, tide timing, and conditions that fit your spot."
            primaryButtonText="Save my surf report"
            source="free_surf_reports"
            ctaCopyVariant="free_surf_reports_v1"
            className="my-12"
            variant="zine"
          />

          <ScrollReveal>
            <section className="hazards-panel mt-14" aria-labelledby="free-vs-basic-heading">
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#F2C94C]">
                    Free does not mean thin
                  </p>
                  <h2
                    id="free-vs-basic-heading"
                    className="mt-3 font-display text-3xl font-black uppercase leading-none text-[#F4EBD8] sm:text-4xl"
                  >
                    A useful report tells you what to do next.
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Best window",
                    "Why it works",
                    "What could ruin it",
                  ].map((item) => (
                    <div
                      key={item}
                      className="border-2 border-[#F4EBD8]/70 bg-[#F4EBD8] p-4 text-[#11100D]"
                    >
                      <ShieldCheck className="mb-3 h-5 w-5" aria-hidden />
                      <p className="font-display text-lg font-black uppercase leading-tight">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </ScrollReveal>

          <section className="mt-14" aria-labelledby="next-links-heading">
            <ScrollReveal>
              <div className="mb-5 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                <p className="typewriter mb-2">Next paddle</p>
                <h2
                  id="next-links-heading"
                  className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                >
                  Start with the free report, then go deeper
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid gap-4 sm:grid-cols-2">
              {INTERNAL_LINKS.map((link) => (
                <ScrollReveal key={link.href}>
                  <Link
                    href={link.href}
                    className="group block min-h-28 border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
                  >
                    <span className="text-sm font-bold text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                      {link.title}
                    </span>
                    <p className="mt-1 text-xs leading-relaxed text-[#11100D]/62">
                      {link.description}
                    </p>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </section>

          <ScrollReveal>
            <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-10">
              <h2 className="mb-6 font-display text-2xl font-black uppercase text-[#11100D]">
                Free Surf Report FAQ
              </h2>
              <div className="space-y-4">
                {FAQ_ITEMS.map((faq) => (
                  <details
                    key={faq.question}
                    className="group torn border-2 border-[#11100D] bg-[#FBF6E8] open:bg-[#F0E5CC]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-black uppercase text-[#11100D] transition-colors hover:text-[#B56A2B] [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <span className="shrink-0 font-mono text-2xl leading-none transition-transform duration-200 group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-sm leading-relaxed text-[#11100D]/72">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </ScrollReveal>
        </main>
      </ZineSurface>

      <StickySignupBar
        source="free_surf_reports"
        ctaText="Save my report"
        supportingText="Get the cleanest windows for your beach"
        ctaCopyVariant="free_surf_reports_v1"
      />
    </>
  );
}
