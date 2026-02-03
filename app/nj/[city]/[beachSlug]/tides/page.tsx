import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema } from "@/components/seo/faq-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicTideMetadata } from "@/lib/seo/meta";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { notFound } from "next/navigation";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export const dynamic = "force-dynamic";

export default async function NjBeachTidesPage(
  props: {
    params: Promise<{ city: string; beachSlug: string }>;
  }
) {
  const params = await props.params;

  const beach = await getBeachBySlugOrId(params.beachSlug);

  if (!beach) {
    notFound();
  }

  const beachTimezone =
    beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : null;

  const beachPath = `/nj/${params.city}/${params.beachSlug}`;

  return (
    <>
      <BeachPageStructuredData
        beachName={beach.name}
        description={`Tide chart and tide times for ${beach.name}. High and low tide predictions updated daily.`}
        latitude={beach.lat || 0}
        longitude={beach.lon || 0}
        rating={(beach as any).average_rating || undefined}
        reviewCount={(beach as any).review_count || undefined}
        city={beach.city || undefined}
        state={beach.state || undefined}
        country={beach.country || undefined}
      />

      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: baseUrl },
          { name: "Surf Spots Map", url: `${baseUrl}/map` },
          { name: beach.name, url: `${baseUrl}${beachPath}` },
          { name: "Tide Chart", url: `${baseUrl}${beachPath}/tides` },
        ]}
      />

      <BeachFAQSchema beachName={beach.name} />

      <BeachDetailClient
        beach={beach}
        slug={params.beachSlug}
        beachTimezone={beachTimezone}
      />
    </>
  );
}

export async function generateMetadata(
  props: {
    params: Promise<{ city: string; beachSlug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const beach = await getBeachBySlugOrId(params.beachSlug);

  if (beach) {
    // Fetch tide data for dynamic SEO
    let tideData: { nextHighTime?: string | null; nextLowTime?: string | null } | null = null;
    try {
      const tideMeta = await getTideMetaData(beach.id);
      tideData = {
        nextHighTime: tideMeta.nextHighTime,
        nextLowTime: tideMeta.nextLowTime,
      };
    } catch {
      // Gracefully degrade to static metadata on tide fetch failure
    }

    // Build CTR-optimized title and description
    const { title, description } = buildDynamicTideMetadata({
      beach,
      tideData,
    });

    return buildPageMetadata({
      title,
      description,
      path: `/nj/${params.city}/${params.beachSlug}/tides`,
      image: `/api/og/beach?slug=${params.beachSlug}`,
    });
  }

  return buildPageMetadata({
    title: `Tide Chart`,
    description: `Tide times and predictions for this beach.`,
    path: `/nj/${params.city}/${params.beachSlug}/tides`,
  });
}
