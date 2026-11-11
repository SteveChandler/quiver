/**
 * Region buoy hub: /buoys/[country]/[region], e.g. /buoys/us/ca. Regions are
 * the registry's region codes (US states and territories today).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AreaHubView } from "@/components/buoys/area-hub-view";
import { countryName, countryPath, isCodeSlug, regionName, regionPath } from "@/lib/buoy-pages/geo-names";
import { loadAreaHub } from "@/lib/buoy-pages/hub-data";
import { getBuoyPageSource } from "@/lib/buoy-pages/source";
import { buildHubDescription, buildHubTitle } from "@/lib/seo/buoy-meta";
import { applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import { buildPageMetadata } from "@/lib/seo/meta";

export const dynamic = "force-static";
export const revalidate = 1800;

interface PageProps {
  params: Promise<{ country: string; region: string }>;
}

const loadHub = cache(async (country: string, region: string) =>
  isCodeSlug(country) && isCodeSlug(region)
    ? loadAreaHub(await getBuoyPageSource(), country, region, new Date())
    : null,
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country, region } = await params;
  const hub = await loadHub(country, region);
  if (!hub?.regionCode) return { robots: { index: false, follow: true } };
  const name = regionName(hub.countryCode, hub.regionCode);
  const metadata = buildPageMetadata({
    title: buildHubTitle(name),
    description: buildHubDescription(name, hub.stationCount),
    path: regionPath(hub.countryCode, hub.regionCode),
    keywords: [`${name} wave buoys`, `${name} buoy data`, `${name} swell`, "live buoy readings"],
  });
  return hub.indexableCount > 0
    ? metadata
    : applyIndexabilityToMetadata(metadata, { indexable: false, reason: "insufficient-data" });
}

export default async function RegionBuoysPage({ params }: PageProps) {
  const { country, region } = await params;
  const hub = await loadHub(country, region);
  if (!hub?.regionCode) notFound();

  const name = regionName(hub.countryCode, hub.regionCode);
  return (
    <AreaHubView
      hub={hub}
      title={name}
      breadcrumbs={[
        { name: "Buoys", path: "/buoys" },
        { name: countryName(hub.countryCode), path: countryPath(hub.countryCode) },
        { name, path: regionPath(hub.countryCode, hub.regionCode) },
      ]}
    />
  );
}
