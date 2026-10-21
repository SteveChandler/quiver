import { JsonLd } from "@/components/seo/funnel/JsonLd";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ExternalLink,
  ListChecks,
} from "lucide-react";

import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";
import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { buildPageMetadata } from "@/lib/seo/meta";

import {
  COMPARISON_SOURCE_LINKS,
  COMPARISON_SOURCE_REVIEW,
} from "./comparison-sources";

export const revalidate = 604800;

const PAGE_PATH = "/best-surf-forecast-app";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const APP_STORE_URL = IOS_APP_STORE_URL;
const SOURCE_LINK_CLASS =
  "inline-flex items-center gap-1 font-heading text-base font-black uppercase text-[#11100D] underline-offset-4 hover:text-[#9E5010] hover:underline";

export const metadata: Metadata = buildPageMetadata({
  title: "Best Surf App 2026: How to Choose a Surf Forecast App",
  description:
    "How to choose the best surf app in 2026: what to look for in forecasts, cams, alerts, and session logs, what surf apps cost, and where Quiver fits.",
  path: PAGE_PATH,
  keywords: [
    "best surf app",
    "best surf apps",
    "best surf forecast app",
    "surf forecast app",
    "best surf report app",
    "best free surf forecast app",
    "free surf forecast app",
    "best free surf report app",
    "best surf app for beginners",
    "best surf report app 2026",
    "how to choose a surf app",
    "surf app features",
  ],
  image:
    "/api/og/guide?title=Best%20Surf%20Forecast%20App&region=Compared",
});

// Steven, 2026-10-11: this page compares by capability and never names or
// links to other surf apps. __tests__/app/best-surf-forecast-app-metadata.test.ts
// enforces it.
interface SurfAppNeedRow {
  need: string;
  lookFor: string;
  quiver: string;
}

const FREE_FAQ_ITEMS = [
  {
    question: "What is the best free surf forecast app?",
    answer:
      "For iPhone surfers who want forecasts, conditions, tides, session logging, and a small alert setup without paying, Quiver is our pick. If live cams matter most, a cam-first app is the better fit, and if you like reading raw wind and swell maps yourself, a map app is.",
  },
  {
    question: "Can I use Quiver without paying?",
    answer:
      "Yes. Quiver's free tier includes forecasts, conditions, and tides for 280+ breaks; session logging with a free account; and one watched beach with up to three alert rules. The personal match score, ranked session windows, and personal alerts require Quiver Pro.",
  },
] as const;

const SURF_APP_FAQ_ITEMS = [
  {
    question: "What is the best surf app?",
    answer:
      "The one that answers your question fastest. Cam-first apps are best for watching the lineup, map apps for reading raw wind and swell, and global spot directories for surfing far from home. Quiver, our app, is built for a free per-beach forecast and the best window to go on US coasts.",
  },
  {
    question: "What is the best surf app for beginners?",
    answer:
      "One that tells you whether today is small and gentle enough to learn, not just a wave height. Quiver's beginner pages give a plain YES, MAYBE, or NO for learners at several US beaches. Whichever app you use, watch the water from shore before you paddle out.",
  },
  {
    question: "Are paid surf apps worth it?",
    answer:
      "If you check live cams most days or surf far from home, a paid cam-first plan can be worth it. If you mainly need a forecast and tides for a few home breaks, a free tier usually covers it.",
  },
  {
    question: "What should a surf forecast app show?",
    answer:
      "The forecast for your actual break, not just a region: wave height with swell period and direction, hourly wind, tide, and water temperature. A good app also tells you when the best window is, so you are not reading six charts before dawn.",
  },
  {
    question: "Is Quiver on Android?",
    answer:
      "Not publicly yet. Quiver's Android app is in closed testing. On Android you can use quiversurf.app in any browser for the same free forecasts, tides, and water temperature.",
  },
  {
    question: "Do surf apps have live cams?",
    answer:
      "Cam-first apps run their own cam networks, usually behind a subscription. Quiver shows public surf cams where they exist, alongside the forecast.",
  },
] as const;

const FAQ_ITEMS = [...SURF_APP_FAQ_ITEMS, ...FREE_FAQ_ITEMS];

