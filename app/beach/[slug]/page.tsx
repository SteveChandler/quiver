"use client";

import { BottomNavigation } from "@/components/bottom-navigation";
import { BeachDetail } from "@/components/beach-detail";
import {
  getBeachBySlug,
  getBeachById,
} from "@/actions/beach/beach-query-actions";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { trackPublicPageView } from "@/lib/analytics";
import { FullPageLoader } from "@/components/ui/loading-states";
import type { Beach } from "@/types/database";
import { BeachPageStructuredData } from "@/components/seo/structured-data";

export default function BeachDetailBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const { user } = useAuth();
  const [beach, setBeach] = useState<Beach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Track public page view
    if (!user) {
      trackPublicPageView("beach-detail", { slug: params.slug });
    }

    // Fetch beach data
    async function fetchBeach() {
      try {
        // Try slug lookup first
        const bySlug = await getBeachBySlug(params.slug);
        let beachData = bySlug?.data || null;

        // Back-compat: if slug lookup fails, try treating slug as an ID
        if (!beachData) {
          const byId = await getBeachById(params.slug);
          beachData = byId?.data || null;
        }

        setBeach(beachData);
      } catch (error) {
        console.error("Error fetching beach:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBeach();
  }, [params.slug, user]);

  if (loading) {
    return <FullPageLoader message="Loading beach..." />;
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

      {/* Client detail component uses id for API calls */}
      <BeachDetail id={beach.id} publicMode={!user} />

      <BottomNavigation />
    </>
  );
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
