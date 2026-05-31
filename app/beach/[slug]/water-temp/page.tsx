import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicWaterTempMetadata } from "@/lib/seo/meta";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { notFound, redirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";

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

    // Redirect to hierarchical URL if beach has complete data
    if (beach.slug && beach.city && beach.state) {
      const hierarchicalUrl = buildBeachUrl(beach);
      const currentBasePath = `/beach/${params.slug}`;

      if (hierarchicalUrl !== currentBasePath) {
        redirect(`${hierarchicalUrl}/water-temp`);
      }
    }

    return renderBeachSubPage({
      beachSlug: params.slug,
      pageType: "water-temp",
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
