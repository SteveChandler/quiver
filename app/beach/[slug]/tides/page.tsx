import { isNextRouterSignal } from "@/lib/utils/next-router-signal";
import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicTideMetadata } from "@/lib/seo/meta";
import { getBeachTidePageData } from "@/lib/tides/beach-station-tide";
import { notFound, permanentRedirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";

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
        permanentRedirect(`${hierarchicalUrl}/tides`);
      }
    }

    return renderBeachSubPage({
      beachSlug: params.slug,
      pageType: "tides",
      beachPath: `/beach/${params.slug}`,
    });
  } catch (error) {
    if (isNextRouterSignal(error)) throw error;

    console.error("Error fetching beach for tides:", error);
    return (
      <div className="flex min-h-screen flex-col">
        <main className="container mx-auto flex-1 px-2 py-4 sm:px-4">
          <div className="border-2 border-[#11100D] bg-[#F4EBD8] p-5 text-[#11100D]">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]">Tide chart</p>
            <h2 className="mt-2 font-heading text-2xl font-bold">Tides did not load</h2>
            <p className="mt-2 text-sm text-[#11100D]/80">Something broke on our side. Refresh in a minute.</p>
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
      const tideMeta = (await getBeachTidePageData(beach.id, beach.timezone)).display;
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

    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      },
    };
  }

  return buildPageMetadata({
    title: `Tide Chart`,
    description: `Tide times and predictions for this beach.`,
    path: `/beach/${params.slug}/tides`,
  });
}
