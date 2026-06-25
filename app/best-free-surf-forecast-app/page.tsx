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
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 86400;

const PAGE_PATH = "/best-free-surf-forecast-app";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const LAST_UPDATED_LABEL = "June 24, 2026";
const CHECKED_ON_ISO = "2026-06-24";
const APP_STORE_URL =
  "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320";

export const metadata: Metadata = buildPageMetadata({
  title: "Best Free Surf Forecast App in 2026",
  description:
    "Compare the best free surf forecast apps for 2026: Quiver, Surfline, Windy, NDBC, Surf-Forecast.com, Surf Captain, and LazySurfer.",
  path: PAGE_PATH,
  keywords: [
    "best free surf forecast app",
    "free surf report app",
    "best surf forecast app free",
    "free surf conditions app",
    "surfline alternative free",
  ],
  image:
    "/api/og/guide?title=Best%20Free%20Surf%20Forecast%20App&region=Compare",
});

interface ComparisonProduct {
  name: string;
  price: string;
  personalCall: string;
  sessionLogging: string;
  liveCams: string;
  coverage: string;
  platform: string;
  bestFor: string;
  sourceHref: string;
}

interface SourceLink {
  label: string;
  href: string;
  note: string;
}

const ANSWER_BLOCK =
  "Quiver is the best free surf forecast app in 2026 for iPhone surfers who just want to know: is it worth paddling out for me? The free tier covers a personal daily call, tides, alerts, and session logging, so your past sessions tune the next call instead of a generic star rating. It is not best for every job, though. Surfline still owns live cams and a human forecast desk, Windy owns raw swell and wind maps, and NDBC is the cleanest free buoy source. Surf-Forecast.com and Surf Captain are solid simple free alternatives for broad web forecasts. LazySurfer is the closest session-driven rival, but its personalization is paid. Quiver is our app, so the table below shows where it wins and where it does not.";

const COMPARISON_PRODUCTS: ComparisonProduct[] = [
  {
    name: "Quiver",
    price:
      "Free with in-app purchases; Quiver Pro $4.99/mo or $39.99/yr; App Store 5.0 from 4 ratings (checked on 2026-06-24).",
    personalCall: "Yes - daily call, alerts, tides, and session memory.",
    sessionLogging: "Yes - logs feed the personal loop.",
    liveCams: "No broad cam network; not the reason to pick Quiver.",
    coverage: "280+ US, Hawaii, Puerto Rico, and Baja breaks.",
    platform: "iPhone.",
    bestFor: "Free personal iPhone daily call and session logging.",
    sourceHref: APP_STORE_URL,
  },
  {
    name: "Surfline",
    price:
      "Free tier; Premium $119.99/yr; Premium+ $149.99/yr; App Store 4.7 stars from about 30K ratings (checked on 2026-06-24).",
    personalCall: "Regional reports and spot forecasts, not session-learning.",
    sessionLogging: "Not the core free-job fit in the source notes.",
    liveCams: "Best-in-class cam network: 1000+ live cams.",
    coverage: "Large global surf network.",
    platform: "Web, iOS, and Android.",
    bestFor: "Live cams and expert forecasts.",
    sourceHref:
      "https://support.surfline.com/hc/en-us/articles/32996023385243-What-do-I-get-as-a-free-vs-Premium-user",
  },
  {
    name: "Surf-Forecast.com",
    price:
      "Free web and app with hourly and 16-day forecasts noted in source check (checked on 2026-06-24).",
    personalCall: "No - broad forecast product.",
    sessionLogging: "No session-learning claim in the source notes.",
    liveCams: "Webcam links, not the main cam network pick.",
    coverage: "Large global surf forecast coverage.",
    platform: "Web and app.",
    bestFor: "Free global coverage.",
    sourceHref: "https://www.surf-forecast.com/pages/app-store",
  },
  {
    name: "Surf Captain",
    price:
      "Free 5-day forecast with ads; Pro $19.99/yr for 16-day forecasts (checked on 2026-06-24).",
    personalCall: "No - simple forecast product.",
    sessionLogging: "No session-learning claim in the source notes.",
    liveCams: "No broad cam-network claim in the source notes.",
    coverage: "Simple forecast coverage.",
    platform: "Web.",
    bestFor: "Cheap simple forecasts.",
    sourceHref: "https://surfcaptain.com/faq",
  },
  {
    name: "LazySurfer",
    price:
      "Paid personalized session-driven forecasting; no price captured in source notes (checked on 2026-06-24).",
    personalCall: "Yes - session-driven personalization.",
    sessionLogging: "Yes - personalization is the product angle.",
    liveCams: "No live-cam advantage captured in the source notes.",
    coverage: "Coverage not specified in the source notes.",
    platform: "Platform not specified in the source notes.",
    bestFor: "Session-driven personalization (paid).",
    sourceHref:
      "https://lazysurfer.app/compare/best-free-surf-forecasting-apps-2026.html",
  },
  {
    name: "Windy",
    price: "Free raw swell and wind maps (checked on 2026-06-24).",
    personalCall: "No - raw map and model reading.",
    sessionLogging: "No session-learning claim in the source notes.",
    liveCams: "No cam advantage captured in the source notes.",
    coverage: "Broad map coverage.",
    platform: "Web and app.",
    bestFor: "Raw swell maps and data nerds.",
    sourceHref: "https://windy.app/guide/mini-guide-to-surfing.html",
  },
  {
    name: "NDBC",
    price: "Free NOAA buoy observations (checked on 2026-06-24).",
    personalCall: "No - raw observations, not an app call.",
    sessionLogging: "No.",
    liveCams: "No.",
    coverage: "NOAA buoy stations and historical observations.",
    platform: "Web data source.",
    bestFor: "Free raw buoy data.",
    sourceHref: "https://www.ndbc.noaa.gov/",
  },
];

