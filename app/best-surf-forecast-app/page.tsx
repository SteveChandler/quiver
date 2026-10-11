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
import { buildPageMetadata } from "@/lib/seo/meta";

import {
  COMPARISON_SOURCE_LINKS,
  COMPARISON_SOURCE_REVIEW,
} from "./comparison-sources";

export const revalidate = 604800;

const PAGE_PATH = "/best-surf-forecast-app";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const APP_STORE_URL = IOS_APP_STORE_URL;

export const metadata: Metadata = buildPageMetadata({
  title: "Best Surf Apps 2026: Free & Paid Surf Forecast Apps",
  description:
    "The best surf apps for 2026: Surfline, Quiver, Windy, Surf-Forecast.com and more, compared on free tiers, prices, platforms, and who each suits.",
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
    "surf forecast app comparison",
    "surfline alternative",
  ],
  image:
    "/api/og/guide?title=Best%20Surf%20Forecast%20App&region=Compared",
});

interface AppComparisonRow {
  job: string;
  bestPick: string;
  why: string;
  freeTier: string;
  tradeoff: string;
  sourceHref: string;
}

const FREE_FAQ_ITEMS = [
  {
    question: "What is the best free surf forecast app?",
    answer:
      "For iPhone surfers who want forecasts, conditions, tides, session logging, and a small alert setup without paying, Quiver is our pick. Surfline is the better fit when live cams and expert reports matter most, while Windy and NDBC are better for reading raw maps or buoy observations.",
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
      "It depends on the job. Surfline is strongest for live cams and global coverage, Windy.app for raw wind and swell maps, Surf-Forecast.com for worldwide spot coverage, and Quiver, our app, for a free per-beach forecast and the best window to go on US coasts.",
  },
  {
    question: "What is the best surf app for beginners?",
    answer:
      "One that tells you whether today is small and gentle enough to learn, not just a wave height. Quiver's beginner pages give a plain YES, MAYBE, or NO for learners at several US beaches. Whichever app you use, watch the water from shore before you paddle out.",
  },
  {
    question: "Is Surfline Premium worth it?",
    answer:
      "If you check live cams most days or surf well beyond your home breaks, Premium ($119.99 a year on the App Store) is the clearest upgrade in surf apps. If you mainly need a forecast and tides for a few home breaks, a free tier usually covers it.",
  },
  {
    question: "What replaced Magicseaweed?",
    answer:
      "Surfline bought Magicseaweed in 2017 and shut it down in 2023, sending its users to Surfline. Free alternatives include Surf-Forecast.com, Windy.app, Surf Captain, and Quiver.",
  },
  {
    question: "Is Quiver on Android?",
    answer:
      "Not publicly yet. Quiver's Android app is in closed testing. On Android you can use quiversurf.app in any browser for the same free forecasts, tides, and water temperature.",
  },
  {
    question: "Which surf app has the most live cams?",
    answer:
      "Surfline, by a wide margin, because it runs its own cam network. Quiver shows public surf cams where they exist, alongside the forecast.",
  },
] as const;

const FAQ_ITEMS = [...SURF_APP_FAQ_ITEMS, ...FREE_FAQ_ITEMS];

interface AppAtAGlanceRow {
  app: string;
  bestFor: string;
  free: string;
  paid: string;
  platforms: string;
  href: string;
}

