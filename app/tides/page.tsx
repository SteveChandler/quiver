import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TideBreadcrumbs } from "@/components/tide-stations/tide-breadcrumbs";
import { TideHubList } from "@/components/tide-stations/tide-hub-list";
import { ZineSurface } from "@/components/zine";
import { applyIndexabilityToMetadata, evaluateTideHubIndexability } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";
import { countryEntries, loadRegionCounts, stationCountLabel } from "@/lib/tide-stations/hubs";
import { buildHubDescription, buildHubTitle } from "@/lib/tide-stations/seo";

// Hubs change only when the registry is re-seeded.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const rows = await loadRegionCounts();
  const total = rows?.reduce((sum, row) => sum + row.station_count, 0) ?? 0;
  const metadata = buildPageMetadata({
    title: buildHubTitle(null, total),
    description: buildHubDescription(null, total),
    path: "/tides",
  });
  return applyIndexabilityToMetadata(metadata, evaluateTideHubIndexability(total));
}

export default async function TidesIndexPage() {
  const rows = await loadRegionCounts();
  if (!rows) notFound();
  const countries = countryEntries(rows);
  const total = countries.reduce((sum, c) => sum + c.count, 0);

  return (
    <ZineSurface sectionLabel="Tides" data-testid="tide-hub-page">
      <div className="mx-auto max-w-5xl px-4 py-8 text-[#11100D] sm:px-6">
        <TideBreadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Tides", path: "/tides" }]} />
        <h1 className="zine-display text-3xl font-bold sm:text-4xl">Tide times by country</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#11100D]/75">
          {total.toLocaleString("en-US")} tide stations in {countries.length} countries. Pick a station for today’s highs
          and lows, a 7-day table and a tide curve in local time. Predicted tides, not for navigation.
        </p>
        <div className="mt-8">
          <TideHubList
            label="Countries"
            items={countries.map((c) => ({
              key: c.slug,
              name: c.name,
              href: `/tides/${c.slug}`,
              meta: stationCountLabel(c.count),
            }))}
          />
        </div>
      </div>
    </ZineSurface>
  );
}