const SURF_APP_NEEDS: SurfAppNeedRow[] = [
  {
    need: "Know if it's worth going today",
    lookFor: "A call for your actual beach and the best window to go, not a regional wave height.",
    quiver:
      "Per-beach forecast and best window for 280+ US, Hawaii, Puerto Rico, and Baja breaks, free on the web and iPhone.",
  },
  {
    need: "Learn to surf",
    lookFor: "A plain answer on whether today is small and gentle enough, plus tide and wind timing.",
    quiver: "Beginner pages give a YES, MAYBE, or NO for learners at each city's reference beach.",
  },
  {
    need: "Get pinged when it's good",
    lookFor: "Alerts on the breaks and conditions you care about, not generic swell warnings.",
    quiver:
      "Free: one watched beach with up to three alert rules. Pro only: personal match score, ranked session windows, and personal alerts.",
  },
  {
    need: "Learn what works for you",
    lookFor: "A session log that saves the conditions with every session, so patterns show up.",
    quiver: "Free session log that saves the conditions with each session; Pro adds a personal match score.",
  },
  {
    need: "Read the raw data yourself",
    lookFor: "Hourly swell height, period, direction, wind, and tide, with buoy readings.",
    quiver: "All of it per hour, with NOAA and CDIP buoy observations where a buoy is close enough.",
  },
  {
    need: "Watch the lineup before you drive",
    lookFor: "Live cams pointed at your break.",
    quiver: "Public surf cams where they exist. Not our strength: we don't run a big cam network of our own.",
  },
  {
    need: "Surf far from home",
    lookFor: "Worldwide spot coverage.",
    quiver: "Not our strength: Quiver covers the US, Hawaii, Puerto Rico, and Baja only.",
  },
  {
    need: "Pay little or nothing",
    lookFor:
      "A free tier that covers your daily check and clear pricing. Most surf apps are free to download, with paid plans from about $3 to $150 a year.",
    quiver: "Free tier above. Pro is $4.99/mo, $39.99/yr, or $119.99 lifetime.",
  },
  {
    need: "Use it on your phone",
    lookFor: "An app on your phone's platform.",
    quiver: "Web and iPhone today; Android is in closed testing.",
  },
];

interface BestForCard {
  id: string;
  heading: string;
  body: string;
  links: { href: string; label: string }[];
}

const BEST_FOR_CARDS: BestForCard[] = [
  {
    id: "best-surf-app-for-beginners",
    heading: "Best surf app for beginners",
    body:
      "Pick an app that says whether today is small and gentle enough to learn, not just how big it is. Quiver's beginner pages give a YES, MAYBE, or NO for learners at each city's reference beach, and the beginner conditions guide explains the numbers behind it. Whatever the app says, watch the water from shore first.",
    links: [
      { href: "/beginner/san-diego", label: "San Diego learner verdict" },
      { href: "/beginner/huntington-beach", label: "Huntington Beach learner verdict" },
      { href: "/learn/best-surf-conditions-for-beginners", label: "Best conditions for beginners" },
    ],
  },
  {
    id: "best-surf-app-west-coast",
    heading: "Best surf app for California and the West Coast",
    body:
      "If cams matter most, a cam-first app covers more of the coast. Quiver covers California breaks with a per-beach best window, tides, and water temperature, free on the web and iPhone, and shows public cams where they exist.",
    links: [
      { href: "/surf-cams/san-diego", label: "San Diego surf cams" },
      { href: "/beginner/santa-cruz", label: "Santa Cruz learner verdict" },
    ],
  },
  {
    id: "best-surf-app-east-coast",
    heading: "Best surf app for the East Coast and Gulf",
    body:
      "East Coast surf often comes from short-lived wind swell and passing storms, so hourly wind matters more than a long outlook. Quiver covers Florida, the Carolinas, New Jersey, New York, and Gulf breaks in Texas.",
    links: [{ href: "/beginner/cocoa-beach", label: "Cocoa Beach learner verdict" }],
  },
  {
    id: "best-surf-app-hawaii",
    heading: "Best surf app for Hawaii",
    body:
      "Hawaii swells are big, direction-specific, and break over reef, so swell direction and local knowledge count for more than height. Quiver covers Hawaii breaks with the same per-beach forecast, and its Honolulu beginner page points learners to gentler water.",
    links: [{ href: "/beginner/honolulu", label: "Honolulu learner verdict" }],
  },
  {
    id: "best-surf-log-app",
    heading: "Best surf app for logging sessions",
    body:
      "If you want your own history to shape what you check next, pick an app built around a session log, not a forecast alone. Quiver's session log is free with an account and saves the conditions with each session.",
    links: [{ href: "/surf-session-log", label: "How Quiver logs sessions" }],
  },
];

