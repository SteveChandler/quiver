import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema } from "@/components/seo/faq-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { notFound } from "next/navigation";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export const dynamic = "force-dynamic";

export default async function CaBeachWaterTempPage(
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

  const beachPath = `/hi/${params.city}/${params.beachSlug}`;

  return (
    <>
      <BeachPageStructuredData
        beachName={beach.name}
        description={`Current water temperature at ${beach.name}. Wetsuit recommendations and seasonal trends.`}
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
          { name: "Water Temperature", url: `${baseUrl}${beachPath}/water-temp` },
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
    const locationContext =
      beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

    return buildPageMetadata({
      title: `${beach.name} Water Temperature Today | Current Conditions`,
      description: `Current water temp at ${beach.name}${locationContext}. Wetsuit recommendation and seasonal trends. Free surf conditions, no paywall.`,
      path: `/hi/${params.city}/${params.beachSlug}/water-temp`,
      image: `/api/og/beach?slug=${params.beachSlug}`,
    });
  }

  return buildPageMetadata({
    title: `Water Temperature`,
    description: `Current water temperature and conditions for this beach.`,
    path: `/hi/${params.city}/${params.beachSlug}/water-temp`,
  });
}
