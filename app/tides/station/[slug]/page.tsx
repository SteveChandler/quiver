import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/funnel/JsonLd";
import { NearbyBuoysSlot } from "@/components/tide-stations/nearby-buoys-slot";
import { TideBreadcrumbs } from "@/components/tide-stations/tide-breadcrumbs";
import { TideStationCurve } from "@/components/tide-stations/tide-station-curve";
import { TideStationNow } from "@/components/tide-stations/tide-station-now";
import { TideWeekTable } from "@/components/tide-stations/tide-week-table";
import { ZineSurface } from "@/components/zine";
import { applyIndexabilityToMetadata, evaluateTideStationIndexability } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildStationCopy, stationPlaceLabel, stationTideType, tideTypeLabel } from "@/lib/tide-stations/copy";
import { formatZoneOffset } from "@/lib/tide-stations/format";
import { countryName, US_COUNTRY_SLUG, usRegionName } from "@/lib/tide-stations/geography";
import { getStationPageData } from "@/lib/tide-stations/page-data";
import { getNearbyBeachLinks, getNearbyTideStations, getTideStationLink } from "@/lib/tide-stations/queries";
import { groupExtremesByLocalDay } from "@/lib/tide-stations/series";
import { buildStationDescription, buildStationTitle } from "@/lib/tide-stations/seo";
import { tideStationPath } from "@/lib/tide-stations/slug";
import type { TideStationRow } from "@/lib/tide-stations/types";

// Pages render on first request (no generateStaticParams: ~7k stations and every
// prod deploy empties the cache). 12 h keeps NOAA calls to two per station per day
// at most; the series covers 9 days ahead, so a cached copy always holds a full
// week, and the "now" panel re-reads the visitor's clock on load.
export const dynamic = "force-static";
export const revalidate = 43200;

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app").replace(/\/$/, "");

interface PageProps {
  params: Promise<{ slug: string }>;
}

function placeCrumbs(station: TideStationRow): Array<{ name: string; path: string }> {
  const crumbs = [
    { name: "Tides", path: "/tides" },
    { name: countryName(station.country_code), path: `/tides/${station.country_slug}` },
  ];
  if (station.country_slug === US_COUNTRY_SLUG && station.region && station.region_slug) {
    crumbs.push({ name: usRegionName(station.region), path: `/tides/${station.country_slug}/${station.region_slug}` });
  }
  return crumbs;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getStationPageData(slug);
  if (!data) {
    return { title: "Tide station not found", robots: { index: false, follow: false } };
  }
  const { station, series } = data;
  const title = buildStationTitle(station);
  const metadata = buildPageMetadata({
    title,
    description: buildStationDescription(station),
    path: tideStationPath(station.slug),
  });
  return applyIndexabilityToMetadata(
    metadata,
    evaluateTideStationIndexability({ predictionsAvailable: series.status === "ok" })
  );
}

