/**
 * Country buoy hub: /buoys/[country] (lowercase ISO code, e.g. /buoys/us).
 * A segment that is not a two-letter code is a legacy station URL
 * (/buoys/46225); it 308s to the station page when it matches one station.
 */

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { AreaHubView } from "@/components/buoys/area-hub-view";
import { countryName, countryPath, isCodeSlug, regionPath, stationPath } from "@/lib/buoy-pages/geo-names";
import { loadAreaHub } from "@/lib/buoy-pages/hub-data";
import { getBuoyPageSource } from "@/lib/buoy-pages/source";
import { resolveStationSlug } from "@/lib/buoy-pages/station-page-data";
import { buildHubDescription, buildHubTitle } from "@/lib/seo/buoy-meta";
import { applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";

export const dynamic = "force-static";
export const revalidate = 1800;

interface PageProps {
  params: Promise<{ country: string }>;
}

const loadHub = cache(async (country: string) =>
  isCodeSlug(country) ? loadAreaHub(await getBuoyPageSource(), country, null, new Date()) : null,
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country } = await params;
  const hub = await loadHub(country);
  if (!hub) return { robots: { index: false, follow: true } };
  const name = countryName(hub.countryCode);
  const metadata = buildPageMetadata({
    title: buildHubTitle(name),
    description: buildHubDescription(name, hub.stationCount),
    path: countryPath(hub.countryCode),
    keywords: [`${name} wave buoys`, `${name} buoy data`, "live buoy readings", "swell buoy"],
  });
  return hub.indexableCount > 0
    ? metadata
    : applyIndexabilityToMetadata(metadata, { indexable: false, reason: "insufficient-data" });
}

export default async function CountryBuoysPage({ params }: PageProps) {
  const { country } = await params;
  if (!isCodeSlug(country)) {
    const slug = await resolveStationSlug(await getBuoyPageSource(), country);
    if (slug) permanentRedirect(stationPath(slug));
    notFound();
  }
  const hub = await loadHub(country);
  if (!hub) notFound();

  const name = countryName(hub.countryCode);
  const hasRegions = hub.groups.some((group) => group.code !== null);
  return (
    <AreaHubView
      hub={hub}
      title={name}
      breadcrumbs={[
        { name: "Buoys", path: "/buoys" },
        { name, path: countryPath(hub.countryCode) },
      ]}
      regionHref={hasRegions ? (code) => regionPath(hub.countryCode, code) : undefined}
    />
  );
}