const SOURCE_LINKS: SourceLink[] = [
  {
    label: "Quiver App Store listing",
    href: APP_STORE_URL,
    note: "free with in-app purchases, rating, Pro pricing, iPhone listing.",
  },
  {
    label: "Surfline free vs Premium support",
    href:
      "https://support.surfline.com/hc/en-us/articles/32996023385243-What-do-I-get-as-a-free-vs-Premium-user",
    note: "Premium and Premium+ annual pricing.",
  },
  {
    label: "Surfline App Store listing",
    href: "https://apps.apple.com/us/app/surfline-wave-surf-reports/id393782096",
    note: "rating count, star rating, cams, and expert-forecast positioning.",
  },
  {
    label: "Surf-Forecast app page",
    href: "https://www.surf-forecast.com/pages/app-store",
    note: "hourly forecasts, 16-day forecasts, alerts, and global coverage.",
  },
  {
    label: "Surf Captain FAQ",
    href: "https://surfcaptain.com/faq",
    note: "free 5-day forecast with ads and Pro annual price.",
  },
  {
    label: "LazySurfer best-free comparison",
    href:
      "https://lazysurfer.app/compare/best-free-surf-forecasting-apps-2026.html",
    note: "paid session-driven personalization competitor framing.",
  },
  {
    label: "Windy surfing guide",
    href: "https://windy.app/guide/mini-guide-to-surfing.html",
    note: "raw swell, wind, tide, and map-reading education.",
  },
  {
    label: "NOAA NDBC",
    href: "https://www.ndbc.noaa.gov/",
    note: "free buoy observations and historical observations.",
  },
];