export default async function TideStationPage(props: PageProps) {
  const { slug } = await props.params;
  const data = await getStationPageData(slug);
  if (!data) notFound();
  const { station, series, renderedAtMs } = data;

  const [nearbyStations, nearbyBeaches, reference] = await Promise.all([
    getNearbyTideStations(station),
    getNearbyBeachLinks(station.lat, station.lon),
    station.reference_station_id ? getTideStationLink(`noaa:${station.reference_station_id}`) : Promise.resolve(null),
  ]);

  const place = stationPlaceLabel(station);
  const path = tideStationPath(station.slug);
  const ok = series.status === "ok";
  const extremes = ok ? series.extremes : [];
  const days = ok ? groupExtremesByLocalDay(extremes, station.timezone, renderedAtMs, 7) : [];
  const tideType = ok ? stationTideType(station, extremes) : null;
  const copy = ok
    ? buildStationCopy({
        station,
        extremes: days.flatMap((d) => d.extremes),
        tideType,
        nearestBeach: nearbyBeaches[0] ?? null,
        referenceStationName: reference?.name ?? null,
      })
    : [];
  const todayIso = new Date(renderedAtMs).toISOString().slice(0, 10);

  return (
    <ZineSurface sectionLabel="Tides" data-testid="tide-station-page">
      <div className="mx-auto max-w-5xl px-4 py-8 text-[#11100D] sm:px-6">
        <TideBreadcrumbs crumbs={[{ name: "Home", path: "/" }, ...placeCrumbs(station), { name: station.name, path }]} />
        {ok && (
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: `${station.name} tide predictions`,
              description: buildStationDescription(station),
              url: `${baseUrl}${path}`,
              isAccessibleForFree: true,
              // Day precision keeps regenerated pages identical when the data has not changed.
              dateModified: todayIso,
              temporalCoverage: `${todayIso}/P7D`,
              spatialCoverage: {
                "@type": "Place",
                name: `${station.name}, ${place}`,
                geo: { "@type": "GeoCoordinates", latitude: station.lat, longitude: station.lon },
              },
              creditText: station.attribution,
              license: station.licence_url,
              measurementTechnique:
                station.source === "noaa" ? "NOAA CO-OPS harmonic tide predictions" : "Harmonic prediction from TICON-4 tidal constants",
              provider: { "@type": "Organization", name: "Quiver", url: baseUrl },
            }}
          />
        )}

        <header className="mb-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]">
            Tide station · {place}
          </p>
          <h1 className="zine-display mt-2 text-3xl font-bold leading-tight sm:text-4xl">{station.name} tides</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#11100D]/75">
            Times are local ({station.timezone}, {formatZoneOffset(renderedAtMs, station.timezone)}). Predicted tides, not live
            water levels. Not for navigation.
          </p>
        </header>

        {ok ? (
          <div className="space-y-8">
            <TideStationNow extremes={extremes} timeZone={station.timezone} renderedAtMs={renderedAtMs} />

            <section aria-labelledby="week-heading" className="space-y-3">
              <h2 id="week-heading" className="font-heading text-xl font-bold">Next 7 days</h2>
              <TideStationCurve hourly={series.hourly} extremes={extremes} days={days} timeZone={station.timezone} />
              <TideWeekTable days={days} timeZone={station.timezone} />
              {series.adjustmentFt !== 0 && (
                <p className="text-xs leading-relaxed text-[#11100D]/70">
                  Heights include a +{series.adjustmentFt.toFixed(1)} ft sea-level adjustment Quiver applies at California
                  stations: water has run this much above NOAA’s tables this season. NOAA’s own table reads{" "}
                  {series.adjustmentFt.toFixed(1)} ft lower.
                </p>
              )}
            </section>

            {copy.length > 0 && (
              <section aria-labelledby="about-heading" className="space-y-3">
                <h2 id="about-heading" className="font-heading text-xl font-bold">About this station</h2>
                {copy.map((paragraph) => (
                  <p key={paragraph} className="max-w-3xl text-sm leading-relaxed text-[#11100D]/80">{paragraph}</p>
                ))}
              </section>
            )}
          </div>
        ) : (
          <div role="alert" className="border-2 border-[#B91C1C] bg-[#FBF6E8] p-4" data-testid="tide-station-failure">
            <p className="font-heading text-lg font-bold">Tide predictions are not loading</p>
            <p className="mt-1 text-sm text-[#11100D]/75">
              {station.source === "noaa" ? "NOAA CO-OPS" : "The prediction model"} did not return tides for this station just now.
              Try again later.
            </p>
          </div>
        )}

        <section aria-labelledby="facts-heading" className="mt-10">
          <h2 id="facts-heading" className="font-heading text-xl font-bold">Station facts</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Fact label="Station ID" value={station.source_station_id} mono />
            <Fact label="Source" value={station.source === "noaa" ? "NOAA CO-OPS" : `TICON-4 · ${station.operator}`} />
            <Fact
              label="Type"
              value={
                station.station_kind === "reference"
                  ? "Reference station"
                  : station.station_kind === "subordinate"
                    ? "Subordinate station"
                    : "Harmonic constants (computed)"
              }
            />
            {station.station_kind === "subordinate" && (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/60">Reference station</dt>
                <dd>
                  {reference ? (
                    <Link href={tideStationPath(reference.slug)} className="font-semibold text-[#AA4918] underline">
                      {reference.name}
                    </Link>
                  ) : (
                    <span className="font-mono">{station.reference_station_id ?? "—"}</span>
                  )}
                </dd>
              </div>
            )}
            <Fact label="Coordinates" value={`${station.lat.toFixed(4)}, ${station.lon.toFixed(4)}`} mono />
            <Fact
              label="Datum"
              value={station.source === "noaa" ? "MLLW (mean lower low water)" : "Computed MLLW from TICON-4 constants (mean sea level + offset)"}
            />
            {tideType && <Fact label="Tide type" value={tideTypeLabel(tideType.type)} />}
            <Fact label="Time zone" value={station.timezone} />
          </dl>
        </section>

        {nearbyBeaches.length > 0 && (
          <section aria-labelledby="beaches-heading" className="mt-10">
            <h2 id="beaches-heading" className="font-heading text-xl font-bold">Nearby surf spots</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {nearbyBeaches.map((beach) => (
                <li key={beach.id}>
                  <Link href={beach.href} className="flex justify-between gap-3 border-b border-dashed border-[#11100D]/30 py-2 hover:text-[#AA4918]">
                    <span className="font-semibold">{beach.name} surf forecast</span>
                    <span className="font-mono text-xs text-[#11100D]/60">{Math.round(beach.distanceKm)} km</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nearbyStations.length > 0 && (
          <section aria-labelledby="stations-heading" className="mt-10">
            <h2 id="stations-heading" className="font-heading text-xl font-bold">Nearby tide stations</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {nearbyStations.map((nearby) => (
                <li key={nearby.id}>
                  <Link href={tideStationPath(nearby.slug)} className="flex justify-between gap-3 border-b border-dashed border-[#11100D]/30 py-2 hover:text-[#AA4918]">
                    <span className="font-semibold">{nearby.name}</span>
                    <span className="font-mono text-xs text-[#11100D]/60">{Math.round(nearby.distanceKm)} km</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <NearbyBuoysSlot lat={station.lat} lon={station.lon} />

        <footer className="mt-10 border-t-2 border-[#11100D] pt-4 text-xs leading-relaxed text-[#11100D]/70" data-testid="tide-station-credit">
          <p>{station.attribution}</p>
          <p className="mt-1">
            Licence:{" "}
            <a href={station.licence_url} className="underline" rel="noopener noreferrer license" target="_blank">
              {station.licence === "cc-by-4.0" ? "CC BY 4.0" : "U.S. public domain (NOAA)"}
            </a>
            . Predictions are astronomical tides only: wind, swell and pressure move real water. Not for navigation.
          </p>
        </footer>
      </div>
    </ZineSurface>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/60">{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}
