import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TideBreadcrumbs } from "@/components/tide-stations/tide-breadcrumbs";
import { TideHubList } from "@/components/tide-stations/tide-hub-list";
import { ZineSurface } from "@/components/zine";
import { applyIndexabilityToMetadata, evaluateTideHubIndexability } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";
import { countryName, US_COUNTRY_SLUG } from "@/lib/tide-stations/geography";
import { loadRegionCounts, regionEntries, stationCountLabel } from "@/lib/tide-stations/hubs";
import { listTideStationsInPlace } from "@/lib/tide-stations/queries";
import { buildHubDescription, buildHubTitle } from "@/lib/tide-stations/seo";
import { tideStationPath } from "@/lib/tide-stations/slug";

export const dynamic = "force-static";
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ country: string }>;
}

async function loadCountry(slug: string) {
  const rows = await loadRegionCounts();
  const countryRows = rows?.filter((row) => row.country_slug === slug) ?? [];
  if (!countryRows.length) return null;
  return {
    name: countryName(countryRows[0].country_code),
    total: countryRows.reduce((sum, row) => sum + row.station_count, 0),
    rows: rows ?? [],
  };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { country } = await props.params;
  const data = await loadCountry(country);
  if (!data) return { title: "Tide stations not found", robots: { index: false, follow: false } };
  const metadata = buildPageMetadata({
    title: buildHubTitle(data.name, data.total),
    description: buildHubDescription(data.name, data.total),
    path: `/tides/${country}`,
  });
  return applyIndexabilityToMetadata(metadata, evaluateTideHubIndexability(data.total));
}

export default async function TideCountryPage(props: PageProps) {
  const { country } = await props.params;
  const data = await loadCountry(country);
  if (!data) notFound();

  const isUs = country === US_COUNTRY_SLUG;
  const regions = isUs ? regionEntries(data.rows, country) : [];
  const stations = isUs ? [] : await listTideStationsInPlace(country);

  return (
    <ZineSurface sectionLabel="Tides" data-testid="tide-hub-page">
      <div className="mx-auto max-w-5xl px-4 py-8 text-[#11100D] sm:px-6">
        <TideBreadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Tides", path: "/tides" },
            { name: data.name, path: `/tides/${country}` },
          ]}
        />
        <h1 className="zine-display text-3xl font-bold sm:text-4xl">{data.name} tide times</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#11100D]/75">
          {stationCountLabel(data.total)}
          {isUs ? ` across ${regions.length} states and territories.` : "."} Each page has
          today’s highs and lows, a 7-day table and a tide curve in local time. Not for navigation.
        </p>
        <div className="mt-8">
          {isUs ? (
            <TideHubList
              label="States and territories"
              items={regions.map((r) => ({
                key: r.slug,
                name: r.name,
                href: `/tides/${country}/${r.slug}`,
                meta: stationCountLabel(r.count),
              }))}
            />
          ) : (
            <TideHubList
              label="Tide stations"
              items={stations.map((s) => ({ key: s.id, name: s.name, href: tideStationPath(s.slug) }))}
            />
          )}
        </div>
      </div>
    </ZineSurface>
  );
}