function formatVerifiedDate(lastVerified: string): string {
  const [year, month, day] = lastVerified.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Quiver's SoftwareApplication markup lives on exactly one page so the
 * aggregateRating + Offer requirements stay satisfied. That role moved here on
 * 2026-08-19 when /best-free-surf-forecast-app was consolidated into this page.
 * Do not duplicate this block onto other landing pages — see
 * __tests__/app/ahrefs-structured-data-regressions.test.ts.
 */
function SoftwareApplicationStructuredData(): ReactElement {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Quiver Surf App",
    applicationCategory: "SportsApplication",
    operatingSystem: "iOS",
    url: APP_STORE_URL,
    description:
      "Surf forecast app for iPhone and the web covering 280+ US, Hawaii, Puerto Rico, and Baja breaks, with free forecasts, tides, and session logging.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      ratingCount: "7",
    },
    publisher: {
      "@type": "Organization",
      name: "Quiver",
      url: SITE_URL,
    },
  };

  return (
    <JsonLd data={data} />
  );
}

function FreeIntentFaqStructuredData(): ReactElement {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <JsonLd data={data} />
  );
}

export default function BestSurfForecastAppPage(): ReactElement {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Best Surf Apps", url: PAGE_URL },
        ]}
      />
      <WebPageSchema
        name="Best Surf App in 2026: How to Choose a Surf Forecast App"
        description="What to look for in a surf forecast app, what surf apps cost, and where Quiver fits."
        url={PAGE_URL}
        dateModified={COMPARISON_SOURCE_REVIEW.lastVerified}
      />
      <SoftwareApplicationStructuredData />
      <FreeIntentFaqStructuredData />

      <ZineSurface
        sectionLabel="App comparison"
        editionLabel={`Checked ${COMPARISON_SOURCE_REVIEW.lastVerified}`}
        data-testid="best-surf-forecast-app-zine-surface"
      >
        <main className="overflow-hidden text-[#11100D]">
          <header className="relative grid gap-8 px-1 pb-10 pt-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute right-5 top-2 hidden w-36 rotate-3 opacity-85 md:block"
              priority
            />
            <div className="max-w-4xl">
              <p className="mb-4 inline-flex border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)]">
                Best surf apps
              </p>
              <h1 className="font-heading text-5xl font-black uppercase leading-[0.9] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl">
                Best Surf App in 2026: How to Choose One
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#252D6B] md:text-xl md:leading-9">
                The best surf app is the one that answers your question
                fastest. Some apps are built around live cams, some around raw
                wind and swell maps, some around worldwide spot lists, and some
                around your own sessions. Quiver is our app, built for one
                question on US coasts: which beach, which window, which board,
                and whether it is worth paddling out for you.
              </p>
            </div>

            <aside className="border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[7px_7px_0_rgba(17,16,13,0.22)]">
              <div className="flex items-center gap-2 font-heading text-xl font-black uppercase text-[#11100D]">
                <CalendarCheck className="h-5 w-5 text-[#F78E42]" aria-hidden />
                Last updated
              </div>
              <p className="mt-3 font-mono text-sm font-black uppercase tracking-[0.12em] text-[#252D6B]">
                {formatVerifiedDate(COMPARISON_SOURCE_REVIEW.lastVerified)}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
                Pricing, platform, and feature notes were checked on{" "}
                <span className="font-mono font-black">
                  {COMPARISON_SOURCE_REVIEW.lastVerified}
                </span>. Plans can change, so use the source links before
                buying.
              </p>
              <p className="mt-4 border-t-2 border-[#11100D] pt-3 text-sm font-black text-[#11100D]">
                Affiliation disclosure: Quiver is our app.
              </p>
            </aside>
          </header>

          <section className="border-y-2 border-[#11100D] bg-[#11100D] px-5 py-6 text-[#F4EBD8] shadow-[0_7px_0_rgba(17,16,13,0.18)]">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#F78E42]">
                  Recommendation model
                </p>
                <h2 className="mt-2 font-heading text-3xl font-black uppercase leading-none md:text-5xl">
                  Pick by capability, not by brand.
                </h2>
              </div>
              <Link
                href="/forecast-accuracy"
                className="inline-flex w-fit items-center justify-center gap-2 rounded-full border-2 border-[#F78E42] bg-[#F78E42] px-4 py-3 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#11100D] shadow-[4px_4px_0_rgba(247,142,66,0.24)] transition-transform hover:-translate-y-0.5"
              >
                Read the accuracy method
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          <section id="what-to-look-for" className="px-1 pt-12">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
              What to look for
            </p>
            <h2 className="mt-2 font-heading text-4xl font-black uppercase leading-none text-[#11100D] md:text-5xl">
              Pick a surf app by what you need
            </h2>
            <div className="mt-5 border-2 border-[#11100D] bg-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.2)]">
              <div
                aria-hidden
                className="hidden grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-4 border-b-2 border-[#11100D] bg-[#11100D] px-4 py-3 font-heading text-xs font-black uppercase tracking-[0.08em] text-[#F4EBD8] md:grid"
              >
                <span>What you need</span>
                <span>What to look for</span>
                <span>How Quiver does it</span>
              </div>
              <dl>
                {SURF_APP_NEEDS.map((row, index) => (
                  <div
                    key={row.need}
                    className={`grid gap-2 border-b-2 border-[#11100D] px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] md:gap-4 ${
                      index % 2 === 0 ? "bg-[#F4EBD8]" : "bg-[#EFE0C2]"
                    }`}
                  >
                    <dt className="font-heading text-lg font-black leading-6 text-[#11100D]">
                      {row.need}
                    </dt>
                    <dd className="font-semibold leading-6 text-[#252D6B]">
                      <span className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#9E5010] md:hidden">
                        Look for:{" "}
                      </span>
                      {row.lookFor}
                    </dd>
                    <dd className="font-semibold leading-6 text-[#252D6B]">
                      <span className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#9E5010] md:hidden">
                        Quiver:{" "}
                      </span>
                      {row.quiver}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
              Quiver is our app. Prices checked on{" "}
              <span className="font-mono font-black">
                {COMPARISON_SOURCE_REVIEW.lastVerified}
              </span>
              .
            </p>
          </section>

          <section
            id="best-free-surf-forecast-app"
            className="px-1 py-12"
          >
            <div className="border-2 border-[#11100D] bg-[#F8EFD8] p-6 shadow-[8px_8px_0_rgba(17,16,13,0.2)] md:p-8">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                Free app answer
              </p>
              <h2 className="mt-2 font-heading text-4xl font-black uppercase leading-none text-[#11100D] md:text-5xl">
                What is the best free surf forecast app?
              </h2>
              <div className="mt-5 grid gap-4 text-base font-semibold leading-7 text-[#252D6B] md:text-lg md:leading-8">
                <p>
                  For iPhone surfers who want forecast basics and session
                  logging without paying, Quiver is our pick. The free tier
                  includes forecasts, conditions, and tides for 280+ breaks;
                  session logging with a free account; and one watched beach
                  with up to three alert rules. The personal match score,
                  ranked session windows, and personal alerts are Quiver Pro
                  only.
                </p>
                <p>
                  &ldquo;Free&rdquo; means different things across surf apps.
                  Some give a short forecast with ads and charge for longer
                  range, some keep cams or alerts behind a subscription, and
                  government buoy data is free but raw. Check which of the
                  needs above a free tier actually covers before you pay.
                </p>
              </div>
            </div>
          </section>

          <section id="best-surf-app-for" className="px-1 py-8">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
              By surfer and coast
            </p>
            <h2 className="mt-2 font-heading text-4xl font-black uppercase leading-none text-[#11100D] md:text-5xl">
              Best surf app for you
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {BEST_FOR_CARDS.map((card) => (
                <article
                  key={card.id}
                  id={card.id}
                  className="border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[5px_5px_0_rgba(17,16,13,0.18)]"
                >
                  <h3 className="font-heading text-2xl font-black uppercase leading-none text-[#11100D]">
                    {card.heading}
                  </h3>
                  <p className="mt-3 font-semibold leading-7 text-[#252D6B]">{card.body}</p>
                  <div className="mt-3 grid gap-1">
                    {card.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                      >
                        {link.label}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
              <article
                id="when-quiver-is-not-the-pick"
                className="border-2 border-[#11100D] bg-[#11100D] p-5 text-[#F4EBD8] shadow-[5px_5px_0_rgba(17,16,13,0.18)]"
              >
                <h3 className="font-heading text-2xl font-black uppercase leading-none">
                  When to pick something other than Quiver
                </h3>
                <p className="mt-3 font-semibold leading-7">
                  You mostly surf outside the US, Hawaii, Puerto Rico, and
                  Baja. You want the biggest live-cam network. Or you need an
                  Android app today: Quiver for Android is in closed testing,
                  though quiversurf.app works in any browser.
                </p>
              </article>
            </div>
          </section>

          <section className="px-1 py-8">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
              Surf app FAQ
            </p>
            <h2 className="mt-2 font-heading text-4xl font-black uppercase leading-none text-[#11100D] md:text-5xl">
              Surf app questions
            </h2>
            <div className="mt-5 grid gap-3">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="group border-2 border-[#11100D] bg-[#F4EBD8] shadow-[5px_5px_0_rgba(17,16,13,0.18)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-lg font-black text-[#11100D]">
                    {item.question}
                    <span
                      className="shrink-0 text-[#9E5010] transition-transform group-open:rotate-180"
                      aria-hidden
                    >
                      ↓
                    </span>
                  </summary>
                  <p className="border-t-2 border-[#11100D] px-5 py-4 font-semibold leading-7 text-[#252D6B]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section className="grid gap-6 px-1 py-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative border-2 border-[#11100D] bg-[#F8EFD8] p-6 shadow-[7px_7px_0_rgba(17,16,13,0.2)]">
              <QuiverSticker
                sticker="spotSwellMatch"
                className="absolute -right-3 -top-8 hidden w-24 rotate-6 opacity-90 md:block"
              />
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                Next reads
              </p>
              <h2 className="mt-2 font-heading text-3xl font-black uppercase leading-none text-[#11100D] md:text-4xl">
                Choose the page that matches your intent
              </h2>
              <div className="mt-6 grid gap-3">
                <Link
                  href="#best-free-surf-forecast-app"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Compare the best free surf forecast apps
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/free-surf-reports"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  See what Quiver gives you for free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/surf-session-log"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  See how Quiver logs surf sessions
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/personal-surf-forecast"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  See how Quiver matches forecast conditions to you
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/vs/surfline"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  See a head-to-head comparison
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/vs/surfline/free"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Free alternatives to paid surf apps
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/forecast-accuracy"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Read the forecast accuracy method
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <figure className="mt-6 border-2 border-[#11100D] bg-[#F4EBD8] p-2 shadow-[5px_5px_0_rgba(17,16,13,0.18)]">
                <Image
                  src="/images/seo-scenes/san-onofre-clean.webp"
                  alt="Clean longboard surf at San Onofre"
                  width={1600}
                  height={900}
                  className="h-auto w-full"
                />
              </figure>
            </div>

            <div className="border-2 border-[#11100D] bg-[#F4EBD8] p-6 shadow-[7px_7px_0_rgba(17,16,13,0.18)]">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-[#F78E42]" aria-hidden />
                <h2 className="font-heading text-3xl font-black uppercase leading-none text-[#11100D]">
                  Sources checked
                </h2>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
                Source links and comparison facts were checked on{" "}
                <span className="font-mono font-black">
                  {COMPARISON_SOURCE_REVIEW.lastVerified}
                </span>.
              </p>
              <ul className="mt-5 grid gap-3">
                {COMPARISON_SOURCE_LINKS.map((source) => (
                  <li
                    key={source.label}
                    className="border-t-2 border-[#11100D]/25 pt-3"
                  >
                    {source.installCta ? (
                      <IosAppStoreCta
                        {...source.installCta}
                        className={SOURCE_LINK_CLASS}
                      >
                        {source.label}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </IosAppStoreCta>
                    ) : (
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className={SOURCE_LINK_CLASS}
                      >
                        {source.label}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#252D6B]">
                      {source.note}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
