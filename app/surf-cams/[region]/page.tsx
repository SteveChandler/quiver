import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { CamsRegionDirectoryPage } from "@/app/cams/[region]/page";
import { getCamRegionBySlug } from "@/lib/data/cam-regions";
import { SeoLocationPage } from "@/components/seo/funnel/SeoLocationPage";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  filterSeoCamBeaches,
  getSeoFunnelPageByTypeAndSlug,
} from "@/lib/seo/funnel-pages";

// The public read client fetches with no-store; see createPublicReadClient.
export const dynamic = "force-static";
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ region: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { region } = await props.params;
  const page = getSeoFunnelPageByTypeAndSlug("surf-cams", region);

  if (!page) {
    const camRegion = getCamRegionBySlug(region);
    if (!camRegion) {
      return {
        title: "Surf Cams Not Found",
        robots: { index: false, follow: true },
      };
    }

    const cameras = await getBeachesWithCameras();
    const camCount = cameras.filter((camera) => camera.regionSlug === region).length;

    return buildPageMetadata({
      title: `Live Surf Cams in ${camRegion.name} — ${camCount} Cameras`,
      description: `Watch ${camCount} live surf cams in ${camRegion.name}. ${camRegion.description}`,
      path: `/surf-cams/${region}`,
      image: `/api/og/cams?region=${encodeURIComponent(region)}&name=${encodeURIComponent(camRegion.name)}`,
      keywords: [
        `${camRegion.name} surf cam`,
        `${camRegion.name} beach cam`,
        `live surf cam ${camRegion.name}`,
        "surf cam live",
        "surf webcam",
        "beach camera",
      ],
    });
  }

  return buildPageMetadata({
    title: page.title,
    description: page.metaDescription,
    path: page.path,
    image: page.heroImage.src,
  });
}

export default async function SeoSurfCamsPage(props: PageProps) {
  const { region } = await props.params;
  const page = getSeoFunnelPageByTypeAndSlug("surf-cams", region);

  if (page) {
    const cameras = filterSeoCamBeaches(page, await getBeachesWithCameras());
    return <SeoLocationPage page={page} cameras={cameras} />;
  }

  const camRegion = getCamRegionBySlug(region);
  if (!camRegion) notFound();

  return <CamsRegionDirectoryPage regionSlug={camRegion.slug} />;
}
