import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
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
    return {
      title: "Surf Cams Not Found",
      robots: { index: false, follow: true },
    };
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

  if (!page) notFound();

  const cameras = filterSeoCamBeaches(page, await getBeachesWithCameras());

  return <SeoLocationPage page={page} cameras={cameras} />;
}