// Prices are the US App Store in-app purchase list as checked on
// COMPARISON_SOURCE_REVIEW.lastVerified; re-check them with the sources.
const AT_A_GLANCE_ROWS: AppAtAGlanceRow[] = [
  {
    app: "Quiver",
    bestFor: "Per-beach best window, learner verdicts, and a session log on US coasts",
    free: "Forecasts, tides, and water temperature for 280+ breaks; session log; one watched beach",
    paid: "Pro $4.99/mo, $39.99/yr, or $119.99 lifetime",
    platforms: "Web, iPhone (Android in closed testing)",
    href: APP_STORE_URL,
  },
  {
    app: "Surfline",
    bestFor: "Live cams, forecaster reports, and global coverage",
    free: "Free tier",
    paid: "Premium $15.99/mo or $119.99/yr; Premium+ $149.99/yr",
    platforms: "Web, iPhone, Android",
    href: "https://apps.apple.com/us/app/surfline-wave-surf-reports/id393782096",
  },
  {
    app: "Lazy Surfer",
    bestFor: "Session-based personal forecasts",
    free: "Free tier",
    paid: "Pro in-app purchases from $4.99",
    platforms: "iPhone, Android",
    href: "https://apps.apple.com/us/app/lazy-surfer/id1450887020",
  },
  {
    app: "Swell Scope",
    bestFor: "Custom spots and a surf journal anywhere",
    free: "Free tier",
    paid: "In-app purchases $2.99 to $49.99",
    platforms: "iPhone, Android",
    href: "https://apps.apple.com/us/app/swell-scope-surf-forecast/id6747609653",
  },
  {
    app: "Surf-Forecast.com",
    bestFor: "Worldwide spot coverage and long-range planning",
    free: "Free forecasts",
    paid: "Premium $4.99/mo or $34.99/yr",
    platforms: "Web, iPhone",
    href: "https://apps.apple.com/us/app/surf-forecast-com/id6450721636",
  },
  {
    app: "Surf Captain",
    bestFor: "Simple, low-cost 16-day forecasts",
    free: "5-day forecast with ads",
    paid: "Pro $19.99/yr",
    platforms: "Web",
    href: "https://surfcaptain.com/faq",
  },
  {
    app: "Windy.app",
    bestFor: "Raw wind, wave, and tide maps",
    free: "Free maps",
    paid: "Paid plans as in-app purchases",
    platforms: "iPhone, Android",
    href: "https://apps.apple.com/us/app/windy-app-wind-tides-radar/id997079492",
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
      "Surfline has the deepest cam network on the California coast. Quiver covers California breaks with a per-beach best window, tides, and water temperature, free on the web and iPhone, and shows public cams where they exist.",
    links: [
      { href: "/surf-cams/san-diego", label: "San Diego surf cams" },
      { href: "/beginner/santa-cruz", label: "Santa Cruz learner verdict" },
    ],
  },
  {
    id: "best-surf-app-east-coast",
    heading: "Best surf app for the East Coast and Gulf",
    body:
      "East Coast surf often comes from short-lived wind swell and passing storms, so hourly wind matters more than a long outlook. Quiver covers Florida, the Carolinas, New Jersey, New York, and Gulf breaks in Texas. Surfline and Surf-Forecast.com cover more of the coastline overall.",
    links: [{ href: "/beginner/cocoa-beach", label: "Cocoa Beach learner verdict" }],
  },
  {
    id: "best-surf-app-hawaii",
    heading: "Best surf app for Hawaii",
    body:
      "Hawaii swells are big, direction-specific, and break over reef, so local knowledge and cams count. Surfline's Hawaii cams are hard to beat. Quiver covers Hawaii breaks with the same per-beach forecast, and its Honolulu beginner page points learners to gentler water.",
    links: [{ href: "/beginner/honolulu", label: "Honolulu learner verdict" }],
  },
  {
    id: "best-surf-log-app",
    heading: "Best surf app for logging sessions",
    body:
      "If you want your own history to shape what you check next, the session-first apps are Quiver, Lazy Surfer, and Swell Scope. Quiver's session log is free with an account and saves the conditions with each session.",
    links: [{ href: "/surf-session-log", label: "How Quiver logs sessions" }],
  },
];