function SoftwareApplicationStructuredData(): ReactElement {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Quiver Surf App",
    applicationCategory: "SportsApplication",
    operatingSystem: "iOS",
    url: APP_STORE_URL,
    description:
      "Free iPhone surf forecast app for personal daily calls, alerts, tides, session logging, and 280+ US, Hawaii, Puerto Rico, and Baja breaks.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "39.99",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      ratingCount: "4",
    },
    publisher: {
      "@type": "Organization",
      name: "Quiver",
      url: SITE_URL,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function ComparisonItemListStructuredData(): ReactElement {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Best free surf forecast app comparison",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: COMPARISON_PRODUCTS.length,
    itemListElement: COMPARISON_PRODUCTS.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: product.name,
        url: product.sourceHref,
        description: product.bestFor,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function BestFreeSurfForecastAppPage(): ReactElement {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Best Free Surf Forecast App", url: PAGE_URL },
        ]}
      />
      <WebPageSchema
        name="Best Free Surf Forecast App in 2026"
        description="A source-backed comparison of Quiver, Surfline, Surf-Forecast.com, Surf Captain, LazySurfer, Windy, and NDBC for free surf forecast jobs."
        url={PAGE_URL}
        dateModified={CHECKED_ON_ISO}
      />
      <SoftwareApplicationStructuredData />
      <ComparisonItemListStructuredData />

      <ZineSurface
        sectionLabel="Best free app"
        editionLabel="Checked 2026-06-24"
        data-testid="best-free-surf-forecast-app-zine-surface"
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
                Free forecast app comparison
              </p>
              <h1 className="font-heading text-5xl font-black uppercase leading-[0.9] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl">
                Best Free Surf Forecast App in 2026
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#252D6B] md:text-xl md:leading-9">
                {ANSWER_BLOCK}
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <figure className="relative -rotate-1 border-2 border-[#11100D] bg-[#F4EBD8] p-2 shadow-[7px_7px_0_rgba(17,16,13,0.22)]">
                <Image
                  src="/images/seo-scenes/santa-cruz-steamer-lane.webp"
                  alt="Clean morning lines at Steamer Lane, Santa Cruz"
                  width={1600}
                  height={900}
                  className="h-auto w-full"
                  priority
                />
                <figcaption className="mt-2 px-1 text-center font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#252D6B]">
                  Santa Cruz · Steamer Lane
                </figcaption>
              </figure>

              <aside className="rotate-[0.7deg] border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[7px_7px_0_rgba(17,16,13,0.22)]">
              <div className="flex items-center gap-2 font-heading text-xl font-black uppercase text-[#11100D]">
                <CalendarCheck className="h-5 w-5 text-[#F78E42]" aria-hidden />
                Last updated
              </div>
              <p className="mt-3 font-mono text-sm font-black uppercase tracking-[0.12em] text-[#252D6B]">
                {LAST_UPDATED_LABEL}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
                Pricing, App Store rating notes, and source links on this page
                were checked on{" "}
                <span className="font-mono font-black">{CHECKED_ON_ISO}</span>.
              </p>
              <p className="mt-4 border-t-2 border-[#11100D] pt-3 text-sm font-black text-[#11100D]">
                Quiver is our app.
              </p>
            </aside>
            </div>
          </header>

          <section className="border-y-2 border-[#11100D] bg-[#11100D] px-5 py-6 text-[#F4EBD8] shadow-[0_7px_0_rgba(17,16,13,0.18)]">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#F78E42]">
                  The honest short version
                </p>
                <h2 className="mt-2 font-heading text-3xl font-black uppercase leading-none md:text-5xl">
                  Pick by the surf job, not the logo.
                </h2>
              </div>
              <a
                href={APP_STORE_URL}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-sm border-2 border-[#F78E42] bg-[#F78E42] px-4 py-3 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#11100D] shadow-[4px_4px_0_rgba(247,142,66,0.24)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBD8]"
                target="_blank"
                rel="noreferrer"
              >
                Open Quiver on App Store
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </section>

          <section className="px-1 py-12">
            <div className="relative">
              <QuiverSticker
                sticker="spotSwellMatch"
                className="absolute -right-3 -top-8 z-10 hidden w-20 rotate-6 drop-shadow-md md:block"
              />
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                    Comparison
                  </p>
                  <h2 className="mt-2 font-heading text-4xl font-black uppercase leading-none text-[#11100D] md:text-5xl">
                    Free surf forecast app comparison
                  </h2>
                </div>
                <p className="max-w-md text-sm font-semibold leading-6 text-[#252D6B]">
                  Pricing and ratings checked on{" "}
                  <span className="font-mono font-black">{CHECKED_ON_ISO}</span>.
                  Plans can change, so use the source links before buying.
                </p>
              </div>

              <div className="overflow-x-auto border-2 border-[#11100D] bg-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.2)]">
                <table className="w-full min-w-[1060px] border-collapse text-sm">
                  <caption className="sr-only">
                    Comparison of Quiver, Surfline, Surf-Forecast.com, Surf
                    Captain, LazySurfer, Windy, and NDBC. Pricing and ratings
                    checked on 2026-06-24.
                  </caption>
                  <thead>
                    <tr className="border-b-2 border-[#11100D] bg-[#11100D] text-[#F4EBD8]">
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Product
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Price / rating
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Personal call
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Session logging
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Live cams
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Coverage
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em]"
                      >
                        Platform
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-left font-heading text-xs font-black uppercase tracking-[0.08em] text-[#F78E42]"
                      >
                        Best for
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_PRODUCTS.map((product, index) => (
                      <tr
                        key={product.name}
                        className={`border-b-2 border-[#11100D] last:border-b-0 ${
                          index % 2 === 0 ? "bg-[#F4EBD8]" : "bg-[#EFE0C2]"
                        }`}
                      >
                        <th
                          scope="row"
                          className="px-4 py-4 text-left align-top font-heading text-lg font-black text-[#11100D]"
                        >
                          <a
                            href={product.sourceHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline-offset-4 hover:text-[#9E5010] hover:underline"
                          >
                            {product.name}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        </th>
                        <td className="max-w-[250px] px-4 py-4 align-top font-mono text-xs font-bold leading-5 text-[#252D6B]">
                          {product.price}
                        </td>
                        <td className="px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                          {product.personalCall}
                        </td>
                        <td className="px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                          {product.sessionLogging}
                        </td>
                        <td className="px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                          {product.liveCams}
                        </td>
                        <td className="px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                          {product.coverage}
                        </td>
                        <td className="px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                          {product.platform}
                        </td>
                        <td className="px-4 py-4 align-top font-black leading-6 text-[#11100D]">
                          {product.bestFor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-6 px-1 py-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative border-2 border-[#11100D] bg-[#F8EFD8] p-6 shadow-[7px_7px_0_rgba(17,16,13,0.2)]">
              <QuiverSticker
                sticker="creamCoastMap"
                className="absolute -right-3 -top-8 hidden w-24 rotate-6 opacity-90 md:block"
              />
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                Source-backed notes
              </p>
              <h2 className="mt-2 font-heading text-3xl font-black uppercase leading-none text-[#11100D] md:text-4xl">
                What to use after this page
              </h2>
              <div className="mt-6 grid gap-3">
                <Link
                  href="/free-surf-reports"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Read how free surf reports work
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/forecast-accuracy"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Check Quiver forecast accuracy
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/vs/surfline"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Compare Quiver vs Surfline
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Open the Quiver App Store listing
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>

              <figure className="mt-6 -rotate-1 border-2 border-[#11100D] bg-[#F4EBD8] p-2 shadow-[5px_5px_0_rgba(17,16,13,0.18)]">
                <Image
                  src="/images/seo-scenes/san-onofre-clean.webp"
                  alt="Clean longboard surf at San Onofre"
                  width={1600}
                  height={900}
                  className="h-auto w-full"
                />
                <figcaption className="mt-2 px-1 text-center font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#252D6B]">
                  San Onofre · California
                </figcaption>
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
                <span className="font-mono font-black">{CHECKED_ON_ISO}</span>.
              </p>
              <ul className="mt-5 grid gap-3">
                {SOURCE_LINKS.map((source) => (
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
