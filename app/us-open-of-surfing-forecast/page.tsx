import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Droplets,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";

import { getBeginnerConditionsData } from "@/actions/beginner/beginner-actions";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";

const PAGE_PATH = "/us-open-of-surfing-forecast";
const PAGE_DESCRIPTION =
  "Check Huntington Beach waves, wind, tide, water temperature, and watch windows for the US Open of Surfing, backed by Quiver's local forecast.";

export const US_OPEN_FORECAST_FALLBACK_COPY =
  "Live Huntington Beach conditions are temporarily unavailable. Open the local forecast before you drive and verify the sets from shore.";

export const metadata: Metadata = buildPageMetadata({
  title: "US Open Surf Forecast: Huntington Beach Conditions",
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
  keywords: [
    "US Open of Surfing forecast",
    "Huntington Beach surf forecast",
    "US Open Huntington Beach waves",
    "Huntington Beach wind tide water temperature",
  ],
});

// Force static rendering. These routes read Supabase through the cookie-free
// public client, whose fetch is cache: "no-store"; without force-static that
// single uncached fetch opts the whole route into dynamic rendering, so Vercel
// served it with private/no-store on every request (measured 2026-09-01:
// x-vercel-cache MISS, TTFB 1.2-4.9s) instead of the hourly ISR page.
export const dynamic = "force-static";
export const revalidate = 1800;

export default async function UsOpenOfSurfingForecastPage() {
  const { badge, rightNow } = await getBeginnerConditionsData(
    "huntington-beach",
    "ca",
  );
  const timeWindow = rightNow?.beginnerVerdict.reasons.find(
    (reason) => reason.factor === "Time window",
  )?.detail;
  const utilityCards = [
    {
      label: "Waves",
      value: rightNow?.metrics.waveHeight.value ?? "Check live forecast",
      detail:
        rightNow?.metrics.waveHeight.label ??
        "Confirm the current wave range before choosing a viewing or surf window.",
      icon: Waves,
    },
    {
      label: "Wind",
      value: rightNow?.metrics.wind.value ?? "Check live forecast",
      detail:
        rightNow?.metrics.wind.label ??
        "Morning wind can change quickly along the Huntington Beach shoreline.",
      icon: Wind,
    },
    {
      label: "Tide",
      value: rightNow?.metrics.tide.value ?? "Check live tide",
      detail:
        rightNow?.metrics.tide.label ??
        "Use the local tide curve instead of assuming one stage works all day.",
      icon: Droplets,
    },
    {
      label: "Water temperature",
      value: rightNow?.metrics.waterTemp.value ?? "Check live reading",
      detail:
        rightNow?.metrics.waterTemp.label ??
        "Verify current water temperature before choosing exposure protection.",
      icon: Thermometer,
    },
    {
      label: "Watch window",
      value: timeWindow ?? "Recheck before arrival",
      detail:
        rightNow?.summary ??
        "Compare wave, wind, and tide timing before committing to a window.",
      icon: Clock3,
    },
  ];

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          {
            name: "US Open of Surfing Forecast",
            url: `${SITE_URL}${PAGE_PATH}`,
          },
        ]}
      />
      <WebPageSchema
        name="US Open of Surfing Forecast"
        description={PAGE_DESCRIPTION}
        url={`${SITE_URL}${PAGE_PATH}`}
      />

      <ZineSurface
        sectionLabel="Huntington Beach utility"
        editionLabel="Updated from the local forecast"
        data-testid="us-open-forecast-zine-surface"
      >
        <main>
          <nav className="mb-8 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/58">
            <Link href="/" className="hover:text-[#B56A2B]">
              Home
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span className="text-[#11100D]">US Open forecast</span>
          </nav>

          <header className="max-w-4xl">
            <p className="label-black mb-5">Huntington Beach, California</p>
            <h1 className="zine-h1 font-black uppercase leading-[0.88] text-[#11100D]">
              US Open of Surfing Forecast
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75">
              Plan around Huntington Beach waves, wind, tide, water
              temperature, and the clearest watch window. This is local
              conditions utility, not live contest-status coverage.
            </p>
          </header>

          <section
            aria-labelledby="huntington-conditions"
            className="mt-12"
          >
            <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
              <div>
                <p className="typewriter mb-2">Local read</p>
                <h2
                  className="font-display text-3xl font-black uppercase text-[#11100D]"
                  id="huntington-conditions"
                >
                  Huntington Beach conditions
                </h2>
              </div>
              {badge ? (
                <p className="rounded-full border-2 border-[#11100D] bg-[#F78E42] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#11100D]">
                  {badge.statusLabel}
                </p>
              ) : null}
            </div>

            {rightNow ? (
              <p className="mt-5 max-w-3xl text-base leading-7 text-[#11100D]/75">
                Reference spot: <strong>{rightNow.spotName}</strong>.{" "}
                {rightNow.summary}
              </p>
            ) : (
              <p
                className="mt-5 max-w-3xl rounded-lg border-2 border-[#11100D] bg-[#FBF6E8] p-4 text-base leading-7 text-[#11100D]/75"
                role="status"
              >
                {US_OPEN_FORECAST_FALLBACK_COPY}
              </p>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {utilityCards.map(({ detail, icon: Icon, label, value }) => (
                <article
                  className="torn border-2 border-[#11100D] bg-[#FBF6E8] p-4"
                  key={label}
                >
                  <Icon aria-hidden className="h-5 w-5 text-[#B56A2B]" />
                  <h3 className="mt-3 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#11100D]/62">
                    {label}
                  </h3>
                  <p className="mt-2 font-display text-xl font-black text-[#11100D]">
                    {value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#11100D]/68">
                    {detail}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="notebook mt-12">
            <h2 className="font-display text-2xl font-black uppercase text-[#11100D]">
              Use the utility, then verify the beach
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#11100D]/72">
              Forecast conditions can move between checks. Open the local
              beginner decision for a current learner window, compare the
              Huntington Beach tide page, and use the live beach list before
              you drive.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#11100D] transition-transform hover:-translate-y-0.5"
                href="/beginner/huntington-beach"
              >
                Check beginner conditions
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#11100D] transition-transform hover:-translate-y-0.5"
                href="/tide/huntington-beach"
              >
                Check Huntington Beach tide
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#11100D] transition-transform hover:-translate-y-0.5"
                href="/water-temp/huntington-beach"
              >
                Check water temperature
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#11100D] transition-transform hover:-translate-y-0.5"
                href="/ca/huntington-beach"
              >
                Open local surf spots
              </Link>
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
