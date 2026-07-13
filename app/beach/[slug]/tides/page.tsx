import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicTideMetadata } from "@/lib/seo/meta";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { notFound, redirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";
import {
  isBeachDatabaseRecordEligible,
  type BeachEditorialDatabaseRecord,
} from "@/lib/seo/indexability";

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

    // Redirect to hierarchical URL if beach has complete data
    if (beach.slug && beach.city && beach.state) {
      const hierarchicalUrl = buildBeachUrl(beach);
      const currentBasePath = `/beach/${params.slug}`;

      if (hierarchicalUrl !== currentBasePath) {
        redirect(`${hierarchicalUrl}/tides`);
      }
    }

    return renderBeachSubPage({
      beachSlug: params.slug,
      pageType: "tides",
      beachPath: `/beach/${params.slug}`,
    });
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

    const metadata = buildPageMetadata({
      title,
      description,
      path: `/beach/${params.slug}/tides`,
      image: `/api/og/beach?slug=${params.slug}`,
    });

    return isBeachDatabaseRecordEligible(beach as BeachEditorialDatabaseRecord)
      ? metadata
      : { ...metadata, robots: { index: false, follow: true } };
  }

  return buildPageMetadata({
    title: `Tide Chart`,
    description: `Tide times and predictions for this beach.`,
    path: `/beach/${params.slug}/tides`,
  });
}
