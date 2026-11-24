/**
 * Buoy hub: /buoys. Countries with wave buoys, a map, and stations the
 * registry could not place in a country.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { HubFootnote, HubMap, HubStationList } from "@/components/buoys/hub-sections";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { countryPath } from "@/lib/buoy-pages/geo-names";
import { loadRootHub, mapPins } from "@/lib/buoy-pages/hub-data";
import { getBuoyPageSource } from "@/lib/buoy-pages/source";
import { evaluateStationIndexability } from "@/lib/buoy-pages/status";
import { absoluteUrl, buildHubDescription, buildHubTitle } from "@/lib/seo/buoy-meta";
import { applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";

export const dynamic = "force-static";
export const revalidate = 1800;

const loadHub = cache(async () => loadRootHub(await getBuoyPageSource(), new Date()));

export async function generateMetadata(): Promise<Metadata> {
  const hub = await loadHub();
  if (!hub) return { robots: { index: false, follow: true } };
  const metadata = buildPageMetadata({
    title: buildHubTitle(null),
    description: buildHubDescription(null, hub.all.length),
    path: "/buoys",
    keywords: ["wave buoys", "buoy data", "live buoy readings", "swell buoy", "NDBC buoys"],
  });
  const nowMs = Date.now();
  return hub.all.some((station) => evaluateStationIndexability(station, nowMs).indexable)
    ? metadata
    : applyIndexabilityToMetadata(metadata, { indexable: false, reason: "insufficient-data" });
}

export default async function BuoysHubPage() {
  const hub = await loadHub();
  if (!hub) notFound();

  return (
    <>
      <BreadcrumbStructuredData items={[{ name: "Buoys", url: absoluteUrl("/buoys") }]} />
      <ZineSurface sectionLabel="Buoys" data-testid="buoy-hub-page">
        <main>
          <header className="relative mb-8">
            <QuiverSticker sticker="orangeMap" className="absolute -right-4 -top-6 hidden w-28 -rotate-6 opacity-80 lg:block" />
            <h1 className="zine-h1 font-black uppercase leading-[0.9] text-[#11100D] [overflow-wrap:anywhere] [hyphens:auto]">Wave buoys</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#11100D]/75">
              {`${hub.all.length} buoys reporting waves. Each page has the latest reading, the swell split where the buoy sends one, 30-day charts and the model forecast at the buoy.`}
            </p>
          </header>

          <HubMap pins={mapPins(hub.all)} label={`Map of ${hub.all.length} wave buoys`} />

          <section className="mb-10" aria-labelledby="buoy-countries-heading">
            <h2 id="buoy-countries-heading" className="mb-3 font-display text-2xl font-black uppercase text-[#11100D]">
              By country
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="buoy-hub-countries">
              {hub.countries.map((country) => (
                <li key={country.code}>
                  <Link
                    href={countryPath(country.code)}
                    className="flex items-baseline justify-between gap-3 border-2 border-[#11100D] bg-[#FFFDF7] px-3 py-2.5 hover:bg-[#FBF6E8]"
                  >
                    <span className="font-semibold text-[#11100D]">{country.name}</span>
                    <span className="font-mono text-xs text-[#11100D]/60">
                      {`${country.stationCount} · ${country.liveCount} live`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {hub.unplaced.length > 0 ? (
            <section className="mb-10" aria-labelledby="buoy-unplaced-heading">
              <h2 id="buoy-unplaced-heading" className="mb-3 font-display text-2xl font-black uppercase text-[#11100D]">
                Open ocean and other waters
              </h2>
              <HubStationList items={hub.unplaced} />
            </section>
          ) : null}

          <HubFootnote />
        </main>
      </ZineSurface>
    </>
  );
}
