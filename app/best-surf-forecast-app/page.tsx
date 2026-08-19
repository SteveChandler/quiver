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

import {
  COMPARISON_SOURCE_LINKS,
  COMPARISON_SOURCE_REVIEW,
} from "./comparison-sources";

export const revalidate = 604800;

const PAGE_PATH = "/best-surf-forecast-app";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const APP_STORE_URL =
  "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320";

export const metadata: Metadata = buildPageMetadata({
  title: "Best Surf Forecast App by Surf Job in 2026",
  description:
    "A capability-led 2026 surf forecast app comparison: Quiver, Surfline, LazySurfer, Surf-Forecast.com, Surf Captain, Windy, and NDBC.",
  path: PAGE_PATH,
  keywords: [
    "best surf forecast app",
    "best surf report app 2026",
    "surf forecast app comparison",
    "surfline alternative",
    "best surf app",
  ],
  image:
    "/api/og/guide?title=Best%20Surf%20Forecast%20App&region=Compared",
});

interface AppComparisonRow {
  job: string;
  bestPick: string;
  why: string;
  tradeoff: string;
  sourceHref: string;
}

const COMPARISON_ROWS: AppComparisonRow[] = [
  {
    job: "Personal daily call and session-learning loop",
    bestPick: "Quiver",
    why:
      "Quiver turns forecast data into a beach-level call, then uses logged sessions, board context, alerts, and similarity signals to make the next call more personal.",
    tradeoff:
      "iPhone-first today; not the best pick if your main need is a huge live-cam network.",
    sourceHref: APP_STORE_URL,
  },
  {
    job: "Live cams, expert forecast desk, and broad global surf coverage",
    bestPick: "Surfline",
    why:
      "Surfline remains the strongest pick for live cams, expert reports, 16-day forecasts, and global coverage.",
    tradeoff:
      "The strongest cam and premium features sit behind paid plans, and the product is less centered on your personal session history.",
    sourceHref: "https://www.surfline.com/upgrade",
  },
  {
    job: "Cross-platform personalized surf forecasting",
    bestPick: "LazySurfer",
    why:
      "LazySurfer is the closest session-driven personalization competitor and publicly compares itself around per-user prediction and ratings history.",
    tradeoff:
      "Its own comparison positions Quiver as cheaper annually, while LazySurfer has broader platform availability.",
    sourceHref: "https://lazysurfer.app/compare/quiver.html",
  },
  {
    job: "Simple global web forecasts and long-range planning",
    bestPick: "Surf-Forecast.com",
    why:
      "Surf-Forecast.com is useful when you want broad spot coverage, wave maps, tide timing, alerts, and 16-day planning.",
    tradeoff:
      "It is a broad forecast product, not a personal session-learning app.",
    sourceHref: "https://www.surf-forecast.com/pages/app-store",
  },
  {
    job: "Simple low-cost extended forecasts",
    bestPick: "Surf Captain",
    why:
      "Surf Captain is useful when you want straightforward 5-day free forecasts or a low-cost Pro path to 16-day local forecasts for covered regions.",
    tradeoff:
      "It is a simple forecast product, not a personal session-learning app or broad live-cam network.",
    sourceHref: "https://surfcaptain.com/faq",
  },
  {
    job: "Raw wind and swell map reading",
    bestPick: "Windy",
    why:
      "Windy is strongest when you want to inspect raw wind, swell, and weather layers yourself instead of receiving a finished surf call.",
    tradeoff:
      "You still need to translate model layers into beach-specific surf quality.",
    sourceHref: "https://windy.app/guide/mini-guide-to-surfing.html",
  },
  {
    job: "Raw buoy observations and source-of-truth checks",
    bestPick: "NDBC",
    why:
      "NOAA NDBC is the cleanest free source for buoy observations and historical station data.",
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

function ComparisonItemListStructuredData(): ReactElement {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Best surf forecast app by surf job in 2026",
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
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function BestSurfForecastAppPage(): ReactElement {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Best Surf Forecast App", url: PAGE_URL },
        ]}
      />
      <WebPageSchema
        name="Best Surf Forecast App by Surf Job in 2026"
        description="A source-backed, capability-led surf forecast app comparison by job-to-be-done."
        url={PAGE_URL}
        dateModified={COMPARISON_SOURCE_REVIEW.lastVerified}
      />
      <ComparisonItemListStructuredData />

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
                Best surf forecast app
              </p>
              <h1 className="font-heading text-5xl font-black uppercase leading-[0.9] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl">
                Best Surf Forecast App by Surf Job in 2026
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#252D6B] md:text-xl md:leading-9">
                There is no honest single winner for every surfer. Surfline is
                the best cam and expert-report pick. Windy is the best raw-map
                pick. NDBC is the best buoy source. Quiver is our app, and it is
                built for the personal daily call: which beach, which window,
                which board, and whether it is worth paddling out for you.
              </p>
            </div>

            <aside className="rotate-[0.7deg] border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[7px_7px_0_rgba(17,16,13,0.22)]">
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
                className="inline-flex w-fit items-center justify-center gap-2 rounded-sm border-2 border-[#F78E42] bg-[#F78E42] px-4 py-3 font-heading text-xs font-black uppercase tracking-[0.1em] text-[#11100D] shadow-[4px_4px_0_rgba(247,142,66,0.24)] transition-transform hover:-translate-y-0.5"
              >
                Read the accuracy method
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          <section className="px-1 py-12">
            <div className="overflow-x-auto border-2 border-[#11100D] bg-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.2)]">
              <table className="w-full min-w-[980px] border-collapse text-sm">
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
                      <td className="max-w-[340px] px-4 py-4 align-top font-semibold leading-6 text-[#252D6B]">
                        {row.tradeoff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  href="/best-free-surf-forecast-app"
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
                  href="/vs/surfline"
                  className="inline-flex items-center gap-2 font-bold text-[#252D6B] underline-offset-4 hover:text-[#9E5010] hover:underline"
                >
                  Compare Quiver vs Surfline
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

              <figure className="mt-6 -rotate-1 border-2 border-[#11100D] bg-[#F4EBD8] p-2 shadow-[5px_5px_0_rgba(17,16,13,0.18)]">
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
