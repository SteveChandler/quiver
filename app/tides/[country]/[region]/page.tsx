import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TideBreadcrumbs } from "@/components/tide-stations/tide-breadcrumbs";
import { TideHubList } from "@/components/tide-stations/tide-hub-list";
import { ZineSurface } from "@/components/zine";
import { applyIndexabilityToMetadata, evaluateTideHubIndexability } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";
import { countryName, US_COUNTRY_SLUG, usRegionName } from "@/lib/tide-stations/geography";
import { loadRegionCounts, stationCountLabel } from "@/lib/tide-stations/hubs";
import { listTideStationsInPlace } from "@/lib/tide-stations/queries";
import { buildHubDescription, buildHubTitle } from "@/lib/tide-stations/seo";
import { tideStationPath } from "@/lib/tide-stations/slug";

export const dynamic = "force-static";
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ country: string; region: string }>;
}

/** Regions exist only for the US; every other country lists its stations on the country page. */
async function loadRegion(country: string, region: string) {
  if (country !== US_COUNTRY_SLUG) return null;
  const rows = await loadRegionCounts();
  const row = rows?.find((r) => r.country_slug === country && r.region_slug === region && r.region);
  if (!row?.region) return null;
  return { name: usRegionName(row.region), countryCode: row.country_code, total: row.station_count };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { country, region } = await props.params;
  const data = await loadRegion(country, region);
  if (!data) return { title: "Tide stations not found", robots: { index: false, follow: false } };
  const metadata = buildPageMetadata({
    title: buildHubTitle(data.name, data.total),
    description: buildHubDescription(data.name, data.total),
    path: `/tides/${country}/${region}`,
  });
  return applyIndexabilityToMetadata(metadata, evaluateTideHubIndexability(data.total));
}

export default async function TideRegionPage(props: PageProps) {
  const { country, region } = await props.params;
  const data = await loadRegion(country, region);
  if (!data) notFound();
  const stations = await listTideStationsInPlace(country, region);
  const kindCount = (kind: string) => stations.filter((s) => s.station_kind === kind).length;
  const breakdown = [
    [kindCount("reference"), "NOAA reference"],
    [kindCount("subordinate"), "NOAA subordinate"],
    [kindCount("harmonic-model"), "computed from TICON-4 constants"],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, label]) => `${Number(n).toLocaleString("en-US")} ${label}`)
    .join(", ");

  return (
    <ZineSurface sectionLabel="Tides" data-testid="tide-hub-page">
      <div className="mx-auto max-w-5xl px-4 py-8 text-[#11100D] sm:px-6">
        <TideBreadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Tides", path: "/tides" },
            { name: countryName(data.countryCode), path: `/tides/${country}` },
            { name: data.name, path: `/tides/${country}/${region}` },
          ]}
        />
        <h1 className="zine-display text-3xl font-bold sm:text-4xl">{data.name} tide times</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#11100D]/75">
          {stationCountLabel(stations.length)}: {breakdown}. Reference stations carry their own harmonic constants;
          subordinate stations are predicted as offsets from one. Not for navigation.
        </p>
        <div className="mt-8">
          <TideHubList
            label="Tide stations"
            items={stations.map((s) => ({
              key: s.id,
              name: s.name,
              href: tideStationPath(s.slug),
              meta: s.station_kind === "reference" ? "reference" : undefined,
            }))}
          />
        </div>
      </div>
    </ZineSurface>
  );
}
