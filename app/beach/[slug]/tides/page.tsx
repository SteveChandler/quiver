import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema } from "@/components/seo/faq-schema";
import { BeachDetailClient } from "../beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { notFound, redirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export default async function BeachTidesPage(
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
        redirect(`${hierarchicalUrl}/tides`);
      }
    }

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
            { name: beach.name, url: `${baseUrl}/beach/${params.slug}` },
            { name: "Tide Chart", url: `${baseUrl}/beach/${params.slug}/tides` },
          ]}
        />

        {/* FAQ Structured Data for rich snippets */}
        <BeachFAQSchema beachName={beach.name} />

        <BeachDetailClient
          beach={beach}
          slug={params.slug}
          beachTimezone={beachTimezone}
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

    console.error("Error fetching beach for tides:", error);
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Error Loading Tide Chart</h2>
            <p className="text-muted-foreground">
              There was an error loading tide information. Please try again.
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
    const now = new Date();
    const month = now.toLocaleDateString("en-US", { month: "long" });
    const year = now.getFullYear();

    const locationContext =
      beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

    return buildPageMetadata({
      title: `${beach.name} Tide Chart ${month} ${year} - High/Low Times`,
      description: `Complete tide chart for ${beach.name}${locationContext}. Today's high and low tide times. Hourly predictions and optimal surf windows included. Free, no paywall.`,
      path: `/beach/${params.slug}/tides`,
      image: `/api/og/beach?slug=${params.slug}`,
    });
  }

  return buildPageMetadata({
    title: `Tide Chart`,
    description: `Tide times and predictions for this beach.`,
    path: `/beach/${params.slug}/tides`,
  });
}