const COMPARISON_ROWS: AppComparisonRow[] = [
  {
    job: "Personal daily call and session-learning loop",
    bestPick: "Quiver",
    why:
      "Quiver Pro turns forecast data into a beach-level call, then uses logged sessions, board context, alerts, and similarity signals to make the next call more personal.",
    freeTier:
      "Free: forecasts, conditions, and tides for 280+ breaks; session logging with a free account; one watched beach with up to three alert rules. Pro only: personal match score, ranked session windows, and personal alerts. Pro is $4.99/mo, $39.99/yr, or $119.99 lifetime.",
    tradeoff:
      "Web and iPhone today, with Android in closed testing; US, Hawaii, Puerto Rico, and Baja breaks only; not the pick if your main need is a huge live-cam network.",
    sourceHref: APP_STORE_URL,
  },
  {
    job: "Live cams, expert forecast desk, and broad global surf coverage",
    bestPick: "Surfline",
    why:
      "Surfline remains the strongest pick for live cams, expert reports, 16-day forecasts, and global coverage.",
    freeTier:
      "Free tier; Premium $15.99/mo or $119.99/yr; Premium+ $149.99/yr (App Store, checked 2026-10-11).",
    tradeoff:
      "The strongest cam and premium features sit behind paid plans, and the product is less centered on your personal session history.",
    sourceHref: "https://apps.apple.com/us/app/surfline-wave-surf-reports/id393782096",
  },
  {
    job: "Cross-platform personalized surf forecasting",
    bestPick: "Lazy Surfer",
    why:
      "Lazy Surfer builds personal forecasts from the sessions you log and is available on both iPhone and Android.",
    freeTier:
      "Free tier; Pro in-app purchases from $4.99 (App Store, checked 2026-10-11).",
    tradeoff:
      "Personal predictions depend on logging sessions over time.",
    sourceHref: "https://apps.apple.com/us/app/lazy-surfer/id1450887020",
  },
  {
    job: "Custom spots and a surf journal anywhere in the world",
    bestPick: "Swell Scope",
    why:
      "Swell Scope lets you define your own spots, set wind and swell exposure, and keep a journal that compares sessions.",
    freeTier:
      "Free tier; in-app purchases $2.99 to $49.99 (App Store, checked 2026-10-11).",
    tradeoff:
      "You set up and tune each spot yourself.",
    sourceHref: "https://apps.apple.com/us/app/swell-scope-surf-forecast/id6747609653",
  },
  {
    job: "Simple global web forecasts and long-range planning",
    bestPick: "Surf-Forecast.com",
    why:
      "Surf-Forecast.com is useful when you want broad spot coverage, wave maps, tide timing, alerts, and 16-day planning.",
    freeTier:
      "Free forecasts; Premium $4.99/mo or $34.99/yr (App Store, checked 2026-10-11).",
    tradeoff:
      "It is a broad forecast product, not a personal session-learning app.",
    sourceHref: "https://apps.apple.com/us/app/surf-forecast-com/id6450721636",
  },
  {
    job: "Simple low-cost extended forecasts",
    bestPick: "Surf Captain",
    why:
      "Surf Captain is useful when you want straightforward 5-day free forecasts or a low-cost Pro path to 16-day local forecasts for covered regions.",
    freeTier:
      "Free 5-day forecast with ads; Pro $19.99/yr for 16-day forecasts (checked 2026-10-11).",
    tradeoff:
      "It is a simple forecast product, not a personal session-learning app or broad live-cam network.",
    sourceHref: "https://surfcaptain.com/faq",
  },
  {
    job: "Raw wind and swell map reading",
    bestPick: "Windy.app",
    why:
      "Windy is strongest when you want to inspect raw wind, swell, and weather layers yourself instead of receiving a finished surf call.",
    freeTier: "Free maps; paid plans as in-app purchases (App Store, checked 2026-10-11).",
    tradeoff:
      "You still need to translate model layers into beach-specific surf quality.",
    sourceHref: "https://apps.apple.com/us/app/windy-app-wind-tides-radar/id997079492",
  },
  {
    job: "Raw buoy observations and source-of-truth checks",
    bestPick: "NDBC",
    why:
      "NOAA NDBC is the cleanest free source for buoy observations and historical station data.",
    freeTier: "Free NOAA buoy observations (checked 2026-10-11).",
    tradeoff:
      "It is not a consumer surf app and does not convert observations into a local paddle-out recommendation.",
    sourceHref: "https://www.ndbc.noaa.gov/observations.shtml",
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

function ComparisonItemListStructuredData(): ReactElement {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Best surf apps by surf job in 2026",
    itemListOrder: "https://schema.org/ItemListOrderUnordered",
    numberOfItems: COMPARISON_ROWS.length,
    itemListElement: COMPARISON_ROWS.map((row, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: `${row.bestPick}: ${row.job}`,
        url: row.sourceHref,
        description: row.why,
      },
    })),
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
        name="Best Surf Apps in 2026, Compared by What You Need"
        description="A source-backed comparison of surf forecast apps by job, with free tiers, prices, and platforms."
        url={PAGE_URL}
        dateModified={COMPARISON_SOURCE_REVIEW.lastVerified}
      />
      <SoftwareApplicationStructuredData />
      <ComparisonItemListStructuredData />
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
                Best Surf Apps in 2026, Compared by What You Need
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#252D6B] md:text-xl md:leading-9">
                There is no single best surf app for every surfer. Surfline is
                the pick for live cams and global coverage. Windy.app is the
                pick for raw wind and swell maps. Surf-Forecast.com covers the
                most spots worldwide. Quiver is our app, built for one question
                on US coasts: which beach, which window, which board, and
                whether it is worth paddling out for you.
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

          <section id="surf-apps-at-a-glance" className="px-1 pt-12">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
              At a glance
            </p>
            <h2 className="mt-2 font-heading text-4xl font-black uppercase leading-none text-[#11100D] md:text-5xl">
              Surf apps compared: price and platforms
            </h2>
            <div className="mt-5 overflow-x-auto border-2 border-[#11100D] bg-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.2)]">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <caption className="sr-only">
                  Surf apps compared on free tier, US App Store price, and
                  platforms, checked on{" "}
                  {formatVerifiedDate(COMPARISON_SOURCE_REVIEW.lastVerified)}.
                </caption>
                <thead>
                  <tr className="border-b-2 border-[#11100D] bg-[#11100D] text-[#F4EBD8]">
                    {["App", "Best for", "Free", "Paid (US)", "Platforms"].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-4 py-3 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AT_A_GLANCE_ROWS.map((row, index) => (
                    <tr
                      key={row.app}
                      className={`border-b-2 border-[#11100D] last:border-b-0 ${
                        index % 2 === 0 ? "bg-[#F4EBD8]" : "bg-[#EFE0C2]"
                      }`}
                    >
                      <th scope="row" className="px-4 py-3 text-left align-top">
                        <a
                          href={row.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-heading text-base font-black text-[#11100D] underline-offset-4 hover:text-[#9E5010] hover:underline"
                        >
                          {row.app}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </th>
                      <td className="px-4 py-3 align-top font-semibold leading-6 text-[#252D6B]">{row.bestFor}</td>
                      <td className="px-4 py-3 align-top font-semibold leading-6 text-[#252D6B]">{row.free}</td>
                      <td className="px-4 py-3 align-top font-semibold leading-6 text-[#252D6B]">{row.paid}</td>
                      <td className="px-4 py-3 align-top font-semibold leading-6 text-[#252D6B]">{row.platforms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
              Prices are US App Store in-app purchases checked on{" "}
              <span className="font-mono font-black">
                {COMPARISON_SOURCE_REVIEW.lastVerified}
              </span>
              . Quiver is our app.
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
                  The best free choice changes with the job. Surfline offers a
                  free tier, while Premium and Premium+ are paid. Surf-Forecast.com
                  offers web and app forecasts. Surf Captain has a free
                  5-day forecast with ads, with 16-day forecasts in paid Pro.
                  Windy.app provides a free wind map, and NDBC provides
                  free NOAA buoy observations. LazySurfer offers a free tier
                  alongside paid Pro plans.
                </p>
              </div>
            </div>
          </section>

          <section className="px-1 py-12">
            <div className="overflow-x-auto border-2 border-[#11100D] bg-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.2)]">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <caption className="sr-only">
                  Capability-led comparison of surf forecast apps checked on
                  {" "}
                  {formatVerifiedDate(COMPARISON_SOURCE_REVIEW.lastVerified)}.
                </caption>
                <thead>
                  <tr className="border-b-2 border-[#11100D] bg-[#11100D] text-[#F4EBD8]">
                    <th
                      scope="col"
                      className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                    >
                      Surf job
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                    >
                      Best pick
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                    >
                      Why
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em] text-[#F78E42]"
                    >
                      Free / paid boundary
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                    >
                      Tradeoff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, index) => (
                    <tr
                      key={row.job}
                      className={`border-b-2 border-[#11100D] last:border-b-0 ${
                        index % 2 === 0 ? "bg-[#F4EBD8]" : "bg-[#EFE0C2]"
                      }`}
                    >
                      <th
                        scope="row"
                        className="max-w-[260px] px-4 py-4 text-left align-top font-heading text-lg font-black text-[#11100D]"
                      >
                        {row.job}
                      </th>
                      <td className="px-4 py-4 align-top">
                        <a
                          href={row.sourceHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-heading text-lg font-black text-[#11100D] underline-offset-4 hover:text-[#9E5010] hover:underline"
                        >
                          {row.bestPick}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </td>
                      <td className="max-w-[360px] px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                        {row.why}
                      </td>
                      <td className="max-w-[360px] px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                        {row.freeTier}
                      </td>
                      <td className="max-w-[340px] px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                        {row.tradeoff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  Compare Quiver vs Surfline
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/vs/surfline/free"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Free Surfline alternatives
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
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-heading text-base font-black uppercase text-[#11100D] underline-offset-4 hover:text-[#9E5010] hover:underline"
                    >
                      {source.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
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
