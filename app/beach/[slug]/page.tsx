import { BottomNavigation } from "@/components/bottom-navigation";
import { BeachDetail } from "@/components/beach-detail";
import {
  getBeachBySlug,
  getBeachById,
} from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "./beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";

export default async function BeachDetailBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  // Fetch beach data server-side
  try {
    // Try slug lookup first
    const bySlug = await getBeachBySlug(params.slug);
    let beach = bySlug?.data || null;

    // Back-compat: if slug lookup fails, try treating slug as an ID
    if (!beach) {
      const byId = await getBeachById(params.slug);
      beach = byId?.data || null;
    }

    if (!beach) {
      return (
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 container mx-auto px-4 py-6">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-2">Beach Not Found</h2>
              <p className="text-muted-foreground">
                We couldn't find this beach in our directory.
              </p>
            </div>
          </main>
          <BottomNavigation />
        </div>
      );
    }

    return (
      <>
        {/* Structured Data: Place/Beach */}
        <BeachPageStructuredData
          beachName={beach.name}
          description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
          latitude={beach.latitude}
          longitude={beach.longitude}
          rating={(beach as any).average_rating || undefined}
          reviewCount={(beach as any).review_count || undefined}
        />

        {/* Breadcrumb Structured Data for SEO */}
        <BreadcrumbStructuredData
          items={[
            { name: "Home", url: baseUrl },
            { name: "Surf Spots Map", url: `${baseUrl}/map` },
            { name: beach.name, url: `${baseUrl}/beach/${params.slug}` },
          ]}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient beach={beach} slug={params.slug} />

        <BottomNavigation />
      </>
    );
  } catch (error) {
    console.error("Error fetching beach:", error);
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Error Loading Beach</h2>
            <p className="text-muted-foreground">
              There was an error loading this beach. Please try again.
            </p>
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // Keep metadata generation side-effect free; don't depend on auth/session
  const slug = params.slug;
  // Try to resolve name synchronously but without relying on cookies/POST contexts
  try {
    const result = await getBeachBySlug(slug);
    const beach = result?.data || null;
    if (beach) {
      return buildPageMetadata({
        title: `${beach.name} Surf Guide`,
        description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}.`,
        path: `/beach/${slug}`,
      });
    }
  } catch {}

  return buildPageMetadata({
    title: `Beach Surf Guide | Quiver`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${slug}`,
  });
}
