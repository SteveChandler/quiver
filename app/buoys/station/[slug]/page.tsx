/**
 * Public buoy station page: /buoys/station/[slug].
 *
 * Alternate ids (/buoys/station/46225, CDIP "100") 308 to the canonical slug
 * when they match exactly one station. Unknown slugs, met-only stations and a
 * catalogue that is not migrated yet are real 404s.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { StatusChip, ReadingAge } from "@/components/buoys/live-status";
import { ModelVsObserved } from "@/components/buoys/model-vs-observed";
import { NowPanel } from "@/components/buoys/now-panel";
import {
  BuoyGlossary,
  HEADING,
  NearbyBuoys,
  OtherReadings,
  SECTION,
  StationBeaches,
  StationFacts,
  TideStationSlot,
} from "@/components/buoys/station-sections";
import { TrendChart } from "@/components/buoys/trend-chart";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { JsonLd } from "@/components/seo/funnel/JsonLd";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { buildExplainerLines } from "@/lib/buoy-pages/explainer";
import { formatStationTime } from "@/lib/buoy-pages/format";
import { countryName, countryPath, placeLabel, regionName, regionPath, stationPath } from "@/lib/buoy-pages/geo-names";
import { getBuoyPageSource } from "@/lib/buoy-pages/source";
import { loadStationPage } from "@/lib/buoy-pages/station-page-data";
import {
  absoluteUrl,
  buildStationDatasetJsonLd,
  buildStationDescription,
  buildStationTitle,
  stationCode,
} from "@/lib/seo/buoy-meta";
import { applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";

// The public Supabase client fetches no-store; force-static keeps this an ISR page.
export const dynamic = "force-static";
export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const loadPage = cache(async (slug: string) => loadStationPage(await getBuoyPageSource(), slug, new Date()));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPage(slug);
  if (result.kind !== "found") return { robots: { index: false, follow: true } };
  const { station, index } = result.data;
  const metadata = buildPageMetadata({
    title: buildStationTitle(station),
    description: buildStationDescription(station),
    path: stationPath(station.slug),
    keywords: [
      `${station.name} buoy`,
      ...(stationCode(station) ? [`buoy ${station.source_station_id}`] : []),
      `${station.name} swell`,
      "buoy data",
      "wave buoy",
    ],
  });
  return index.indexable ? metadata : applyIndexabilityToMetadata(metadata, { indexable: false, reason: "insufficient-data" });
}

export default async function BuoyStationPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadPage(slug);
  if (result.kind === "redirect") permanentRedirect(stationPath(result.slug));
  if (result.kind === "not-found") notFound();

  const data = result.data;
  const { station, timeZone, status, latestWave, nowObservation } = data;
  const canonicalPath = stationPath(station.slug);
  const place = placeLabel(station);
  // The chip keys off the newest wave reading; the reading time matches the row "Now" shows.
  const lastWaveAt = latestWave?.observed_at ?? station.last_wave_observed_at;
  const shownAt = nowObservation?.observed_at ?? lastWaveAt;
  const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" });
  const explainer = buildExplainerLines({
    station,
    nearestBeachKm: data.nearestBeachKm,
    trend: data.trend,
    formatDay: (ms) => dayFormat.format(new Date(ms)),
  });

  const breadcrumbs = [
    { name: "Buoys", path: "/buoys" },
    ...(station.country_code ? [{ name: countryName(station.country_code), path: countryPath(station.country_code) }] : []),
    ...(station.country_code && station.region
      ? [{ name: regionName(station.country_code, station.region), path: regionPath(station.country_code, station.region) }]
      : []),
    { name: station.name, path: canonicalPath },
  ];
  const hasTrend = Object.keys(data.chartRanges).length > 0;

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs.map((crumb) => ({ name: crumb.name, url: absoluteUrl(crumb.path) }))} />
      <JsonLd data={buildStationDatasetJsonLd(station, canonicalPath, station.last_wave_observed_at)} />
      <ZineSurface sectionLabel="Buoys" data-testid="buoy-station-page">
        <main>
          <nav aria-label="Breadcrumb" className="mb-6 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
            <ol className="flex flex-wrap items-center gap-1.5">
              {breadcrumbs.slice(0, -1).map((crumb) => (
                <li key={crumb.path} className="flex items-center gap-1.5">
                  <Link href={crumb.path} className="hover:text-[#B56A2B] hover:underline">
                    {crumb.name}
                  </Link>
                  <span aria-hidden>/</span>
                </li>
              ))}
            </ol>
          </nav>

          <header className="relative mb-10">
            <QuiverSticker sticker="spotSwellMatch" className="absolute -right-4 -top-6 hidden w-28 rotate-6 opacity-80 lg:block" />
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <StatusChip
                lastWaveAt={lastWaveAt}
                serverStatus={status}
                absolute={lastWaveAt ? formatStationTime(lastWaveAt, timeZone) : ""}
              />
              {stationCode(station) ? (
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
                  {`Buoy ${stationCode(station)}`}
                </span>
              ) : null}
            </div>
            <h1 className="zine-h1 font-black uppercase leading-[0.9] text-[#11100D] [overflow-wrap:anywhere] [hyphens:auto]">{station.name}</h1>
            {place ? <p className="mt-3 text-lg text-[#11100D]/75">{place}</p> : null}
            <p className="mt-2 text-sm text-[#11100D]/75">
              Last wave reading:{" "}
              <ReadingAge
                lastWaveAt={shownAt}
                serverStatus={status}
                absolute={shownAt ? formatStationTime(shownAt, timeZone) : ""}
              />
            </p>
          </header>

          <NowPanel observation={nowObservation} status={status} hasSwellSplit={station.has_swell_split} reading={data.reading} />

          {hasTrend ? (
            <section className={SECTION} aria-labelledby="buoy-trend-heading">
              <h2 id="buoy-trend-heading" className={HEADING}>Trend at the buoy</h2>
              <TrendChart
                ranges={data.chartRanges}
                defaultRange="5d"
                hasSplit={station.has_swell_split}
                stationName={station.name}
              />
              <p className="mt-3 text-xs leading-5 text-[#655C4C]">
                Hourly means of the buoy&apos;s readings. Arrows point the way the waves travel.
              </p>
            </section>
          ) : null}

          {data.model ? (
            <section className={SECTION} aria-labelledby="buoy-model-heading">
              <h2 id="buoy-model-heading" className={HEADING}>Model vs the buoy</h2>
              <ModelVsObserved model={data.model} timeZone={timeZone} stationName={station.name} />
            </section>
          ) : null}

          <StationBeaches
            relation={data.beaches.relation}
            items={data.beaches.items}
            moreCount={data.beaches.moreCount}
            forecastsLoaded={data.beaches.forecastsLoaded}
          />
          <NearbyBuoys items={data.nearby} />
          <TideStationSlot tideStation={null} />
          <OtherReadings observation={data.latestAny} timeZone={timeZone} />
          <StationFacts station={station} timeZone={timeZone} explainer={explainer} />
          <BuoyGlossary />

          <InlineSignupCta
            variant="zine"
            title="Get the beach read, not just the buoy"
            description="Quiver turns buoys, wind and tide into a forecast for your beaches and pings you when they line up."
            primaryButtonText="Get surf alerts"
            source="buoy-station-inline"
          />
        </main>
      </ZineSurface>
    </>
  );
}
