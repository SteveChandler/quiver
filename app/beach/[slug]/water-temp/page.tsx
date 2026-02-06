import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema } from "@/components/seo/faq-schema";
import { BeachDetailClient } from "../beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicWaterTempMetadata } from "@/lib/seo/meta";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { notFound, redirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export default async function BeachWaterTempPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;

  try {
    const beach = await getBeachBySlugOrId(params.slug);

    if (!beach) {
      notFound();
    }

    const beachTimezone =
      beach.lat != null && beach.lon != null
        ? getTimezoneFromCoords(beach.lat, beach.lon)
        : null;

    // Redirect to hierarchical URL if beach has complete data
    if (beach.slug && beach.city && beach.state) {
      const hierarchicalUrl = buildBeachUrl(beach);
      const currentBasePath = `/beach/${params.slug}`;

      if (hierarchicalUrl !== currentBasePath) {
        redirect(`${hierarchicalUrl}/water-temp`);
      }
    }

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
            { name: beach.name, url: `${baseUrl}/beach/${params.slug}` },
            { name: "Water Temperature", url: `${baseUrl}/beach/${params.slug}/water-temp` },
          ]}
        />

        {/* FAQ Structured Data for rich snippets */}
        <BeachFAQSchema beachName={beach.name} />

        <BeachDetailClient
          beach={beach}
          slug={params.slug}
          beachTimezone={beachTimezone}
          defaultTab="forecast"
          defaultSubTab="conditions"
        />
      </>
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      const digest = (error as { digest?: unknown }).digest;
      if (
        digest === "NEXT_NOT_FOUND" ||
        (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))
      ) {
        throw error;
      }
    }

    console.error("Error fetching beach for water temp:", error);
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Error Loading Water Temperature</h2>
            <p className="text-muted-foreground">
              There was an error loading water temperature data. Please try again.
            </p>
          </div>
        </main>
      </div>
    );
  }
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const beach = await getBeachBySlugOrId(params.slug);

  if (beach) {
    // Fetch water temp data for dynamic SEO
    let waterTempData: { tempF?: number | null; wetsuitRec?: string | null } | null = null;
    try {
      const tempMeta = await getWaterTempMetaData(beach.id);
      waterTempData = {
        tempF: tempMeta.tempF,
        wetsuitRec: tempMeta.wetsuitRec,
      };
    } catch {
      // Gracefully degrade to static metadata on fetch failure
    }

    // Build CTR-optimized title and description
    const { title, description } = buildDynamicWaterTempMetadata({
      beach,
      waterTempData,
    });

    return buildPageMetadata({
      title,
      description,
      path: `/beach/${params.slug}/water-temp`,
      image: `/api/og/beach?slug=${params.slug}`,
    });
  }

  return buildPageMetadata({
    title: `Water Temperature`,
    description: `Current water temperature and conditions for this beach.`,
    path: `/beach/${params.slug}/water-temp`,
  });
}
